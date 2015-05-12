#!/bin/sh

export PYTHONPATH=$SPLUNK_HOME/etc/apps/framework/contrib/splunk-sdk-python
export LD_LIBRARY_PATH=$SPLUNK_HOME/lib

python $SPLUNK_HOME/etc/apps/search_activity/bin/Generate_Namespace_From_Diag.py

