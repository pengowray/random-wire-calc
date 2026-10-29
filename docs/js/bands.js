// Amateur HF band edges (MHz) by region. A band can have several segments.
// VK: WIA band plan 2026 poster (Advanced licence). 60m is not allocated in VK.
// USA: FCC Part 97. 60m is five channels; one segment spanning them is close enough here.
// Region 1 and 3: IARU band plans; individual countries differ.

export const BAND_ORDER = ['160m', '80m', '60m', '40m', '30m', '20m', '17m', '15m', '12m', '10m', '6m'];

const COMMON = {
    '30m': [[10.1, 10.15]],
    '20m': [[14.0, 14.35]],
    '17m': [[18.068, 18.168]],
    '15m': [[21.0, 21.45]],
    '12m': [[24.89, 24.99]],
    '10m': [[28.0, 29.7]],
};

export const REGIONS = {
    vk: {
        name: 'Australia (VK)',
        bands: { '160m': [[1.8, 1.875]], '80m': [[3.5, 3.7], [3.776, 3.8]], '40m': [[7.0, 7.3]], ...COMMON, '6m': [[50.0, 54.0]] },
    },
    us: {
        name: 'USA',
        bands: { '160m': [[1.8, 2.0]], '80m': [[3.5, 4.0]], '60m': [[5.3305, 5.4065]], '40m': [[7.0, 7.3]], ...COMMON, '6m': [[50.0, 54.0]] },
    },
    r1: {
        name: 'IARU Region 1 (Europe, Africa)',
        bands: { '160m': [[1.81, 2.0]], '80m': [[3.5, 3.8]], '60m': [[5.3515, 5.3665]], '40m': [[7.0, 7.2]], ...COMMON, '6m': [[50.0, 52.0]] },
    },
    r3: {
        name: 'IARU Region 3 (Asia, Pacific)',
        bands: { '160m': [[1.8, 2.0]], '80m': [[3.5, 3.9]], '60m': [[5.3515, 5.3665]], '40m': [[7.0, 7.2]], ...COMMON, '6m': [[50.0, 54.0]] },
    },
};

// Best guess from the browser's time zone; the dropdown shows the choice.
export function guessRegion() {
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* no Intl */ }
    if (tz.startsWith('Australia/')) return 'vk';
    if (tz.startsWith('Europe/') || tz.startsWith('Africa/')) return 'r1';
    if (tz.startsWith('Asia/') || tz.startsWith('Pacific/')) return 'r3';
    return 'us';
}

export function formatSegments(segments) {
    return segments.map(([lo, hi]) => `${trimMHz(lo)}–${trimMHz(hi)}`).join(', ') + ' MHz';
}

function trimMHz(v) {
    return String(Number(v.toFixed(4)));
}
