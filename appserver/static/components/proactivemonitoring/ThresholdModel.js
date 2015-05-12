define(['underscore', 'models/SplunkDBase'], function(_, BaseModel) {
	return BaseModel.extend({
		url: 'configs/conf-sa_threshold',
		initialize: function() {
			BaseModel.prototype.initialize.apply(this, arguments);
		}
	});
});
