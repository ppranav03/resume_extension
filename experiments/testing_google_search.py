# from googlesearch import search

# query = 'site:linkedin.com/in "Google" "Software Engineer"'
# results = [url for url in search(query, num_results=10)]
# print(results)
import requests, os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GOOGLE_SEARCH_KEY")
cx = os.getenv("GOOGLE_SEARCH_CX")
query = 'site:linkedin.com/in "Google" "Harvard University" "Software Engineer"'
url = f"https://www.googleapis.com/customsearch/v1?q={query}&key={api_key}&cx={cx}"

response = requests.get(url)
data = response.json()
results = data.get("items", [])
for result in results:
    print(result["link"])

#links = [item["link"] for item in data.get("items", [])]

