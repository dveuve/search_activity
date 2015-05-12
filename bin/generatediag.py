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
inputs['mgmtport'] = -1
inputs['debug'] = 0

MGMTPORT = -1

d = dict()
for s in sys.argv:
	
	if "=" in s: 
		
		(a,b) = s.split("=")
		if a in inputs:
			if a == 'mgmtport':
				MGMTPORT = int(b)

			elif b == "false" or b=='"false"' or b == "0":
				inputs[a] = 0
				
			elif b == "true" or b == '"true"' or b == "1" :
				
				inputs[a] = 1
				
			else:
				raise Exception("Error! Invalid value (" + b + "=" + a + ") - valid options are true or false")
		else: 
			raise Exception("Error! Invalid parameter: " + a)


if MGMTPORT == -1:
	raise Exception("Management Port not provided. Please add mgmtport=8089 (or whatever your splunkd port is set to) to the search string")

settings = saUtils.getSettings(sys.stdin)
print json.dumps(settings).replace(",", "")
sessionKey = settings['sessionKey']

HOST = "127.0.0.1"
USERNAME = settings['owner']

service = client.Service(token=sessionKey, host=HOST, port=MGMTPORT, username=USERNAME) 

values = {}




# Create a Service instance and log in 
#service = client.connect(host=HOST, port=PORT, app="search_activity", username=USERNAME, password=PASSWORD)


jobs = service.jobs

# Run a blocking search--search everything, return 1st 100 events
kwargs_blockingsearch_alltime = {"exec_mode": "blocking", "app": "search_activity", "namespace": "search_activity", "earliest_time": "0", "latest_time": "now"}

kwargs_blockingsearch_30days = {"exec_mode": "blocking", "app": "search_activity", "namespace": "search_activity", "earliest_time": "-30d", "latest_time": "now"}


#### MY Queries
#System Information
SearchSystemInfo = '| rest "/services/server/settings" | append [|rest "/services/server/info"] | append [| rest "/services/apps/local" | search details="*apps.splunk.com*" | eval app=if(isnull(label),"",label) . ";|;" . if(isnull(version),"",version) . ";|;" . if(isnull(build),"",build) . ";|;" . if(isnull(check_for_updates),"",check_for_updates) . ";|;" . if(isnull(configured),"",configured) . ";|;" . if(isnull(disabled),"",disabled) | stats values(app) as app| eval app=mvjoin(app, "-|-") ]| stats values(activeLicenseGroup) as activeLicenseGroup values(SPLUNK_HOME) as SPLUNK_HOME values(app) as apps_installed values(build) as build values(cpu_arch) as cpu_arch values(guid) as guid values(master_guid) as master_guid values(version) as version values(product_type) as product_type | eval masterkey = sha512(master_guid) | eval installkey = sha512(guid) | fields - master_guid guid'

#TSIDX Data Size
SearchTSIDXSize = '| rest "/services/server/settings" | map search="|listsanamespaces SPLUNK_HOME=\\"$SPLUNK_HOME$\\"" | eval "Size (MB)" = size/1024/1024 | fields namespace "Size (MB)"'

#TSIDX Event Count
SearchTSIDXCount = '| tstats local=t count as SHCount from `SA_SearchHistory` groupby _time span=1d | append [| tstats local=t count as ECount from `SA_Events` groupby _time span=1d] | stats sum(*) as * by _time | fillnull value=0'

#Macro Configuration
SearchMacro = '| rest "/servicesNS/-/search_activity/properties/macros" | rex field=id "(?<trimmedpath>\/servicesNS.*)"| map maxsearches=50   search="| rest \\"$trimmedpath$/definition\\" | eval title=\\"$title$\\"" | eval value=if(title="AdminEmailAddress" OR title="SA-LDAPSearch-Domain",replace(value, "^(.{5}).*", "\1[...]"),value)'

#Status of Inputs
SearchInputStatus = '| rest "/servicesNS/-/search_activity/properties/inputs"| rex field=id "(?<trimmedpath>\/servicesNS.*)"| map maxsearches=50   search="| rest \\"$trimmedpath$/disabled\\" | rename value as disabled | append [| rest \\"$trimmedpath$/interval\\"] | rename value as interval | append [| rest \\"$trimmedpath$/passAuth\\"] | rename value as passAuth | eval title=\\"$title$\\"" | stats values(*) as * by title'

