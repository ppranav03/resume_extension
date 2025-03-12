from flask import Flask, request, jsonify
from flask_cors import CORS
from bs4 import BeautifulSoup
from spacy.matcher import PhraseMatcher
from dotenv import load_dotenv
from googlesearch import search
from models import Job
import requests, spacy, fitz, os, json
import google.generativeai as genai
app = Flask(__name__)
CORS(app)

load_dotenv()
GEMINI_KEY = os.getenv("GEMINI_KEY")

@app.route("/")
def hello_world():
    return "This is the Resume Scraper API"

@app.route("/scan", methods=['POST'])
def scan():
    data = request.get_json()
    if not data or "url" not in data or "university" not in data:
        return jsonify({"error": "Invalid Request. a url is needed"}), 401
    

    url = data.get('url')
    webtext = process_url(url)
    if webtext is None:
        return jsonify({"error": "Invalid URL"}), 401
    
    # skills = find_skills(webtext["content"])

    
    genai.configure(api_key=GEMINI_KEY)
    model = genai.GenerativeModel("gemini-1.5-flash")
    # skills_string = ''.join(skill for skill in skills)
    # prompt = (f"With these skills, determine some personal projects and technical preparation to improve skills when looking for jobs that request these skills: {skills_string}. "
    #           "Provide 1-2 projects where I can use multiple skills provided in one project, it does not have to be all skills used in one project. "
    #           "Ensure that the project is not too complex, but also not too simple. The project should be able to be completed in a reasonable amount of time, such as a week or two. "
    #           "Summarize the output in roughly 100 words."
    # )

    prompt = (f"What company is this and what kind of role are they looking for? Use this html content from the application website {webtext.get('script_tag')} to determine the company and role. Do not add the level of experience into the role just solely the role and company. ")
    my_gen_config = genai.GenerationConfig(
        temperature=0.5,
        response_mime_type="application/json",
        response_schema=Job
    )

    response = model.generate_content(
        [prompt],
        generation_config=my_gen_config
    )

    response_json = json.loads(response.text)
    response_json['university'] = data.get('university')
    results = search_contacts(response_json)
    contacts = [result["title"] for result in results]
    links = [result["link"] for result in results]
    print(response_json)
    return jsonify({
        'url': url,
        'webtext' : webtext["content"],
        # 'skills' : skills,
        'ai_response' : response.text,
        'contacts': contacts,
        'links': links
    })

@app.route("/file", methods=['POST'])
def file():
    if 'file' not in request.files:
        return jsonify({"error": "Invalid Request. a file is needed"}), 401

    file = request.files['file']
    resume = file.read()

    resume_content = process_pdf(resume)
    skills = find_skills(resume_content)

    return jsonify({
        'fileName': file.filename,
        'skills': skills
    })


@app.route("/compare", methods=['POST'])
def compare():
    if 'file' not in request.files or 'url' not in request.form:
        return jsonify({"error": "Invalid Request. Both file and url are needed"}), 401

    file = request.files['file']
    url = request.form['url']

    application_text = process_url(url)
    # application_skills = find_skills(application_text["content"])

    resume_text = process_pdf(file.read())
    resume_skills = find_skills(resume_text)

    genai.configure(api_key=GEMINI_KEY)
    model = genai.GenerativeModel("gemini-1.5-flash")
    # application_skills_string = ''.join(skill for skill in application_skills)
    resume_skills_string = ''.join(skill for skill in resume_skills)

    prompt = (f"Looking at the skills from the job application: and the skills from the resume: {resume_skills_string}, "
              "Find the differences among the skill sets and provide a summary of how to prepare for the job application. "
              "Also highlight differences in skills and provide suggestions for personal projects or technical questions to prepare for the job application. "
    )
    my_gen_config = genai.GenerationConfig(
        temperature=0.3
    )

    response = model.generate_content(
        [prompt],
        generation_config=my_gen_config
    )

    compare_response = {
        'ai_response': response.text,
        'resume_skills': resume_skills,
        # 'application_skills': application_skills
    }
    return jsonify(compare_response)

def find_skills(job_description):
    nlp = spacy.load("en_core_web_sm")
    matcher = PhraseMatcher(nlp.vocab)
    terms = ["Python", "SQL", "Java", "C++", "JavaScript", "HTML", "CSS", "Ruby", "PHP", "Swift", "Go", "Kotlin", "R", "TypeScript", "Perl", "Scala", "Rust", "MATLAB"]
    skills = [nlp.make_doc(term) for term in terms]

    matcher.add("TechSkills", skills)
    
    doc = nlp(job_description)
    matches = matcher(doc)
    found_skills = []
    for match_id, start, end in matches:
        # string_id = doc.vocab.strings[match_id]  # Look up string ID
        span = doc[start:end]
        if found_skills.count(span.text) == 0:
            found_skills.append(span.text)
    return found_skills

def process_url(url, wish_list=None):
    webtext = ''
    try:   
        response = requests.get(url)
        if response.status_code == 200:
            soup = BeautifulSoup(response.content, 'html.parser')
            script_tag = soup.find("script", {"type": "application/ld+json"})
            webtext = {
                "title": soup.title.string,
                "content": soup.prettify(),
                "script_tag" : script_tag
            }
    except Exception as e:
        print(f"Error with retrieving html content: {e}")
        return None
    return webtext

def process_pdf(file):
    with fitz.open(stream=file, filetype="pdf") as doc:
        text = "\n".join([page.get_text() for page in doc])
    return text

def search_contacts(job_details):
    company = job_details.get('company')
    role = job_details.get('role')
    university = job_details.get('university')
    print(f"UNIVERSITY:{university}")

    google_search_key = os.getenv("GOOGLE_SEARCH_KEY")
    cx = os.getenv("GOOGLE_SEARCH_CX")  
    query = f'site:linkedin.com/in {company} {role} {university}'
    # url = f"https://api.scraperapi.com?api_key={scraper_api_key}&url=https://www.google.com/search?q={query}"
    # results = [url for url in search(query, num_results=10)]
    # return results
    url = f"https://www.googleapis.com/customsearch/v1?q={query}&key={google_search_key}&cx={cx}"

    response = requests.get(url)
    data = response.json()

    # links = [item["link"] for item in data.get("items", [])]
    results = data.get("items", [])

    return results



if __name__ == "__main__":
    app.run(debug=True)
