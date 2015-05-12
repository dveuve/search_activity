# Copyright (C) 2005-2014 Splunk Inc. All Rights Reserved.
#Core Python Imports
import sys
import os
import logging, logging.handlers
from httplib2 import ServerNotFoundError
import socket, time
import urllib
import json
import marshal
import unicodedata
import bz2,json,contextlib
import ast

#CherryPy Web Controller Imports
import cherrypy
from cherrypy.lib.static import serve_file
import splunk.appserver.mrsparkle.controllers as controllers
from splunk.appserver.mrsparkle.lib.decorators import expose_page
from splunk.appserver.mrsparkle.lib.routes import route
from splunk.appserver.mrsparkle.lib.util import make_splunkhome_path

#Splunkd imports
import splunk
import splunk.rest as rest
import splunk.util as util
import lxml.etree as et
from splunk.models.app import App

sys.path.append(make_splunkhome_path(['etc', 'apps', 'search_activity', 'local', 'data']))

#CONSTANTS
REST_ROOT_PATH = '/services'


def setupLogger(logger=None, log_format='%(asctime)s %(levelname)s [ReadStructuresService] %(message)s', level=logging.DEBUG, log_name="read_structures_service.log", logger_name="read_structures_service"):
    """
    Setup a logger suitable for splunkd consumption
    """
    if logger is None:
        logger = logging.getLogger(logger_name)

    logger.propagate = False # Prevent the log messages from being duplicated in the python.log file
    logger.setLevel(level)

    file_handler = logging.handlers.RotatingFileHandler(make_splunkhome_path(['var', 'log', 'splunk', log_name]), maxBytes=2500000, backupCount=5)
    formatter = logging.Formatter(log_format)
    file_handler.setFormatter(formatter)

    logger.handlers = []
    logger.addHandler(file_handler)

    logger.debug("init read structures service logger")

    return logger



logger = setupLogger()
splunk.setDefault()
local_host_path = splunk.mergeHostPath()

class SOLNSelectorError(cherrypy.HTTPError):
    """
    This error class will be used to set the status and msg on the error
    responses. 
    """
    def get_error_page(self, *args, **kwargs):
        kwargs['noexname'] = 'true'
        return super(SOLNSelectorError, self).get_error_page(*args, **kwargs)       
    
    
