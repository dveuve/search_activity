/* Copyright (C) 2005-2014 Splunk Inc. All Rights Reserved. */

/**
 * Customize the message module so it wont constantly be telling the user that
 * lookup tables have been loaded and written to. believe it or not, this is the
 * least evil way I was able to find to override the message handling. - Special
 * thanks to user "sideview" for posting this code on splunkbase. see reference
 * here: http://splunk-base.splunk.com/answers/3123/message-module-filter-values
 */
if (Splunk.Module.Message) {
	Splunk.Module.Message = $
			.klass(
					Splunk.Module.Message,
					{
						getHTMLTransform : function($super) {
							// Please dont tell me any 'info' about lookups, nor
							// 'error' about
							// entityLabelSingular, etc...
							// Thank you that is all.
							var argh = [
									{
										contains : "lookup",
										level : "info"
									},
									{
										contains : "Results written to",
										level : "info"
									},
									{
										contains : "entityLabelSingular",
										level : "error"
									},
									{
										contains : "auto-finalized",
										level : "info"
									},
									{
										contains : "Your timerange was substituted",
										level : "info"
									},
									{
										contains : "No matching fields exist",
										level : "info"
									},
									{
										contains : "Specified field(s) missing from results",
										level : "warn"
									},
									{
										contains : "minspan option has no effect when span is specified",
										level : "info"
									},
									{
										contains : "Error in 'TsidxStats': WHERE clause will not match any events",
										level : "fatal"
									},
									{
										contains : "Error in 'TsidxStats': WHERE clause is not an exact query",
										level : "error"
									},
									{
										contains : "Error in 'TsidxStats': WHERE clause is not an exact query",
										level : "fatal"
									}];
									
							for ( var i = this.displayedMessages.length - 1; i >= 0; i--) {
								var message = this.displayedMessages[i];
								for ( var j = 0, jLen = argh.length; j < jLen; j++) {
									if ((message.content
											.indexOf(argh[j]["contains"]) != -1)
											&& (message.level == argh[j]["level"])) {

										this.displayedMessages.splice(i, 1);
										break;
									}
								}
							}
							return $super();
						}
					});
}

