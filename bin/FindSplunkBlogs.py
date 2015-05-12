import requests
import re
import HTMLParser
import urllib, htmlentitydefs, csv
import sys
import json

# http://effbot.org/zone/re-sub.htm#unescape-html
def unescape(text):
    def fixup(m):
        text = m.group(0)
        if text[:2] == "&#":
            # character reference
            try:
                if text[:3] == "&#x":
                    return unichr(int(text[3:-1], 16))
                else:
                    return unichr(int(text[2:-1]))
            except ValueError:
                pass
        else:
            # named entity
            try:
                text = unichr(htmlentitydefs.name2codepoint[text[1:-1]])
            except KeyError:
                pass
        return text # leave as is
    return re.sub("&#?\w+;", fixup, text)


NumberOfPages = 4 


d = dict()
for s in sys.argv:
	if "=" in s: 
		(a,b) = s.split("=")
		d[a] = b

if 'NumPages' in d:
	NumberOfPages = int(d['NumPages'])


#print "Using NumPages: " + str(NumberOfPages)

writer = csv.writer(sys.stdout)
data = list()
iterate = 0
writer.writerow(["title","url","img","date", "description"])


for i in range(1, NumberOfPages):

	r = requests.get("http://blogs.splunk.com/page/" + str(i) + "/")
	h = HTMLParser.HTMLParser()

	page = r.content
	articles = re.findall(' <div class="post postExcerpt">.*?</div>\s*</div>', page, re.DOTALL)
	for article in articles:
		#print article
		#print "*****************************************************************"
		img = ""
		url = ""
		title = ""
		description = ""
		location = ""
		date = ""
		match = re.search(r"wp-image-\S* src=.(?P<img>[^\"]*)", article) 
		if match:
			#print "Got a match!"
			img = match.group('img')

		match = re.search(r"a href=\"(?P<url>http://blogs.splunk.com[^\"]*).*?class=\"postTitle\">(?P<title>[^<]*)", article) 
		if match:
			#print "Got a match!"
			url = match.group('url')
			title = match.group('title')
		
			
		match = re.search(r"postDate\">(?P<date>[^<]*)", article) 
		if match:
			date = match.group('date')
			
	#	match = re.search(r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)+,+(?P<date>.*?)$", date) 
	#	if match:
	#		date = match.group('date')

			
		match = re.search(r"class=\"excerpt\">(?P<description>.*?)</div>", article, re.DOTALL) 
		if match:
			description = match.group('description')
			
		description = unescape(re.sub(r"<[^>]*>", " ", description, re.DOTALL) )

			
		match = re.search(r"^(?P<description>(\S*\s*){50})", description) 
		if match:
			description = match.group('description') + "..."
		#print title
		#print url
		#print img
		#print date
		writer.writerow([title, url, img, date, description])
		#writer.writerow([unicode(unescape(title)).encode("utf8"), unicode(unescape(url)).encode("utf8"), unicode(unescape(img)).encode("utf8"), date])
#	data.append(dict())
	#data[iterate]['title'] = unicode(unescape(title)).encode("utf8")
	#data[iterate]['description'] = description
	#data[iterate]['url'] = unicode(unescape(url)).encode("utf8")
	#data[iterate]['img'] = unicode(unescape(img)).encode("utf8")
	#data[iterate]['location'] = unicode(unescape(location)).encode("utf8")
	
	#data[iterate]['title'] = "Random Title Will be This Long" + str(iterate + 1)
	#data[iterate]['description'] = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. " + str(iterate + 1)
	#data[iterate]['url'] = "http://www.abc123.com/Ihaveplaces" + str(iterate + 1)
	#data[iterate]['img'] = "/content/images/ihaveimages"+ str(iterate + 1)
	#data[iterate]['location'] = "San Francisco, US"
#	iterate = iterate + 1

#print json.dumps(data)

