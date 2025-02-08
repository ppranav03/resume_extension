from googlesearch import search

query = 'site:linkedin.com/in "Google" "Software Engineer"'
results = [url for url in search(query, num_results=10)]
print(results)
