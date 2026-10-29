import { BAND_ORDER, REGIONS, guessRegion, formatSegments } from './bands.js';
import { PRESETS, presetLengthsFeet } from './presets.js';
import { parseLength, formatFeetInches, METRES_PER_FOOT, trim } from './units.js';
import {
    makeContext, sweep, sweepLengths, pickSuggestions, evaluateLength, percentileOf, counterpoiseWarnings,
} from './model.js';
import { drawChart, fmtSwr } from './chart.js';

const $ = id => document.getElementById(id);

const DEFAULT_BANDS = ['160m', '80m', '40m', '30m', '20m', '17m', '15m', '12m', '10m'];
const DEFAULTS = {
    region: guessRegion(), bands: DEFAULT_BANDS, min: '7', max: '60', wire: '0.96', vf: '0.95',
    matching: '9', tuner: '10', cp: 'wire', cpLen: '5', count: '10', spacing: '5', units: 'm', log: true,
    check: '', compare: '',
};
// Suggestions are cut between lengths that score within this many points of the suggestion.
const TOLERANCE = 3;

let sortKey = 'rank', sortDir = 1;
let suppressHash = false;
let last = null;

function init() {
    const regionSel = $('region');
    for (const [key, r] of Object.entries(REGIONS)) regionSel.add(new Option(r.name, key));
    const compareSel = $('compare');
    for (const [key, p] of Object.entries(PRESETS)) compareSel.add(new Option(p.name, key));

    applyHash();
    buildBandList();

    document.querySelectorAll('.settings input, .settings select, #compare').forEach(el => {
        el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', () => {
            if (el.id === 'region') buildBandList();
            update();
        });
    });
    $('checkLen').addEventListener('input', update);
    $('reset').addEventListener('click', () => { setControls(DEFAULTS); buildBandList(); update(); });
    $('suggestions').querySelector('thead').addEventListener('click', ev => {
        const key = ev.target.closest('th')?.dataset.sort;
        if (!key) return;
        sortDir = key === sortKey ? -sortDir : (key === 'score' ? -1 : 1);
        sortKey = key;
        renderSuggestions();
    });
    window.addEventListener('hashchange', () => { if (!suppressHash) { applyHash(); buildBandList(); update(); } });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => last && renderChart());
    update();
}

// Band checkboxes for the chosen region; bands the region lacks (60m in VK) are hidden.
function buildBandList() {
    const region = REGIONS[$('region').value];
    const list = $('bandList');
    const checked = new Set(selectedBandNames());
    if (!list.dataset.built) {
        for (const b of BAND_ORDER) {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" value="${b}"> ${b}`;
            label.querySelector('input').addEventListener('change', update);
            list.appendChild(label);
        }
        list.dataset.built = '1';
        const initial = new Set(list.dataset.initial ? list.dataset.initial.split(',') : DEFAULT_BANDS);
        list.querySelectorAll('input').forEach(cb => { cb.checked = initial.has(cb.value); });
    } else if (checked.size) {
        list.querySelectorAll('input').forEach(cb => { cb.checked = checked.has(cb.value); });
    }
    list.querySelectorAll('label').forEach(label => {
        const b = label.querySelector('input').value;
        const segs = region.bands[b];
        label.classList.toggle('hidden', !segs);
        label.title = segs ? formatSegments(segs) : '';
    });
}

function selectedBandNames() {
    return Array.from($('bandList').querySelectorAll('input:checked')).map(cb => cb.value);
}

