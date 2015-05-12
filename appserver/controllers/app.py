# Copyright (C) 2005-2014 Splunk Inc. All Rights Reserved.
from splunk.models.base import SplunkAppObjModel
from splunk.models.field import BoolField

''' Provides object mapping for app objects '''

class App(SplunkAppObjModel):
    ''' Represents a Splunk app '''
    
    resource      = 'apps/local'
    is_disabled   = BoolField('disabled')
    is_configured = BoolField('configured')
