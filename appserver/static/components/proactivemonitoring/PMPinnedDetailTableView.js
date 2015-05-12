define(["underscore", "jquery", "splunkjs/mvc/messages", "splunkjs/mvc/simplesplunkview", 
	"contrib/text!pm/PMPinnedDetailTable.html", 
	"css!pm/PMPinnedDetailTable.css"
	], 
	function (_, $, Messages, SimpleSplunkView, DetailTableTemplate) {
		//Define custom messages
		var custom_messages = {};
		
		//Compile Table Template
		var compiled_template = _.template(DetailTableTemplate, null, {variable: "data"});
		var DetailTable = SimpleSplunkView.extend({
			className: "proactive-monitoring-pinned-detail-table",
			output_mode: "json_rows",
			resultOptions: { output_time_format: "%s.%Q" },
			options: {
				data: "preview",
				//This will be your main search manager that is hooked into your rendering
				managerid: undefined,
				//If overloaded will set the default message container (default is this.$el)
				message_container: undefined
			},
			/*
			 * We overload displayMessage to include our own custom messages 
			 * with message text overloading. If you wish to use a message 
			 * template you must pass a text object with keys equal to the 
			 * template tokens to replace.
			 * 
			 * In addition we allow for the control of the message container 
			 * with a default of this.$el. this._viz will not be destroyed if 
			 * container is specified.
			 */
			 displayMessage: function(info, text, container) {
				if (container === null || container === undefined) {
					container = this.$el;
					this._viz = null;
				}
				if (custom_messages.hasOwnProperty(info)) {
					var info_obj = _.clone(custom_messages[info]);
					if (text !== null && text !== undefined) {
						info_obj.message = info_obj.message_template(text, {variable: "text"});
					}
					Messages.render(info_obj, container);
				}
				else {
					Messages.render(info, container);
				}
				
				return this;
			},
			/*
			 * We overload _displayMessage to allow for a default container 
			 * other than our own $el.
			 */
			_displayMessage: function(info, text, container) {
				if ((container === undefined || container === null) && this.options.message_container !== undefined) {
					container = this.options.message_container;
				}
				return this.displayMessage(info, text, container);
			},
			formatResults: function(resultsModel) {
				if (!resultsModel) { 
					return {fields: [],
						rows: [[]],
						parse_error: true
						};
				}
				// First try the legacy one, and if it isn't there, use the real one.
				var outputMode = this.output_mode || this.outputMode;
				var data_type = this.data_types[outputMode];
				var data = resultsModel.data();
				//override to return fields as well, thus our data looks like: {fields: [fieldname1, fieldname2, ...], rows: [row1_array, row2_array, ...]}
				return this.formatData({
						fields: data.fields,
						rows: data[data_type],
						parse_error: false
					});
			},
			formatData: function(data) {
				var transformed_data = {
						parse_error: false,
						fields: data.fields,
						data: data.rows[0]
					};
				
				return transformed_data;
			},
			createView: function() {
				this.$el.html("");
				
				return {template: compiled_template};
			},
			updateView: function(viz, data) {
				if (data.parse_error) {
					return;
				}
				//RENDER THE THINGS!
				this.$el.html(viz.template(data, {variable: "data"}));
			}
		});
		
		//Note you must return your view at the end
		return DetailTable;
	}
);
