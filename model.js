/* model.js — handwriting-synthesis engine, de-DOMed.
 *
 * The math kernel below is vendored VERBATIM from calligrapher.ai's in-browser
 * implementation (Sean Vasquez), which itself implements Alex Graves' 2013
 * handwriting-synthesis RNN. Do NOT "clean up" the one-letter functions — they
 * are the model and any rename risks silently corrupting the output.
 *
 * Only the I/O boundaries are changed vs. the original:
 *   - weights come from the embedded base64 (weights.js) instead of fetch('/d.bin')
 *   - the legibility/bias slider read (nr.value) becomes the BIAS parameter
 *   - the animated requestAnimationFrame loop becomes a synchronous generateLine()
 *   - rendering returns SVG path strings instead of mutating a live <svg>
 *
 * Public API (on window.HW):
 *   loadModel()                      -> Promise<styleCount>   (call once)
 *   styleCount()                     -> number of styles (64)
 *   generateLine(text,{style,bias})  -> { points:[[x,y,penUp],…], style }
 *   splitStrokes(points)             -> [[ [x,y,penUp],… ], …] pen-down strokes
 *   strokePath(points, scale, width) -> SVG path "d" for one stroke (variable width)
 *
 * Model space: points are cumulative sums of the model's (dx,dy) offsets, line
 * starts at (0,0), Y is up (math convention). penUp=1 marks the last point of a
 * stroke (pen lifts after it). Licensing: private/local demo use only.
 */
