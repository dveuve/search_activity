/*
 * The PMPinboardView is the controller for the collection of pinned entities in the proactive monitoring visualization
 */

define(["underscore", "jquery", "backbone", "splunkjs/mvc", "splunkjs/mvc/tokenutils", "splunkjs/mvc/searchmanager", "pm/PMEventDispatcher", "pm/PMPinnedDetailView", "css!pm/PMPinboard.css"], 
	function (_, $, Backbone, mvc, TokenUtils, SearchManager, dispatcher, PinnedDetailView) {
		var Pinboard = Backbone.View.extend({
			tagName: "div",
			className: "proactive-monitoring-pinboard",
			options: {
				sidebar_width: 300,
				min_total_height: 800
			},
			pinned_manifest: {},
			distribution_search_manifest: {},
			initialize: function() {
				Backbone.View.prototype.initialize.apply(this, arguments);
				dispatcher.on("node:pin", this.pinNode, this);
			},
			/*
			 * Render all the things!
			 */
			render: function() {
				this.$el.html('<ul class="proactive-monitoring-pinboard-detail-list"></ul>');
				//TODO: handle concertina or sortablity here
			},
			//
			// PIN LOGIC
			//
			pinNode: function(node) {
				var submitted_tokens = mvc.Components.get('submitted');
				var current_metric = submitted_tokens.get("metric");
				var entitytype = submitted_tokens.get("entity_type");
				var earliest = submitted_tokens.get("earliest");
				var latest = submitted_tokens.get("latest");
				
				var distribution_search_id = "leaf-performance-distribution-" + [entitytype, current_metric, earliest, latest].join("-");
				var pin_id = node.id + ":" + current_metric;
				
				if (this.pinned_manifest.hasOwnProperty(pin_id)) {
					console.log("[PMPinboard] cancelled pin node since node is already pinned with same metric");
					return;
				}
				
				//Create static distribution search
				if (!this.distribution_search_manifest.hasOwnProperty(distribution_search_id)) {
					this.distribution_search_manifest[distribution_search_id] = new SearchManager({
							id: distribution_search_id,
							earliest_time: earliest,
							latest_time: latest,
							preview: false,
							cache: 600,
							status_buckets: 0,
							search : TokenUtils.replaceTokens('| `tstats` median(p_$metric$) perc25(p_$metric$) perc75(p_$metric$) perc95(p_$metric$) min(p_$metric$) from vmw_perf_$perf_type$_$entity_type$ where instance="aggregated" p_$metric$>=0 groupby _time span=1m | timechart minspan=1m median(p_$metric$) AS center perc25(p_$metric$) as lower_quartile perc75(p_$metric$) as upper_quartile perc95(p_$metric$) as upper_extreme min(p_$metric$) as lower_extreme', mvc.Components, {tokenNamespace: "submitted"}),
							time_format : "%s.%Q"
						}, {tokens: false});
				}
				
				//Create New Pinned Detail
				var $detail_container = $("<li>").appendTo(".proactive-monitoring-pinboard-detail-list").addClass("pm-pinned-detail-container");
				var pinned_detail = new PinnedDetailView({
					el: $detail_container,
					pinboard_controller: this,
					pin_id: pin_id,
					distribution_search_id: distribution_search_id,
					node: node
				});
				pinned_detail.render();
				
				//Add to Pinned Manifest
				this.pinned_manifest[pin_id] = {
						view: pinned_detail,
						metric: current_metric,
						distribution_search_id: distribution_search_id
					};
				
				//TODO:Update to sortability here?
			},
			removePin: function(pin_id) {
				if (this.pinned_manifest.hasOwnProperty(pin_id)) {
					//Remove static distribution search if there are no pinned entities that match it
					var distribution_search_id = this.pinned_manifest[pin_id].distribution_search_id;
					if (_.find(this.pinned_manifest, function(pin, id) { return (pin.distribution_search_id === distribution_search_id) && (pin_id !== id); }) === undefined) {
						var manager = this.distribution_search_manifest[distribution_search_id];
						manager.set("cancelOnUnload", false);
						manager.cancel();
						manager.off();
						mvc.Components.revokeInstance(manager.id);
					}
					delete this.pinned_manifest[pin_id];
				}
			}
		});
		
		return Pinboard;
	});
