"""NEC-2 sweep with the coax shield as the only counterpoise. Writes CSV: f,L,R,X

The coax drops from the feedpoint to 5 cm above ground, then runs along the ground away
from the wire. At the rig end the shield is either open (battery rig, nothing else
connected) or earthed with a short wire into the ground.
"""
import sys, math, csv, PyNEC
from nec_sweep import add_wire, C

def endfed_coax(L, f, coax=10.0, rig='open', feed_h=1.5, top_h=8.0, run=10.0, r=0.0008, rc=0.0025, low=0.05):
    c = PyNEC.nec_context()
    g = c.get_geometry()
    a, b = (0, 0, feed_h - 0.1), (0, 0, feed_h + 0.1)
    g.wire(1, 1, *a, *b, r, 1.0, 1.0)
    drop = a[2] - low
    if coax <= drop:
        add_wire(g, 2, a, (0, 0, a[2] - coax), f, rc)
    else:
        add_wire(g, 2, a, (0, 0, low), f, rc)
        end = (-(coax - drop), 0, low)
        add_wire(g, 5, (0, 0, low), end, f, rc)
        if rig == 'earthed':
            g.wire(6, 1, *end, end[0], 0, 0, rc, 1.0, 1.0)
    slope_len = math.hypot(run, top_h - b[2])
    if L <= slope_len:
        t = L / slope_len
        add_wire(g, 3, b, (run * t, 0, b[2] + (top_h - b[2]) * t), f, r)
    else:
        top = (run, 0, top_h)
        add_wire(g, 3, b, top, f, r)
        add_wire(g, 4, top, (run + L - slope_len, 0, top_h), f, r)
    c.geometry_complete(1 if rig == 'earthed' else 0)
    c.gn_card(2, 0, 13, 0.005, 0, 0, 0, 0)
    c.ex_card(0, 1, 1, 0, 1.0, 0, 0, 0, 0, 0)
    c.fr_card(0, 1, f, 0)
    c.xq_card(0)
    z = c.get_input_parameters(0).get_impedance()[0]
    return z.real, z.imag

if __name__ == '__main__':
    out, coax, rig = sys.argv[1], float(sys.argv[2]), sys.argv[3]
    freqs = [float(x) for x in sys.argv[4].split(',')] if len(sys.argv) > 4 else [3.6, 7.1, 14.2, 28.5]
    with open(out, 'w', newline='') as fh:
        w = csv.writer(fh); w.writerow(['f', 'L', 'R', 'X'])
        for f in freqs:
            lam = C / f
            L = 0.1 * lam
            while L <= min(6 * lam, 120):
                R, X = endfed_coax(L, f, coax, rig)
                w.writerow([f, round(L, 3), R, X]); fh.flush()
                L *= 1.008
