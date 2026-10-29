import numpy as np, csv
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
from tlmodel import zin
import json; _f=json.load(open('fit.json')); x=np.array([_f[k] for k in ['k0','vf','rp','p','rs','z0c','vfc','rpc','rsc']]); names=['k0','vf','rp','p','rs','z0c','vfc','rpc','rsc']
p=dict(zip(names,x)); p['z0']=p['k0']*60*np.log(4*8/0.0016); p['cp']=5
d=np.array([list(map(float,r)) for r in csv.reader(open('data/bands_cp5.csv'))])
def swr(Z,n=9):
    zt=Z/n; g=np.abs((zt-50)/(zt+50)); g=np.minimum(g,0.9999); return (1+g)/(1-g)
def mark(s,smax=10): return 1/(1+(np.log(s)/np.log(smax))**4)
Ls=np.unique(d[:,1]); fs=np.unique(d[:,0])
bands=[fs[i:i+3] for i in range(0,len(fs),3)]
def score(src):
    out=[]
    for L in Ls:
        bs=[]
        for b in bands:
            m=[]
            for f in b:
                r=d[(d[:,0]==f)&(d[:,1]==L)][0]
                Z=r[2]+1j*r[3] if src=='nec' else zin(np.array([L]),np.array([f]),p)[0]
                m.append(mark(swr(Z)))
            bs.append(np.mean(m))
        out.append(100*np.mean(bs))
    return np.array(out)
sn,sm=score('nec'),score('model')
print('corr',np.corrcoef(sn,sm)[0,1],'mean abs diff',np.mean(abs(sn-sm)))
def peaks(s):
    i=[k for k in range(1,len(s)-1) if s[k]>=s[k-1] and s[k]>=s[k+1]]
    i.sort(key=lambda k:-s[k]); acc=[]
    for k in i:
        if all(abs(np.log(Ls[k]/Ls[j]))>0.05 for j in acc): acc.append(k)
    return acc[:8]
print('NEC top  ',[(round(Ls[k],1),round(sn[k])) for k in peaks(sn)])
print('model top',[(round(Ls[k],1),round(sm[k])) for k in peaks(sm)])
plt.figure(figsize=(12,4)); plt.semilogx(Ls,sn,label='NEC-2'); plt.semilogx(Ls,sm,'--',label='model'); plt.legend(); plt.xlabel('wire length m'); plt.ylabel('score'); plt.title('Overall score, VK bands 160-10m, 9:1, 5 m counterpoise, tuner 10:1'); plt.tight_layout(); plt.savefig('img/score-validation.png',dpi=70)

for b in bands:
    dn=[]; dm=[]
    for L in Ls:
        for f in b:
            r=d[(d[:,0]==f)&(d[:,1]==L)][0]
            dn.append(mark(swr(r[2]+1j*r[3]))); dm.append(mark(swr(zin(np.array([L]),np.array([f]),p)[0])))
    print('band from %g MHz: NEC %.0f, model %.0f'%(b[0],100*np.mean(dn),100*np.mean(dm)))
