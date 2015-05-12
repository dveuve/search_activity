#!/usr/bin/python

import splunklib.results as results
import splunklib.client as client
import time
import sys
from datetime import datetime
from random import randint
RunningID = str(randint(1000000002,10000000000)-1)

sessionKey = ""

for line in sys.stdin:
  sessionKey = line

import splunk.entity, splunk.Intersplunk
settings = dict()
records = splunk.Intersplunk.readResults(settings = settings, has_header = True)
entity = splunk.entity.getEntity('/server','settings', namespace='search_activity', sessionKey=sessionKey, owner='-')
mydict = dict()
mydict = entity
myPort = mydict['mgmtHostPort']

DEBUG = 1
queuecount = 0
queuethreshold = 10

service = client.Service(token=sessionKey, host="127.0.0.1", port=myPort, user="admin")
kwargs_normalsearch = {"exec_mode": "normal", "app": "search_activity"}

searchquery_normal = '| rest "/servicesNS/admin/-/search/jobs"| search dispatchState="RUNNING" OR dispatchState="FINALIZING" OR dispatchState="QUEUED" OR dispatchState="PARSING" title!="| rest*" title="*FillEvents*" '
job = service.jobs.create(searchquery_normal, **kwargs_normalsearch)

while True:
    job.refresh()
    stats = {"isDone": job["isDone"],
             "doneProgress": float(job["doneProgress"])*100}
    if stats["isDone"] == "1":
        break

    time.sleep(2)


countjobs = 0
for result in results.ResultsReader(job.results()):
    countjobs += 1

if countjobs > 0:
    sys.stdout.write("[" + str(datetime.now()) + " - id=" + RunningID + "] Jobs already running.. canceling\n")
    sys.stdout.flush()
    exit()
if DEBUG == 1:
        sys.stdout.write("[" + str(datetime.now()) + " - id=" + RunningID + "] Just ran query: \n" + searchquery_normal + "\n")

searchquery_normal = '| rest "/servicesNS/admin/search_activity/properties/macros/backfill_events_window/definition"'
job = service.jobs.create(searchquery_normal, **kwargs_normalsearch)

while True:
    job.refresh()
    stats = {"isDone": job["isDone"],
             "doneProgress": float(job["doneProgress"])*100}

    if stats["isDone"] == "1":
        break
    time.sleep(2)

if DEBUG == 1:
        sys.stdout.write("[" + str(datetime.now()) + " - id=" + RunningID + "] Just ran query: \n" + searchquery_normal + "\n")

timetobackfill = -1
for result in results.ResultsReader(job.results()):
    timetobackfill = int(result['value'])
    if DEBUG == 1:
        sys.stdout.write("[" + str(datetime.now()) + " - id=" + RunningID + "] Got a timetobackfill of " + str(timetobackfill) + "\n")
        sys.stdout.flush()

if timetobackfill == -1 or timetobackfill == "" or timetobackfill is None:
    sys.stdout.write("[" + str(datetime.now()) + " - id=" + RunningID + "] backfill_events_window macro not configured. No visibility into whether we want to backfill or not, so quiting. Please visit setup page to configure.")
    sys.stdout.flush()
    exit()

searchquery_normal = '| rest "/servicesNS/admin/search_activity/properties/macros/backfill_events_internal/definition"'
job = service.jobs.create(searchquery_normal, **kwargs_normalsearch)

while True:
    job.refresh()
    stats = {"isDone": job["isDone"],
             "doneProgress": float(job["doneProgress"])*100}

    if stats["isDone"] == "1":
        break
    time.sleep(2)

if DEBUG == 1:
        sys.stdout.write("[" + str(datetime.now()) + " - id=" + RunningID + "] Just ran query: \n" + searchquery_normal + "\n")

inttimetobackfill = -1
for result in results.ResultsReader(job.results()):
    inttimetobackfill = int(result['value'])
    if DEBUG == 1:
        sys.stdout.write("[" + str(datetime.now()) + " - id=" + RunningID + "] Got a inttimetobackfill of " + str(inttimetobackfill) + "\n")
        sys.stdout.flush()
if inttimetobackfill == 0:
    sys.stdout.write("[" + str(datetime.now()) + " - id=" + RunningID + "] Seems we are up to date.. using our internal backfll window of 0")
    timetobackfill = inttimetobackfill
if inttimetobackfill == -1 or inttimetobackfill == "" or inttimetobackfill is None:
    sys.stdout.write("[" + str(datetime.now()) + " - id=" + RunningID + "] Got no internal backfill time.. using the configured timetobackfill (" + str(timetobackfill) + ")")
else:
    sys.stdout.write("[" + str(datetime.now()) + " - id=" + RunningID + "] Got an internal backfill time of " + str(inttimetobackfill) + ". Ignoring the default configured timetobackfill (" + str(timetobackfill) + ")")
    timetobackfill = inttimetobackfill

searchquery_normal = "| tstats local=t max(_time) as max from `SA_Events` | eval now=now() | eval timeago = now-max"
job = service.jobs.create(searchquery_normal, **kwargs_normalsearch)

while True:
    job.refresh()
    stats = {"isDone": job["isDone"],
             "doneProgress": float(job["doneProgress"])*100}
             
    if stats["isDone"] == "1":
 
        break
    time.sleep(2)
if DEBUG == 1:
        sys.stdout.write("[" + str(datetime.now()) + " - id=" + RunningID + "] Just ran query: \n" + searchquery_normal + "\n------\n")
