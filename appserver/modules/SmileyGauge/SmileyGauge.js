/* Rules
 * Requires d3
 * EASTEREGG!
 */

Splunk.Module.SmileyGauge = $.klass(Splunk.Module.DispatchingModule, {
	initialize: function($super, container) {
		$super(container);
		//Set up internal variables
		this.valueField = this.getParam("valueField") ? this.getParam("valueField") : "x";
		this.$container = $(this.container);
		
		//Context flow gates
		this.doneUpstream = false;
		this.gettingResults = false;
		
		//Congrats
		console.log("Congrats you found the easter egg");
	},
	onContextChange: function() {
		var context = this.getContext();
		if (context.get("search").job.isDone()) {
			this.getResults();
		} else {
			this.doneUpstream = false;
		}
	},
	onJobDone: function() {
		this.getResults();
	},
	getResultURL: function() {
		//Watch this one it has a lot of magic in it to make it 
		//compatible with the paginator
		var context = this.getContext();
		var params = {};
		var search  = context.get("search");
		params['search'] = search.getPostProcess() || "";
		params['outputMode'] = "json";
		var url = search.getUrl("results");
		return url + "?" + Splunk.util.propToQueryString(params);
	},
	getResults: function($super) {
		this.doneUpstream = true;
		this.gettingResults = true;
		return $super();
	},
	renderResults: function(jsonRsp) {
		//Clean up existing
		this.$container.empty();
		var data = SOLN.parseResults(jsonRsp);
		if (data.length === 0) {
			var html = SOLN.replaceVariables('<p class="resultStatusMessage empty_results">No results found, sad face :( <span class="resultStatusHelp"><a href="#" onclick="Splunk.window.openJobInspector(\'$search.sid$\');return false;" class="resultStatusHelpLink">Inspect ...</a></span></p><p style="display:none;">sad face :(</p>',this.getContext());
			this.$container.html(html);
			return
		}
		//Set the freshness to true to indicate this data is just rendered
		this.freshness = true;
		
		//Set up the data dependent variables
		if (this.getParam("thresholdFields")) {
			var context = this.getContext();
			this.thresholdFields = SOLN.replaceVariables(this.getParam("thresholdFields"), context).split(",");
		}
		else {
			var row = data[0];
			var fields = Object.keys(row);
			var re = new RegExp("^y(\\d\\d?)$", "");
			this.thresholdFields = [];
			for (var ii=0; ii<fields.length; ii++) {
				var match = re.exec(fields[ii]);
				if (match) {
					this.thresholdFields[match[1]-1] = match[0];
				}
			}
		}
		if (this.getParam('colors')) {
			this.colors = d3.scale.ordinal()
				.domain(d3.range(this.thresholdFields.length + 1))
				.range(this.getParam('colors').split(','));
		}
		else {
			this.colors = d3.scale.category20();
		}
		
		//Set up the data to be bound to svg
		var valList = [];
		for (var ii=0; ii<data.length; ii++) {
			var row = data[ii];
			var tmpList = []
			for (var jj=0; jj<this.thresholdFields.length; jj++) {
					tmpList.push(row[this.thresholdFields[jj]]);
			}
			var d = {
				fillVal : row[this.valueField],
				thresholdList : tmpList,
				splRow : row
			};
			valList.push(d);
		}
		
		//Utility Functions
		var colorScale = this.colors;
		var getRangeIndex = function(val, tList) {
			var finalVal = -1;
			var val = Number(val);
			//check the endpoints first in case there is only 1 value
			if (tList[0] <= Number(tList[tList.length-1])) {
				if (val <= Number(tList[0])) {
					finalVal = 0;
				}
				else if (val>= Number(tList[tList.length-1])) {
					finalVal = tList.length;
				}
			}
			else {
				if (val >= Number(tList[0])) {
					finalVal = 0;
				}
				else if (val<= Number(tList[tList.length-1])) {
					finalVal = tList.length;
				}
			}
			for ( var ii = 0; ii < tList.length-1; ii++) {
				if ((Number(tList[ii]) <= val) && (val <= Number(tList[ii+1]))) {
					//between two numbers this it's range for sure
					finalVal = ii+1;
					break;
				}
				//but wait we should scan the other way too
				if ((Number(tList[ii]) >= val) && (val >= Number(tList[ii+1]))) {
					//between two numbers this it's range for sure
					finalVal = ii+1;
					break;
				}
			}
			return finalVal;
		};
		
		//Time for some d3ngineering...
		var margin = {
			top : 20,
			right : 20,
			bottom : 20,
			left : 20 
		};
		var smileRadius = 190/2;
		var width = margin.left + margin.right + smileRadius*2;
		var fontSize = 14;
		var height = margin.top + margin.bottom + 2*smileRadius + fontSize;
		var mod_selector = "#" + this.moduleId;
		var modname = this.moduleId;
		//var vis = d3.select(mod_selector).append("svg").attr("id", (this.moduleId+"_stage")).attr("width", width + margin.right + margin.left).attr("height", height + margin.top + margin.bottom).append("g").attr("id", (this.moduleId+"_stage"+"_datagroup")).attr("transform", "translate(" + margin.left + "," + margin.top + ")");
		var vis = d3.select(mod_selector).append("svg").attr("id", (this.moduleId+"_stage")).attr("width", width).attr("height", height).append("g").attr("id", (this.moduleId+"_stage"+"_datagroup")).attr("transform", "translate(" + margin.left + "," + margin.top + ")");
		
		//Make the filters unashamedly stolen from brian.
		var defs = d3.select(mod_selector).select("svg").append("defs");
		defs.append('filter').attr("id","softfill_" + modname).append('feGaussianBlur').attr('stdDeviation',"6");
		defs.append('filter').attr("id","softfillinner_" + modname).append('feGaussianBlur').attr('stdDeviation',"6");
		
		//var barDropShadow = defs.append('filter').attr("id","BarDropShadow_" + this.moduleId);
		//barDropShadow.append('feGaussianBlur').attr("in","SourceAlpha").attr("stdDeviation","2");
		//barDropShadow.append('feOffset').attr('dx',"0").attr('dy',"0").attr('result',"offsetblur");
		//barDropShadow.append('feFlood').attr('style',"flood-opacity:0.3");
		//barDropShadow.append('feComposite').attr("in2","offsetblur").attr("operator","in");
		//var barFeMerge = barDropShadow.append('feMerge');
		//barFeMerge.append('feMergeNode');
		//barFeMerge.append('feMergeNode').attr("in", "SourceGraphic");
		//
		//var textDropShadow = defs.append('filter').attr("id","TextDropShadow_" + this.moduleId);
		//textDropShadow.append('feGaussianBlur').attr("in", "SourceAlpha").attr("stdDeviation","0.2");
		//textDropShadow.append('feOffset').attr("dx","0").attr("dy","0").attr("result","offsetblur");
		//textDropShadow.append('feFlood').attr("style","flood-opacity:0.75");
		//textDropShadow.append('feComposite').attr("in2","offsetblur").attr("operator","in");
		//var textFeMerge = textDropShadow.append('feMerge');
		//textFeMerge.append('feMergeNode');
		//textFeMerge.append('feMergeNode').attr("in","SourceGraphic");
		//
		//defs.selectAll("clipPath")
		//	.data(valList)
		//	.enter().append("clipPath")
		//	.attr("id",function(d, ii) { return "emptyinnershadow_" + this.moduleId + ii;})
		//	.append('rect').attr("width", barWidth)
		//	.attr("height", barHeight)
		//	.attr("x", maxNameLength*fontSize/1.5 + 5)
		//	.attr("rx",3)
		//	.attr("ry",3);
		//	
		defs.selectAll("clipPath")
			.data(valList)
			.enter().append("clipPath")
			.attr("id",function(d, ii) { return "emptyinnershadowfill_" + modname + ii;})
			.append("circle")
			.attr("r", smileRadius)
			.attr("stroke-width", 2)
			.attr("cx", (smileRadius))
			.attr("cy", (smileRadius));
		
		//Make the smiley container g
		var smileG = vis.selectAll("g.smile")
			.data(valList)
			.enter().append("g")
			.attr("class","row")
			.attr("cursor","pointer")
			.on("click", this.onSMILEYClick.bind(this));
			
		//Make the basic face
		var face = smileG.append("circle")
			.attr("r", smileRadius)
			.attr("stroke", "black")
			.attr("stroke-width", 2)
			.attr("fill",function(d) {return colorScale((getRangeIndex(Number(d.fillVal),d.thresholdList) - 1));})
			.attr("cx", smileRadius)
			.attr("cy", smileRadius)
			.attr("filter","url(#softfillinner_" + modname + ")")
			.attr("clip-path", function(d, ii) { return "url(#emptyinnershadowfill_" + modname + ii +")";});
			
		var eyeSpace = 45;
		var leftEye = smileG.append("ellipse")
			.attr("rx", 7)
			.attr("ry", 20)
			.attr("stroke", "black")
			.attr("fill", "black")
			.attr("cx", (smileRadius - eyeSpace/2))
			.attr("cy", smileRadius/2 + 10);
			
		///var centerEye = smileG.append("ellipse")
		///   .attr("rx", 7)
		///   .attr("ry", 20)
		///   .attr("stroke", "black")
		///   .attr("fill", "black")
		///   .attr("cx", (smileRadius))
		///   .attr("cy", smileRadius/2 + 10);
		
		var rightEye = smileG.append("ellipse")
			.attr("rx", 7)
			.attr("ry", 20)
			.attr("stroke", "black")
			.attr("fill", "black")
			.attr("cx", (smileRadius + eyeSpace/2))
			.attr("cy", smileRadius/2 + 10);
		
		//Draw the smile according to the data, in other words turn that frown upside down :)
		//ideally this should be the extents of data, hardcoding it for percent
		var smileScale = d3.scale.linear()
			.domain([valList[0].thresholdList[0],valList[0].thresholdList[1], 1])
			.range([-1*smileRadius/3, 0, smileRadius/3]);
		var scaledVal = smileScale(valList[0].fillVal);
		var smileCorners = [scaledVal,
			scaledVal/1.5,
			scaledVal/2,
			scaledVal/3,
			scaledVal/4,
			scaledVal/4,
			scaledVal/3,
			scaledVal/2,
			scaledVal/1.5,
			scaledVal];
		var smileLength = smileRadius;
		var smileStep = (smileLength)/smileCorners.length;
		var smileLine = d3.svg.line()
			.x(function(d, i) { return smileStep*i; })
			.y(function(d) { return d; })
			.interpolate("basis");
		var mouth = smileG.append("g")
			.attr("transform", "translate(" + (smileRadius - ((smileLength)/2) + smileStep/2) + "," + (smileRadius + smileRadius/2.5) + ")")
			.attr("class","mouth");
		var smile = mouth.append("path")
			.attr("d", smileLine(smileCorners))
			.attr("stroke", "black")
			.attr("stroke-width", 5)
			.attr("fill","none");
			
		var dimpleData = [{x:0,y:scaledVal}, {x:(smileLength-smileStep),y:scaledVal}];
		var dimple = mouth.selectAll("circle.dimple")
			.data(dimpleData).enter()
			.append("circle")
			.attr("r",6)
			.attr("cx", function(d) {return d.x;})
			.attr("cy", function(d) {return d.y;})
			.attr("fill", "black");
		
		//Place Labels
		var label = this.getParam("label") ? this.getParam("label") : "SMILEY!";
		var labelText = smileG.append("svg:text")
			.attr("style","font-size : 12px; font-family : Helvetica, Arial; color : #686868; fill : #686868;")
			.attr("font-weight","bold")
			.text(label)
			.attr("dx",function(d) {
				return 0;
			})
			.attr("dy", 14)
			.attr("class" ,"chartElement")
			.attr("transform", "translate(" + (0 - 3) + "," + (2*smileRadius + 5) + ")");
		
		var valText = smileG.append("svg:text")
			.attr("style","font-size : 14px; font-family : Helvetica, Arial; color : #686868; fill : #686868;")
			.attr("font-weight","normal")
			.text((valList[0].fillVal*100) + "%")
			.attr("dx",function(d) {
				return (-1 * (d3.select(this).node().getComputedTextLength()));
			})
			.attr("dy", 14)
			.attr("class" ,"chartElement")
			.attr("transform", "translate(" + (2*smileRadius) + "," + (2*smileRadius + 5) + ")");
		
		//Done with the results
		this.gettingResults = false;
	},
	//on a click of a row we want to push context with all vars
	onSMILEYClick: function(d) {
		//ew this data has been touched and is now used, so not fresh
		this.freshness = false;
		var context = this.getContext();
		var row = d.splRow;
		var fields = Object.keys(row);
		for (var jj=0; jj<fields.length; jj++) {
			field = fields[jj];
			context = SOLN.storeVariable("click", field, row[field], context);
		}
		//push with the explicit context set here by the row click
		this.pushContextToChildren(context);
	},
	
	getModifiedContext: function() {
		//think about moving all the context logic here instead of opushing an explicit context 
		//(prolly only needs to be done if we want to disable the drilldown)
		return this.getContext();
	},
	onBeforeJobDispatched: function(search) {
		search.setMinimumStatusBuckets(1);
		search.setRequiredFields(this.requiredFields);
	},
	pushContextToChildren: function($super, explicitContext) {
		this.withEachDescendant(function(module) {
			module.dispatchAlreadyInProgress = false;
		});
		return $super(explicitContext);
	},
	isReadyForContextPush: function($super) {
		if (!(this.doneUpstream)) {
			return Splunk.Module.DEFER;
		}
		if (this.gettingResults) {
			return Splunk.Module.DEFER;
		}
		if (this.freshness) {
			//If the results were just rendered we stop all context propagation until a user clicks on something
			return Splunk.Module.DEFER;
		}
		return $super();
	},
	resetUI: function() {} //Just so splunk stops bitching at me
});
