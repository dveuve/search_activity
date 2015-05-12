from subprocess import Popen, PIPE, STDOUT

cmd = '/opt/splunk/bin/splunk btool macros list FillSearchHistory_Search | grep definition -A100'
p = Popen(cmd, shell=True, stdin=PIPE, stdout=PIPE, stderr=STDOUT, close_fds=True)
searchhistory = "search " + p.stdout.read().replace("definition = ","").replace("iseval = 0","")

cmd = '/opt/splunk/bin/splunk btool macros list FillSearchHistory_TSCollect | grep definition -A100'
p = Popen(cmd, shell=True, stdin=PIPE, stdout=PIPE, stderr=STDOUT, close_fds=True)
searchhistoryts = p.stdout.read().replace("definition = ","").replace("iseval = 0","")

cmd = '/opt/splunk/bin/splunk btool macros list FillEvents_Search | grep definition -A100'
p = Popen(cmd, shell=True, stdin=PIPE, stdout=PIPE, stderr=STDOUT, close_fds=True)
events = "search " + p.stdout.read().replace("definition = ","").replace("iseval = 0","")

cmd = '/opt/splunk/bin/splunk btool macros list FillEvents_TSCollect | grep definition -A100'
p = Popen(cmd, shell=True, stdin=PIPE, stdout=PIPE, stderr=STDOUT, close_fds=True)
eventsts = p.stdout.read().replace("definition = ","").replace("iseval = 0","")


import os

index=raw_input("Please provide index number (e.g., case_99999): ")
print "You entered:", index

searchhistory=searchhistory.replace('`auditindex`',"index=" + index)
searchhistory=searchhistory.replace('`auditsourcetype`',"sourcetype=splunk_audit")

events=events.replace('`auditindex`',"index=" + index)
events=events.replace('`auditsourcetype`',"sourcetype=splunk_audit")
events=events.replace('`internal_index`',"index=" + index)
events=events.replace('`scheduler_sourcetype`',"sourcetype=splunk_scheduler")
events=events.replace('`metrics_sourcetype`',"sourcetype=metrics")
events=events.replace('`web_access_sourcetype`',"sourcetype=splunk_web_access")

eventsts=eventsts.replace('.',"_" + index + ".")
searchhistoryts=searchhistoryts.replace('.',"_" + index + ".")

print searchhistory
print searchhistoryts

print events
print eventsts



import splunklib.client as client
import splunklib.results as results

HOST = "127.0.0.1"
PORT = 8089
USERNAME = "admin"
PASSWORD = "splunk123"

values = {}

# Create a Service instance and log in 
service = client.connect(
    host=HOST,
    port=PORT,
    app="search_activity",
    username=USERNAME,
    password=PASSWORD)



jobs = service.jobs

# Run a blocking search--search everything, return 1st 100 events
kwargs_blockingsearch = {"exec_mode": "blocking", "namespace": "search_activity"}

print "Wait for the search to finish..."

# A blocking search returns the job's SID when the search is done
job = jobs.create(searchhistory + searchhistoryts, **kwargs_blockingsearch)
print "...done!\n"

# Get properties of the job
print "Search job properties"
print "Search job ID:        ", job["sid"]
print "Search Query:         ", searchhistory + searchhistoryts
print "The number of events: ", job["eventCount"]
print "The number of results:", job["resultCount"]
print "Search duration:      ", job["runDuration"], "seconds"
print "This job expires in:  ", job["ttl"], "seconds"

print "\nWait for the search to finish..."

# A blocking search returns the job's SID when the search is done
jobtwo = jobs.create(events + eventsts, **kwargs_blockingsearch)
print "...done!\n"

# Get properties of the job
print "Search jobtwo properties"
print "Search jobtwo ID:        ", job["sid"]
print "Search Query:         ", events + eventsts
print "The number of events: ", jobtwo["eventCount"]
print "The number of results:", jobtwo["resultCount"]
print "Search duration:      ", jobtwo["runDuration"], "seconds"
print "This jobtwo expires in:  ", job["ttl"], "seconds"


