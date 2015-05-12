/*
 * The PMPinnedDetailView is the controller for a pinned entities in the proactive monitoring visualization
 * Most notably it will control the creation of the required searches and sub views for an entity
 */

define(["underscore", "jquery", "backbone", "splunkjs/mvc/searchmanager", "splunkjs/mvc", "splunkjs/mvc/tokenutils", "splunkjs/mvc/tableview", 
	"pm/PMEventDispatcher", "pm/PMPinnedDetailTableView", "pm/PMChartView", "pm/PMThresholdIndexCellRenderer", "pm/PMLeafNameCellRenderer",
	"contrib/text!pm/PMPinnedDetail.html",
	"css!pm/PMPinnedDetail.css"], 
	function (_, $, Backbone, SearchManager, mvc, TokenUtils, TableView, dispatcher, PinnedDetailTableView, ChartView, PMThresholdIndexCellRenderer, PMLeafNameCellRenderer, PinnedDetailTemplate) {
		var template = _.template(PinnedDetailTemplate, null, {variable: "node"});
		var PinnedDetail = Backbone.View.extend({
			tagName: "div",
			className: "proactive-monitoring-pinboard",
			events: {
				"click .pm-pinned-detail-title-bar": "toggleBody",
				"click .pm-pinned-detail-icon-circle.pm-pinned-detail-action-remove": "removeNode",
				"click .pm-pinned-detail-icon-circle.pm-pinned-detail-action-drill": "drillNode"
			},
			options: {
				sidebar_width: 300,
				min_total_height: 800
			},
			type_detail_search_map: {
				"VirtualMachine": 'sourcetype="vmware:inv:vm" earliest=1 | spath moid output=moid | search moid="$moid$" host="$host$" |spath collectionVersion output=collectionVersion | spath changeSet.name output=name | spath changeSet.summary.runtime.powerState output=powerState | spath changeSet.config.guestFullName output=guestFullName | spath changeSet.guest.toolsStatus output=toolsStatus | spath changeSet.config.hardware.numCPU output=numCPU | spath changeSet.config.hardware.numCoresPerSocket output=numCoresPerSocket | spath changeSet.config.hardware.memoryMB output=memorySizeMB | spath changeSet.resourceConfig.cpuAllocation.reservation output=cpuReservation | spath changeSet.resourceConfig.memoryAllocation.reservation output=memoryReservation | spath changeSet.resourceConfig.memoryAllocation.shares.level output=memSharesLevel | spath changeSet.resourceConfig.memoryAllocation.shares.shares output=memSharesShares | spath changeSet.resourceConfig.cpuAllocation.shares.level output=cpuSharesLevel | spath changeSet.resourceConfig.cpuAllocation.shares.shares output=cpuSharesShares | spath changeSet.summary.runtime.host.moid output=HostSystem | head (collectionVersion!=1) keeplast=t | stats first(name) AS name, first(powerState) AS powerState, first(numCPU) AS numCPU, first(guestFullName) AS guestFullName, first(toolsStatus) AS toolsStatus, first(numCoresPerSocket) AS numCoresPerSocket, first(memorySizeMB) AS memorySizeMB, first(cpuReservation) AS cpuReservation, first(memoryReservation) AS memoryReservation, first(memSharesLevel) AS memSharesLevel, first(memSharesShares) AS memSharesShares, first(cpuSharesLevel) AS cpuSharesLevel, first(cpuSharesShares) AS cpuSharesShares, first(HostSystem) AS HostSystem first(_time) AS _time by moid, host | fillnull value="Not Available" powerState numCoresPerSocket memorySizeMB cpuSharesShares memSharesShares memoryReservation cpuReservation numCPU | eval cpuSharesLevel=if(isnull(cpuSharesLevel), "Not Available", cpuSharesLevel) | eval memSharesLevel=if(isnull(memSharesLevel), "Not Available", memSharesLevel) | eval guestFullName=if(isnull(guestFullName), "Not Available", guestFullName) | eval toolsStatus=if(isnull(toolsStatus), "Not Available", toolsStatus) | fields - moid,host,name,HostSystem,_time',
				"HostSystem": 'sourcetype="vmware:inv:hostsystem" earliest=1 | spath moid output=moid | spath changeSet.name output=name | search moid="$moid$" host="$host$" | spath collectionVersion output=collectionVersion | spath changeSet.summary.overallStatus output=overallStatus | spath changeSet.summary.quickStats.overallCpuUsage output=overallCpuUsage | spath changeSet.summary.quickStats.overallMemoryUsage output=overallMemoryUsage | spath changeSet.summary.hardware.cpuMhz output=cpuMhz | spath changeSet.summary.hardware.memorySize output=memorySize | spath changeSet.summary.hardware.numCpuCores output=CPUCores | spath changeSet.summary.hardware.vendor output=manufacturer | spath changeSet.summary.hardware.model output=model | spath changeSet.summary.hardware.numNics output=numNics | spath changeSet.summary.hardware.cpuModel output=processorType | spath changeSet.summary.hardware.numCpuPkgs output=numCpuPkgs | spath changeSet.summary.hardware.numCpuThreads output=logicalProcessor | spath changeSet.config.hyperThread.active output=active | spath changeSet.summary.host.moid output=HostSystem | spath changeSet.parent.moid output=HostSystemParent | spath changeSet.parent.type output=HostSystemParentType | head (collectionVersion!=1) keeplast=t | stats first(overallStatus) As overallStatus  first(manufacturer) As Manufacturer first(model) As Model first(numNics) As NumberofNICs first(logicalProcessor) As LogicalProcessors first(processorType) As ProcessorType first(numCpuPkgs) As ProcessorSockets first(overallMemoryUsage) AS MemUsg first(overallCpuUsage) AS CpuUsg first(cpuMhz) AS MhzPerCore first(memorySize) AS Mem first(CPUCores) as CPUCores  first(name) As Host first(HostSystem) AS HostSystem first(HostSystemParent) As HostSystemParent first(HostSystemParentType) As HostSystemParentType first(active) as active by moid, host| eval MaxCpuMhz=MhzPerCore*CPUCores | eval MaxMemMB=((Mem/1024)/1024) | eval FreeMem=MaxMemMB-MemUsg | eval FreeCpu=MaxCpuMhz-CpuUsg |  eval CoresperSocket=CPUCores/ProcessorSockets |  eval Hyperthreading=if(active="True", "Active", "Inactive") |fillnull value="N/A"  overallStatus, Manufacturer, Model, NumberofNICs,LogicalProcessors,ProcessorType, ProcessorSockets, MemUsg, CpuUsg, MhzPerCore, Mem, CPUCores, CoresperSocket, FreeCpu, FreeMem, Hyperthreading, MaxCpuMhz, MaxMemMB|  fields - count,Host,HostSystemParent,HostSystem,HostSystemParentType,moid,host,Mem,active',
				"ClusterComputeResource": '| stats count | eval moid="$moid$" | eval host="$host$" | `HandleInfoMaxTimeNow` | eval _time=info_max_time | lookup TimeClusterServicesAvailability moid, host OUTPUT p_average_clusterServices_effectivecpu_megaHertz p_average_clusterServices_effectivemem_megaBytes | lookup FullHierarchy moid, host OUTPUT  name | rename p_average_clusterServices_effectivecpu_megaHertz as AvgEffCpu_MHz | eval AvgEffMem=`format_bytes(p_average_clusterServices_effectivemem_megaBytes*1024*1024)` | eval AvgEffCpu_MHz=if(isnull(AvgEffCpu_MHz),"Unavailable",AvgEffCpu_MHz) | table AvgEffCpu_MHz AvgEffMem',
				"RootFolder": 'sourcetype=vmware:inv:hierarchy earliest=-8h latest=now host=$host$ "\\"type\\": \\"VirtualMachine\\"" OR "\\"type\\": \\"HostSystem\\"" OR "\\"type\\": \\"ClusterComputeResource\\"" | dedup moid | stats count(eval(type="HostSystem")) AS Hosts count(eval(type="VirtualMachine")) as VirtualMachines count(eval(type="ClusterComputeResource")) as Clusters'
			},
			specific_performance_search: '| `tstats` avg(p_$metric$) from vmw_perf_$perf_type$_$entity_type$ where (moid="$moid$" AND host="$host$") instance="aggregated" p_$metric$>=0 groupby _time span=1m | timechart minspan=1m avg(p_$metric$) AS metric', 
			parent_performance_search: '| tstats local=true prestats=false avg(p_$metric$) AS avg_metric from vmw_perf_$perf_type$_$entity_type$ where (moid="$moid$" AND host="$host$") OR (hs="$moid$" AND host="$host$") OR (ccr="$moid$" AND host="$host$") instance="aggregated" groupby _time, host, moid | stats sparkline(avg(avg_metric), 5m) AS sparkline avg(avg_metric) AS avg_metric by host, moid | $threshold_snippet$ | eval _time=now() | lookup FullHierarchy moid, host OUTPUT name | table threshold_index, name, sparkline | sort threshold_index | rename threshold_index AS s | head 50',
			node: undefined,
			pinboard_controller: undefined,
			detail_manager: undefined,
			initialize: function(options) {
				this.node = options.node;
				this.pinboard_controller = options.pinboard_controller;
				this.pin_id = options.pin_id;
				this.distribution_search_id = options.distribution_search_id;
				
				Backbone.View.prototype.initialize.apply(this, arguments);
			},
			/*
			 * Render all the things!
			 */
			render: function() {
				this.$el.html(template(this.node, {variable: "node"}));
				
				//Freeze Tokens at current values for pinned searches
				var submitted_tokens = mvc.Components.get('submitted');
				var entitytype = submitted_tokens.get("entity_type");
				var earliest = submitted_tokens.get("earliest");
				var latest = submitted_tokens.get("latest");
				
				//Set Metric in View
				this.$(".pm-pinned-detail-metric-section").text(submitted_tokens.get("metric"));
				
				//Detail Info Search and View
				var detail_manager_id = this.node.id + "-detail-" + this.cid;
				this.detail_manager = new SearchManager({
						id: detail_manager_id,
						earliest_time: earliest,
						latest_time: latest,
						preview: false,
						cache: 600,
						status_buckets: 0,
						search : this._getDetailSearch(),
						time_format : "%s.%Q"
					}, {tokens:false});
				
				this.detail_view = new PinnedDetailTableView({
					el: this.$(".pm-pinned-detail-detail-section"),
					managerid: detail_manager_id
				});
				
				//Chart Search and View
				var chart_manager_id = this.node.id + "-chart-" + this.cid;
				var search_snippet;
				if (this.node.type.toLowerCase() === entitytype) {
					//For leaf node show the distribution graph
					search_snippet = this.specific_performance_search.replace(/\$moid\$/g, this.node.node_id).replace(/\$host\$/g, this.node.tree);
					this.chart_search = new SearchManager({
							id: chart_manager_id,
							earliest_time: earliest,
							latest_time: latest,
							preview: false,
							cache: 600,
							status_buckets: 0,
							search : TokenUtils.replaceTokens(search_snippet, mvc.Components, {tokenNamespace: "submitted"}),
							time_format : "%s.%Q"
						}, {tokens:false});
					
					this.chart_view = new ChartView({
							el: this.$(".pm-pinned-detail-chart-section"),
							color_scheme: "light",
							plot_width: 230,
							distribution_managerid: this.distribution_search_id,
							specific_managerid: chart_manager_id
						});
					this.chart_view.render();
				}
				else {
					//For parent node show sparklines
					search_snippet = this.parent_performance_search.replace(/\$moid\$/g, this.node.node_id).replace(/\$host\$/g, this.node.tree);
					this.chart_search = new SearchManager({
							id: chart_manager_id,
							earliest_time: earliest,
							latest_time: latest,
							preview: true,
							cache: 600,
							status_buckets: 0,
							search : TokenUtils.replaceTokens(search_snippet, mvc.Components, {tokenNamespace: "submitted"}),
							time_format : "%s.%Q"
						}, {tokens:false});
					
					this.chart_view = new TableView({
							id: this.node.id + "-table-" + this.cid,
							managerid: chart_manager_id,
							format: {
								sparkline: [
									{
										type: "sparkline",
										options: {
											width: "100px",
											lineColor: "#BCBCBC"
										}
									}
								]
							},
							pageSize: 10,
							pagerPosition: "bottom",
							showPager: true,
							el: this.$(".pm-pinned-detail-chart-section")
						}).render();
						
					this.chart_view.table.addCellRenderer(new PMThresholdIndexCellRenderer());
					this.chart_view.table.addCellRenderer(new PMLeafNameCellRenderer());
					this.chart_view.table.render();
				}
			},
			_getDetailSearch: function() {
				var base_search = this.type_detail_search_map[this.node.type];
				return base_search.replace(/\$moid\$/g, this.node.node_id).replace(/\$host\$/g, this.node.tree);
			},
			//
			// EVENT CALLBACKS
			//
			toggleBody: function() {
				console.log("[PMPinnedDetail] toggle body called on node:" + this.node.name);
				var that = this;
				this.$(".pm-pinned-detail-body").slideToggle(function(){
					var $this = $(this);
					if ($this.css("display") === "none") {
						that.$(".pm-pinned-detail-title-bar").css("border-bottom", "1px solid #CCCCCC");
					}
					else {
						that.$(".pm-pinned-detail-title-bar").css("border-bottom", "none");
					}
				});
			},
			removeNode: function(e) {
				//Stop toggle from triggering
				e.stopPropagation();
				console.log("[PMPinnedDetail] remove called on node:" + this.node.name);
				
				//Clean up detail info
				this.detail_manager.set("cancelOnUnload", false);
				this.detail_manager.cancel();
				this.detail_manager.off();
				mvc.Components.revokeInstance(this.detail_manager.id);
				this.detail_view.off();
				this.detail_view.remove();
				
				//Unregister with controller
				this.pinboard_controller.removePin(this.pin_id);
				
				//Remove this view
				this.off();
				this.remove();
			},
			drillNode: function(e) {
				//Stop toggle from triggering
				e.stopPropagation();
				console.log("[PMPinnedDetail] drill called on node:" + this.node.name);
				
				dispatcher.trigger("node:drill", this.node);
			}
		});
		
		return PinnedDetail;
	});