// Patch for SOLNVMW-2288 and for hiding fields leading with HIDE-
if (Splunk.Module.SimpleResultsTable) {
	Splunk.Module.SimpleResultsTable = $
			.klass(
					Splunk.Module.SimpleResultsTable,
					{
						initialize : function($super, container) {
							// call the orginal
							$super(container);
							// set up our hide cells as false at first, and set
							// the idx adjustment
							this.hideSelector = false;
							this.idxAdjustment = Splunk.util
									.normalizeBoolean(this
											.getParam("displayRowNumbers")) ? 2
									: 1;
						},
						renderResults : function($super, htmlFragment) {
							var tmpFields = [];
							var idxadj = this.idxAdjustment;
							$("span.sortLabel", htmlFragment).each(
									function(idx) {
										var field = $(this).text();
										if (field.slice(0, 5) === "HIDE-") {
											// The adjustment is because of
											// simple results table's
											// everpresent elements/selector
											// details
											tmpFields.push(idx + idxadj);
										}
									});
							var selectorTemplate = "td:nth-child($idx$),th:nth-child($idx$)";
							this.hideSelector = [];
							var re = new RegExp("\\$idx\\$", "g");
							for ( var ii = 0; ii < tmpFields.length; ii++) {
								this.hideSelector.push(selectorTemplate
										.replace(re, tmpFields[ii]));
							}

							// call the orginal
							$super(htmlFragment);
							// hide the unclean!
							for (ii = 0; ii < this.hideSelector.length; ii++) {
								$(this.hideSelector[ii], this.container).hide();
							}
						},
						// Overload for highlight isaes in custom template
						getElementToHighlight : function(el) {
							if (!$(el).parent().length)
								return false;

							if ($(el).hasClass('pos'))
								return false;

							// if this is a multivalue field and you're over the
							// TD instead of over a value, we bail..
							if (el.tagName == 'TD'
									&& $(el).find("div.mv").length > 0)
								return false;
							// This is the patch, use a descendent selector to
							// get only row elements that are descendents of the
							// container div
							var row = $(el)
									.parents("#" + this.moduleId + " tr");

							switch (this.drilldown) {
							case "all":
								return $(row); // all is all row elements! not
												// 1 element!
							case "row":
								return $(row);
							default:
								// drilldown configuration takes precedence.
								// only after we've given them a chance does
								// this take effect.
								if (this.getInferredEntityName() == "events") {
									return $(el);
								}
							}
							return false;
						},
						onRowMouseover : function(evt) {
							if ($(evt.target).is(
									'.empty_results, .resultStatusHelp a'))
								return false;
							if (this.drilldown == 'none'
									&& this.getInferredEntityName() != "events")
								return false;

							var toHighlight = this
									.getElementToHighlight(evt.target);
							if (toHighlight) {
								toHighlight.addClass('mouseoverHighlight');
								// All of this was rather silly, it messes with
								// pages that use a custom template that
								// involves tables.
								// if (this.drilldown == "all") {
								// // I'd really like to just take the existing
								// jquery collection in toHighlight and merge it
								// with
								// // these two other jquery objects, and do it
								// all within 'getElementToHighlight' even
								// // however $().add() needs to do it all
								// within one monolithic xpaths which is weak.
								// //this.getRowFieldCell(toHighlight).addClass('mouseoverHighlight');
								// //var coordinates =
								// this.getXYCoordinates(toHighlight);
								// //this.getColumnFieldCell(coordinates.x,
								// toHighlight).addClass('mouseoverHighlight');
								// }
							}
						},
						onRowMouseout : function(evt) {
							if ($(evt.target).is(
									'.empty_results, .resultStatusHelp a'))
								return false;
							if (this.drilldown == 'none'
									&& this.getInferredEntityName() != "events")
								return false;

							var toHighlight = this
									.getElementToHighlight(evt.target);
							if (toHighlight.length > 0) {
								toHighlight.removeClass('mouseoverHighlight');
								if (this.drilldown == "all") {
									this.getRowFieldCell(toHighlight)
											.removeClass('mouseoverHighlight');
									var coordinates = this
											.getXYCoordinates(toHighlight);
									this.getColumnFieldCell(coordinates.x,
											toHighlight).removeClass(
											'mouseoverHighlight');
								}
							}
						},
						// Overload for better click vars on drilldown all
						getSelectionState : function(evt) {
							var el = $(evt.target);
							var coordinates = this.getXYCoordinates(el);
							var selection = {};
							var rowCell;

							if (this.drilldown == "none") {
								return false;
							} else if (this.drilldown == "all") {
								// if this is configured to do cell click, but
								// the cell in particular is not marked as
								// clickable.

								if (!el.hasClass('d')
										&& !el.parent().hasClass('d')) {
									return;
								}

								// Set all fields for the row into the selection
								var $tr = $(el).parents(
										"#" + this.moduleId + " tr");
								$("td", $tr)
										.each(
												function() {
													var $this = $(this);
													if ($this.attr("field")) {
														selection[$this
																.attr("field")] = $this
																.text();
													}
												});

								selection.element = el;
								selection.name = this.getRowFieldName(el);
								selection.value = this.getRowFieldValue(el);

								selection.name2 = this.getColumnName(
										coordinates.x, el);
								selection.value2 = el.text();

							} else if (this.drilldown == "row") {
								rowCell = $($(el).parents("tr")[0]);
								selection.element = rowCell;
								selection.name = Splunk.util.trim($(
										el.parents("table.simpleResultsTable")
												.find("th:not('.pos')")[0])
										.text());
								selection.value = this.getRowFieldValue(el);
								// for row clicks the second pair is the same,
								// but we send it anyway.
								// as far as what information we send
								// downstream, this is EXACTLY as though we were
								// in drilldown='all' and the user actually
								// clicked on the first column.
								selection.name2 = selection.name;
								selection.value2 = selection.value;
							}

							selection.modifierKey = this
									.getNormalizedCtrlKey(evt);

							if (selection.name == "_time") {
								rowCell = this.getRowFieldCell(el);
								selection.timeRange = this
										.getTimeRangeFromCell(rowCell);
							}

							// temporary fix for SPL-27829. For more details see
							// comment in FlashChart.js,
							// on FlashChart.stripUnderscoreFieldPrefix();
							if (selection.name2
									&& selection.name2
											.indexOf(this.LEADING_UNDERSCORE_PREFIX) != -1) {
								selection.name2 = selection.name2.replace(
										this.LEADING_UNDERSCORE_PREFIX, "_");
							}
							return selection;
						}
					});
}

