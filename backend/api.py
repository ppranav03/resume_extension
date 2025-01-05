from flask import Flask, request, jsonify
from flask_cors import CORS
from bs4 import BeautifulSoup
import requests
app = Flask(__name__)
CORS(app)

@app.route("/")
def hello_world():
    return "This is the Fake News API"

@app.route("/verify", methods=['POST'])
def verify():
    data = request.json
    url = data.get('url')

    response = requests.get(url)
    soup = BeautifulSoup(response.content, 'html.parser')



    return jsonify({
        'url': url
    })

if __name__ == "__main__":
    app.run(debug=True)
