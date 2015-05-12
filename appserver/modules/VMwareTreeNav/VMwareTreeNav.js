/* Rules
 * 1. No commas in field names.
 * 2. No null values for fields.
 */


Splunk.Module.VMwareTreeNav = $.klass(Splunk.Module.DispatchingModule, {
	initialize: function($super, container) {
		$super(container);
		//Set up internal variables
		this.tElement = $('.ui-tree', this.container);
		this.storeName = this.getParam("varName");
		this.varTemplate = this.getParam("varTemplate");
		this.joinTemplate = this.getParam("joinTemplate");
		this.firstLoad = true;
		
		//Handle Custom Parameters
		if (this.getParam("limitSelectionType") != "False") {
			this.selectableElem = 'div.ui-tree-node.' + this.getParam("limitSelectionType").toLowerCase() + '-node';
			this.selectableCancel = ",div.ui-tree-node:not(." + this.getParam("limitSelectionType").toLowerCase() + '-node)';
		}
		else {
			this.selectableElem = 'div.ui-tree-node';
			this.selectableCancel = "";
		}
		this.selectLimit = isNaN(parseInt(this.getParam("limitSelectionCount"))) ? 50 : parseInt(this.getParam("limitSelectionCount"));
		//Apply Style
		$(this.container).attr("style",this.getParam("style"));
		
		//Context flow gates
		this.doneUpstream = false;
		this.gettingResults = false;

		//Set up set of fields we need to tell splunk that we need
		this.requiredFields = ["moid", "type"];
		
		//Bind Control UI functions and make them purrrrty
		$(".ui-tree-button", this.container).button();
		$(".ui-tree-buttonset", this.container).buttonset();
		$('.ui-tree-deselect-all', this.container).click(function() {
			$(".ui-tree-node",$(this).parent().parent()).removeClass("ui-selected");
		});
		$('.ui-tree-set-selection',this.container).click(this.handleSetSelectionClick.bind(this));
		$('.ui-tree-expand-all',this.container).click(this.handleExpandAllClick.bind(this));
		$('.ui-tree-collapse-all',this.container).click(this.handleCollapseAllClick.bind(this));
		$('.ui-tree-searchbar',this.container).keyup(this.handleSearchbarInput.bind(this));
	},
	//##################################################################################################
	
	// UTILITY FUNCTIONS
	
	//##################################################################################################
	handleSetSelectionClick: function() {
		//Little bit of splunk app framework magic here, push context to children
		//will call getModifiedContext by default which is where we actually call the setSelection
		this.pushContextToChildren();
	},
	handleExpandAllClick: function() {
		//Basically we just expand all the nodes, nothing really cool here
		$("span.ui-icon-parent",this.tElement).each( function() {
			var $this = $(this);
			if ($this.hasClass("noel-icon-plus")) {
				$this.removeClass("noel-icon-plus");
				$this.addClass("noel-icon-minus");
				$(".ui-tree-container:first",$this.parent().parent()).slideDown("fast");
			}
		});
	},
	handleCollapseAllClick: function() {
		//Basically we just collapse all the nodes, nothing really cool here
		$("span.ui-icon-parent",this.tElement).each( function() {
			var $this = $(this);
			if ($this.hasClass("noel-icon-minus")) {
				$this.removeClass("noel-icon-minus");
				$this.addClass("noel-icon-plus");
				$(".ui-tree-container:first",$this.parent().parent()).slideUp("fast");
			}
		});
	},
	/**
	* This is the event handler for people entering or removing text from the search bar.
	* It performs a search ONLY on the leaf nodes of the tree hiding those that do not 
	* have a full or partial match. If it detects the value to be an empy string it 
	* immediately shows all leaf nodes. It does this by the assignment of the search 
	* match/nomatch classes to the node box for the element.
	*/
	handleSearchbarInput: function() {
		var searchString = $('.ui-tree-searchbar',this.container).val();
		if (searchString == "") {
			$('.ui-tree-node-leaf',this.container).parent().removeClass("ui-search-nomatch");
		}
		else {
			var re = new RegExp(SOLN.escapeStringForRegExp(searchString), "i");
			$('.ui-tree-node-leaf',this.tElement).each( function() {
				var $this = $(this);
				if ($this.text().match(re)) {
					$this.parent().removeClass("ui-search-nomatch");
				}
				else {
					$this.parent().addClass("ui-search-nomatch");
				}
			});
		}
	},
	/**
	* This method does the work of actually setting the selected items in the context
	* It will set a token for each type: vc, datacenter, cluster, host, virtualmachine
	* based on the parameters of moidTemplate and joinTemplate
	*/
	setSelection: function() {
		if ($(".ui-tree-node",this.tElement).length == 0) {
			//If there's no nodes don't do any work, this prevents saved values from being
			//clobbered on refresh
			return this.getContext();
		}
		
		var context = this.getContext();
		
		//Handle Virtual Machines
		var solndata = [];
		var vmMoids = [];
		$(".ui-selected.virtualmachine-node",this.tElement).each(function() {
			$this = $(this);
			vmMoids.push($this.attr("id"));
			solndata.push(JSON.parse($this.attr("solndata")));
		});
		var vmVal = this.applyTemplatesToIDs(solndata);
		SOLN.storeVariable("selectedVirtualMachine", null,vmVal, context);
		this.storeIndividualTemplatesToIDs(solndata, "selectedVirtualMachine", context);
		//Handle Host Systems
		var solndata = [];
		var hostMoids = [];
		$(".ui-selected.hostsystem-node",this.tElement).each(function() {
			$this = $(this);
			hostMoids.push($this.attr("id"));
			solndata.push(JSON.parse($this.attr("solndata")));
		});
		var hostVal = this.applyTemplatesToIDs(solndata);
		SOLN.storeVariable("selectedHostSystem", null,hostVal, context);
		this.storeIndividualTemplatesToIDs(solndata, "selectedHostSystem", context);
		//Handle Clusters
		var solndata = [];
		var clusterMoids = [];
		$(".ui-selected.clustercomputeresource-node",this.tElement).each(function() {
			$this = $(this);
			clusterMoids.push($this.attr("id"));
			solndata.push(JSON.parse($this.attr("solndata")));
		});
		var clusterVal = this.applyTemplatesToIDs(solndata);
		SOLN.storeVariable("selectedClusterComputeResource", null,clusterVal, context);
		this.storeIndividualTemplatesToIDs(solndata, "selectedClusterComputeResource", context);
		//Handle DataCenters
		var solndata = [];
		var dcMoids = [];
		$(".ui-selected.datacenter-node",this.tElement).each(function() {
			$this = $(this);
			dcMoids.push($this.attr("id"));
			solndata.push(JSON.parse($this.attr("solndata")));
		});
		var dcVal = this.applyTemplatesToIDs(solndata);
		SOLN.storeVariable("selectedDatacenter", null,dcVal, context);
		this.storeIndividualTemplatesToIDs(solndata, "selectedDatacenter", context);
		//Handle Virtual Centers
		var solndata = [];
		var vcMoids = [];
		$(".ui-selected.rootfolder-node",this.tElement).each(function() {
			$this = $(this);
			vcMoids.push($this.attr("id"));
			solndata.push(JSON.parse($this.attr("solndata")));
		});
		var vcVal = this.applyTemplatesToIDs(solndata);
		SOLN.storeVariable("selectedRootFolder", null,vcVal, context);
		this.storeIndividualTemplatesToIDs(solndata, "selectedRootFolder", context);
		
		//Store selection into local storage for state persistence
		//Note that we store the literal moid array in case the templates change
		var treeSelection = { selectedVirtualMachineIDs: vmMoids,
			selectedHostSystemIDs: hostMoids,
			selectedClusterComputeResourceIDs: clusterMoids,
			selectedDatacenterIDs: dcMoids,
			selectedRootFolderIDs: vcMoids
		};
		SOLN.stickSelection(this.storeName, treeSelection);
		//To accommodate calling this function both by natural context flow and by some other means
		//we explicitly set the base context to our now variable filled context object. This will
		//make this context available by this.getContext(), in addition we return the context
		this.baseContext = context;
		return context;
	},
	applyTemplatesToIDs: function(solndata) {
		//This will take the array and return a string of the id template 
		//and join template applied to the array
		var varTemplate = this.varTemplate;
		var joinTemplate = ' ' + this.joinTemplate + ' ';
		var temp = [];
		for (var ii = 0; ii< solndata.length; ii++) {
			targetVars = solndata[ii]
			temp[ii] = varTemplate.replace(/\$host\$/g, targetVars.host);
			temp[ii] = temp[ii].replace(/\$moid\$/g, targetVars.moid);
		}
		return temp.join(joinTemplate);
	},
	storeIndividualTemplatesToIDs: function(solndata, varName, context) {
		//This will take the array and store unqiue fields values under varName.fieldname
		var varTemplate = this.varTemplate;
		var joinTemplate = ' ' + this.joinTemplate + ' ';
		var temp1 = [];
		var temp2 = [];
		for (var ii = 0; ii< solndata.length; ii++) {
			targetVars = solndata[ii]
			temp1[ii] = '"' + targetVars.host + '"';
			temp2[ii] = '"' + targetVars.moid + '"';
		}
		SOLN.storeVariable(varName, "host", temp1.join(joinTemplate), context);
		SOLN.storeVariable(varName, "moid", temp2.join(joinTemplate), context);
	},
	applySelectionToIDs: function(moids) {
		//This is a convenience method that will apply the ui-selected class to all elements with
		//id matching an id in the passed array of ids
		if (moids) {
			for (var ii = 0; ii< moids.length; ii++) {
				//MEID by default contains a nasty char for selectors, thus we use core js to find the element
				$(document.getElementById(moids[ii])).addClass("ui-selected");
			}
		}
		else {
			console.log("[VMwareTreeNav] invalid data stored in local storage, this will be corrected on refresh and selection set.");
		}
	},
	//##################################################################################################
	
	// MODULE FUNCTIONS
	
	//##################################################################################################
	onContextChange: function() {
		var context = this.getContext();
		if (context.get("search").job.isDone()) {
			this.getResults();
		} else {
			this.doneUpstream = false;
		}
	},
	onJobDone: function(event) {
		this.getResults();
	},
	getResultParams : function($super) {
		//Pass the module configuration to the controller
		params = this._params
		var search = this.getContext().get("search")
		var sid = search.job.getSID();
		var postProcess = search.getPostProcess();
		params['sid'] = sid;
		if (postProcess) {
			params['postProcess'] = postProcess;
		}
		return params;
	},
	getResults: function($super) {
		this.doneUpstream = true;
		this.gettingResults = true;
		return $super();
	},
	renderResults: function(markup) {
		//Set markup
		var context = this.getContext();
		this.tElement.html(markup);
		var limit = this.selectLimit; //getting around variable scope isaes with the this
		this.tElement.selectable({ filter: SOLN.replaceVariables(this.selectableElem, context).toLowerCase(), 
			cancel: 'span.noel-icon' + SOLN.replaceVariables(this.selectableCancel, context).toLowerCase(),
			selecting: function(event, ui) { 
				if ($(".ui-selected, .ui-selecting").length > limit) {
					$(ui.selecting).removeClass("ui-selecting");
				}
			}
		});
		
		//Bind Tree UI functions
		$("span.ui-icon-parent",this.tElement).click( function() {
			var $this = $(this);
			if ($this.hasClass("noel-icon-plus")) {
				$this.removeClass("noel-icon-plus");
				$this.addClass("noel-icon-minus");
				$(".ui-tree-container:first",$this.parent().parent()).slideDown("fast");
			}
			else {
				$this.removeClass("noel-icon-minus");
				$this.addClass("noel-icon-plus");
				$(".ui-tree-container:first",$this.parent().parent()).slideUp("fast");
			}
		});
		
		var urlHost = SOLN.getVariableValue("selectedHostSystem",context);
		var urlVM = SOLN.getVariableValue("selectedVirtualMachine",context);
		var urlCluster = SOLN.getVariableValue("selectedClusterComputeResource",context);
		//If this is first load then get the selected from url if it is there (only vm and host supported, meh and cluster)
		if (this.firstLoad && (urlHost || urlVM || urlCluster)) {
			this.firstLoad = false;
			if (urlHost) {
				$(document.getElementById(urlHost)).addClass("ui-selected");
			}
			if (urlVM) {
				$(document.getElementById(urlVM)).addClass("ui-selected");
			}
			if (urlCluster) {
				$(document.getElementById(urlCluster)).addClass("ui-selected");
			}
		}
		else {
			//Get state of selection from local storage
			var storedData = SOLN.pullSelection(this.storeName);
			if (storedData) {
				//Apply selections to the current tree
				this.applySelectionToIDs(storedData["selectedVirtualMachineIDs"]);
				this.applySelectionToIDs(storedData["selectedHostSystemIDs"]);
				this.applySelectionToIDs(storedData["selectedClusterComputeResourceIDs"]);
				this.applySelectionToIDs(storedData["selectedDatacenterIDs"]);
				this.applySelectionToIDs(storedData["selectedRootFolderIDs"]);
				//Now we rely on push context to children to call get modified and actually set the vars
			}
		}
		
		if ($(".ui-selected",this.tElement).length == 0) {
			//There is nothing selected so we select the first selectable element
			$(SOLN.replaceVariables(this.selectableElem, context).toLowerCase() + ":first", this.tElement).addClass("ui-selected");
		}
		
		//Handle selection as items are selected
		//$("div.ui-tree-node",this.tElement).bind("selected", handleSelected)
		//$("div.ui-tree-node",this.tElement).bind("unselected", handleUnselected)

		//Context Control
		this.gettingResults = false;
		this.pushContextToChildren();
	},
	getModifiedContext: function() {
		//We determine the selection and store the variables in an isolated method
		// that returns the modified context
		return this.setSelection();
	},
	requiresDispatch: function($super, context) {
		return $super(context);
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
		return $super();
	},
	resetUI: function() {} //Just so splunk stops bitching at me
});
