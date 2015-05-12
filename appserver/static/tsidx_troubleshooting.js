require([
	"splunkjs/mvc",
	"splunkjs/mvc/utils",
	"splunkjs/mvc/tokenutils",
	"underscore",
	"jquery",
	"splunkjs/mvc/simplexml",
	"splunkjs/mvc/headerview",
	"splunkjs/mvc/footerview",
	"splunkjs/mvc/simpleform/input/dropdown",
	"splunkjs/mvc/simpleform/input/timerange",
	"splunkjs/mvc/simpleform/input/submit",
	"splunkjs/mvc/searchmanager",
	"splunkjs/mvc/postprocessmanager",
	"splunkjs/mvc/simplexml/urltokenmodel"
	],
	function(
		mvc,
		utils,
		TokenUtils,
		_,
		$,
		DashboardController,
		HeaderView,
		FooterView,
		DropdownInput,
		TimeRangeInput,
		SubmitButton,
		SearchManager,
		PostProcessManager,
		UrlTokenModel
		) {
	
            


        var CurrentStatus = new SearchManager({
            "id": "CurrentStatus",
            "cancelOnUnload": true,
            "latest_time": "$field1.latest$",
            "status_buckets": 0,
            "earliest_time": "$field1.earliest$",
            "search": '| rest local=t "/servicesNS/admin/search_activity/properties/macros/backfill_search_window/definition" | eval name="backfill_search_window" | append [| rest local=t  "/servicesNS/admin/search_activity/properties/macros/backfill_search_internal/definition" | eval name="backfill_search_internal" | eval value=case(value=-1,"Backfill Not Started",value=1,"Backfill Complete",1=1,value) ] | append[| rest local=t  "/servicesNS/admin/search_activity/properties/macros/backfill_events_window/definition" | eval name="backfill_events_window"] | append [| rest local=t  "/servicesNS/admin/search_activity/properties/macros/backfill_events_internal/definition" | eval name="backfill_events_internal"| eval value=case(value=-1,"Backfill Not Started",value=1,"Backfill Complete",1=1,value) ] | append [| rest local=t   "/servicesNS/admin/-/search/jobs"| search dispatchState="RUNNING" OR dispatchState="FINALIZING" OR dispatchState="QUEUED" OR dispatchState="PARSING" title!="| rest*" title="*FillEvents*" | stats count values(sid) as searchid | eval name="events_running_jobs" | eval searchid=if(isnull(searchid),"-",searchid) | eval value=count . " total searches<br />" . mvjoin(if(isnull(searchid),"-",searchid),"<br />")] | append [| rest local=t   "/servicesNS/admin/-/search/jobs"| search NOT (dispatchState="RUNNING" OR dispatchState="FINALIZING" OR dispatchState="QUEUED" OR dispatchState="PARSING") title!="| rest*" title="*FillEvents*" | eval sid = sid . " (" . dispatchState . ")"  | stats count values(sid) as searchid | eval name="events_past_jobs" | eval searchid=if(isnull(searchid),"-",searchid) | eval value=count . " total searches<br />" . mvjoin(if(isnull(searchid),"-",searchid),"<br />")] | append [| rest local=t  "/servicesNS/admin/-/search/jobs"| search dispatchState="RUNNING" OR dispatchState="FINALIZING" OR dispatchState="QUEUED" OR dispatchState="PARSING" title!="| rest*" title="*FillSearchHistory*" OR remoteSearch="*info=failed OR info=completed OR info=canceled *total_run_time* *searchid*" | stats count values(sid) as searchid | eval name="search_running_jobs"  | eval searchid=if(isnull(searchid),"-",searchid) | eval value=count . " total searches<br />" . mvjoin(if(isnull(searchid),"-",searchid),"<br />")]| append [| rest local=t "/servicesNS/admin/-/search/jobs"| search NOT(dispatchState="RUNNING" OR dispatchState="FINALIZING" OR dispatchState="QUEUED" OR dispatchState="PARSING") title!="| rest*" title="*FillSearchHistory*" OR remoteSearch="*info=failed OR info=completed OR info=canceled *total_run_time* *searchid*" | eval sid = sid . " (" . dispatchState . ")" | stats count values(sid) as searchid | eval name="search_past_jobs"  | eval searchid=if(isnull(searchid),"-",searchid) | eval value=count . " total searches<br />" . mvjoin(if(isnull(searchid),"-",searchid),"<br />")]',
            "app": utils.getCurrentApp(),
            "auto_cancel": 90,
            "preview": true,
            "runWhenTimeIsUndefined": false
        }, {tokens: true, tokenNamespace: "submitted"});

 var CurrentStatusSearch = splunkjs.mvc.Components.getInstance("CurrentStatus");
        var CurrentStatusResults = CurrentStatusSearch.data('results', { output_mode:'json', count:0 });

        CurrentStatusSearch.on('search:done', function(properties) {
            // clear div elements of previous result



            if(CurrentStatusSearch.attributes.data.resultCount == 0) {
              return;
            }      

            CurrentStatusResults.on("data", function() {
                var data = CurrentStatusResults.data().results;
                console.log("Here are my results: ", data)
		for(var i = 0; i < data.length; i++){
			document.getElementById(data[i].name).innerHTML = data[i].value;
		}
	});
	});


        var ConfigCheckSystem = new SearchManager({
            "id": "ConfigCheckSystem",
            "cancelOnUnload": false, 
            "latest_time": "$field1.latest$",
            "status_buckets": 0,
            "earliest_time": "$field1.earliest$",
            "search": 'search source="SA-*-ParseData" sourcetype="sa" | transaction id | search $IncludePartials$ $backfilltypes$ | eval time = _time | fields - _* | convert ctime(search_time*) ctime(final_time*) ctime(latest) ctime(time) ctime(b_*) ctime(actualearliest)  | fields  search_time_earliest final_time_earliest search_time_latest maxfinaltime maxstarttime tsidxlag now actual_backfill_time newtimetobackfill time latest actualearliest b_earliest b_latest timeago now latest TML_Letter TML_Num inttimetobackfill timetobackfill type ShortTermBackfillSearchID LongTermBackfillSearchID EventBackfill BackfillType status id',
            "app": utils.getCurrentApp(),
            "auto_cancel": 90,
            "preview": false,
            "runWhenTimeIsUndefined": false
        }, {tokens: true, tokenNamespace: "submitted"});



        var mainSearch = splunkjs.mvc.Components.getInstance("ConfigCheckSystem");
        var myResults = mainSearch.data('results', { output_mode:'json', count:0 });

        mainSearch.on('search:done', function(properties) {
            // clear div elements of previous result



            if(mainSearch.attributes.data.resultCount == 0) {
              return;
            }       

            myResults.on("data", function() {
                var data = myResults.data().results;
                console.log("Here are my results: ", data)
		var output = ""
		for( var i = 0; i < data.length ; i++){
			var myid = data[i].ShortTermBackfillSearchID || data[i].LongTermBackfillSearchID || ""
			console.log("I have this ID, searchid combo, with this other data..", data[i].type, data[i].id, myid, data[i].ShortTermBackfillSearchID, data[i].LongTermBackfillSearchID)
			var line=""
			if(data[i].type == "Events"){
				line = '<div id=entry_' + i + '><b>' + data[i].time + '</b> - ' + data[i].type + '): ' + data[i].status + '&nbsp;<a href="javascript:;" onclick="document.getElementById(\'detail_' + i + '\').style.display = \'block\'; HandleDrilldown(' + data[i].id + ', \'' + myid + '\', ' + i + ');">more...</a><div style="display:none" id="detail_' + i + '"><table>';
			}else{
				line = '<div id=entry_' + i + '><b>' + data[i].time + '</b> - ' + data[i].type + ' (' + data[i].search_time_earliest + ' through ' + data[i].search_time_latest + ', minimum search completion timestamp is ' + data[i].final_time_earliest + '): ' + data[i].status + '&nbsp;<a href="javascript:;" onclick="document.getElementById(\'detail_' + i + '\').style.display = \'block\'; HandleDrilldown(' + data[i].id + ', \'' + myid + '\', ' + i + ');">more...</a><div style="display:none" id="detail_' + i + '"><table>';
			}
			for (var property in data[i]) {
			    if (data[i].hasOwnProperty(property)) {
				switch(property){
	case property='time':
		line += "<tr><td>time</td><td>Time of events</td><td>" + data[i][property] + "</td></tr>";
		break;

	case property='maxfinaltime':
		line += "<tr><td>maxfinaltime</td><td>End timestamp of the most recently completed search in TSIDX</td><td>" + data[i][property] + "</td></tr>";
		break;

	case property='maxstarttime':
		line += "<tr><td>maxstarttime</td><td>Start timestamp of the most recently completed search in TSIDX</td><td>" + data[i][property] + "</td></tr>";
		break;

	case property='search_time_earliest':
		line += "<tr><td>" + property + "</td><td>The earliest for the backfill job this run started</td><td>" + data[i][property] + "</td></tr>";
		break;

	case property='search_time_latest':
		line += "<tr><td>" + property + "</td><td>The latest for the backfill job this run started</td><td>" + data[i][property] + "</td></tr>";
		break;

	case property='final_time_earliest':
		line += "<tr><td>" + property + "</td><td>The minimum finaltime accepted for the backfill job this run started</td><td>" + data[i][property] + "</td></tr>";
		break;

	case property='tsidxlag':
		line += "<tr><td>timeago</td><td>Difference between now() and maxfinaltime</td><td>" + data[i][property] + "</td></tr>";
		break;

	case property='now':
		line += "<tr><td>" + property + "</td><td>eval's now() function when the script was run, aka the time of the admin user on the SH</td><td>" + data[i][property] + "</td></tr>";
		break;

	case property='TML_Num':
		line += "<tr><td>TML_Num and TML_Letter</td><td>Time Management Logic config</td><td>" + data[i].TML_Num + " - " + data[i].TML_Letter + "</td></tr>";
		break;

	case property='search_backfill_internal':
		line += "<tr><td>" + property + "</td><td>Internal setting (tracks backfill in progress)</td><td>" + data[i][property] + "</td></tr>";
		break;

	case property='search_backfill_window':
		line += "<tr><td>" + property + "</td><td>Backfill setting (as configured in setup)</td><td>" + data[i][property] + "</td></tr>";
		break;

	case property='newtimetobackfill':
		line += "<tr><td>" + property + "</td><td>The new internal backfill time that the time management logic decided should be used.</td><td>" + data[i][property] + "</td></tr>";
		break;

	case property='actual_backfill_time':
		line += "<tr><td>" + property + "</td><td>The backfill setting that the time management logic decided should be used.</td><td>" + data[i][property] + "</td></tr>";
		break;

	case property='type':
		line += "<tr><td>" + property + "</td><td>Search or Events -- what was this run for?</td><td>" + data[i][property] + "</td></tr>";
		break;

	case property='ShortTermBackfillSearchID':
		line += "<tr><td>" + property + "</td><td>Search ID of the Short Term Backfill Job</td><td>" + data[i][property] + "</td></tr>";
		break;

	case property='LongTermBackfillSearchID':
		line += "<tr><td>" + property + "</td><td>Search ID of the Long Term Backfill Job</td><td>" + data[i][property] + "</td></tr>";
		break;

	case property='EventBackfill':
		break;

	case property='BackfillType':
		line += "<tr><td>" + property + "</td><td>Type of Backfill Job (based on the final search string)</td><td>" + data[i][property] + "</td></tr>";
		break;

	case property='status':
		line += "<tr><td>" + property + "</td><td>Description of our status</td><td>" + data[i][property] + "</td></tr>";
		break;

			}
			//        line += "<tr><td>" + property + "</td><td>" + data[i][property] + "</td></tr>" 
			    }
			}
			line += "</table></div></div>"
			output += line
		}
		document.getElementById('AnalysisPlaceholder').innerHTML = output
		
                	
            });
          });



});

