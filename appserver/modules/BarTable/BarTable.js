/* Rules
 * Requires d3
 * No 0 vals for total please
 */

Splunk.Module.BarTable = $.klass(Splunk.Module.DispatchingModule, {
	initialize: function($super, container) {
		$super(container);
		//Set up internal variables
		this.displayField = this.getParam("displayField");
		this.totalField = this.getParam("totalField"); //Note in renderResults we deal with this thing's default
		this.valueField = this.getParam("valueField") ? this.getParam("valueField") : "x";
		this.addFields = this.getParam("addFields") ? this.getParam("addFields").split(",") : false;
		this.drilldownPrefix = this.getParam("drilldownPrefix");
		this.$container = $(this.container);
		
		//Set up variables for splunk
		this.requiredFields = [this.displayField, this.displayField, this.valueField];
		
		//Context flow gates
		this.doneUpstream = false;
		this.gettingResults = false;
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
		params['count'] = context.has("results.count") ? context.get("results.count") : 0;
		params['offset'] = context.has("results.offset") ? context.get("results.offset") : 0;
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
			var html = SOLN.replaceVariables('<p class="resultStatusMessage empty_results">No results found. <span class="resultStatusHelp"><a href="#" onclick="Splunk.window.openJobInspector(\'$search.sid$\');return false;" class="resultStatusHelpLink">Inspect ...</a></span></p><p style="display:none;">sad face :(</p>',this.getContext());
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
		if (this.getParam('icons')) {
			this.icons = d3.scale.ordinal()
				.domain(d3.range(this.thresholdFields.length + 1))
				.range(this.getParam('icons').split(','));
		}
		else {
			this.icons = false;
		}
		if (!this.totalField) {
			var row = data[0];
			var max = 0;
			this.totalField = this.thresholdFields[0];
			for (var jj=0; jj<this.thresholdFields.length; jj++) {
				if (row[this.thresholdFields[ii]] > max) {
					max = row[this.thresholdFields[ii]];
					this.totalField = this.thresholdFields[ii];
				}
			}
		}

		//Set up the data to be bound to svg
		var valList = [];
		var maxNameLength = 0;
		for (var ii=0; ii<data.length; ii++) {
			var row = data[ii];
			var tmpList = []
			for (var jj=0; jj<this.thresholdFields.length; jj++) {
					tmpList.push(row[this.thresholdFields[jj]]);
			}
			if (row[this.displayField].length > maxNameLength) {
					maxNameLength = row[this.displayField].length;
			}
			var d = {
				rowName : row[this.displayField],
				fillVal : row[this.valueField],
				totalVal : row[this.totalField],
				thresholdList : tmpList,
				splRow : row
			};
			valList.push(d);
		}
		
		//Utility Functions
		var colorScale = this.colors;
		var iconScale = this.icons;
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
			bottom : 0,
			left : 20 
		};
		var barWidth = 400;
		var barHeight = 14;
		var width = margin.left + margin.right + (maxNameLength*14) + barWidth;
		var height = margin.top + margin.bottom + (barHeight + 6)*valList.length + 65;
		var fontSize = 12;
		var mod_selector = "#" + this.moduleId;
		var modname = this.moduleId;
		//var vis = d3.select(mod_selector).append("svg").attr("id", (this.moduleId+"_stage")).attr("width", width + margin.right + margin.left).attr("height", height + margin.top + margin.bottom).append("g").attr("id", (this.moduleId+"_stage"+"_datagroup")).attr("transform", "translate(" + margin.left + "," + margin.top + ")");
		var vis = d3.select(mod_selector).append("svg").attr("id", (this.moduleId+"_stage")).attr("width", width).attr("height", height).append("g").attr("id", (this.moduleId+"_stage"+"_datagroup")).attr("transform", "translate(" + margin.left + "," + margin.top + ")");
		
		//Make the filters unashamedly stolen from brian.
		var defs = d3.select(mod_selector).select("svg").append("defs");
		defs.append('filter').attr("id","softfill_" + this.moduleId).append('feGaussianBlur').attr('stdDeviation',"5");
		defs.append('filter').attr("id","softfillinner_" + this.moduleId).append('feGaussianBlur').attr('stdDeviation',"3");
		defs.append('filter').attr("id","highlight_" + this.moduleId).append('feGaussianBlur').attr('stdDeviation',"1");
		
		var barDropShadow = defs.append('filter').attr("id","BarDropShadow_" + this.moduleId);
		barDropShadow.append('feGaussianBlur').attr("in","SourceAlpha").attr("stdDeviation","2");
		barDropShadow.append('feOffset').attr('dx',"0").attr('dy',"0").attr('result',"offsetblur");
		barDropShadow.append('feFlood').attr('style',"flood-opacity:0.3");
		barDropShadow.append('feComposite').attr("in2","offsetblur").attr("operator","in");
		var barFeMerge = barDropShadow.append('feMerge');
		barFeMerge.append('feMergeNode');
		barFeMerge.append('feMergeNode').attr("in", "SourceGraphic");

		var textDropShadow = defs.append('filter').attr("id","TextDropShadow_" + this.moduleId);
		textDropShadow.append('feGaussianBlur').attr("in", "SourceAlpha").attr("stdDeviation","0.2");
		textDropShadow.append('feOffset').attr("dx","0").attr("dy","0").attr("result","offsetblur");
		textDropShadow.append('feFlood').attr("style","flood-opacity:0.75");
		textDropShadow.append('feComposite').attr("in2","offsetblur").attr("operator","in");
		var textFeMerge = textDropShadow.append('feMerge');
		textFeMerge.append('feMergeNode');
		textFeMerge.append('feMergeNode').attr("in","SourceGraphic");
		
		defs.selectAll("clipPath")
			.data(valList)
			.enter().append("clipPath")
			.attr("id",function(d, ii) { return "emptyinnershadow_" + this.moduleId + ii;})
			.append('rect').attr("width", barWidth)
			.attr("height", barHeight)
			.attr("x", maxNameLength*fontSize/1.5 + 5)
			.attr("rx",3)
			.attr("ry",3);
			
		defs.selectAll("clipPath")
			.data(valList)
			.enter().append("clipPath")
			.attr("id",function(d, ii) { return "emptyinnershadowfill_" + this.moduleId + ii;})
			.append('rect').attr("width", function(d) { 
				if (Number(d.totalVal) < 0.01) {
					d.totalVal = 0.01;
				}
				return (d.fillVal/d.totalVal)*barWidth; 
			})
			.attr("height", barHeight)
			.attr("x", maxNameLength*fontSize/1.5 + 5)
			.attr("rx",3)
			.attr("ry",3);
		
		//Paint on some labels
		nameHeader = this.displayField;
		valueHeader = this.valueField == "x" ? "Fill Value" : this.valueField;
		totalHeader = SOLN.startswith(this.totalField, "y") ? "Total Value" : this.totalField;
		vis.append("text")
			.attr("x", 0)
			.text(nameHeader)
			.attr("style","font-size :" +fontSize + "px; font-family : Helvetica, Arial; color : #686868; fill : #686868;")
			.attr("dx", 0)
			.attr("dy", fontSize-2)
			.attr("font-weight", "bold");
		vis.append("text")
			.attr("x", maxNameLength*fontSize/1.5 + 5)
			.text(valueHeader)
			.attr("style","font-size : " +fontSize + "px; font-family : Helvetica, Arial; color : #686868; fill : #686868;")
			.attr("dx", 0)
			.attr("dy", fontSize-2)
			.attr("font-weight", "bold");
		
		//Make the row container g
		var row = vis.selectAll("g.row")
			.data(valList)
			.enter().append("g")
			.attr("class","row")
			.attr("transform", function(d, i) { return "translate(0," + String((barHeight + 8)*i + 45) + ")";})
			.attr("cursor","pointer")
			.on("click", this.onRowClick.bind(this))
			.on("mouseover", mouseover)
			.on("mouseout", mouseout);
			
		//Add Row Labels first
		row.append("text")
			.attr("x", 0)
			.text(function(d) { return d.rowName; })
			.attr("dx", 0)
			.attr("dy", fontSize-2)
			.attr("style","font-size : " +fontSize + "px; font-family : Helvetica, Arial; color : #686868; fill : #686868;");
			
		//Add icons if supplied
		if (this.icons != false) {
			row.each(function(d) {
					if(iconScale(getRangeIndex(d.fillVal,d.thresholdList)).length > 0) {
						d3.select(this).append("svg:image")
							.attr("xlink:href",function(d) {return iconScale(getRangeIndex(d.fillVal,d.thresholdList));})
							.attr("x", (maxNameLength*fontSize/1.5 + 5)-16)
							.attr("y", 1)
							.attr("width", 14)
							.attr("height", 14);
					}
				});
		}
		//Build the total bars
		//add shadow/box
		row.append("rect")
			.attr("x", maxNameLength*fontSize/1.5 + 5)
			.attr("width", barWidth)
			.attr("height", barHeight)
			.attr("class","bar")
			.attr("fill",function(d) {return colorScale(getRangeIndex(d.fillVal,d.thresholdList));})
			.attr("stroke","#CDCDCD")
			.attr("stroke-width","1")
			.attr("rx",3)
			.attr("ry",3);
		//add softglow/box
		//row.append("rect")
		//	.attr("x", maxNameLength*fontSize/1.5 + 5)
		//	.attr("width", barWidth)
		//	.attr("height", barHeight)
		//	.attr("class","bar")
		//	.attr("fill","none")
		//	.attr("stroke","black")
		//	.attr("stroke-width","1")
		//	.attr("rx",3)
		//	.attr("ry",3)
		//	.attr("clip-path", function(d, ii) { return "url(#emptyinnershadow_" + this.moduleId + ii +")";})
		//	.attr("filter","url(#softfill_" + this.moduleId+ ")");
		
		//Build the fill bars on top of the total bars
		row.append("rect")
			.attr("x", maxNameLength*fontSize/1.5 + 5)
			.attr("width", function(d) {
				if (Number(d.totalVal) < 0.01) {
					d.totalVal = 0.01;
				}
				return (d.fillVal/d.totalVal)*barWidth; 
			})
			.attr("height", barHeight)
			.attr("stroke","#CDCDCD")
			.attr("stroke-width","1")
			.attr("rx",3)
			.attr("ry",3)
			.attr("fill", "#B2B2B2");
			
		//add the softblur
		//row.append("rect")
		//	.attr("x", maxNameLength*fontSize/1.5 + 5)
		//	.attr("width", function(d) { return (d.fillVal/d.totalVal)*barWidth; })
		//	.attr("height", barHeight)
		//	.attr("stroke","black")
		//	.attr("stroke-width","2")
		//	.attr("fill","none")
		//	.attr("rx",3)
		//	.attr("ry",3)
		//	.attr("clip-path", function(d, ii) { return "url(#emptyinnershadowfill_" + this.moduleId + ii +")";});
		//	.attr("filter","url(#softfillinner_" + this.moduleId+ ")");
		
		//Build Hightlighters
		row.append("rect")
			.attr("x", maxNameLength*fontSize/1.5 + 5)
			.attr("width", barWidth)
			.attr("height", barHeight)
			.attr("class","highlight")
			.attr("fill","none")
			.attr("stroke","steelblue")
			.attr("stroke-width","2")
			.attr("rx",3)
			.attr("ry",3)
			.attr("filter","url(#highlight_" + this.moduleId+ ")")
			.style("opacity", 1e-6);
		
		//Build the value labels
		row.append("text")
			.text(function(d) { return d.fillVal; })
			.attr("style",function(d) {return "font-size : " +fontSize + "px; font-family : Helvetica, Arial;";})
			.attr("x", function(d) {
				var baseOffset = maxNameLength*fontSize/1.5 + 5;
				var textLength = d3.select(this).node().getComputedTextLength();
				if (Number(d.totalVal) < 0.01) {
					d.totalVal = 0.01;
				}
				var fillLength = (d.fillVal/d.totalVal)*barWidth;
				if (fillLength - 5 > textLength) {
					//Put it in the fillbar and cheat the color to white
					d.fillTextColor = "#FFFFFF";
					return baseOffset + fillLength - textLength - 5;
				}
				else {
					//Put it after the fillbar and cheat the color to gray
					d.fillTextColor = "#686868";
					return baseOffset + fillLength + 5;
				}
			})
			.attr("dx", 0)
			.attr("dy", fontSize-1)
			.attr("font-weight","bold")
			.attr("style",function(d) {return "font-size : " +fontSize + "px; font-family : Helvetica, Arial; color : " + d.fillTextColor + "; fill :  " + d.fillTextColor + ";";})
			.attr("filter",function(d) { return d.fillTextColor == "#FFFFFF" ? "url(#TextDropShadow_" + modname + ")" : ""; });
			
		//Build the total val labels
		var maxLength = 0;
		var baseOffset = maxNameLength*fontSize/1.5 + 5 + barWidth + 10;
		row.append("text")
			.attr("x", maxNameLength*fontSize/1.5 + 5 + barWidth + 10)
			.text(function(d) { return d.totalVal; })
			.attr("dx", 0)
			.attr("dy", fontSize-2)
			.attr("style","font-size : " +fontSize + "px; font-family : Helvetica, Arial; color : #686868; fill : #686868;")
			.each(function(d) {
				var textLength = d3.select(this).node().getComputedTextLength();
				if (textLength > maxLength) {
					maxLength = textLength;
				}
			});
		//Add header for the total field
		vis.append("text")
			.attr("x", maxNameLength*fontSize/1.5 + 5 + barWidth + 10)
			.text(totalHeader)
			.attr("style","font-size : " +fontSize + "px; font-family : Helvetica, Arial; color : #686868; fill : #686868;")
			.attr("dx", 0)
			.attr("dy", fontSize-2)
			.attr("font-weight", "bold")
			.each(function(d) {
				var textLength = d3.select(this).node().getComputedTextLength();
				if (textLength > maxLength) {
					maxLength = textLength;
				}
			});;
		
		//Build in the addFields
		if (this.addFields) {
			for (var ii=0; ii<this.addFields.length; ii++) {
				baseOffset = baseOffset + 5 + maxLength;
				var field = this.addFields[ii];
				//Add column label
				vis.append("text")
				.attr("x", baseOffset)
				.text(field)
				.attr("style","font-size : " +fontSize + "px; font-family : Helvetica, Arial; color : #686868; fill : #686868;")
				.attr("dx", 0)
				.attr("dy", fontSize-2)
				.attr("font-weight", "bold")
				.each(function(d) {
					var textLength = d3.select(this).node().getComputedTextLength();
					if (textLength > maxLength) {
						maxLength = textLength;
					}
				});
				//Add row values
				row.append("text")
					.attr("x", baseOffset)
					.text(function(d) { return d.splRow[field]; })
					.attr("dx", 0)
					.attr("dy", fontSize-2)
					.attr("style","font-size : " +fontSize + "px; font-family : Helvetica, Arial; color : #686868; fill : #686868;")
					.each(function(d) {
						var textLength = d3.select(this).node().getComputedTextLength();
						if (textLength > maxLength) {
							maxLength = textLength;
						}
					});
			}
			//adjust the svg to be the right width for the additional fields
			d3.select(mod_selector).select("svg").attr("width", baseOffset + margin.right + margin.left + maxLength)
		}
		
		//Add divider bar
		vis.append("rect")
			.attr("width", baseOffset + maxLength)
			.attr("height",1)
			.attr("fill","#DDDDDD")
			.attr("transform",function() { return "translate(-3,26)";});
		
		//Hover code
		function mouseover(d, jj) {
			//Show the value labels and highlight
			d3.select(this).selectAll("rect.highlight").transition()
				.duration(100)
				.style("opacity", 1);
		};
		
		function mouseout() {
			//hide the value labels and highlight
			d3.select(this).selectAll("rect.highlight").transition()
				.duration(100)
				.style("opacity", 1e-6);
		};
		//Done with the results
		this.gettingResults = false;
	},
	//on a click of a row we want to push context with all vars
	onRowClick: function(d) {
		//ew this data has been touched and is now used, so not fresh
		this.freshness = false;
		var context = this.getContext();
		var row = d.splRow;
		var fields = Object.keys(row);
		for (var jj=0; jj<fields.length; jj++) {
			field = fields[jj];
			context = SOLN.storeVariable(this.drilldownPrefix, field, row[field], context);
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
