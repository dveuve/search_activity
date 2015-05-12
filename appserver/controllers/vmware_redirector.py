# Copyright (C) 2005-2014 Splunk Inc. All Rights Reserved.
import logging

import cherrypy
import splunk.appserver.mrsparkle.controllers as controllers
from splunk.appserver.mrsparkle.lib.decorators import expose_page
from splunk.appserver.mrsparkle.lib.routes import route

logger = logging.getLogger('splunk.appserver.mrsparkle.controllers.vmware_redirector')

required_keys = ['web-traffic', 'clientip-internal', 'internal-domain',
				 'brand-name', 'exclude-pageview']

class vmware_redirector(controllers.BaseController):
	'''Splunk for VMWare Setup Controller'''
	
	@route('/:app/:action=redirect')
	@expose_page(must_login=True, methods=['GET']) 
	def redirect(self, **kwargs):
		"""redirect to a view based on passed type in kwargs, pass all QS vars 
		to that redirected url, not you cannot pass vars named app nor action"""
		
		#Remove controller elements we never want passed
		del kwargs["app"]
		del kwargs["action"]
		
		me_type = kwargs.get('Type', False) or kwargs.get('type',"FlashTimeline")
		
		redirecttargets = {
			"VirtualMachine": self.VirtualMachine,
			"HostSystem": self.HostSystem,
			"FirstHostSystem": self.HostSystem,
			"ClusterComputeResource": self.ClusterComputeResource,
			"DataCenter": self.DataCenter,
			"Datastore": self.Datastore,
			"FlashTimeline": self.FlashTimeline,
		}
		
		nid = kwargs.get((me_type + '-moid'), kwargs.get('nid', ''))
		#Note that our moid's will ALWAYS contain a dash, no dash means drill to flashtimeline
		if nid.find("-") == -1:
			kwargs['nid'] = ""
			me_type = "FlashTimeline"
		else:
			kwargs['nid'] = nid
		redirecttargets.get(me_type, self.FlashTimeline)(**kwargs)

	
	def _make_id(self,kwargs, key="nid"):
		"""
		create the entity id from the kwargs
		
		RETURNS entity id
		"""
		eid = ""
		if kwargs.get("host", False):
			eid = kwargs.get('host', "") + "-" + kwargs.get(key)
		else:
			eid = kwargs.get(key)
		return eid
	
	def VirtualMachine (self, **kwargs):
		kwargs['selectedVirtualMachine'] = self._make_id(kwargs)
		deletetargets = [ "nid", "Type", "VirtualMachine-moid", "sid", "host" ]
		for key in deletetargets:
			if key in kwargs:
				del kwargs[key]
			
		raise cherrypy.HTTPRedirect(self._make_app_url("vm_detail",kwargs), 303)
			
	def HostSystem (self, **kwargs):
		kwargs['selectedHostSystem'] = self._make_id(kwargs)
		deletetargets = [ "nid", "Type", "HostSystem-moid", "sid", "host" ]
		for key in deletetargets:
			if key in kwargs:
				del kwargs[key]
				
		raise cherrypy.HTTPRedirect(self._make_app_url("host_detail",kwargs), 303)
			
	def ClusterComputeResource (self, **kwargs):
		kwargs['selectedClusterComputeResource'] = self._make_id(kwargs)
		deletetargets = [ "nid", "Type", "ClusterComputeRosource-moid", "sid", "host" ]
		for key in deletetargets:
			if key in kwargs:
				del kwargs[key]
				
		raise cherrypy.HTTPRedirect(self._make_app_url("cluster_detail",kwargs), 303)
			
	def DataCenter (self, **kwargs):
		kwargs['selectedDatacenter'] = self._make_id(kwargs)
		deletetargets = [ "nid", "Type", "DataCenter-moid", "sid", "host" ]
		for key in deletetargets:
			if key in kwargs:
				del kwargs[key]
				
		raise cherrypy.HTTPRedirect(self._make_app_url("data_detail",kwargs), 303)
		
	def Datastore (self, **kwargs):
		kwargs['dsguid'] = self._make_id(kwargs)
		deletetargets = [ "nid", "Type", "Datastore-moid", "sid"]
		for key in deletetargets:
			if key in kwargs:
				del kwargs[key]
				
		raise cherrypy.HTTPRedirect(self._make_app_url("datastore_detail",kwargs), 303)
			
	def VirtualCenter (self, **kwargs):
		kwargs['selectedRootFolder'] = self._make_id(kwargs)
		deletetargets = [ "nid", "Type", "RootFolder-moid", "sid", "host" ]
		for key in deletetargets:
			if key in kwargs:
				del kwargs[key]
				
		raise cherrypy.HTTPRedirect(self._make_app_url("vc_detail",kwargs), 303)
		
	def FlashTimeline (self, **kwargs):
		dontdeletetargets = [ "sid", "search", "postprocess" ]
		for key in list(kwargs):
			if key not in dontdeletetargets:
				del kwargs[key]
				
		raise cherrypy.HTTPRedirect(self._make_app_url("flashtimeline", kwargs), 303)

	def _make_app_url(self, view, qs):
		"""shortcut for getting to the app"""
		return self.make_url(["app","search_activity",view], qs)
