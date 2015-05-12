/*
 * The PMLeafNameCellRenderer is a custom cell renderer for the names of leaf nodes in the pinned table so that they 
 * are truncated to the proper number of characters
 */

define(["underscore", "jquery", "backbone", "splunkjs/mvc/tableview"], 
	function (_, $, Backbone, TableView) {
		var LeafNameCellRenderer = TableView.BaseCellRenderer.extend({ 
			canRender: function(cell) {
				return cell.field === 'name';
			},
			_clipName: function(name) {
				if (name === null || name === undefined) {
					name = "";
				}
				if (name.length > 24) {
					//Display only upto 16 chars of the name label
					var short_name = name.substr(0, 20);
					return short_name.concat('...'); 
				} else {
					return name;
				}
			},
			// This render function only works when canRender returns 'true'
			render: function($td, cell) {
				$td.css("font-size", "10px");
				$td.html(this._clipName(cell.value));
			}
		});
		
		return LeafNameCellRenderer;
	});