#Logs of Inputs
SearchInputLogs = '| rest "/servicesNS/-/search_activity/properties/inputs"| rex field=id "(?<trimmedpath>\/servicesNS.*)"| map maxsearches=50   search="| rest \\"$trimmedpath$/sourcetype\\" | eval title=\\"$title$\\"" | map search="search index=* source=SA-*-ParseData sourcetype=$value$ "'

#User Activity
SearchSAUserActivity = '| tstats count from `SA_Events` where myapp="search_activity" groupby myapp myview user _time span=1s  | sort user | streamstats count as UserUnique by user | eval UserUnique=if(UserUnique>1,null,1) | streamstats sum(eval(if(UserUnique>0,UserUnique,null)))  as UserUnique | fields - user'

#Anonymous User Activity
SearchAnonyActivity = '|stats count as bogus    | append [| tstats local=t  count sum(total_run_time) as total_run_time sum(NumExports) as NumExports from `SA_SearchHistory`  where * (SearchHead=*) * * groupby _time user searchtype span=1d | stats sum(count) as NumSearches sum(eval(if(searchtype="adhoc",count,0))) as NumAdHocSearches sparkline(sum(count)) as UsageTrend sum(total_run_time) as HoursOfSearchTime sum(eval(if(searchtype="adhoc",total_run_time,0))) as HoursOfAdHocSearchTime sum(NumExports) as NumberOfExports by user| where user!="splunk-system-user" | eval HoursOfSearchTime = round(HoursOfSearchTime/3600,2) | eval HoursOfAdHocSearchTime = round(HoursOfAdHocSearchTime/3600,2) | sort - count ]        | append [| tstats prestats=t local=t count from `SA_SearchHistory`  where * (SearchHead=*) * * searchtype=adhoc groupby searchcommands , user| stats count by searchcommands, user| eval maturity=`eval_high_complexity_search_commands` | eval maturity=`eval_med_complexity_search_commands` | eval maturity=`eval_low_complexity_search_commands`  | stats sum(eval(if(searchcommands="search",count,null))) as search_num sum(maturity) as maturity by user | eval "search_complexity_score"=if(maturity/search_num>`max_search_complexity_rating`,`max_search_complexity_rating`,1+round(maturity/search_num,0)) | fields user search_complexity_score | sort - search_complexity_score | streamstats count as complexity_order | eventstats count as NumComplexityUsers]        | append  [| tstats local=t avg(accuracy) as Accuracy from `SA_SearchHistory` where * (SearchHead=*) * *  accuracy>0 total_run_time>0 result_count>0 searchtype=adhoc groupby user| sort - Accuracy | streamstats count as accuracy_order | eventstats count as NumAccuracyUsers]       | append  [ | tstats  local=t avg(total_run_time) as runtime from `SA_SearchHistory` where * (SearchHead=*) * *   searchtype=adhoc groupby user | eval runtime=round(runtime,0) | stats avg(runtime) as runtime by user | fields user runtime | sort - runtime | streamstats count as runtime_order | eventstats count as NumRuntimeUsers]     | append [| tstats  local=t count sum(ShouldInvestigate) as ShouldInvestigate from `SA_SearchHistory` where * (SearchHead=*) * *  groupby user | sort - ShouldInvestigate | streamstats count as investigate_order | eventstats count as NumInvestigateUsers]    | append [| tstats local=t count from `SA_Events` where * (SearchHead=*) * *  type=scheduler groupby user status  	| append [| tstats local=t count  from `SA_SearchHistory` where * (SearchHead=*) * * groupby user search_status ] | stats sum(eval(if(status="skipped",count,0))) as SkippedScheduled sum(eval(if(status="success",count,0))) as SuccessfulScheduled sum(eval(if(search_status="failed",count,0))) as FailedAdHoc sum(eval(if(search_status="success",count,0))) as SuccessfulAdHoc by  user | eval PercentFailed=round(100*(SkippedScheduled+FailedAdHoc)/(SuccessfulScheduled+SuccessfulAdHoc)) | sort - PercentFailed | streamstats count as FailureOrder | eventstats max(FailureOrder) as NumUsersFailure ]    | eval "Accuracy Order" = accuracy_order . " out of " . NumAccuracyUsers     | eval "Search Complexity Order" = complexity_order . " out of " . NumComplexityUsers     | eval "Slow Search Runtime Order" = runtime_order . " out of " . NumRuntimeUsers      | eval "Search Failure Order" = FailureOrder . " out of " . NumUsersFailure  | eval "Questionable Search Order" = investigate_order . " out of " . NumInvestigateUsers   | eventstats values(*Order*) as *Order* by user  | fields user NumSearches NumAdHocSearches UsageTrend HoursOfSearchTime HoursOfAdHocSearchTime NumberOfExports "Accuracy Order" "Search Complexity Order" "Search Failure Order" "Questionable Search Order" "Slow Search Runtime Order" mail | sort - NumSearches | where NumSearches>0 | streamstats count as user'