function readSettings() {
    const region = REGIONS[$('region').value];
    const bands = selectedBandNames().filter(b => region.bands[b]).map(b => ({ name: b, segments: region.bands[b] }));
    const minP = parseLength($('minLen').value), maxP = parseLength($('maxLen').value);
    setInvalid($('minLen'), !minP || !(minP.metres > 0));
    setInvalid($('maxLen'), !maxP || !(maxP.metres > 0));
    let min = minP && minP.metres > 0 ? minP.metres : 7;
    let max = maxP && maxP.metres > 0 ? maxP.metres : 60;
    let rangeNote = '';
    if (!minP || !(minP.metres > 0)) rangeNote = notALength($('minLen').value);
    else if (!maxP || !(maxP.metres > 0)) rangeNote = notALength($('maxLen').value);
    if (min > max) { [min, max] = [max, min]; rangeNote = `Showing ${fmtLen(min)} to ${fmtLen(max)} (from and to swapped).`; }
    if (max / min < 1.01) max = min * 1.01;

    const wire = $('wireType').value;
    $('vfCustom').classList.toggle('hidden', wire !== 'custom');
    let vf = parseFloat(wire === 'custom' ? $('vfCustom').value : wire);
    setInvalid($('vfCustom'), wire === 'custom' && !(vf > 0.3 && vf <= 1));
    if (!(vf > 0.3 && vf <= 1)) vf = 0.95;

    const cpKind = $('cpKind').value;
    $('cpLen').classList.toggle('hidden', cpKind !== 'wire');
    $('cpUnit').classList.toggle('hidden', cpKind !== 'wire');
    const cpP = parseLength($('cpLen').value);
    setInvalid($('cpLen'), cpKind === 'wire' && !(cpP && cpP.metres > 0));
    const counterpoise = cpKind === 'wire' && cpP && cpP.metres > 0
        ? { kind: 'wire', lengthM: cpP.metres, isFeet: cpP.isFeet } : { kind: 'radials' };

    return {
        bands, min, max, rangeNote, minFeet: !!minP?.isFeet, maxFeet: !!maxP?.isFeet,
        setup: { vf, counterpoise },
        ratio: Number($('matching').value), maxSwr: Number($('tuner').value),
        count: clampInt($('count').value, 1, 40, 10),
        spacing: Math.max(0, parseFloat($('spacing').value) || 0) / 100,
        units: $('units').value, log: $('logAxis').checked,
        compare: $('compare').value,
    };
}

function update() {
    const s = readSettings();
    $('rangeNote').textContent = s.rangeNote;
    if (!s.bands.length) {
        last = null;
        Plotly.purge($('plot'));
        $('chartSummary').textContent = '';
        $('checkResult').textContent = '';
        emptyTable('suggestions', 7, 'No bands selected. Select at least one band.');
        emptyTable('bandTable', 7, 'No bands selected. Select at least one band.');
        $('compareSection').classList.add('hidden');
        updateHash();
        return;
    }
    const ctx = makeContext(s.bands, s.setup, { ratio: s.ratio, maxSwr: s.maxSwr });

    const presetFeet = s.compare ? presetLengthsFeet(s.compare) : [];
    const presetM = presetFeet.map(f => f * METRES_PER_FOOT);
    const check = readCheck();
    // The chart covers the user's range, plus any comparison or checked lengths outside it.
    const extra = [...presetM, ...(check.metres ? [check.metres] : [])];
    const lo = Math.min(s.min, ...extra.map(m => m / 1.03));
    const hi = Math.max(s.max, ...extra.map(m => m * 1.03));
    const sw = sweep(ctx, sweepLengths(lo, hi));
    const suggestions = pickSuggestions(sw, { count: s.count, spacing: s.spacing, tolerance: TOLERANCE, minM: s.min, maxM: s.max });
    const details = new Map(suggestions.map(sg => [sg.rank, evaluateLength(sg.lengthM, ctx)]));
    const presets = presetM.map((m, i) => ({ feet: presetFeet[i], lengthM: m, ...evaluateLength(m, ctx) }));
    const checked = check.metres ? evaluateLength(check.metres, ctx) : null;

    last = { s, ctx, sw, suggestions, details, presets, checked, check };
    renderCheck();
    renderChart();
    renderSuggestions();
    renderCompare();
    renderBands();
    updateHash();
}

