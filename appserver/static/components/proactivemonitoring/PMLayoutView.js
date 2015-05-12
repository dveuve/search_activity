/*
 * The PMLayoutView creates the base frame for all proactive monitoring components to live in
 */

define(["underscore", "jquery", "pm/contrib/d3/d3.amd", "backbone", "pm/PMEventDispatcher",
	"contrib/text!pm/PMLayout.html",
	"css!pm/PMLayout.css"], 
	function (_, $, d3, Backbone, dispatcher, LayoutTemplate, LayoutCSS) {
		//If we need a template render for some reason this is how we can do it
		//var template = _.template(LayoutTemplate, null, {variable: "data"});
		var Layout = Backbone.View.extend({
			tagName: "div",
			className: "proactive-monitoring-layout",
			options: {
				sidebar_width: 300,
				min_total_width: 800,
				min_total_height: 800
			},
			template: LayoutTemplate,
			initialize: function(options) {
				Backbone.View.prototype.initialize.apply(this, arguments);
				this.min_total_width = options.min_total_width || this.options.min_total_width;
				this.min_total_height = options.min_total_height || this.options.min_total_height;
				this.sidebar_width = options.sidebar_width || this.options.sidebar_width;
				//Custom event binding to the dispatcher goes here
			},
			/*
			 * render the basic layout, set internals so other elements can be 
			 * rendered appropriately
			 */
			render: function() {
				this.$el.html(LayoutTemplate);
				this.$main_stage = $(".proactive-monitoring-main-stage-container", this.$el);
				this.$sidebar = $(".proactive-monitoring-sidebar-container", this.$el);
				this.$panel_body = this.$el.closest(".panel-body");
				this.$el.resizable({
					handles: "s",
					minHeight: this.min_total_height
				});
				$(window).resize(this.onResize.bind(this));
				this.$el.resize(this.onResize.bind(this));
				this.onResize(null, {size: {height: this.min_total_height, width: this.min_total_width}});
			},
			onResize: function(event, ui) {
				//Set the width of layout
				var available_width = this.$panel_body.width();
				if (available_width === null) {
					console.warn("[PMLayout] could not detect available panel width, defaulting to 1200px");
					available_width = 1200;
				}
				if (available_width < this.min_total_width) {
					available_width = this.min_total_width;
				}
				this.$el.width(available_width);
				var stage_width = available_width - 1; // DV - this.sidebar_width - 1;
				this.$main_stage.width(stage_width);
				
				//Set height of layout
				var available_height;
				if (ui === null || ui === undefined) {
					available_height = this.min_total_height - 12;
				}
				else {
					available_height = ui.size.height - 12;
				}
				this.$main_stage.height(available_height);
				this.$sidebar.height(available_height);
				dispatcher.trigger("layout:resize");
			}
		});
		
		return Layout;
	});
