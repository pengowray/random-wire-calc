import csv,numpy as np
from scipy.optimize import least_squares
from tlmodel import *
sets={'sweep_avg.csv':(5,8),'h4.csv':(5,4),'h12.csv':(5,12),'cp10.csv':(10,8),'cp2.csv':(2.5,8),'f18.csv':(5,8)}
data=[]
for fn,(cp,h) in sets.items():
    d=np.array([list(map(float,r)) for r in list(csv.reader(open('data/'+fn)))[1:]])
    data.append((fn,cp,h,d))
names=['k0','vf','rl','rs','z0c','vfc','rlc','rsc']
x0=[1.0,0.98,10,0.7,400,0.9,20,0.3]
lo=[0.3,0.85,0,0.1,100,0.6,0,0]; hi=[2,1.05,200,3,1500,1.1,500,2]
D=0.0016
def params(x,cp,h):
    p=dict(zip(names,x)); p['z0']=p['k0']*60*np.log(4*h/D); p['cp']=cp; return p
def model(x,cp,h,d): return zin(d[:,1],d[:,0],params(x,cp,h))
def res(x):
    out=[]
    for fn,cp,h,d in data:
        e=np.log(model(x,cp,h,d)/(d[:,2]+1j*d[:,3])); out+= [e.real,e.imag]
    return np.concatenate(out)
r=least_squares(res,x0,bounds=(lo,hi))
print({k:round(v,3) for k,v in zip(names,r.x)})
def swr(Z,n=9):
    zt=Z/n; g=abs((zt-50)/(zt+50)); return (1+g)/(1-g)
for fn,cp,h,d in data:
    Zm=model(r.x,cp,h,d); Zn=d[:,2]+1j*d[:,3]
    e=np.abs(np.log(swr(Zm))-np.log(swr(Zn)))
    print(fn,'z0=%.0f'%params(r.x,cp,h)['z0'],'rms logZ %.3f'%np.sqrt(np.mean(np.abs(np.log(Zm/Zn))**2)),'swr err median x%.2f p90 x%.2f'%(np.exp(np.median(e)),np.exp(np.percentile(e,90))))
import json; json.dump(dict(zip(names,map(float,r.x))),open('fit.json','w'),indent=1)