function readCheck() {
    const raw = $('checkLen').value;
    if (!raw.trim()) { setInvalid($('checkLen'), false); return { metres: null, raw }; }
    const p = parseLength(raw);
    const ok = p && p.metres > 0.5 && p.metres < 2000;
    setInvalid($('checkLen'), !ok);
    return ok ? { metres: p.metres, isFeet: p.isFeet, raw } : { metres: null, raw, error: notALength(raw) };
}

function renderCheck() {
    const { s, sw, checked, check, suggestions } = last;
    const out = $('checkResult');
    if (check.error) { out.innerHTML = `<span class="error">${esc(check.error)}</span>`; return; }
    if (!checked) { out.textContent = ''; return; }
    const ok = checked.bands.filter(b => b.inRange >= 1).length;
    const head = `${fmtM(checked.lengthM)} (${formatFeetInches(checked.lengthM)}): score ${checked.score.toFixed(0)}`;
    const bandsTxt = `${ok} of ${checked.bands.length} bands in tuner range.`;
    if (checked.lengthM < s.min || checked.lengthM > s.max) {
        out.textContent = `${head}, ${bandsTxt} Outside the length range (${fmtLen(s.min)} to ${fmtLen(s.max)}), so not compared with other lengths.`;
        return;
    }
    const pct = Math.round(100 * percentileOf(sw, checked.score, s.min, s.max));
    const rangeTxt = `${fmtLen(s.min)} to ${fmtLen(s.max)}`;
    const rank = pct >= 100 ? `the highest score from ${rangeTxt}` : `better than ${pct}% of lengths from ${rangeTxt}`;
    const near = nearestSuggestion(checked.lengthM, suggestions);
    const isSuggestion = near && Math.abs(near.lengthM / checked.lengthM - 1) < 0.001;
    const nearTxt = !near ? '' : isSuggestion ? ` Suggestion #${near.rank}.`
        : ` Nearest suggestion: #${near.rank}, ${fmtM(near.lengthM)}, score ${near.score.toFixed(0)}.`;
    out.textContent = `${head}, ${rank}. ${bandsTxt}${nearTxt}`;
}

function nearestSuggestion(m, suggestions) {
    let best = null;
    for (const sg of suggestions) {
        if (!best || Math.abs(Math.log(sg.lengthM / m)) < Math.abs(Math.log(best.lengthM / m))) best = sg;
    }
    return best;
}

function renderChart() {
    const { s, sw, suggestions, presets, checked, ctx } = last;
    const top = suggestions[0];
    $('chartSummary').textContent = top
        ? `Best score between ${fmtLen(s.min)} and ${fmtLen(s.max)}: ${top.score.toFixed(0)} at ${fmtM(top.lengthM)} (${formatFeetInches(top.lengthM)}). Lower panel: each band's score; blue is inside your tuner's limit, red is beyond it.`
        : '';
    drawChart($('plot'), {
        sw, bands: ctx.bands.map(b => b.name), suggestions, presets, checked,
        presetName: s.compare ? PRESETS[s.compare].name : '', range: { min: s.min, max: s.max },
    }, { units: s.units, log: s.log }, m => { $('checkLen').value = trim(m, 2); update(); });
}

