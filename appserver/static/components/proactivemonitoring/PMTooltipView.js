/*
 * The PMTooltipView manages the tooltip content for the PMTree
 */

define(["underscore", "jquery", "./contrib/d3/d3.amd", "backbone", "pm/PMEventDispatcher", "pm/PMChartView", 
	"contrib/text!pm/PMTooltip.html",
	"css!pm/PMTooltip.css"], 
	function (_, $, d3, Backbone, dispatcher, Chart, tooltip_snippet) {
		var Tooltip = Backbone.View.extend({
			tagName: "div",
			className: "proactive-monitoring-tooltip",
			events: {
				"click .pm-tooltip-icon-circle.pm-tooltip-action-pin": "pinNode",
				"click .pm-tooltip-icon-circle.pm-tooltip-action-drill": "drillNode"
			},
			options: {
				distribution_managerid: undefined,
				specific_managerid: undefined
			},
			//Internally keep track of the node we are showing the detail of
			current_node: undefined,
			initialize: function(options) {
				this.distribution_managerid = options.distribution_managerid;
				this.specific_managerid = options.specific_managerid;
				Backbone.View.prototype.initialize.apply(this, arguments);
			},
			/*
			 * render the tooltip frame
			 */
			render: function() {
				this.$el.html(tooltip_snippet);
				this.$node_title = this.$(".pm-tooltip-title");
				this.$timerange_length = this.$(".pm-tooltip-timerange-length");
				this.$metric = this.$(".pm-tooltip-metric");
				this.chart_view = new Chart({
						el: this.$(".pm-tooltip-chart-container"),
						distribution_managerid: this.distribution_managerid,
						specific_managerid: this.specific_managerid
					});
				this.chart_view.render();
			},
			showDetail: function(node, metric, earliest, latest) {
				if (this.current_node !== undefined) {
					//Unhighlight the old one
					if (this.current_node.node_view !== undefined && this.current_node.node_view !== null) {
						this.current_node.node_view.unhighlightNode();
					}
				}
				//Highlight current node
				if (node.node_view !== undefined && node.node_view !== null) {
					node.node_view.highlightNode();
				}
				
				
				this.current_node = node;
				this.$node_title.text(node.name);
				this.$metric.text(metric);
				
				this.setTimeLabels(earliest, latest);
				this.chart_view.setTimeLabels(earliest, latest);
			},
			setTimeLabels: function(earliest, latest) {
				if (latest === "now") {
					this.$timerange_length.text(earliest.split("@")[0]);
				}
				else {
					this.$timerange_length.text("Custom Time");
				}
			},
			//
			// EVENT CALLBACKS
			//
			pinNode: function() {
				console.log("[PMTooltip] pin called on node:" + this.current_node.name);
				dispatcher.trigger("node:pin", this.current_node);
			},
			drillNode: function() {
				console.log("[PMTooltip] drill called on node:" + this.current_node.name);
				dispatcher.trigger("node:drill", this.current_node);
			}
		});
		
		return Tooltip;
	});