(function () {
  var ROOT = (typeof window !== 'undefined') ? window : globalThis;

  /* ── constants ─────────────────────────────────────────────────────────── */
  var N = Math.exp, P = Math.sqrt, Q = Math.log, R = Math.random, W = Math.floor,
      X = P(.5), G = 256, J = 512;
  var K = r => r.length;
  var O = (r, e, t) => r.slice(e, t);
  var Y = function () { return new Float32Array(...arguments); };

  /* ── model state ───────────────────────────────────────────────────────── */
  var $ = null;        // weights object, filled by loadModel
  var er = null;       // per-line character-window context (read by k())
  var BIAS = 0.75;     // legibility/bias, set per generateLine (was nr.value)

  /* ── math kernel (VERBATIM) ────────────────────────────────────────────── */
  var a = r => e => { var t = Y(K(e)); for (let a = 0; a < K(e); a++)t[a] = r(e[a]); return t },
      l = a(r => Q(r)),
      o = a(r => 1 / (1 + N(-r))),
      n = a(r => Q(1 + N(r))),
      v = a(r => { var e = N(2 * r); return (e - 1) / (e + 1) }),
      i = r => (e, t) => { var a = "number" == typeof t, l = Y(K(e)); for (let o = 0; o < K(e); o++)l[o] = r(e[o], a ? t : t[o]); return l },
      u = i((r, e) => r + e),
      f = i((r, e) => r - e),
      s = i((r, e) => r * e),
      h = i((r, e) => r / e),
      d = r => { var e = Y(K(r)), t = 0; for (let a = 0; a < K(r); a++)e[a] = N(r[a]), t += e[a]; for (let r = 0; r < K(e); r++)e[r] = e[r] / t; return e },
      p = (r, e) => { for (let t = 0; t < K(r) / G; t++)for (let a = 0; a < K(e); a++)r[t * G + a] = r[t * G + a] + e[a]; return r },
      w = (r, e, t) => { var a = K(r) + K(e), l = Y(a); for (let e = 0; e < K(r); e++)l[e] = r[e]; for (let t = 0; t < K(e); t++)l[t + K(r)] = e[t]; return l },
      m = (r, e) => { var t = K(e) / K(r), a = Y(t); for (let o = 0; o < t; o++) { var l = 0; for (let a = 0; a < K(r); a++)l += r[a] * e[a * t + o]; a[o] = l } return a },
      g = (r, e) => { var [t, a, l, o] = e, n = t[0], v = Y(n); for (let e = 0; e < n; e++) { var i = o[e], u = o[e + 1], f = 0; for (let e = i; e < u; e++)f += a[e] * r[l[e]]; v[e] = f } return v },
      b = (r, e) => { var t = K(r) / e, a = []; for (let o = 0; o < e; o++) { var l = O(r, o * t, (o + 1) * t); a.push(l) } return a },
      M = (r, e) => { var t = [K(r), e], a = Y(t[0] * t[1]); for (let e = 0; e < t[0]; e++)for (let l = 0; l < t[1]; l++)a[e * t[1] + l] = r[e]; return a },
      _y = (r, e) => { var t = [e[1]], a = Y(t[0]); for (let t = 0; t < e[0]; t++)for (let l = 0; l < e[1]; l++)a[l] += r[t * e[1] + l]; return a },
      _x = (r, e, t) => { var a = [K(e), t], l = Y(a[0] * a[1]); for (let a = 0; a < K(e); a++) { var o = e[a], n = O(r, o * t, (o + 1) * t); l.set(n, a * t) } return l },
      C = (r, e, t) => { if (1 == t) var a = e.a, l = e.d, n = $.y, i = $.p; else if (2 == t) n = $.w, i = $.q, a = e.b, l = e.e; else n = $.r, i = $.f, a = e.c, l = e.f; r = w(r, l); var f = u(g(r, n), i), [h, d, c, p] = b(f, 4), m = u(s(o(c), a), s(o(h), v(d))), M = s(o(p), v(m)); return 1 == t ? (e.a = m, e.d = M) : 2 == t ? (e.b = m, e.e = M) : (e.c = m, e.f = M), M },
      A = r => { r = [0, ...r, 0], r = Y(r); var e, t = ((r, e) => { var t = [K(r) / G - 2, G], a = Y(t[0] * t[1]); for (let n = 0; n < t[0]; n++) { var l = O(r, n * G, (n + 3) * G); for (let r = 0; r < t[1]; r++) { var o = 0; for (let t = 0; t < K(l); t++)o += l[t] * e[r + G * t]; a[n * t[1] + r] = o } } return a })(e = ((r, e) => { var t = [K(e), G], a = Y(t[0] * t[1]); for (let t = 0; t < K(e); t++) { var l = e[t], o = O(r, l * G, (l + 1) * G); a.set(o, t * G) } return a })($.s, r), $.b), a = (t = p(t, $.t), t = v(t), ((r, e, t) => { var a = [K(r) / G, J], l = Y(a[0] * a[1]); for (let e = 0; e < a[0]; e++)for (let t = 0; t < G; t++)l[e * a[1] + t] = r[e * G + t]; for (let r = 0; r < a[0]; r++)for (let t = 0; t < G; t++)l[r * a[1] + t + G] = e[r * G + t]; return l })(e = O(e, G, K(e) - G), t)), l = $.j, o = $.E; return t = p(((r, e) => { var t = [K(r) / J, J], a = [J, K(e) / J], l = K(e) / G, o = [K(r) / J, K(e) / J], n = Y(o[0] * o[1]); for (let i = 0; i < o[0]; i++)for (let u = 0; u < o[1]; u++) { var v = 0; for (let o = 0; o < l; o++)v += r[i * t[1] + o] * e[o * a[1] + u]; n[i * o[1] + u] = v } return n })(a, l), o) },
      k = (r, e) => { var t = m(r, $.h), [a, l, v] = (t = u(t, $.n), b(t, 3)); l = n(l), v = n(v), a = d(a), v = u(e.k, h(v, 15)), e.k = v; var i = e.u; a = M(a, K(i) / 10 - 1), l = M(l, K(i) / 10), v = M(v, K(i) / 10); var c = o(h(f(i, v), l)), p = s(a, (r => { var e = [10, K(r) / 10], t = [e[0], e[1] - 1], a = Y(t[0] * t[1]); for (let o = 0; o < t[0]; o++) { var l = o * e[1]; for (let e = 0; e < t[1]; e++)a[o * t[1] + e] = r[l + e + 1] - r[l + e] } return a })(c)), w = _y(p, [10, K(p) / 10]); t = er; w = M(w, G); var g = _y(s(w, t), [K(w) / G, G]); return e.w = g, g },
      F = (r, e) => { var t = m(r, $.i), a = (t = u(t, $.W), t = s(u(t, e.z), X), C(t, e, 1)), l = (t = s(u(t, a), X), w(t, e.w)), n = C(l, e, 2), i = k(n, e), f = w(n, i), h = (f = g(f, $.l), f = u(f, $.Q), f = v(f), t = s(u(t, f), X), (r => { var e = $.c, t = $.u; return o(u(m(r, e), t)) })(i)), d = C(t, e, 3), c = (t = s(u(t, d), X), m(t, $.z)); return [c = u(c, $.v), h] },
      U = r => { var [e, t] = ((r, e) => { var t = [], a = 0; for (let v = 0; v < K(e); v++) { var l = a, o = a + e[v], n = O(r, l, o); a = o, t.push(n) } return t })(r, [120, 1]), a = o(t)[0], i = R() < a ? 1 : 0, [f, c, p, w] = ((r, e) => { var t = [], a = 0; for (let v = 0; v < K(e); v++) { var l = a; a += e[v]; var o = [20, e[v]], n = Y(20 * e[v]); for (let t = 0; t < 20; t++)for (let a = 0; a < e[v]; a++)n[t * o[1] + a] = r[6 * t + (l + a)]; t.push(n) } return t })(e, [1, 2, 1, 2]); p = v(p); var g = BIAS, c = h(n(c), N(g)), f = (f = l(d(f)), s(f, 1 + g)); for (let r = 0; r < K(f); r++)f[r] < Q(.02) && (f[r] = f[r] - 100); var b = (r => { var e = -1e6, t = 0; for (let o = 0; o < K(r); o++) { var a = -Q(-Q(R())), l = r[o] + a; l > e && (t = o, e = l) } return Y([t]) })(f), M = _x(w, b, 2), y = _x(c, b, 2), C = _x(p, b, 1), A = y[0], k = y[1], F = [A, (C = C[0]) * k, 0, k * P(1 - C * C)]; F = Y(F); var U = (r => { var e = Y(r); for (let n = 0; n < r; n++) { var t = 1 - R(), a = 1 - R(), l = P(-2 * Q(t)), o = Math.cos(2 * Math.PI * a); e[n] = l * o } return e })(2), L = u(M, m(U, F)), E = [L[0], L[1], i]; return E = Y(E) },
      L = (r, e) => { var [t, a] = F(r, e); return [U(t), a, e] };

  /* ── stroke segmentation + width helpers (VERBATIM) ────────────────────── */
  var B = r => { var e = []; for (let o = 0; o < K(r); o++) { if (0 == o) var t = r[o + 1][0] - r[o][0], a = r[o + 1][1] - r[o][1]; else t = r[o][0] - r[o - 1][0], a = r[o][1] - r[o - 1][1]; var l = Math.sqrt(Math.pow(t, 2) + Math.pow(a, 2)); e.push(l) } var o = []; for (let r = 0; r < K(e); r++) { var n = Math.max(r - 2, 0), v = Math.min(r + 2 + 1, K(e)), i = 0; for (let r = n; r < v; r++)i += e[r]; var u = i / (v - n); o.push(u) } return o },
      z = r => { for (var e = [], t = 0, a = K(r); t < a;) { for (var l = []; t < a && 1 != r[t][2];)l.push(r[t]), t += 1; t < a && l.push(r[t]), t += 1, e.push(l) } return e },
      j = (r, e) => [e[0] + r[0], e[1] + r[1]],
      I = (r, e) => [r[0] - e[0], r[1] - e[1]],
      T = (r, e) => [e * r[0], e * r[1]],
      V = (r, e, t) => { var a = 0, l = [], o = [], n = []; for (let f = 0; f < K(r); f++) { var v = r[f]; a += e[f]; var i = Math.floor(a / t[1]), u = a % t[1]; 0 != v && (l.push(v), o.push(u), n.push(i)) } var f = [0], s = 0; for (let r = 0; r < t[0]; r++) { for (; n[s] == r;)s += 1; f.push(s) } return [t, l, o, f] },
      _ = (r, e, t) => { var a = t.reduce((r, e) => r * e, 1), l = Y(a), o = K(r), n = 0; for (let t = 0; t < o; t++) { var v = r[t]; l[n += e[t]] = v } return l },
      D = r => { for (var e = "", t = 0; t < K(r); t++)e += String.fromCharCode(r[t]); return e };

  /* character → model token map (VERBATIM, includes invisible start/end keys) */
  var H = { "": 0, "": 2, " ": 8, '"': 4, "&": 84, "(": 66, "*": 80, ",": 37, ".": 7, 0: 62, 2: 63, 4: 68, 6: 71, 8: 76, ":": 74, B: 47, D: 52, F: 53, H: 41, J: 64, L: 48, N: 38, P: 46, R: 55, T: 31, V: 39, X: 79, Z: 78, b: 32, d: 27, f: 35, h: 30, j: 43, l: 26, n: 15, p: 29, r: 6, t: 21, v: 34, x: 44, z: 10, "": 1, "": 3, "!": 72, "#": 56, "'": 16, ")": 67, "+": 82, "-": 40, "/": 77, 1: 59, 3: 69, 5: 61, 7: 70, 9: 60, ";": 73, "?": 51, A: 9, C: 57, E: 42, G: 45, I: 23, K: 58, M: 5, O: 36, Q: 75, S: 18, U: 65, W: 54, Y: 50, "[": 81, "]": 83, a: 14, c: 20, e: 19, g: 33, i: 13, k: 28, m: 12, o: 25, q: 49, s: 17, u: 11, w: 24, y: 22 };

  var sr = r => r.toFixed(2);

  /* ── variable-width ink path for one pen-down stroke (adapted from q()) ──
     r: array of [x,y] points (already in target coordinates)
     e: width-normalization scale (the model→target scale)
     t: stroke-width multiplier
     returns: SVG path "d" string (closed filled outline) instead of touching DOM */
  function strokePath(r, e, t) {
    var a = [], l = [], o = B(r);
    for (let d = 0; d < K(r); d++) {
      if (0 == d) var n = r[d + 1][0] - r[d][0], v = r[d + 1][1] - r[d][1];
      else if (d == K(r) - 1) n = r[d][0] - r[d - 1][0], v = r[d][1] - r[d - 1][1];
      else n = r[d + 1][0] - r[d - 1][0], v = r[d + 1][1] - r[d - 1][1];
      var i = Math.sqrt(Math.pow(n, 2) + Math.pow(v, 2)),
        u = (i = Math.max(i, 14), o[d] / e),
        f = [(f = [t * (f = [-v / i, n / i])[0], t * f[1]])[0] / u, f[1] / u],
        s = r[d][0] + 2 * f[0], h = r[d][1] + 2 * f[1];
      a.push([s, h]);
      s = r[d][0] - 2 * f[0], h = r[d][1] - 2 * f[1];
      l.push([s, h]);
    }
    var dd = a.concat(l.reverse()),
      c = [["M ", sr(dd[0][0]), ",", sr(dd[0][1])].join("")],
      pp = K(dd);
    for (let r2 = 0; r2 < pp; r2++) {
      var w0 = dd[(r2 - 1 + pp) % pp], m0 = dd[r2], g0 = dd[(r2 + 1) % pp], b0 = dd[(r2 + 2) % pp],
        M0 = I(g0, w0), y0 = I(b0, m0),
        x0 = j(m0, T(M0, .2)), C0 = I(g0, T(y0, .2)),
        A0 = "C " + sr(x0[0]) + " " + sr(x0[1]) + ", " + sr(C0[0]) + " " + sr(C0[1]) + ", " + sr(g0[0]) + " " + sr(g0[1]);
      c.push(A0);
    }
    return c.join(" ");
  }

  /* ── weights loading (base64 → ArrayBuffer → parse) ─────────────────────── */
  function b64ToArrayBuffer(b64) {
    var bin = atob(b64), len = bin.length, bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  /* same byte format as the original fetch parser, minus the rAF chunking */
  function parseWeights(buf) {
    var e = 0, t = {}, a = new DataView(buf);
    while (e < a.byteLength) {
      var o = a.getUint8(e); e += 1;
      var n = new Uint8Array(o); for (let r = 0; r < o; r++) { n[r] = a.getUint8(e); e += 1; } n = D(n);
      var vflag = a.getUint8(e); e += 1;
      var cnt = a.getUint32(e, true); e += 4;
      var vals = new Float32Array(cnt); for (let r = 0; r < cnt; r++) { vals[r] = a.getFloat32(e, true); e += 4; }
      var idx;
      if (vflag) { idx = new Uint8Array(cnt); for (let r = 0; r < cnt; r++) { idx[r] = a.getUint16(e, true); e += 1; } }
      var slen = a.getUint8(e); e += 1;
      var shape = new Uint16Array(slen); for (let r = 0; r < slen; r++) { shape[r] = a.getUint16(e, true); e += 2; }
      (["y", "w", "r", "l"].includes(n)) ? (vals = V(vals, idx, shape)) : (vflag && (vals = _(vals, idx, shape)));
      t[n] = vals;
    }
    return t;
  }

  function loadModel() {
    return new Promise((resolve, reject) => {
      try {
        var b64 = ROOT.DBIN_B64;
        if (!b64) throw new Error("weights.js not loaded (window.DBIN_B64 missing)");
        $ = parseWeights(b64ToArrayBuffer(b64));
        resolve(styleCount());
      } catch (err) { reject(err); }
    });
  }

  function styleCount() { return $ ? K($.g) / 64 : 0; }

  /* encode a text line into model tokens: 2 = start, 3 = end, unknown → 1 */
  function encode(c) {
    var e = c.split("").map(r => r in H ? H[r] : 1);
    return Y([2, ...e, 3]);
  }

  /* build the initial RNN state for a given encoded line + style index */
  function initState(charLen, styleIdx) {
    var t = [10, charLen], a = Y(t[0] * t[1]);
    for (let r = 0; r < t[0]; r++) for (let e = 0; e < t[1]; e++) a[r * t[1] + e] = e - .5;
    var l = $.g, o = O(l, 64 * styleIdx, 64 * (styleIdx + 1)), nn = $.k, vv = $.R,
      i = (o = u(m(o, nn), vv), Y(10));
    return { a: $.d, b: $.o, c: $.e, d: $.m, e: $.x, f: $.a, w: $.T, k: i, u: a, z: o };
  }

  /* Synchronous replacement for the original animated E(). Returns the full
     point list in model space. Order is the model's writing order — never
     reordered — which is what makes the plotter write rather than plot. */
  function generateLine(text, opts) {
    if (!$) throw new Error("model not loaded");
    opts = opts || {};
    BIAS = (opts.bias != null) ? +opts.bias : 0.75;
    var nStyles = styleCount();
    var styleIdx = (opts.style == null || opts.style === "-") ? W(nStyles * R())
      : ((opts.style % nStyles) + nStyles) % nStyles;
    var c = String(text).trim().replace(/\s+/g, " ");
    if (!c.length) return { points: [], style: styleIdx };
    var nChars = K(c);
    var enc = encode(c);
    er = A(enc);
    var state = initState(K(enc) + 1, styleIdx);
    var rel = [Y([0, 0, 1])];      // relative points fed back into the RNN
    var out = [[0, 0, 1]];          // cumulative absolute points [x,y,penUp]
    var ax = 0, ay = 0, steps = 0;
    while (true) {
      var last = rel[K(rel) - 1];
      var res = L(last, state);     // [nextRelPoint, endProb, state]
      var np = res[0], endProb = res[1];
      steps += 1;
      if (steps > 40 * nChars || endProb > .5) break;
      rel.push(np);
      ax += np[0]; ay += np[1];     // scale 1, Y up (no flip here)
      out.push([ax, ay, np[2]]);
    }
    return { points: out, style: styleIdx };
  }

  var HW = {
    loadModel: loadModel,
    styleCount: styleCount,
    generateLine: generateLine,
    splitStrokes: z,
    strokePath: strokePath
  };
  ROOT.HW = HW;
})();
