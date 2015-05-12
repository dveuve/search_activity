// Adding "unique" function to Array's core functionality to fetch unique elements of an array
Array.prototype.unique = function() {
	var arr = this;
	return $.grep(arr, function(v, i) {
		return $.inArray(v, arr) === i;
	});
};

Splunk.Module.SOLNSelector = $.klass(Splunk.Module.DispatchingModule,{
	initialize : function($super, container) {
		$super(container);

		// Set up internal variables
		this.idFields = this.getParam("idFields").split(",");
		this.storeName = this.getParam("varName");
		this.varTemplate = this.getParam("varTemplate");
		this.joinTemplate = this.getParam("joinTemplate");
		this.defaultValue = this.getParam("defaultValue");
		this.suggestionsLimit = Number(this.getParam("suggestionsLimit"));
		this.selectionLimit = this.getParam("limitSelectionCount");
		this.pathFields = this.getParam("pathFields");
		this.readStructures = this.getParam("readStructures");
		//required for host vm perf view
		this.hostVm = this.getParam("hostVm");
		this.wilcardSelection=false;
		this.hostVmdata={};
		// Used only for Host VM Perf
		this.selectedEntity="";
		this.firstLoad = true;
		
		this.typingTimer=null;
		this.doneTypingInterval=5000;
		// Start UI for HOST VM PERF VIEW 
		if (this.hostVm !== null) {
			this.types = this.hostVm;
			$('.solnselector-toggle-group', this.container).html(
			"<a class='btn btn_host active ui-corner-left' >host</a><a class='btn btn_vm ui-corner-right'>vm</a>");
			this.pathFields = "host,grandParentName,parentName";
			this.entityTypeVar = this.getParam("entityTypeVar");
			this.entityLabelVar = this.getParam("entityLabelVar");

			$('.solnselector-toggle-group', this.container).show();
			if ($('.btn_host', this.container).hasClass(
			'active')) {
				this.selectedEntity = "host";
			} else {
				this.selectedEntity = "vm";
				this.entityLabel = "Virtual Machine";
			}
		} else {
			$('.solnselector-toggle-group', this.container).hide();
			this.types = this.getParam("types");
		}
		
		//END UI for HOST VM PERF VIEW 
		
		this.types = this.types.split(",");
		this.pathFields = this.pathFields.split(",");
		this.selections = {};
		
		// Hash to keep count of vms with same name but different full path. A very rare case.
		this.selectedNames = {};
		
		this.nameHash = {};
		
		// Boolean to check if the search is char level or word level
		this.isEntitySearch = false;
		
		this.T = {};
		this.fullPathNames = [];
		this.allKeys = {};
		this.allSuffixKeys=[];
		this.keyIIT={};

		// Hashes for idFileds
		for ( var i = 0; i < this.idFields.length; i++) {
			var hashName = this.idFields[i] + "Hash";
			this[hashName] = {};
		}
		this.allCharIIT = {};
		this.entityIIT = {};
		this.liSelected = {};
		this.selectedTypeHash = {};
		// Apply Style
		$(this.container).attr("style", this.getParam("style"));

		// Context flow gates
		this.doneUpstream = false;
		this.gettingResults = true;

		// Set up set of fields we need to tell splunk that we
		// need
		this.requiredFields = this.idFields;
		
		//Button Action Bindings

		$('.ui-tree-set-selection', this.container).click(
				this.handleSetSelectionClick.bind(this));

		$('.solnselector-input', this.container).keyup(this.runAutocompletetimeout.bind(this));
		

		$('.btn_host', this.container).click(this.clickHostToggle.bind(this));

		$('.btn_vm', this.container).click(
				this.clickVmToggle.bind(this));

		$('.solnselector-result', this.container).hide();
		$(document).click(function(e){
			if(e.target.className!=="ui-tree-set-selection ui-tree-button"){
				$('.solnselector-result', this.container).hide();
			}
		});
		

		
		$('.solnselector-autocomplete-input', this.container).keyup(
				this.runAutocomplete.bind(this));
		$('.SOLNTextInput', this.container).click(function(e){
				e.stopPropagation();
		});


	},
	runAutocompletetimeout: function(evt){
		// Don't apply timeout if keys are "down", "up", "tab", "enter" or "forward slash"
		var arrowKeys= [38, 40, 9, 13, 191];
		if(arrowKeys.indexOf(evt.which)!==-1){
			this.runAutocomplete(evt);
		}else{
			window.clearTimeout(this.typingTimer);
			var thisObj=this;
			this.typingTimer=window.setTimeout(function(){
				thisObj.runAutocomplete(evt);
				}, 500);
		}
	},
	
	// ##################################################################################################
	// UTILITY FUNCTIONS
	// ##################################################################################################
	/***
	 * Only needed for HOST VM PERF 
	 * Click action when host toggle button is selected
	 */
	
	clickHostToggle : function() {
		if (this.selectedEntity === "host") {
			return;
		} else {
			$('.solnselector-input', this.container).val("");
			$('.btn_host', this.container).addClass('active');
			$('.btn_vm', this.container).removeClass('active');
			this.selectedEntity = "host";
			this.allKeys = {};
			this.fullPathNames = [];
			this.allCharIIT = {};
			this.entityIIT = {};
			this.liSelected = {};
			this.selectedTypeHash = {};
			this.selections = {};
			this.nameHash = {};
			if(this.readStructures!=="1"){
				this.preProcessData(this.hostVmdata);
			}
			this.addtoSelection("");
			this.pushContextToChildren();
		}
	},
	/***
	 * Only needed for HOST VM PERF 
	 * Click action when VM toggle button is selected
	 */
	clickVmToggle : function() {
		if (this.selectedEntity === "vm") {
			return;
		} else {
			$('.solnselector-input', this.container).val("");
			$('.btn_vm', this.container).addClass('active');
			$('.btn_host', this.container).removeClass('active');
			this.selectedEntity = "vm";
			this.fullPathNames = [];
			this.allKeys = {};
			this.allCharIIT = {};
			this.entityIIT = {};
			this.liSelected = {};
			this.selectedTypeHash = {};
			this.selections = {};
			this.nameHash = {};
			if(this.readStructures!==1){
				this.preProcessData(this.hostVmdata);
			}
			this.addtoSelection("");
			this.pushContextToChildren();
		}
	},
	handleSetSelectionClick : function() {
		// Little bit of splunk app framework magic here, push
		// context to children
		// will call getModifiedContext by default which is
		// where we actually call the setSelection
		if ($('.solnselector-input', this.container).val() !== "") {
			this.pushContextToChildren();
		}
	},

	/**
	 * Validates the Input entered in the textbox by checking if
	 * it is present in Full path Hash map. Adds red border top
	 * the text box if validation fails
	 */
	validateInput : function(inputStr) {
		//var idHash = this.idFields[0] + "Hash";
		if(inputStr.slice(-1)==="/"){
			inputStr = inputStr.substring(0, inputStr.length - 1);
		}
		if(inputStr[0]!=="/"){
			inputStr= "/"+inputStr;
		}
		if(this.readStructures==="1"){
			var input = {};
		    input['inputStr']=inputStr.trim();
			input['hostVm']= this.selectedEntity;
			input['datatype']=this.types[0];
			var validation=false;
			var customEndPtUrl=  Splunk.util.make_url('custom', 'search_activity', 'read_structures_service', 'search_activity','validate_input') ;
			$.ajax({
				type: "GET",
				url:customEndPtUrl,
				data:input,
				async:false,
				success:function(res) {
					if($.parseJSON(res)===1){
						validation=true;
					}
				},
				error: function(jqXHR,textStatus,errorThrown) {
					console.log("[read_structures_service] AJAX Failure on validating selected entity");
				}
			  });
			if (!validation) {
				$('.solnselector-input', this.container).addClass('ui-state-error');
				return false;
			} else {
				$('.solnselector-input', this.container).removeClass('ui-state-error');
				return true;
			}}else{
				var idHash = this.idFields[0] + "Hash";
				if (!this[idHash].hasOwnProperty(inputStr.trim())) {
					$('.solnselector-input', this.container).addClass('ui-state-error');
					return false;
				} else {
					$('.solnselector-input', this.container).removeClass('ui-state-error');
					return true;
				}
			}
		
	},
	/***
	 * Only needed for HOST VM PERF 
	 * Removes the selected entity from the Selection List 
	 */
	removeSelection : function(evt) {
		var event = evt || window.event;
		var text = event.currentTarget.parentElement.textContent;
		$(event.currentTarget.parentElement).remove();
		delete this.selections[this.nameHash[text]];
		if(text.indexOf("#")!==-1){
			this.selectedNames[text.split("#")[0]]--;
			if(this.selectedNames[text.split("#")[0]] === 0){
				delete this.selectedNames[text.split("#")[0]];
			}
		}
		this.pushContextToChildren();
	},
	/***
	 * Only needed for HOST VM PERF 
	 * Creates Selection List and is called by render_data method 
	 */
	createSelectionList : function() {
		var $listcontainer =  this.container.parent().next();
		for( var key in this.selections){
			if(key !== "") {
			var splitStrings=key.split("/");	
			var html = $('.selectionList', $listcontainer ).html() + "<span class='SOLNSelector'><a class='btn btnLabel ui-corner-left'>" + splitStrings[splitStrings.length -1]+ "</a><a class='btn remove_btn ui-corner-right'><i class='icon-x'/></a></span>";
			var $libtn = $('.selectionList' , $listcontainer).html(html);
			var entityName = splitStrings[splitStrings.length-1];
			if(this.nameHash[entityName]===undefined){
				this.nameHash[entityName] = key;
				this.selectedNames[entityName]=1;
			}else{
				
				this.selectedNames[entityName]++;
				this.nameHash[entityName+"#"+this.selectedNames[entityName]]= key;
			}
			var removedText = "";
			$('.remove_btn', $listcontainer).click(
					this.removeSelection.bind(this));
		}
		}
	},
	/***
	 * Only needed for HOST VM PERF 
	 * Adds new selection to the Selection List
	 */
	addtoSelection : function(val) {
		var $listcontainer =  this.container.parent().next();
		if (this.selectionLimit >= Object.keys(this.selections).length) {
			if(val === "") {
				$('.selectionList', $listcontainer).html("");
				return;
			}
			var splitStrings=val.split("/");
			var html = $('.selectionList', $listcontainer).html() + 
			"<span class='SOLNSelector'><a class='btn btnLabel ui-corner-left'>"+
			splitStrings[splitStrings.length-1]+ 
			"</a><a class='btn remove_btn ui-corner-right'><i class='icon-x'/></a></span>";
			
			var entityName= splitStrings[splitStrings.length-1];
			if(this.nameHash[entityName]===undefined){
				this.nameHash[entityName] = val;
				this.selectedNames[entityName]=1;
			}else{
				
				this.selectedNames[entityName]++;
				this.nameHash[entityName+"#"+this.selectedNames[entityName]]= val;
			}

			$('.selectionList',$listcontainer).html(html);
			var removedText = "";
			$('.remove_btn', $listcontainer).click(
					this.removeSelection.bind(this));
		}
	},
	/**
	 * This method does the work of actually setting the
	 * selected items in the context It will set a token for
	 * each type: vc, datacenter, cluster, host, virtualmachine
	 * based on the parameters of moidTemplate and joinTemplate
	 */
	setSelection : function() {
		var inputVal = $(".solnselector-input", this.container).val();
		if(this.hostVm === null){
			this.selections = {};
		}
		var context = this.getContext();
		if (inputVal!==undefined && inputVal !== "") {
			if (!this.validateInput(inputVal)) {
				return this.getContext();
			}
		}
		if (this.hostVm !== null && inputVal !== "") {
			if (this.selections[inputVal] === undefined) {
				this.addtoSelection(inputVal);
				//$('.input', this.container).val("");
			}
			
		}
		if(inputVal!=="" && this.selections[inputVal] === undefined){
			this.selections[inputVal] = 1;
		}
		if(this.hostVm!==null){
			$('.solnselector-input', this.container).val("");
			$('.solnselector-autocomplete-input', this.container).val("");
			$('.solnselector-input', this.container).focus();
		}
		

		var varTemplate = this.varTemplate;
		// initialize an object we will later use for sticky
		// selections
		var selection = {};
		// Handle all types
		var curType, solndata, curIds, nodeSelector;
		var push_soln_data = function() {
			var $this = $(this);
			curIds.push($this.attr("id"));
			solndata.push(JSON.parse($this.attr("solndata")));
		};

		for ( var ii = 0; ii < this.types.length; ii++) {
			curType = this.types[ii];
			solndata = [];
			curIds = [];
		/*	if(this.hostVm!=null){
				curType= this.storeName;
				
			}*/
			var kk = 0, k=0;
			var solndataObject = {};
			for( var key in this.selections){
				if(this.readStructures!=="1"){
					if(key.substr(-1) === '/') {
						key= key.substr(0, key.length-1);
				    }
					solndataObject = {};
					for ( k = 0; k < this.idFields.length; k++) {
						var idHash = this.idFields[k] + "Hash";
						solndataObject[this.idFields[k]] = this[idHash][key];
					}
					if (solndataObject !== undefined) {
						selection[curType] = solndataObject.host + "-"+ solndataObject.moid;
					}
					solndata[kk] = solndataObject;
					kk++;
				}else{
					solndataObject = {};
					if(key.substr(-1) === '/') {
						key= key.substr(0, key.length-1);
				    }
					var input={};
					input['key']=key.trim();
					input['hostVm']= this.selectedEntity;
					input['datatype']=this.types[0];
					var idKeys={};
					var customEndPtUrl=  Splunk.util.make_url('custom', 'search_activity', 'read_structures_service', 'search_activity','get_id_keys');
					var ajxRqst= $.ajax({
						type: "GET",
						url: customEndPtUrl,
						data:input,
						async:false,
						success:function(res) {
							if(res!==null){
								idKeys= $.parseJSON(res);
							}
						}
					});
					for( k = 0; k < this.idFields.length; k++){
						solndataObject[this.idFields[k]] = idKeys[this.idFields[k]];
					}
					if (solndataObject !== undefined) {
						selection[curType] = solndataObject.host + "-"+ solndataObject.moid;
					}
					solndata[kk] = solndataObject;
					kk++;
				}

			}
			var appVarVal = this.applyTemplatesToIDs(solndata);
			var appVarName = "selected" + curType;
			if (appVarVal === "") {
				var defaultTemplate = varTemplate;
				for ( var jj = 0; jj < this.idFields.length; jj++) {
					var curField = this.idFields[jj];
					var res = "\\$" + curField + "\\$";
					var reo = new RegExp(res, "g");
					defaultTemplate = defaultTemplate.replace(
							reo, this.defaultValue);
				}
				appVarVal = defaultTemplate;
			}
			SOLN.storeVariable(appVarName, null, appVarVal,context);

			this.storeIndividualTemplatesToIDs(solndata,appVarName, context);
			this.storeIndividualTemplatesToIDsNOQUOTES(solndata, appVarName, context);

			
		}

		// Store selection into local storage for state
		// persistence
		// Note that we store the literal element id array in
		// case the templates change
		SOLN.stickSelection(this.storeName, selection);
		if (this.hostVm !== null) {
			var selectedEntityLabel = "Host System";
			if (this.selectedEntity === "vm") {
				selectedEntityLabel = "Virtual Machine";
			} else {
				selectedEntityLabel = "Host System";
			}
			if (this.entityTypeVar !== null) {
				SOLN.storeVariable(this.entityTypeVar, null,
						this.selectedEntity, context);
			}
			if (this.entityLabelVar !== null) {
				SOLN.storeVariable(this.entityLabelVar, null,
						selectedEntityLabel, context);
			}
			SOLN.stickSelection(this.storeName + "List",
					this.selections);
			SOLN.stickSelection(this.entityTypeVar,
					this.selectedEntity);
		}
		// To accommodate calling this function both by natural
		// context flow and by some other means
		// we explicitly set the base context to our now
		// variable filled context object. This will
		// make this context available by this.getContext(), in
		// addition we return the context
		//this.pushContextToChildren();
		this.gettingResults = false;
		this.baseContext = context;
		return context;
	},
	applyTemplatesToIDs : function(solndata) {
		// This will take the array and return a string of the
		// id template
		// and join template applied to the array
		var varTemplate = this.varTemplate;
		var joinTemplate = ' ' + this.joinTemplate + ' ';
		var temp = [];
		var targetVars;
		for ( var ii = 0; ii < solndata.length; ii++) {
			targetVars = solndata[ii];
			temp[ii] = varTemplate;
			for ( var jj = 0; jj < this.idFields.length; jj++) {
				var curField = this.idFields[jj];
				var res = "\\$" + curField + "\\$";
				var reo = new RegExp(res, "g");
				if (targetVars === undefined|| targetVars[curField] === undefined || targetVars[curField].length === 0) {
					targetVars[curField] = [ this.defaultValue ];
				}
				temp[ii] = temp[ii].replace(reo,
						targetVars[curField]);
			}
		}

		return temp.join(joinTemplate);
	},
	storeIndividualTemplatesToIDs : function(solndata, varName,context) {
		// This will take the array and store unique fields
		// values under varName.fieldname
		var varTemplate = this.varTemplate;
		var joinTemplate = ' ' + this.joinTemplate + ' ';
		var tempObj = {};
		var ii;
		var jj;
		var curField;
		var targetVars;
		// initialize the tempObj with by idField arrays that
		// solndata will then build up
		for (jj = 0; jj < this.idFields.length; jj++) {
			curField = this.idFields[jj];
			tempObj[curField] = [];
		}
		for (ii = 0; ii < solndata.length; ii++) {
			targetVars = solndata[ii];
			for (jj = 0; jj < this.idFields.length; jj++) {
				curField = this.idFields[jj];
				tempObj[curField][ii] = '"'+
				targetVars[curField] + '"';
			}
		}
		for (jj = 0; jj < this.idFields.length; jj++) {
			curField = this.idFields[jj];
			if (targetVars === undefined ||
					targetVars[curField] === undefined || 
					targetVars[curField].length === 0) {
				tempObj[curField] = [ this.defaultValue ];
			}
			SOLN.storeVariable(varName, curField, tempObj[curField].join(joinTemplate), context);
		}
	},
	storeIndividualTemplatesToIDsNOQUOTES : function(solndata,varName, context) {
		// This will take the array and store unique fields
		// values under varName.fieldname
		var varTemplate = this.varTemplate;
		var joinTemplate = ' ' + this.joinTemplate + ' ';
		var tempObj = {};
		var jj;
		var ii;
		var curField;
		var targetVars;
		// initialize the tempObj with by idField arrays that
		// solndata will then build up
		for (jj = 0; jj < this.idFields.length; jj++) {
			curField = this.idFields[jj];
			tempObj[curField] = [];
		}
		for (ii = 0; ii < solndata.length; ii++) {
			targetVars = solndata[ii];
			for (jj = 0; jj < this.idFields.length; jj++) {
				curField = this.idFields[jj];
				tempObj[curField][ii] = targetVars[curField];
			}
		}
		for (jj = 0; jj < this.idFields.length; jj++) {
			curField = this.idFields[jj];
			if (tempObj[curField] === undefined || tempObj[curField].length === 0) {
				tempObj[curField] = [ this.defaultValue ];
			}
			SOLN.storeVariable(varName, curField + ".raw",
					tempObj[curField].join(joinTemplate),
					context);
		}
	},
	/**
	 * Performs Word level Autocompletion. Splits the input
	 * string by "/" and look for individual entities in
	 * entityIIT to gather matches Input(searchString): String
	 * entered in the Input text box Output(matches): Array of
	 * matches
	 */
	findPossibleSuggestions : function(searchString) {
		var matches=[];
		var totalCount=0;
		if(this.readStructures==="1"){
			var input={};
			input['searchString']=searchString;
			input['hostVm']= this.selectedEntity;
			
			input['datatype']=this.types[0];
			var customEndPtUrl=  Splunk.util.make_url('custom', 'search_activity', 'read_structures_service', 'search_activity','find_possible_matches');
			$.ajax({
				type: "GET",
				url:customEndPtUrl,
				data:input,
				async:false,
				success:function(res) {
					if(res!==null){
						matches= $.parseJSON(res);
						if(matches!==null){
							totalCount=matches.length;
						}else{
							matches=[];
							}
					}
				},
				error: function(jqXHR,textStatus,errorThrown) {
					console.log("[read_structures_service] AJAX Failure on finding possible fullpath matches for the search string");
				}
			});
			return [matches,totalCount];
		}
		// Split on "/"
		var searchEntities = searchString.split("/");

		var matchingArrs = [];

		// Search for individual entities in entityIIT and form
		// match array for each entity.
		for ( var i = 0; i < searchEntities.length; i++) {
			var searchEntity = searchEntities[i];
			if (searchEntity !== "" && searchEntity!=="*") {
				var match = this.entityIIT[searchEntities[i]];
				if (match === undefined) {
					return [];
				}
				matchingArrs.push(match);
			}
		}

		// Perform intersection on matching arrays to get
		// accurate
		// suggestions
		if (matchingArrs.length > 0) {
			matchingArrs.sort(function(a, b) {
				return a.length - b.length;
			});
			var results = matchingArrs.shift().reduce(
					function(res, v) {
						if (res.indexOf(v) === -1 &&
								matchingArrs.every(function(a) {
									return a.indexOf(v) !== -1;
								})) {
							res.push(v);
						}
						return res;
					}, []);
			if(results){
				totalCount= results.length;
			}
			for ( i = 0; i<this.suggestionsLimit &&  i<results.length; i++) {
				matches.push(this.fullPathNames[results[i]]);
			}
		}

		return [matches, totalCount];
	},
	/**
	 * Creates Results Listbox Input(matches): List of all the
	 * suggestions that would appear in the list box
	 */
	createSuggestionList : function(matches, matchesCount) {
		matches = matches.unique();
		if (matches.length > 0) {
			//Set the autocomplete gray text
			var inputText= $('.solnselector-input', this.container).val();
			if(matches[0].indexOf(inputText)===0){
				$('.solnselector-autocomplete-input', this.container).val(matches[0]);
				$('.solnselector-input', this.container).focus();
			}
			var html = "<ul class=\"SOLNSelector-ul scroll-group ui-menu\" style=\"padding:0px;\" role=\"listbox\" >";
			var moreMatches = false;
			var matchlen = matches.length;
			if (matchesCount > this.suggestionsLimit) {
				moreMatches = true;
				matchlen = this.suggestionsLimit;
			}
			for ( var i = 0; i < matchlen; i++) {
				//var splitStrings = matches[i].match(/([^\/]*)(.*)/);
				var splitStrings= matches[i].split("/");
				var path = splitStrings.slice(0,splitStrings.length-1).join("/") +"/";
				if (splitStrings.length > 1) {
					html += "<li class=\"ui-menu-item clearfix\" ><a class=\"ui-widget \"> <span class=\"SOLNSelector\" style=\"color:gray;\">"+ 
					path + "</span><span style=\"color:#3399CC;float:right;\">" + splitStrings[splitStrings.length -1] + "</span></a></li>";

				} else {
					html += "<li class=\"ui-menu-item clearfix\" ><a class=\"ui-widget SOLNSelector\"   ><span style=\"font-size=100px;\">" + matches[i] + "</span></a></li>";
				}
			}
			if (moreMatches) {
				html += "<li>" + (matchesCount - this.suggestionsLimit)+ " more matches </li>";
			}
			html += "</ul>";
			$('.solnselector-result', this.container).html(html);
			//$('.SOLNSelector-ul', this.container).children("li:odd").css( "background-color", "#f5f5f5" );
			$('.SOLNSelector-ul', this.container).children("li:odd").addClass("oddItem");
			$('.solnselector-result', this.container).show();
		} else {
			$('.solnselector-result', this.container).hide();
			$('.solnselector-autocomplete-input', this.container).empty();
		}
	},
	addWilcardSelections : function(wilcardSelections){
		for(var i=0;i< wilcardSelections.length;i++){
			var selection = wilcardSelections[i];
			this.selections[$(selection).text()]=1;
			this.addtoSelection($(selection).text());
		}
		
		
	},
	/**
	 * This method handles Up, Down and Enter keys and returns
	 * false for other key events event : It is the kepress
	 * event sent from runAutoComplete method
	 */
	handleKeyPresses : function(event) {
		var liSelected = this.liSelected;
		// Enter Pressed on HOST VM Perf view with wild card "*" selection 
		if(event.which===13 && this.hostVm!==null && $(".solnselector-input", this.container).val().indexOf("*")!==-1 && !this.isEntitySearch){
			this.wilcardSelection=true;
			//$('.ui-menu-item > a', this.container).click();
			this.addWilcardSelections($('.ui-menu-item > a', this.container));
			this.wilcardSelection=false;
			$('.solnselector-input', this.container).val("");
			$('.solnselector-result', this.container).hide();
			this.gettingResults=false;
			this.pushContextToChildren();
			return true;
		}
		// return if result listbox is not open
		if((!this.isEntitySearch && event.which===13)){
			if(!$('.solnselector-result', this.container).is(':hidden') && $.isEmptyObject(liSelected)){
				$('.solnselector-result', this.container).hide();
				this.pushContextToChildren();
				return true;
			}
		}
		if ($('.solnselector-result', this.container).is(':hidden')) {
			if (event.which === 13 && !this.isEntitySearch ) {
				this.pushContextToChildren();
				return true;
			}		
			return false;
		}

		
		// Keycode: 40:Down, 38:Up, 13:Enter
		if (event.keyCode === 40) {
			$('.SOLNSelector-ul', this.container).children("li:odd").addClass("oddItem");
			if (!$.isEmptyObject(liSelected)) {
				
				$('a',liSelected).parent().removeClass('SOLNSelector-ui-hover-highlight');
				try{
					var next = this.liSelected.next();

					if (next.length > 0) {
						liSelected = next;
						$( 'a',liSelected).parent().removeClass('oddItem');
						$( 'a',liSelected).parent().addClass('SOLNSelector-ui-hover-highlight');
					} else {
						liSelected = $('.ui-menu-item',this.container).eq(0);
						$( 'a',liSelected).parent().removeClass('oddItem');
						$('a',liSelected).parent().addClass('SOLNSelector-ui-hover-highlight');
					}
				}catch(err){
					console.log('Couldnt find next element');
				}
			} else {
				liSelected = $('.ui-menu-item', this.container).eq(0);
				$( 'a',liSelected).parent().removeClass('oddItem');
				$('a', liSelected).parent().addClass('SOLNSelector-ui-hover-highlight');
			}
		} else if (event.which === 38) {
			$('.SOLNSelector-ul', this.container).children("li:odd").addClass("oddItem");
			if (liSelected) {
				try{
					$('a',liSelected).parent().removeClass('SOLNSelector-ui-hover-highlight');
					var prev = liSelected.prev();
					if (prev.length > 0) {
						liSelected = prev;
						$( 'a',liSelected).parent().removeClass('oddItem');
						$('a', liSelected).parent().addClass('SOLNSelector-ui-hover-highlight');
					} else {
						liSelected = $('.ui-menu-item',this.container).last();
						$( 'a',liSelected).parent().removeClass('oddItem');
						$('a', liSelected).parent().addClass('SOLNSelector-ui-hover-highlight');
					}
				}catch(exception){
					console.log('Couldnt find previous element');
				}
				}else {
					liSelected = $('.ui-menu-item', this.container).last();
					$( 'a',liSelected).parent().removeClass('oddItem');
					$('a',liSelected).parent().addClass('SOLNSelector-ui-hover-highlight');
				}
			
		} else if (event.which === 13) {
			liSelected = {};
			$('a', this.liSelected).click();
			this.liSelected = {};
		}else if(event.which ===9){
			liSelected = $('.ui-menu-item',this.container).eq(0);
			$('a', liSelected).click();
			this.liSelected={};
		}else {
			return false;
		}
		this.liSelected = liSelected;
		return true;
	},
	
	/**
	 *  Click action for entities
	 * */
	clickEntitySuggestion : function(evt) {
		var event = evt || window.event;
		var target = event.currentTarget;
		var $input = $('.solnselector-input', this.container);
		var value = $input.val().trim();
		var enStr = value.match(/[^\/]*$/);
		value = value.replace(/[^\/]*$/, $(target).text() + "/");
		$input.val(value);
		$('.solnselector-autocomplete-input', this.container).val(value);
		$('.solnselector-input', this.container).focus();
		$('.solnselector-result', this.container).hide();
		$input.keyup();
	},
	/**
	 *  Click action for non entities(full paths)
	 * */
	clickNonEntitySuggestion : function(evt) {
		var event = evt || window.event;
		var target = event.currentTarget;
		if (!$('.solnselector-result', this.container).is(':hidden')) {
			var $input = $('.solnselector-input', this.container);
			$input.val($(target).text().trim());
			//Hide results if the selection is not wilcard selection
			if(! this.wilcardSelection){
				$('.solnselector-result', this.container).hide();
			}


		}
		$('.ui-tree-set-selection', this.container).click();
	},
	/**
	 *  Hover action for Suggestions shown in results box
	 * */
	hoverActionOnMouse : function(evt) {
		var event = evt || window.event;
		if(event.type==="mouseenter"){
			var $this = $(event.currentTarget);
			$(this.liSelected).removeClass('SOLNSelector-ui-hover-highlight');
			$('.SOLNSelector-ul', this.container).children("li:odd").addClass("oddItem");
			this.liSelected={};
			$this.parent().removeClass("oddItem");
			$this.parent().addClass('SOLNSelector-ui-hover-highlight');
		}else if(event.type==="mouseleave"){
			var $this1 = $(event.currentTarget);
			$('.SOLNSelector-ul', this.container).children("li:odd").addClass("oddItem");
			$this1.parent().removeClass('SOLNSelector-ui-hover-highlight');			
		}
	},
	
	/**
	 * This method is run on a key press in Input text box. It
	 * handles key presses like SPACE, UP, Down, "/" and builds
	 * the Suggestion list box. It also provide hover and click
	 * action to listbox items
	 */
	runAutocomplete : function(evt) {
		// Remove Error class if user starts typing in Input
		// text box

		
		$('.solnselector-input', this.container).removeClass('ui-state-error');
		var event = evt || window.event;
		$('.solnselector-autocomplete-input', this.container).val("");
		$('.solnselector-input', this.container).focus();
		var currentElement = $("li:first", this.container);
		var matches = [], html = "";
		var searchString = $.trim($('.solnselector-input', this.container)
				.val());

		// Check for key presses on results listbox
		if (this.handleKeyPresses(event)) {
			return;
		}
		// Return if Ctrl Key presed
		if(evt.originalEvent && evt.originalEvent.keyIdentifier === "Meta"){
			return;
		}
		
		
		// Hide Character level Autocomplete suggestions in
		// Results listbox
		// if "/" is hit. A word level Autocomplete happens at
		// this point
		if (event.which === 191) {
			if (!$('.solnselector-result', this.container).is(':hidden')) {
				$('.solnselector-result', this.container).hide();
			}
		}

		// If SPACE pressed, show suggestions from entityChar
		// IIT
		// for character level autocomplete, else look for word
		// level match
		var enStr = searchString.match(/[^\/]*$/);
		// if(event.keyCode===32){
		this.isEntitySearch = false;
		var matchesCount=0;
		if (enStr[0] !== "" && enStr[0] !=="*") {
			// Do an entity search here
			this.isEntitySearch = true;
			matches = this.findMatches(this.allCharIIT, enStr[0],[]);
			// Prepare Suggestions list to show in Results
			// listbox
			this.createSuggestionList(matches[0], matches[1]);
		} else {
			this.isEntitySearch = false;
			matches = this.findPossibleSuggestions(searchString);
			// Prepare Suggestions list to show in Results
			// listbox
			this.createSuggestionList(matches[0], matches[1]);
		}

		// Provide Hover action to links in the Results listbox
		$('a ', '.solnselector-result').hover(this.hoverActionOnMouse.bind(this));

		// Click action for listbox items in the listbox
		if (this.isEntitySearch) {
			$('a','.solnselector-result').click(this.clickEntitySuggestion.bind(this));
		} else {
			$('a ','.solnselector-result').click(this.clickNonEntitySuggestion.bind(this));
		}
		if(matches[1]===1){
			var $results= $('.solnselector-result', this.container);
			$('a.ui-widget', $results).click();
		}
		// Reset flags
		this.liSelected = {};
	},

	/**
	 * Add keys to Character level Inverted Index Trees Input
	 * word- key that needs to be broken down into substrings
	 * Substrings will be added to keyIIT Inverted Index Tree
	 */
	addtoKeyIndex: function(word){
		this.allSuffixKeys.push(word);
		var localHashForDups={};
		for(var i=1;i<word.length-1;i++){
			for(var j=word.length;j>i;j--){	
				var substr= word.substring(i, j);
				if(localHashForDups.hasOwnProperty(substr)){
					continue;
				}else{
					localHashForDups[substr]=1;
				}
				if(this.keyIIT.hasOwnProperty(substr)===false){
					this.keyIIT[substr]=[];
					this.keyIIT[substr].push(this.allSuffixKeys.length-1);
				}else{
					if(this.keyIIT[substr].length<this.suggestionsLimit){
						this.keyIIT[substr].push(this.allSuffixKeys.length-1);
					}else{
						break;
					}
				}
			}

		}
	},
	/**
	 * Builds Prefix tree with all the prefixes
	 * for each key in 'keys' added to IIT
	 * T 
	 */
	buildSuffixTree: function(keys){
		var T={};
		for(var i=0;i<keys.length;i++){
			var key= keys[i];
			this.addtoKeyIndex(key);
			var keysCreated=false;
			
			for(var j=key.length;j>0;j--){
				var word=key.substring(0, j);
				if(T.hasOwnProperty(word)===false){
					T[word]=[];
					if(keysCreated===false){
						keysCreated=true;
					}		
					T[word].push(i);
				}else{
					var keyPts=T[word];
					if(keyPts.length<this.suggestionsLimit){
						keyPts.push(i);
					}else{
						//this.addtoKeyIndex(word);
						break;
					}
				}
			}
		}
		return T;
	},
	/**
	 * Finds matches at character level in an Inverted Index
	 * tree Input(T): Inverted Index tree Input(searchString):
	 * String to be matched Input(keys): Hashmap that maps
	 * locations in T to Strings
	 */
	findMatches : function(T, searchString, matches) {
		//var matches = [];
		var totalCount=0, keyArr=[];
		
		if(this.readStructures==="1"){
			var input={};
			input['searchString']=searchString;
			input['hostVm']= this.selectedEntity;
			input['datatype']=this.types[0];
			totalCount=0;
			var customEndPtUrl=  Splunk.util.make_url('custom', 'search_activity', 'read_structures_service', 'search_activity','find_matches');
			$.ajax({
				type: "GET",
				url:customEndPtUrl,
				data:input,
				async:false,
				success:function(res) {
					if(res!==null){
						matches= $.parseJSON(res);
						if(matches!==null){
							totalCount=matches.length;
						}else{
							matches=[];
						}
					}
				},
				error: function(jqXHR,textStatus,errorThrown) {
					console.log("[read_structures_service] AJAX Failure on finding matches for the search string");
				}
			});
			return [matches,totalCount];
		}
		var i=0;
		if(T.hasOwnProperty(searchString)===true){
			keyArr = T[searchString];
			
			if (keyArr !== undefined) {
				//keyArr = keyArr.unique();
				totalCount=keyArr.length;
				for ( i = 0; i < keyArr.length && i<this.suggestionsLimit; i++) {
					matches.push(this.allKeys[keyArr[i]]);
				}
			}
			return [matches, totalCount];
		}else{
			if(this.keyIIT.hasOwnProperty(searchString)===false){
				return [[], 0];
			}else{
				keyArr=this.keyIIT[searchString];
				totalCount=0;
				for (i = 0; i < keyArr.length && matches.length<this.suggestionsLimit; i++) {
					var suffixString=this.allSuffixKeys[keyArr[i]];
					var matchArr=T[suffixString];
					totalCount+=matchArr.length;
					for(var j=0;j<matchArr.length && matches.length<this.suggestionsLimit;j++){
						matches.push(this.allKeys[matchArr[j]]);
					}
				}
				return [matches,totalCount ];
			}
		}
		
	},
	/**
	 * Builds Word level Inverted Index Tree from list of
	 * Strings. This method splits strings by "/" and put words
	 * into the Index tree Input(pathNames): List of Strings
	 * where each String
	 */
	buildEntityIndex : function(pathNames) {
		var enIndex = {}, combinedIIT = {};
		for ( var i = 0; i < pathNames.length; i++) {
			var pathName = pathNames[i];
			var entityArr = pathName.split("/");
			var combinedword = "";
			for ( var j = 0; j < entityArr.length; j++) {
				var word = entityArr[j];
				if (word !== undefined) {
					if (enIndex.hasOwnProperty(word) === false) {
						enIndex[word] = [];
						enIndex[word].push(i);
					} else {
						var keyPts = enIndex[word];
					//	if(keyPts<this.suggestionsLimit){
						keyPts.push(i);
					//	}
					}
				}
			}
		}
		return enIndex;
	},
	preProcessData : function(data) {
		// create required datastructures
		// 3 inverted index trees for vmname, hostsystem,
		// clusuter and 1 combined index tree for all the unique
		// words
		var selectedType = "";
		if (this.hostVm !== null && this.selectedEntity === "host") {
			selectedType = "HostSystem";
		} else if (this.hostVm !== null && this.selectedEntity === "vm") {
			selectedType = "VirtualMachine";
		}
		for ( var i = data.length-1; i >= 0; i--) {
			var row = data[i];
			if ((this.hostVm !== null && row.type === selectedType) || (this.hostVm === null && this.types.indexOf(row.type) > -1)) {
				var name = row.name;
				var key = "";
				this.allKeys[name] = 1;
				for ( var j = 0; j < this.pathFields.length; j++) {
					var parent = row[this.pathFields[j]];
					if (parent !== undefined && parent !== "") {
						this.allKeys[parent] = 1;
						key += "/" + parent;
					}
				}
				key += "/" +name;
				this.fullPathNames.push(key);

				var selectedTypeKey = "";
				for ( var k = 0; k < this.idFields.length; k++) {
					var hashName = this.idFields[k] + "Hash";
					this[hashName][key] = row[this.idFields[k]];
					if (selectedTypeKey === "") {
						selectedTypeKey = row[this.idFields[k]];
					} else {
						selectedTypeKey += "-" + row[this.idFields[k]];
					}
				}

				// This is done just for redirection to work,
				// need to find a better way of handling this
				// if(host!=undefined && moid!=undefined){
				this.selectedTypeHash[selectedTypeKey] = key;
				// }

			}
		}
		this.allKeys = Object.keys(this.allKeys);

		this.allCharIIT = this.buildSuffixTree(this.allKeys);

		// build an Index tree for all the unique entities
		this.entityIIT = this
		.buildEntityIndex(this.fullPathNames);
	},
	/**
	 *  This is used for filetering host-vm data 
	 *  for host vm perf view
	 * */
	prefilterdata : function(data) {
		var hostVmData = [];
		for ( var i = 0; i < data.length; i++) {
			var row = data[i];
			if (row.type === "HostSystem" || row.type === "VirtualMachine") {
				hostVmData.push(row);
			}
		}
		return hostVmData;
	},
	
	
	
	
	
	// ##################################################################################################
	// MODULE FUNCTIONS
	// ##################################################################################################
	onContextChange : function() {
		var context = this.getContext();
		if (context.get("search").job.isDone()) {
			this.getResults();
		} else {
			this.doneUpstream = false;
		}
	},
	onJobDone : function(event) {
		this.getResults();
	},
	getResultParams : function($super) {
		// Pass the module configuration to the controller
		var params = this._params;
		var search = this.getContext().get("search");
		var sid = search.job.getSID();
		var postProcess = search.getPostProcess();
		params['sid'] = sid;
		if (postProcess) {
			params['postProcess'] = postProcess;
		}
		return params;
	},
	getResultURL : function() {
		var context = this.getContext();
		var params = {};
		var search = context.get("search");
		params['search'] = search.getPostProcess() || "";
		params['outputMode'] = "json";
		params['count'] = 0;
		var url = search.getUrl("results");
		return url + "?" + Splunk.util.propToQueryString(params);
	},
	getResults : function($super) {
		this.doneUpstream = true;
		this.gettingResults = true;
		return $super();
	},
	scrollTo : function(element) {
		$(window).scrollLeft(element.position().left);
	},
	renderResults : function(jsonRsp) {
		var startTime = new Date();
		//Preprocess data to build required Inverted Index Trees
		// and hash maps
		var data = SOLN.parseResults(jsonRsp);
		var context = this.getContext();
		// Different paths for hostVm and single entities
		if (this.hostVm !== null) {
			var selectionList = SOLN
			.pullSelection(this.storeName + 'List');
			if (selectionList) {
				this.selections = selectionList;
			}
			var entityTypeVar = SOLN.pullSelection(this.entityTypeVar);
			if (entityTypeVar) {
				this.selectedEntity = entityTypeVar;
				//this.entityLabel = SOLN.pullSelection(this.entityLabelVar);
				if (entityTypeVar === "host") {
					$('.btn_host', this.container).addClass(
					'active');
					$('.btn_vm', this.container).removeClass(
					'active');
					this.entityLabel = "Host System";
					//this.clickVmToggle();
				} else if (entityTypeVar === "vm") {
					$('.btn_vm', this.container).addClass('active');
					$('.btn_host', this.container).removeClass('active');
					this.entityLabel = "Virtual Machine";
					//this.clickHostToggle();
				}
				if (this.entityLabel) {
					SOLN.storeVariable(this.entityLabelVar,null, this.entityLabel, context);
				}
				this.createSelectionList();
			}else{
				this.selectedEntity="host";
				this.entityLabel="Host System";
			}
			if(this.readStructures!=="1"){
				this.hostVmdata = this.prefilterdata(data);
				this.preProcessData(this.hostVmdata);
			}
		} else {
			if(this.readStructures!=="1"){

				data = SOLN.parseResults(jsonRsp);
				this.preProcessData(data);
			}
			//this.preProcessData(data);
		}

		var endTime=new Date();
		console.log('Total SOLNSelector loading time:' + (endTime-startTime));

		// If this is first load then get the selected from url
		// if it is there (only vm and host supported, meh and
		// cluster)

		//var applyStickySelection = true;

		//If this is first load then get the selected from url if it is there (only vm and host supported, meh and cluster)
		var applyStickySelection = true;
		var ii, input;
		var customEndPtUrl="";
		var selectedKey="";
		if (this.firstLoad) {
			this.firstLoad = false;
			
			//Handle all types
			for (ii = 0; ii< this.types.length; ii++) {
				var curType = this.types[ii];
				var urlVal = SOLN.getVariableValue("selected" + curType, context);
				//Note that redirection must use the single item form the the node's id 
				//multiple values are only supported as csv
				
				if (urlVal && urlVal!=='(moid="" AND host="")') {
					//var eids = urlVal.split(",");
					//this.applySelectionToIDs(eids);
					applyStickySelection = false;
					input={};
					input['storedKey']= urlVal;
					input['hostVm']= this.selectedEntity;
					input['datatype']=this.types[0];
					if(this.readStructures==="1"){
						selectedKey="";
						customEndPtUrl=  Splunk.util.make_url('custom', 'search_activity', 'read_structures_service', 'search_activity','get_selected_key');
						$.ajax({
								type: "GET",
								url:customEndPtUrl,
								data:input,
								async:false,
								success:function(res) {
									if(res!==null){
										selectedKey= $.parseJSON(res);
									}
								},
								error: function(jqXHR,textStatus,errorThrown) {
									console.log("[read_structures_service] AJAX Failure on getting selected key");
								}
							});

						$('.solnselector-input', this.container).val(selectedKey);
					}else{
						$('.solnselector-input', this.container).val(this.selectedTypeHash[urlVal]);
					}	
					//Context Control
					this.gettingResults = false;
					if($('.solnselector-input', this.container).val()!==""){
						this.pushContextToChildren();
					}
				}
			}
		}

		if (applyStickySelection) {
			// Get state of selection from local storage
			var storedData = SOLN.pullSelection(this.storeName);
			if (storedData) {
				// Apply selections to the current tree
				var storedKeys = Object.keys(storedData);
				if(storedKeys.length>0){
					if(this.readStructures==="1"){
						selectedKey="";
						input={};
						input['storedKey']= storedData[storedKeys[0]];
						input['hostVm']= this.selectedEntity;
						input['datatype']=this.types[0];
						
						customEndPtUrl=  Splunk.util.make_url('custom', 'search_activity', 'read_structures_service', 'search_activity','get_selected_key');
							$.ajax({
								type: "GET",
								url: customEndPtUrl,
								data:input,
								async:false,
								success:function(res) {
									selectedKey= $.parseJSON(res);
								},
								error: function(jqXHR,textStatus,errorThrown) {
									console.log("[read_structures_service] AJAX Failure on getting selected key");
								}
							});
						$('.solnselector-input', this.container).val(selectedKey);
					}else{
						$('.solnselector-input', this.container).val(this.selectedTypeHash[storedData[storedKeys[0]]]);
					}
				}
				//Context Control
				this.gettingResults = false;
				if($('.solnselector-input', this.container).val()!==""){
					this.pushContextToChildren();
				}

			}
		}


	},
	getModifiedContext : function() {
		//We determine the selection and store the variables in an isolated method
		// that returns the modified context
		var context = this.getContext();
		// return context without setting anything if data processing hasn't been done
		//if (($('.solnselector-input', this.container).val()=="" && this.hostVm==null)  || (this.hostVm!=null && $.isEmptyObject(this.selections) && $('.solnselector-input', this.container).val()=="" )) {
		if(this.gettingResults && this.hostVm!==null && $('.solnselector-input', this.container).val()==="" ||($('.solnselector-input', this.container).val()==="" && this.hostVm===null)  ){
			return context;
			
		}
		return this.setSelection();

	},
	requiresDispatch : function($super, context) {
		return $super(context);
	},
	onBeforeJobDispatched : function(search) {
		search.setMinimumStatusBuckets(1);
		search.setRequiredFields(this.requiredFields);
	},
	pushContextToChildren : function($super, explicitContext) {
		this.withEachDescendant(function(module) {
			module.dispatchAlreadyInProgress = false;
		});
		return $super(explicitContext);
	},
	isReadyForContextPush : function($super) {
		if (!(this.doneUpstream)) {
			return Splunk.Module.DEFER;
		}
		if (this.gettingResults) {
			return Splunk.Module.DEFER;
		}
		return $super();
	},
	resetUI : function() {
	} //Just so splunk stops bitching at me
});
