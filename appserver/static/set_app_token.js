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
	
            
			    var unsubmittedTokens = mvc.Components.getInstance('default');
			    var submittedTokens = mvc.Components.getInstance('submitted');

				        unsubmittedTokens.set('background_cn',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_company',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_department',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_mail',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_splunk_username',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_title',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_telephoneNumber',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_physicalDeliveryOfficeName',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_ManagementChain',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_managerdisplayname',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_o',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_st',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_l',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_c',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_Totaladhoc',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_Avgadhoc',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_AvgRT_Totaladhoc',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_Totaldashboard',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_Avgdashboard',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_AvgRT_Totaldashboard',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_Totalrealtime',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_Avgrealtime',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_AvgRT_Totalrealtime',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_Totalscheduled',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_Avgscheduled',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_AvgRT_Totalscheduled',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_Totalsummarization',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_Avgsummarization',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_AvgRT_Totalsummarization',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_Totalsum',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_Avgsum',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_AvgRT_Totalsum',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_NumReports',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_NumDirectReports',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_somename',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_NumDays',"Waiting On User Selection...");
				        unsubmittedTokens.set('background_description',"Waiting On User Selection...");
			    submittedTokens.set(unsubmittedTokens.toJSON());
                



        var pulluserinfosearch = new SearchManager({
            "id": "pulluserinfosearch",
            "cancelOnUnload": true,
            "latest_time": "$field1.latest$",
            "status_buckets": 0,
            "earliest_time": "$field1.earliest$",
            "search": ' | stats count | eval splunk_username="$user$" | lookup LDAPSearch sAMAccountName as splunk_username | lookup LDAPMgmtChain sAMAccountName as splunk_username | makemv ManagementChain delim="|" | eval ManagementChain=mvjoin(ManagementChain, "; ") | appendcols [| tstats local=t count sum(total_run_time) as sum_trt from `SA_SearchHistory` where * user=$user$ groupby searchtype _time span=1d | bucket _time span=1d | stats sum(count) as sum sum(sum_trt) as sum_trt sum(eval(if(searchtype="adhoc",count,0))) as adhoc sum(eval(if(searchtype="dashboard",count,0))) as dashboard sum(eval(if(searchtype="realtime",count,0))) as realtime sum(eval(if(searchtype="summarization",count,0))) as summarization sum(eval(if(searchtype="scheduled",count,0))) as scheduled sum(eval(if(searchtype="adhoc",sum_trt,0))) as adhoc_trt sum(eval(if(searchtype="dashboard",sum_trt,0))) as dashboard_trt sum(eval(if(searchtype="realtime",sum_trt,0))) as realtime_trt sum(eval(if(searchtype="summarization",sum_trt,0))) as summarization_trt sum(eval(if(searchtype="scheduled",sum_trt,0))) as scheduled_trt by _time | stats count as NumDays sum(*) as Total* avg(*) as Avg*] | foreach * [ eval AvgRT_<<FIELD>>=<<FIELD>>_trt/<<FIELD>> ] | fields - *_trt',
            "app": "search_activity",
            "auto_cancel": 90,
            "preview": true,
            "runWhenTimeIsUndefined": false
        }, {tokens: true, tokenNamespace: "submitted"});




        var mainSearch = splunkjs.mvc.Components.getInstance("pulluserinfosearch");
        var myResults = mainSearch.data('results', { output_mode:'json', count:0 });

        mainSearch.on('search:done', function(properties) {
            // clear div elements of previous result



            if(mainSearch.attributes.data.resultCount == 0) {
              return;
            }       

            myResults.on("data", function() {
                var data = myResults.data().results;
                console.log("Here are my results: ", data, data[0].value)         

                			       
			    var unsubmittedTokens = mvc.Components.getInstance('default');
			    var submittedTokens = mvc.Components.getInstance('submitted');
 unsubmittedTokens.set('background_cn',"");
				        unsubmittedTokens.set('background_company',"");
				        unsubmittedTokens.set('background_department',"");
				        unsubmittedTokens.set('background_mail',"");
				        unsubmittedTokens.set('background_splunk_username',"");
				        unsubmittedTokens.set('background_title',"");
				        unsubmittedTokens.set('background_telephoneNumber',"");
				        unsubmittedTokens.set('background_physicalDeliveryOfficeName',"");
				        unsubmittedTokens.set('background_ManagementChain',"");
				        unsubmittedTokens.set('background_managerdisplayname',"");
				        unsubmittedTokens.set('background_o',"");
				        unsubmittedTokens.set('background_st',"");
				        unsubmittedTokens.set('background_l',"");
				        unsubmittedTokens.set('background_c',"");
				        unsubmittedTokens.set('background_Totaladhoc',"");
				        unsubmittedTokens.set('background_Avgadhoc',"");
				        unsubmittedTokens.set('background_AvgRT_Totaladhoc',"");
				        unsubmittedTokens.set('background_Totaldashboard',"");
				        unsubmittedTokens.set('background_Avgdashboard',"");
				        unsubmittedTokens.set('background_AvgRT_Totaldashboard',"");
				        unsubmittedTokens.set('background_Totalrealtime',"");
				        unsubmittedTokens.set('background_Avgrealtime',"");
				        unsubmittedTokens.set('background_AvgRT_Totalrealtime',"");
				        unsubmittedTokens.set('background_Totalscheduled',"");
				        unsubmittedTokens.set('background_Avgscheduled',"");
				        unsubmittedTokens.set('background_AvgRT_Totalscheduled',"");
				        unsubmittedTokens.set('background_Totalsummarization',"");
				        unsubmittedTokens.set('background_Avgsummarization',"");
				        unsubmittedTokens.set('background_AvgRT_Totalsummarization',"");
				        unsubmittedTokens.set('background_Totalsum',"");
				        unsubmittedTokens.set('background_Avgsum',"");
				        unsubmittedTokens.set('background_AvgRT_Totalsum',"");
				        unsubmittedTokens.set('background_NumReports',"");
				        unsubmittedTokens.set('background_NumDirectReports',"");
				        unsubmittedTokens.set('background_somename',"");
				        unsubmittedTokens.set('background_NumDays',"");
				        unsubmittedTokens.set('background_description',"");
			                
				for (var prop in data[0]) {
					  // Thank you http://stackoverflow.com/questions/921789/how-to-loop-through-javascript-object-literal-with-objects-as-members
				      // important check that this is objects own property 
				      // not from prototype prop inherited
				      if(data[0].hasOwnProperty(prop)){
				        console.log("Found propertly " + prop + " = " + data[0][prop]);
				        unsubmittedTokens.set('background_' + prop, data[0][prop]);
				      }
				   }
				unsubmittedTokens.set("background_somename", data[0].cn || data[0].splunk_username)

			    // Set the token $app$ to the name of the current app
			    //unsubmittedTokens.set('myuser', data[0].manager);
			    // Set the token $view$ to the name of the current view
			    //unsubmittedTokens.set('myview', utils.getPageInfo().page);

			    
			    // Submit the new tokens
			    submittedTokens.set(unsubmittedTokens.toJSON());
                
            });
          });



});
