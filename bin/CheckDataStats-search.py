#!/usr/bin/python

import splunklib.results as results
import splunklib.client as client
import time
import sys
from datetime import datetime

sessionKey = ""

for line in sys.stdin:
  sessionKey = line

MostRecentTime = 600
DaysPerBackfillJob = 3
DEBUG = 1
queuecount = 0
queuethreshold = 10

service = client.Service(token=sessionKey, host="127.0.0.1", port=8089, user="admin")

kwargs_normalsearch = {"exec_mode": "normal", "app": "search_activity"}

searchquery_normal = '| rest "/servicesNS/admin/-/search/jobs"| search dispatchState="RUNNING" OR dispatchState="FINALIZING" title!="| rest*" title="*FillSearchHistory*" '
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
    sys.stdout.write("[" + str(datetime.now()) + "] Jobs already running.. canceling\n")
    sys.stdout.flush()
    exit()
if DEBUG == 1:
        sys.stdout.write("[" + str(datetime.now()) + "] Just ran query (searchid=\"" + job.name + "\"): \n" + searchquery_normal + "\n")

searchquery_normal = '| rest "/servicesNS/admin/search_activity/properties/macros/backfill_search_window/definition"'
job = service.jobs.create(searchquery_normal, **kwargs_normalsearch)

while True:
    job.refresh()
    stats = {"isDone": job["isDone"],
             "doneProgress": float(job["doneProgress"])*100}

    if stats["isDone"] == "1":
        break
    time.sleep(2)

if DEBUG == 1:
        sys.stdout.write("[" + str(datetime.now()) + "] Just ran query (searchid=\"" + job.name + "\"): \n" + searchquery_normal + "\n")

timetobackfill = -1
for result in results.ResultsReader(job.results()):
    timetobackfill = int(result['value'])
    if DEBUG == 1:
        sys.stdout.write("[" + str(datetime.now()) + "] Got a timetobackfill of " + str(timetobackfill) + "\n")
        sys.stdout.flush()

if timetobackfill == -1 or timetobackfill == "" or timetobackfill is None:
    sys.stdout.write("[" + str(datetime.now()) + "] backfill_search_window macro not configured. No visibility into whether we want to backfill or not, so quiting. Please visit setup page to configure.\n")
    sys.stdout.flush()
    exit()

searchquery_normal = '| rest "/servicesNS/admin/search_activity/properties/macros/backfill_search_internal/definition"'
job = service.jobs.create(searchquery_normal, **kwargs_normalsearch)

while True:
    job.refresh()
    stats = {"isDone": job["isDone"],
             "doneProgress": float(job["doneProgress"])*100}

    if stats["isDone"] == "1":
        break
    time.sleep(2)

if DEBUG == 1:
        sys.stdout.write("[" + str(datetime.now()) + "] Just ran query (searchid=\"" + job.name + "\"): \n" + searchquery_normal + "\n")

inttimetobackfill = -1
for result in results.ResultsReader(job.results()):
    inttimetobackfill = int(result['value'])
    if DEBUG == 1:
        sys.stdout.write("[" + str(datetime.now()) + "] Got a inttimetobackfill of " + str(inttimetobackfill) + "\n")
        sys.stdout.flush()
if inttimetobackfill == 0:
    sys.stdout.write("[" + str(datetime.now()) + "] Seems we are up to date.. using our internal backfill window of 0\n")
    timetobackfill = inttimetobackfill
if inttimetobackfill == -1 or inttimetobackfill == "" or inttimetobackfill is None:
    sys.stdout.write("[" + str(datetime.now()) + "] Got no internal backfill time.. using the configured timetobackfill (" + str(timetobackfill) + ")\n")
else:
    sys.stdout.write("[" + str(datetime.now()) + "] Got an internal backfill time of " + str(inttimetobackfill) + ". Ignoring the default configured timetobackfill (" + str(timetobackfill) + ")\n")
    timetobackfill = inttimetobackfill

searchquery_normal = "| tstats local=t max(_time) as max max(finaltime) as maxfinaltime from `SA_SearchHistory` | eval maxfinaltime=round(coalesce(maxfinaltime, max)-0.5,0) | eval now=now() | eval timeago = now-max"
job = service.jobs.create(searchquery_normal, **kwargs_normalsearch)

while True:
    job.refresh()
    stats = {"isDone": job["isDone"],
             "doneProgress": float(job["doneProgress"])*100}

    if stats["isDone"] == "1":
        break
    time.sleep(2)

if DEBUG == 1:
        sys.stdout.write("[" + str(datetime.now()) + "] Just ran query (searchid=\"" + job.name + "\"): \n" + searchquery_normal + "\n" )

shouldbackfill = 1
latest = -1
timeago = -1
now = -1

newtimetobackfill = -1
actualearliest = -1
b_earliest = -1
b_latest = -1
maxfinaltime = -1

if job.dispatchState != "FAILED": #No TSIDX yet..
    for result in results.ResultsReader(job.results()):
        latest = int(result['max'])
        timeago = int(result['timeago'])
        now = int(result['now'])
        maxfinaltime = int(result['maxfinaltime'])


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
        sys.stdout.write("[" + str(datetime.now()) + "] Entering time management logic: ")

##### There's no data in the sytem yet (i.e., our first search)
if latest == -1: 
    if DEBUG == 1:
        sys.stdout.write(" 1 ")
    actualearliest = now - timetobackfill  
    b_earliest = now - timetobackfill - 24*3600 # Make our earliest = now - our current backfill position - 1 day (covering searches up to 24 hours.)
    if timetobackfill < DaysPerBackfillJob*24*3600: # We are not going to backfill data
        if DEBUG == 1:
          sys.stdout.write("  - a")
        b_latest = now - MostRecentTime
        newtimetobackfill = 1
    else: #We are going to backfill

        if DEBUG == 1:
          sys.stdout.write("  - b")
        b_latest = now - timetobackfill + DaysPerBackfillJob*24*3600 #Make our latest =  now - our current backfill position + 3 days (effectively, four days of data)
        newtimetobackfill = timetobackfill - DaysPerBackfillJob*24*3600 #Reduce time to backfill by 3 days

