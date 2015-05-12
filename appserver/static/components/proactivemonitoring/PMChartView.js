/*
 * The PMChart creates charts of global distributions with a specific entity's line overlaid and acts as the controller for the widget
 */

define(["underscore", "jquery", "pm/contrib/d3/d3.amd", "backbone", "pm/PMDistributionGraphView", "pm/PMSpecificGraphView", 
	"contrib/text!pm/PMChart.html",
	"css!pm/PMChart.css"
	], 
	function (_, $, d3, Backbone, DistributionGraphView, SpecificGraphView, layout_snippet) {
		var Chart = Backbone.View.extend({
			tagName: "div",
			className: "proactive-monitoring-chart",
			options: {
				plot_width: 250,
				plot_height: 80,
				//Valid values for color_scheme are light and dark
				color_scheme: undefined,
				distribution_managerid: undefined,
				specific_managerid: undefined
			},
			time_scale: undefined,
			y_scale: undefined,
			distribution_view: undefined,
			specific_view: undefined,
			//Flag for the time label parsing style
			dynamic_time_labels: false,
			initialize: function(options) {
				this.specific_managerid = options.specific_managerid;
				this.distribution_managerid = options.distribution_managerid;
				this.plot_width = options.plot_width || this.options.plot_width;
				this.plot_height = options.plot_height || this.options.plot_height;
				//Default the color scheme to dark if it is not passed in 
				this.color_scheme = options.color_scheme === "light" ? "light" : "dark";
				
				Backbone.View.prototype.initialize.apply(this, arguments);
			},
			/*
			 * render the chart frame and dependencies
			 */
			render: function() {
				this.$el.html(layout_snippet);
				//Set color scheme and sizing
				this.$(".pm-chart-layout").addClass("pm-" + this.color_scheme + "-style");
				d3.select(this.$el.get(0)).select("svg")
					.attr("width", this.plot_width)
					.attr("height", this.plot_height);
				
				
				//Set up distribution graph
				var $distribution_message_container = this.$(".pm-distribution-search-message-container");
				var $distribution_graph_container = this.$("g.pm-distribution-graph-container");
				this.distribution_view = new DistributionGraphView({
						el: $distribution_graph_container,
						managerid: this.distribution_managerid,
						message_container: $distribution_message_container,
						color_scheme: this.color_scheme,
						chart_controller: this
					});
				this.distribution_view.render();
				
				var $specific_message_container = this.$(".pm-specific-search-message-container");
				var $specific_graph_container = this.$("g.pm-specific-graph-container");
				this.specific_view = new SpecificGraphView({
						el: $specific_graph_container,
						managerid: this.specific_managerid,
						message_container: $specific_message_container,
						color_scheme: this.color_scheme,
						chart_controller: this
					});
				this.specific_view.render();
			},
			//
			// CHART CONTROLLER FUNCTIONS
			//
			updateScales: function() {
				//Get Domain and Range extents
				var time_data = [];
				var y_data = [];
				if (this.distribution_view !== undefined) {
					if (this.distribution_view.time_extent !== undefined && this.distribution_view.y_extent !== undefined) {
						y_data = y_data.concat(this.distribution_view.y_extent);
						time_data = time_data.concat(this.distribution_view.time_extent);
					}
				}
				if (this.specific_view !== undefined) {
					if (this.specific_view.time_extent !== undefined && this.specific_view.y_extent !== undefined) {
						y_data = y_data.concat(this.specific_view.y_extent);
						time_data = time_data.concat(this.specific_view.time_extent);
					}
				}
				var time_extent = d3.extent(time_data);
				var y_extent = d3.extent(y_data);
				
				this.time_scale = d3.scale.linear()
						.domain(time_extent)
						.range([0, this.plot_width]);
				this.y_scale = d3.scale.linear()
						.domain(y_extent)
						.range([this.plot_height, 0]);
				
				this.updateLabels();
			},
			setTimeLabels: function(earliest, latest) {
				if (latest === "now") {
					this.$(".pm-x-min-label").text(earliest.split("@")[0]);
					this.$(".pm-x-max-label").text("now");
					this.dynamic_time_labels = false;
				}
				else {
					this.dynamic_time_labels = true;
				}
			},
			updateLabels: function() {
				var y_extent = this.y_scale.domain();
				this.$(".pm-y-max-label").text(Number(y_extent[1]).toFixed(1));
				this.$(".pm-y-min-label").text(Number(y_extent[0]).toFixed(1));
				
				if (this.dynamic_time_labels) {
					var time_extent = this.time_scale.domain();
					var date = this.convertEpochToDate(time_extent[0]);
					this.$(".pm-x-min-label").text(date.toLocaleString());
					date = this.convertEpochToDate(time_extent[1]);
					this.$(".pm-x-max-label").text(date.toLocaleString());
				}
			},
			renderGraphs: function() {
				if (this.distribution_view !== undefined) {
					this.distribution_view.renderGraph();
				}
				if (this.specific_view !== undefined) {
					this.specific_view.renderGraph();
				}
			},
			//
			// UTIL
			//
			/*
			 * Convert the epoch seconds int into a js Date obj
			 */
			convertEpochToDate: function(epoch) {
				var date = new Date(0);
				date.setUTCSeconds(epoch);
				return date;
			}
		});
		
		return Chart;
	});
