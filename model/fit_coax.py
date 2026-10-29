"""Fit the coax-shield counterpoise (tlmodel.coax_stub), holding the wire constants from
fit.json. Uses the coax*_open sweeps (radio end not earthed). Writes fit_coax.json.

160m is left out: with the coax this close to the ground, NEC-2 gives negative feed
resistance at 1.85 MHz (the wire counterpoise at 1.4 m is fine)."""
import csv, json, numpy as np
from scipy.optimize import least_squares
from tlmodel import stub, coax_stub

W = json.load(open('fit.json'))
z0w = W['k0'] * 60 * np.log(4 * 8 / 0.0016)
names = ['z0', 'vf', 'rp', 'p', 'rs']
data = []
for n in (5, 10, 20):
    for x in ('', '_f18'):
        fn = f'coax{n}_open{x}.csv'
        d = np.array([list(map(float, r)) for r in list(csv.reader(open('data/' + fn)))[1:]])
        data.append((fn, n, d[d[:, 0] > 2.5]))

def model(x, n, L, f):
    return stub(L, f, z0w, W['vf'], W['rl'], W['rs']) + coax_stub(n, f, *x)

def res(x):
    out = []
    for fn, n, d in data:
        e = np.log(model(x, n, d[:, 1], d[:, 0]) / (d[:, 2] + 1j * d[:, 3])); out += [e.real, e.imag]
    return np.concatenate(out)

r = least_squares(res, [300, 0.9, 2, 0.5, 1], bounds=([50, 0.4, 0, -1, 0], [1500, 1.1, 100, 3, 5]))
print({k: round(v, 3) for k, v in zip(names, r.x)})
def swr(Z, n=9):
    zt = Z / n; g = np.minimum(abs((zt - 50) / (zt + 50)), 0.9999); return (1 + g) / (1 - g)
for fn, n, d in data:
    Zm = model(r.x, n, d[:, 1], d[:, 0]); Zn = d[:, 2] + 1j * d[:, 3]
    ok = d[:, 2] > 0
    e = np.abs(np.log(swr(Zm[ok])) - np.log(swr(Zn[ok])))
    print(fn, 'swr err median x%.2f p90 x%.2f' % (np.exp(np.median(e)), np.exp(np.percentile(e, 90))))
json.dump(dict(zip(names, map(float, r.x))), open('fit_coax.json', 'w'), indent=1)
