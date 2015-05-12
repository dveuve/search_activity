import sys
import re
import urllib, urllib2
from xml.dom import minidom
#import splunk.entity, splunk.Intersplunk
import splunklib.results as results
import splunklib.client as client
import splunk.Intersplunk
import json
import base64
import zlib
import saUtils
import requests	
import splunk.entity, splunk.Intersplunk
settings = dict()
records = splunk.Intersplunk.readResults(settings = settings, has_header = True)
entity = splunk.entity.getEntity('/server','settings', namespace='search_activity', sessionKey=settings['sessionKey'], owner='-')
mydict = dict() 
mydict = entity
myPort = mydict['mgmtHostPort']

print "description,output"

inputs = {}
inputs['systeminfo'] = 1
inputs['tsidxinfo'] = 1
inputs['macroconfig'] = 1
inputs['scriptedinputstatus'] = 1
inputs['Logs'] = 1
inputs['SAActivity'] = 1
inputs['anonactivity'] = 1
inputs['volume'] = 1
inputs['numservers'] = 1
inputs['lifetime'] = 1
inputs['debug'] = 0

d = dict()
for s in sys.argv:
	
	if "=" in s: 
		
		(a,b) = s.split("=")
		if a in inputs:
			
			if b == "false" or b=='"false"' or b == "0":
				inputs[a] = 0
				
			elif b == "true" or b == '"true"' or b == "1" :
				
				inputs[a] = 1
				
			else:
				raise Exception("Error! Invalid value (" + b + "=" + a + ") - valid options are true or false")
		else: 
			raise Exception("Error! Invalid parameter: " + a)

summarized = ""
for key in inputs:
	summarized += key + "=" + str(inputs[key]) + " "


settings = saUtils.getSettings(sys.stdin)
sessionKey = settings['sessionKey']

HOST = "127.0.0.1"
PORT = myPort
USERNAME = settings['owner']

service = client.Service(token=sessionKey, host=HOST, port=PORT, username=USERNAME) # This fails at trying to run the search (line 50)

values = {}




# Create a Service instance and log in 
#service = client.connect(host=HOST, port=PORT, app="search_activity", username=USERNAME, password=PASSWORD)


jobs = service.jobs

# Run a blocking search--search everything, return 1st 100 events
kwargs_blockingsearch_alltime = {"exec_mode": "blocking", "app": "search_activity", "namespace": "search_activity", "earliest_time": "0", "latest_time": "now"}

kwargs_blockingsearch_30days = {"exec_mode": "blocking", "app": "search_activity", "namespace": "search_activity", "earliest_time": "-30d", "latest_time": "now"}


#### MY Queries

SearchGenerateDiag = '| generatediag ' + summarized 

print "Running Diag with string:," + SearchGenerateDiag

output = {}

try:
	job = jobs.create(SearchGenerateDiag, **kwargs_blockingsearch_alltime)
	for result in results.ResultsReader(job.results()):
		output[result['description']] = result['output'] 
		
except Exception, e:
	
	print "Error,Error Generating Diag"
	errorResults = splunk.Intersplunk.generateErrorResults(e)

print "Got this far...,..."

for key in output:
	print key + "," + output[key]


payload = {'data': output['compressed'], 'authcode': 'search_activity_app_upload_code_123456'}
r = requests.post("https://www.davidveuve.com/SA_Support.cgi", data=payload, verify=False)
print(r.text)


