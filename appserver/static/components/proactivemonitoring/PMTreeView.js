/*
 * The PMTreeView creates the hierarchy tree and acts as controller for interactions with it
 */

define(["underscore", "jquery", "pm/contrib/d3/d3.amd", "backbone","splunkjs/mvc/messages", "splunkjs/mvc/simplesplunkview", "splunkjs/mvc", 
	"pm/PMEventDispatcher", "pm/PMParentNodeView", "pm/PMTooltipView", 
	"contrib/text!pm/PMTreeControls.html",
	"css!pm/PMTree.css"], 
	function (_, $, d3, Backbone, Messages, SimpleSplunkView, mvc, dispatcher, ParentNodeView, TooltipView, tree_controls_snippet) {
		var custom_messages = {
			//currently unused message due to data format change, but still valid example of custom messages
			"processing-hierarchy" : {
					icon: "info-circle",
					level: "info",
					message_template: _.template("Processing hierarchy: <%= text.complete%>% complete", null, {variable: "text"}),
					message: "Processing hierarchy, please wait."
			},
			"no-root-nodes" : {
					icon: "warning-sign",
					level: "error",
					message: "Could not find any root nodes in the hierarchy. Please check your hierarchy data."
			},
			"parse-error" : {
					icon: "warning-sign",
					level: "error",
					message: "Error parsing data from search. Please check searches."
			},
			//blank will not empty the icon from the container need to have a extra class applied
			"empty" : {
				icon: "blank",
				level: "blank alert-hide-icon",
				message: ""
			},
			"no-results-performance" : {
					icon: "warning-sign",
					level: "error",
					message: "No results from performance search, please check that you have performance data and that your tsidx namespaces are being populated with it."
			},
			"no-results" : {
					icon: "warning-sign",
					level: "error",
					message: "No results from hierarchy search, please check that you have hierarchy data in your index over the last 8 hours."
			}
		};
		
		var Tree = SimpleSplunkView.extend({
			className: "proactive-monitoring-tree",
			output_mode: "json_rows",
			resultOptions: { output_time_format: "%s.%Q" },
			events: {
				"click .pm-tree-icon-circle.pm-tree-action-zoomin": "zoomInTree",
				"click .pm-tree-icon-circle.pm-tree-action-zoomout": "zoomOutTree",
				"click .pm-tree-icon-circle.pm-tree-action-center": "centerTree"
			},
			/*
			 * The Tree acts as the controller for the visualization and as such 
			 * has a large number of configuration options:
			 * -> managerid: is the splunk manager for the hierarchy information
			 * -> metric: is a read only prop representing the current metric
			 * 
			 * perf_* options are for the severity overlay rendering
			 * -> perf_managerid: is the splunk manager for the performance (severity) data
			 * -> perf_message_container: is the jquery selection representing where to display the perf search messages
			 * 
			 * tooltip_* options are for the node tooltip
			 * -> tooltip_distribution_managerid: is the splunk manager for the global performance distribution
			 * -> tooltip_specific_managerid: is the splunk manager for the hovered node performance search
			 * -> tooltip_tree_token: is the writable token to which the hovered node's tree id will be set
			 * -> tooltip_node_token: is the writable token to which the hovered node's node id will be set
			 */
			options: {
				data: "preview",
				id_field: "moid",
				name_field: "name",
				parent_field: "parent",
				tree_field: "host",
				type_field: "type",
				leaf_type: "VirtualMachine",
				root_type: "RootFolder",
				managerid: undefined,
				metric: undefined,
				threshold_data: undefined,
				perf_managerid: undefined,
				perf_message_container: undefined,
				tooltip_distribution_managerid: undefined,
				tooltip_specific_managerid: undefined,
				tooltip_tree_token: undefined,
				tooltip_node_token: undefined,
				tooltip_earliest: undefined,
				tooltip_latest: undefined
			},
			//This is a reference to the distilled threshold data
			threshold_data: undefined,
			//This is the timeout id for tooltip delayed shows
			tooltip_show_timeout: null,
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
			 * Note we overload initialize to shim in our initialization code. 
			 * You MUST still call the parent or you are going to be knee deep
			 * in doodie. Also note that the parent needs to be first.
			 */
			initialize: function(options) {
				SimpleSplunkView.prototype.initialize.apply(this, arguments);
				
				//Enable push on our tokens
				this.settings.enablePush("tooltip_tree_token");
				this.settings.enablePush("tooltip_node_token");
				
				//Bind to perf search manager
				this.bindToComponentSetting('perf_managerid', this._onPerfManagerChange, this);
				if (!this.perf_manager) {
					this._onPerfManagerChange(mvc.Components, null);
				}
				
				//Bind to dispatcher events
				dispatcher.on("layout:resize", this.onLayoutResize, this);
				
				//Bind to threshold data
				this.threshold_data = options.threshold_data;
				this.settings.on("change:metric", this.updateLegend, this);
			},
			/*
			 * Note we overload this method to include the field list because 
			 * we are using json_rows to save message size in the server 
			 * response.
			 */
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
				return this.formatData({fields: data.fields,
					rows: data[data_type],
					parse_error: false
					});
			},
			/*
			 * Transform the tabular search results into the tree data structures
			 * required for rendering.
			 * Note the following asamptions are being made:
			 * -> leaf type nodes never have children
			 * -> leaf nodes never have parents as siblings
			 */
			formatData: function(data) {
				//Get the indices of the identifying fields
				var id_index = _.indexOf(data.fields, this.settings.get("id_field"));
				var parent_index = _.indexOf(data.fields, this.settings.get("parent_field"));
				var tree_index = _.indexOf(data.fields, this.settings.get("tree_field"));
				var type_index = _.indexOf(data.fields, this.settings.get("type_field"));
				var name_index = _.indexOf(data.fields, this.settings.get("name_field"));
				
				//Get Tree Processing Parameters
				var leaf_type = this.settings.get("leaf_type").toLowerCase();
				
				//Create Trees
				var root_nodes = [];
				var tree_manifest = {};
				var ii, parent_id, node_id, row, tree, node_manifest, complete, node, parent, type;
				var prev_complete = 0;
				this.displayMessage("processing-hierarchy");
				for (ii=0; ii < data.rows.length; ii++) {
					row = data.rows[ii];
					
					//Get the tree, create if does not exist yet
					tree = row[tree_index];
					if (!tree_manifest.hasOwnProperty(tree)) {
						tree_manifest[tree] = {};
					}
					node_manifest = tree_manifest[tree];
					
					//Get this node, create if does not exist
					node_id = row[id_index];
					if (!node_manifest.hasOwnProperty(node_id)) {
						node_manifest[node_id] = {
							id: null,
							parent: null,
							name: null,
							type: null,
							tree: tree,
							node_id: node_id,
							_children: [],
							//These keys will be used to affect rendering style
							node_view: null,
							penultimate: false,
							expanded: false,
							x0: null,
							y0: null,
							//Note that the form of value is [<num critical>, <num warning>, <num normal>, <num unknown>]
							value: [0, 0, 0, 0]
						};
					}
					node = node_manifest[node_id];
					
					//Get this node's parent node object, create if does not exist
					parent_id = row[parent_index];
					if (!node_manifest.hasOwnProperty(parent_id)) {
						node_manifest[parent_id] = {
							id: null,
							name: null,
							parent: null,
							type: null,
							tree: tree,
							node_id: parent_id,
							_children: [],
							//These keys will be used to affect rendering style
							node_view: null,
							penultimate: false,
							expanded: false,
							x0: null,
							y0: null,
							//Note that the form of value is [<num critical>, <num warning>, <num normal>, <num unknown>]
							value: [0, 0, 0, 0]
						};
					}
					parent = node_manifest[parent_id];
					
					//Update node properties
					parent._children.push(node);
					parent.id = tree + ":" + parent_id;
					type = row[type_index];
					node.id = tree + ":" + node_id;
					node.type = type;
					node.parent = parent;
					node.name = row[name_index];
					//console.log("Hello World: " . node.user);
					//Set type based properties
					if (type.toLowerCase() === leaf_type) {
						if (parent.type !== this.settings.get("root_type")) {
							parent.penultimate = false;
						}
						node._children = null;
					}
					else if (type === this.settings.get("root_type")) {
						//Default to all root nodes expanded
						node.expanded = true;
						node.parent = null;
						//Root nodes cannot be penultimate as they may contain parent nodes.
						node.penultimate = false;
						root_nodes.push(node);
					}
					
					//Render the hierarchy processing progress
					complete = Math.floor(ii/data.rows.length * 100);
					if (complete > prev_complete) {
						this.displayMessage("processing-hierarchy", {complete: complete});
					}
				}
				
				//Create d3 tree layout
				var root;
				if (root_nodes.length === 1) {
					root = root_nodes[0];
				}
				else if (root_nodes.length === 0) {
					this.displayMessage("no-root-nodes");
					return {
						parse_error: true,
						message: "no-root-nodes"
					};
				}
				else {
					root = {
						id: "__ENV__:__ROOT__",
						name: "Environment",
						parent: null,
						type: null,
						tree: null,
						node_id: null,
						_children: root_nodes,
						//These keys will be used to affect rendering style
						node_view: null,
						penultimate: false,
						expanded: true,
						x0: null,
						y0: null,
						//Note that the form of value is [<num critical>, <num warning>, <num normal>, <num unknown>]
						value: [0, 0, 0, 0]
					};
				}
				
				var tree_layout = d3.layout.cluster();
				tree_layout.children(function(d) {
					if (d.expanded && !d.penultimate) {
						return d._children;
					}
					else {
						return null;
					}
				});
				//Sort by the criticality
				var get_criticality_array = function(d) {
					var val = d.value;
					if (val[0] > 0) {
						return [4, val[0]];
					}
					else if (val[1] > 0) {
						return [3, val[1]];
					}
					else if (val[2] > 0) {
						return [1, val[2]];
					}
					else {
						return [0, val[3]];
					}
				};
				tree_layout.sort(function(a, b) {
					var val_a = get_criticality_array(a);
					var val_b = get_criticality_array(b);
					if (val_a[0] === val_b[0]) {
						//Same severity, use severity count
						return d3.descending(val_a[1], val_b[1]);
					} else {
						//different severity, use severity
						return d3.descending(val_a[0], val_b[0]);
					}
				});
				//Set the layout to function off a set node size instead of the view size
				//Note that the vertical takes into account the spacing on the vertical axis
				tree_layout.nodeSize([45, 245]);
				tree_layout.separation(function(a, b) {
					if (b.penultimate && b.expanded) {
						//Tried and tested, this is the spacing that looks best
						return 3.7;
					}
					else {
						return a.parent === b.parent ? 1 : 2;
					}
				}); 
				return {
					tree_manifest: tree_manifest,
					root_node: root,
					tree_layout: tree_layout,
					parse_error: false
				};
			},
			createView: function() {
				//SET UP DOM
				this.$el.html("");
				var el_width = this.$el.width();
				var el_height = this.$el.height();
				var d3this = d3.select(this.$el.get(0));
				
				//Set up controls
				this.$el.html(tree_controls_snippet);
				
				//Set up tooltip
				var d3tooltip = d3this.selectAll("div.proactive-monitoring-node-tooltip-container")
					.data([
							{
								tooltip_view: new TooltipView({
									distribution_managerid: this.settings.get("tooltip_distribution_managerid"),
									specific_managerid: this.settings.get("tooltip_specific_managerid")
								})
							}
						]
					)
					.enter().append("div")
					.attr("class", "proactive-monitoring-node-tooltip-container")
					.style("opacity","1e-6")
					.style("display", "none")
					.each(function(d) { 
						d.tooltip_view.setElement(this);
						d.tooltip_view.render();
					})
					.on("mouseover", function(d) {
						if (d.tooltip_view.current_node !== undefined) {
							d.tooltip_view.current_node.node_view.highlightNode();
						}
						var tooltip = d3.select(this);
						tooltip.transition()
							.duration(2)
							.style("display", "block")
							.transition()
							.duration(150)
							.style("opacity","1");
					})
					.on("mouseout", function(d) {
						var tooltip = d3.select(this);
						tooltip.transition()
							.duration(300)
							.style("opacity","1e-6")
							.transition()
							.duration(2)
							.style("display", "none")
							.each("end", function(d) {
								if (d.tooltip_view.current_node !== undefined && d.tooltip_view.current_node.node_view !== null && d.tooltip_view.current_node.node_view !== undefined) {
									d.tooltip_view.current_node.node_view.unhighlightNode();
								}
							});
					});
				
				var d3stage = d3this.append("svg")
					.attr("class", "proactive-monitoring-main-stage")
					.attr("width", el_width)
					.attr("height", el_height)
					.append("g")
					.attr("transform", "translate(" + 20 + "," + 20 + ")scale(1,1)");
				
				//Set the drag scroll movement behavior for the d3stage
				var drag = d3.behavior.drag()
					.origin(Object)
					.on("dragstart", function() {
						$(this).parent().addClass("active-drag-move");
					})
					.on("dragend", function() {
						$(this).parent().removeClass("active-drag-move");
					})
					.on("drag", function(d,ii) {
						var d3this = d3stage;
						var transform = d3.transform(d3this.attr("transform"));
						var translate = transform.translate;
						translate[0] = translate[0] + d3.event.dx;
						translate[1] = translate[1] + d3.event.dy;
						d3this.attr("transform", transform.toString());
					});
				
				d3.select(this.$el.get(0)).select("svg.proactive-monitoring-main-stage").call(drag);
				
				return {
					el_size: {width: el_width, height: el_height},
					d3stage: d3stage,
					d3tooltip: d3tooltip
				};
			},
			updateView: function(viz, data) {
				if (data.parse_error) {
					console.error("[PMTree] Failed to parse data properly, cannot render tree.");
					if (data.hasOwnProperty("message")) {
						this.displayMessage(data.message);
					}
					else {
						this.displayMessage("parse-error");
					}
					return;
				}
				
				//Initialize the root centered
				this._centerTree(viz);
				var root = data.root_node;
				root.x0 = 0;
				root.y0 = 35;
				if (!this.applyPerfToTree()) {
					//This means that the perf data isn't ready, so just render the hierarchy
					this._renderTree(root, viz, data);
				}
				this.updateLegend();
			},
			/*
			 * Updates/renders the tree visualization to represent the current state of the data
			 * Here the root argument implies the place to center the animation on for new nodes.
			 */
			_renderTree: function(root, viz, data) {
				//Establish rendering helpers
				var duration = 300;
				var diagonal = d3.svg.diagonal();
				var tree_layout = data.tree_layout;
				var fixed_depth = this._getFixedDepth(viz);
				//FIXME: remove all tree_layout sizing in favor of node sizing
				//tree_layout.size([viz.el_size.width - 20, fixed_depth]);
				var nodes = tree_layout.nodes(data.root_node);
				var links = tree_layout.links(nodes);
				var that = this;
				
				//Render
				//Bind node layout data to the node g's
				var node = viz.d3stage.selectAll("g.pm-node.proactive-monitoring-parent-node")
					.data(nodes, function(d, ii) { return d.id || (d.id = ++ii); });
				
				//Add new nodes at root
				var node_enter = node.enter().append("g")
					.attr("class", "pm-node proactive-monitoring-parent-node")
					.attr("transform", function(d) { return "translate(" + root.x0 + "," + root.y0 + ") scale(0.2)"; })
					.each(function(d) {
						//Technically if a leaf node's parent has other parent nodes as children it may be rendered in this manner but it is fine
						d.node_view = new ParentNodeView({
							tree_controller: that
						});
						d.node_view.setElement(this);
					})
					.on("click", this._toggleChildren.bind(this))
					.on("mouseover", function(d) {
						if (d.id === "__ENV__:__ROOT__") {
							return;
						}
						var d3this = d3.select(this);
						var node_transform = d3.transform(d3this.attr("transform"));
						var offset = [node_transform.translate[0], node_transform.translate[1]];
						that.tooltip_show_timeout = setTimeout(function() {that._showNodeTooltip(d, offset);}, 350);
					})
					.on("mouseout", function(d) {
						if (d.id === "__ENV__:__ROOT__") {
							return;
						}
						clearTimeout(that.tooltip_show_timeout);
						that._hideNodeTooltip(d);
					});
				
				//Remove old nodes view data
				var node_exit = node.exit()
					.each(function(d) {
						d.node_view = null;
					});
				
				//Update all nodes
				var node_update = node
					.each(function(d) {
						if (d.node_view !== null) {
							d.node_view.render(d);
						}
					})
					.transition()
					.duration(duration)
					.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
				
				
				node_exit.transition()
					.duration(duration)
					.attr("transform", function(d) { return "translate(" + root.x + "," + root.y + ")  scale(0.2)"; })
					.remove();
				
				//Handle Links
				var link = viz.d3stage.selectAll("path.pm-link")
					.data(links, function(d) { return d.target.id; });
				
				link.enter().insert("path", "g")
					.attr("class", "pm-link")
					.attr("d", function(d) {
						var o = {x: root.x0, y: root.y0};
						return diagonal({source: o, target: o});
					});
				
				link.transition()
					.duration(duration)
					.attr("d", diagonal);
				
				link.exit().transition()
					.duration(duration)
					.attr("d", function(d) {
						var o = {x: root.x, y: root.y};
						return diagonal({source: o, target: o});
					})
					.remove();
				
				//Mark all positions for future use
				nodes.forEach(function(d) {
					d.x0 = d.x;
					d.y0 = d.y;
				});
				
				//Save off visible nodes for rendering purposes
			},
			//Helper function for getting the fixed depth of the tree
			_getFixedDepth: function(viz) {
				var available_height = viz.el_size.height;
				if (available_height > 300) {
					available_height = 300;
				}
				return available_height;
			},
			//Binding for showing the tooltip for any node
			_showNodeTooltip: function(d, offset) {
				//Set our tokens
				this.settings.set("tooltip_tree_token", d.tree);
				this.settings.set("tooltip_node_token", d.node_id);
				
				//Calculate the position for the tooltip
				var container_transform = d3.transform(this._viz.d3stage.attr("transform"));
				var tooltip_position = [((offset[0] + 20) * container_transform.scale[0]) + container_transform.translate[0], ((offset[1] - 15) * container_transform.scale[1]) + container_transform.translate[1]];
				
				var tooltip = this._viz.d3tooltip;
				var tooltip_view = tooltip.data()[0].tooltip_view;
				tooltip_view.showDetail(d, this.settings.get("metric"), this.settings.get("tooltip_earliest"), this.settings.get("tooltip_latest"));
				tooltip.style("display", "block").style("opacity", "1e-6");
				tooltip.style("left", String(tooltip_position[0])+"px").style("top", String(tooltip_position[1])+"px");
				tooltip.transition()
					.style("opacity","1");
			},
			//Binding for hiding the tooltip for any node
			_hideNodeTooltip: function(d) {
				var tooltip = this._viz.d3tooltip;
				tooltip.transition()
					.duration(300)
					.style("opacity","1e-6")
					.transition()
					.duration(2)
					.style("display", "none")
					.each("end", function(d) {
						//Unhighlight the hovered node
						if (d.tooltip_view.current_node !== undefined && d.tooltip_view.current_node.node_view !== null && d.tooltip_view.current_node.node_view !== undefined) {
							d.tooltip_view.current_node.node_view.unhighlightNode();
						}
					});
			},
			//Binding for showing and hiding children for any node
			_toggleChildren: function(d, ii) {
				if (d3.event.defaultPrevented) {
					//click suppressed due to drag
					return;
				}
				d3.event.stopPropagation();
				
				if (d.expanded) {
					d.expanded = false;
				}
				else {
					d.expanded = true;
				}
				if (d.penultimate) {
					d.node_view.toggleChildren(d);
				}
				this._renderTree(d, this._viz, this._data);
			},
			//Binding to layout resizing
			onLayoutResize: function() {
				if (this._data !== null && this._viz !== null) {
					this._updateViz();
					this.updateView(this._viz, this._data);
				}
			},
			//Update the viz object with the current dimensions of the svg viewport
			_updateViz: function() {
				var el_width = this.$el.width();
				var el_height = this.$el.height();
				d3.select(this.$el.get(0)).select("svg.proactive-monitoring-main-stage")
					.attr("width", el_width)
					.attr("height", el_height);
				this._viz.el_size = {width: el_width, height: el_height};
			},
			/*
			 * ================================================================
			 * LEGEND EVENT HANDLERS
			 * ================================================================
			 */
			updateLegend: function() {
				if (this._viz === undefined || this._viz === null || !this._viz.hasOwnProperty("d3stage")) {
					console.log("PMTree failed to set legend due to lack of viz");
					return;
				}
				var metric = this.settings.get("metric");
				var entity_type = this.settings.get("leaf_type");
				
				var entity_threshold_info = this.threshold_data[entity_type] || {};
				var threshold_info = entity_threshold_info["p_" + metric];
				if (threshold_info !== null && threshold_info !== undefined) {
					this.$(".pm-tree-legend-undefined-container").hide();
					
					var $legend = this.$(".pm-tree-legend-container");
					
					$(".pm-tree-legend-comparator", $legend).text(threshold_info.comparator);
					$(".pm-tree-legend-critical.pm-tree-legend-label ", $legend).text(threshold_info.critical);
					$(".pm-tree-legend-warning.pm-tree-legend-label ", $legend).text(threshold_info.warning);
					
					$legend.show();
				}
				else {
					this.$(".pm-tree-legend-container").hide();
					this.$(".pm-tree-legend-undefined-container").show();
				}
			},
			/*
			 * ================================================================
			 * TREE CONTROLS EVENT HANDLERS
			 * ================================================================
			 */
			zoomInTree: function(e) {
				//Prevent any propagation or text highlighting
				e.preventDefault();
				e.stopPropagation();
				console.log("PMTree zoom in called on tree");
				
				this._zoomTree(1.25);
			},
			zoomOutTree: function(e) {
				//Prevent any propagation or text highlighting
				e.preventDefault();
				e.stopPropagation();
				console.log("PMTree zoom out called on tree");
				
				this._zoomTree(0.8);
			},
			/*
			 * Scrolling Zoom presented a lot of compatibility problems on browsers and mice, so screw it
				scrollZoomTree: function(e) {
					//Prevent any propagation or text highlighting
					e.preventDefault();
					e.stopPropagation();
					console.log("PMTree scroll zoom called on tree");
					
					var zoom_factor = 0;
					var wheel_delta = e.originalEvent.wheelDelta;
					if (wheel_delta > 0) {
						zoom_factor = 0.2 * Math.abs(wheel_delta / 12);
					}
					else if (wheel_delta < 0) {
						zoom_factor = -0.2 * Math.abs(wheel_delta / 12);
					}
					
					this._zoomTree(zoom_factor);
				},
			*/
			//Abstract the zoom method for use in multiple callbacks
			_zoomTree: function(zoom_factor) {
				if (this._viz === undefined || this._viz === null || !this._viz.hasOwnProperty("d3stage")) {
					console.log("PMTree failed to zoom due to lack of d3stage in viz");
					return;
				}
				var d3stage = this._viz.d3stage;
				var transform = d3.transform(d3stage.attr("transform"));
				var scale = transform.scale;
				scale[0] = scale[0] * zoom_factor;
				scale[1] = scale[1] * zoom_factor;
				d3stage.transition().attr("transform", transform.toString());
			},
			centerTree: function(e) {
				//Prevent any propagation or text highlighting
				e.preventDefault();
				e.stopPropagation();
				console.log("PMTree center called on tree");
				this._centerTree(this._viz);
			},
			// Abstract method for usage in updateView as well as center binding
			_centerTree: function(viz) {
				if (viz === undefined || viz === null || !viz.hasOwnProperty("d3stage")) {
					console.log("PMTree failed to center due to lack of d3stage in viz");
					return;
				}
				var d3stage = viz.d3stage;
				var transform = d3.transform(d3stage.attr("transform"));
				var scale = transform.scale;
				scale[0] = 1;
				scale[1] = 1;
				
				var translate = transform.translate;
				translate[0] = (viz.el_size.width - 40) / 2;
				translate[1] = 35;
				
				d3stage.transition().attr("transform", transform.toString());
			},
			/*
			 * ================================================================
			 * PERFORMANCE DATA BINDINGS
			 * ================================================================
			 */
			formatPerfResults: function(results_model) {
				if (!results_model) { 
					return {fields: [],
						rows: [[]],
						parse_error: true
						};
				}
				// First try the legacy one, and if it isn't there, use the real one.
				var outputMode = this.output_mode || this.outputMode;
				var data_type = this.data_types[outputMode];
				var data = results_model.data();
				var rows = data[data_type];
				
				var id_index = _.indexOf(data.fields, this.settings.get("id_field"));
				var tree_index = _.indexOf(data.fields, this.settings.get("tree_field"));
				var threshold_index_index = _.indexOf(data.fields, "threshold_index");
				
				return {
					id_index: id_index,
					tree_index: tree_index,
					threshold_index_index: threshold_index_index,
					rows: rows,
					fields: data.fields
				};
			},
			/*
			 * Left-joins the hierarchy data to the performance data. If it 
			 * could not complete due to lack of data it returns false, 
			 * otherwise it returns true. 
			 */
			applyPerfToTree: function() {
				if (this.perf_data === null || this._isPerfJobDone === false) {
					console.log("[PMTree] (1) Cannot Apply Performance Data to Tree: performance data is not available", this);
					return;
				}
				else if (this._viz === null || this._viz === undefined || this._data === null || this._data === undefined || !this._data.hasOwnProperty("tree_manifest")) {
					console.log("[PMTree] (2) Cannot Apply Performance Data to Tree: hierarchy data is not available", this._viz, this._data, this._data.hasOwnProperty("tree_manifest"));
					return;
				}
				var tree_manifest = this._data.tree_manifest;
				//Reset everyone to unknown in case they are not represented in the performance data
				_.each(tree_manifest, function(node_manifest, tree, tree_manifest) {
					//Update the node manifest entries to unknown
					_.each(node_manifest, function(node, node_id, node_manifest) {
						node.value = [0, 0, 0, 1];
					});
				});
				console.log("DV - applyPerfToTree", tree_manifest, this._data.tree_manifest)
				var ii, row, tree, node_id, threshold_index, value, node_manifest, node;
				for (ii = 0; ii < this.perf_data.rows.length; ii++ ) {
					row = this.perf_data.rows[ii];
					tree = row[this.perf_data.tree_index];
					node_id = row[this.perf_data.id_index];
					threshold_index = row[this.perf_data.threshold_index_index];
					value = [0, 0, 0, 0];
					value[threshold_index] = 1;
					node_manifest = tree_manifest[tree];
					if (node_manifest === undefined || node_manifest === null) {
						console.log("[PMTree] (3) Cannot apply performance data to tree: could not find node manifest for tree "+ tree, tree_manifest, row);
					}
					else {
						node = node_manifest[node_id];
						if (node === undefined || node === null) {
							console.log("[PMTree] (4) Cannot apply performance data to node: could not find node for id " + node_id + " in tree " + tree);
						}
						else {
							node.value = value;
						}
					}
				}
				
				//Aggregate the value arrays
				this._aggregateNodeValues(this._data.root_node);
				
				//Render the pretty colors!
				this._renderTree(this._data.root_node, this._viz, this._data);
				return true;
			},
			/*
			 * Recursively calculates the aggregated value array for a 
			 * particular root node (note will all children as a side effect).
			 * If the view exists call the bake pie method on it. 
			 * Returns the value array for the root.
			 */
			_aggregateNodeValues: function(root) {
				var value;
				if (root._children === null) {
					value = root.value;
				}
				else {
					value = _.reduce(root._children, function(memo, node) { 
							var child_value = this._aggregateNodeValues(node);
							memo[0] = memo[0] + child_value[0];
							memo[1] = memo[1] + child_value[1];
							memo[2] = memo[2] + child_value[2];
							memo[3] = memo[3] + child_value[3];
							return memo;
						}, [0, 0, 0, 0], this);
				}
				root.value = value;
				if (root.node_view !== null && root._children !== null) {
					root.node_view.bakePie(root);
					if (root.penultimate && root.expanded) {
						root.node_view.updateChildren(root);
					}
				}
				return value;
			},
			_onPerfManagerChange: function(managers, manager) {
				// Called when our associated perf manager changes. Updates
				// listeners on the new manager and its associated
				// results model.
				
				if (this.perf_manager) {
					this.perf_manager.off(null, null, this);
					this.perf_manager = null;
				}
				if (this.perf_results_model) {
					this.perf_results_model.off(null, null, this);
					this.perf_results_model.destroy();
					this.perf_results_model = null;
				}
				
				this.perf_manager = manager;
				if (!manager) {
					this.displayMessage('no-search', null, this.settings.get("perf_message_container"));
					return;
				}
				
				// Clear any messages, since we have a new manager.
				this.displayMessage("empty", null, this.settings.get("perf_message_container"));
				
				// First try the legacy one, and if it isn't there, use the real one.
				var outputMode = this.output_mode || this.outputMode;
				this.perf_results_model = this.perf_manager.data(this.settings.get("data") || "preview", _.extend({
					output_mode: outputMode,
					count: this.returnCount,
					offset: this.offset
				}, this.resultOptions));
				
				manager.on("search:start", this._onPerfSearchStart, this);
				manager.on("search:progress", this._onPerfSearchProgress, this);
				manager.on("search:cancelled", this._onPerfSearchCancelled, this);
				manager.on("search:error", this._onPerfSearchError, this);
				manager.on("search:fail", this._onPerfSearchFailed, this);
				this.perf_results_model.on("data", this._onPerfDataChanged, this);
				this.perf_results_model.on("error", this._onPerfSearchError, this);
				this._checkPerfManagerState();
				
				manager.replayLastSearchEvent(this);
			},
			_checkPerfManagerState: function() {
				// A splunk search job that has ended with no valid result
				// will not generate the events necessary to display
				// failure messages. Check for that here.
				var manager = this.perf_manager;
				if (!manager) {
					return;
				}
				
				if ((!manager.job) && (manager.lastError)) {
					this._onPerfSearchError(manager.lastError);
					return;
				}
				
				if (!manager.job) {
					return;
				}
				
				var state = manager.job.state();
				
				if (state && state.content && ((state.content.isDone) || (state.content.isFailed))) {
					this._onPerfSearchProgress(state);
					return;
				}
			},
			_onPerfDataChanged: function() {
				if (!this.perf_results_model.hasData()) {
					if (this._isPerfJobDone) {
						this.displayMessage('no-results-performance', null, this.settings.get("perf_message_container"));
					}
					return;
				}
				console.log("DV - _onPerfDataChanged", this.perf_results_model)
				this.perf_data = this.formatPerfResults(this.perf_results_model);
				console.log("DV - _onPerfDataChanged - After", this.perf_data)
				this.applyPerfToTree();
				this.displayMessage('empty', null, this.settings.get("perf_message_container"));
			},
			_onPerfSearchProgress: function(properties) {
				properties = properties || {};
				var content = properties.content || {};
				var previewCount = content.resultPreviewCount || 0;
				var isJobDone = this._isPerfJobDone = content.isDone || false;
	
				if (previewCount === 0) {
					this.displayMessage(isJobDone ? 'no-results-performance' : 'waiting', null, this.settings.get("perf_message_container"));
					return;
				}
			},
			_onPerfSearchStart: function() {
				this._isPerfJobDone = false;
				this.perf_data = null;
				this.displayMessage('waiting', null, this.settings.get("perf_message_container"));
			},
			_onPerfSearchCancelled: function() {
				this._isPerfJobDone = false;
				this.displayMessage('cancelled', null, this.settings.get("perf_message_container"));
			},
			_onPerfSearchError: function(message, err) {
				this._isPerfJobDone = false;
				var msg = Messages.getSearchErrorMessage(err) || message;
				this.displayMessage({
					level: "error",
					icon: "warning-sign",
					message: msg
				}, null, this.settings.get("perf_message_container"));
			},
			_onPerfSearchFailed: function(state, job) {
				var msg = Messages.getSearchFailureMessage(state);
				this.displayMessage({
					level: "error",
					icon: "warning-sign",
					message: msg
				}, null, this.settings.get("perf_message_container"));
			}
		});
		
		return Tree;
	});