// Patch for paginator not working with post process which is laaaaaaaaaaaaame
// Note this will not do well with real time nor with post process that is not
// transforming, but whatever paginator sucks anyway
if (Splunk.util.getCurrentView() !== "flashtimeline") {
	if (Splunk.Module.Paginator) {
		Splunk.Module.Paginator = $
				.klass(
						Splunk.Module.Paginator,
						{
							getEntityCount : function() {
								var count;
								var context = this.getContext();
								var search = context.get("search");
								switch (this.entityName) {
								case this.EVENTS_ENTITY_NAME:
									// Search now has it's own
									// getEventAvailableCount
									// that will return the correct answer even
									// when the user has
									// selected a subset of the timerange
									count = search.getEventAvailableCount();
									break;
								case this.RESULTS_ENTITY_NAME:
									var pp = search.getPostProcess();
									if (pp) {
										var params = {};
										params["search"] = pp + "| stats count";
										params["outputMode"] = "json";
										var uri = search.getUrl("results")
												+ "?"
												+ Splunk.util
														.propToQueryString(params);
										if (search.job.isPreviewable()) {
											uri = uri.replace("/results?",
													"/results_preview?");
										}
										$
												.ajax({
													url : uri,
													success : function(data) {
														var result = JSON
																.parse(data);
														count = parseInt(
																result[0]["count"],
																10);
													},
													dataType : "text",
													async : false
												});
									} else {
										count = search.job.getResultCount();
									}
									break;
								case this.SETTINGS_MAP_ENTITY_NAME:
									count = this.length;
									break;
								default:
									this.logger
											.error(
													"Invalid module entityName value of",
													this.entityName);
									count = 0;
									break;
								}
								return count;
							}
						});
	}
}

switch (Splunk.util.getCurrentView()) {
case "_admin":
	// Kill off the message module ont he admin screen
	Splunk.Module.Message = $.klass(Splunk.Module, {
		initialize : function($super, container) {
			$super(container);
			this.hide(this.HIDDEN_MODULE_KEY);
		}
	});
	break;
// For vms_by_host hide the first column of the results table, it is a key used
// for redirection.
// Because there is an additional row number columm on the leftmost, the we
// actually hide the second column in the table.
case "vms_by_host":
	Splunk.Module.SimpleResultsTable = $
			.klass(
					Splunk.Module.SimpleResultsTable,
					{
						renderResults : function($super, data) {
							$super(data);
							$('td:nth-child(2),th:nth-child(2)', this.container)
									.hide();
						}
					});
	break;
// For capacity_planning_hosts hide the second column (vmoid) of the results
// table, it is a key used for redirection.
case "capacity_planning_hosts":
	Splunk.Module.SimpleResultsTable = $
			.klass(
					Splunk.Module.SimpleResultsTable,
					{
						renderResults : function($super, data) {
							$super(data);
							$('td:nth-child(2),th:nth-child(2)', this.container)
									.hide();
						}
					});
	break;
}

function getappInfo(appName) {
	$('#appinfo')
			.append(
					'<h2>Splunk App For VMware</h2><p>Version <span id="version"></span>, Build <span id="build"></span><br/></p>');
	$.ajax({
		url : Splunk.util.make_url('/splunkd/servicesNS/-/' + appName
				+ '/properties/app/launcher/version'),
		dataType : 'text',
		success : function(data) {
			$('span#version').html(data);
		}
	});
	$.ajax({
		url : Splunk.util.make_url('/splunkd/servicesNS/-/' + appName
				+ '/properties/app/install/build'),
		dataType : 'text',
		success : function(data) {
			$('span#build').html(data);
		}
	});
}

$(function() {
	getappInfo(Splunk.ViewConfig['app']['id']);
});

if (Splunk.Module.SingleValue) {
	Splunk.Module.SingleValue = $.klass(Splunk.Module.SingleValue, {
		_handleClick : function($super, e) {
			if (this.getParam("linkSearch") === "auto") {
				var field = this.getParam("field");
				var qsDict = {};
				qsDict[field] = $(".singleResult", this.container).text();
				document.location = field + "?"
						+ Splunk.util.propToQueryString(qsDict);
				return false;
			} else {
				return $super(e);
			}

		}
	});
}

//Documentation link (Needed only for Ace):

if( $('#AppBar_0_0_0').size() > 0 ){
	// retrieve help link
	var helpLink = $('.AppBar a.help').attr("href");
	if(helpLink!==undefined){
		helpLink = helpLink.replace('%5Bsearch_activity%3A', '%5BVMW%3A');
		// update help link
		$('.AppBar a.help').attr("href", helpLink);
	}
}


