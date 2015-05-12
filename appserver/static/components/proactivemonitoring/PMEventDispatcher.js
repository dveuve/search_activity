/*
 * The PMEventDispatcher is a singleton used for event based communication between all resources
 * for instance the dispatcher can be required in and then be used to bind to a custom resize event
 * 
 * CUSTOM EVENT MAPPINGS
 * 
 * layout:resize -> triggered by PMLayoutView when it resizes due to window resizing
 *                  - NO ARGUMENTS
 * node:pin      -> triggered by PMTooltipView when the pin button is clicked
 *                  - ARGUMENTS:
 *                    - node data structure for the pinned node
 * node:drill    -> triggered by PMTooltipView and PMPinnedDetailView when the drill button is clicked
 *                  - ARGUMENTS:
 *                    - node data structure for the drilled node
 */

define(["underscore", "jquery", "backbone"], 
	function (_, $, Backbone) {
		var dispatcher = _.clone(Backbone.Events);
		
		//Bind to drill events and go to correct page
		dispatcher.on("node:drill", function(node) {
			if (node.type === "RootFolder") {
				//For Root Folders just go to the home screen
				Splunk.util.redirect_to("/app/search_activity/home_proactive_monitoring");
			}
			else {
				var query_string_args = {
						Type: node.type,
						nid: node.node_id,
						host: node.tree
					};
				
				//Drill baby drill!
				Splunk.util.redirect_to("/custom/search_activity/vmware_redirector/search_activity/redirect", query_string_args);
			}
		});
		
		return dispatcher;
	});
