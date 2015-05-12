import json
import logging
import os
import sys
import UserDict

import time

import cherrypy
import controllers.module as module
import splunk
import splunk.search
import splunk.util
import lib.util as util
import collections
from splunk.appserver.mrsparkle.lib import jsonresponse

logger = logging.getLogger("splunk")


class Node(object):
	def __init__(self, nid, parent, name, addfields):
		self.nid = nid
		self.parent = parent
		self.children = []
		self.name = name
		self.addfields = addfields

		

	def getLeaves (self):
		leavesSum = []
		if (len(self.children) == 0):
			return self
		else:
			for c in self.children:
				try:
					leavesSum.extend(c.getLeaves())
				except TypeError:
					leavesSum.append(c.getLeaves())	
			logger.debug("len of c: %s" % len(leavesSum))
			return leavesSum
	def getBranches (self):
		branchesSum = []
		if (len(self.children) > 0):
			try:
				branchesSum.extend(self)
			except TypeError:
				branchesSum.append(self)
			logger.debug("adding: %s" % branchesSum)
			for c in self.children:
				try:
					branchesSum.extend(c.getBranches())
				except TypeError:
					branchesSum.append(c.getBranches())
		return branchesSum
class NodeDict(UserDict.UserDict):
	def addNodes(self, nodes):
		""" Add every node as a child to its parent by doing two passes."""
		for i in (1, 2):
			for node in nodes:
				self.data[node.nid] = node
				if node.parent in self.data.keys():
					if node.parent != "none" and node not in self.data[node.parent].children:
						self.data[node.parent].children.append(node)

class NodeJSONEncoder(json.JSONEncoder):
	def default(self, node):
		if type(node) == Node:
			tempfields = ""
			resultDict = {}
			resultDict["nid"] = node.nid
			resultDict["name"] = node.name
			if len(node.addfields) > 0:
				for k,v in node.addfields.items():
					resultDict[str(k)] = str(v)
			resultDict["children"] = node.children
			#return {"nid":node.nid, "name":node.name, "temp":tempfields, "children":node.children}
			return resultDict
		raise TypeError("{} is not an instance of Node".format(node))

class D3DynamicTree(module.ModuleHandler):

	def generateResults(self, host_app, client_app, sid, populateParentValues=False, multiRootName="Environment" ):

		# the data comes like this 'field1,field2,field3'
		#layer_field_list =  layer_field_list.split(',')
		if populateParentValues == "null":
			populateParentValues = False
		else:
			populateParentValues = list(populateParentValues.split(','))
			
		job = splunk.search.getJob(sid)
		requiredFields = ['name','id','parent']
		fieldNames = [x for x in getattr(job, 'results').fieldOrder if (not x.startswith("_") and x not in requiredFields)]
		rs = getattr(job, 'results')
		nodes = []
		
		logger.debug("FieldNames: %s" % fieldNames)
		logger.debug("populateParentValues: %s" % populateParentValues)
		
		for i, result in enumerate(rs):
			resultId = str(result.get("id", None))
			resultParent = str(result.get("parent", None))
			resultName = str(result.get("name", None))
			resultAddFields = {}
			for field in fieldNames:
				fieldValues = result.get(field, None)
				if fieldValues:
					resultAddFields[field] = fieldValues
			nodes.append(Node(resultId, resultParent, resultName, resultAddFields))
					
		nodeDict = NodeDict()
		nodeDict.addNodes(nodes)
		rootNodes = [node for nid, node in nodeDict.items() if node.parent == "none"]
		logger.debug("RootNodes: %s" % rootNodes)
		dataList = []
		for rootNode in rootNodes:
			logger.debug("RootNode: %s" % rootNode.name)
			logger.debug("Leaves: %s" % rootNode.getLeaves())
			logger.debug("Branches: %s" % rootNode.getBranches())
			if populateParentValues:
				for branch in rootNode.getBranches():
					logger.debug("Current Branch: %s" % branch)
					for leaf in branch.getLeaves():
						logger.debug("Current Leaf: %s" % leaf)
						branchAddFields = branch.addfields
						leafAddFields = leaf.addfields
						for field in populateParentValues:
							try:
								logger.debug("Target Field: %s" % field)
								logger.debug("Current branch addfields: %s" % branchAddFields)
								if field in branchAddFields:
									branchAddFields[field] = float(str(branchAddFields[field]))
									logger.debug("Current branch Value: %s" % branchAddFields[field])
								else:
									branchAddFields[field] = 0
								if field in leafAddFields:
									logger.debug("Current Leaf Value: %s" % leafAddFields[field])
									branchAddFields[field] += float(str(leafAddFields[field]))
								else:
									continue
							except Exception as e:
									logger.debug("Error reading current leaf %s's value. Exception: %s" % (leaf, e))
					logger.error("Final Branch Values: %s" % branch.addfields)
			dataList.append(NodeJSONEncoder().encode(rootNode))
		data = " ".join(map(str, dataList))
		data = data.replace(', "children": []', '')
		# If children is beginning of line
		data = data.replace('"children": [],', '')
		if len(rootNodes) > 1:
			data = data.replace('} {', '}, {')
			data = '{ "name": "' + multiRootName + '", "children": [' + data + ']}'
			
		#data = "/static/app/search_activity/flare.json"

		return data
