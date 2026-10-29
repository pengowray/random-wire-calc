import numpy as np
from scipy.special import sici
C=299.792458; G=0.5772156649
def rr_dipole(kL):
    # radiation resistance of a centre-fed dipole of total length L, referred to current max
    si1,ci1=sici(kL); si2,ci2=sici(2*kL); sih,cih=sici(kL/2)
    return 60*(G+np.log(kL)-ci1+0.5*np.sin(kL)*(si2-2*si1)+0.5*np.cos(kL)*(G+np.log(kL/2)+ci2-2*ci1))
def rr_mono(kl): return 0.5*rr_dipole(2*kl)
def stub(L,f,z0,vf,rloss,rr_scale=1.0):
    k=2*np.pi*f/C; beta=k/vf
    kl=np.maximum(k*L,1e-3)
    al=(rr_scale*rr_mono(kl)+rloss)/z0   # alpha*L
    g=al+1j*beta*L
    return z0/np.tanh(g)
def zin(L,f,p):
    z=stub(L,f,p['z0'],p['vf'],p['rl'],p.get('rs',1.0))
    if p.get('cp',0)>0: z=z+stub(p['cp'],f,p['z0c'],p['vfc'],p['rlc'],p.get('rsc',1.0))
    return z
def coax_stub(n, f, z0, vf, rp, p, rs):
    # Coax shield lying along the ground, open at the radio end: a line with series loss
    # rp·(f/10 MHz)^p ohms per metre, plus radiation as extra attenuation (as in stub()).
    w = 2 * np.pi * f * 1e6; k = 2 * np.pi * f / C
    Lp = z0 / (vf * C * 1e6); Cp = 1 / (z0 * vf * C * 1e6)
    Z = rp * (f / 10) ** p + 1j * w * Lp; Y = 1j * w * Cp
    g = np.sqrt(Z * Y) + rs * rr_mono(np.maximum(k * n, 1e-3)) / z0 / n
    return np.sqrt(Z / Y) / np.tanh(g * n)
