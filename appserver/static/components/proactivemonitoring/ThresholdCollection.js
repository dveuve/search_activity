define(
	[
		'jquery',
		'backbone',
		'pm/ThresholdModel',
		'collections/SplunkDsBase',
		'splunk.util'
	],
	function($, Backbone, ThresholdModel, SplunkDsBaseCollection, splunk_utils) {
		return SplunkDsBaseCollection.extend({
			url: 'configs/conf-sa_threshold',
			model: ThresholdModel,
			initialize: function() {
				SplunkDsBaseCollection.prototype.initialize.apply(this, arguments);
			}
		});
	}
);
