"""Like nec_bands.py, with the coax shield (open at the rig end) as the counterpoise.
argv: out.csv freqs(comma) coax_m. No header row, to match bands_cp5.csv."""
import sys, csv
from nec_coax import endfed_coax
out, freqs, coax = sys.argv[1], [float(f) for f in sys.argv[2].split(',')], float(sys.argv[3])
with open(out, 'w', newline='') as fh:
    w = csv.writer(fh)
    for f in freqs:
        L = 7.0
        while L <= 60:
            R, X = endfed_coax(L, f, coax, 'open')
            w.writerow([f, round(L, 3), R, X]); L *= 1.012
