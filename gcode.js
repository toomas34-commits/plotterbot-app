/* gcode.js — turn laid-out handwriting strokes into FluidNC G-code.
 *
 * Input strokes are in PAPER millimetres: origin top-left, x → right, y → DOWN,
 * inside the 0..BED square (same coordinates the preview uses). They arrive in
 * writing order (top→bottom, left→right) and are emitted in that order with NO
 * reordering — that is what makes the plotter write letter-by-letter, row-by-row,
 * rather than hop around optimizing travel.
 *
 * Emission mirrors fluidnc.toml: M3 S0 = pen up, M3 S1000 = pen down, F3000,
 * G10 L20 origin, no G4 dwells. Y is flipped here (FluidNC origin is bottom-left,
 * Y up): Y_mm = BED - y.
 *
 * API (window.GCODE):
 *   joinStrokes(strokes, maxGapMm) -> strokes   (order-preserving pen-lift reduction)
 *   countLifts(strokes)            -> number of pen-downs (one per drawn stroke)
 *   buildGcode(strokes, opts)      -> { gcode, lifts }
 */
(function () {
  var ROOT = (typeof window !== 'undefined') ? window : globalThis;

  /* Merge consecutive strokes whose end→next-start gap is within maxGapMm,
     keeping the pen down across the gap (the join is drawn as a normal G1).
     Walks in writing order and never reorders. A small threshold means only
     near-touching letter joins fuse — wider word spaces stay lifted, so no
     straight line is drawn across blank space. maxGapMm<=0 disables joining. */
  function joinStrokes(strokes, maxGapMm) {
    var clean = strokes.filter(function (s) { return s && s.length; });
    if (!(maxGapMm > 0)) return clean.map(function (s) { return s.slice(); });
    var out = [], cur = null;
    for (var k = 0; k < clean.length; k++) {
      var s = clean[k];
      if (cur) {
        var a = cur[cur.length - 1], b = s[0];
        var gap = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (gap <= maxGapMm) { for (var i = 0; i < s.length; i++) cur.push(s[i]); continue; }
      }
      cur = s.slice();
      out.push(cur);
    }
    return out;
  }

  function countLifts(strokes) {
    var n = 0;
    for (var i = 0; i < strokes.length; i++) if (strokes[i] && strokes[i].length) n++;
    return n;
  }

  function buildGcode(strokes, opts) {
    opts = opts || {};
    var BED = opts.bed || 150, F = opts.feed || 3000;
    function clamp(v) { return v < 0 ? 0 : v > BED ? BED : v; }
    function fx(v) { return clamp(v).toFixed(3); }
    function fy(v) { return clamp(BED - v).toFixed(3); }   // Y-flip to plotter space

    var L = ['G21', 'G90', 'G17', 'G94', 'G10 L20 P1 X0 Y0', 'M3 S0', 'F' + F];
    var lifts = 0;
    for (var k = 0; k < strokes.length; k++) {
      var s = strokes[k];
      if (!s || !s.length) continue;
      L.push('G0 X' + fx(s[0][0]) + ' Y' + fy(s[0][1]));   // rapid to start (pen up)
      L.push('M3 S1000');                                   // pen down
      lifts++;
      for (var i = 1; i < s.length; i++) L.push('G1 X' + fx(s[i][0]) + ' Y' + fy(s[i][1]));
      if (s.length === 1) L.push('G1 X' + fx(s[0][0]) + ' Y' + fy(s[0][1])); // lone dot
      L.push('M3 S0');                                      // pen up
    }
    L.push('M3 S0', 'G0 X0.000 Y0.000');
    return { gcode: L.join('\n') + '\n', lifts: lifts };
  }

  ROOT.GCODE = { joinStrokes: joinStrokes, countLifts: countLifts, buildGcode: buildGcode };
})();