##### We do have data in the TSIDX, but we still have some backfilling to do. 
elif timetobackfill >= 2:

    if DEBUG == 1:
        sys.stdout.write(" 2 ")

    actualearliest = now - timetobackfill 
    #b_earliest = int(latest) - 24*3600 # Make our earliest = the latest point we have data... this is logicially incorrect. 
    b_earliest = now - timetobackfill - 24*3600 # Make our earliest = now - our current backfill position - 1 day (covering searches up to 24 hours.)

    if timetobackfill < DaysPerBackfillJob*24*3600: # We are not going to backfill

        if DEBUG == 1:
          sys.stdout.write("  - a")
        b_latest = int(now)-MostRecentTime
        newtimetobackfill = 1
    else:

        if DEBUG == 1:
          sys.stdout.write("  - b")
        #b_latest = int(latest) + 3*24*3600 #Set our latest to the latest point we have data... this is logically incorrect for a backfill scenario. 
        b_latest = now - timetobackfill + DaysPerBackfillJob*24*3600 #Make our latest =  now - our current backfill position + 3 days (effectively, four days of data)
        newtimetobackfill = timetobackfill - DaysPerBackfillJob*24*3600

###### We do have data in the TSIDX, we have no backfilling to do, and there's been at least two seconds between now and the most recent data point in our TSIDX
###### Effectively, this is going to backfill up to 3 days from the last point that we have data. If there's a gap of more than 3 days, that will need to be manually bridged.
elif timeago > 1:

    if DEBUG == 1:
        sys.stdout.write(" 3 ")
    actualearliest = int(maxfinaltime)
    b_earliest = int(latest) - 24*3600
    if timeago < DaysPerBackfillJob*24*3600:

        if DEBUG == 1:
          sys.stdout.write("  - a")
        b_latest = int(now)-MostRecentTime
    else:

        if DEBUG == 1:
          sys.stdout.write("  - b")
        b_latest = int(latest) + DaysPerBackfillJob*24*3600

else:
    sys.stdout.write("[" + str(datetime.now()) + "] Something went dramatically wrong here... (timeago not defined when latest is)\n")
    sys.stdout.flush()
    exit()

sys.stdout.write("\n")
sys.stdout.flush()

if DEBUG == 1:
        sys.stdout.write("[" + str(datetime.now()) + "] Just ran query (searchid=\"" + job.name + "\"): \n" + searchquery_normal + "\n")
        sys.stdout.write("[" + str(datetime.now()) + "] We are running our search over " + str(b_earliest) + " to " + str(b_latest) + ". Also:\nbackfill: " + str(shouldbackfill) + "\nlatest: " + str(actualearliest) + "\nactualearliest: "  + str(b_earliest) + "\nb_earliest: " + str(b_latest) + "\nb_latest: " + str(latest) + "\ntimeago: " + str(timeago) + "\nnow: " + str(now) + "\nnewtimetobackfill:" + str(newtimetobackfill) + "\n")
        sys.stdout.flush()


UpdateMacroSearchString = ""

if newtimetobackfill != -1:
    UpdateMacroSearchString = '| stats count | map search="| stats count | eval count=$count$ | where count > 0  | updatemacro macroname=\\"backfill_search_internal\\" macrovalue=\\"' + str(newtimetobackfill) + '\\"" '

else:
    sys.stdout.write("[" + str(datetime.now()) + "] No Backfill Macro Update Required\n")
    sys.stdout.flush()

kwargs_normalsearch = {"exec_mode": "normal", "app": "search_activity", "earliest_time": b_earliest, "latest_time": b_latest}

# [search earliest=-30min index=external_internal info=failed OR info=completed OR info=canceled "total_run_time" total_run_time>=0| table search_id ]
searchquery_normal = ""
if (now - actualearliest) > 3600*24:
    searchquery_normal = 'search `FillSearchHistory_Search` | where finaltime >= ' + str(actualearliest) + ' | search NOT [| tstats local=t count from `SA_SearchHistory` where finaltime = ' + str(actualearliest) + '* groupby searchid | eval search="(searchid=" . mvjoin(searchid, " OR searchid=") . ")"| stats values(search) as search | eval search= "(" . mvjoin(search, " OR ") . ")"] `FillSearchHistory_TSCollect` ' + UpdateMacroSearchString
else:
    searchquery_normal = 'search [search earliest=' + str(actualearliest) + ' `auditindex` `auditsourcetype` info=failed OR info=completed OR info=canceled "total_run_time" total_run_time>=0 | stats values(searchid) as search | eval search="(searchid=" . mvjoin(search, " OR searchid=") . ")" ] `FillSearchHistory_Search` | where finaltime >= ' + str(actualearliest) + ' | search NOT [| tstats local=t count from `SA_SearchHistory` where finaltime = ' + str(actualearliest) + '* groupby searchid | eval search="(searchid=" . mvjoin(searchid, " OR searchid=") . ")"| stats values(search) as search | eval search="(" . mvjoin(search, " OR ") . ")"] `FillSearchHistory_TSCollect` ' + UpdateMacroSearchString

job = service.jobs.create(searchquery_normal, **kwargs_normalsearch)

if DEBUG == 1:
        sys.stdout.write("[" + str(datetime.now()) + "] Just ran query (searchid=\"" + job.name + "\"): \n" + searchquery_normal + "\n")


