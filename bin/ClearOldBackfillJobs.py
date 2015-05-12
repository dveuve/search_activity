import sys
import re
import urllib, urllib2
from xml.dom import minidom
import splunk.entity, splunk.Intersplunk
settings = dict()
records = splunk.Intersplunk.readResults(settings = settings, has_header = True)
entity = splunk.entity.getEntity('/server','settings', namespace='search_activity', sessionKey=settings['sessionKey'], owner='-')
mydict = dict() 
mydict = entity
myPort = mydict['mgmtHostPort']
#entity = splunk.entity.getEntity('/saved/searches','test', namespace='search_activity', sessionKey=settings['sessionKey'], owner='nobody')
entities = splunk.entity.getEntities(['saved','searches'], namespace='search_activity', sessionKey=settings['sessionKey'], owner=settings['owner'], count=200)


d = dict()
for s in sys.argv:
	if "=" in s: 
		(a,b) = s.split("=")
		d[a] = b

matching_string = d['type'] + "_population_"

#print entity.get('definition')
#print entity


#
# Did I mention I'm not that good at Python? Give me some Perl, man!
#

print "output"



base_url = "https://127.0.0.1:" + myPort

#file.write(request.get_full_url() + "\n")
for i, c in entities.items() :
#    print key, value
	
	if matching_string in i:
		print i

		request = urllib2.Request(base_url + '/servicesNS/' + settings['owner'] + '/search_activity/saved/searches/' + i, 
		    headers = { 'Authorization': ('Splunk %s' %settings['sessionKey'])})
		request.get_method = lambda: 'DELETE'
		search_results = urllib2.urlopen(request)

