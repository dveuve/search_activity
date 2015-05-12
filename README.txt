
Search Activity Help: Overview

Overview

The primary goal of this app is to provide visibility into the adoption of Splunk within an organzation. 

************************

Help Contents

Help Home
Installation
Feature List
Schema

If you run into any issues, please don't hesitate to go to Splunk Answers and search for your issue, or ask a new question. Make sure to tag Search Activity, and you should get a fast response.

************************

Search Activity Help: Feature List

The Search Activity App (SA) was written to help Splunk champions understand and grow Splunk usage within their organizations, in addition to better understanding the activities and personas of their users. There are three primary areas of functionality:

*Essential Metrics

This includes the Search Overview dashboard, the Per-User dashboard, and the Per-Search dashboard. Together, these allow you to view the top users in the environment, and understand some of how they use the system.

Questions you can answer here include “what users are chewing up searches?” “Who is running realtime searches today?” “How complex is this user’s grasp of the search language?” “How many errors do they receive?” “How long does it take them to run a search, and over what timeframe?” “Who is exporting or sharing search results?”

The Find Users dashboard also allows you to group particular sets of users based on search metrics or LDAP metrics. This is useful if you want to invite your local users to a SplunkLive event! The Find Searches dashboard allow you to find problematic searches or searches that meet a particular characteristic.

*Organizational Information

The centerpiece of this section is the hierarchy view, which will take your LDAP information and then overlay statistics, so that you can understand who uses Splunk within the organization, who faces slow search time, and more.

In addition to the hierarchy, the usage by leader allows you to understand the search behavior of particular departments (implicitly) or under a particular leader, allowing you to describe Splunk’s value to those leaders. 

*Adoption Information

The Organizational Adoption dashboard shows metrics relating to how people within the organization are using Splunk.

By tagging users, you can group and track cohorts of users. This is great for understanding the usage of recently onboarded or trained users. You might also tag VIPs to keep a special eye on them.

A common question is: “How is this different from Splunk on Splunk (SOS)?” SOS is a fantastic app that you should have installed and SA doesn’t try to rival its power for monitoring and troubleshooting. While there are a few areas of overlap (and a few reports borrowed), SA isn’t primarily a troubleshooting app.

Overall, it is the goal of this app to improve the ease of tracking consumption, and increasing adoption of Splunk. Please put any questions / suggestions on Splunk Answers. 

Overall thank you to everyone involved in the creation of SA, and those who contributed to base understanding, including the VMware App Team (and their amazing hierarchy), the SOS team, the NorCal Majors SE team, Splunk Answers, and everyone who ever answered a python question on Google.

************************

Search Activity Help: Installation

Help Contents

Help Home

Installation

Feature List

Schema

***Requirements

** There are a few qualifications for where you should install the app:

** Do not install on a Search Head Cluster. This app leverages local TSIDX that are not supported under clustering.

** Be cautious installing on a user search head. This app creates a TSIDX with audit data -- it is not possible to apply permissions to a TSIDX file (a great new feature with data models!), so a user who realizes that it is there could pull audit data. This is probably not terribly likely as it wouldn't be obvious if you apply the required app configuration permissions, but that is only security by obscurity. Security / Privacy conscious environments should isolate the app on an admin search head and/or use audit rules to check for users search the namespace in tstats. Additionally, 2.0 is the first public release, and there may be issues.

** Install on a search head with 1-15 GB of disk space available. Most small environments will happily fit into 1 GB of disk space for several months. Larger environments (typically with hundreds of users and tens of thousands of searches per day) will consume upwards of 1-2 GB disk space per month stored in TSIDX files. The largest environment tested (150,000+ searches per day, approximately 50 GB of audit data per month) consumes approximately 2.5 GB disk space for one month of data. This disk space is used on the search head and not on the indexers.

** Currently tested on Splunk 6.2. Should be backwards compatible to Splunk 6.1 without issue, and Splunk 6.0 (except two multi-select panels for search types).

***Installing      

Installing the Search Activity App is more complex than the typical app, but you will be guided by a setup wizard. There are four sections to set up in the app:
-LDAP
-LDAP Management
-App Configuration
-Datastore / Backfill

*LDAP

While not required, it is highly recommended that you leverage LDAP to enrich the data in the app for Search Activity. Much of the most interesting functionality, in particular the Org Chart tree view is predicated on LDAP information. Fortunatley, getting LDAP information into Splunk is easy! You have three options for configuring this section:

