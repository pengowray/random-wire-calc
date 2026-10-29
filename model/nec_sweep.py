"""NEC-2 sweep of an end-fed random wire. Writes CSV: f_mhz,L_m,R,X"""
import sys, math, csv, PyNEC
C = 299.792458

def add_wire(g, tag, p1, p2, f, r, per_lam=24, min_segs=1):
    ln = math.dist(p1, p2)
    n = max(min_segs, math.ceil(ln / (C / f) * per_lam))
    g.wire(tag, n, *p1, *p2, r, 1.0, 1.0)

def endfed(L, f, ground='avg', cp=5.0, feed_h=1.5, top_h=8.0, run=10.0, r=0.0008):
    c = PyNEC.nec_context()
    g = c.get_geometry()
    # 0.2 m vertical feed segment between counterpoise and wire
    a, b = (0, 0, feed_h - 0.1), (0, 0, feed_h + 0.1)
    g.wire(1, 1, *a, *b, r, 1.0, 1.0)
    # counterpoise: horizontal wire at feed height, opposite direction
    if cp > 0:
        add_wire(g, 2, a, (-cp, 0, feed_h - 0.1), f, r)
    rem = L - 0.0
    slope_len = math.hypot(run, top_h - b[2])
    if rem <= slope_len:
        t = rem / slope_len
        add_wire(g, 3, b, (run * t, 0, b[2] + (top_h - b[2]) * t), f, r)
    else:
        top = (run, 0, top_h)
        add_wire(g, 3, b, top, f, r)
        add_wire(g, 4, top, (run + rem - slope_len, 0, top_h), f, r)
    if ground == 'free':
        c.geometry_complete(0)
        c.gn_card(-1, 0, 0, 0, 0, 0, 0, 0)
    elif ground == 'perfect':
        c.geometry_complete(0)
        c.gn_card(1, 0, 0, 0, 0, 0, 0, 0)
    else:
        c.geometry_complete(0)
        c.gn_card(2, 0, 13, 0.005, 0, 0, 0, 0)
    c.ex_card(0, 1, 1, 0, 1.0, 0, 0, 0, 0, 0)
    c.fr_card(0, 1, f, 0)
    c.xq_card(0)
    z = c.get_input_parameters(0).get_impedance()[0]
    return z.real, z.imag

if __name__ == '__main__':
    out = sys.argv[1]
    ground = sys.argv[2] if len(sys.argv) > 2 else 'avg'
    cp = float(sys.argv[3]) if len(sys.argv) > 3 else 5.0
    top_h = float(sys.argv[4]) if len(sys.argv) > 4 else 8.0
    freqs = [float(x) for x in sys.argv[5].split(',')] if len(sys.argv) > 5 else [3.6, 7.1, 14.2, 28.5]
    with open(out, 'w', newline='') as fh:
        w = csv.writer(fh); w.writerow(['f', 'L', 'R', 'X'])
        for f in freqs:
            lam = C / f
            L = 0.1 * lam
            while L <= min(6 * lam, 120):
                R, X = endfed(L, f, ground, cp, top_h=top_h)
                w.writerow([f, round(L, 3), R, X]); fh.flush()
                L *= 1.008