class read_structures_service(controllers.BaseController):
    '''Read Structures Service Controller'''
    
    # Dictionary for single entity views
    datastructDict={}
    
    # Dictionaries for Host/VM view
    hostDataDict={}
    vmDataDict={}
    
    def _intersect(*d):
        sets = iter(map(set, d))
        result = sets.next()
        for s in sets:
            result = result.intersection(s)
        return result
    
    def __init__(self):
        #logger.debuug('Read service initialization called')
        try:
            kwargs={}
            self._readStructuresAtLoad()
        except AttributeError:
            self.sessionKey=None
            pass
        except Exception as e:
            logger.error(e)
        super(read_structures_service, self).__init__()
    
    def _readStructuresAtLoad(self):
        folderName='hostsystem'
        logger.debug('Reading Hostsystem data')
        hread= self._readFilesFromFolder(folderName, 'host')
        folderName='vm'
        logger.debug('Reading VM data')
        vread=self._readFilesFromFolder(folderName, 'vm')
        folderName='cluster'
        logger.debug('Reading Cluster data')
        cread =self._readFilesFromFolder(folderName, 'cluster')

        return
    def _readFilesFromFolder(self,folderName, datatype):
        """"Read data structures from folder. 
        Type field is used for host vm perf view to read host and vm data
        
        """
        try:
            folderPath= make_splunkhome_path(['etc', 'apps', 'search_activity','local', 'data', folderName])
            structDict={}
            for file in os.listdir(folderPath):
                with contextlib.closing(bz2.BZ2File(folderPath+"/"+file, 'rb')) as f:
                    dataDict=json.load(f)
        
                for key,val in dataDict.iteritems():
                    structDict[key]=json.loads(val)
                    logger.debug('Key in %s', key)
                    if(key=='idFieldsHash'):
                        idFieldsHash=json.loads(val)
                        logger.debug('idFieldsHash %s', idFieldsHash)
                        structDict['hostHash']=idFieldsHash['hostHash']
                        structDict['moidHash']=idFieldsHash['moidHash'] 
            #logger.debug('Struct Dictionary %s', structDict['moidHash'])       
            if datatype=='host':
                self.hostDataDict=structDict
            elif datatype=='vm':
                self.vmDataDict= structDict
            else:
                self.datastructDict= structDict
            return True
        except Exception as e:
            logger.error('Could not read files from folder={0}, for datatype={1} due to {2}'.format(folderPath, datatype,e ))
            msg="[SOLNSelector_read_strcutures] Couldn't read files at " + folderPath
            raise SOLNSelectorError(status="404", message=msg)
            
    @route('/:app/:action=read_structures')
    @expose_page(must_login=False, methods=['GET'])
    def read_structures(self, app, action, **kwargs):
        folderName='hostsystem'
        logger.debug('Reading Hostsystem data')
        hread= self._readFilesFromFolder(folderName, 'host')
        folderName='vm'
        logger.debug('Reading VM data')
        vread=self._readFilesFromFolder(folderName, 'vm')
        folderName='cluster'
        logger.debug('Reading Cluster data')
        cread =self._readFilesFromFolder(folderName, 'cluster')

        return

    
    @route('/:app/:action=find_matches')
    @expose_page(must_login=False, methods=['GET'])
    def find_matches(self, app, action, **kwargs):
        """Find the Entity level matches in the IITs"""
        try:
            searchString = kwargs.get("searchString")
            
            hostVm=kwargs.get('hostVm', "")
            datatype=""
            if(hostVm==""):
                datatype= kwargs.get('datatype')
            logger.debug("Search String %s",searchString )
            suggestionsLimit = kwargs.get("suggestionsLimit", 10)
            logger.debug("Suggestion Limit %s", suggestionsLimit)
            matches=[]
            if hostVm=='host' or datatype=='HostSystem':
                iit=self.hostDataDict['iit']
                keys=self.hostDataDict['keys']
                keyIIT=self.hostDataDict['keyIIT']
                allPrefixKeys= self.hostDataDict['allPrefixKeys']
            elif hostVm=='vm' or datatype=='VirtualMachine':
                iit=self.vmDataDict['iit']
                keys=self.vmDataDict['keys']
                keyIIT=self.vmDataDict['keyIIT']
                allPrefixKeys= self.vmDataDict['allPrefixKeys']
            else:
                logger.debug("Inside find matches")
                logger.debug("Data dictionary %s", self.datastructDict)
                iit=self.datastructDict['iit']
                logger.debug("IIT %s",iit)
                keys=self.datastructDict['keys']
                keyIIT=self.datastructDict['keyIIT']
                allPrefixKeys= self.datastructDict['allPrefixKeys']
            
            logger.debug("IIT keys %s", keys)
            if(searchString in iit):
                logger.debug(" search string exists in iit")
                keyArr=iit[searchString]
                logger.debug(keyArr)
                totalCount=len(keyArr)
                for i in range(0, totalCount):
                    if(i<suggestionsLimit):
                        matches.append(keys[keyArr[i]])
                        continue
                    else:
                        break
                logger.debug(matches)
              #  return json.dumps(matches)
            if((searchString not in iit) or (len(matches)<suggestionsLimit)):
                logger.debug('Search string does not exist in iit or length of matches is less than suggestionsLimit' )
                if( searchString not in keyIIT): 
                    logger.debug('Search string does not exist in keyIIT')
                else:
                    logger.debug('Search String exists in keyIIT')
                    keyArr= keyIIT[searchString]
                    logger.debug('Key Arr %s',keyArr)
                    for i in range(0,len(keyArr)):
                        if(len(matches)>suggestionsLimit):
                            break
                        else:
                            suffixString=unicodedata.normalize('NFKD',allPrefixKeys[keyArr[i]]).encode('ascii','ignore')
                            logger.debug(suffixString)
                            matchArr= iit[str(suffixString)]
                            logger.debug('Matching Arr %s', matchArr)
                            for j in range(0, len(matchArr)):
                                if(len(matches)>suggestionsLimit):
                                    break;
                                else:
                                    matches.append(keys[matchArr[j]])
            logger.debug("Matches %s" ,matches)                     
            return json.dumps(matches)
        except Exception as e:
            logger.error("Error while finding matches", e)
            #raise SOLNSelectorError(status="500", message="Error while finding matches")
        
    @route('/:app/:action=find_possible_matches')
    @expose_page(must_login=False, methods=['GET'])
    def find_possible_matches(self, app, action, **kwargs):
        """"
    /**
     * Performs Word level Autocompletion. Splits the input
     * string by "/" and look for individual entities in
     * entityIIT to gather matches Input(searchString): String
     * entered in the Input text box Output(matches): Array of
     * matches
     */
        """
        try:
            searchString = kwargs.get("searchString")
            hostVm=kwargs.get('hostVm', '')
            datatype=""
            if(hostVm==""):
                datatype= kwargs.get('datatype')
            searchEntities= searchString.split("/")
            matchArrs=[]
            matches=[]
            resultsHash={}
            
            if hostVm=='host' or datatype=='HostSystem':
                entityiit=self.hostDataDict['entityiit']
                fullPathNames=self.hostDataDict['fullPathNames']
            elif hostVm=='vm' or datatype=='VirtualMachine':
                entityiit=self.vmDataDict['entityiit']
                fullPathNames= self.vmDataDict['fullPathNames']
            else:          
                entityiit=self.datastructDict['entityiit']
                fullPathNames= self.datastructDict['fullPathNames']       
            
            for searchEntity in searchEntities:
                logger.debug("Searching Entity %s", searchEntity)
                if (not (searchEntity=="" or searchEntity=="*")):
                    logger.debug(entityiit)
                    match=entityiit[str(searchEntity)]
                    logger.debug(match)
                    if not match:
                        return json.dumps(matches)
                    matchArrs.append(match)
            
            if(len(matchArrs)>0):
                results= set(matchArrs[0]).intersection(*matchArrs)
            resultsList= list(results)    
            for result in resultsList:
                    resultsHash[result]=1
            
            results= resultsHash.keys()
            #logger.debug(results)
            for ind in results:
                matches.append(str(fullPathNames[ind]))
            return json.dumps(matches)
        except Exception as e:
            logger.error("Error while finding fullPath suggestions", e)
            #raise SOLNSelectorError(status="500", message="Error while finding fullPath suggestions")
                
    @route('/:app/:action=get_selected_key')
    @expose_page(must_login=False, methods=['GET'])
    def get_selected_key(self, app, action, **kwargs):
        """
        Returns the full path for the selected key 
        stored in the 'storedKey'
        """
        try:
            hostVm=kwargs.get('hostVm', '')
            datatype=""
            if(hostVm==""):
                datatype= kwargs.get('datatype')
            if hostVm=='host' or datatype=='HostSystem':
                selectedTypeHash=self.hostDataDict['selectedTypeHash']
            elif hostVm=='vm' or datatype=='VirtualMachine':
                selectedTypeHash= self.vmDataDict['selectedTypeHash']
            else:          
                selectedTypeHash= self.datastructDict['selectedTypeHash'] 
            
            storedKey = kwargs.get("storedKey")
            logger.debug('Selected Type Hash %s', selectedTypeHash)
            return json.dumps(selectedTypeHash[str(storedKey)])
        except Exception as e:
            logger.error("Error while fetching the selected key", e)
            #raise SOLNSelectorError(status="500", message="Error while fetching the selected key")
    
    @route('/:app/:action=get_id_keys')
    @expose_page(must_login=False, methods=['GET'])
    def get_id_keys(self, app, action, **kwargs):
        """
            Gets the id field values of the key
        """
        try:
            hostVm=kwargs.get('hostVm', '')
            key = kwargs.get("key")
            datatype=""
            if(hostVm==""):
                datatype= kwargs.get('datatype')
            if hostVm=='host' or datatype=='HostSystem':
                hostHash= self.hostDataDict['hostHash']
                moidHash= self.hostDataDict['moidHash']
            elif hostVm=='vm' or datatype=='VirtualMachine':
                hostHash= self.vmDataDict['hostHash']
                moidHash= self.vmDataDict['moidHash']
            else:          
                hostHash= self.datastructDict['hostHash']
                moidHash= self.datastructDict['moidHash']
            
            idKeysHash={}
            idKeysHash['host']=hostHash[key]
            idKeysHash['moid']=moidHash[key]
            
            return json.dumps(idKeysHash)
        except Exception as e:
            logger.error("Error while fetching the id fields for the key",e )
            #raise SOLNSelectorError(status="500", message="Error while fetching id fields for the selected key")
  
    @route('/:app/:action=validate_input')
    @expose_page(must_login=False, methods=['GET'])
    def validate_input(self, app, action, **kwargs):
        """
        Validates that the full Path is present in host and moid hashes
        """
        try:
            hostVm=kwargs.get('hostVm', '')
            datatype=""
            if(hostVm==""):
                datatype= kwargs.get('datatype')
            inputStr = kwargs.get("inputStr")
            logger.debug("Validating String %s", inputStr)
            if hostVm=='host' or datatype=='HostSystem':
                hostHash= self.hostDataDict['hostHash']
                moidHash= self.hostDataDict['moidHash']
            elif hostVm=='vm' or datatype=='VirtualMachine':
                hostHash= self.vmDataDict['hostHash']
                moidHash= self.vmDataDict['moidHash']
            else:          
                hostHash= self.datastructDict['hostHash']
                moidHash= self.datastructDict['moidHash']
            logger.debug("Host Hash %s", hostHash)
            logger.debug("Moid Hash %s", moidHash)
            
            if (inputStr in hostHash) and (inputStr in moidHash):
                return json.dumps(1);
            return  json.dumps(0);
        except Exception as e:
            logger.error("Input validation failed",e )
    

        
        
  
