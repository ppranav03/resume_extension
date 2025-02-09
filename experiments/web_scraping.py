from bs4 import BeautifulSoup
import json, requests

# Sample HTML containing JSON-LD
# url = "https://careers.costargroup.com/careers?pid=446702351152&domain=costar.com&sort_by=relevance"
url = "https://careers.ibm.com/job/20962169/entry-level-software-developer-2025-lowell-ma/?codes=WEB_Search_NA"
response = requests.get(url)

if response.status_code == 200:
    soup = BeautifulSoup(response.content, "html.parser")

    # Find the script tag with type "application/ld+json"
    script_tag = soup.find("script", {"type": "application/ld+json"})
    
    if script_tag:
        print(script_tag)
        # Load the JSON content
        job_data = json.loads(script_tag.string)

        # Extract relevant information
        job_title = job_data.get("title", "Job title not found")
        company_name = job_data.get("hiringOrganization", {}).get("name", "Company name not found")

        print(f"Job Title: {job_title}")
        print(f"Company Name: {company_name}")
    else:
        print("No job posting JSON found.")
else:
    print("Error with request")