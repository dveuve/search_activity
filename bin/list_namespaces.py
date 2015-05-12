import os
import sys
import glob
import re
import urllib, urllib2
import splunk.entity, splunk.Intersplunk
settings = dict()
records = splunk.Intersplunk.readResults(settings = settings, has_header = True)


d = dict()
for s in sys.argv:
    if "=" in s: 
        (a,b) = s.split("=")
        d[a] = b


if 'SPLUNK_HOME' not in d :
  raise Exception("Error! Missing parameter SPLUNK_HOME.") 


#import splunk.clilib.cli_common
#from datetime import datetime, date, time

def directory_size(path):
    total_size = 0
    seen = set()

    for dirpath, dirnames, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)

            try:
                stat = os.stat(fp)
            except OSError:
                continue

            if stat.st_ino in seen:
                continue

            seen.add(stat.st_ino)

            total_size += stat.st_size

    return total_size 


print "root_namespace,namespace,size"

myglob = glob.glob(d['SPLUNK_HOME'] + "/var/lib/splunk/tsidxstats/search_activity*")

mynamespaces = {}

for d in myglob:
	print d[d.rfind("/")+1:d.find(".")] + "," + d[d.rfind("/")+1:] + "," + str(directory_size(d))
	#mynamespaces[d[d.rfind("/")+1:d.find(".")]] = d

#for d in mynamespaces:
	#print d + "," + str(directory_size(mynamespaces[d]))