shouldbackfill = 1
latest = -1
timeago = -1
now = -1

newtimetobackfill = -1

b_earliest = -1
b_latest = -1

if job.dispatchState != "FAILED": #No TSIDX yet..
    for result in results.ResultsReader(job.results()):
        latest = int(result['max'])
        timeago = int(result['timeago'])
        now = int(result['now'])




if now == -1:

    searchquery_normal = "| stats count | eval now=now()"
    job = service.jobs.create(searchquery_normal, **kwargs_normalsearch)

    while True:
        job.refresh()
        stats = {"isDone": job["isDone"],
                 "doneProgress": float(job["doneProgress"])*100}
                 
        if stats["isDone"] == "1":
     
            break
        time.sleep(2)

    for result in results.ResultsReader(job.results()):
        now = int(result['now'])

if DEBUG == 1:
        sys.stdout.write("[" + str(datetime.now()) + " - id=" + RunningID + "] Entering time management logic: ")
#############################################################################################
#### My sincerest apologies to anyone who ever tries to debug the below. It is criminal. ####
#############################################################################################
if latest == -1:
    if DEBUG == 1:
        sys.stdout.write("1 ")
    b_earliest = now - timetobackfill
    if timetobackfill < 3*24*3600:
        if DEBUG == 1:
          sys.stdout.write(" - a")
        b_latest = now
        newtimetobackfill = 1
    else:

        if DEBUG == 1:
          sys.stdout.write(" - b")
        b_latest = now - timetobackfill + 3*24*3600
        newtimetobackfill = timetobackfill - 3*24*3600
    
elif timetobackfill >= 2:

    if DEBUG == 1:
        sys.stdout.write("2 ")
    b_earliest = int(latest)
    if timetobackfill < 3*24*3600:

        if DEBUG == 1:
          sys.stdout.write(" - a")
        b_latest = int(now)
        newtimetobackfill = 1
    else:

        if DEBUG == 1:
          sys.stdout.write(" - b")
        b_latest = int(latest) + 3*24*3600
        newtimetobackfill = timetobackfill - 3*24*3600


elif timeago > 1:

    if DEBUG == 1:
        sys.stdout.write("3 ")
    b_earliest = int(latest)
    if timeago < 3*24*3600:

        if DEBUG == 1:
          sys.stdout.write(" - a")
        b_latest = int(now)
    else:

        if DEBUG == 1:
          sys.stdout.write(" - b")
        b_latest = int(latest) + 3*24*3600

else:
    sys.stdout.write("[" + str(datetime.now()) + " - id=" + RunningID + "] Something went dramatically wrong here... (timeago not defined when latest is)")
    sys.stdout.flush()
    exit()
sys.stdout.write("\n")
if DEBUG == 1:
       
        sys.stdout.write("[" + str(datetime.now()) + " - id=" + RunningID + "] Just ran query: \n" + searchquery_normal + "\n")
        sys.stdout.write("[" + str(datetime.now()) + " - id=" + RunningID + "] We are running our search over " + str(b_earliest) + " to " + str(b_latest) + ". Also:\nbackfill: " + str(shouldbackfill) + "\nlatest: " + str(latest) + "\ntimeago: " + str(timeago) + "\nnow: " + str(now) + "\nnewtimetobackfill:" + str(newtimetobackfill) + "\n")
        sys.stdout.flush()


searchquery_normal = '| rest "/servicesNS/admin/-/search/jobs"| search dispatchState="RUNNING" OR dispatchState="FINALIZING" OR dispatchState="QUEUED" OR dispatchState="PARSING" title!="| rest*" title="*FillEvents*" '
job = service.jobs.create(searchquery_normal, **kwargs_normalsearch)

while True:
    job.refresh()
    stats = {"isDone": job["isDone"],
             "doneProgress": float(job["doneProgress"])*100}
    if stats["isDone"] == "1":
        break

    time.sleep(1)


countjobs = 0
for result in results.ResultsReader(job.results()):
    countjobs += 1

if countjobs > 0:
    sys.stdout.write("[" + str(datetime.now()) + " - id=" + RunningID + "] Jobs already running.. canceling\n")
    sys.stdout.flush()
    exit()
if DEBUG == 1:
        sys.stdout.write("[" + str(datetime.now()) + " - id=" + RunningID + "] Just ran query: \n" + searchquery_normal + "\n")



UpdateMacroSearchString = ""

if newtimetobackfill != -1:
    UpdateMacroSearchString = '| stats count | map search="| stats count | eval count=$count$ | where count > 0  | updatemacro macroname=\\"backfill_events_internal\\" macrovalue=\\"' + str(newtimetobackfill) + '\\"" '

else:
    sys.stdout.write("[" + str(datetime.now()) + " - id=" + RunningID + "] No Backfill Macro Update Required\n")
    sys.stdout.flush()

kwargs_normalsearch = {"exec_mode": "normal", "app": "search_activity", "earliest_time": b_earliest, "latest_time": b_latest}

searchquery_normal = 'search `FillEvents_Search` `FillEvents_TSCollect` ' + UpdateMacroSearchString
job = service.jobs.create(searchquery_normal, **kwargs_normalsearch)

if DEBUG == 1:
        sys.stdout.write("[" + str(datetime.now()) + " - id=" + RunningID + "] Just ran query: \n" + searchquery_normal + "\n")