function HandleDrilldown(tokenvalue, searchid, divid){
console.log("Testing...")
require(['splunkjs/mvc','splunkjs/mvc/utils','splunkjs/mvc/simplexml/ready!'], function(mvc, utils){
                            var unsubmittedTokens = mvc.Components.getInstance('default');
                            var submittedTokens = mvc.Components.getInstance('submitted');
                            console.log("About to set token...")
                                console.log("token name: id, token value:", tokenvalue);
                             unsubmittedTokens.set('id',tokenvalue);
			if(typeof searchid != 'undefined' && undefined != searchid && searchid){
                            console.log("About to set token...")
                                console.log("token name: searchid, token value:", searchid);
                             unsubmittedTokens.set('searchid',searchid);
			}
                            submittedTokens.set(unsubmittedTokens.toJSON());
});

for(var i = 0; i < document.getElementById("AnalysisPlaceholder").getElementsByTagName("div").length; i++){
        if(document.getElementById("AnalysisPlaceholder").getElementsByTagName("div")[i].id.substr(0,6) == "detail" && document.getElementById("AnalysisPlaceholder").getElementsByTagName("div")[i].id.substr(7) != divid)
{
      //console.log("Hiding element",i," - ",document.getElementById("AnalysisPlaceholder").getElementsByTagName("div")[i].style.display)
      document.getElementById("AnalysisPlaceholder").getElementsByTagName("div")[i].style.display = "none"         
        }
}

return false;
}

