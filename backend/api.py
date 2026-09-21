from flask import Flask, request, jsonify
from flask_cors import CORS
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from models import Job
import requests, os, json
import google.generativeai as genai

app = Flask(__name__)
CORS(app)

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_KEY"))


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

    prompt = (
        f"""What company is this and what kind of role are they looking for? Use this html content from the application website {webtext.get('description')} to determine the company and role.
        Also use the website title for more context : {webtext["title"]}.
        Do not add the level of experience into the role just solely the role and company."""
    )
    my_gen_config = genai.GenerationConfig(
        temperature=0.5,
        response_mime_type="application/json",
        response_schema=Job
    )

    model = genai.GenerativeModel("gemini-flash-latest")
    response = model.generate_content(
        [prompt],
        generation_config=my_gen_config
    )

    job_details = json.loads(response.text)
    job_details['university'] = data.get('university')
    print(job_details)

    results = search_contacts(job_details)
    if results is None:
        return jsonify({"error": "Contact search failed. Check the backend logs."}), 502
    return jsonify({
        'contacts': [result["title"] for result in results],
        'links': [result["link"] for result in results]
    })


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
