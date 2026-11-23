/* 原創連桿示意（校本）。純 canvas 幾何，離線、無外連。 */
(function (root) {
  'use strict';

  var FONT = '"Microsoft JhengHei","PingFang TC","Noto Sans TC","WenQuanYi Micro Hei","Droid Sans Fallback",sans-serif';
  var COL = {
    fixed: '#1e293b',
    crank: '#1d4ed8',
    coupler: '#047857',
    rocker: '#c2410c',
    slider: '#6d28d9',
    trace: '#db2777',
    trace2: '#ea580c',
    cut: '#15803d',
    ret: '#c2410c',
    faint: '#94a3b8',
    ink: '#0f172a'
  };

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function ang(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
  function pol(c, r, t) { return { x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) }; }
  function lerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function normPi(x) {
    var y = x;
    while (y > Math.PI) y -= 2 * Math.PI;
    while (y <= -Math.PI) y += 2 * Math.PI;
    return y;
  }
  function unwrap(prev, next) {
    if (prev == null || !isFinite(prev)) return next;
    var d = next - prev;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return prev + d;
  }
  function ccwSpan(from, to) {
    return (to - from + Math.PI * 2) % (Math.PI * 2);
  }
  function inCCW(th, from, to) {
    var d = ccwSpan(from, to);
    var e = ccwSpan(from, th);
    return e <= d + 1e-6;
  }

  function circleCircle(p0, r0, p1, r1) {
    var dx = p1.x - p0.x, dy = p1.y - p0.y;
    var d2 = dx * dx + dy * dy;
    var d = Math.sqrt(d2);
    if (d < 1e-9 || d > r0 + r1 + 1e-6 || d < Math.abs(r0 - r1) - 1e-6) return null;
    var a = (r0 * r0 - r1 * r1 + d2) / (2 * d);
    var h2 = r0 * r0 - a * a;
    if (h2 < -1e-7) return null;
    var h = Math.sqrt(Math.max(0, h2));
    var xm = p0.x + (a * dx) / d;
    var ym = p0.y + (a * dy) / d;
    var rx = (-dy * h) / d;
    var ry = (dx * h) / d;
    return [
      { x: xm + rx, y: ym + ry },
      { x: xm - rx, y: ym - ry }
    ];
  }

  function pick(cands, prev, prefer) {
    if (!cands) return null;
    if (prev) {
      return dist(cands[0], prev) <= dist(cands[1], prev) ? cands[0] : cands[1];
    }
    if (prefer === 'lower') return cands[0].y <= cands[1].y ? cands[0] : cands[1];
    if (prefer === 'left') return cands[0].x <= cands[1].x ? cands[0] : cands[1];
    return cands[0].y >= cands[1].y ? cands[0] : cands[1];
  }

  function solveFour(g, theta, prev, prefer) {
    var B = { x: g.A.x + g.AB * Math.cos(theta), y: g.A.y + g.AB * Math.sin(theta) };
    var C = pick(circleCircle(B, g.BC, g.D, g.CD), prev, prefer || 'upper');
    if (!C) return null;
    return { A: g.A, B: B, C: C, D: g.D };
  }

  function rockerWindow(g) {
    var N = 720;
    var ok = [];
    var i;
    for (i = 0; i < N; i++) {
      var th = -Math.PI + (2 * Math.PI * i) / N;
      ok.push(!!solveFour(g, th, null, 'upper'));
    }
    var best = 0, bestS = 0, cur = 0, curS = 0;
    for (i = 0; i < N * 2; i++) {
      if (ok[i % N]) {
        if (cur === 0) curS = i;
        cur++;
        if (cur > best && cur <= N) { best = cur; bestS = curS; }
      } else cur = 0;
    }
    var thStart = -Math.PI + (2 * Math.PI * (bestS % N)) / N;
    var thLen = (2 * Math.PI * best) / N;
    var margin = Math.min(0.14, thLen * 0.12);
    return { th0: thStart + margin, th1: thStart + thLen - margin };
  }

  function slerp(u, v, t) {
    var d = clamp(u.x * v.x + u.y * v.y + u.z * v.z, -1, 1);
    var om = Math.acos(d);
    if (om < 1e-5) return { x: u.x, y: u.y, z: u.z };
    var s = Math.sin(om);
    var a = Math.sin((1 - t) * om) / s;
    var b = Math.sin(t * om) / s;
    return { x: a * u.x + b * v.x, y: a * u.y + b * v.y, z: a * u.z + b * v.z };
  }

  function solvePhiPair(a, b, theta) {
    var Ac = b - a * Math.cos(theta);
    var Bc = -a * Math.sin(theta);
    var Cc = -a + b * Math.cos(theta);
    var R = Math.hypot(Ac, Bc);
    if (R < 1e-9) return null;
    var rhs = Cc / R;
    if (rhs > 1 + 1e-5 || rhs < -1 - 1e-5) return null;
    var alpha = Math.atan2(Bc, Ac);
    var delta = Math.acos(clamp(rhs, -1, 1));
    return [normPi(alpha + delta), normPi(alpha - delta)];
  }

  function crossedPhi(a, b, theta) {
    var sols = solvePhiPair(a, b, theta);
    if (!sols) return null;
    var tn = normPi(theta);
    var best = sols[0];
    var bestD = -1;
    for (var i = 0; i < sols.length; i++) {
      var d = Math.abs(Math.atan2(Math.sin(sols[i] - tn), Math.cos(sols[i] - tn)));
      if (d > bestD) { bestD = d; best = sols[i]; }
    }
    return best;
  }

  /* ---------- scene helpers ---------- */

  function scene() {
    return { links: [], joints: [], blocks: [], rails: [], polys: [], arcs: [], texts: [], fit: [], circles: [] };
  }
  function addLink(s, a, b, color, label, side, width) {
    s.links.push({ a: a, b: b, color: color, label: label, side: side || 1, w: width || 8 });
    s.fit.push(a, b);
  }
  function addJoint(s, p, letter, ground) {
    s.joints.push({ p: p, letter: letter || '', ground: !!ground });
    s.fit.push(p);
  }
  function addArc(s, c, r, a0, a1, color, heads) {
    s.arcs.push({ c: c, r: r, a0: a0, a1: a1, color: color, heads: heads || 'end' });
    s.fit.push(pol(c, r, a0), pol(c, r, a1), pol(c, r, (a0 + a1) / 2));
  }

  function halo(ctx, text, x, y, opt) {
    opt = opt || {};
    ctx.save();
    ctx.font = (opt.weight || '700') + ' ' + (opt.size || 13) + 'px ' + FONT;
    ctx.textAlign = opt.align || 'center';
    ctx.textBaseline = opt.base || 'middle';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.94)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = opt.color || COL.ink;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function makeProj(view, w, h) {
    var pad = 52;
    var ww = Math.max(1e-4, view.maxX - view.minX);
    var hh = Math.max(1e-4, view.maxY - view.minY);
    var sc = Math.min((w - pad * 2) / ww, (h - pad * 2) / hh);
    var ox = (w - sc * ww) / 2 - sc * view.minX;
    var oy = (h - sc * hh) / 2 + sc * view.maxY;
    return {
      sc: sc,
      p: function (pt) { return { x: ox + sc * pt.x, y: oy - sc * pt.y }; }
    };
  }

  function drawScene(ctx, proj, s) {
    var i, a, b, L, nx, ny, mx, my;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (i = 0; i < s.circles.length; i++) {
      var c = s.circles[i];
      var cs = proj.p(c.c);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cs.x, cs.y, c.r * proj.sc, 0, Math.PI * 2);
      ctx.setLineDash(c.dash || [5, 5]);
      ctx.strokeStyle = c.color || COL.faint;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
    }
    for (i = 0; i < s.rails.length; i++) {
      a = proj.p(s.rails[i].a);
      b = proj.p(s.rails[i].b);
      ctx.save();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
    }
    for (i = 0; i < s.polys.length; i++) {
      var poly = s.polys[i];
      if (!poly.pts || poly.pts.length < 2) continue;
      ctx.save();
      ctx.beginPath();
      var p0 = proj.p(poly.pts[0]);
      ctx.moveTo(p0.x, p0.y);
      for (var k = 1; k < poly.pts.length; k++) {
        var pk = proj.p(poly.pts[k]);
        ctx.lineTo(pk.x, pk.y);
      }
      ctx.setLineDash(poly.dash || []);
      if (poly.fill) {
        ctx.fillStyle = poly.fill;
        ctx.fill();
      }
      if (poly.color) {
        ctx.strokeStyle = poly.color;
        ctx.lineWidth = poly.w || 2;
        ctx.stroke();
      }
      ctx.restore();
    }
    for (i = 0; i < s.arcs.length; i++) {
      drawArc(ctx, proj, s.arcs[i]);
    }
    for (i = 0; i < s.links.length; i++) {
      var ln = s.links[i];
      a = proj.p(ln.a);
      b = proj.p(ln.b);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = ln.color;
      ctx.lineWidth = ln.w;
      ctx.setLineDash([]);
      ctx.stroke();
    }
    for (i = 0; i < s.blocks.length; i++) {
      drawBlock(ctx, proj, s.blocks[i]);
    }
    for (i = 0; i < s.joints.length; i++) {
      var j = s.joints[i];
      var sp = proj.p(j.p);
      if (j.ground) drawGround(ctx, sp.x, sp.y);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = COL.ink;
      ctx.stroke();
      if (j.letter) halo(ctx, j.letter, sp.x + 12, sp.y + 12, { size: 11, color: '#475569', weight: '800' });
    }
    for (i = 0; i < s.links.length; i++) {
      ln = s.links[i];
      if (!ln.label) continue;
      a = proj.p(ln.a);
      b = proj.p(ln.b);
      mx = (a.x + b.x) / 2;
      my = (a.y + b.y) / 2;
      L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      nx = -(b.y - a.y) / L;
      ny = (b.x - a.x) / L;
      halo(ctx, ln.label, mx + nx * 15 * ln.side, my + ny * 15 * ln.side, { size: 12 });
    }
    for (i = 0; i < s.texts.length; i++) {
      var t = s.texts[i];
      var tp = proj.p(t.p);
      halo(ctx, t.text, tp.x + (t.dx || 0), tp.y + (t.dy || 0), { size: t.size || 12, color: t.color || COL.ink, align: t.align || 'center' });
    }
    if (s.note) halo(ctx, s.note, 12, 16, { size: 12, align: 'left', color: '#9a3412' });
  }

  function drawArc(ctx, proj, arc) {
    var n = 18;
    var pts = [];
    var i;
    for (i = 0; i <= n; i++) pts.push(proj.p(pol(arc.c, arc.r, arc.a0 + (arc.a1 - arc.a0) * i / n)));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.strokeStyle = arc.color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.stroke();
    ctx.restore();
    function head(at, toward) {
      var angS = Math.atan2(toward.y - at.y, toward.x - at.x);
      ctx.save();
      ctx.translate(at.x, at.y);
      ctx.rotate(angS);
      ctx.fillStyle = arc.color;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-9, 4.5);
      ctx.lineTo(-9, -4.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    if (arc.heads === 'both' || arc.heads === 'end') head(pts[pts.length - 1], pts[pts.length - 2]);
    if (arc.heads === 'both') head(pts[0], pts[1]);
  }

  function drawBlock(ctx, proj, b) {
    var s = proj.p(b.p);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(-(b.rot || 0));
    var w = b.w, h = b.h;
    var r = 4;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + r, -h / 2);
    ctx.arcTo(w / 2, -h / 2, w / 2, h / 2, r);
    ctx.arcTo(w / 2, h / 2, -w / 2, h / 2, r);
    ctx.arcTo(-w / 2, h / 2, -w / 2, -h / 2, r);
    ctx.arcTo(-w / 2, -h / 2, w / 2, -h / 2, r);
    ctx.closePath();
    ctx.fillStyle = b.color || COL.slider;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = COL.ink;
    ctx.stroke();
    if (b.slot) {
      ctx.beginPath();
      ctx.moveTo(0, -h / 2 + 4);
      ctx.lineTo(0, h / 2 - 4);
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
    if (b.label) halo(ctx, b.label, s.x, s.y + (b.labelDy || (h / 2 + 12)), { size: 12 });
  }

  function drawGround(ctx, x, y) {
    ctx.save();
    ctx.strokeStyle = COL.fixed;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 14, y + 11);
    ctx.lineTo(x + 14, y + 11);
    ctx.stroke();
    for (var i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 8, y + 11);
      ctx.lineTo(x + i * 8 - 6, y + 19);
      ctx.stroke();
    }
    ctx.restore();
  }

  function fitOf(s) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < s.fit.length; i++) {
      var p = s.fit[i];
      if (!p || !isFinite(p.x) || !isFinite(p.y)) continue;
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    if (!isFinite(minX)) return { minX: -2, minY: -2, maxX: 2, maxY: 2 };
    var mx = Math.max(0.25, (maxX - minX) * 0.08);
    var my = Math.max(0.25, (maxY - minY) * 0.1);
    return { minX: minX - mx, minY: minY - my, maxX: maxX + mx, maxY: maxY + my };
  }

  function mergeFit(view, s) {
    var f = fitOf(s);
    if (!view) return f;
    return {
      minX: Math.min(view.minX, f.minX),
      minY: Math.min(view.minY, f.minY),
      maxX: Math.max(view.maxX, f.maxX),
      maxY: Math.max(view.maxY, f.maxY)
    };
  }

  /* ---------- mechanisms ---------- */

  var G_CR = { A: { x: 0, y: 0 }, D: { x: 3, y: 0 }, AB: 1, BC: 2.5, CD: 2.2 };
  var G_DC = { A: { x: 0, y: 0 }, D: { x: 1.05, y: 0 }, AB: 2.4, BC: 2.0, CD: 2.55 };
  var G_DR = { A: { x: 0, y: 0 }, D: { x: 2.2, y: 0 }, AB: 2.6, BC: 1.2, CD: 1.7 };

  function fourScene(g, pose, labels, arcs) {
    var s = scene();
    s.circles = s.circles.concat(arcs.circles || []);
    if (arcs.list) {
      for (var i = 0; i < arcs.list.length; i++) {
        var a = arcs.list[i];
        addArc(s, a.c, a.r, a.a0, a.a1, a.color, a.heads);
      }
    }
    addLink(s, pose.A, pose.D, COL.fixed, labels.fixed, -1, 9);
    addLink(s, pose.A, pose.B, COL.crank, labels.crank, 1, 8);
    addLink(s, pose.B, pose.C, COL.coupler, labels.coupler, 1, 8);
    addLink(s, pose.D, pose.C, labels.outColor || COL.rocker, labels.out, -1, 8);
    addJoint(s, pose.A, 'A', true);
    addJoint(s, pose.B, 'B', false);
    addJoint(s, pose.C, 'C', false);
    addJoint(s, pose.D, 'D', true);
    return s;
  }

  function envelopeOut(g, th0, th1, steps) {
    var prev = null;
    var outA = null, oMin = Infinity, oMax = -Infinity;
    var fails = 0, jumps = 0;
    for (var i = 0; i <= steps; i++) {
      var th = th0 + (th1 - th0) * i / steps;
      var p = solveFour(g, th, prev, 'upper');
      if (!p) { fails++; continue; }
      if (prev && dist(p.C, prev) > 0.45) jumps++;
      var oa = unwrap(outA, ang(p.D, p.C));
      outA = oa;
      if (oa < oMin) oMin = oa;
      if (oa > oMax) oMax = oa;
      prev = p.C;
    }
    return { outMin: oMin, outMax: oMax, fails: fails, jumps: jumps };
  }

  var crankRocker = {
    id: 'crank-rocker',
    name: '曲柄搖桿',
    cycle: 2 * Math.PI / 0.85,
    create: function () {
      var env = envelopeOut(G_CR, 0, 2 * Math.PI, 180);
      return { theta: 0.8, prev: null, env: env };
    },
    step: function (st, dt) { st.theta += dt * 0.85; },
    pose: function (st) {
      var p = solveFour(G_CR, st.theta, st.prev, 'upper');
      if (!p) p = solveFour(G_CR, st.theta, null, 'upper');
      if (!p) return scene();
      st.prev = { x: p.C.x, y: p.C.y };
      var s = fourScene(G_CR, p, {
        fixed: '固定桿', crank: '曲柄', coupler: '連接桿', out: '搖桿'
      }, {
        circles: [{ c: G_CR.A, r: G_CR.AB, color: '#93c5fd' }],
        list: [{ c: G_CR.D, r: 0.55, a0: st.env.outMin, a1: st.env.outMax, color: '#fdba74', heads: 'both' }]
      });
      addArc(s, G_CR.A, 0.55, st.theta - 0.9, st.theta, COL.crank, 'end');
      s.status = '曲柄整圈轉，搖桿只係擺';
      return s;
    }
  };

  var doubleCrank = {
    id: 'double-crank',
    name: '雙曲柄',
    cycle: 2 * Math.PI / 0.7,
    create: function () { return { theta: 0.6, prev: null }; },
    step: function (st, dt) { st.theta += dt * 0.7; },
    pose: function (st) {
      var p = solveFour(G_DC, st.theta, st.prev, 'upper');
      if (!p) p = solveFour(G_DC, st.theta, null, 'upper');
      if (!p) return scene();
      st.prev = { x: p.C.x, y: p.C.y };
      var outAng = ang(p.D, p.C);
      var s = fourScene(G_DC, p, {
        fixed: '固定桿', crank: '曲柄', coupler: '連接桿', out: '曲柄', outColor: COL.crank
      }, {
        circles: [
          { c: G_DC.A, r: G_DC.AB, color: '#93c5fd' },
          { c: G_DC.D, r: G_DC.CD, color: '#93c5fd' }
        ]
      });
      addArc(s, G_DC.A, 0.62, st.theta - 0.8, st.theta, COL.crank, 'end');
      addArc(s, G_DC.D, 0.62, outAng - 0.7, outAng, COL.crank, 'end');
      s.status = '最短係固定桿：兩條曲柄都整圈轉，方向相同';
      return s;
    }
  };

  var doubleRocker = {
    id: 'double-rocker',
    name: '雙搖桿',
    cycle: 2 * Math.PI / 0.85,
    create: function () {
      var w = rockerWindow(G_DR);
      var env = envelopeOut(G_DR, w.th0, w.th1, 80);
      return { phase: 0.4, prev: null, w: w, env: env };
    },
    step: function (st, dt) { st.phase += dt * 0.85; },
    pose: function (st) {
      var mid = (st.w.th0 + st.w.th1) / 2;
      var amp = (st.w.th1 - st.w.th0) / 2;
      var theta = mid + amp * Math.sin(st.phase);
      var p = solveFour(G_DR, theta, st.prev, 'upper');
      if (!p) p = solveFour(G_DR, theta, null, 'upper');
      if (!p) return scene();
      st.prev = { x: p.C.x, y: p.C.y };
      var mir = function (q) { return { x: q.x, y: -q.y }; };
      var mp = { A: mir(p.A), B: mir(p.B), C: mir(p.C), D: mir(p.D) };
      var s = fourScene(G_DR, mp, {
        fixed: '固定桿', crank: '搖桿', coupler: '連接桿', out: '搖桿'
      }, {
        list: [
          { c: G_DR.A, r: 0.5, a0: -st.w.th1, a1: -st.w.th0, color: '#93c5fd', heads: 'both' },
          { c: G_DR.D, r: 0.5, a0: -st.env.outMax, a1: -st.env.outMin, color: '#fdba74', heads: 'both' }
        ]
      });
      s.status = '最短係連接桿：兩邊都係搖桿，輸入來回擺';
      return s;
    }
  };

  var recip = {
    id: 'reciprocating',
    name: '往復滑塊曲柄',
    cycle: 2 * Math.PI / 0.9,
    create: function () { return { theta: 0.7 }; },
    step: function (st, dt) { st.theta += dt * 0.9; },
    pose: function (st) {
      var r = 1, L = 3.4;
      var B = { x: r * Math.cos(st.theta), y: r * Math.sin(st.theta) };
      var s = scene();
      var under = r * Math.sin(st.theta);
      var x = r * Math.cos(st.theta) + Math.sqrt(L * L - under * under);
      var C = { x: x, y: 0 };
      var xmin = L - r, xmax = L + r;
      s.rails.push({ a: { x: xmin - 0.45, y: 0 }, b: { x: xmax + 0.45, y: 0 } });
      s.fit.push({ x: xmin - 0.5, y: 0 }, { x: xmax + 0.5, y: 0 });
      s.circles.push({ c: { x: 0, y: 0 }, r: r, color: '#93c5fd' });
      s.fit.push(pol({ x: 0, y: 0 }, r, 0), pol({ x: 0, y: 0 }, r, Math.PI / 2), pol({ x: 0, y: 0 }, r, Math.PI));
      addLink(s, { x: 0, y: 0 }, B, COL.crank, '曲柄', 1, 8);
      addLink(s, B, C, COL.coupler, '連桿', 1, 8);
      addArc(s, { x: 0, y: 0 }, 0.48, st.theta - 0.85, st.theta, COL.crank, 'end');
      s.blocks.push({ p: C, w: 46, h: 32, rot: 0, color: COL.slider, label: '滑塊', labelDy: 30 });
      s.fit.push({ x: C.x, y: -0.55 }, { x: C.x, y: 0.45 });
      addJoint(s, { x: 0, y: 0 }, 'A', true);
      addJoint(s, B, 'B', false);
      addJoint(s, C, 'C', false);
      s.polys.push({
        pts: [{ x: xmin, y: -0.72 }, { x: xmax, y: -0.72 }],
        color: COL.ink, w: 1.6
      });
      s.fit.push({ x: xmin, y: -1.15 }, { x: xmax, y: -0.55 });
      s.texts.push({ p: { x: (xmin + xmax) / 2, y: -0.72 }, text: '行程 ≈ 兩倍曲柄', dy: 16, size: 13 });
      s.status = '曲柄轉，滑塊沿固定導槽往復；行程約等於兩倍曲柄';
      return s;
    }
  };

  var WH = { bx: 1, by: 0.8, r: 1.6, Rd: 1.8, rod: 4.05, ramY: -1.8 };
  var WH_TABLE = null;
  var WH_META = null;

  function whitParts(theta) {
    var P = { x: WH.bx + WH.r * Math.cos(theta), y: WH.by + WH.r * Math.sin(theta) };
    var angP = Math.atan2(P.y, P.x);
    var Dp = { x: WH.Rd * Math.cos(angP), y: WH.Rd * Math.sin(angP) };
    return { P: P, Dp: Dp, angP: angP };
  }

  function buildWhit() {
    if (WH_TABLE) return;
    var N = 720;
    var table = new Array(N);
    var prev = null;
    var i;
    for (i = 0; i < N; i++) {
      var th = (2 * Math.PI * i) / N;
      var part = whitParts(th);
      var dy = part.Dp.y - WH.ramY;
      var disc = WH.rod * WH.rod - dy * dy;
      var h = Math.sqrt(Math.max(0, disc));
      var x1 = part.Dp.x + h;
      var x2 = part.Dp.x - h;
      var x = prev == null ? x1 : (Math.abs(x1 - prev) <= Math.abs(x2 - prev) ? x1 : x2);
      table[i] = x;
      prev = x;
    }
    var imx = 0, imn = 0;
    for (i = 1; i < N; i++) {
      if (table[i] > table[imx]) imx = i;
      if (table[i] < table[imn]) imn = i;
    }
    var tMax = (2 * Math.PI * imx) / N;
    var tMin = (2 * Math.PI * imn) / N;
    var d1 = ccwSpan(tMax, tMin);
    var d2 = ccwSpan(tMin, tMax);
    var cutFrom, cutTo, cut, ret;
    if (d1 >= d2) { cutFrom = tMax; cutTo = tMin; cut = d1; ret = d2; }
    else { cutFrom = tMin; cutTo = tMax; cut = d2; ret = d1; }
    WH_TABLE = table;
    WH_META = { tMax: tMax, tMin: tMin, cutFrom: cutFrom, cutTo: cutTo, cut: cut, ret: ret, xMax: table[imx], xMin: table[imn] };
  }

  function whitX(theta) {
    buildWhit();
    var u = ((theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    var i = Math.round((u / (Math.PI * 2)) * WH_TABLE.length) % WH_TABLE.length;
    return WH_TABLE[i];
  }

  var revolving = {
    id: 'revolving',
    name: '迴轉滑塊曲柄',
    cycle: 2 * Math.PI / 0.75,
    create: function () { buildWhit(); return { theta: 0.4 }; },
    step: function (st, dt) { st.theta += dt * 0.75; },
    pose: function (st) {
      buildWhit();
      var part = whitParts(st.theta);
      var x = whitX(st.theta);
      var R = { x: x, y: WH.ramY };
      var B = { x: WH.bx, y: WH.by };
      var A = { x: 0, y: 0 };
      var s = scene();
      var reach = Math.hypot(part.P.x, part.P.y);
      var tip = pol(A, Math.max(reach, WH.Rd) + 0.35, part.angP);
      s.rails.push({ a: { x: WH_META.xMin - 0.4, y: WH.ramY }, b: { x: WH_META.xMax + 0.45, y: WH.ramY } });
      s.fit.push({ x: WH_META.xMin - 0.5, y: WH.ramY }, { x: WH_META.xMax + 0.5, y: WH.ramY });
      addLink(s, A, tip, COL.rocker, '迴轉桿（件3）', 1, 7);
      addLink(s, B, part.P, COL.crank, '曲柄（件1）', 1, 8);
      addLink(s, part.Dp, R, COL.coupler, '連桿', -1, 7);
      var th = ((st.theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      var cutting = inCCW(th, WH_META.cutFrom, WH_META.cutTo);
      s.blocks.push({
        p: part.P, w: 28, h: 22, rot: part.angP, color: COL.slider, label: '滑塊（件2）', labelDy: -24, slot: true
      });
      s.fit.push({ x: part.P.x, y: part.P.y + 0.45 }, { x: part.P.x, y: part.P.y - 0.45 });
      s.blocks.push({
        p: R, w: 40, h: 28, rot: 0,
        color: cutting ? COL.cut : COL.ret,
        label: cutting ? '衝頭 · 切削' : '衝頭 · 回程',
        labelDy: 28
      });
      s.fit.push({ x: R.x, y: R.y - 0.7 });
      addArc(s, B, 0.42, WH_META.cutFrom, WH_META.cutFrom + WH_META.cut, COL.cut, 'end');
      addArc(s, B, 0.62, WH_META.cutTo, WH_META.cutTo + WH_META.ret, COL.ret, 'end');
      addJoint(s, A, 'A', true);
      addJoint(s, B, 'B', true);
      addJoint(s, part.P, '', false);
      addJoint(s, part.Dp, '', false);
      addJoint(s, R, '', false);
      var deg1 = Math.round(WH_META.cut * 180 / Math.PI);
      var deg2 = Math.round(WH_META.ret * 180 / Math.PI);
      s.fraction = { n: 'θ₁ ' + deg1 + '°', d: 'θ₂ ' + deg2 + '°', cap: '切削時間比回程時間' };
      s.status = '件1繞 B 轉，件2喺件3上滑並繞 B；件3繞 A 轉。θ₁ ' + deg1 + '°，θ₂ ' + deg2 + '°';
      return s;
    }
  };

  var oscillating = {
    id: 'oscillating',
    name: '擺動滑塊曲柄',
    cycle: 2 * Math.PI / 0.9,
    create: function () { return { theta: 1.1 }; },
    step: function (st, dt) { st.theta += dt * 0.9; },
    pose: function (st) {
      var O = { x: 0, y: 0 };
      var C = { x: 3.05, y: 0 };
      var r = 1.25;
      var P = { x: r * Math.cos(st.theta), y: r * Math.sin(st.theta) };
      var psi = Math.atan2(P.y - C.y, P.x - C.x);
      var dir = { x: Math.cos(psi), y: Math.sin(psi) };
      var tail = { x: C.x - dir.x * 0.45, y: C.y - dir.y * 0.45 };
      var tip = { x: C.x + dir.x * 4.55, y: C.y + dir.y * 4.55 };
      var s = scene();
      s.circles.push({ c: O, r: r, color: '#93c5fd' });
      s.fit.push(pol(O, r, Math.PI / 2), pol(O, r, -Math.PI / 2));
      addLink(s, tail, tip, '#f59e0b', '', 1, 18);
      addLink(s, O, P, COL.crank, '曲柄', 1, 8);
      s.blocks.push({ p: P, w: 26, h: 20, rot: psi, color: COL.slider, label: '活塞', labelDy: -22 });
      s.fit.push({ x: P.x, y: P.y + 0.4 });
      s.texts.push({ p: lerp(C, tip, 0.55), text: '擺動汽缸', dy: -16, size: 12 });
      addArc(s, O, 0.5, st.theta - 0.8, st.theta, COL.crank, 'end');
      var swing = Math.asin(clamp(r / dist(O, C), -1, 1));
      var base = Math.PI;
      addArc(s, C, 0.7, base - swing, base + swing, '#fdba74', 'both');
      addJoint(s, O, '', true);
      addJoint(s, C, '', true);
      addJoint(s, P, '', false);
      s.fit.push(tail, tip, { x: C.x, y: 1.1 }, { x: C.x, y: -1.1 });
      s.status = '曲柄轉，汽缸（導槽）本身來回擺';
      return s;
    }
  };

  var fixedSlider = {
    id: 'fixed-slider',
    name: '固定滑塊曲柄',
    cycle: 2 * Math.PI / 0.8,
    create: function () { return { phase: 0.2 }; },
    step: function (st, dt) { st.phase += dt * 0.8; },
    pose: function (st) {
      var phi = 0.58 * Math.sin(st.phase);
      var O = { x: 0, y: 3.35 };
      var Lh = 1.5;
      var H = { x: O.x + Lh * Math.sin(phi), y: O.y - Lh * Math.cos(phi) };
      var xRod = 1.22;
      var Lr = 2.2;
      var dx = xRod - H.x;
      var disc = Lr * Lr - dx * dx;
      var y = H.y - Math.sqrt(Math.max(0, disc));
      var P = { x: xRod, y: y };
      var rodBot = { x: xRod, y: y - 1.85 };
      var rodTop = { x: xRod, y: y + 0.15 };
      var s = scene();
      s.rails.push({ a: { x: xRod, y: -0.85 }, b: { x: xRod, y: 2.15 } });
      addLink(s, O, H, COL.crank, '把手', 1, 8);
      addLink(s, H, P, COL.coupler, '連桿', 1, 8);
      addLink(s, rodBot, rodTop, '#334155', '滑桿', 1, 6);
      s.blocks.push({ p: { x: xRod, y: 0.35 }, w: 54, h: 36, rot: 0, color: '#475569' });
      s.texts.push({ p: { x: xRod + 0.42, y: 0.35 }, text: '固定滑塊', size: 12, align: 'left' });
      s.fit.push({ x: xRod - 0.7, y: 0.35 }, { x: xRod + 1.35, y: 0.35 }, rodBot, rodTop, O, H);
      addJoint(s, O, '', true);
      addJoint(s, H, '', false);
      addJoint(s, P, '', false);
      s.polys.push({
        pts: [{ x: xRod - 0.38, y: -1.55 }, { x: xRod + 0.38, y: -1.55 }, { x: xRod + 0.38, y: -0.95 }, { x: xRod - 0.38, y: -0.95 }, { x: xRod - 0.38, y: -1.55 }],
        color: '#94a3b8', w: 2
      });
      s.texts.push({ p: { x: xRod + 0.55, y: -1.25 }, text: '泵筒', size: 12, align: 'left' });
      s.fit.push({ x: xRod - 0.5, y: -1.7 }, { x: xRod + 1.1, y: -0.9 });
      s.status = '把手繞上方樞軸擺，滑桿沿固定滑塊上下往復';
      return s;
    }
  };

  function ellipsePts(L, t) {
    var pts = [];
    for (var i = 0; i <= 72; i++) {
      var th = (2 * Math.PI * i) / 72;
      pts.push({ x: (1 - t) * L * Math.cos(th), y: t * L * Math.sin(th) });
    }
    return pts;
  }

  var doubleSlider = {
    id: 'double-slider',
    name: '雙滑塊',
    modes: [
      { id: 'perp', button: '切換：蘇格蘭軛' },
      { id: 'scotch', button: '切換：垂直雙滑塊' }
    ],
    cycle: 2 * Math.PI / 0.8,
    create: function (mode) { return { theta: 0.5, mode: mode || 'perp' }; },
    step: function (st, dt) { st.theta += dt * 0.8; },
    pose: function (st) {
      var s = scene();
      if (st.mode === 'scotch') {
        var r = 1;
        var pin = { x: r * Math.cos(st.theta), y: r * Math.sin(st.theta) };
        var yoke = [
          { x: pin.x - 0.28, y: -1.2 },
          { x: pin.x + 0.28, y: -1.2 },
          { x: pin.x + 0.28, y: 1.2 },
          { x: pin.x - 0.28, y: 1.2 },
          { x: pin.x - 0.28, y: -1.2 }
        ];
        s.rails.push({ a: { x: -1.7, y: 1.25 }, b: { x: 1.7, y: 1.25 } });
        s.rails.push({ a: { x: -1.7, y: -1.25 }, b: { x: 1.7, y: -1.25 } });
        s.polys.push({ pts: yoke, color: '#5b21b6', fill: '#7c3aed', w: 3 });
        s.polys.push({
          pts: [{ x: pin.x, y: -1.05 }, { x: pin.x, y: 1.05 }],
          color: '#ffffff', w: 5
        });
        yoke.forEach(function (pt) { s.fit.push(pt); });
        s.fit.push({ x: -1.9, y: 1.6 }, { x: 1.9, y: -1.6 });
        addLink(s, { x: 0, y: 0 }, pin, COL.crank, '曲柄', 1, 8);
        s.texts.push({ p: { x: pin.x, y: -1.45 }, text: '軛', size: 12 });
        addJoint(s, { x: 0, y: 0 }, '', true);
        addJoint(s, pin, '', false);
        var sine = [];
        for (var i = 0; i <= 60; i++) {
          var th = (2 * Math.PI * i) / 60;
          sine.push({ x: 2.5 + (i / 60) * 2.4, y: 0.85 * Math.cos(th) });
        }
        s.polys.push({ pts: sine, color: COL.trace, w: 2.5 });
        sine.forEach(function (pt) { s.fit.push(pt); });
        var u = ((st.theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        s.fit.push({ x: 2.5 + (u / (Math.PI * 2)) * 2.4, y: 0.85 * Math.cos(st.theta) });
        s.texts.push({
          p: { x: 2.5 + (u / (Math.PI * 2)) * 2.4, y: 0.85 * Math.cos(st.theta) },
          text: '●', size: 14, color: COL.trace
        });
        s.texts.push({ p: { x: 3.7, y: 1.25 }, text: '簡諧', size: 12 });
        s.status = '蘇格蘭軛：直線槽，輸出係簡諧來回';
        return s;
      }
      var L = 2.15;
      var t = 0.62;
      var P = { x: L * Math.cos(st.theta), y: 0 };
      var Q = { x: 0, y: L * Math.sin(st.theta) };
      var R = { x: (1 - t) * P.x, y: t * Q.y };
      s.rails.push({ a: { x: -L - 0.35, y: 0 }, b: { x: L + 0.35, y: 0 } });
      s.rails.push({ a: { x: 0, y: -L - 0.35 }, b: { x: 0, y: L + 0.35 } });
      s.polys.push({ pts: ellipsePts(L, t), color: COL.trace, w: 2 });
      addLink(s, P, Q, COL.coupler, '連桿', 1, 8);
      s.blocks.push({ p: P, w: 36, h: 26, rot: 0, color: COL.slider, label: '水平滑塊', labelDy: 26 });
      s.blocks.push({ p: Q, w: 26, h: 36, rot: 0, color: '#7c3aed', label: '垂直滑塊', labelDy: 30 });
      s.fit.push({ x: P.x, y: -0.55 }, { x: -0.7, y: Q.y });
      addJoint(s, R, '', false);
      s.texts.push({ p: R, text: '橢圓點', dy: -16, size: 12, color: COL.trace });
      s.status = '兩個滑塊，槽互相垂直；連桿上嘅點行橢圓';
      return s;
    }
  };

  var isosceles = {
    id: 'isosceles',
    name: '等腰連桿',
    cycle: 2 * Math.PI / 0.7,
    create: function () { return { phase: 0.3 }; },
    step: function (st, dt) { st.phase += dt * 0.7; },
    pose: function (st) {
      var L = 1.35;
      var lo = 0.48, hi = Math.PI - 0.48;
      var theta = (lo + hi) / 2 + (hi - lo) / 2 * Math.sin(st.phase);
      var O = { x: 0, y: 0 };
      var M = { x: L * Math.cos(theta), y: L * Math.sin(theta) };
      var P = { x: 0, y: 2 * L * Math.sin(theta) };
      var Q = { x: 2 * L * Math.cos(theta), y: 0 };
      var s = scene();
      var yTop = 2 * L * Math.sin(hi > Math.PI / 2 ? Math.PI / 2 : hi);
      s.rails.push({ a: { x: 0, y: 0.2 }, b: { x: 0, y: 2 * L + 0.25 } });
      s.rails.push({ a: { x: -2 * L - 0.3, y: 0 }, b: { x: 2 * L + 0.3, y: 0 } });
      s.polys.push({
        pts: [{ x: -2 * L * Math.cos(lo), y: 0 }, { x: 2 * L * Math.cos(lo), y: 0 }],
        color: COL.trace, w: 3
      });
      addLink(s, O, M, COL.crank, '等長桿', -1, 8);
      addLink(s, P, Q, COL.coupler, '等長桿', 1, 8);
      s.blocks.push({ p: P, w: 28, h: 36, rot: 0, color: COL.slider, label: '滑塊', labelDy: 28 });
      s.fit.push({ x: -0.7, y: P.y });
      addJoint(s, O, '', true);
      addJoint(s, M, '', false);
      addJoint(s, Q, '', false);
      s.texts.push({ p: Q, text: '直線', dy: 18, size: 12, color: COL.trace });
      s.fit.push({ x: -2 * L - 0.2, y: -0.45 }, { x: 2 * L + 0.2, y: yTop + 0.2 }, P, Q, M);
      s.status = '兩條等長桿：一端行直線（司羅氏意象）';
      return s;
    }
  };

  var parallelEq = {
    id: 'parallel-equal',
    name: '平行相等曲柄',
    cycle: 2 * Math.PI / 0.8,
    create: function () { return { theta: 0.9 }; },
    step: function (st, dt) { st.theta += dt * 0.8; },
    pose: function (st) {
      var R = 1.05, d = 3.35;
      var A = { x: 0, y: 0 }, D = { x: d, y: 0 };
      var B = pol(A, R, st.theta);
      var C = pol(D, R, st.theta);
      var s = scene();
      s.circles.push({ c: A, r: R, color: '#334155', dash: [] });
      s.circles.push({ c: D, r: R, color: '#334155', dash: [] });
      s.fit.push(pol(A, R, Math.PI / 2), pol(A, R, -Math.PI / 2), pol(D, R, Math.PI / 2), pol(D, R, -Math.PI / 2));
      s.rails.push({ a: { x: -R - 0.15, y: -R }, b: { x: d + R + 0.15, y: -R } });
      s.fit.push({ x: -R, y: -R - 0.25 }, { x: d + R, y: -R });
      addLink(s, A, B, COL.crank, '曲柄', 1, 8);
      addLink(s, D, C, COL.crank, '曲柄', 1, 8);
      addLink(s, B, C, COL.coupler, '平行桿', 1, 8);
      addArc(s, A, 0.42, st.theta - 0.8, st.theta, COL.crank, 'end');
      addArc(s, D, 0.42, st.theta - 0.8, st.theta, COL.crank, 'end');
      addJoint(s, A, '', true);
      addJoint(s, D, '', true);
      addJoint(s, B, '', false);
      addJoint(s, C, '', false);
      s.status = '平行四邊形：兩曲柄等長，同向、同角速度';
      return s;
    }
  };

  var STEER = { AD: 3.2, arm: 1.1, tie: 2.3 };

  function steerRef() {
    var best = 0.4, bestErr = 1e9;
    for (var i = 0; i <= 90; i++) {
      var psi = i * Math.PI / 180;
      var A = { x: -STEER.AD / 2, y: 0 };
      var D = { x: STEER.AD / 2, y: 0 };
      var B = { x: A.x + STEER.arm * Math.sin(psi), y: STEER.arm * Math.cos(psi) };
      var C = { x: D.x + STEER.arm * Math.sin(-psi), y: STEER.arm * Math.cos(psi) };
      var err = Math.abs(dist(B, C) - STEER.tie);
      if (err < bestErr) { bestErr = err; best = psi; }
    }
    return best;
  }

  function steerAt(psi, prev) {
    var A = { x: -STEER.AD / 2, y: 0 };
    var D = { x: STEER.AD / 2, y: 0 };
    var B = { x: A.x + STEER.arm * Math.sin(psi), y: STEER.arm * Math.cos(psi) };
    var cs = circleCircle(D, STEER.arm, B, STEER.tie);
    var C = pick(cs, prev, 'upper');
    if (!C) return null;
    var phi = Math.atan2(C.x - D.x, C.y - D.y);
    return { A: A, D: D, B: B, C: C, phi: phi };
  }

  function wheelPoly(center, heading, len, wid) {
    var fx = Math.sin(heading), fy = Math.cos(heading);
    var sx = -fy, sy = fx;
    var pts = [];
    var corners = [[len, wid], [len, -wid], [-len, -wid], [-len, wid], [len, wid]];
    for (var i = 0; i < corners.length; i++) {
      pts.push({
        x: center.x + fx * corners[i][0] + sx * corners[i][1],
        y: center.y + fy * corners[i][0] + sy * corners[i][1]
      });
    }
    return pts;
  }

  var nonparallel = {
    id: 'nonparallel-equal',
    name: '不平行等曲柄',
    modes: [
      { id: 'steer', button: '切換：交叉平行四邊形' },
      { id: 'cross', button: '切換：轉向意象' }
    ],
    cycle: 2 * Math.PI / 0.7,
    create: function (mode) {
      return { phase: 0.2, theta: 0.9, prev: null, mode: mode || 'steer', psiRef: steerRef() };
    },
    step: function (st, dt) {
      st.phase += dt * 0.75;
      st.theta += dt * 0.7;
    },
    pose: function (st) {
      if (st.mode === 'cross') {
        var a = 1.25, b = 2.6;
        var phi = crossedPhi(a, b, st.theta);
        var A = { x: 0, y: 0 }, D = { x: b, y: 0 };
        var B = pol(A, a, st.theta);
        var C = pol(D, a, phi);
        var s = scene();
        addLink(s, A, D, COL.fixed, '連心線', -1, 8);
        addLink(s, B, C, COL.coupler, '浮桿', 1, 8);
        addLink(s, A, B, COL.crank, '曲柄', 1, 8);
        addLink(s, D, C, COL.rocker, '曲柄', -1, 8);
        addArc(s, A, 0.48, st.theta - 0.7, st.theta, COL.crank, 'end');
        addArc(s, D, 0.48, phi + 0.7, phi, COL.ret, 'end');
        addJoint(s, A, '', true);
        addJoint(s, D, '', true);
        addJoint(s, B, '', false);
        addJoint(s, C, '', false);
        s.texts.push({ p: pol(A, 0.85, st.theta + 0.5), text: '逆時針', size: 11, color: COL.crank });
        s.texts.push({ p: pol(D, 0.9, phi - 0.55), text: '順時針', size: 11, color: COL.ret });
        s.status = '交叉平行四邊形：兩曲柄等長，連心線＝浮桿，轉向相反';
        return s;
      }
      var lo = 8 * Math.PI / 180, hi = 68 * Math.PI / 180;
      var mid = (lo + hi) / 2, amp = (hi - lo) / 2;
      var psi = mid + amp * Math.sin(st.phase);
      var p = steerAt(psi, st.prev);
      if (!p) p = steerAt(psi, null);
      if (!p) return scene();
      st.prev = { x: p.C.x, y: p.C.y };
      var s2 = scene();
      var hL = psi - st.psiRef;
      var hR = p.phi - (-st.psiRef);
      s2.polys.push({ pts: wheelPoly(p.A, hL, 0.34, 0.12), color: COL.ink, w: 3 });
      s2.polys.push({ pts: wheelPoly(p.D, hR, 0.34, 0.12), color: COL.ink, w: 3 });
      s2.fit.push.apply(s2.fit, wheelPoly(p.A, hL, 0.34, 0.12));
      s2.fit.push.apply(s2.fit, wheelPoly(p.D, hR, 0.34, 0.12));
      addLink(s2, p.A, p.D, COL.fixed, '固定鉸', -1, 8);
      addLink(s2, p.A, p.B, COL.crank, '曲柄', 1, 8);
      addLink(s2, p.D, p.C, COL.crank, '曲柄', -1, 8);
      addLink(s2, p.B, p.C, COL.coupler, '浮桿', 1, 7);
      addJoint(s2, p.A, '', true);
      addJoint(s2, p.D, '', true);
      addJoint(s2, p.B, '', false);
      addJoint(s2, p.C, '', false);
      var dL = Math.round(hL * 180 / Math.PI);
      var dR = Math.round(hR * 180 / Math.PI);
      s2.texts.push({ p: { x: p.A.x, y: -0.35 }, text: '左 ' + dL + '°', size: 13 });
      s2.texts.push({ p: { x: p.D.x, y: -0.35 }, text: '右 ' + dR + '°', size: 13 });
      s2.fit.push({ x: p.A.x, y: -0.7 }, { x: p.D.x, y: -0.7 });
      s2.status = '兩曲柄等長，但固定鉸距 ≠ 浮桿，所以轉角唔同（轉向意象）';
      return s2;
    }
  };

  function togglePose(theta) {
    var A = { x: 0, y: 0 };
    var AB = 1.6, BC = 1.6, railY = -0.22;
    var B = { x: AB * Math.cos(theta), y: -AB * Math.sin(theta) };
    var dy = railY - B.y;
    var disc = BC * BC - dy * dy;
    if (disc < 0) return null;
    var C = { x: B.x + Math.sqrt(disc), y: railY };
    var v1 = sub(A, B), v2 = sub(C, B);
    var cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y));
    var bend = Math.acos(clamp(cos, -1, 1));
    return { A: A, B: B, C: C, bend: bend, railY: railY };
  }

  var toggle = {
    id: 'toggle',
    name: '肘節',
    cycle: 2 * Math.PI / 0.55,
    create: function () { return { phase: -0.4 }; },
    step: function (st, dt) { st.phase += dt * 0.55; },
    pose: function (st) {
      var theta = 0.09 + 0.92 * (0.5 + 0.5 * Math.sin(st.phase));
      var p = togglePose(theta);
      if (!p) return scene();
      var s = scene();
      var near = p.bend > 2.95;
      s.rails.push({ a: { x: 0.3, y: p.railY }, b: { x: 3.5, y: p.railY } });
      s.fit.push({ x: 0.2, y: p.railY }, { x: 3.6, y: p.railY });
      addLink(s, p.A, p.B, COL.crank, '桿 1', -1, 8);
      addLink(s, p.B, p.C, COL.coupler, '桿 2', -1, 8);
      s.blocks.push({ p: p.C, w: 36, h: 32, rot: 0, color: near ? COL.ret : COL.slider, label: '輸出', labelDy: 28 });
      s.fit.push({ x: p.C.x, y: p.railY - 0.7 });
      addJoint(s, p.A, '', true);
      addJoint(s, p.B, '', false);
      addJoint(s, p.C, '', false);
      var force = near ? 1 : clamp((p.bend - 1.2) / 1.8, 0.15, 0.85);
      var tip = { x: p.C.x + 0.15 + force * 0.9, y: p.railY + 0.55 };
      s.polys.push({ pts: [{ x: p.C.x, y: p.railY + 0.55 }, tip], color: COL.ret, w: near ? 4 : 2 });
      s.fit.push(tip, { x: p.C.x, y: p.railY + 1.0 });
      s.texts.push({ p: tip, text: near ? '力大' : '力', dx: 16, size: 12, color: COL.ret, align: 'left' });
      s.dwellRequest = near ? 1.15 : 0;
      s.releaseHold = p.bend < 2.3;
      s.status = near ? '接近伸直：輸出位移細、力大' : '兩桿收摺；伸直嗰陣輸出幾乎唔郁';
      return s;
    }
  };

  function housePts(center, scale) {
    var raw = [[-0.28, -0.22], [0.28, -0.22], [0.28, 0.18], [0, 0.42], [-0.28, 0.18], [-0.28, -0.22]];
    return raw.map(function (p) {
      return { x: center.x + p[0] * scale, y: center.y + p[1] * scale };
    });
  }

  function pathPoint(pts, u) {
    var seg = [];
    var total = 0;
    var i;
    for (i = 0; i < pts.length - 1; i++) {
      var L = dist(pts[i], pts[i + 1]);
      seg.push(L);
      total += L;
    }
    var d = ((u % 1) + 1) % 1 * total;
    for (i = 0; i < seg.length; i++) {
      if (d <= seg[i] || i === seg.length - 1) {
        var t = seg[i] < 1e-9 ? 0 : d / seg[i];
        return lerp(pts[i], pts[i + 1], clamp(t, 0, 1));
      }
      d -= seg[i];
    }
    return pts[0];
  }

  var pantograph = {
    id: 'pantograph',
    name: '比例運動',
    cycle: 8,
    create: function () { return { u: 0.02, prev: null, path: housePts({ x: 0.15, y: -1.22 }, 1) }; },
    step: function (st, dt) { st.u += dt / 8; },
    pose: function (st) {
      var P = pathPoint(st.path, st.u);
      var a = 1.15, b = 0.95;
      var cs = circleCircle({ x: 0, y: 0 }, a, P, b);
      var A = pick(cs, st.prev, 'left');
      if (!A) return scene();
      st.prev = { x: A.x, y: A.y };
      var B = { x: P.x - A.x, y: P.y - A.y };
      var Ap = { x: 2 * A.x, y: 2 * A.y };
      var Bp = { x: 2 * B.x, y: 2 * B.y };
      var Q = { x: 2 * P.x, y: 2 * P.y };
      var O = { x: 0, y: 0 };
      var s = scene();
      var big = housePts({ x: 0.3, y: -2.44 }, 2);
      s.polys.push({ pts: st.path, color: COL.trace, w: 2 });
      s.polys.push({ pts: big, color: COL.trace2, w: 2.4 });
      st.path.forEach(function (pt) { s.fit.push(pt); });
      big.forEach(function (pt) { s.fit.push(pt); });
      addLink(s, O, Ap, '#60a5fa', '', 1, 6);
      addLink(s, O, Bp, '#6ee7b7', '', 1, 6);
      addLink(s, A, P, COL.crank, '', 1, 7);
      addLink(s, B, P, COL.coupler, '', 1, 7);
      addLink(s, Ap, Q, COL.crank, '', 1, 7);
      addLink(s, Bp, Q, COL.coupler, '', 1, 7);
      s.polys.push({ pts: [O, Q], color: '#cbd5e1', w: 1.5, dash: [4, 4] });
      addJoint(s, O, '', true);
      addJoint(s, A, '', false);
      addJoint(s, B, '', false);
      addJoint(s, P, '', false);
      addJoint(s, Q, '', false);
      s.texts.push({ p: P, text: '描點', dy: -16, size: 12, color: COL.trace });
      s.texts.push({ p: Q, text: '筆 · 2倍', dy: -18, size: 13, color: COL.trace2 });
      s.fit.push(O, A, B, Ap, Bp, P, Q);
      s.status = '平行四邊形縮放：筆行描點嘅相似 2 倍軌跡';
      return s;
    }
  };

  function sphVec(theta, prevC) {
    var alpha = 1.2, beta = 1.1, gamma = 1.3, delta = 1.2;
    var A = { x: 0, y: 0, z: 1 };
    var D = { x: Math.sin(alpha), y: 0, z: Math.cos(alpha) };
    var B = {
      x: Math.sin(beta) * Math.cos(theta),
      y: Math.sin(beta) * Math.sin(theta),
      z: Math.cos(beta)
    };
    var c = B.x * D.x + B.y * D.y + B.z * D.z;
    var denom = 1 - c * c;
    if (denom < 1e-8) return null;
    var cg = Math.cos(gamma), cd = Math.cos(delta);
    var x = (cg - c * cd) / denom;
    var y = (cd - c * cg) / denom;
    var N = {
      x: B.y * D.z - B.z * D.y,
      y: B.z * D.x - B.x * D.z,
      z: B.x * D.y - B.y * D.x
    };
    var lin = { x: x * B.x + y * D.x, y: x * B.y + y * D.y, z: x * B.z + y * D.z };
    var lin2 = lin.x * lin.x + lin.y * lin.y + lin.z * lin.z;
    var s2 = (1 - lin2) / denom;
    if (s2 < -1e-5) return null;
    var s = Math.sqrt(Math.max(0, s2));
    var C1 = { x: lin.x + s * N.x, y: lin.y + s * N.y, z: lin.z + s * N.z };
    var C2 = { x: lin.x - s * N.x, y: lin.y - s * N.y, z: lin.z - s * N.z };
    var C = C1;
    if (prevC) {
      var d1 = Math.hypot(C1.x - prevC.x, C1.y - prevC.y, C1.z - prevC.z);
      var d2 = Math.hypot(C2.x - prevC.x, C2.y - prevC.y, C2.z - prevC.z);
      C = d1 <= d2 ? C1 : C2;
    }
    return { A: A, B: B, C: C, D: D };
  }

  function sphArc(u, v) {
    var pts = [];
    for (var i = 0; i <= 16; i++) pts.push(slerp(u, v, i / 16));
    return pts;
  }

  var spherical = {
    id: 'spherical',
    name: '球面四連桿',
    cycle: 2 * Math.PI / 0.55,
    create: function () { return { theta: 0.4, prev: null }; },
    step: function (st, dt) { st.theta += dt * 0.55; },
    pose: function (st) {
      var p = sphVec(st.theta, st.prev);
      if (!p) p = sphVec(st.theta, null);
      if (!p) return { spherical: true, chains: [], status: '' };
      st.prev = p.C;
      return {
        spherical: true,
        status: '示意：四條鉸軸交於球心，桿件沿球面郁（唔係精密模擬）',
        chains: [
          { pts: sphArc(p.A, p.D), color: COL.fixed, label: '固定桿', w: 7 },
          { pts: sphArc(p.A, p.B), color: COL.crank, label: '曲柄', w: 7 },
          { pts: sphArc(p.B, p.C), color: COL.coupler, label: '連接桿', w: 7 },
          { pts: sphArc(p.D, p.C), color: COL.rocker, label: '從動桿', w: 7 }
        ],
        joints: [p.A, p.B, p.C, p.D],
        axes: [p.A, p.B, p.C, p.D]
      };
    }
  };

  var MODELS = {
    'crank-rocker': crankRocker,
    'double-crank': doubleCrank,
    'double-rocker': doubleRocker,
    reciprocating: recip,
    revolving: revolving,
    oscillating: oscillating,
    'fixed-slider': fixedSlider,
    'double-slider': doubleSlider,
    isosceles: isosceles,
    'parallel-equal': parallelEq,
    'nonparallel-equal': nonparallel,
    toggle: toggle,
    pantograph: pantograph,
    spherical: spherical
  };

  function computeView(model, mode) {
    var st = model.create(mode);
    var view = null;
    var n = 90;
    var dt = (model.cycle || 8) / n;
    for (var i = 0; i < n; i++) {
      var sc = model.pose(st);
      if (!sc.spherical) view = mergeFit(view, sc);
      model.step(st, dt);
    }
    var sc2 = model.pose(st);
    if (!sc2.spherical) view = mergeFit(view, sc2);
    return view || { minX: -2, minY: -2, maxX: 2, maxY: 2 };
  }

  function drawFraction(ctx, w, frac) {
    if (!frac) return;
    var x = w - 78, y = 28;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(x - 62, 8, 132, 62);
    ctx.font = '700 12px ' + FONT;
    ctx.fillStyle = COL.ink;
    ctx.textAlign = 'center';
    ctx.fillText(frac.cap, x, 18);
    ctx.font = '700 13px ' + FONT;
    ctx.fillText(frac.n, x, 36);
    ctx.beginPath();
    ctx.moveTo(x - 36, 42);
    ctx.lineTo(x + 36, 42);
    ctx.strokeStyle = COL.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillText(frac.d, x, 58);
    ctx.restore();
  }

  function drawSph(ctx, w, h, scene3) {
    function project(v) {
      var c = Math.cos(-0.62), s = Math.sin(-0.62);
      var y1 = v.y * c - v.z * s;
      var z1 = v.y * s + v.z * c;
      var c2 = Math.cos(0.7), s2 = Math.sin(0.7);
      var x2 = v.x * c2 + z1 * s2;
      var z2 = -v.x * s2 + z1 * c2;
      var R = Math.min(w, h) * 0.34;
      return { x: w * 0.46 + x2 * R, y: h * 0.5 - y1 * R, z: z2, R: R };
    }
    var R = Math.min(w, h) * 0.34;
    var cx = w * 0.46, cy = h * 0.5;
    var g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R * 1.05);
    g.addColorStop(0, '#f8fafc');
    g.addColorStop(1, '#cbd5e1');
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#64748b';
    ctx.stroke();

    function meridian(samples) {
      var front = [], back = [];
      for (var i = 0; i < samples.length; i++) {
        var p = project(samples[i]);
        (p.z >= 0 ? front : back).push(p);
      }
      return { front: front, back: back };
    }
    function strokePts(pts, style, width) {
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.stroke();
    }
    var rings = [];
    var a, i;
    for (a = 0; a < 6; a++) {
      var pts = [];
      var az = a * Math.PI / 6;
      for (i = 0; i <= 48; i++) {
        var t = (i / 48) * Math.PI * 2;
        pts.push({ x: Math.cos(az) * Math.cos(t), y: Math.sin(az) * Math.cos(t), z: Math.sin(t) });
      }
      rings.push(pts);
    }
    ctx.save();
    ctx.setLineDash([3, 4]);
    rings.forEach(function (pts) {
      var parts = meridian(pts);
      strokePts(parts.back, 'rgba(100,116,139,.45)', 1);
    });
    ctx.restore();

    var origin = project({ x: 0, y: 0, z: 0 });
    scene3.axes.forEach(function (v) {
      var p = project(v);
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = 'rgba(15,23,42,.35)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    var chains = scene3.chains.map(function (ch) {
      var proj = ch.pts.map(project);
      var z = 0;
      proj.forEach(function (p) { z += p.z; });
      return { ch: ch, proj: proj, z: z / proj.length };
    }).sort(function (a, b) { return a.z - b.z; });

    chains.forEach(function (item) {
      ctx.beginPath();
      ctx.moveTo(item.proj[0].x, item.proj[0].y);
      for (var k = 1; k < item.proj.length; k++) ctx.lineTo(item.proj[k].x, item.proj[k].y);
      ctx.strokeStyle = item.z < 0 ? 'rgba(100,116,139,.55)' : item.ch.color;
      ctx.lineWidth = item.z < 0 ? 3 : item.ch.w;
      ctx.lineCap = 'round';
      ctx.setLineDash(item.z < 0 ? [5, 4] : []);
      ctx.stroke();
      ctx.setLineDash([]);
      var mid = item.proj[(item.proj.length / 2) | 0];
      halo(ctx, item.ch.label, mid.x, mid.y - 12, { size: 12, color: item.z < 0 ? '#64748b' : COL.ink });
    });

    scene3.joints.forEach(function (v) {
      var p = project(v);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.z < 0 ? 4 : 6, 0, Math.PI * 2);
      ctx.fillStyle = p.z < 0 ? '#e2e8f0' : '#fff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = COL.ink;
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#b91c1c';
    ctx.fill();
    halo(ctx, '球心', origin.x + 14, origin.y + 12, { size: 12, color: '#b91c1c', align: 'left' });
    halo(ctx, '示意，唔係精密立體模擬', 12, h - 12, { size: 12, align: 'left', color: '#9a3412' });
  }

  function boot(doc, kind) {
    var model = MODELS[kind];
    if (!model) return;
    var canvas = doc.getElementById('view');
    var ctx = canvas.getContext('2d');
    var nameEl = doc.getElementById('name');
    var statusEl = doc.getElementById('status');
    var btnPlay = doc.getElementById('btnPlay');
    var btnSlow = doc.getElementById('btnSlow');
    var btnMode = doc.getElementById('btnMode');
    if (nameEl) nameEl.textContent = model.name;
    canvas.setAttribute('aria-label', model.name + '動畫');
    var mode = model.modes ? model.modes[0].id : null;
    var state = model.create(mode);
    var view = model.pose(state).spherical ? null : computeView(model, mode);
    state = model.create(mode);
    var playing = true;
    var slow = false;
    var viewW = 640, viewH = 300;
    var dwell = 0;
    var held = false;

    function resize() {
      var dpr = Math.min((root.devicePixelRatio || 1), 2);
      viewW = canvas.clientWidth || 640;
      viewH = canvas.clientHeight || 300;
      canvas.width = Math.round(viewW * dpr);
      canvas.height = Math.round(viewH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(resize);
      ro.observe(canvas);
    } else {
      root.addEventListener('resize', resize);
    }

    function syncModeBtn() {
      if (!model.modes) { btnMode.hidden = true; return; }
      btnMode.hidden = false;
      var cur = null;
      for (var i = 0; i < model.modes.length; i++) if (model.modes[i].id === state.mode) cur = model.modes[i];
      btnMode.textContent = cur ? cur.button : '切換';
    }
    syncModeBtn();

    btnPlay.addEventListener('click', function () {
      playing = !playing;
      btnPlay.textContent = playing ? '暫停' : '播放';
    });
    btnSlow.addEventListener('click', function () {
      slow = !slow;
      btnSlow.setAttribute('aria-pressed', slow ? 'true' : 'false');
      btnSlow.textContent = slow ? '慢速中' : '慢速';
    });
    btnMode.addEventListener('click', function () {
      if (!model.modes) return;
      var idx = 0;
      for (var i = 0; i < model.modes.length; i++) if (model.modes[i].id === state.mode) idx = i;
      var next = model.modes[(idx + 1) % model.modes.length].id;
      state = model.create(next);
      if (!model.pose(state).spherical) view = computeView(model, next);
      state = model.create(next);
      dwell = 0;
      held = false;
      syncModeBtn();
    });

    var last = root.performance ? root.performance.now() : 0;
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!isFinite(dt) || dt < 0) dt = 0.016;
      if (playing) {
        if (dwell > 0) dwell -= dt;
        else model.step(state, dt * (slow ? 0.33 : 1));
      }
      var sc = model.pose(state);
      if (sc.dwellRequest && dwell <= 0 && !held) {
        dwell = sc.dwellRequest;
        held = true;
      }
      if (sc.releaseHold) held = false;
      ctx.clearRect(0, 0, viewW, viewH);
      if (sc.spherical) drawSph(ctx, viewW, viewH, sc);
      else {
        drawScene(ctx, makeProj(view, viewW, viewH), sc);
        drawFraction(ctx, viewW, sc.fraction);
      }
      if (statusEl) statusEl.textContent = sc.status || '';
      root.requestAnimationFrame(frame);
    }
    root.requestAnimationFrame(frame);
  }

  var api = {
    boot: boot,
    models: MODELS,
    _solveFour: solveFour,
    _rockerWindow: rockerWindow,
    _envelopeOut: envelopeOut,
    _crossedPhi: crossedPhi,
    _steerAt: steerAt,
    _steerRef: steerRef,
    _togglePose: togglePose,
    _sphVec: sphVec,
    _whitX: whitX,
    _whitMeta: function () { buildWhit(); return WH_META; },
    _buildWhit: buildWhit,
    _G: { CR: G_CR, DC: G_DC, DR: G_DR, WH: WH, STEER: STEER }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Linkages = api;

  function autostart() {
    if (typeof document === 'undefined') return;
    var el = document.querySelector('[data-kind]');
    if (!el) return;
    boot(document, el.getAttribute('data-kind'));
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autostart);
    else autostart();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
