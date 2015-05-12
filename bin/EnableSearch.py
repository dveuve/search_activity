import sys
import re
import urllib, urllib2
from xml.dom import minidom
import splunk.entity, splunk.Intersplunk
settings = dict()
records = splunk.Intersplunk.readResults(settings = settings, has_header = True)
#print entity

macroname = ""
macrovalue = ""

search = settings['search']

#print search

search_groups = re.search("searchname=\"([^\"]*?)\"", search)
searchname = search_groups.group(1)


if searchname == "":
  raise Exception("Error! Missing parameter.")

#print macroname
#print macrovalue

print "output"
print searchname
entity = splunk.entity.getEntity('/saved/searches',searchname, namespace='search_activity', sessionKey=settings['sessionKey'], owner='nobody')
search = entity.get('search')
cron = entity.get('cron_schedule')
owner = entity.get('eai:acl.owner')
print owner
base_url = "https://127.0.0.1:8089"



#print base_url + '/servicesNS/nobody/search_activity/properties/macros/test'
searchname=urllib.quote(searchname)
request = urllib2.Request(base_url + '/servicesNS/nobody/search_activity/saved/searches/' + searchname + '/enable', data="",
    headers = { 'Authorization': ('Splunk %s' %settings['sessionKey'])})
search_results = urllib2.urlopen(request)


print "output"
print search_results.read()


