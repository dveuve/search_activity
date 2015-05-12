/*
 * The PMParentNodeView creates the visual display of a parent node in the tree
 */

define(["underscore", "jquery", "pm/contrib/d3/d3.amd", "backbone",
	"pm/PMLeafNodeView", "css!pm/PMParentNode.css"], 
	function (_, $, d3, Backbone, LeafNodeView) {
		var ParentNode = Backbone.View.extend({
			tagName: "g",
			className: "proactive-monitoring-parent-node",
			options: {
				tree_controller: undefined,
				parent_node_r: 13,
				penultimate_parent_node_r: 11.5,
				colors: {
					critical: "#C44545",
					warning: "#DE9400",
					normal: "#57A116",
					unknown: "#D5D5D5"
				},
				color_scale: d3.scale.ordinal().domain(d3.range(4)).range(["#C44545", "#DE9400", "#57A116", "#D5D5D5"]),
				node_labels: {
					HostSystem: "",
					ClusterComputeResource: "",
					RootFolder: "",
					VirtualMachine: ""
				},
				unselected_stroke_width: 1,
				selected_stroke_width: 2,
				unselected_stroke: "#FFFFFF",
				selected_stroke: "#000000",
				label_rotation: -35,
				ring_width: 5
			},
			first_render: true,
			initialize: function(options) {
				this.tree_controller = options.tree_controller;
				Backbone.View.prototype.initialize.apply(this, arguments);
				//Custom event binding to the dispatcher goes here
			},
			/*
			 * idempotently render the content of the parent node
			 */
			render: function(data) {
				var d3g = d3.select(this.$el.get(0));
				var that = this;
				var name_label;
				
				//Handle the Environment Node special
				if (data.id === "__ENV__:__ROOT__") {
					if (this.first_render) {
					//Custom rendering for the environment node
						name_label = d3g.append("text")
							.attr("text-anchor", "middle")
							.attr("font-size", "16px")
							.text("Environment");
						
						this.first_render = false;
					}
				}
				else {
					//Create elements on first render only
					var radius = data.penultimate ? this.options.penultimate_parent_node_r : this.options.parent_node_r;
					if (this.first_render) {
						//Make the pie g
						d3g.append("g")
							.attr("class", "donut");
						//FIXME: needs to make this work with nodes being selected/unselected
						//Make Node Circle
						d3g.append("circle")
							.attr("r", radius)
							.attr("fill", this.options.colors.unknown)
							.attr("stroke", this.options.unselected_stroke)
							.attr("stroke-width", this.options.unselected_stroke_width);
						
						//Make Type Label
						d3g.append("text")
							.attr("class", "node-label")
							.attr("dy", "5px")
							.text(this.options.node_labels[data.type]);
						
						//Make Name Label
						name_label = d3g.append("text")
							.attr("class", "name-label")
							.attr("x", radius + this.options.unselected_stroke_width + this.options.ring_width + 4)
							.attr("transform", "rotate(" + this.options.label_rotation + ")")
							.text(data.name);
						
						//Check on the status of children
						this.toggleChildren(data);
						
						//Bake the pie!
						this.bakePie(data);
						
						this.first_render = false;
					}
					
					//Handle the value based rendering
					var value_index = this._getValueIndex(data.value);
					
					//Update the circle fill
					d3g.select("circle").attr("fill", this.options.color_scale(value_index));
				}
			},
			_getValueIndex: function(value) {
				//Handle the value based rendering
				var value_index;
				if (value[0] > 0) {
					value_index = 0;
				}
				else if (value[1] > 0) {
					value_index = 1;
				}
				else if (value[2] > 0) {
					value_index = 2;
				}
				else {
					value_index = 3;
				}
				return value_index;
			},
			bakePie: function(data) {
				//Do not render a ring for things without children or if our pie is marked baked
				if (data._children !== null && data._children.length > 0) {
					var d3g = d3.select(this.$el.get(0));
					var value_index = this._getValueIndex(data.value);
					var radius = data.penultimate ? this.options.penultimate_parent_node_r : this.options.parent_node_r;
					
					//Bake the pie
					var pie_data;
					if (value_index === 3 && data.value[3] === 0) {
						//If there just isn't perf data fake some data
						pie_data = [0, 0, 0, 1];
					}
					else {
						pie_data = data.value;
					}
					var pie_outer_radius = radius + this.options.unselected_stroke_width + this.options.ring_width - 1;
					var d3pie_g = d3g.select("g.donut");
					this._bakePie(d3pie_g, pie_data, pie_outer_radius);
				}
			},
			/* 
			 * Bake the donut-pie chart into the g
			 * -> d3g should be the g in which to draw the pie
			 * -> data should be the value array to form the pie
			 * -> outer_radius is the outer radius of the donut
			 */
			_bakePie: function(d3g, data, outer_radius) {
				//Bake the Pie!
				var donut = d3.layout.pie().sort(null);
				var color_scale = this.options.color_scale;
				var ring_width = this.options.ring_width;
				var arc = d3.svg.arc()
					.outerRadius(outer_radius)
					.innerRadius(outer_radius - ring_width);
				
				//Put the slices in
				var arcs = d3g.selectAll("g.arc")
					.data(donut(data));
				
				var arcs_enter = arcs.enter().append("g")
					.attr("class", "arc");
				
				//Color them
				arcs_enter.append("path")
					.attr("fill", function(d, i) { return color_scale(i); });
				
				//Update
				arcs.select("path").attr("d", arc);
				
				//Remove old we have a static array length of 4 so there should never be anything to remove, this is a no op
				//arcs.exit().remove();
			},
			/*
			 * Render the leaf children of a penultimate node
			 * Accepts the hierarchy data structure as an arg
			 */
			toggleChildren: function(d) {
				//Little bit of validation
				if (!d.penultimate) {
					return;
				}
				
				if (d._children.length === 0) {
					console.log("[PMParentNode] cannot expand penultimate node with no children");
					return;
				}
				
				//Check what we are toggling, note that the expanded prop is 
				//set by our caller, so we just respect whatever it tells us to do
				var d3g = d3.select(this.$el.get(0));
				var base_vertical_displacement = 7;
				var leaf_height = 17;
				var leaf_padding_bottom = 2;
				var leaf_padding_left = 13;
				var that = this;
				var d3g_children, leaf_node, leaf_bar;
				if (d.expanded) {
					//Create a children container
					d3g_children = d3g.append("g")
						.attr("class", "proactive-monitoring-leaf-container")
						.attr("transform", "translate(0," + (this.options.penultimate_parent_node_r + this.options.unselected_stroke_width + this.options.ring_width) + ")");
					
					//Create vertical bar
					leaf_bar = d3g_children.append("rect")
						.attr("width", 1)
						.attr("height", 1)
						.attr("fill", "#D4D3D4");
					
					//Create the lead nodes
					leaf_node = d3g_children.selectAll("g.proactive-monitoring-leaf-node")
						.data(d._children, function(d, ii) { return d.id || (d.id = ++ii); });
					
					var leaf_node_enter = leaf_node.enter().append("g")
						.attr("class", "proactive-monitoring-leaf-node")
						.attr("transform", "translate(" + leaf_padding_left + "," + base_vertical_displacement + ") scale(0.2)")
						.each(function(d) {
							d.node_view = new LeafNodeView();
							d.node_view.setElement(this);
							d.node_view.render(d);
						})
						.on("click", function() {
							//Prevent parent expand collapse
							d3.event.stopPropagation();
						})
						.on("mouseover", function(d) {
							//Prevent parent tooltip
							d3.event.stopPropagation();
							var d3this = d3.select(this);
							var parent_transform = d3.transform(d3g.attr("transform"));
							var node_transform = d3.transform(d3this.attr("transform"));
							var offset = [node_transform.translate[0] + parent_transform.translate[0], node_transform.translate[1] + parent_transform.translate[1] + 10];
							that.tree_controller._showNodeTooltip(d, offset);
						})
						.on("mouseout", function(d) {
							//Prevent parent tooltip
							d3.event.stopPropagation();
							that.tree_controller._hideNodeTooltip(d);
						});
					
					//Transition everybody
					leaf_bar.transition()
						.attr("height", base_vertical_displacement + (leaf_height + leaf_padding_bottom) * (d._children.length -1 ));
					
					var getValueIndex = this._getValueIndex;
					var sorted_children = _.sortBy(d._children, function(node) {
							return getValueIndex(node.value);
						});
					var findIndexOfNode = function(list, test_id) {
							for (var ii = 0; ii < list.length; ii++) {
								var node = list[ii];
								if (node.id === test_id) {
									return ii;
								}
							}
						};
					
					leaf_node.transition()
						.attr("transform", function(d, ii) {
							var node_id = d.id;
							var sorted_index = findIndexOfNode(sorted_children, node_id);
							return "translate(" + leaf_padding_left + "," + (base_vertical_displacement + (leaf_height + leaf_padding_bottom) * sorted_index) + ") scale(1)";
						});
				}
				else {
					//Collapse the things
					d3g_children = d3g.select("g.proactive-monitoring-leaf-container");
					leaf_node = d3g_children.selectAll("g.proactive-monitoring-leaf-node");
					//Wipe out old views
					leaf_node.each(function(d) {
							d.node_view = null;
						});
					
					//Transition and remove
					leaf_node.transition()
						.attr("transform", "translate(" + leaf_padding_left + ",0) scale(0.2)")
						.remove();
					leaf_bar = d3g_children.selectAll("rect").transition()
						.attr("height", 1)
						.remove()
						.each("end", function() {
							//Remove the entire container at the end
							d3g_children.remove();
						});
					
				}
				
			},
			/*
			 * When performance data is updated we need to be able to just reorder and color the children
			 */
			updateChildren: function(d) {
				if (d.expanded) {
					var d3g = d3.select(this.$el.get(0));
					var base_vertical_displacement = 7;
					var leaf_height = 17;
					var leaf_padding_bottom = 2;
					var leaf_padding_left = 13;
					var d3g_children = d3g.select("g.proactive-monitoring-leaf-container");
					var leaf_node = d3g_children.selectAll("g.proactive-monitoring-leaf-node")
						.data(d._children, function(d, ii) { return d.id || (d.id = ++ii); });
					
					var getValueIndex = this._getValueIndex;
					var sorted_children = _.sortBy(d._children, function(node) {
							return getValueIndex(node.value);
						});
					var findIndexOfNode = function(list, test_id) {
							for (var ii = 0; ii < list.length; ii++) {
								var node = list[ii];
								if (node.id === test_id) {
									return ii;
								}
							}
						};
					
					//Update Colors
					leaf_node.each(function(d) { d.node_view.render(d); });
					//Update position
					leaf_node.transition()
						.attr("transform", function(d, ii) {
							var node_id = d.id;
							var sorted_index = findIndexOfNode(sorted_children, node_id);
							return "translate(" + leaf_padding_left + "," + (base_vertical_displacement + (leaf_height + leaf_padding_bottom) * sorted_index) + ") scale(1)";
						});
				}
			},
			highlightNode: function() {
				var d3this = d3.select(this.$el.get(0));
				d3this.select("circle").attr("stroke", this.options.selected_stroke);
				d3this.select("circle").attr("stroke-width", this.options.selected_stroke_width);
			},
			unhighlightNode: function() {
				var d3this = d3.select(this.$el.get(0));
				d3this.select("circle").attr("stroke", this.options.unselected_stroke);
				d3this.select("circle").attr("stroke-width", this.options.unselected_stroke_width);
			}
		});
		
		return ParentNode;
	});
