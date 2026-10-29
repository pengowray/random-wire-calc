"""NEC sweep over wire length at band edge/centre frequencies. argv: out.csv freqs(comma) cp"""
import sys, csv
from nec_sweep import endfed
out, freqs, cp = sys.argv[1], [float(f) for f in sys.argv[2].split(',')], float(sys.argv[3])
with open(out, 'w', newline='') as fh:
    w = csv.writer(fh); w.writerow(['f', 'L', 'R', 'X'])
    for f in freqs:
        L = 7.0
        while L <= 60:
            R, X = endfed(L, f, 'avg', cp)
            w.writerow([f, round(L, 3), R, X]); L *= 1.012
