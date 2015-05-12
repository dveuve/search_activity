Splunk.Module.D3DynamicTree = $.klass(Splunk.Module.DispatchingModule, {
	initialize : function($super, container) {
		$super(container);
		this.populateParentValues = this.getParam('PopulateParentValues', null);
		this.multiRootName = this.getParam('MultiRootName', 'Environment');
		this.redirectTargetView = this.getParam('RedirectTargetView', '');
		this.redirectTarget = this.getParam('RedirectTarget', '_blank');
		this.redirectBranches = this.getParam('RedirectBranches', 'both');
		this.parent_gate = this.getParam('parentGateKey');
		this.parent_job = this.getParam('parentJobKey');
		this.global_parent_job = this.getParam('globalParentJobKey');
		this.leaf_gate = this.getParam('leafGateKey');
		this.leaf_job = this.getParam('leafJobKey');
		this.global_leaf_job = this.getParam('globalLeafJobKey');
		this.leafNidTemplate = this.getParam('leafNidTemplate');
		this.parentNidTemplate = this.getParam('parentNidTemplate');
		this.parentXField = this.getParam('parentXField');
		this.parentYField = this.getParam('parentYField');
		this.leafXField = this.getParam('leafXField');
		this.leafYField = this.getParam('leafYField');
		if (this.getParam('RedirectParams')) {
			this.redirectParams = this.getParam('RedirectParams').split(',');
		}
		else {
			this.redirectParams = [];
		}
		if (this.getParam('PieChartFields')) {
			this.pieChartFields = this.getParam('PieChartFields').split(',');
		}
		else {
			this.pieChartFields = [];
		}
		if (this.getParam('PieChartFieldColors')) {
			this.pieChartFieldColors = d3.scale.ordinal()
				.domain(d3.range(this.pieChartFields.length))
				.range(this.getParam('PieChartFieldColors').split(','));
		}
		else {
			this.pieChartFieldColors = d3.scale.category20();
		}
		
		if (this.getParam('ToolTipAddFields')) {
			this.toolTipAddFields = this.getParam('ToolTipAddFields').split(',');
		}
		else {
			this.toolTipAddFields = [];
		}
		if (this.getParam('ToolTipAddLabels')) {
			this.toolTipAddLabels = this.getParam('ToolTipAddLabels').split(',');
		}
		else {
			this.toolTipAddLabels = this.toolTipAddFields;
		}
		this.svg_id = this.moduleId + '_svg';
		
		//Make it float!
		$(this.container).attr("style", "float:left;clear:both;");
	},

	getResultParams : function($super) {
		var params = $super(), sid = this.getContext().get("search").job.getSID();
		params['sid'] = sid;
		params['populateParentValues'] = this.populateParentValues;
		params['multiRootName'] = this.multiRootName;

		return params;
	},

	onJobDone : function() {
		var context = this.getContext();
		$(".render-gif-container",this.container).show();
		this.getResults();
	},

	renderResults : function(data) {
		if(data.length === 0 || data.indexOf("<p")!=-1){
			if(data.length==0){
			var html = SOLN.replaceVariables('<p class="resultStatusMessage empty_results">No results found, <span class="resultStatusHelp"><a href="#" onclick="Splunk.window.openJobInspector(\'$search.sid$\');return false;" class="resultStatusHelpLink">Inspect results of first broken search ...</a></span></p><p style="display:none;">sad face :(</p>',this.getContext());
			}
		else{
			var html = data;
		}
			this.container.html(html);
			$(".render-gif-container",this.container).hide();
			return;
		}
		this.initViz(data);
	},

	initViz : function(data) {

		var toolTipArrayFields = this.toolTipAddFields;
		var toolTipArrayLabels = this.toolTipAddLabels;
		var pieFieldsArray = this.pieChartFields;
		var colorScale = this.pieChartFieldColors;
		var redirectTargetView = this.redirectTargetView;
		var redirectTarget = this.redirectTarget;
		var redirectParams = this.redirectParams;
		var redirectBranches = this.redirectBranches;
		var parent_gate = this.parent_gate;
		var parent_job = this.parent_job;
		var global_parent_job = this.global_parent_job;
		var leaf_gate = this.leaf_gate;
		var leaf_job = this.leaf_job;
		var global_leaf_job = this.global_leaf_job;
		var leaf_gate_template = this.leafNidTemplate;
		var parent_gate_template = this.parentNidTemplate;
		var leaf_x = this.leafXField;
		var leaf_y = this.leafYField;
		var parent_x = this.parentXField;
		var parent_y = this.parentYField;

		//Show the spinny shit
		var $spinnyshit = $(".render-gif-container",this.container).show();

		// This is used to grab the current module and bind to a div, this div is referenced in the template for the module	
		var div = '#' + this.moduleId + '_d3dynamictree';
		var modname = this.moduleId + '_d3dynamictree';
		// Remove any old content stage.  Debatable that this should exist in resetUI{};
		$('#' + modname + "_stage").remove();

		var margin = {
			top : 20,
			right : 120,
			bottom : 20,
			left : 120
		}, width = 1280 - margin.right - margin.left, height = 800 - margin.top - margin.bottom, i = 0, duration = 500, root;
		var originalHeight = height;

		var tree = d3.layout.tree().size([height, width]);

		var diagonal = d3.svg.diagonal().projection(function(d) {
			return [d.y, d.x];
		});

		var data = eval('(' + data + ')');
		margin.left = (data.name.length*7 >= margin.left-10) ? ((data.name.length*7)+15) : margin.left;
		
		// This takes the div variable above and changes it into an svg stage
		var vis = d3.select(div).append("svg").attr("id", (modname+"_stage")).attr("width", width + margin.right + margin.left).attr("height", height + margin.top + margin.bottom).append("g").attr("id", (modname+"_stage"+"_datagroup")).attr("transform", "translate(" + margin.left + "," + margin.top + ")");
		
		var globalMaxMetricValue = 0.0;
		if (data.max) {
			globalMaxMetricValue = data.max;
		}
		else if (data.children) {
			//Multi parent case, must find max among all parents
			globalMaxMetricValue = d3.max(data.children, function(o) {return parseFloat(o.max)})
		}
		else {
			console.log("[" + modname + "] ERROR: no maximum detectable, hover charts may size improperly");
		}
		root = data;
		root.x0 = height / 2;
		root.y0 = 0;

		function collapse(d) {
			if (d.children) {
				d._children = d.children;
				d._children.forEach(collapse);
				d.children = null;
			}
		}


		root.children.forEach(collapse);
		update(root);

		// Create the tooltip svg elements
		var subchartHeight = 250;
		var subchartWidth = 250;
		var piebarHeight = 25;
		var textHeight = 35;
		var titleHeight = 31;
		var tooltipheight = titleHeight + textHeight + piebarHeight + subchartHeight + 20;
		//var tooltipwidth = tooltipheight * 1.89;
		//var tooltipwidth = 350;
		var tooltipwidth = subchartWidth*2 + 15;
		// Create svg group for all tooltip objects
		var tooltipdiv = d3.select(div).select("svg").append("g")
			.attr("id", (modname+"_tooltip"))
			.style("opacity", 1e-6)
			.attr("class", "dynatreetooltip");
			
		var tooltarget = d3.select("#" + modname + "_tooltip");

		// Move the tooltip off the stage
		tooltarget.attr("transform", function (d) {return "translate(" + width + "," + height + ")";});
		
		// Add tooltip dropshadow
		var tooltipShadow = d3.select(div).select("#" + modname + "_tooltip").append("filter")
			.attr("id", "ToolTipDropShadow")
			.attr("height", "130%");
		var tooltipShadowBlur = tooltipShadow.append("feGaussianBlur")
				.attr("in", "SourceAlpha")
				.attr("stdDeviation", "3");
		var tooltipShadowOffset = tooltipShadow.append("feOffset")
					.attr("dx", "2")
					.attr("dy", "2")
					.attr("result", "offsetblur");
		var tooltipShadowFeMerge = tooltipShadow.append("feMerge");
		tooltipShadowFeMerge.append("feMergeNode");
		tooltipShadowFeMerge.append("feMergeNode")
			.attr("in", "SourceGraphic");

		// Create tooltip background
		var tooltiprect = d3.select(div).select("#" + modname + "_tooltip").append("rect")
			.attr("class", "tooltipbackground")
			.attr("height", tooltipheight + "px")
			.attr("width", tooltipwidth + "px")
			.attr("rx", "20px")
			.attr("ry", "20px")
			.attr("filter", "url(#ToolTipDropShadow)");

		var tooltip_title_rect = d3.select(div).select("#" + modname + "_tooltip").append("rect")
			.attr("id", (modname + "_tooltip_title_rect"))
			.attr("class", "tooltipforeground")
			.attr("height", (titleHeight) + "px")
			.attr("width", (2*subchartWidth + 5) + "px")
			.attr("x", "5px")
			.attr("y", "5px")
			.attr("rx", "10px")
			.attr("ry", "10px");

		var tooltip_text_rect = d3.select(div).select("#" + modname + "_tooltip").append("rect")
			.attr("id", (modname + "_tooltip_text_rect"))
			.attr("class", "tooltipforeground")
			.attr("height", (textHeight+piebarHeight) + "px")
			.attr("width", (2*subchartWidth + 5) + "px")
			.attr("x", "5px")
			.attr("y", (10 + titleHeight) + "px")
			.attr("rx", "10px")
			.attr("ry", "10px");

		//var tooltip_pie_rect = d3.select(div).select("#" + modname + "_tooltip").append("rect")
		//	.attr("id", (modname + "_tooltip_pie_rect"))
		//	.attr("class", "tooltipforeground")
		//	.attr("height", piebarHeight + "px")
		//	.attr("width", (2*subchartWidth + 5)  + "px")
		//	.attr("x", 5 + "px")
		//	.attr("y", (textHeight + 10) + "px")
		//	.attr("rx", "10px")
		//	.attr("ry", "10px");

		var subchart_local = d3.select(div).select("#" + modname + "_tooltip").append("rect")
			.attr("id", (modname + "_subchart_local"))
			.attr("class", "tooltipforeground")
			.attr("height", subchartHeight + "px")
			.attr("width", subchartWidth + "px")
			.attr("x", "5px")
			.attr("y", ((titleHeight + textHeight + piebarHeight) + 15) + "px")
			.attr("rx", "10px")
			.attr("ry", "10px");

		var subchart_global = d3.select(div).select("#" + modname + "_tooltip").append("rect")
			.attr("id", (modname + "_subchart_global"))
			.attr("class", "tooltipforeground")
			.attr("height", subchartHeight + "px")
			.attr("width", subchartWidth  + "px")
			.attr("x", (subchartWidth + 10) + "px")
			.attr("y", ((titleHeight + textHeight + piebarHeight) + 15) + "px")
			.attr("rx", "10px")
			.attr("ry", "10px");
			
		var subchart_leaf = d3.select(div).select("#" + modname + "_tooltip").append("rect")
			.attr("id", (modname + "_subchart_leaf"))
			.attr("class", "tooltipforeground")
			.attr("height", subchartHeight + "px")
			.attr("width", (2*subchartWidth + 5)  + "px")
			.attr("x", "5px")
			.attr("y", ((titleHeight + textHeight + piebarHeight) + 15) + "px")
			.style("opacity", 1e-6)
			.attr("rx", "10px")
			.attr("ry", "10px");

		// Append a table to the tooltip
		var table = d3.select("#" + modname + "_tooltip").append("g")
			.attr("id", (modname + "_tooltip" + "_text"))
			.attr("class", "tooltiptext")
			.attr("y", "10px");
		
		var tooltipText = d3.select("#" + modname + "_tooltip_text");
		
		var titleG = d3.select("#" + modname + "_tooltip").append("g")
			.attr("id", (modname + "_tooltip" + "_title"))
			.attr("class", "tooltiptext")
			.attr("y", "10px");
		
		// Create tooltip pie chart
		var pie = d3.select("#" + modname + "_tooltip").append("svg:g")
			.attr("id", modname + "_tooltip_piechart")
			.attr("class", "tooltipPieChart");

		var globalChartG = d3.select(div).select("#" + modname + "_tooltip")
			.append("g");
		var localChartG = d3.select(div).select("#" + modname + "_tooltip")
			.append("g");

		function minSeparation(node) {
			// Compute minimum sibling seperation of subtree
			var children = node.children, min = 999999999, n;
			if (children && (n = children.length)) {
				var child, previousX = -999999999, i = -1;
				while (++i < n) {
					child = children[i];
					min = Math.min(min, child.x - previousX, minSeparation(child));
					previousX = child.x;
				}
			}
			return min;
		}

		function update(source) {

			// Restore original height
			height = originalHeight;
			tree.size([height, width]);
			$('svg#' + modname + "_stage")
			.height(height + margin.top + margin.bottom);

			// Compute the new tree layout.
			var nodes = tree.nodes(root).reverse();

			// Expand svg size if nodes are too close
			var min = minSeparation(nodes[nodes.length - 1]);
			if (min < 20) {
				height *= 20 / min;
				tree.size([height, width]);
				$('svg#' + modname + "_stage")
				.height(height + margin.top + margin.bottom);

				// Re-compute layout
				nodes = tree.nodes(root).reverse();
			}

			// Normalize for fixed-depth.
			nodes.forEach(function(d) {
				d.y = d.depth * 180;
			});

			// Update the nodes
			var node = vis.selectAll("g.node").data(nodes, function(d) {
				return d.id || (d.id = ++i);
			});

			// Enter any new nodes at the parent's previous position.
			var nodeEnter = node.enter().append("g").attr("class", "node").attr("transform", function(d) {
				return "translate(" + source.y0 + "," + source.x0 + ")";
			});

			nodeEnter.append("circle")
				.on("mouseover", mouseover)
				.on("mouseout", mouseout)
				.attr("r", 1e-6)
				.style("fill",  function(d) {
					return d._children ? getColor(d) : "#fff";
				})
				.style("stroke", getColor)
				.on("click", click);

			nodeEnter.append("a").append("text").attr("x", function(d) {
				return d.children || d._children ? -10 : 10;
			}).attr("dy", ".35em").attr("text-anchor", function(d) {
				return d.children || d._children ? "end" : "start";
			}).text(function(d) {
				return d.name;
			}).style("fill-opacity", 1e-6);

			// Transition nodes to their new position.
			var nodeUpdate = node.transition().duration(duration).attr("transform", function(d) {
				return "translate(" + d.y + "," + d.x + ")";
			});
			
			// Populate URL
			nodeUpdate.select("a")
				.attr("xlink:href", function(d) {
					var tempUrlParamObject = Object();
					for (var u = 0; u < redirectParams.length; u++) {
						var field = redirectParams[u];
						if (d.hasOwnProperty(field)) {
							tempUrlParamObject[field] = d[field];
						}
					}
					
					if (redirectParams.length == 0 ) {
						ParamString = "";
					} else {
						ParamString = "?" + Splunk.util.propToQueryString(tempUrlParamObject);
					}
					
					if (redirectBranches == "both") {
						return redirectTargetView + ParamString;
					} else if (redirectBranches == "parent") {
						return d._children ? redirectTargetView + ParamString : "";
					} else {
						return d._children ? "" : redirectTargetView + ParamString;
					}
				})
				.attr("target", redirectTarget);

			nodeUpdate.select("circle")
				.attr("r", 5.5)
				.style("fill",  function(d) {
					return d._children ? getColor(d) : "#fff";
				})
				.style("stroke", getColor);

			nodeUpdate.select("text").style("fill-opacity", 1);
			
			// Transition exiting nodes to the parent's new position.
			var nodeExit = node.exit().transition().duration(duration).attr("transform", function(d) {
				return "translate(" + source.y + "," + source.x + ")";
			}).remove();

			nodeExit.select("circle").attr("r", 1e-6);

			nodeExit.select("text").style("fill-opacity", 1e-6);

			// Update the links
			var link = vis.selectAll("path.link").data(tree.links(nodes), function(d) {
				return d.target.id;
			});

			// Enter any new links at the parent's previous position.
			link.enter().insert("path", "g").attr("class", "link").attr("d", function(d) {
				var o = {
					x : source.x0,
					y : source.y0
				};
				return diagonal({
					source : o,
					target : o
				});
			});

			// Transition links to their new position.
			link.transition().duration(duration).attr("d", diagonal);

			// Transition exiting nodes to the parent's new position.
			link.exit().transition().duration(duration).attr("d", function(d) {
				var o = {
					x : source.x,
					y : source.y
				};
				return diagonal({
					source : o,
					target : o
				});
			}).remove();

			//hide the spinny shit
			$spinnyshit.hide();

			// Stash the old positions for transition.
			nodes.forEach(function(d) {
				d.x0 = d.x;
				d.y0 = d.y;
			});
		}
		
		function getColor(d) {
			var weight = 0;
			for (var ii = 0; ii < pieFieldsArray.length; ii++) {
				var field = pieFieldsArray[ii];
				if (d.hasOwnProperty(field) && (d[field] > 0)) {
					weight = ii;
				}
			}
			return colorScale(weight);
		}

		// Toggle children on click.
		function click(d) {
			if (d.children) {
				d._children = d.children;
				d.children = null;
			} else {
				d.children = d._children;
				d._children = null;
			}
			update(d);
		}
		
		//Render the baseline subcharts
		//PARENT CHART
		function renderParentChart(g, label, data, x, y) {
			if (data.length === 0) {
				data = [];
				console.log("WARNING: [D3DynamicTree] no results returned for subchart search, " + label);
				g.selectAll(".chartElement").remove();
				g.append("svg:text")
					.attr("style","font-size : 16px; font-family : Helvetica, Arial; color : #686868; fill : #686868;")
					.attr("font-weight","bold")
					.text("No results, sad face :(")
					.attr("dx",function(d) {
						return -1*(d3.select(this).node().getComputedTextLength())/2;
					})
					.attr("class" ,"chartElement")
					.attr("transform", "translate(" + x + "," + y + ")");
				return;
			}
			else {
				//parse the search results
				data = JSON.parse(data);
				//adjust x and y vals to the BOTTOM left corner of contianer
				x = x - (subchartWidth/2);
				y = y + (subchartHeight/2);
			}
			
			//Remove old content
			g.selectAll(".chartElement").remove();
			
			//RENDER THE CHART!
			//Set up params
			var barWidth = (subchartWidth - (5*9))/(10) ;
			var xLabelPad = 15;
			//set up scales
			var xScale = d3.scale.linear()
				.domain([0, 9])
				.range([5, (subchartWidth - barWidth - 5)]);
			var yScale = d3.scale.linear()
				.domain([0, d3.max(data.map(function(d){return Number(d[parent_y]);}))])
				.range([5, (subchartHeight - 5 - 20)]);
			//Build the bars
			var bar = g.selectAll("g.chartElement")
				.data(data)
				.enter().append("g")
				.attr("class", "chartElement")
				.attr("transform",function(d, ii) {return "translate(" + (xScale(d["binIndex"]) + x) + ", " + y + ")";});
			bar.append("rect")
				.attr("width", barWidth)
				.attr("height", function(d) { return yScale(d[parent_y]);})
				.attr("y", function(d) { return -1*(yScale(d[parent_y]));})
				.attr("stroke", function() { return label == "Local" ? "steelblue" :"black";})
				.attr("fill", function() { return label == "Local" ? "cornflowerblue" :"#606060";});
			//put on them labels
			bar.append("text")
				.attr("style",function(d) {return "font-size : " + 10 + "px; font-family : Helvetica, Arial; color : #FFFFFF; fill : #FFFFFF;";})
				.text(function(d) {return d[parent_y];})
				.attr("y", function(d) {
					var baseOffset = yScale(d[parent_y]);
					var fontSize = 10
					if (baseOffset - 5 > fontSize) {
						//Put it in the bar and cheat the color to white
						d.fillTextColor = "#FFFFFF";
						return (-1*baseOffset + 5);
					}
					else {
						//Put it on top of the bar and cheat the color to gray
						d.fillTextColor = "#686868";
						return (-1*baseOffset - 5 - 10);
					}
				})
				.attr("dy", (10-1))
				.attr("font-weight","bold")
				.attr("dx", function(d) { 
					var textLength = d3.select(this).node().getComputedTextLength();
					return (barWidth/2 - textLength/2);
				})
				.attr("style",function(d) {return "font-size : 10px; font-family : Helvetica, Arial; color : " + d.fillTextColor + "; fill :  " + d.fillTextColor + ";";});
			
			g.append("svg:text")
				.attr("style","font-size : 10px; font-family : Helvetica, Arial; color : #686868; fill : #686868;")
				.attr("font-weight","bold")
				.text(label + " histogram of metric values in last 24h")
				.attr("dx",function(d) {
					return subchartWidth/2 - (d3.select(this).node().getComputedTextLength())/2 ;
				})
				.attr("dy", 14)
				.attr("class" ,"chartElement")
				.attr("transform", "translate(" + (x - 3) + "," + (y - subchartHeight) + ")");
			//Build a line Difficult to not make the line overlap the bars and labels thus making the chart unreadable
			//var line = d3.svg.line()
			//	.x(function(d,ii) { return (xScale(d["binIndex"]) + x + .5*barWidth); })
			//	.y(function(d) { return (y - (yScale(d[parent_y]) + 20));})
			//	.interpolate("monotone");
			//g.append("path")
			//	.attr("d", line(data))
			//	.attr("stroke",function() { return label == "Local" ? "olivedrab" :"steelblue";} )
			//	.attr("stroke-width",2)
			//	.attr("class","chartElement")
			//	.attr("fill","none");
		}
		
		//LEAF CHART
		function renderLeafChart(g, label, data, x, y) {
			if (data.length === 0) {
				data = [];
				console.log("WARNING: [D3DynamicTree] no results returned for subchart search, " + label);
				g.selectAll(".chartElement").remove();
				g.append("svg:text")
					.attr("style","font-size : 16px; font-family : Helvetica, Arial; color : #686868; fill : #686868;")
					.attr("font-weight","bold")
					.text("No results on " + label + " perf search")
					.attr("dx",function(d) {
						return -1*(d3.select(this).node().getComputedTextLength())/2;
					})
					.attr("class" ,"chartElement")
					.attr("transform", "translate(" + x + "," + y + ")");
				return;
			}
			else {
				//parse the search results
				data = JSON.parse(data);
				if (data.length < 1) {
					console.log("[D3DynamicTree] insufficient data to draw leaf chart")
				}
				//adjust x and y vals to the BOTTOM left corner of contianer
				x = x - (subchartWidth/2);
				y = y + (subchartHeight/2);
			}
			
			//Remove old content and show the leaf subchart
			g.selectAll(".chartElement").remove();
			subchart_leaf.style("opacity", 1);
			
			//RENDER THE CHART!
			var radius = 3;
			var localMaxMetricValue = d3.max(data, function(o) {return parseFloat(o[leaf_y])});
			var maxMetricValue = d3.max([localMaxMetricValue, globalMaxMetricValue])
			//set up scales
			var xScale = d3.scale.linear()
				.domain([0, (data.length - 1)])
				.range([17, (2*subchartWidth - 10)]);
			var yScale = d3.scale.linear()
				.domain([0, maxMetricValue])
				.range([10, (subchartHeight - 10)]);
			//Build an axis/title if global
			if (label == "Global") {
				g.selectAll("line")
					.data(yScale.ticks(10))
					.enter().append("line")
					.attr("y1", function(d) {return (y - yScale(d));})
					.attr("y2", function(d) {return (y - yScale(d));})
					.attr("x1", 10 + x)
					.attr("x2", (2*subchartWidth-10+x))
					.style("stroke", "#ccc")
					.attr("class","chartElement");
				g.selectAll("text")
					.data(yScale.ticks(10))
					.enter().append("text")
					.attr("y", function(d) {return y + (-1*yScale(d));})
					.attr("x", x - 3)
					.attr("text-anchor", "front")
					.attr("style", "font-size : 8px; font-family : Helvetica, Arial; color : #686868; fill : #686868;")
					.attr("class","chartElement")
					.text(String);
				g.append("svg:text")
					.attr("style","font-size : 10px; font-family : Helvetica, Arial; color : #686868; fill : #686868;")
					.attr("font-weight","bold")
					.text("Actual metric value over last 24h")
					.attr("dx",function(d) {
						return subchartWidth - (d3.select(this).node().getComputedTextLength())/2 ;
					})
					.attr("dy", 14)
					.attr("class" ,"chartElement")
					.attr("transform", "translate(" + (x - 3) + "," + (y - subchartHeight) + ")");
			}
			//Build a line
			var line = d3.svg.line()
				.x(function(d,ii) { return (xScale(ii) + x); })
				.y(function(d) { return (y - yScale(d[leaf_y])); })
				.interpolate("monotone");
			g.append("path")
				.attr("d", line(data))
				.attr("stroke",function() { return label == "Local" ? "steelblue" :"black";} )
				.attr("stroke-width",2)
				.attr("class","chartElement")
				.attr("fill","none");
			//Build the points
			var points = g.selectAll("g.chartElement")
				.data(data)
				.enter().append("g")
				.attr("class", "chartElement")
				.attr("transform",function(d, ii) {return "translate(" + (xScale(ii) + x) + ", " + y + ")";});
			points.append("circle")
				.attr("r", radius)
				.attr("cy", function(d) { return -1*(yScale(d[leaf_y]));})
				.attr("fill", function() { return label == "Local" ? "cornflowerblue" :"#606060";} )
				.attr("stroke",function() { return label == "Local" ? "steelblue" :"black";} )
				.attr("stroke-width", 1.5);
		}
		function renderJobProgress(g, label, progress, x, y) {
			//delete all current elements
			g.selectAll(".chartElement").remove();
			//Add in the update (not sexy but quicker to code)
			var arc = d3.svg.arc()
				.innerRadius(220/2)
				.outerRadius(230/2)
				.startAngle(0)
				.endAngle(2*Math.PI*progress);
			g.append("svg:path")
				.attr("d", arc)
				.attr("fill", "steelblue")
				.attr("class" ,"chartElement")
				.attr("transform", "translate(" + x + "," + y + ")");
			g.append("svg:text")
				.attr("style","font-size : 18px; font-family : Helvetica, Arial; color : #686868; fill : #686868;")
				.attr("font-weight","bold")
				.text(progress*100 + "% Complete")
				.attr("dx",function(d) {
					return -1*(d3.select(this).node().getComputedTextLength())/2;
				})
				.attr("class" ,"chartElement")
				.attr("transform", "translate(" + x + "," + y + ")");
		}
		function renderGlobalParentChart(e, key) {
			if (key == global_parent_job) {
				var url = SOLN.getJobResultURL(key);
				var params = {};
				params['outputMode'] = "json";
				url = url + "?" + Splunk.util.propToQueryString(params);
				$.get(url, function(data) { renderParentChart(globalChartG, "Global", data, (subchartWidth*1.5 + 10), (((titleHeight + textHeight + piebarHeight) + 15) + subchartHeight/2)); });
			}
		}
		function renderGlobalLeafChart(e, key) {
			if (key == global_leaf_job) {
				var url = SOLN.getJobResultURL(key);
				var params = {};
				params['outputMode'] = "json";
				url = url + "?" + Splunk.util.propToQueryString(params);
				$.get(url, function(data) { renderLeafChart(globalChartG, "Global", data, (subchartWidth*0.5 + 10), (((titleHeight + textHeight + piebarHeight) + 15) + subchartHeight/2)); });
			}
		}
		
		function renderLocalParentChart(e, key) {
			if (key == parent_job) {
				var url = SOLN.getJobResultURL(key);
				var params = {};
				params['outputMode'] = "json";
				url = url + "?" + Splunk.util.propToQueryString(params);
				$.get(url, function(data) { renderParentChart(localChartG, "Local", data, (subchartWidth*.5 + 5), (((titleHeight + textHeight + piebarHeight) + 15) + subchartHeight/2)); });
			}
		}
		function renderLocalLeafChart(e, key) {
			if (key == leaf_job) {
				var url = SOLN.getJobResultURL(key);
				var params = {};
				params['outputMode'] = "json";
				url = url + "?" + Splunk.util.propToQueryString(params);
				$.get(url, function(data) { renderLeafChart(localChartG, "Local", data, (subchartWidth*.5 + 10), (((titleHeight + textHeight + piebarHeight) + 15) + subchartHeight/2)); });
			}
		}

		function renderLocalJobProgress(e, key) {
			if ((key == parent_job) || (key == leaf_job)) {
				var progress = SOLN.roundNumber(SOLN.getJobProgress(key));
				renderJobProgress(localChartG, "Local", progress,(subchartWidth*.5 + 5), (((titleHeight + textHeight + piebarHeight) + 15) + subchartHeight/2));
			}
		}
		function renderGlobalJobProgress(e, key) {
			if ((key == global_parent_job) || (key == global_leaf_job)) {
				var progress = SOLN.roundNumber(SOLN.getJobProgress(key));
				renderJobProgress(globalChartG, "Global", progress, (subchartWidth*1.5 + 10), (((titleHeight + textHeight + piebarHeight) + 15) + subchartHeight/2));
			}
		}
		
		function mouseover(d, jj) {
			//If this is an invlaid node, i.e. environment kill all hover behavior
			if (!d.hasOwnProperty("nid")) {
				console.log("[D3DynamicTree] INFO hover charts for environment node are suppressed");
				return;
			}
			
			//Generate all tooltip content
			//Build the global/baseline data
			if (d.hasOwnProperty("_children") || d.hasOwnProperty("children")) {
				if (SOLN.isJobDone(global_parent_job)) {
					//global job is already done, we draw it
					renderGlobalParentChart("", global_parent_job);
				}
				else {
					//It's not done yet, build the progress indicator
					//bind to it's progress then draw it on done
					$(document).bind("SOLNJobProgress",renderGlobalJobProgress);
					$(document).bind("SOLNJobDone",renderGlobalParentChart);
					
				}
			}
			else {
				if (SOLN.getJobResultURL(global_leaf_job)) {
					//global job is already done, we draw it
					renderGlobalLeafChart("", global_leaf_job);
				}
				else {
					//It's not done yet, build the progress indicator
					//bind to it's progress then draw it on done
					$(document).bind("SOLNJobProgress",renderGlobalJobProgress);
					$(document).bind("SOLNJobDone",renderGlobalLeafChart);
					
				}
			}
			//Here we trigger all our node specific jobs
			if (d.hasOwnProperty("_children") || d.hasOwnProperty("children")) {
				//It's not done yet, build the progress indicator
				//bind to it's progress then draw it on done
				$(document).bind("SOLNJobProgress",renderLocalJobProgress);
				$(document).bind("SOLNJobDone",renderLocalParentChart);
				var gateVal = parent_gate_template.replace("$nid$",d.nid).replace("$type$",d.type).replace("$host$",d.host).replace("$moid$",d.moid);
				$(document).trigger("openContextGate", [parent_gate, gateVal]);
			}
			else {
				//It's not done yet, build the progress indicator
				//bind to it's progress then draw it on done
				$(document).bind("SOLNJobProgress",renderLocalJobProgress);
				$(document).bind("SOLNJobDone",renderLocalLeafChart);
				var gateVal = leaf_gate_template.replace("$nid$",d.nid).replace("$type$",d.type).replace("$host$",d.host).replace("$moid$",d.moid);
				$(document).trigger("openContextGate", [leaf_gate, gateVal]);
			}
			
			
			//Build threshold based content
			var piedata = [];
			var pieTotal = 0;
			for (var ii = 0; ii < pieFieldsArray.length; ii++) {
				var field = pieFieldsArray[ii];
				var tmp = {};
				if (d.hasOwnProperty(field)) {
					tmp["value"] = d[field];
					tmp["offset"] = pieTotal;
					tmp["field"] = field;
					pieTotal = pieTotal + parseInt(d[field]);
					piedata.push(tmp);
				} else {
					tmp["value"] = 0;
					tmp["offset"] = pieTotal;
					piedata.push(tmp);
				}
			}
			//remove the old pie
			pie.selectAll(".barpieElement").remove();
			var pieScale = d3.scale.linear()
				.domain([0, pieTotal])
				.range([0, (2*subchartWidth - 10)]);
			
			var barpie = pie.selectAll("g")
				.data(piedata)
				.enter().append("g")
				.attr("class","barpieElement")
				.attr("transform", function(d, i) { return "translate(" + (pieScale(d.offset) + 10) + ", " + (titleHeight + textHeight + 15) + ")";});
			
			barpie.append("rect")
				.attr("width", function(d) { return pieScale(d.value);})
				.attr("height", (piebarHeight - 10))
				.attr("fill", function(d, i) { return colorScale(i); });
			
			var mainStageOffsetX = 120;
			var mainStageOffsetY = 20;
			// nodePosX and nodePosY are reversed due to the way we draw the nodes, and are relative to the G. 
			var nodePosX = d.x;
			var nodePosY = d.y;
			var targetPosX = 0;
			var targetPosY = 0;
			// if the tooltip will be drawn off the page, move it above the cursor
			if ((height-nodePosX-tooltipheight) < 0 ) {
				targetPosY = nodePosX - tooltipheight + 10;
			} else {
				targetPosY = nodePosX + mainStageOffsetY + 10;
			}
			
			// if the tooltip will be drawn off the page, move it to the left of the cursor
			if ((width-nodePosY-tooltipwidth) < 0 ) {
				// the +100 on this is to give the same offset as mainstageoffsetX above.  it should be the diff of x-y.
				targetPosX = nodePosY - tooltipwidth + 100;
			} else {
				targetPosX = nodePosY + mainStageOffsetX + 10;
			}
			
			tooltarget
				.attr("transform", "translate(" + targetPosX + "," + targetPosY + ")");

			//place title
			//Remove the old elements
			titleG.selectAll(".titleElement").remove();
			//Create the text elements
			var title = titleG.selectAll("g")
				.data([d.name])
				.enter().append("g")
				.attr("transform", function(d, i) { return "translate(" + (10) + ", 7)";})
				.attr("class", "titleElement");

			title.append("text")
				.text(function(d) { return d;})
				.attr("font-weight", "bold")
				.attr("style", "font-size : 16px; font-family : Helvetica, Arial; color : #686868; fill : #686868;")
				.attr("dy", "18")
				.attr("class", "titleElement");
			
			//Buld the text table at top
			var baseOffset = 0;
			var textArray = [];
			for (var i = 0; i < toolTipArrayFields.length; i++) {
				var field = toolTipArrayFields[i];
				var label = toolTipArrayLabels[i];
				var tempObject = Object();
				if (d.hasOwnProperty(field)) {
					var maxFieldSize = 0;
					if((d[field].length) > maxFieldSize) {
						maxFieldSize = d[field].length;
					}
					if((label.length) > maxFieldSize) {
						maxFieldSize = label.length;
					}
					tempObject["field"] = field;
					tempObject["label"] = label;
					tempObject["value"] = d[field];
					tempObject["offset"] = baseOffset;
					textArray.push(tempObject);
					baseOffset = baseOffset + maxFieldSize*12/1.5 + 2
				}
			}
			//Remove the old elements
			tooltipText.selectAll(".textTableElement").remove();
			//Create the text elements
			var tooltipTable = tooltipText.selectAll("g")
				.data(textArray, function(d) { return d.label;})
				.enter().append("g")
				.attr("transform", function(d, i) { return "translate(" + (d.offset + 10) + ", 43)";})
				.attr("class", "textTableElement");

			tooltipTable.append("text")
				.text(function(d) { return d.label;})
				.attr("font-weight", "bold")
				.attr("style", function(d) {
					if (pieFieldsArray.indexOf(d.field) > -1) {
						var cor = colorScale(pieFieldsArray.indexOf(d.field));
						return "font-size : 12px; font-family : Helvetica, Arial; color : " + cor + "; fill : " + cor + ";";
					}
					else {
						return "font-size : 12px; font-family : Helvetica, Arial; color : #686868; fill : #686868;";
					}
				})
				.attr("dy", "12")
				.attr("class", "textTableElement");
			
			tooltipTable.append("text")
				.text(function(d) {return (!isNaN(parseFloat(d.value)) && isFinite(d.value)) ? Math.floor(d.value) : d.value; })
				.attr("style", function(d) {
					if (pieFieldsArray.indexOf(d.field) > -1) {
						var cor = colorScale(pieFieldsArray.indexOf(d.field));
						return "font-size : 12px; font-family : Helvetica, Arial; color : " + cor + "; fill : " + cor + ";";
					}
					else {
						return "font-size : 12px; font-family : Helvetica, Arial; color : #686868; fill : #686868;";
					}
				})
				.attr("dy", "27")
				.attr("class", "textTableElement");
			
			//Show tooltip
			tooltarget.transition()
			.duration(300)
			.style("opacity", 1);
		}
		
		function mouseout(d) {
			//UNBIND EVERYTHING!
			if (d.hasOwnProperty("_children")) {
				$(document).unbind("SOLNJobProgress",renderGlobalJobProgress);
				$(document).unbind("SOLNJobDone",renderGlobalParentChart);
				$(document).unbind("SOLNJobProgress",renderLocalJobProgress);
				$(document).unbind("SOLNJobDone",renderLocalParentChart);
			}
			else {
				$(document).unbind("SOLNJobProgress",renderLocalJobProgress);
				$(document).unbind("SOLNJobDone",renderLocalLeafChart);
				$(document).unbind("SOLNJobProgress",renderGlobalJobProgress);
				$(document).unbind("SOLNJobDone",renderGlobalLeafChart);
			}
			globalChartG.selectAll(".chartElement").remove();
			localChartG.selectAll(".chartElement").remove();
			subchart_leaf.style("opacity", 1e-6);
			
			tooltarget.transition()
			.duration(300)
			.style("opacity", 1e-6);
			tooltarget.transition()
			.delay(300)
			.duration(.1)
			.attr("transform", function (d) {return "translate(" + width + "," + height + ")";});
		}
		
		function bakePie(data, x, y, r) { 
			var arc = d3.svg.arc().outerRadius(r);
			var donut = d3.layout.pie();
			pie.selectAll("g.arc").remove();
			pie.data([data]);
					
			//Put the slices in
			var arcs = pie.selectAll("g.arc")
				.data(donut)
				.enter().append("svg:g")
					.attr("class", "arc")
					.attr("transform", "translate(" + x + "," + y + ")");
			//Color them
			var paths = arcs.append("svg:path")
				.attr("fill", function(d, i) { return colorScale(i); });
			
			//Transitions
			var tweenPie = function (b) {
				b.innerRadius = 0;
				var i = d3.interpolate({startAngle: 0, endAngle: 0}, b);
				return function(t) {
					return arc(i(t));
				};
			}
			var tweenDonut = function (b) {
				b.innerRadius = r * .6;
				var i = d3.interpolate({innerRadius: 0}, b);
				return function(t) {
					return arc(i(t));
				};
			}
			paths.transition()
				.duration(500)
				.attrTween("d", tweenPie);
			paths.transition()
				.ease("elastic")
				.delay(function(d, i) { return 500 + i * 50; })
				.duration(750)
				.attrTween("d", tweenDonut);
			
			//Put labels on
			arcs.append("svg:text")
				.attr("transform", function(d, ii) {
					d.innerRadius = r * .6;
					d.outerRadius = r;
					//Trig being useful, whoot whoot!
					var center = arc.centroid(d),
						x = center[0],
						y = center[1],
						h = Math.sqrt( x*x + y*y),
						lx = x/h * (((toolTipArrayFields.length * 15 + 100)/2)-14),
						ly = y/h * (((toolTipArrayFields.length * 15 + 100)/2)-14);
					return "translate(" + lx + "," + ly + ")";
				})
				.attr("text-anchor", "middle")
				.text(function(d, i) { 
					if (d.data > 0.0) {
						return pieFieldsArray[i] + ": " + Math.round(d.data);
					}
					else {
						return "";
					}
				});
		}
	}
}); 