SA-ldapsearch Lookup: This is usually the best option. Splunk has a search addon (called either SA-ldapsearch or Splunk Support for Active Directory) for directly querying LDAP, which is widely used and fully supported. Find it here. You install the app, and follow the configuration settings listed in the docs (here). Once configured, you can enable the scheduled search to periodically poll LDAP and update LDAPSearch.csv (linked to from the setup page).

Existing LDAP Lookup: This option presumes that you have an existing LDAP dump created by the method described in the previous option. This should be a CSV stored at $SPLUNK_HOME/etc/apps/search_activity/lookups/LDAPSearch.csv. This method makes the most sense if your production Splunk environment doesn't have the right version of Java for SA-ldapsearch or if you have a policy that prevents you from storing base64 encoded (or just plain text) credentials for an LDAP user on the Splunk server, as required by SA-ldapsearch. This is also the most QA'd option as that is how the development and staging environments are configured. 

No LDAP: If you have no desire to integrate with LDAP, select this option. You can always come back and change it -- all LDAP components are run at search time. Note: you must select No LDAP if you don't wish to use LDAP. Leaving this section unconfigured will prevent you from using the app.

*LDAP Management

This piece is very straightforward. If you elect to use LDAP (as you should), you must ensure that the scheduled search creating the LDAPMgmtChain is enabled. This section will also check to ensure that LDAPSearch.csv is populated.

*App Configuration

There are three sections to this page, though one is optional.

Field Extractions: This is a check that should always succeed, verifying that we see data where we expect to. If this fails, check the sourcetype of your audit data, and make sure that fields such as actualsearch are configured.

App Permissions: Because this app shows sensitive data, it is required to restrict access to administrators. A link is provided to configure this -- any non-default configuration will pass, so if you do want to open to all users, you can just select all the individual groups. You can always also override the SA_Config_System macro to "configured" but note that this will reset each time you visit the setup page.

Admin Email Address: This app contains beta functionality to email users, welcoming them to the system. Configuring an admin email address will cause admins to be CC'd, allowing them to easily see new users in addition to users seeing a point of contact.

*Datastore / Backfill

Finally, with all of the above configured, you must make sure data flows into the app. There are two scripted inputs (CheckDataStats-search.py and CheckDataStats-events.py) that leverage the admin credentials (via passAuth) to run the tscollect process. These scripts also handle backfill of data into the accelerated data store (TSIDX). To configure the app initially, you can select the time period that you would like to backfill (e.g., one month, six months, one year, etc.) and then click both the Set Search History Backfill and Set Events Backfill buttons. If you wish to have no backfill (not generally recommended) you can select No Backfill.

Once configured, the scripted input should start running within ten minutes, and you will see jobs kicked off in the job activity tracker for the admin user. Note that backfill searches can take a long time to run, depending on the environment, and can use several GB of disk space. You may want to reduce the number of days that will be backfilled at a time by modifying the appropriate parameter at the top of the CheckDataStats-search.py file. (There is more logic in the search backfill -- the events backfill should not experience long run times or other related issues.)

If you have renamed the admin user account please either update the default/inputs.conf to specify a different user, or better yet copy the default/inputs.conf to local/inputs.conf and modify just the passAuth line there with an admin username.

*Summary

Once you have gotten either Green Checkmarks or Yellow Warnings for all the parameters in the setup page, the SA_Config_System macro will be set to "configured" and you should start seeing data in the main page as backfill is completed. If you experience any issues, please don't hesitate to go to Splunk Answers and search for your issue, or ask a new question. Make sure to tag Search Activity, and you should get a fast response.

************************

Schema

For anyone interested in developing on top of this app, creating your own views, etc., you will find two tsidx namespaces generated 
via the tscollect command. The parameters available in these namespaces are as follows:

