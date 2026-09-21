from collections import Counter

from flask import Flask, request, jsonify
from flask_cors import CORS
from bs4 import BeautifulSoup
from google.api_core.exceptions import ResourceExhausted
import requests, os

import ai
import clustering
import db

app = Flask(__name__)
CORS(app)
db.init_db()

MAX_PAGES_PER_REQUEST = 20
PROFILE_BATCH = 5  # postings profiled per Gemini call

# Cluster names are cached so re-opening a view doesn't re-ask Gemini.
# Key: (dimension, ((job_id, cluster_id), ...)).
_label_cache = {}


@app.route("/")
def hello_world():
    return "This is the Resume Scraper API"


@app.route("/scan", methods=['POST'])
def scan():
    data = request.get_json()
    if not data or "url" not in data or "university" not in data:
        return jsonify({"error": "Invalid Request. a url and university are needed"}), 401

    url = data.get('url')
    print(f"URL: {url}")
    webtext = process_url(url)
    if webtext is None:
        return jsonify({"error": "Invalid URL"}), 401

    job_details = ai.extract_job(webtext["title"], webtext["description"])
    job_details['university'] = data.get('university')
    print(job_details)

    results = search_contacts(job_details)
    if results is None:
        return jsonify({"error": "Contact search failed. Check the backend logs."}), 502

    db.save_scan(url, job_details['company'], job_details['role'], job_details['university'], results)
    return jsonify({
        'contacts': [result["title"] for result in results],
        'links': [result["link"] for result in results]
    })


@app.route("/cluster/add", methods=['POST'])
def cluster_add():
    """Profile several job pages at once. Body: {"pages": [{"url", "title", "text"}, ...]}."""
    data = request.get_json(silent=True) or {}
    pages = data.get("pages")
    if not isinstance(pages, list) or not pages:
        return jsonify({"error": "Send a non-empty list of pages."}), 400
    if len(pages) > MAX_PAGES_PER_REQUEST:
        return jsonify({"error": f"At most {MAX_PAGES_PER_REQUEST} pages at a time."}), 400
    
    results = {}
    usable = []
    for page in pages:
        url = str(page.get("url") or "")
        if not url or not page.get("text"):
            results[url] = {"url": url, "status": "failed", "error": "No page text."}
        else:
            usable.append(page)

    profiled = []
    for start in range(0, len(usable), PROFILE_BATCH):
        chunk = usable[start:start + PROFILE_BATCH]
        try:
            profiles = ai.extract_profiles(chunk)
        except Exception as e:
            print(f"Profile failed for a batch of {len(chunk)}: {e}")
            error = ("Gemini rate limit reached. Wait a minute and try again."
                     if isinstance(e, ResourceExhausted) else "Could not read this posting.")
            profiles = {}
        else:
            error = "Could not read this posting."
        for i, page in enumerate(chunk):
            if i in profiles:
                profiled.append((page, profiles[i]))
            else:
                results[page["url"]] = {"url": page["url"], "status": "failed", "error": error}

    if profiled:
        try:
            # One batched call: three texts (role, duties, skills) per job.
            texts = [t for _, profile in profiled for t in _texts_in_order(profile)]
            vectors = ai.embed(texts)
        except Exception as e:
            print(f"Embedding failed: {e}")
            for page, _ in profiled:
                results[page["url"]] = {"url": page["url"], "status": "failed", "error": "Embedding failed."}
        else:
            for i, (page, profile) in enumerate(profiled):
                role_vec, duties_vec, skills_vec = vectors[i * 3:i * 3 + 3]
                try:
                    status = db.save_profile(
                        page["url"], profile,
                        {"role": role_vec, "duties": duties_vec, "skills": skills_vec},
                    )
                except Exception as e:
                    # One bad posting shouldn't lose the others.
                    print(f"Saving {page['url']} failed: {e}")
                    results[page["url"]] = {"url": page["url"], "status": "failed", "error": "Could not save this posting."}
                    continue
                results[page["url"]] = {
                    "url": page["url"], "status": status,
                    "company": profile["company"], "role": profile["role"],
                }

    return jsonify({"results": list(results.values())})


