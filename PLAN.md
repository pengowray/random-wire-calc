# Plan

## Done (October 2026 rewrite)

- Replaced the resonance-window scoring (hand-picked λ fractions, weights and widths) with a
  feedpoint impedance model fitted to NEC-2 sweeps. Every multiple of λ/4 is covered by the
  model, so there is no list of multipliers to choose. See model/README.md.
- Band edges are sampled across each band (edges included) from the chosen region's band
  plan: VK (WIA 2026), USA, IARU Region 1, IARU Region 3. VK 80m has two segments.
- Settings for wire type (velocity factor), matching transformer (9:1, 4:1, 1:1, 49:1, 64:1),
  tuner SWR limit and counterpoise (length or radials). The old "Resonance Q" input is gone.
- Suggestions: local maxima of the score curve, at least N% apart, with at least 1 point of
  prominence. Each has a "cut between" range (within 3 points, stopping at the next dip).
- Check a length, band-by-band table, comparison with published lists on the same chart.
- Split into docs/css and docs/js modules; model tests under tests/ (`npm test`).
- Old page kept at docs/old/.

## Next

- Coax loss: SWR on a long coax run between the unun and the tuner loses power and hides
  the true SWR. Add a coax type and length setting.
- Counterpoise search: score counterpoise lengths for a fixed wire (the NEC runs showed the
  counterpoise matters as much as the wire).
- More NEC checks: inverted-L and fully horizontal wires, poor and very good ground, radials,
  and 6m. Refit if the constants drift.
- Let users narrow a band (for example only the CW end of 80m).
- Collect real-world SWR reports from GitHub Discussions and compare them with the model.
- Restore a frequency (MHz) axis if anyone misses it.
