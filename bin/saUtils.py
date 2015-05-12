import os, platform, subprocess, sys, time
import splunk.rest
import urllib

def force_lookup_replication(app, filename, sessionKey, base_uri=None):
    '''Force replication of a lookup table in a Search Head Cluster.'''

    # Permit override of base URI in order to target a remote server.
    endpoint = '/services/replication/configuration/lookup-update-notify'
    if base_uri:
        repl_uri = base_uri + endpoint
    else:
        repl_uri = endpoint

    filename = filename + ".context.csv"
        
    payload = {'app': app, 'filename': os.path.basename(filename), 'user': 'nobody'}
    response, content = splunk.rest.simpleRequest(repl_uri, 
        method='POST', 
        postargs=payload, sessionKey=sessionKey, raiseAllErrors=False)

    if response.status == 400:
        if 'No local ConfRepo registered' in content:
            # search head clustering not enabled
            return (True, response.status, content)
        elif 'Could not find lookup_table_file' in content:
            return (False, response.status, content)
        else:
            # Previously unforeseen 400 error.
            return (False, response.status, content)
    elif response.status != 200:
        return (False, response.status, content)
    return (True, response.status, content)

def getSettings(input_buf):

    settings = {}
    # get the header info
    input_buf = sys.stdin
    # until we get a blank line, read "attr:val" lines, setting the values in 'settings'
    attr = last_attr = None
    while True:
        line = input_buf.readline()
        line = line[:-1] # remove lastcharacter(newline)
        if len(line) == 0:
            break

        colon = line.find(':')
        if colon < 0:
            if last_attr:
               settings[attr] = settings[attr] + '\n' + urllib.unquote(line)
            else:
               continue

        # extract it and set value in settings
        last_attr = attr = line[:colon]
        val  = urllib.unquote(line[colon+1:])
        settings[attr] = val

    return(settings)

def get_app_list(sessionKey, base_uri=None):
    '''Force replication of a lookup table in a Search Head Cluster.'''

    # Permit override of base URI in order to target a remote server.
    # add count=0 to get all apps (turns of pagination)
    endpoint = '/services/apps/local?count=0'
    if base_uri:
        repl_uri = base_uri + endpoint
    else:
        repl_uri = endpoint
        
    # payload = {'app': app, 'filename': os.path.basename(filename), 'user': 'nobody'}
    response, content = splunk.rest.simpleRequest(repl_uri, 
        method='GET', sessionKey=sessionKey, raiseAllErrors=False)

    if response.status != 200:
        return (False, response.status, content)
    return (True, response.status, content)

def runProcess(root, cmd, argList, passInput):
    binary = os.path.dirname(root) + "/" +  platform.system() + "/" + platform.architecture()[0] + "/" + cmd

    if not os.path.isfile(binary):
        if (platform.system() == 'Windows'):
            binary = binary + ".exe"

    if not os.path.isfile(binary):
        raise Exception(cmd + "-F-000: Can't find binary file " + binary)

    argList.insert(0, binary)
    if passInput == True:
        child = subprocess.Popen(argList, stdin=subprocess.PIPE)
        for line in sys.stdin:
            child.stdin.write(line)
        child.stdin.close()
        child.wait()

    else:
        subprocess.call(argList)

    if platform.system() == 'Windows':
        sys.stdout.flush()
        time.sleep(1.0)