@app.route("/jobs")
def jobs():
    return jsonify(db.list_jobs())


@app.route("/jobs/<int:job_id>", methods=['DELETE'])
def delete_job(job_id):
    if not db.delete_job(job_id):
        return jsonify({"error": "Job not found."}), 404
    return jsonify({"deleted": job_id})


@app.route("/cluster")
def cluster():
    by = request.args.get("by", "role")
    if by not in db.DIMENSIONS:
        return jsonify({"error": f"'by' must be one of {', '.join(db.DIMENSIONS)}."}), 400

    k = None
    if request.args.get("k"):
        try:
            k = int(request.args["k"])
        except ValueError:
            return jsonify({"error": "'k' must be a whole number."}), 400
        if not 2 <= k <= clustering.MAX_K:
            return jsonify({"error": f"'k' must be between 2 and {clustering.MAX_K}."}), 400

    jobs = db.profiled_jobs(by)
    empty = {"by": by, "count": len(jobs), "min_jobs": clustering.MIN_JOBS,
             "k": 0, "auto": k is None, "points": [], "clusters": []}
    if len(jobs) < clustering.MIN_JOBS:
        return jsonify(empty)

    labels, coords, k_used = clustering.cluster([j["embedding"] for j in jobs], k)
    labels = [int(label) for label in labels]

    texts = [ai.dimension_texts(j)[by] for j in jobs]
    members = {}
    for i, label in enumerate(labels):
        members.setdefault(label, []).append(i)

    names = _cluster_names(by, jobs, labels, texts, members)
    clusters = []
    for cid in sorted(members):
        entry = {"id": cid, "label": names[cid], "size": len(members[cid]),
                 "job_ids": [jobs[i]["id"] for i in members[cid]]}
        if by == "skills":
            counts = Counter(s.strip().lower() for i in members[cid] for s in jobs[i]["skills"])
            entry["top_terms"] = [term for term, _ in counts.most_common(5)]
        clusters.append(entry)

    points = [
        {"id": job["id"], "x": float(coords[i][0]), "y": float(coords[i][1]), "cluster": labels[i],
         "company": job["company"], "role": job["role"], "url": job["url"]}
        for i, job in enumerate(jobs)
    ]
    return jsonify({**empty, "k": k_used, "points": points, "clusters": clusters})


def _texts_in_order(profile):
    texts = ai.dimension_texts(profile)
    return [texts[dim] for dim in db.DIMENSIONS]


def _cluster_names(by, jobs, labels, texts, members):
    key = (by, tuple((job["id"], label) for job, label in zip(jobs, labels)))
    if key not in _label_cache:
        try:
            groups = {cid: [texts[i] for i in idx] for cid, idx in members.items()}
            names = ai.label_clusters(by, groups)
        except Exception as e:
            print(f"Cluster naming failed: {e}")
            names = {}
        if set(names) != set(members):
            # Don't cache a failed or partial naming, so the next request retries.
            return {cid: names.get(cid, f"Cluster {cid + 1}") for cid in members}
        _label_cache[key] = names
    return _label_cache[key]


def process_url(url):
    try:
        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            return None
        soup = BeautifulSoup(response.content, 'html.parser')
        description = soup.find("meta", attrs={"property": "og:description"})
        return {
            "title": soup.title.string if soup.title else None,
            "description": description.get("content") if description else None
        }
    except Exception as e:
        print(f"Error with retrieving html content: {e}")
        return None


def search_contacts(job_details):
    company = job_details.get('company')
    role = job_details.get('role')
    university = job_details.get('university')

    query = f'site:linkedin.com/in {company} {role} {university}'

    response = requests.post(
        "https://google.serper.dev/search",
        headers={"X-API-KEY": os.getenv("SERPER_KEY")},
        json={"q": query, "num": 10}
    )
    if not response.ok:
        print(f"Search failed: {response.text}")
        return None
    return response.json().get("organic", [])


if __name__ == "__main__":
    app.run(debug=True)
