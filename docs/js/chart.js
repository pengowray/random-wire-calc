// Plotly chart: score line (top) and a band-by-length heatmap (bottom), sharing one length axis.
import { METRES_PER_FOOT, formatFeetInches } from './units.js';

function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Diverging blue-red around the tuner's limit (score 50): blue inside the limit, grey at it,
// red beyond it. Dark mode uses a dark grey midpoint so "at the limit" recedes.
function heatScale() {
    const dark = matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme !== 'light'
        || document.documentElement.dataset.theme === 'dark';
    const mid = dark ? '#383835' : '#f0efec';
    return [
        [0, dark ? '#e66767' : '#b8302f'],
        [0.25, dark ? '#a84040' : '#e98a86'],
        [0.5, mid],
        [0.75, dark ? '#256abf' : '#86b6ef'],
        [1, dark ? '#86b6ef' : '#1c5cab'],
    ];
}

export function drawChart(el, data, opts, onPick) {
    const toX = m => opts.units === 'ft' ? m / METRES_PER_FOOT : m;
    const unit = opts.units === 'ft' ? 'ft' : 'm';
    const ink = css('--ink'), ink2 = css('--ink-2'), grid = css('--grid'), axis = css('--axis');
    const accent = css('--accent'), compare = css('--compare'), surface = css('--surface');
    const { sw, bands, suggestions, checked, presets, range } = data;
    // On phones the colour bar and toolbar crowd out the plot; the caption above the chart
    // says what the colours mean.
    const narrow = el.clientWidth < 600;
    const xs = Array.from(sw.lengths, toX);
    const ft = Array.from(sw.lengths, formatFeetInches);

    const traces = [];
    const scoreName = data.scoreName || 'Score';
    traces.push({
        x: xs, y: Array.from(sw.scores), customdata: ft,
        type: 'scatter', mode: 'lines', name: scoreName,
        line: { color: accent, width: 2 },
        hovertemplate: `%{x:.2f} ${unit} (%{customdata})<br>${scoreName} %{y:.0f}<extra></extra>`,
        xaxis: 'x', yaxis: 'y',
    });
    // Second score line: the same settings with another counterpoise ("Compare with").
    if (data.alt) {
        traces.push({
            x: xs, y: Array.from(data.alt.scores), customdata: ft,
            type: 'scatter', mode: 'lines', name: data.alt.name,
            line: { color: compare, width: 2, dash: 'dot' },
            hovertemplate: `%{x:.2f} ${unit} (%{customdata})<br>${data.alt.name} %{y:.0f}<extra></extra>`,
            xaxis: 'x', yaxis: 'y',
        });
        const b = data.alt.best;
        if (b) {
            traces.push({
                x: [toX(b.lengthM)], y: [b.score], customdata: [formatFeetInches(b.lengthM)],
                type: 'scatter', mode: 'markers', name: 'Best length, compared setting',
                marker: { color: compare, size: 9, symbol: 'diamond', line: { color: surface, width: 2 } },
                hovertemplate: `Best length, ${data.alt.name.replace(/^Score with /, '')}: %{x:.2f} ${unit} (%{customdata})<br>Score %{y:.0f}<extra></extra>`,
                xaxis: 'x', yaxis: 'y', cliponaxis: false,
            });
        }
    }
    traces.push({
        x: suggestions.map(s => toX(s.lengthM)), y: suggestions.map(s => s.score),
        text: suggestions.map(s => String(s.rank)),
        customdata: suggestions.map(s => [formatFeetInches(s.lengthM), toX(s.fromM), toX(s.toM)]),
        type: 'scatter', mode: 'markers+text', name: 'Suggested length',
        textposition: 'top center', textfont: { color: ink, size: 12 },
        marker: { color: accent, size: 9, line: { color: surface, width: 2 } },
        hovertemplate: `Suggestion %{text}: %{x:.2f} ${unit} (%{customdata[0]})<br>Score %{y:.0f}<br>Cut between %{customdata[1]:.2f} and %{customdata[2]:.2f} ${unit}<extra></extra>`,
        xaxis: 'x', yaxis: 'y', cliponaxis: false,
    });
    // Legend entries for the shaded cut ranges and the checked-length line, which are shapes.
    traces.push({
        x: [null], y: [null], type: 'scatter', mode: 'markers', name: 'Cut between range',
        marker: { symbol: 'square', size: 12, color: accent, opacity: 0.25 }, hoverinfo: 'skip', xaxis: 'x', yaxis: 'y',
    });
    if (checked) {
        traces.push({
            x: [null], y: [null], type: 'scatter', mode: 'lines', name: 'Checked length',
            line: { color: ink, width: 1.5, dash: 'dash' }, hoverinfo: 'skip', xaxis: 'x', yaxis: 'y',
        });
    }
    if (presets && presets.length) {
        traces.push({
            x: presets.map(p => toX(p.lengthM)), y: presets.map(p => p.score),
            customdata: presets.map(p => [p.feet, formatFeetInches(p.lengthM)]),
            type: 'scatter', mode: 'markers', name: data.presetName,
            marker: { color: compare, size: 9, symbol: 'square', line: { color: surface, width: 2 } },
            hovertemplate: `${data.presetName}: %{customdata[0]} ft<br>%{x:.2f} ${unit}<br>Score %{y:.0f}<extra></extra>`,
            xaxis: 'x', yaxis: 'y',
        });
    }
    // Hover text per band and length: SWR range and band score.
    const hover = bands.map((b, bi) => xs.map((x, j) =>
        `${b}: ${x.toFixed(2)} ${unit} (${ft[j]})<br>SWR ${sw.bandSwrMin[bi][j].toFixed(1)} to ${fmtSwr(sw.bandSwrMax[bi][j])}<br>Band score ${sw.bandScores[bi][j].toFixed(0)}`));
    traces.push({
        x: xs, y: bands, z: sw.bandScores.map(a => Array.from(a)), text: hover,
        type: 'heatmap', zmin: 0, zmax: 100, colorscale: heatScale(), showscale: !narrow,
        colorbar: {
            title: { text: 'Band score', side: 'right', font: { color: ink2 } },
            tickvals: [0, 50, 100], ticktext: ['0 beyond limit', '50 at limit', '100'],
            tickfont: { color: ink2 }, len: 0.38, y: 0.18, thickness: 12, outlinewidth: 0,
        },
        hovertemplate: '%{text}<extra></extra>', xaxis: 'x', yaxis: 'y2', name: 'Band score',
    });

    const shapes = [];
    for (const s of suggestions) {
        shapes.push({ type: 'rect', xref: 'x', yref: 'paper', x0: toX(s.fromM), x1: toX(s.toM), y0: 0.44, y1: 1, fillcolor: accent, opacity: 0.12, line: { width: 0 }, layer: 'below' });
    }
    // Lengths outside the user's range (shown only when a comparison list reaches past it).
    if (range.min > sw.lengths[0]) shapes.push(outside(toX(sw.lengths[0]), toX(range.min), axis));
    if (range.max < sw.lengths[sw.lengths.length - 1]) shapes.push(outside(toX(range.max), toX(sw.lengths[sw.lengths.length - 1]), axis));
    const annotations = [];
    if (checked) {
        shapes.push({ type: 'line', xref: 'x', yref: 'paper', x0: toX(checked.lengthM), x1: toX(checked.lengthM), y0: 0, y1: 1, line: { color: ink, width: 1.5, dash: 'dash' } });
        annotations.push({ xref: 'x', yref: 'paper', x: toX(checked.lengthM), y: 1, yanchor: 'bottom', text: `${toX(checked.lengthM).toFixed(2)} ${unit}`, showarrow: false, font: { color: ink, size: 12 } });
    }

    const log = opts.log;
    const x0 = toX(sw.lengths[0]), x1 = toX(sw.lengths[sw.lengths.length - 1]);
    const layout = {
        paper_bgcolor: surface, plot_bgcolor: surface,
        font: { family: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: ink2, size: 12 },
        margin: narrow ? { l: 44, r: 8, t: 28, b: 44 } : { l: 56, r: 16, t: 28, b: 48 },
        showlegend: true,
        legend: { orientation: 'h', x: 0, y: 1.0, yanchor: 'bottom', font: { color: ink2 } },
        hovermode: 'closest',
        xaxis: {
            title: { text: `Wire length (${unit === 'm' ? 'metres' : 'feet'})` }, type: log ? 'log' : 'linear',
            range: log ? [Math.log10(x0), Math.log10(x1)] : [x0, x1],
            gridcolor: grid, linecolor: axis, zeroline: false, anchor: 'y2',
            showspikes: true, spikemode: 'across', spikethickness: 1, spikecolor: axis, spikedash: 'solid',
        },
        yaxis: { domain: [0.44, 1], range: [0, 105], title: { text: 'Score' }, gridcolor: grid, linecolor: axis, zeroline: false, fixedrange: true },
        yaxis2: { domain: [0, 0.38], type: 'category', autorange: 'reversed', linecolor: axis, fixedrange: true },
        shapes, annotations,
    };
    Plotly.react(el, traces, layout, { responsive: true, displaylogo: false, displayModeBar: narrow ? false : 'hover', modeBarButtonsToRemove: ['select2d', 'lasso2d'] });
    // Bound once, so it reads the units of the latest draw rather than the first.
    el.dataset.units = opts.units;
    if (!el.dataset.bound) {
        el.dataset.bound = '1';
        el.on('plotly_click', ev => {
            const p = ev.points && ev.points[0];
            if (p) onPick(el.dataset.units === 'ft' ? p.x * METRES_PER_FOOT : p.x);
        });
    }
}

function outside(a, b, color) {
    return { type: 'rect', xref: 'x', yref: 'paper', x0: a, x1: b, y0: 0, y1: 1, fillcolor: color, opacity: 0.25, line: { width: 0 }, layer: 'below' };
}

export function fmtSwr(s) {
    return s >= 100 ? 'over 100' : s.toFixed(1);
}