#Volume Indexed
SearchVolumeIndexed = 'search index=_internal source=*license_usage.log "Type=RolloverSummary" | stats avg(b) as avgb | eval avgGB = round(avgb/1024/1024/1024,4)'

#Num Servers
SearchNumServers = '| metasearch index=* earliest=-15min | dedup splunk_server  | stats dc(splunk_server) as NumServers'

#Lifetime of Search
SearchLifetime = '| tstats local=t count dc(user) as user avg(result_count) as avg_result_count avg(scan_count) as avg_scan_count median(total_run_time) as median_total_run_time sum(total_run_time) as total_trt from `SA_SearchHistory` where (searchtype=adhoc* OR searchtype=scheduled* OR searchtype=summarization* OR searchtype=dashboard*) groupby time_bucket | eval "total_trt avg hrs per day"=round(total_trt/3600/30,1) | streamstats sum(total_trt) as Aggregated_Total_Run_Time | eventstats max(total_trt) as max_trt max(Aggregated_Total_Run_Time) as Max_Ag  | eval PercentageOfTotalRuntime = round(total_trt/max_trt * 100,2) | eval AggregatePercentageOfTotalRuntime = round(Aggregated_Total_Run_Time/Max_Ag * 100,2) | foreach PercentageOfTotalRuntime AggregatePercentageOfTotalRuntime [fieldformat <<FIELD>> = <<FIELD>> . "%" ]| fields - Max_Ag max_trt | fillnull avg_result_count avg_scan_count median_total_run_time total_trt PercentageOfTotalRuntime "total_trt avg hrs per day" value=0'

output = {}

sessionKey = ""
username = ""

installkey = ""
masterkey = ""

if inputs['systeminfo'] == 1:
	systeminfo = {}
	if inputs['debug'] == 1:
		print "Running System Info," + SearchSystemInfo

	try:
		job = jobs.create(SearchSystemInfo, **kwargs_blockingsearch_alltime)
		for result in results.ResultsReader(job.results()):
			installkey = result['installkey']
			masterkey = result['masterkey']
			systeminfo[installkey] = {}
			for key in result:
				systeminfo[installkey][key] = result[key]
		if inputs['debug']:
			print json.dumps(systeminfo).replace('\n', ' ').replace('\r', '').replace(',', '')
		output['systeminfo'] = base64.b64encode(json.dumps(systeminfo))

	except Exception, e:
		systeminfo['status'] = "Error Running"
		output['systeminfo'] = base64.b64encode(json.dumps(systeminfo))
		print "Error,Error Generating System Info Search"
		errorResults = splunk.Intersplunk.generateErrorResults(e)



if inputs['tsidxinfo'] == 1:
	if inputs['debug'] == 1:
		print "Running TSIDX Info," + SearchTSIDXSize

	tsidxinfo = {}
	tsidxinfo['installkey'] = installkey
	tsidxinfo['masterkey'] = masterkey

	try:
		job = jobs.create(SearchTSIDXSize, **kwargs_blockingsearch_alltime)
		for result in results.ResultsReader(job.results()):
			for key in result:
				tsidxinfo[key] = result[key]


		job = jobs.create(SearchTSIDXCount, **kwargs_blockingsearch_alltime)
		for result in results.ResultsReader(job.results()):
			for key in result:
				tsidxinfo[key] = result[key]
		if inputs['debug']:
			print json.dumps(tsidxinfo).replace('\n', ' ').replace('\r', '').replace(',', '')

		output['tsidxinfo'] =  base64.b64encode(json.dumps(tsidxinfo))

	except Exception, e:
		tsidxinfo['status'] = "Error Running"
		output['tsidxinfo'] = base64.b64encode(json.dumps(tsidxinfo))
		print "Error,Error Generating TSIDX Info Search"
		errorResults = splunk.Intersplunk.generateErrorResults(e)




