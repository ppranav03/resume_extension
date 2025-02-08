from bs4 import BeautifulSoup
import requests

response = requests.get("https://www.npr.org/2024/12/20/nx-s1-5235273/government-shutdown-disaster-aid-trump-debt-ceiling")
content = response.content
soup = BeautifulSoup(content, 'html.parser')
print(soup.title.string)