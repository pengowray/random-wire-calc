export const METRES_PER_FOOT = 0.3048;

// Accepts "21.5", "21.5 m", "70ft", "70'", "70 ft 6 in", "70' 6\"".
// Returns { metres, isFeet } or null if no number was found.
export function parseLength(raw) {
    if (typeof raw !== 'string') return null;
    const s = raw.trim().toLowerCase();
    if (!s) return null;
    const numbers = s.match(/\d*\.?\d+/g);
    if (!numbers) return null;
    const isFeet = /(ft\.?\b|feet\b|foot\b|['’′])/.test(s);
    if (isFeet) {
        const hasInches = /("|”|″|in\b|inch)/.test(s);
        const inches = hasInches && numbers.length > 1 ? parseFloat(numbers[1]) : 0;
        return { metres: (parseFloat(numbers[0]) + inches / 12) * METRES_PER_FOOT, isFeet: true };
    }
    return { metres: parseFloat(numbers[0]), isFeet: false };
}

export function toFeetInches(metres) {
    const total = metres / METRES_PER_FOOT;
    let feet = Math.floor(total);
    let inches = Math.round((total - feet) * 12);
    if (inches === 12) { feet += 1; inches = 0; }
    return { feet, inches, total };
}

export function formatFeetInches(metres) {
    const { feet, inches } = toFeetInches(metres);
    return `${feet} ft ${inches} in`;
}

export function formatMetres(metres, digits = 2) {
    return `${metres.toFixed(digits)} m`;
}

export function trim(value, digits) {
    return String(Number(value.toFixed(digits)));
}
