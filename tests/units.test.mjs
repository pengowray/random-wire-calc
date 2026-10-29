import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLength, formatFeetInches } from '../docs/js/units.js';

const ft = n => n * 0.3048;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

test('plain numbers use the chosen unit; a typed unit wins', () => {
    near(parseLength('70', 'm').metres, 70);
    near(parseLength('7', 'ft').metres, ft(7));
    near(parseLength('7m', 'ft').metres, 7);
    near(parseLength('21.5 m', 'ft').metres, 21.5);
    near(parseLength('70 ft 6 in', 'm').metres, ft(70.5));
    near(parseLength("70' 6\"", 'm').metres, ft(70.5));
    assert.equal(parseLength('abc'), null);
    assert.equal(parseLength(''), null);
});

test('feet and inches round to the nearest inch', () => {
    assert.equal(formatFeetInches(ft(70.5)), '70 ft 6 in');
    assert.equal(formatFeetInches(ft(11.999)), '12 ft 0 in');
});
