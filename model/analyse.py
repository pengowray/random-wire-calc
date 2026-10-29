import csv, sys, math, numpy as np
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
C=299.792458
rows=[tuple(map(float,r)) for r in list(csv.reader(open(sys.argv[1])))[1:]]
fs=sorted(set(r[0] for r in rows))
fig,axs=plt.subplots(3,1,figsize=(12,12),sharex=True)
for f in fs:
    d=np.array([r for r in rows if r[0]==f]); x=d[:,1]/(C/f); Z=d[:,2]+1j*d[:,3]
    axs[0].semilogy(x,abs(Z),label=f'{f} MHz')
    axs[1].plot(x,np.degrees(np.angle(Z)))
    zt=Z/9; g=abs((zt-50)/(zt+50)); swr=(1+g)/(1-g)
    axs[2].semilogy(x,swr)
for a in axs:
    for k in range(1,25): a.axvline(k/4,color='k' if k%2==0 else 'gray',lw=0.5,ls='-' if k%2==0 else ':')
axs[0].set_ylabel('|Z| ohm'); axs[1].set_ylabel('phase deg'); axs[2].set_ylabel('SWR via 9:1'); axs[2].set_ylim(1,100)
axs[2].axhline(3,color='g'); axs[2].axhline(10,color='r'); axs[0].legend(); axs[2].set_xlabel('L / lambda (free-space)')
plt.tight_layout(); plt.savefig(sys.argv[2],dpi=70)
