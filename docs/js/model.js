// Feedpoint impedance model for an end-fed random wire, and the scoring built on it.
//
// The wire and the counterpoise are each treated as a lossy open-ended transmission line
// (Zin = Z0·coth(γL)), connected in series at the feedpoint. The loss per line is set so the
// input resistance at a current maximum equals radiation resistance + a fixed loss resistance,
// using the textbook sinusoidal-current radiation resistance. Constants are fitted to NEC-2
// sweeps of a sloping end-fed wire over average ground: see model/README.md.
// No DOM access here, so this module can be tested under node.

const C_MPS = 299792458;
const EULER = 0.5772156649015329;

// Fitted against NEC-2 (model/fit.json). Wire height (4, 8, 12 m) changed Z0 by under 6%,
// so one value is used.
export const MODEL = {
    wireZ0: 462,
    wireVf: 0.992,          // bare wire; the user's velocity factor replaces this
    wireLossOhms: 23.1,     // ground and other losses, referred to a current maximum
    wireRadScale: 0.579,    // low wire over ground radiates less than in free space
    cpZ0: 396,
    cpVfRatio: 0.949 / 0.992, // counterpoise runs slower than the wire (closer to ground)
    cpLossOhms: 0.36,
    cpRadScale: 0.438,
    radialsOhms: 15,        // "ground radials": treated as a plain resistance
};

// Sine and cosine integrals, Numerical Recipes "cisi".
export function cisi(x) {
    const t = Math.abs(x);
    if (t === 0) return { si: 0, ci: -Infinity };
    let si, ci;
    if (t > 2) {
        // Lentz continued fraction for E1(it)
        let bRe = 1, bIm = t;
        let cRe = 1e30, cIm = 0;
        let [dRe, dIm] = cdiv(1, 0, bRe, bIm);
        let hRe = dRe, hIm = dIm;
        for (let i = 2; i <= 100; i++) {
            const a = -(i - 1) * (i - 1);
            bRe += 2;
            [dRe, dIm] = cdiv(1, 0, a * dRe + bRe, a * dIm + bIm);
            const [qRe, qIm] = cdiv(a, 0, cRe, cIm);
            cRe = bRe + qRe; cIm = bIm + qIm;
            const delRe = cRe * dRe - cIm * dIm;
            const delIm = cRe * dIm + cIm * dRe;
            const nRe = hRe * delRe - hIm * delIm;
            hIm = hRe * delIm + hIm * delRe;
            hRe = nRe;
            if (Math.abs(delRe - 1) + Math.abs(delIm) < 1e-12) break;
        }
        const cs = Math.cos(t), sn = Math.sin(t);
        const fRe = cs * hRe + sn * hIm;
        const fIm = cs * hIm - sn * hRe;
        ci = -fRe;
        si = Math.PI / 2 + fIm;
    } else {
        let sum = 0, sums = 0, sumc = 0, sign = 1, fact = 1, odd = true;
        for (let k = 1; k <= 100; k++) {
            fact *= t / k;
            const term = fact / k;
            sum += sign * term;
            const err = term / Math.abs(sum);
            if (odd) { sign = -sign; sums = sum; sum = sumc; }
            else { sumc = sum; sum = sums; }
            if (err < 1e-12) break;
            odd = !odd;
        }
        si = sums;
        ci = sumc + Math.log(t) + EULER;
    }
    return { si: x < 0 ? -si : si, ci };
}

function cdiv(aRe, aIm, bRe, bIm) {
    const d = bRe * bRe + bIm * bIm;
    return [(aRe * bRe + aIm * bIm) / d, (aIm * bRe - aRe * bIm) / d];
}

// Radiation resistance (ohms, referred to the current maximum) of a centre-fed dipole of
// total electrical length kL radians, sinusoidal current. 73 ohms at kL = π.
export function dipoleRadiationResistance(kL) {
    const a = cisi(kL), b = cisi(2 * kL);
    return 60 * (EULER + Math.log(kL) - a.ci
        + 0.5 * Math.sin(kL) * (b.si - 2 * a.si)
        + 0.5 * Math.cos(kL) * (EULER + Math.log(kL / 2) + b.ci - 2 * a.ci));
}

// Monopole of length kl is half a dipole of length 2kl. Tabulated, since it depends only on kl
// and the sweep asks for it hundreds of thousands of times.
const RR_STEP = 0.004;
let rrTable = new Float64Array(0);
export function monopoleRadiationResistance(kl) {
    kl = Math.max(kl, 0.01);
    const idx = kl / RR_STEP;
    if (idx + 2 >= rrTable.length) growRrTable(idx + 2);
    const i = Math.floor(idx), f = idx - i;
    return rrTable[i] * (1 - f) + rrTable[i + 1] * f;
}
function growRrTable(minLen) {
    const n = Math.max(Math.ceil(minLen * 1.5), 4096);
    const t = new Float64Array(n);
    t.set(rrTable);
    for (let i = rrTable.length; i < n; i++) {
        const kl = Math.max(i * RR_STEP, 0.01);
        t[i] = 0.5 * dipoleRadiationResistance(2 * kl);
    }
    rrTable = t;
}