search_activity.searchhistory - This source of data is fed entirely by the audit.log held normally in index=_audit sourcetype=audittrail
  -_time - float - The earliest time found.
	-NumExports - int - The number of times a search was exported (by any user -- careful)
	-WasShared - "yes"/"no" - Were there hits to the acl rest endpoint and the control rest endpoint, characteristic of sharing a search?
	-searchspan - latest minus earliest:
	-searchspan_s - int - seconds
	-searchspan_m - 1-precision - minutes
	-searchspan_h - 1-precision - hours
	-searchspan_d - 1-precision - days
	-total_run_time - int - How long did the search run for?
	-result_count - int - How many results were there?
	-scan_count - int - How many results were scanned? (Placeholder for a thorough Splunk answers or blog post, upon demand)
	-event_count - int - How many results were brought back off disk?
	-Accuracy - float - round((event_count / scan_count) * 100,2). 
	-searchtype - "adhoc"/"adhoc (subsearch)"/"dashboard"/"dashboard (subsearch)"/"summarization"/"summarization (subsearch)"/"scheduled"/"subsearch (subsearch)"/"realtime" - Type of search (calculated by searchtype eval field in props)
	-search_status - "failed"/"completed"/"cancelled"/? - The result of the search. Technically: values(eval(if(info="granted",null,info)))
	-savedsearch_name - string - The name of the saved search, if defined
	-searchcommands - string - Effectively values(eval(commands(actualsearch))). This is a list of all the commands used in a search (though tscollect doesn't support notating if someone uses eventstats four times in a search, much to my chagrin. At least not without more work.)
	-user - string - Username (= sAMAccountName for AD people)
	-exec_time - int - The exec_time of the search (from the log)
	-earliest - float - The earliest_time of the search.
	-latest - float - The latest_time of the search.
	-actualsearch - string - The full search string.
	-Accuracy - float - The ratio of event_count / result_count, represented as a percentage (i.e., n * 100)
	-search_et_diff - int - The difference between exec_time and the earliest_time (effectively, going back to -15min or -30d)
	-search_lt_diff - int - The difference between exec_time and the latest_time (effectively, starting now or -7d)
	-MVSearchCommands - string - A pipe separated list of the search commands for this search. (When using tscollect, 10 multi-valued rex commands become one.) Created with mvjoin(searchcomands, "|"), so feel free to use | makemv MVSearchCommands delim="|". 
	-WasShared - string - "yes" or "no" indicates whether the ACL endpoint was hit for the search string in the 10-20 minutes after the search completed.
	-WasExported - string - "yes" or "no" indicates whether the export endpoint was hit for the search string in the 10-20 minutes after the search completed. This is a pretty bad metric, and will be improved moving forward.
	-search_et_diff - int - earliest_time - earliest.
	-search_lt_diff - int - earliest_time - latest.
	-time_bucket - string - a case statement that puts search_et_diff into different time buckets.
	-ShouldInvestigate - int - Are there any telltale signs that this search should be inspected? Defined by the macro `ShouldInvestigate`.
	-SearchHead - string - The search head where the search was run.

search_activity.events - This source of data is held mostly in index=_internal, with the logon history pulled from index=_audit
  -_time - float - The time of each event.
	-date_hour - string - The hour of the day of each event (for convenience).
	-type - string - The type of the log. Options are: weblog, manager, scheduler, search_concurrency, login.
	-uri_path - string - The URL browsed to for weblogs.
	-myapp - string - For weblogs, the app.
	-myview - string - For weblogs, the view.
	-result - string - For login events, the result.
	-user - string - The username of the event.
	-active_hist_searches - int - How many historical searches are active at one time (from the search concurrency logs).
	-active_realtime_searches - int - How many realtime searches are active at one time (from the search concurrency logs).
	-status - string - The status of a scheduled search.
	-savedsearch_name - string - The name of a scheduled search.
	-mysearch - string - The search string for a scheduled search.
	-exported - string - "export" if this event indicates that the search was exported.
	-searchid - string - The search ID where appropriate.
	-myaction 
	-result_count - int - The number of results in a search.
	-alert_actions - string - The alert ations of a scheduled search.
	-result_count - string - How many results came from a scheduled search.
	-SearchHead - string - The search head that generated the log.
	-actualsearch - string - The search string for audit logs (included in both TSIDX to ease the correlation.. may be more efficient in the future to leverage a lookup that will pull them up).

For those interested, there are two primary reasons for utilizing tscollect rather than the generally
preferable data model acceleration. The first reason is that in the case of the searchhistory report, I wanted to consolidate many 
logs together and provide one entry per search. Without a preliminary stats, there would be several different logs related to 
each event, confusing the ability to do counts accurately (would require dc(searchid) instead of count, which isn't intuitive).
The second, smaller reason, is that the initial customers did not want to impact their environment with distributed tsidx files,
normally a major benefit, except that it would trigger change control requirements. tscollect allows the data to stay local on
a admin or dev search head. This works fairly well in this scenario, given the small size of the tsidx namespace for this app.

