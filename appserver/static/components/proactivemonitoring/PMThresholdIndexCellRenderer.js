/*
 * The PMThresholdIndexCellRenderer is a custom cell renderer for the threshold index field displayed in a TableView
 */

define(["underscore", "jquery", "backbone", "splunkjs/mvc/tableview", "css!pm/PMThresholdIndexCellRenderer.css"], 
	function (_, $, Backbone, TableView) {
		var threshold_severity_classes = ["critical", "warning", "normal", "unknown"];
		var ThresholdIndexCellRenderer = TableView.BaseCellRenderer.extend({ 
			canRender: function(cell) {
				// Various names for the threshold index field
				return cell.field === 'threshold_index' || cell.field === 'status' || cell.field === 's';
			},
			// This render function only works when canRender returns 'true'
			render: function($td, cell) {
				var threshold_class = threshold_severity_classes[cell.value] || "unknown";
				$td.addClass("pm-threshold-indicator-cell");
				$td.html('<div class="pm-threshold-indicator-circle pm-threshold-' + threshold_class + '"/><div>');
			}
		});
		
		return ThresholdIndexCellRenderer;
	});
