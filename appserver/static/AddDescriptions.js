require(['splunkjs/mvc/simplexml/ready!'], function() {
	var descriptions = new Object();
	descriptions['Top Users'] = "The above report provides you at-a-glance information about the users on your system. NumSearches and HoursOfSearchTime refer to the overall search load (count, and the total time spent processing searches, from the perspective of the search head). NumAdHocSearches and HoursOfAdHocSearches refers to the time spent on the search bar, or accessing via the API. NumberOfExports refers to how many times this user has exported search data. <br />The next set of columns shows how the user compares to others in the organization, with regard to search accuracy (events scanned versus events used), search complexity (based on the search commands used), search failure (% of searches that fail), questionable searches (% of searches that have troubling characteristics), and overall search runtime. If LDAP is integrated, their email will also be shown.";
	descriptions['Top Users Over Time'] = "This reports helps you recognize major new users coming online. (splunk-system-user is excluded, so summarization jobs and some scheduled jobs won't show up).";
	descriptions['Count by Search Type'] = "This report shows the breakdown of adhoc vs scheduled vs realtime vs summarization (data model acceleration, report acceleration) vs dashboard driven searches.";
	descriptions['Count by Search Head'] = "If you have multiple search heads, this report will show you how many searches are initiated on each one.";
	descriptions['Top Apps and Views'] = "This report will show the most popular apps in your environment, and the most popular views on those apps.";
	descriptions['Exported Search Results'] = "As the name suggests.";
	descriptions['Number of Shared Searches over Time'] = "As the name suggests.";
	descriptions['Search Performance By User'] = "High level report of the search performance for users.";
	descriptions['Search Commands Associated with Expensive Searches'] = "This report shows the search commands used most in very long searches.";
	descriptions['Average Search Timespan by User'] = "This report will show you how long ago users searched -- effectively the difference between the earliest time and the executed time.";
	descriptions['Change in User Search Settings'] = "These metrics demonstrate  change in user activity over time, such as running denser queries, running queries over longer periods of time. Running queries over different timespans will normally have a correlated increase in the results. If you see more results without a change in timespan, that would indicate a change in user behavior. IF you see a change in accuracy, that would also indicate a change in user behavior.";
	descriptions['Change in System Search Performance Metrics'] = "This set of metrics generally corresponds to changes in system behavior, though user search behavior can always have an impact. Generally if you see a dramatic change here, you should look to system performance metrics to understand more (use the DMC!). ";
	for (var i = 0; i < document.getElementsByClassName("dashboard-element").length;i++){
		if(document.getElementsByClassName("dashboard-element")[i].getElementsByClassName("panel-head").length > 0){
			var elementname = document.getElementsByClassName("dashboard-element")[i].getElementsByClassName("panel-head")[0].getElementsByTagName("h3")[0].innerHTML
			if(descriptions.hasOwnProperty(elementname)){
			//if(elementname == "Top Users"){
			//	var description = "I have a description!";
				var description = descriptions[elementname]
				var div = document.createElement("div");
				div.className="panel-body"
				div.innerHTML = "<p>" + description + "</p>"
				document.getElementsByClassName("dashboard-element")[i].parentNode.appendChild(div);
				//document.getElementsByClassName("dashboard-element")[i].getElementsByClassName("panel-body")[0].appendChild(div);
			}
		}
	}
})