if inputs['macroconfig'] == 1:
	if inputs['debug'] == 1:
		print "Running Macro Config," + SearchMacro

	macroconfig = {}
	macroconfig['installkey'] = installkey
	macroconfig['masterkey'] = masterkey

	try:
		job = jobs.create(SearchMacro, **kwargs_blockingsearch_alltime)
		for result in results.ResultsReader(job.results()):
			for key in result:
				macroconfig[result['title']] = result['value']
		if inputs['debug']:
			print json.dumps(macroconfig).replace('\n', ' ').replace('\r', '').replace(',', '')

		output['macroconfig'] = base64.b64encode(json.dumps(macroconfig))

	except Exception, e:
		macroconfig['status'] = "Error Running"
		output['macroconfig'] = base64.b64encode(json.dumps(macroconfig))
		print "Error,Error Generating Macro Config Search"
		errorResults = splunk.Intersplunk.generateErrorResults(e)
		




if inputs['scriptedinputstatus'] == 1:
	if inputs['debug'] == 1:
		print "Running scriptedinputstatus," + SearchInputStatus

	scriptedinputstatus = {}
	scriptedinputstatus['installkey'] = installkey
	scriptedinputstatus['masterkey'] = masterkey
	try:
		job = jobs.create(SearchInputStatus, **kwargs_blockingsearch_alltime)
		for result in results.ResultsReader(job.results()):
			search_groups = re.search("/([^/]*?)$", result['title'])
			shortname = search_groups.group(1)
			scriptedinputstatus[shortname] = {}
			scriptedinputstatus[shortname]['title'] = result['title']
			scriptedinputstatus[shortname]['disabled'] = result['disabled']
			scriptedinputstatus[shortname]['interval'] = result['interval']
			scriptedinputstatus[shortname]['passAuth'] = result['passAuth']
			

		if inputs['debug']:
			print json.dumps(scriptedinputstatus).replace('\n', ' ').replace('\r', '').replace(',', '')
		output['scriptedinputstatus'] = base64.b64encode(json.dumps(scriptedinputstatus))

	except Exception, e:
		scriptedinputstatus['status'] = "Error Running"
		output['scriptedinputstatus'] = base64.b64encode(json.dumps(scriptedinputstatus))
		print "Error,Error Generating populating status Search"
		errorResults = splunk.Intersplunk.generateErrorResults(e)



output['EventLogs'] = ""
output['SearchLogs'] = ""


if inputs['Logs'] == 1: 
	if inputs['debug'] == 1:
		print "Running Logs," + SearchInputLogs

	eventslogs = "installkey=" + installkey + " masterkey=" + masterkey + "\n"
	searchlogs = "installkey=" + installkey + " masterkey=" + masterkey + "\n"

	try:
		job = jobs.create(SearchInputLogs, **kwargs_blockingsearch_alltime)
		for result in results.ResultsReader(job.results()):
			if result['source'] == "SA-SearchHistory-ParseData":
				searchlogs += result['_raw'] + "\n"
			if result['source'] == "SA-Events-ParseData":
				eventslogs += result['_raw'] + "\n"

		output['EventLogs'] = base64.b64encode(eventslogs) 
		output['SearchLogs'] = base64.b64encode(searchlogs)

		if inputs['debug']:
			print "Length of eventlogs: " + str(len(eventslogs))
			print "Length of searchlogs: " + str(len(searchlogs))
	except Exception, e:
		output['EventLogs'] = base64.b64encode("Error Running\n\n" + output['EventLogs'])
		output['SearchLogs'] = base64.b64encode("Error Running\n\n" + output['SearchLogs'])
		print "Error,Error Generating Populating Log Search"
		errorResults = splunk.Intersplunk.generateErrorResults(e)





if inputs['SAActivity'] == 1:
	if inputs['debug'] == 1:
		print "Running SAActivity," + SearchSAUserActivity
	sauser = "installkey=" + installkey + " masterkey=" + masterkey + "\n"
	try:
		job = jobs.create(SearchSAUserActivity, **kwargs_blockingsearch_alltime)
		for result in results.ResultsReader(job.results()):
			sauser += result['_time'] + " UniqueUser=" + result['UserUnique'] + " myapp=" + result['myapp'] + " myview=" + result['myview'] + " count=" + result['count']

		if inputs['debug']:
			print "Length of eventlogs: " + str(len(sauser))
		output['SAActivity'] = base64.b64encode(sauser)

	except Exception, e:
		output['SAActivity'] = base64.b64encode("Error Running\n\n" + sauser)
		print "Error,Error Generating Search Activity Log Search"
		errorResults = splunk.Intersplunk.generateErrorResults(e)




