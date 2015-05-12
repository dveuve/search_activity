import splunk.Intersplunk

def parseAuthString(settings, loggerInstance = None): 
    '''
    Parses the received authorization token, written as:
    <auth>
        <userId>admin</userId>
        <username>admin</username>
        <authToken>cbd900f3b28014a1e233679d05dcd805</authToken>
    </auth>
    and returns the values: userId,userName, authToken
    Parameters are:
        settins: as returned by  "results,dummyresults,settings = splunk.Intersplunk.getOrganizedResults()"
        loggerInstance: an instance of the logging facility, or None if no logging is to be done.
    Returns: (userId, userName, authToken)
    '''
    userId, userName, authToken = (None, None, None)
    
    authString = settings.get("authString", None)
    
    
    if authString == None:
        if not loggerInstance == None: loggerInstance.warn('parseAuthString: settings did not provide an authString')    
        return None,None,None
    if not loggerInstance == None: loggerInstance.debug('parseAuthString: settings provided authString=%s' % authString)
    
    try:
        start = authString.find('<userId>') + 8
        stop = authString.find('</userId>')
        userId = authString[start:stop]
        
        start = authString.find('<username>') + 10
        stop = authString.find('</username>')
        userName = authString[start:stop]
        
        start = authString.find('<authToken>') + 11
        stop = authString.find('</authToken>')
        authToken = authString[start:stop]
    except:
        if not loggerInstance == None: loggerInstance.exception('parseAuthString: settings provided authString=%s' % authString)
    
    return userId, userName, authToken
    
    
    
try:
    keywords,options = splunk.Intersplunk.getKeywordsAndOptions()
    
    fieldName = options.get("field", 'splunk_username')
    
    results,dummyresults,settings = splunk.Intersplunk.getOrganizedResults()
    
    userId, userName, authToken = parseAuthString(settings,None)    
        
    for event in results:
        event[fieldName] = userName
    
    splunk.Intersplunk.outputResults(results)    
    
except Exception, e:
    splunk.Intersplunk.generateErrorResults(str(e))
