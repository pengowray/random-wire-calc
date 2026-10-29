import csv,sys,numpy as np
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
from tlmodel import *
exec(open('fit2.py').read().split('r=least_squares')[0])
import json; _f=json.load(open('fit.json')); x=np.array([_f[k] for k in ['k0','vf','rp','p','rs','z0c','vfc','rpc','rsc']])
def swr(Z,n=9):
    zt=Z/n; g=abs((zt-50)/(zt+50)); return (1+g)/(1-g)
fig,axs=plt.subplots(6,2,figsize=(16,20))
for i,(fn,cp,h,d) in enumerate(data):
    for f in sorted(set(d[:,0])):
        s=d[d[:,0]==f]; Zn=s[:,2]+1j*s[:,3]; Zm=model(x,cp,h,s); xl=s[:,1]
        l,=axs[i,0].semilogy(xl,abs(Zn),label=f'{f}'); axs[i,0].semilogy(xl,abs(Zm),'--',color=l.get_color())
        axs[i,1].semilogy(xl,swr(Zn),color=l.get_color()); axs[i,1].semilogy(xl,np.abs(swr(Zm)),'--',color=l.get_color())
    axs[i,0].set_title(fn); axs[i,0].legend(fontsize=7); axs[i,1].set_ylim(1,100); axs[i,0].set_xlim(0,80); axs[i,1].set_xlim(0,80)
plt.tight_layout(); plt.savefig('img/model-vs-nec.png',dpi=55)
