import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    cisi, dipoleRadiationResistance, monopoleRadiationResistance, feedImpedance,
    swrAfterTransformer, frequencyMark, sampleFrequencies, makeContext, sweep, sweepLengths,
    pickSuggestions, evaluateLength, counterpoiseWarnings,
} from '../docs/js/model.js';

const close = (a, b, rel, msg) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b) + 1e-9, `${msg}: ${a} vs ${b}`);

test('sine and cosine integrals match tabulated values', () => {
    close(cisi(1).si, 0.946083070367, 1e-9, 'Si(1)');
    close(cisi(1).ci, 0.337403922901, 1e-9, 'Ci(1)');
    close(cisi(10).si, 1.658347594219, 1e-9, 'Si(10)');
    close(cisi(10).ci, -0.045456433004, 1e-7, 'Ci(10)');
});

test('radiation resistance: half-wave dipole 73 ohms, quarter-wave monopole 36.5 ohms', () => {
    close(dipoleRadiationResistance(Math.PI), 73.13, 0.002, 'dipole');
    close(monopoleRadiationResistance(Math.PI / 2), 36.56, 0.003, 'monopole');
});

test('feedpoint impedance matches the Python reference model (model/tlmodel.py)', () => {
    const setup = { vf: 0.9918, counterpoise: { kind: 'wire', lengthM: 5 } };
    const ref = [[10, 7.1, 44.37, -428.92], [20, 7.1, 1622.11, 819.34], [37.2, 14.2, 78.88, 75.47],
        [12.5, 3.6, 43.55, -1270.29], [60, 28.5, 3466.51, -164.8]];
    for (const [L, f, r, x] of ref) {
        const [zr, zx] = feedImpedance(L, f, setup);
        const err = Math.hypot(zr - r, zx - x) / Math.hypot(r, x);
        assert.ok(err < 0.01, `${L} m at ${f} MHz: got ${zr.toFixed(1)}${zx.toFixed(1)}j, want ${r}${x}j`);
    }
});

test('SWR and marks', () => {
    close(swrAfterTransformer([450, 0], 9), 1, 1e-9, '450 ohms through 9:1');
    close(swrAfterTransformer([100, 0], 1), 2, 1e-9, '100 ohms direct');
    close(frequencyMark(10, 10), 0.5, 1e-12, 'mark at the limit');
    assert.ok(frequencyMark(1.5, 10) > 0.99);
    assert.ok(frequencyMark(100, 10) < 0.1);
});

test('band sampling includes both edges of every segment', () => {
    const f = sampleFrequencies([[3.5, 3.7], [3.776, 3.8]]);
    for (const edge of [3.5, 3.7, 3.776, 3.8]) assert.ok(f.includes(edge), `edge ${edge}`);
});

test('suggestions are spaced apart and lie inside their cut range', () => {
    const bands = [{ name: '40m', segments: [[7.0, 7.3]] }, { name: '20m', segments: [[14.0, 14.35]] }];
    const ctx = makeContext(bands, { vf: 0.96, counterpoise: { kind: 'wire', lengthM: 5 } }, { ratio: 9, maxSwr: 10 });
    const sw = sweep(ctx, sweepLengths(7, 60));
    const picks = pickSuggestions(sw, { count: 8, spacing: 0.05 });
    assert.ok(picks.length >= 3);
    for (let i = 0; i < picks.length; i++) {
        assert.ok(picks[i].fromM <= picks[i].lengthM && picks[i].lengthM <= picks[i].toM);
        if (i) assert.ok(picks[i].score <= picks[i - 1].score);
        for (let j = 0; j < i; j++) assert.ok(Math.abs(Math.log(picks[i].lengthM / picks[j].lengthM)) >= Math.log(1.05) - 1e-9);
    }
    const ev = evaluateLength(picks[0].lengthM, ctx);
    close(ev.score, picks[0].score, 1e-9, 'evaluateLength agrees with sweep');
});

test('a 5 m counterpoise is flagged on 10m, not on 40m', () => {
    const bands = [{ name: '40m', segments: [[7.0, 7.3]] }, { name: '10m', segments: [[28.0, 29.7]] }];
    const ctx = makeContext(bands, { vf: 0.99, counterpoise: { kind: 'wire', lengthM: 5 } }, { ratio: 9, maxSwr: 10 });
    const w = counterpoiseWarnings(ctx);
    assert.ok(w.has('10m'));
    assert.ok(!w.has('40m'));
});
