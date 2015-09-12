import json
import pandas as pd

data = []

#exclude = []

raw = pd.read_json("memory-vs-xsl1-export.json")

#data = [json.loads(part)['data'] for part in raw]

from pandas.io.json import json_normalize

iquizdat = []
for d in raw['instructquiz']:
    if str(d)!='nan':
        iquizdat.append(d)

pquizdat = []
for d in raw['postquiz']:
    if str(d)!='nan':
        pquizdat.append(d)

studydat = []
for d in raw['study']:
    if str(d)!='nan':
        studydat.append(d)

testdat = []
for d in raw['test']:
    if str(d)!='nan':
        testdat.append(d)


#iquizd = json_normalize(iquizdat, ['condnum', 'num_correct', 'phase', 'time', 'uniqueId'])

iquizdat = pd.DataFrame(iquizdat)
pquizdat = pd.DataFrame(pquizdat)
studydat = pd.DataFrame(studydat)
testdat = pd.DataFrame(testdat)

iquizdat.to_csv('mem_vs_xsl1_instructquiz_data.csv')
pquizdat.to_csv('mem_vs_xsl1_postquiz_data.csv')
studydat.to_csv('mem_vs_xsl1_study_data.csv')
testdat.to_csv('mem_vs_xsl1_test_data.csv')