function renderSuggestions() {
    if (!last) return;
    const { s, suggestions, details, checked } = last;
    $('suggestionsTitle').textContent = `Suggested lengths (${suggestions.length})`;
    $('suggestionsNote').textContent = suggestions.length
        ? `Between ${fmtLen(s.min)} and ${fmtLen(s.max)}, at least ${trim(s.spacing * 100, 1)}% apart. Click a row to see it band by band.`
        : '';
    document.querySelectorAll('#suggestions th[data-sort]').forEach(th => {
        th.setAttribute('aria-sort', th.dataset.sort === sortKey ? (sortDir > 0 ? 'ascending' : 'descending') : 'none');
    });
    if (!suggestions.length) {
        emptyTable('suggestions', 7, `No suggested lengths between ${fmtLen(s.min)} and ${fmtLen(s.max)}. Widen the length range.`);
        return;
    }
    const key = { rank: g => g.rank, length: g => g.lengthM, score: g => g.score }[sortKey];
    const rows = [...suggestions].sort((a, b) => sortDir * (key(a) - key(b)));
    const tbody = $('suggestions').querySelector('tbody');
    tbody.innerHTML = '';
    for (const g of rows) {
        const d = details.get(g.rank);
        const ok = d.bands.filter(b => b.inRange >= 1).length;
        const worst = d.bands.reduce((w, b) => (!w || b.score < w.score ? b : w), null);
        const tr = document.createElement('tr');
        tr.className = 'clickable';
        if (checked && Math.abs(checked.lengthM - g.lengthM) < 0.005) tr.classList.add('selected');
        tr.innerHTML = `
            <td class="num">${g.rank}</td>
            <td class="num">${fmtM(g.lengthM)}</td>
            <td class="num">${formatFeetInches(g.lengthM)}</td>
            <td class="num">${fmtRange(g.fromM, g.toM, s.units)}</td>
            <td class="num">${scoreCell(g.score)}</td>
            <td class="num">${ok} of ${d.bands.length}</td>
            <td>${worst ? `${worst.name} (SWR up to ${fmtSwr(worst.swrMax)})` : ''}</td>`;
        tr.addEventListener('click', () => { $('checkLen').value = trim(g.lengthM, 2); update(); });
        tbody.appendChild(tr);
    }
}

function renderCompare() {
    const { s, presets, suggestions } = last;
    const sec = $('compareSection');
    if (!s.compare) { sec.classList.add('hidden'); return; }
    sec.classList.remove('hidden');
    const p = PRESETS[s.compare];
    $('compareTitle').textContent = `Compared with: ${p.name} (${presets.length} lengths)`;
    const best = presets.reduce((b, x) => (!b || x.score > b.score ? x : b), null);
    $('compareNote').innerHTML = `Scored with your settings. Best published length: ${best.feet} ft, score ${best.score.toFixed(0)}.`
        + (p.url ? ` <a href="${p.url}">Source</a>.` : '');
    const tbody = $('compareTable').querySelector('tbody');
    tbody.innerHTML = '';
    for (const x of presets) {
        const ok = x.bands.filter(b => b.inRange >= 1).length;
        const worst = x.bands.reduce((w, b) => (!w || b.score < w.score ? b : w), null);
        const near = nearestSuggestion(x.lengthM, suggestions);
        const outside = x.lengthM < s.min || x.lengthM > s.max;
        const tr = document.createElement('tr');
        tr.className = 'clickable';
        tr.innerHTML = `
            <td class="num">${x.feet} ft</td>
            <td class="num">${fmtM(x.lengthM)}</td>
            <td class="num">${scoreCell(x.score)}</td>
            <td class="num">${ok} of ${x.bands.length}</td>
            <td>${worst ? `${worst.name} (SWR up to ${fmtSwr(worst.swrMax)})` : ''}</td>
            <td>${outside ? '<span class="muted">outside the length range</span>' : near ? `#${near.rank}, ${fmtM(near.lengthM)}, score ${near.score.toFixed(0)}` : ''}</td>`;
        tr.addEventListener('click', () => { $('checkLen').value = trim(x.lengthM, 2); update(); });
        tbody.appendChild(tr);
    }
}