// Input impedance [R, X] of an open-ended lossy line representing a radiating wire.
export function wireImpedance(lengthM, freqMHz, vf, z0, lossOhms, radScale) {
    const k = 2 * Math.PI * freqMHz * 1e6 / C_MPS;
    const bl = (k / vf) * lengthM;
    const al = (radScale * monopoleRadiationResistance(k * lengthM) + lossOhms) / z0;
    // coth(x + iy) = (sinh 2x − i sin 2y) / (cosh 2x − cos 2y)
    const den = Math.cosh(2 * al) - Math.cos(2 * bl);
    return [z0 * Math.sinh(2 * al) / den, -z0 * Math.sin(2 * bl) / den];
}

// setup: { vf, counterpoise: { kind: 'wire', lengthM } | { kind: 'radials' } }
export function counterpoiseImpedance(freqMHz, setup) {
    const cp = setup.counterpoise;
    if (!cp || cp.kind === 'radials' || !(cp.lengthM > 0)) return [MODEL.radialsOhms, 0];
    const vf = setup.vf * MODEL.cpVfRatio;
    return wireImpedance(cp.lengthM, freqMHz, vf, MODEL.cpZ0, MODEL.cpLossOhms, MODEL.cpRadScale);
}

export function feedImpedance(lengthM, freqMHz, setup, cpZ = counterpoiseImpedance(freqMHz, setup)) {
    const w = wireImpedance(lengthM, freqMHz, setup.vf, MODEL.wireZ0, MODEL.wireLossOhms, MODEL.wireRadScale);
    return [w[0] + cpZ[0], w[1] + cpZ[1]];
}

// SWR on 50 ohm coax after an n:1 impedance transformer.
export function swrAfterTransformer([r, x], ratio, refOhms = 50) {
    const zr = r / ratio, zx = x / ratio;
    const nr = zr - refOhms, dr = zr + refOhms;
    const g = Math.sqrt((nr * nr + zx * zx) / (dr * dr + zx * zx));
    return g >= 0.9999 ? 19999 : (1 + g) / (1 - g);
}

// Mark from 0 to 1 for one frequency: about 1 well inside the tuner's range, 0.5 at its SWR
// limit, towards 0 beyond it. Smooth, so the score curve has clean peaks.
export function frequencyMark(swr, maxSwr) {
    const u = Math.log(swr) / Math.log(maxSwr);
    return 1 / (1 + u ** 4);
}

// Frequencies to test across a band (all segments, edges included). Wider bands get more.
export function sampleFrequencies(segments) {
    const out = [];
    for (const [lo, hi] of segments) {
        const rel = (hi - lo) / ((hi + lo) / 2);
        const n = Math.min(25, Math.max(3, Math.ceil(rel * 150) + 1));
        for (let i = 0; i < n; i++) out.push(lo + (hi - lo) * i / (n - 1));
    }
    return out;
}

// Everything that stays fixed while the wire length varies.
// bands: [{ name, segments: [[lo, hi], ...] }]
export function makeContext(bands, setup, { ratio, maxSwr }) {
    return {
        setup, ratio, maxSwr,
        bands: bands.map(b => {
            const freqs = sampleFrequencies(b.segments);
            return { name: b.name, segments: b.segments, freqs, cpZ: freqs.map(f => counterpoiseImpedance(f, setup)) };
        }),
    };
}

// Detailed result for one length, for the per-band table.
export function evaluateLength(lengthM, ctx) {
    const bands = ctx.bands.map(b => {
        let markSum = 0, ok = 0, swrMin = Infinity, swrMax = 0, zMin = Infinity, zMax = 0, worstFreq = null;
        b.freqs.forEach((f, i) => {
            const z = feedImpedance(lengthM, f, ctx.setup, b.cpZ[i]);
            const s = swrAfterTransformer(z, ctx.ratio);
            const zmag = Math.hypot(z[0], z[1]);
            markSum += frequencyMark(s, ctx.maxSwr);
            if (s <= ctx.maxSwr) ok++;
            if (s < swrMin) swrMin = s;
            if (s > swrMax) { swrMax = s; worstFreq = f; }
            zMin = Math.min(zMin, zmag);
            zMax = Math.max(zMax, zmag);
        });
        const n = b.freqs.length;
        return { name: b.name, segments: b.segments, score: 100 * markSum / n, inRange: ok / n, swrMin, swrMax, zMin, zMax, worstFreq };
    });
    const score = bands.length ? bands.reduce((a, b) => a + b.score, 0) / bands.length : 0;
    return { lengthM, score, bands };
}

// Log-spaced lengths, 0.2% apart: finer than anyone cuts wire.
export function sweepLengths(minM, maxM, step = 1.002) {
    const out = [];
    for (let L = minM; L < maxM; L *= step) out.push(L);
    out.push(maxM);
    return out;
}

