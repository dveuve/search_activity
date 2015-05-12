/*
 * The PMLeafNodeView creates the visual display of leaf nodes in the tree
 */

define(["underscore", "jquery", "pm/contrib/d3/d3.amd", "backbone", "css!pm/PMLeafNode.css"], 
	function (_, $, d3, Backbone, LeafNodeCSS) {
		var LeafNode = Backbone.View.extend({
			tagName: "g",
			className: "proactive-monitoring-leaf-node",
			options: {
				leaf_node_r: 8.5,
				colors: {
					critical: "#C44545",
					warning: "#DE9400",
					normal: "#57A116",
					unknown: "#808080"
				},
				color_scale: d3.scale.ordinal().domain(d3.range(4)).range(["#C44545", "#DE9400", "#57A116", "#808080"]),
				node_labels: {
					HostSystem: "",
					ClusterComputeResource: "",
					RootFolder: "",
					VirtualMachine: ""
				},
				unselected_stroke_width: 1,
				selected_stroke_width: 2,
				unselected_stroke: "#D4D3D4",
				selected_stroke: "#FFFFFF"
			},
			first_render: true,
			initialize: function() {
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
				
				//Create elements on first render only
				if (this.first_render) {
					//TODO: needs to make this work with nodes being selected/unselected
					//Make Node Circle
					d3g.append("circle")
						.attr("class", "pm-leaf-node-emphasis-highlight")
						.attr("r", this.options.leaf_node_r + 1)
						.attr("fill", this.options.colors.unknown)
						.attr("stroke", "#000000")
						.attr("stroke-width", 2)
						.attr("opacity", 1e-6);
					d3g.append("circle")
						.attr("class", "pm-leaf-node-marker")
						.attr("r", this.options.leaf_node_r)
						.attr("fill", this.options.colors.unknown)
						.attr("stroke", this.options.unselected_stroke)
						.attr("stroke-width", this.options.unselected_stroke_width);
					
					//Make Type Label
					d3g.append("text")
						.attr("class", "node-label")
						.attr("dy", "4px")
						.text(this.options.node_labels[data.type]);
					
					//Make Name Label
					name_label = d3g.append("text")
						.attr("class", "name-label")
						.attr("x", this.options.leaf_node_r + this.options.selected_stroke_width + 4)
						.attr("dy", "3px")
						.text(function(data) { 
							if (data.name.length > 24) {
								//Display only upto 16 chars of the name label
								var short_name = data.name.substr(0, 20);
								return short_name.concat('...'); 
							} else {
								return data.name;
							}
						});
					
					this.first_render = false;
				}
				
				//Handle the value based rendering
				var value_index;
				if (data.value[0] > 0) {
					value_index = 0;
				}
				else if (data.value[1] > 0) {
					value_index = 1;
				}
				else if (data.value[2] > 0) {
					value_index = 2;
				}
				else {
					value_index = 3;
				}
				
				//Update the circle fill
				d3g.select("circle.pm-leaf-node-marker").attr("fill", this.options.color_scale(value_index));
			},
			highlightNode: function() {
				var d3g = d3.select(this.$el.get(0));
				d3g.select("circle.pm-leaf-node-marker").attr("stroke", this.options.selected_stroke);
				d3g.select("circle.pm-leaf-node-emphasis-highlight").attr("opacity", 1);
			},
			unhighlightNode: function() {
				var d3g = d3.select(this.$el.get(0));
				d3g.select("circle.pm-leaf-node-marker").attr("stroke", this.options.unselected_stroke);
				d3g.select("circle.pm-leaf-node-emphasis-highlight").attr("opacity", 1e-6);
			}
		});
		
		return LeafNode;
	});
