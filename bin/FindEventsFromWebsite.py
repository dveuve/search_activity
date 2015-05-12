import requests
import re
r = requests.get("http://www.splunk.com/en_us/about-us/events.html")

print "Content"
page = r.content
articles = re.findall('<article.*?</article>', page, re.DOTALL)
for article in articles:
	match = re.match(r"img src=\"(?P<img>[^\"]*)\"", article) 
	if match:
		print match.group('img')