// Band-by-band detail for the checked length, or for the top suggestion when none is checked.
function renderBands() {
    const { checked, suggestions, details, ctx, s } = last;
    const ev = checked || (suggestions[0] && details.get(1));
    if (!ev) { emptyTable('bandTable', 7, 'Enter a length in "Check a length" to see it band by band.'); return; }
    $('bandTitle').textContent = checked
        ? `Band by band: ${fmtM(ev.lengthM)}`
        : `Band by band: ${fmtM(ev.lengthM)} (suggestion 1)`;
    const warnings = counterpoiseWarnings(ctx);
    const cp = s.setup.counterpoise;
    const tbody = $('bandTable').querySelector('tbody');
    tbody.innerHTML = '';
    for (const b of ev.bands) {
        const share = b.inRange >= 1 ? 'Whole band' : b.inRange > 0 ? `${Math.round(b.inRange * 100)}% of band` : '<span class="none">None</span>';
        const notes = [];
        if (warnings.has(b.name)) {
            notes.push(`Counterpoise near a half-wave multiple on ${b.name}: a ${fmtCp(cp)} counterpoise raises the SWR on ${b.name} at every wire length.`);
        }
        if (b.inRange < 1) notes.push(`Highest SWR at ${trim(b.worstFreq, 3)} MHz.`);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${b.name}</td>
            <td>${formatSegments(b.segments)}</td>
            <td class="num">${scoreCell(b.score)}</td>
            <td class="num">${b.swrMin.toFixed(1)} to ${fmtSwr(b.swrMax)}</td>
            <td class="num">${fmtOhms(b.zMin)} to ${fmtOhms(b.zMax)}</td>
            <td class="num">${share}</td>
            <td class="note">${notes.join(' ')}</td>`;
        tbody.appendChild(tr);
    }
}

function scoreCell(score) {
    const v = Math.max(0, Math.min(100, score));
    return `<span class="score-cell">${score.toFixed(0)}<span class="score-bar" aria-hidden="true"><span style="width:${v}%"></span></span></span>`;
}

function emptyTable(id, cols, text) {
    $(id).querySelector('tbody').innerHTML = `<tr><td colspan="${cols}" class="empty">${esc(text)}</td></tr>`;
}

// ---- formatting

function fmtM(m) { return `${m.toFixed(2)} m`; }
function fmtLen(m) {
    return $('units').value === 'ft' ? `${Math.round(m / METRES_PER_FOOT)} ft` : `${trim(m, 2)} m`;
}
function fmtRange(a, b, units) {
    return units === 'ft'
        ? `${(a / METRES_PER_FOOT).toFixed(1)} to ${(b / METRES_PER_FOOT).toFixed(1)} ft`
        : `${a.toFixed(2)} to ${b.toFixed(2)} m`;
}
function fmtOhms(z) { return z >= 1000 ? `${(z / 1000).toFixed(1)} kΩ` : `${Math.round(z)} Ω`; }
function fmtCp(cp) { return cp.isFeet ? `${trim(cp.lengthM / METRES_PER_FOOT, 1)} ft` : `${trim(cp.lengthM, 2)} m`; }
function notALength(raw) { return `Not a length: "${raw}". Enter metres, such as 20.5, or feet, such as 67ft.`; }
function esc(t) { return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function setInvalid(el, bad) { el.setAttribute('aria-invalid', bad ? 'true' : 'false'); }
function clampInt(v, lo, hi, dflt) { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt; }

// ---- URL hash: settings that differ from the defaults, plus the region (its default depends
// on the viewer's time zone). Old links (vf, scale, results, preset, wire) still work.

function currentControls() {
    return {
        region: $('region').value, bands: selectedBandNames(), min: $('minLen').value.trim(), max: $('maxLen').value.trim(),
        wire: $('wireType').value, vf: $('vfCustom').value.trim(), matching: $('matching').value, tuner: $('tuner').value,
        cp: $('cpKind').value, cpLen: $('cpLen').value.trim(), count: $('count').value, spacing: $('spacing').value,
        units: $('units').value, log: $('logAxis').checked, check: $('checkLen').value.trim(), compare: $('compare').value,
    };
}

function setControls(c) {
    $('region').value = c.region;
    $('minLen').value = c.min; $('maxLen').value = c.max;
    $('wireType').value = c.wire; $('vfCustom').value = c.vf;
    $('matching').value = c.matching; $('tuner').value = c.tuner;
    $('cpKind').value = c.cp; $('cpLen').value = c.cpLen;
    $('count').value = c.count; $('spacing').value = c.spacing;
    $('units').value = c.units; $('logAxis').checked = c.log;
    $('checkLen').value = c.check; $('compare').value = c.compare;
    const list = $('bandList');
    const want = new Set(c.bands);
    if (list.dataset.built) list.querySelectorAll('input').forEach(cb => { cb.checked = want.has(cb.value); });
    else list.dataset.initial = c.bands.join(',');
}

function updateHash() {
    if (suppressHash) return;
    const c = currentControls();
    const p = new URLSearchParams();
    p.set('region', c.region);
    if (c.bands.join('-') !== DEFAULTS.bands.join('-')) p.set('bands', c.bands.length ? c.bands.join('-') : 'none');
    if (c.min !== DEFAULTS.min) p.set('min', c.min);
    if (c.max !== DEFAULTS.max) p.set('max', c.max);
    if (c.wire !== DEFAULTS.wire) p.set('wire', c.wire === 'custom' ? 'custom' : c.wire);
    if (c.wire === 'custom') p.set('vf', c.vf);
    if (c.matching !== DEFAULTS.matching) p.set('match', c.matching);
    if (c.tuner !== DEFAULTS.tuner) p.set('tuner', c.tuner);
    if (c.cp !== DEFAULTS.cp) p.set('cp', c.cp);
    else if (c.cpLen !== DEFAULTS.cpLen) p.set('cp', c.cpLen);
    if (c.count !== DEFAULTS.count) p.set('results', c.count);
    if (c.spacing !== DEFAULTS.spacing) p.set('spacing', c.spacing);
    if (c.units !== DEFAULTS.units) p.set('units', c.units);
    if (!c.log) p.set('scale', 'linear');
    if (c.check) p.set('check', c.check);
    if (c.compare) p.set('compare', c.compare);
    const hash = '#' + p.toString();
    if (hash !== location.hash) {
        suppressHash = true;
        history.replaceState(null, '', location.pathname + location.search + hash);
        suppressHash = false;
    }
}

function applyHash() {
    const p = new URLSearchParams(location.hash.replace(/^#/, ''));
    const c = { ...DEFAULTS, bands: [...DEFAULTS.bands] };
    if (REGIONS[p.get('region')]) c.region = p.get('region');
    const bands = p.get('bands');
    if (bands === 'all') c.bands = [...BAND_ORDER];
    else if (bands === 'none') c.bands = [];
    else if (bands) c.bands = bands.split('-').filter(b => BAND_ORDER.includes(b));
    if (p.has('min')) c.min = p.get('min');
    if (p.has('max')) c.max = p.get('max');
    const wire = p.get('wire');
    const vf = p.get('vf');
    if (wire && ['0.99', '0.96', '0.93', 'custom'].includes(wire)) c.wire = wire;
    else if (wire && parseLength(wire)) c.check = wire; // old links: wire=<one length>
    if (vf) { c.wire = 'custom'; c.vf = vf; }
    if (['1', '4', '9', '49', '64'].includes(p.get('match'))) c.matching = p.get('match');
    if (['2', '3', '10'].includes(p.get('tuner'))) c.tuner = p.get('tuner');
    const cp = p.get('cp');
    if (cp === 'radials') c.cp = 'radials';
    else if (cp) { c.cp = 'wire'; c.cpLen = cp; }
    if (p.has('results')) c.count = p.get('results');
    if (p.has('spacing')) c.spacing = p.get('spacing');
    if (p.get('units') === 'ft') c.units = 'ft';
    if (p.get('scale') === 'linear') c.log = false;
    if (p.has('check')) c.check = p.get('check');
    const compare = p.get('compare') || p.get('preset');
    if (compare && PRESETS[compare]) c.compare = compare;
    else if (compare === 'sprott_feet') c.compare = 'sprott';
    setControls(c);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
