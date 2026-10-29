"""Score check for the coax-shield counterpoise: NEC (bands_coax10.csv) against the model,
VK bands 80m to 10m, 9:1, 10 m of coax, tuner limit 10:1. Writes img/score-validation-coax.png."""
import json, csv, numpy as np
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
from tlmodel import stub
W = json.load(open('fit.json')); X = json.load(open('fit_coax.json'))
z0w = W['k0'] * 60 * np.log(4 * 8 / 0.0016)
COAX = 10
def zmodel(L, f):
    return stub(L, f, z0w, W['vf'], W['rp'], W['p'], W['rs']) + stub(COAX, f, X['z0'], X['vf'], X['rp'], X['p'], X['rs'])
d = np.array([list(map(float, r)) for r in csv.reader(open('data/bands_coax10.csv'))])
d = d[d[:, 0] > 2.5]  # 160m left out: NEC-2 gives negative feed resistance there (see fit_coax.py)
def swr(Z, n=9):
    zt = Z / n; g = np.minimum(np.abs((zt - 50) / (zt + 50)), 0.9999); return (1 + g) / (1 - g)
def mark(s, smax=10): return 1 / (1 + (np.log(s) / np.log(smax)) ** 4)
Ls = np.unique(d[:, 1]); fs = np.unique(d[:, 0])
bands = [fs[i:i + 3] for i in range(0, len(fs), 3)]
def score(src):
    out = []
    for L in Ls:
        bs = []
        for b in bands:
            m = []
            for f in b:
                r = d[(d[:, 0] == f) & (d[:, 1] == L)][0]
                Z = r[2] + 1j * r[3] if src == 'nec' else zmodel(L, f)
                m.append(mark(swr(Z)))
            bs.append(np.mean(m))
        out.append(100 * np.mean(bs))
    return np.array(out)
sn, sm = score('nec'), score('model')
print('corr %.3f mean abs diff %.1f' % (np.corrcoef(sn, sm)[0, 1], np.mean(abs(sn - sm))))
def peaks(s):
    i = [k for k in range(1, len(s) - 1) if s[k] >= s[k - 1] and s[k] >= s[k + 1]]
    i.sort(key=lambda k: -s[k]); acc = []
    for k in i:
        if all(abs(np.log(Ls[k] / Ls[j])) > 0.05 for j in acc): acc.append(k)
    return acc[:6]
print('NEC top  ', [(round(Ls[k], 1), round(sn[k])) for k in peaks(sn)])
print('model top', [(round(Ls[k], 1), round(sm[k])) for k in peaks(sm)])
plt.figure(figsize=(12, 4)); plt.semilogx(Ls, sn, label='NEC-2'); plt.semilogx(Ls, sm, '--', label='model')
plt.legend(); plt.xlabel('wire length m'); plt.ylabel('score')
plt.title('Overall score, no counterpoise (10 m coax shield), VK bands 80-10m, 9:1, tuner 10:1')
plt.tight_layout(); plt.savefig('img/score-validation-coax.png', dpi=70)

for b in bands:
    dn = []; dm = []
    for L in Ls:
        for f in b:
            r = d[(d[:, 0] == f) & (d[:, 1] == L)][0]
            dn.append(mark(swr(r[2] + 1j * r[3]))); dm.append(mark(swr(zmodel(L, f))))
    print('band from %g MHz: NEC %.0f, model %.0f' % (b[0], 100 * np.mean(dn), 100 * np.mean(dm)))
