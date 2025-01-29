from flask import Flask, request, jsonify
from flask_cors import CORS
from bs4 import BeautifulSoup
from spacy.matcher import PhraseMatcher
import requests, spacy
app = Flask(__name__)
CORS(app)

@app.route("/")
def hello_world():
    return "This is the Fake News API"

@app.route("/scan", methods=['POST'])
def scan():
    data = request.get_json()
    if not data or "url" not in data:
        return jsonify({"error": "Invalid Request. a url is needed"}), 401
    

    url = data.get('url')
    webtext = ''
    try:   
        response = requests.get(url)
        if response.status_code == 200:
            soup = BeautifulSoup(response.content, 'html.parser')
            webtext = soup.prettify()
    except Exception as e:
        print(f"Error with retrieving html content: {e}")

    skills = find_skills(webtext)

    return jsonify({
        'url': url,
        'webtext' : webtext,
        'skills' : skills
    })

def find_skills(job_description):
    nlp = spacy.load("en_core_web_sm")
    matcher = PhraseMatcher(nlp.vocab)
    terms = ["Python", "SQL", "Java"]
    skills = [nlp.make_doc(term) for term in terms]

    matcher.add("TechSkills", skills)
    
    doc = nlp(job_description)
    matches = matcher(doc)
    found_skills = []
    for match_id, start, end in matches:
        # string_id = doc.vocab.strings[match_id]  # Look up string ID
        span = doc[start:end]
        if found_skills.count(span) == 0:
            found_skills.append(span.text)
    return found_skills

if __name__ == "__main__":
    app.run(debug=True)
