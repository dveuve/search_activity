import sys
import re
import urllib, urllib2
from xml.dom import minidom
import splunk.entity, splunk.Intersplunk
settings = dict()
records = splunk.Intersplunk.readResults(settings = settings, has_header = True)
#entity = splunk.entity.getEntity('/properties/macros','test', namespace='search_activity', sessionKey=settings['sessionKey'], owner='nobody')
#print entity.get('definition')
#print entity

macroname = ""
macrovalue = ""

search = settings['search']


d = dict()
for s in sys.argv:
	if "=" in s: 
		(a,b) = s.split("=")
		d[a] = b

print "output"
print search
print d['macroname']
print d['macrovalue']





#print search


macroname = d['macroname']
macrovalue = d['macrovalue']

if macroname == "" or macrovalue == "":
  raise Exception("Error! Missing parameter.")

#print macroname
#print macrovalue


base_url = "https://127.0.0.1:8089"

#print base_url + '/servicesNS/nobody/search_activity/properties/macros/test'

request = urllib2.Request(base_url + '/servicesNS/-/search_activity/properties/macros/' + macroname,
    data = urllib.urlencode({'definition': macrovalue}),
    headers = { 'Authorization': ('Splunk %s' %settings['sessionKey'])})
search_results = urllib2.urlopen(request)
print "output"
print search_results.read()