if inputs['anonactivity'] == 1:
	if inputs['debug'] == 1:
		print "Running Anonymous Activity," + SearchAnonyActivity

	anonactivity = {}
	anonactivity['installkey'] = installkey
	anonactivity['masterkey'] = masterkey
	try:
		job = jobs.create(SearchAnonyActivity, **kwargs_blockingsearch_30days)
		for result in results.ResultsReader(job.results()):
			anonactivity[result['user']] = {}
			for key in result:
				if key != "user":
					anonactivity[result['user']][key] = result[key]
				
		if inputs['debug']:
			print json.dumps(anonactivity).replace('\n', ' ').replace('\r', '').replace(',', '')
		output['anonactivity'] = base64.b64encode(json.dumps(anonactivity))

	except Exception, e:
		anonactivity['status'] = "Error Running"
		output['anonactivity'] = base64.b64encode(json.dumps(anonactivity))
		print "Error,Error Generating Anon Activity Search"
		errorResults = splunk.Intersplunk.generateErrorResults(e)



if inputs['volume'] == 1:
	if inputs['debug'] == 1:
		print "Running Volume," + SearchVolumeIndexed

	volume = {}
	volume['installkey'] = installkey
	volume['masterkey'] = masterkey
	try:
		job = jobs.create(SearchVolumeIndexed, **kwargs_blockingsearch_30days)
		for result in results.ResultsReader(job.results()):
			for key in result:
				volume[key] = result[key]
		if inputs['debug']:
			print json.dumps(volume).replace('\n', ' ').replace('\r', '').replace(',', '')		
		output['volume'] = base64.b64encode(json.dumps(volume))
	except Exception, e:
		volume['status'] = "Error Running"
		output['volume'] = base64.b64encode(json.dumps(volume))
		print "Error,Error Generating Volume Search"
		errorResults = splunk.Intersplunk.generateErrorResults(e)



if inputs['numservers'] == 1:
	if inputs['debug'] == 1:
		print "Running numservers," + SearchNumServers

	numservers = {}
	numservers['installkey'] = installkey
	numservers['masterkey'] = masterkey
	try:
		job = jobs.create(SearchNumServers, **kwargs_blockingsearch_alltime)
		for result in results.ResultsReader(job.results()):
			for key in result:
				numservers[key] = result[key]
			
		if inputs['debug']:
			print json.dumps(numservers).replace('\n', ' ').replace('\r', '').replace(',', '')
		output['numservers'] = base64.b64encode(json.dumps(numservers))

	except Exception, e:
		numservers['status'] = "Error Running"
		output['numservers'] = base64.b64encode(json.dumps(numservers))
		print "Error,Error Generating NumServers Search"
		errorResults = splunk.Intersplunk.generateErrorResults(e)




if inputs['lifetime'] == 1:
	if inputs['debug'] == 1:
		print "Running lifetime," + SearchLifetime
	orderint = 1

	lifetime = {}
	lifetime['installkey'] = installkey
	lifetime['masterkey'] = masterkey

	try:
		job = jobs.create(SearchLifetime, **kwargs_blockingsearch_30days)
		for result in results.ResultsReader(job.results()):
			
			shortname = result['time_bucket']
			lifetime[shortname] = {}
			lifetime[shortname]['order'] = orderint
			orderint += 1
			lifetime[shortname]['count'] = result['count']
			lifetime[shortname]['user'] = result['user']
			lifetime[shortname]['avg_result_count'] = result['avg_result_count']
			lifetime[shortname]['avg_scan_count'] = result['avg_scan_count']
			lifetime[shortname]['median_total_run_time'] = result['median_total_run_time']
			lifetime[shortname]['total_trt'] = result['total_trt']
			lifetime[shortname]['AggregatePercentageOfTotalRuntime'] = result['AggregatePercentageOfTotalRuntime']
			lifetime[shortname]['Aggregated_Total_Run_Time'] = result['Aggregated_Total_Run_Time']
			lifetime[shortname]['PercentageOfTotalRuntime'] = result['PercentageOfTotalRuntime']
			lifetime[shortname]['total_trt avg hrs per day'] = result['total_trt avg hrs per day']
			
			
		if inputs['debug']:
			print json.dumps(lifetime).replace('\n', ' ').replace('\r', '').replace(',', '')

		output['lifetime'] = base64.b64encode(json.dumps(lifetime))
	except Exception, e:
		lifetime['status'] = "Error Running"
		output['lifetime'] = base64.b64encode(json.dumps(lifetime))
		print "Error,Error Generating Lifetime Search"
		errorResults = splunk.Intersplunk.generateErrorResults(e)
		




print "uncompressed," + base64.b64encode(json.dumps(output))
print "compressed," + base64.b64encode(zlib.compress(json.dumps(output)))