// Score at every length, with per-band scores and SWR ranges for the heatmap and hover.
export function sweep(ctx, lengths) {
    const nb = ctx.bands.length;
    const scores = new Float64Array(lengths.length);
    const bandScores = ctx.bands.map(() => new Float64Array(lengths.length));
    const bandSwrMin = ctx.bands.map(() => new Float64Array(lengths.length));
    const bandSwrMax = ctx.bands.map(() => new Float64Array(lengths.length));
    lengths.forEach((L, j) => {
        let total = 0;
        ctx.bands.forEach((b, bi) => {
            let markSum = 0, lo = Infinity, hi = 0;
            for (let i = 0; i < b.freqs.length; i++) {
                const s = swrAfterTransformer(feedImpedance(L, b.freqs[i], ctx.setup, b.cpZ[i]), ctx.ratio);
                markSum += frequencyMark(s, ctx.maxSwr);
                if (s < lo) lo = s;
                if (s > hi) hi = s;
            }
            const bs = 100 * markSum / b.freqs.length;
            bandScores[bi][j] = bs;
            bandSwrMin[bi][j] = lo;
            bandSwrMax[bi][j] = hi;
            total += bs;
        });
        scores[j] = nb ? total / nb : 0;
    });
    return { lengths, scores, bandScores, bandSwrMin, bandSwrMax };
}

// Best local maxima of the score curve, at least `spacing` (fraction) apart, so near-identical
// lengths are not listed twice. Each gets the range around it where the score stays within
// `tolerance` points: any length in that range is about as good. The range stops at the next
// dip in the curve, so it never runs into a neighbouring peak's range.
export function pickSuggestions(sw, { count = 10, spacing = 0.05, tolerance = 3, minM = -Infinity, maxM = Infinity } = {}) {
    const { lengths: L, scores: s } = sw;
    const peaks = [];
    for (let i = 0; i < L.length; i++) {
        if (L[i] < minM || L[i] > maxM) continue;
        const left = i === 0 || L[i - 1] < minM ? -Infinity : s[i - 1];
        const right = i === L.length - 1 || L[i + 1] > maxM ? -Infinity : s[i + 1];
        if (s[i] >= left && s[i] > right) peaks.push(i);
    }
    // Drop bumps that barely rise above the curve around them (prominence under 1 point):
    // on a smooth slope they are not meaningfully better than their neighbours.
    const inRange = i => i >= 0 && i < L.length && L[i] >= minM && L[i] <= maxM;
    const prominence = i => {
        let lo = s[i], loL = s[i], loR = s[i];
        for (let k = i - 1; inRange(k) && s[k] <= s[i]; k--) loL = Math.min(loL, s[k]);
        for (let k = i + 1; inRange(k) && s[k] <= s[i]; k++) loR = Math.min(loR, s[k]);
        lo = Math.max(loL, loR);
        return s[i] - lo;
    };
    const isEdge = i => !inRange(i - 1) || !inRange(i + 1);
    for (let k = peaks.length - 1; k >= 0; k--) {
        if (!isEdge(peaks[k]) && prominence(peaks[k]) < 1) peaks.splice(k, 1);
    }
    peaks.sort((a, b) => s[b] - s[a]);
    const chosen = [];
    for (const i of peaks) {
        if (chosen.length >= count) break;
        if (chosen.some(j => Math.abs(Math.log(L[i] / L[j])) < Math.log1p(spacing))) continue;
        chosen.push(i);
    }
    return chosen.map((i, rank) => {
        let a = i, b = i;
        while (a > 0 && L[a - 1] >= minM && s[a - 1] >= s[i] - tolerance && s[a - 1] <= s[a]) a--;
        while (b < L.length - 1 && L[b + 1] <= maxM && s[b + 1] >= s[i] - tolerance && s[b + 1] <= s[b]) b++;
        return { rank: rank + 1, index: i, lengthM: L[i], score: s[i], fromM: L[a], toM: L[b] };
    });
}

// Share of lengths in [minM, maxM] scoring below `score` (0 to 1).
export function percentileOf(sw, score, minM, maxM) {
    let below = 0, n = 0;
    sw.lengths.forEach((L, i) => {
        if (L < minM || L > maxM) return;
        n++;
        if (sw.scores[i] < score) below++;
    });
    return n ? below / n : null;
}

// Bands where the counterpoise is within 6% of a multiple of a half wavelength. Beyond about
// 6% the NEC sweeps showed little effect on that band's SWR.
export function counterpoiseWarnings(ctx) {
    const cp = ctx.setup.counterpoise;
    if (!cp || cp.kind !== 'wire' || !(cp.lengthM > 0)) return new Map();
    const vf = ctx.setup.vf * MODEL.cpVfRatio;
    const out = new Map();
    for (const b of ctx.bands) {
        for (const f of b.freqs) {
            const halves = cp.lengthM / (C_MPS * vf / (f * 1e6) / 2);
            const n = Math.round(halves);
            if (n >= 1 && Math.abs(halves - n) / n < 0.06) { out.set(b.name, n); break; }
        }
    }
    return out;
}
