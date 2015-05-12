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
	"splunkjs/mvc/simplexml/urltokenmodel",
	"pm/PMLayoutView", 
	"pm/ThresholdCollection",
	"pm/contrib/d3/d3.amd",
	"pm/PMPinboardView",
	"pm/PMTreeView"
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
		UrlTokenModel,
		PMLayout,
		ThresholdCollection,
		d3,
		PMPinboard,
		PMTree
		) {

		var pageLoading = true;


		// 
		// TOKENS
		//
		
		// Create token namespaces
		var urlTokenModel = new UrlTokenModel();
		mvc.Components.registerInstance('url', urlTokenModel);
		var defaultTokenModel = mvc.Components.getInstance('default', {create: true});
		var submittedTokenModel = mvc.Components.getInstance('submitted', {create: true});


		// Initialize tokens
		defaultTokenModel.set(urlTokenModel.toJSON());
		var defaultUpdate = {};

		var submitTokensSoon = _.debounce(function(replaceState) {
			submittedTokenModel.set(defaultTokenModel.toJSON());
			urlTokenModel.saveOnlyWithPrefix('form\\.', defaultTokenModel.toJSON(), {
				replaceState: replaceState
			});
		});

		var submitTokens = function() {
			submitTokensSoon(pageLoading);
		};

		urlTokenModel.on('url:navigate', function() {
			defaultTokenModel.set(urlTokenModel.toJSON());
			if (!_.isEmpty(urlTokenModel.toJSON()) && !_.all(urlTokenModel.toJSON(), _.isUndefined)) {
				submitTokens();
			} else {
				submittedTokenModel.clear();
			}
		});


		//
		// SEARCH MANAGERS
		//
		
		// Base Populating search for fields 'field2' and 'field3'
		var metrics_search = new SearchManager({
			"id": "metrics_search",
			"latest_time": "2",
			"earliest_time": "1",
			"search": '| rest splunk_server=local "/servicesNS/-/search_activity/properties/macros"| rex field=title "^hierarchy_(?<perftype>[a-z]*)_(?<metric>.*)$" | search metric=* | table perftype metric',
			"cancelOnUnload": true,
			"status_buckets": 0,
			"app": utils.getCurrentApp(),
			"auto_cancel": 90,
			"cache": 6000,
			"preview": false
		}, {tokens: true});
		
		
		
		// Populating search for field 'field2'
		var search1 = new PostProcessManager({
			"managerid": "metrics_search",
			"id": "search1",
			"latest_time": "$latest$",
			"search": "search *| dedup perftype | table perftype",
			"earliest_time": "$earliest$",
			"cancelOnUnload": true,
			"status_buckets": 0,
			"app": utils.getCurrentApp(),
			"auto_cancel": 90,
			"preview": true
		}, {tokens: true});

		
		// Populating search for field 'field3'
		var search2 = new PostProcessManager({
			"managerid": "metrics_search",
			"id": "search2",
			"latest_time": "$latest$",
			"search": "search * perftype=$perf_type$ | table metric",
			"earliest_time": "$earliest$",
			"cancelOnUnload": true,
			"status_buckets": 0,
			"app": utils.getCurrentApp(),
			"auto_cancel": 90,
			"preview": true
		}, {tokens: true});


        var CheckForLDAPSearchExisting = new SearchManager({
            "id": "CheckForLDAPSearchExisting",
            "cancelOnUnload": true,
            "latest_time": "",
            "status_buckets": 0,
            "earliest_time": "0",
            "search": ' | inputlookup LDAPSearch | stats count as overall sum(eval(if(length(manager)>5,1,0))) as nummanagers | eval percentage = nummanagers/overall',
            "app": utils.getCurrentApp(),
            "auto_cancel": 90,
            "preview": true,
            "runWhenTimeIsUndefined": false
        }, {tokens: true, tokenNamespace: "submitted"});




        var LDAPSearchExisting = splunkjs.mvc.Components.getInstance("CheckForLDAPSearchExisting");
        var LDAPSearchExistingResults = LDAPSearchExisting.data('results', { output_mode:'json', count:0 });

        LDAPSearchExisting.on('search:done', function(properties) {
            // clear div elements of previous result
            
            console.log("Found LDAP Results..");

            if(LDAPSearchExisting.attributes.data.resultCount < 1 ) {
                document.getElementById("legend_element1").style.display = "none";
                document.getElementById("legend_ldaprequireddescription").style.display = "block";
              console.log("Error pulling ldapsearch example code. No results found.")
              return;
            }else{       

            LDAPSearchExistingResults.on("data", function() {
                var data = LDAPSearchExistingResults.data().results;
                console.log("Here are my results: ", data, data[0].count)    
                
                if(data[0].percentage == undefined || data[0].percentage < 0.15){
                	document.getElementById("legend_element1").style.display = "none";
                	document.getElementById("legend_ldaprequireddescription").style.display = "block";
                }
            });
        }
        });


		//
		// SPLUNK HEADER AND FOOTER
		//

		new HeaderView({
			id: 'header',
			section: 'dashboards',
			el: $('.header'),
			acceleratedAppNav: true
		}, {tokens: true}).render();

		new FooterView({
			id: 'footer',
			el: $('.footer')
		}, {tokens: true}).render();

		//
		// VIEWS: FORM INPUTS
		//


		var field2 = new DropdownInput({
			"id": "field2",
			"choices": [],
			"default": "cpu",
			"seed": "cpu",
			"labelField": "perftype",
			"valueField": "perftype",
			"value": "$form.perf_type$",
			"showClearButton": false,
			"managerid": "search1",
			"el": $('#field2')
		}, {tokens: true}).render();

		field2.on("change", function(value, input, options) {
			if (!field2.hasValue()) {
				defaultUpdate['field2'] = true;
				this.val(field2.settings.get("default"));
				return;
			}
			
			var newValue = field2.val() || field2.settings.get("default");
			var newComputedValue = newValue;

			// Update computed value
			defaultTokenModel.set("perf_type", newComputedValue);
		});
		defaultUpdate['field2'] = true;
		field2.trigger("change", field2.val(), field2);

		var field3 = new DropdownInput({
			"id": "field3",
			"choices": [],
			"valueField": "metric",
			"labelField": "metric",
			"value": "$form.metric$",
			"managerid": "search2",
			"showClearButton": false,
			"width": 350,
			"el": $('#field3')
		}, {
			tokens: true
		}).render();

		field3.on("change", function(value, input, options) {
			if (!field3.hasValue()) {
				defaultUpdate['field3'] = true;
				this.val(field3.settings.get("default"));
				return;
			}
			
			var newValue = field3.val() || field3.settings.get("default");
			var newComputedValue = newValue;
			
			
				var legend = "legend_".concat(newComputedValue)
				console.log("About to update the style for ", legend, newComputedValue)
				if(document.getElementById(legend) != undefined){
					document.getElementById("legend_avg_accuracy").style.display = "none";
					document.getElementById("legend_avg_run_time").style.display = "none";
					document.getElementById("legend_avg_search_span_hours").style.display = "none";
					document.getElementById("legend_has_exported").style.display = "none";
					document.getElementById("legend_has_run_adhoc_searches").style.display = "none";
					document.getElementById("legend_has_run_dashboard_searches").style.display = "none";
					document.getElementById("legend_has_run_realtime_searches").style.display = "none";
					document.getElementById("legend_has_run_scheduled_searches").style.display = "none";
					document.getElementById("legend_has_run_searches").style.display = "none";
					document.getElementById("legend_has_shared_results").style.display = "none";
					document.getElementById("legend_scan_count").style.display = "none";
						
					document.getElementById(legend).style.display = "block";


				}

			// Update computed value
			defaultTokenModel.set("metric", newComputedValue);
		});
		defaultUpdate['field3'] = true;
		field3.trigger("change", field3.val(), field3);
		//$("#field3 .select2-container").first().width(250);
		

		var field4 = new TimeRangeInput({
			"id": "field4",
			"default": {"latest_time": "now", "earliest_time": "-30d@d"},
			"earliest_time": "$earliest$",
			"latest_time": "$latest$",
			"el": $('#field4')
		}, {tokens: true}).render();


		field4.on("change", function(value, input, options) {
			if (!field4.hasValue()) {
				defaultUpdate['field4'] = true;
				field4.updateValueWithDefault();
				return;
			}

			// Submit the token only if it wasn't from setting the default
			if (defaultUpdate['field4']) {
				defaultUpdate['field4'] = false;
			} else {
				submitTokens();
			}
		});
		defaultUpdate['field4'] = true;
		field4.trigger("change", field4.val(), field4);



		// 
		// SUBMIT FORM DATA
		//
		
		var submit = new SubmitButton({
			id: 'submit',
			el: $('#search_btn')
		}, {tokens: true}).render();

		submit.on("submit", function() {
			//FIXME: make this alerting sexier
			var field3_val = field3.val();

			
			//In cupcake search results are stored at <view>.visualization._data, in bubbles they are at <view>.select._data, fun right?
			var viz = field3.select || field3.visualization;
			
			if (field3_val === undefined || _.find(viz._data, function(result) { return result.metric === field3_val; }) === undefined) {
				alert("You must select a metric to kick off performance searches!");
			}
			else {
				submitTokens();
			}
		});

		if (!_.isEmpty(urlTokenModel.toJSON())){
			submitTokens();
		}


		//
		// DASHBOARD READY
		//

		DashboardController.ready();
		pageLoading = false;
		
		//We good to go bro!
		$("body").removeClass("preload");
		
		//
		// Proactive Monitoring Render
		//
		var main_container = $(".proactive-monitoring-container").first();
		//
		// Layout Creation
		//
		var layout = new PMLayout({el: main_container});
		layout.render();
		
		//
		// Threshold Data Bindings
		//
		var thresholds = new ThresholdCollection();
		//Keep modified threshold data on hand any time it changes (i.e. when it arrives)
		//FIXME: there is a race condition here if the dynamic tokens are somehow set, may be possible via uri string
		var submitted_tokens = mvc.Components.get('submitted');
		var threshold_data = {};
		thresholds.on("sync", function() {
			threshold_data = this.reduce(function(memo, model) {
					var entitytype = model.entry.content.attributes.entitytype.toLowerCase();
					if (!memo.hasOwnProperty(entitytype)) {
						memo[entitytype] = {};
					}
					memo[entitytype][model.entry.content.attributes.metric] = model.entry.content.attributes;
					return memo;
				}, threshold_data);
			submitted_tokens.trigger('change:metric');
		}, thresholds);
		thresholds.fetch({
			data: {
				app: "search_activity",
				search: "*",
				count: "0"
			}
		});
		
		
		//Bind to the change in metric to get our thresholding search proper
		submitted_tokens.on('change:metric', _.debounce(function () {
			var cur_metric = submitted_tokens.get("metric");
			var entitytype = "hostsystem";
			var entity_thresholds = threshold_data[entitytype] || {};
			console.log("I am testing metrics with:", cur_metric, entity_thresholds)
			if (cur_metric !== null && cur_metric !== undefined && entity_thresholds.hasOwnProperty(cur_metric)) {
				var threshold = entity_thresholds["p_" + cur_metric];
				var snippet = "eval threshold_severity=case(avg_metric" + threshold.comparator + threshold.critical + ', "critical", avg_metric' + threshold.comparator + threshold.warning + ', "warning", isnotnull(avg_metric), "normal", 1==1, "unknown")';
				snippet = snippet + ' | eval threshold_index=case(threshold_severity=="critical", 0, threshold_severity=="warning", 1, threshold_severity=="normal", 2, threshold_severity=="unknown", 3) ';
				submitted_tokens.set("threshold_snippet", snippet);
			}
			else {
				submitted_tokens.set("threshold_snippet", 'eval threshold_severity="unknown" | eval threshold_index=3');
			}
		}));
		
		
		//
		// Search Managers
		//
		
		
		var host_hierarchy_search = new SearchManager({
			id : "hostsystem-hierarchy",
			earliest_time: "-8h",
			latest_time: "now",
			preview : false,
			//cache : 60,
			//search : 'sourcetype=vmware:inv:hierarchy earliest=-8h latest=now "\\"type\\": \\"RootFolder\\"" OR "\\"type\\": \\"HostSystem\\"" OR "\\"type\\": \\"ClusterComputeResource\\"" | spath moid output=moid | spath type output=type | spath changeSet.name output=name | search type="HostSystem" OR type="ClusterComputeResource" OR type="RootFolder" | spath changeSet.parent.moid output=parent   | spath changeSet.parent.type output=parentType   | spath rootFolder.moid output=rootFolderMoid | eval parent=if(parentType="ComputeResource" OR parentType="Folder", rootFolderMoid, parent) | eval parentType=if(parent=rootFolderMoid, "RootFolder", parentType) | stats first(name) as name first(type) as type first(parent) as parent first(parentType) as parentType by host, moid | eval moid=if(type="RootFolder", "*", moid) | eval parent=if(parentType="RootFolder", "*", parent)',
			//search : '| inputlookup vmtest2.csv',
			search : '| `GenerateHostLDAPTree`',
			
			//search : '| inputlookup ldaptest2.csv | eval order=case(parent="N/A",1,parent="*",2,1=1,3) | sort order | fields - order',
			//search : '| inputlookup LDAPSearch.csv | fields cn dn manager | eval usertype = "user" | eval host="hierarchy.local" | eval parentType="user" | rename cn as name dn as moid usertype as type manager as parent | fields host moid name type parent parentType | fields - _time | where moid like "%User Accounts%" | eval parent = if(parent="",moid,parent) | eval moid = if(moid=parent,"*",moid) | eval parentType=if(moid="*","N/A",parentType) | eval parent=if(moid="*","N/A",parent) | eval type=if(moid="*","rootFolder",type) | eval type=if(like(parent,"%Hugh%"),"HostSystem",type) | eval type=if(type="user","VirtualMachine",type) | eval parentType = if(type="HostSystem","rootFolder",parentType) | eval parentType=if(type="VirtualMachine","HostSystem",parentType) | where parent LIKE "%Hugh%" OR parent LIKE "N/A" OR parent LIKE "%Scott%" OR parent LIKE "%Mary Margar%" | search type="HostSystem" ',

			time_format : "%s.%Q"
		}, {tokens: true, tokenNamespace: "submitted"});
		
		var leaf_performance_search = new SearchManager({
			id: "leaf-performance",
			earliest_time: "$earliest$",
			latest_time: "$latest$",
			preview: false,
			//cache: 60,
			status_buckets: 0,
			//search : '| tstats local=t avg(total_run_time) as avg_run_time sum(NumExports) as num_exports avg(searchspan_h) as search_span  avg(accuracy) as accuracy avg(scan_count) as scan_count from `SA_SearchHistory`  groupby user | join type=left [| tstats local=t count as NumShares from `SA_SearchHistory` where WasShared=yes groupby user] | join type=left [| tstats local=t count  from `SA_SearchHistory` where searchtype=adhoc groupby user _time span=1d | stats avg(count) as NumAdHoc by user]| join type=left [| tstats local=t count  from `SA_SearchHistory` where searchtype=dashboard groupby user _time span=1d | stats avg(count) as NumDashboard by user] | join type=left [| tstats local=t count  from `SA_SearchHistory` where searchtype=scheduled groupby user _time span=1d | stats avg(count) as NumScheduled by user] | join type=left [| tstats local=t count  from `SA_SearchHistory` where searchtype=realtime groupby user _time span=1d | stats avg(count) as NumRealtime by user] | fillnull | rename $metric$ as avg_metric | eval max_metric = avg_metric | eval host="hierarchy.local" | rename user as name | lookup LDAPSearch sAMAccountName as name OUTPUTNEW dn as moid  | eval threshold_index=case( "$metric$" = "avg_run_time",case(avg_metric>400,0,avg_metric>200,1,1=1,2), "$metric$" = "num_exports",case(avg_metric>0,2,1=1,3), "$metric$" = "search_span",case(avg_metric>(7*24),0,avg_metric>(24),1,1=1,2), "$metric$" = "accuracy",case(avg_metric<1,0,avg_metric<30,1,1=1,2), "$metric$" = "scan_count",case(avg_metric>1000000,0,avg_metric>10000,1,1=1,2), "$metric$" = "NumAdHoc",case(avg_metric>0,2,1=1,3), "$metric$" = "NumDashboard",case(avg_metric>0,2,1=1,3), "$metric$" = "NumRealtime",case(avg_metric>0,2,1=1,3), "$metric$" = "NumScheduled",case(avg_metric>0,2,1=1,3), "$metric$" = "NumShares",case(avg_metric>0,2,1=1,3), 1=1,3)  ', //| $threshold_snippet$',
			search : '| `hierarchy_$perf_type$_$metric$` | fillnull | rename $metric$ as avg_metric | eval max_metric = avg_metric | eval host="hierarchy.local" | rename user as name | lookup LDAPSearch sAMAccountName as name OUTPUTNEW dn as moid  | search moid=* | eval threshold_index=`hierarchyThreshold($metric$)`',
			time_format : "%s.%Q"
		}, {tokens:true, tokenNamespace: "submitted"});
		
		var performance_distribution_search = new SearchManager({
			id: "leaf-performance-distribution",
			earliest_time: "$earliest$",
			latest_time: "$latest$",
			preview: false,
			//cache: 600,
			status_buckets: 0,
			search : '| tstats local=t prestats=t median($metric$) perc25($metric$) perc75($metric$) perc95($metric$) min($metric$) from  `SA_SearchHistory` where * $metric$>=0 groupby _time span=1m | timechart minspan=1m median($metric$) AS center perc25($metric$) as lower_quartile perc75($metric$) as upper_quartile perc95($metric$) as upper_extreme min($metric$) as lower_extreme',
			time_format : "%s.%Q"
		}, {tokens:true, tokenNamespace: "submitted"});
		
		/*
		 * Alternate Distribution searches:
		 * BOX AND WHISKER
		 * | tstats local=t prestats=t median($metric$) perc25($metric$) perc75($metric$) perc95($metric$) min($metric$) from vmw_perf_$perf_type$_$entity_type$ where instance="aggregated" $metric$>=0 groupby _time span=1m | timechart minspan=1m median($metric$) AS center perc25($metric$) as lower_quartile perc75($metric$) as upper_quartile perc95($metric$) as upper_extreme min($metric$) as lower_extreme
		 * 
		 * NORMAL CURVE
		 * | tstats local=t prestats=t avg($metric$) stdev($metric$) from vmw_perf_$perf_type$_$entity_type$ where  instance="aggregated" $metric$>=0 groupby _time span=1m | timechart minspan=1m avg($metric$) AS avg_metric stdev($metric$) as sigma | eval plus_sigma=avg_metric+sigma | eval plus_2sigma=avg_metric+sigma+sigma | eval minus_sigma=avg_metric-sigma | eval minus_2sigma=avg_metric-sigma-sigma | fields - sigma | rename minus_2sigma AS lower_extreme plus_2sigma AS upper_extreme plus_sigma AS upper_quartile minus_sigma AS lower_quartile avg_metric AS center
		 * 
		 */
		
		var specific_performance_search = new SearchManager({
			id: "specific-node-performance",
			earliest_time: "$earliest$",
			latest_time: "$latest$",
			preview: false,
			//cache: 600,
			status_buckets: 0,
			search : '| tstats local=t prestats=t avg($metric$) from  `SA_SearchHistory` where dn="$tooltip_node$" $metric$>=0 groupby _time span=1m | timechart minspan=1m avg($metric$) AS metric',
			time_format : "%s.%Q"
		}, {tokens:true, tokenNamespace: "submitted"});
		
		//
		// Main View Controllers
		//
		
		var pinboard = new PMPinboard({
			el: layout.$sidebar
		});
		pinboard.render();
		
		var tree = new PMTree({
			el: layout.$main_stage,
			managerid: "hostsystem-hierarchy",
			leaf_type: "hostsystem",
			metric: "$metric$",
			threshold_data: threshold_data,
			perf_managerid: "leaf-performance",
			perf_message_container: $("#search_processing_indicator"),
			tooltip_distribution_managerid: "leaf-performance-distribution",
			tooltip_specific_managerid: "specific-node-performance",
			tooltip_tree_token: "$tooltip_tree$",
			tooltip_node_token: "$tooltip_node$",
			tooltip_earliest: "$earliest$",
			tooltip_latest: "$latest$"
		}, {tokens: true, tokenNamespace: "submitted"});
		
	
		//Christmas Tree Easter Egg, yes mixing holidays there
		window.xmasMode = function() {
			window.mode = 1;
			return window.setInterval(function() {
					if (window.mode === 1) {
						d3.selectAll("circle").attr("opacity", 1);
						window.mode = 2;
					}
					else if (window.mode === 2) {
						d3.selectAll("circle").each(function(d, i) {
							if (i % 2 === 0) {
								d3.select(this).attr("opacity", 1);
							}
							else {
								d3.select(this).attr("opacity", 1e-6);
							}
						});
						window.mode = 3;
					}
					else if (window.mode === 3) {
						d3.selectAll("circle").each(function(d, i) {
							if (i % 2 === 1) {
								d3.select(this).attr("opacity", 1);
							}
							else {
								d3.select(this).attr("opacity", 1e-6);
							}
						});
						window.mode = 4;
					}
					else {
						d3.selectAll("circle").attr("opacity", 1e-6);
						window.mode = 1;
					}
				}, 500);
		};
	}
);
