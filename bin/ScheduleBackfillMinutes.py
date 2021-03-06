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

d = dict()
for s in sys.argv:
	if "=" in s: 
		(a,b) = s.split("=")
		d[a] = b


if d['starttime'] == "" or d['endtime'] == "" or d['minutesoffset'] == "" or d['type'] == "":
  raise Exception("Error! Missing parameter.") 


if d['endtime'] < d['starttime']:
  raise Exception("Error! Starttime and endtime switched.") 

starttime = d['starttime']

endtime = d['endtime']

minutesoffset = d['minutesoffset']
print "output"


import datetime

now = datetime.datetime.now()

now = now + datetime.timedelta(minutes=float(minutesoffset))

crontab = str(now.minute) + " " + str(now.hour) + " " + str(now.day) + " " + str(now.month) + " *"




#print macroname
#print macrovalue
if d['type'] == "searchhistory":

	base_url = "https://127.0.0.1:" + myPort

	#print base_url + '/servicesNS/nobody/search_activity/properties/macros/test'

	
	searchquery =  'earliest=' + starttime + ' latest=' + endtime + '  `FillSearchHistory_Search` | search NOT ([|tstats local=t values(searchid) as searchid from `SA_SearchHistory` where _time >= ' + starttime + ' _time < ' + endtime + "| eval search=mvjoin(searchid, ' OR ') ] ) `FillSearchHistory_TSCollect`" + ''
	searchname = "search_population_" + d['type'] + "_" + minutesoffset
	request = urllib2.Request(base_url + '/servicesNS/' + settings['owner'] + '/search_activity/saved/searches',
	    data = urllib.urlencode({'search': searchquery, 'name': searchname, 'is_scheduled': "1", 'dispatch.ttl': "3600", 'cron_schedule': crontab}),
	    headers = { 'Authorization': ('Splunk %s' %settings['sessionKey'])})
	search_results = urllib2.urlopen(request)
	
	print search_results.read()

elif d['type'] == "clearevents":

	base_url = "https://127.0.0.1:" + myPort


	request = urllib2.Request(base_url + '/servicesNS/' + settings['owner'] + '/search_activity/saved/searches',
	    data = urllib.urlencode({'search': '|clearoldbackfilljobs type="events"', 'name': "events_population_clear_backfill", 'is_scheduled': "1", 'cron_schedule': crontab}),
	    headers = { 'Authorization': ('Splunk %s' %settings['sessionKey'])})
	search_results = urllib2.urlopen(request)
	
	print search_results.read()

elif d['type'] == "clearsearch":

	base_url = "https://127.0.0.1:" + myPort


	request = urllib2.Request(base_url + '/servicesNS/' + settings['owner'] + '/search_activity/saved/searches',
	    data = urllib.urlencode({'search': '|clearoldbackfilljobs type="search"', 'name': "search_population_clear_backfill", 'is_scheduled': "1", 'cron_schedule': crontab}),
	    headers = { 'Authorization': ('Splunk %s' %settings['sessionKey'])})
	search_results = urllib2.urlopen(request)
	
	print search_results.read()

elif d['type'] == "events":

	base_url = "https://127.0.0.1:" + myPort

	#print base_url + '/servicesNS/nobody/search_activity/properties/macros/test'

	searchquery =  'earliest=' + starttime + ' latest=' + endtime + ' `FillEvents_Search` `FillEvents_TSCollect`'
	searchname = "events_population_" + d['type'] + "_" + hoursoffset
	request = urllib2.Request(base_url + '/servicesNS/' + settings['owner'] + '/search_activity/saved/searches',
	    data = urllib.urlencode({'search': searchquery, 'name': searchname, 'is_scheduled': "1", 'dispatch.ttl': "3600", 'cron_schedule': crontab}),
	    headers = { 'Authorization': ('Splunk %s' %settings['sessionKey'])})
	search_results = urllib2.urlopen(request)
	
	print search_results.read()
