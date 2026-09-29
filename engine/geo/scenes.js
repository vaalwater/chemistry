/* 立体几何场景库：定理可视化实验室 / 空间角三步定位器 / 体积推导剧场。
 * 每个场景 = { layout, build(ctx), setStep(ctx, step, counter), onParam?(ctx, msg) } */
(function () {
  var A = window.GEO;
  if (!A) return;
  var R = A.sceneApi.registry;
  var V = A.V, seg = A.seg, poly = A.polyMesh, label = A.label, tween = A.tween, clamp = A.clamp, lerp = A.lerp;

  var C = {
    line: 0x2f4a6d, hl: 0xff8a3d, aux: 0x1fa97a, bad: 0xe5524a,
    plane: 0x8fb8ef, plane2: 0xf2b27a, face: 0xcfe0f7, ink: '#31425f'
  };

  function g() { return new THREE.Group(); }
  function line(a, b, color, r) { return seg(a, b, r || 0.045, color || C.line, 1); }
  function planeQ(a, b, c, d, color, opacity) {
    var grp = g();
    grp.add(poly([a, b, c, d], null, color, opacity === undefined ? 0.3 : opacity));
    var vs = [a, b, c, d];
    for (var i = 0; i < 4; i++) grp.add(line(vs[i], vs[(i + 1) % 4], color, 0.022));
    return grp;
  }
  function txt(s, p, color, h) {
    var sp = label(s, { color: color || C.ink, size: 40, worldH: h || 0.44 });
    sp.position.copy(p);
    return sp;
  }
  function dot(p, color, r) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(r || 0.09, 16, 12),
      new THREE.MeshStandardMaterial({ color: color || C.line }));
    m.position.copy(p);
    return m;
  }
  function triFace(a, b, c, color, opacity) { return poly([a, b, c], null, color || C.aux, opacity === undefined ? 0.45 : opacity); }
  function setColor(obj, hex) {
    obj.traverse(function (o) {
      if (o.material && o.material.color && o.geometry && o.geometry.type !== 'SphereGeometry') {
        o.material = o.material.clone();
        o.material.color.setHex(hex);
      }
    });
  }
  function show(obj, v) { if (obj) obj.visible = !!v; }
  function moveTo(obj, to, dur) {
    var from = obj.position.clone();
    var f = function (p) { obj.position.lerpVectors(from, to, p); };
    f.tag = 'mv' + (obj.id || '');
    tween(dur || 0.85, f);
  }

  /* ==================== 一、定理可视化实验室 ==================== */

  /* 1) 线面平行判定：a ⊄ α，b ⊂ α，a ∥ b ⇒ a ∥ α */
  R['thm:lpParallel'] = {
    layout: 'full',
    build: function (ctx) {
      var alpha = planeQ(V(-2.9, 0, -1.8), V(2.9, 0, -1.8), V(3.7, 0, 2.4), V(-2.1, 0, 2.4), C.plane, 0.26);
      var b1 = V(-1.7, 0.02, 0.1), b2 = V(1.9, 0.02, 1.8);
      var bGrp = g();
      bGrp.add(line(b1, b2, C.line, 0.055));
      bGrp.add(txt('b', V(2.15, 0.05, 2.05)));
      var aGrp = g();
      var aBase = counterY(ctx);
      aGrp.add(line(V(-1.7, aBase, 0.1), V(1.9, aBase, 1.8), C.line, 0.055));
      aGrp.add(txt('a', V(2.2, aBase + 0.2, 2.05)));
      var par = txt('a ∥ b', V(0.1, aBase + 0.95, 1.3), '#ff8a3d', 0.4);
      var concl = txt('a ∥ α', V(0, aBase + 1.55, -1.6), '#1fa97a', 0.52);
      var paraTag = txt('a ⊂ α（前提不成立）', V(0, 0.75, -1.9), '#e5524a', 0.42);
      var path = g();
      for (var i = 0; i < 5; i++) {
        var t0 = i / 5, t1 = (i + 0.55) / 5;
        path.add(line(
          V(-1.7, lerp(aBase, 0.05, t0), 0.1), V(-1.7, lerp(aBase, 0.05, t1), 0.1), C.hl, 0.02));
      }
      [alpha, bGrp, aGrp, par, concl, paraTag, path, txt('α', V(-3.15, 0.06, 2.6), '#5b6b85', 0.42)]
        .forEach(function (o) { ctx.add(o); });
      ctx.o = { alpha: alpha, a: aGrp, b: bGrp, par: par, con: concl, bad: paraTag, path: path, aBase: aBase };
    },
    setStep: function (ctx, step) {
      var o = ctx.o;
      show(o.par, false); show(o.con, false); show(o.bad, false); show(o.path, false);
      setColor(o.b, C.line);
      var rest = ctx.counter ? V(0, -o.aBase + 0.06, 0.9) : V(0, 0, 0);
      o.a.position.copy(rest);
      if (ctx.counter) {
        show(o.bad, step >= 2);
        if (step >= 3) setColor(o.b, C.hl);
        if (step >= 4) { show(o.par, true); show(o.con, false); }
        return;
      }
      if (step >= 2) { setColor(o.b, C.hl); show(o.par, true); }
      if (step >= 3) { show(o.path, true); moveTo(o.a, V(0, -o.aBase + 0.05, 0), 1.0); }
      if (step >= 4) { show(o.con, true); setColor(o.b, C.aux); }
    }
  };
  function counterY(ctx) { return ctx.counter ? 1.95 : 1.95; }

  /* 2) 线面平行性质：a ∥ α，a ⊂ β，α ∩ β = l ⇒ a ∥ l */
  R['thm:lpParallelProp'] = {
    layout: 'full',
    build: function (ctx) {
      var alpha = planeQ(V(-3.1, 0, -2), V(3.1, 0, -2), V(3.9, 0, 2.4), V(-2.3, 0, 2.4), C.plane, 0.24);
      var l1 = V(-2.5, 0, 0.6), l2 = V(3.2, 0, 0.6);
      var lGrp = g();
      lGrp.add(line(l1, l2, C.hl, 0.055));
      lGrp.add(txt('l', V(3.5, 0.05, 0.85)));
      // β：过 a 与 l 的平面（counter 时抬起来变成与 α 平行 → 没有交线）
      var betaPts = ctx.counter
        ? [V(-2.5, 1.5, -1.6), V(3.2, 1.5, -1.6), V(3.9, 1.5, 2.6), V(-2.3, 1.5, 2.6)]
        : [V(-2.5, -0.6, -1.5), V(3.2, -0.6, -1.5), V(3.9, 2.4, 1.4), V(-2.3, 2.4, 1.4)];
      var beta = planeQ(betaPts[0], betaPts[1], betaPts[2], betaPts[3], C.plane2, 0.22);
      var a1 = V(-1.8, ctx.counter ? 1.52 : 0.9, -0.55), a2 = V(2.6, ctx.counter ? 1.52 : 0.9, -0.55);
      var aGrp = g();
      aGrp.add(line(a1, a2, C.line, 0.055));
      aGrp.add(txt('a', V(2.85, ctx.counter ? 1.7 : 1.05, -0.3)));
      var par = txt('a ∥ l', V(0.2, ctx.counter ? 2.1 : 1.5, 0.4), '#ff8a3d', 0.42);
      var con = txt('a ∥ l', V(0, ctx.counter ? 2.5 : 1.95, -1.7), '#1fa97a', 0.5);
      var bad = txt('β ∥ α，没有交线', V(0, 2.5, -1.7), '#e5524a', 0.44);
      [alpha, beta, lGrp, aGrp, par, con, bad,
        txt('α', V(-3.3, 0.06, 2.7), '#5b6b85', 0.42),
        txt('β', V(-2.9, ctx.counter ? 1.6 : 2.5, 2.9), '#c9822f', 0.42)
      ].forEach(function (o) { ctx.add(o); });
      ctx.o = { l: lGrp, a: aGrp, beta: beta, par: par, con: con, bad: bad };
    },
    setStep: function (ctx, step) {
      var o = ctx.o;
      show(o.par, false); show(o.con, false); show(o.bad, false);
      show(o.l, !ctx.counter);
      setColor(o.a, C.line);
      if (ctx.counter) {
        if (step >= 3) show(o.bad, true);
        return;
      }
      if (step >= 2) setColor(o.l, C.hl);
      if (step >= 3) { setColor(o.a, C.hl); show(o.par, true); }
      if (step >= 4) { show(o.con, true); setColor(o.a, C.aux); }
    }
  };

  /* 3) 线面垂直判定：l ⊥ m，l ⊥ n，m、n 是 α 内两条相交直线 ⇒ l ⊥ α */
  R['thm:linePlanePerp'] = {
    layout: 'full',
    build: function (ctx) {
      var O = V(0, 0, 0);
      var alpha = planeQ(V(-2.8, 0, -1.9), V(2.8, 0, -1.9), V(3.6, 0, 2.3), V(-2, 0, 2.3), C.plane, 0.24);
      var lTop = V(0.15, 2.7, 0.1);
      var l = g();
      l.add(line(V(0, -0.05, 0), lTop, C.line, 0.055));
      l.add(txt('l', V(0.35, 2.95, 0.25)));
      var mGrp = g();
      mGrp.add(line(V(-2.3, 0.03, -0.7), V(2.3, 0.03, 0.7), C.line, 0.05));
      mGrp.add(txt('m', V(2.55, 0.05, 0.9)));
      // n：正常情况与 m 相交于 O；反例时被平移成与 m 平行
      var nOff = ctx.counter ? 1.5 : 0;
      var nGrp = g();
      nGrp.add(line(V(-0.9 + nOff, 0.03, -2.1 + nOff), V(0.9 + nOff, 0.03, 2.1 + nOff), C.line, 0.05));
      nGrp.add(txt('n', V(1.15 + nOff, 0.05, 2.35 + nOff)));
      var ra1 = A.rightAngle(V(0, 1.2, 0), V(0, 0, 0), V(1.9, 0, 0.58), '#e5524a', 0.45);
      var ra2 = A.rightAngle(V(0, 1.2, 0), V(0, 0, 0), V(0.75, 0, 1.75), '#e5524a', 0.45);
      var con = txt('l ⊥ α', V(0, 3.3, -1.4), '#1fa97a', 0.5);
      var bad = txt('m ∥ n（不相交），结论不成立', V(0, 3.3, -1.4), '#e5524a', 0.42);
      var inter = txt('m ∩ n = O', V(-2.2, 0.9, -1.6), '#ff8a3d', 0.4);
      [alpha, l, mGrp, nGrp, ra1, ra2, con, bad, inter, txt('α', V(-3.05, 0.06, 2.6), '#5b6b85', 0.42)]
        .forEach(function (o) { ctx.add(o); });
      ctx.o = { m: mGrp, n: nGrp, ra1: ra1, ra2: ra2, con: con, bad: bad, inter: inter, l: l };
    },
    setStep: function (ctx, step) {
      var o = ctx.o;
      show(o.ra1, false); show(o.ra2, false); show(o.con, false); show(o.bad, false); show(o.inter, false);
      setColor(o.m, C.line); setColor(o.n, C.line);
      if (step >= 2) { setColor(o.m, C.hl); show(o.ra1, true); }
      if (step >= 3) { setColor(o.n, C.hl); show(o.ra2, !ctx.counter); }
      if (step >= 4) {
        if (ctx.counter) show(o.bad, true);
        else { show(o.inter, true); show(o.con, true); setColor(o.m, C.aux); setColor(o.n, C.aux); }
      }
    }
  };

  /* 4) 面面平行判定：β 内两条相交直线都平行于 α ⇒ β ∥ α */
  R['thm:ppParallel'] = {
    layout: 'full',
    build: function (ctx) {
      var alpha = planeQ(V(-3.1, 0, -2), V(3.1, 0, -2), V(3.9, 0, 2.4), V(-2.3, 0, 2.4), C.plane, 0.22);
      var beta = planeQ(V(-2.9, 2.2, -1.7), V(2.9, 2.2, -1.7), V(3.7, 2.2, 2.4), V(-2.1, 2.2, 2.4), C.plane2, 0.2);
      var m1 = V(-2.2, 2.22, -0.4), m2 = V(2.2, 2.22, 0.5);
      var mGrp = g(); mGrp.add(line(m1, m2, C.line, 0.05)); mGrp.add(txt('m', V(2.45, 2.25, 0.72)));
      var nOff = ctx.counter ? 1.35 : 0;
      var nGrp = g();
      nGrp.add(line(V(-0.8 + nOff, 2.22, -1.9), V(0.8 + nOff, 2.22, 1.9), C.line, 0.05));
      nGrp.add(txt('n', V(1.05 + nOff, 2.25, 2.15)));
      var m1p = V(-2.2, 0.02, -0.4), m2p = V(2.2, 0.02, 0.5);
      var mpGrp = g(); mpGrp.add(line(m1p, m2p, C.hl, 0.045)); mpGrp.add(txt("m'", V(2.45, 0.05, 0.72), '#ff8a3d', 0.4));
      var npGrp = g();
      npGrp.add(line(V(-0.8, 0.02, -1.9), V(0.8, 0.02, 1.9), C.hl, 0.045));
      npGrp.add(txt("n'", V(1.05, 0.05, 2.15), '#ff8a3d', 0.4));
      var con = txt('β ∥ α', V(0, 3.4, -1.5), '#1fa97a', 0.5);
      var bad = txt('m ∥ n（不相交），结论不成立', V(0, 3.4, -1.5), '#e5524a', 0.42);
      [alpha, beta, mGrp, nGrp, mpGrp, npGrp, con, bad,
        txt('α', V(-3.35, 0.06, 2.7), '#5b6b85', 0.4),
        txt('β', V(-3.15, 2.3, 2.7), '#c9822f', 0.4)
      ].forEach(function (o) { ctx.add(o); });
      ctx.o = { m: mGrp, n: nGrp, mp: mpGrp, np: npGrp, con: con, bad: bad };
    },
    setStep: function (ctx, step) {
      var o = ctx.o;
      show(o.mp, false); show(o.np, false); show(o.con, false); show(o.bad, false);
      setColor(o.m, C.line); setColor(o.n, C.line);
      if (step >= 2) { setColor(o.m, C.hl); show(o.mp, true); }
      if (step >= 3) { setColor(o.n, C.hl); show(o.np, !ctx.counter); }
      if (step >= 4) {
        if (ctx.counter) show(o.bad, true);
        else { show(o.con, true); setColor(o.m, C.aux); setColor(o.n, C.aux); }
      }
    }
  };

  /* 5) 面面垂直判定：一个平面经过另一个平面的一条垂线 ⇒ 两平面垂直 */
  R['thm:ppPerp'] = {
    layout: 'full',
    build: function (ctx) {
      var alpha = planeQ(V(-3.1, 0, -2), V(3.1, 0, -2), V(3.9, 0, 2.4), V(-2.3, 0, 2.4), C.plane, 0.22);
      var topY = 2.9;
      var lean = ctx.counter ? 1.5 : 0; // 反例：这条线不是 α 的垂线
      var l = g();
      l.add(line(V(0, 0, 0), V(lean, topY, 0.1), C.line, 0.055));
      l.add(txt('l', V(lean + 0.3, topY + 0.25, 0.3)));
      var betaPts = [
        V(-2.6 + lean, topY, -1.6), V(2.6 + lean, topY, -1.6),
        V(2.2 + lean * 0.2, 0.02, 1.9), V(-2.2 + lean * 0.2, 0.02, 1.9)
      ];
      var beta = planeQ(betaPts[0], betaPts[1], betaPts[2], betaPts[3], C.plane2, 0.22);
      var ra = A.rightAngle(V(0, 1.4, 0), V(0, 0, 0), V(1.9, 0, 0.6), '#e5524a', 0.45);
      var con = txt('β ⊥ α', V(0, topY + 0.9, -1.6), '#1fa97a', 0.5);
      var bad = txt('l 不垂直 α，结论不成立', V(0, topY + 0.9, -1.6), '#e5524a', 0.42);
      var dih = g();
      dih.add(line(V(0, 0.9, 0.35), V(0, 0.9, 1.15), C.hl, 0.02));
      dih.add(line(V(0, 0.9, 1.15), V(0.55, 0.35, 1.15), C.hl, 0.02));
      [alpha, beta, l, ra, con, bad, dih,
        txt('α', V(-3.35, 0.06, 2.7), '#5b6b85', 0.4),
        txt('β', V(2.9, topY + 0.2, 1.9), '#c9822f', 0.4)
      ].forEach(function (o) { ctx.add(o); });
      ctx.o = { l: l, ra: ra, con: con, bad: bad, dih: dih, beta: beta };
    },
    setStep: function (ctx, step) {
      var o = ctx.o;
      show(o.ra, false); show(o.con, false); show(o.bad, false); show(o.dih, false);
      setColor(o.l, C.line);
      if (step >= 2) { show(o.ra, !ctx.counter); setColor(o.l, C.hl); }
      if (step >= 3) setColor(o.beta, C.plane2);
      if (step >= 4) {
        if (ctx.counter) show(o.bad, true);
        else { show(o.dih, true); show(o.con, true); setColor(o.l, C.aux); }
      }
    }
  };

  /* ==================== 二、空间角三步定位器 ==================== */

  function cubeFrame(s) {
    var grp = g();
    var p = {
      A: V(0, 0, 0), B: V(s, 0, 0), C: V(s, 0, s), D: V(0, 0, s),
      A1: V(0, s, 0), B1: V(s, s, 0), C1: V(s, s, s), D1: V(0, s, s)
    };
    var E = [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A'],
      ['A1', 'B1'], ['B1', 'C1'], ['C1', 'D1'], ['D1', 'A1'],
      ['A', 'A1'], ['B', 'B1'], ['C', 'C1'], ['D', 'D1']];
    E.forEach(function (e) {
      grp.add(line(p[e[0]], p[e[1]], 0x63788f, 0.035));
    });
    var names = ['A', 'B', 'C', 'D', 'A1', 'B1', 'C1', 'D1'];
    names.forEach(function (n) {
      var lbl = n.length > 1 ? n[0] + "'" : n;
      grp.add(txt(lbl, p[n].clone().add(V(0, 0.28, 0)), '#42586f', 0.4));
    });
    return { group: grp, p: p };
  }

  /* 异面直线角：正方体中 4 道（平移其中一条，找出所求角） */
  var SKEW = {
    s1: { a: ['A', 'B'], b: ['C', 'C1'], aux: [['B', 'B1']], ang: ['A', 'B', 'B1'], note: '∠ABB₁' },
    s2: { a: ['A', 'B1'], b: ['B', 'C1'], aux: [['A', 'D1']], ang: ['B1', 'A', 'D1'], note: '∠B₁AD₁' },
    s3: { a: ['A', 'C'], b: ['B', 'C1'], aux: [['A', 'D1']], ang: ['C', 'A', 'D1'], note: '∠CAD₁' },
    s4: { a: ['A', 'B'], b: ['B1', 'D1'], aux: [['B', 'D']], ang: ['A', 'B', 'D'], note: '∠ABD' }
  };

  R['ang:skew'] = {
    layout: 'full',
    build: function (ctx) {
      var s = 2;
      var cube = cubeFrame(s);
      var k = SKEW[ctx.msg.variant] || SKEW.s1;
      var p = cube.p;
      var gA = g(), gB = g();
      gA.add(line(p[k.a[0]], p[k.a[1]], C.hl, 0.06));
      gB.add(line(p[k.b[0]], p[k.b[1]], 0x2f6fed, 0.06));
      var auxGrp = g();
      k.aux.forEach(function (e) {
        auxGrp.add(line(p[e[0]], p[e[1]], C.aux, 0.05));
      });
      var arc = A.angleArc(p[k.ang[0]], p[k.ang[1]], p[k.ang[2]], '#e5524a', k.note);
      var panel = g(); // “算”：把关键三角形拎出来
      [cube.group, gA, gB, auxGrp, arc, panel].forEach(function (o) { ctx.add(o); });
      ctx.o = { cube: cube, a: gA, b: gB, aux: auxGrp, arc: arc, panel: panel, k: k, s: s };
    },
    setStep: function (ctx, step) {
      var o = ctx.o, p = o.cube.p, k = o.k;
      show(o.aux, false); show(o.arc, false); show(o.panel, false);
      if (step >= 2) show(o.aux, true);
      if (step >= 3) show(o.arc, true);
      if (step >= 4) {
        // 关键三角形单独拎到旁边，标出边长（2 / 2√2 …）
        if (!o.panel.children.length) {
          var off = V(o.s * 2.5, 0.4, 0);
          var tri = [p[k.ang[0]], p[k.ang[1]], p[k.ang[2]]];
          var q = tri.map(function (v) { return v.clone().add(off); });
          o.panel.add(triFace(q[0], q[1], q[2], 0xff8a3d, 0.35));
          for (var i = 0; i < 3; i++) {
            var a1 = q[i], b1 = q[(i + 1) % 3];
            o.panel.add(line(a1, b1, 0xe2822f, 0.035));
            var mid = a1.clone().add(b1).multiplyScalar(0.5);
            var len = Math.round(a1.distanceTo(b1) * 100) / 100;
            var s = a1.distanceTo(b1) > o.s * 1.4 ? (o.s + '√2') : String(o.s);
            o.panel.add(txt(s, mid.clone().add(V(0.32, 0.1, 0)), '#c9822f', 0.36));
            void len;
          }
          var c = q[0].clone().add(q[1]).add(q[2]).multiplyScalar(1 / 3);
          o.panel.add(txt('所求角', c.clone().add(V(0, -0.55, 0)), '#e5524a', 0.4));
        }
        show(o.panel, true);
      }
    }
  };

  /* 线面角：PO ⊥ α，AO 是 PA 在 α 内的射影 ⇒ ∠PAO 即线面角 */
  var LP_TABLE = { lp1: { h: 2, r: 2 }, lp2: { h: Math.sqrt(3), r: 3 }, lp3: { h: 3, r: Math.sqrt(3) } };
  R['ang:linePlane'] = {
    layout: 'full',
    build: function (ctx) {
      var c = LP_TABLE[ctx.msg.variant] || LP_TABLE.lp1;
      var alpha = planeQ(V(-3.2, 0, -2.1), V(3.2, 0, -2.1), V(4, 0, 2.5), V(-2.4, 0, 2.5), C.plane, 0.24);
      var O = V(0, 0, 0), P = V(0, c.h, 0), Apt = V(c.r, 0, 0);
      var po = g(); po.add(line(P, O, C.line, 0.055));
      var pa = g(); pa.add(line(P, Apt, C.hl, 0.055));
      var ao = g(); ao.add(line(Apt, O, C.aux, 0.05));
      var ra = A.rightAngle(P, O, Apt, '#e5524a', 0.45);
      var arc = A.angleArc(P, Apt, O, '#e5524a', 'θ');
      var panel = g();
      [alpha, po, pa, ao, ra, arc, panel,
        txt('P', P.clone().add(V(0, 0.35, 0)), '#31425f', 0.42),
        txt('A', Apt.clone().add(V(0.4, 0.05, 0)), '#31425f', 0.42),
        txt('O', O.clone().add(V(-0.35, 0.05, 0)), '#31425f', 0.42),
        txt('α', V(-3.45, 0.06, 2.8), '#5b6b85', 0.4)
      ].forEach(function (o) { ctx.add(o); });
      ctx.o = { po: po, pa: pa, ao: ao, ra: ra, arc: arc, panel: panel, P: P, A: Apt, O: O, c: c };
    },
    setStep: function (ctx, step) {
      var o = ctx.o;
      show(o.ao, false); show(o.ra, false); show(o.arc, false); show(o.panel, false);
      if (step >= 2) { show(o.ao, true); }
      if (step >= 3) { show(o.ra, true); show(o.arc, true); }
      if (step >= 4) {
        if (!o.panel.children.length) {
          var off = V(2.6, 0.6, 0);
          var q = [o.P, o.A, o.O].map(function (v) { return v.clone().add(off); });
          o.panel.add(triFace(q[0], q[1], q[2], 0xff8a3d, 0.35));
          for (var i = 0; i < 3; i++) {
            var a1 = q[i], b1 = q[(i + 1) % 3];
            o.panel.add(line(a1, b1, 0xe2822f, 0.035));
            var d = a1.distanceTo(b1);
            var s = Math.abs(d - o.c.h) < 0.05 ? fmt(o.c.h) : (Math.abs(d - o.c.r) < 0.05 ? fmt(o.c.r) : fmt(d));
            o.panel.add(txt(s, a1.clone().add(b1).multiplyScalar(0.5).add(V(0.35, 0.1, 0)), '#c9822f', 0.36));
          }
          o.panel.add(txt('Rt△PAO', q[1].clone().add(V(0.2, -0.6, 0)), '#e5524a', 0.4));
        }
        show(o.panel, true);
      }
    }
  };
  function fmt(v) {
    var r = Math.round(v * 100) / 100;
    if (Math.abs(r - Math.sqrt(3)) < 0.02) return '√3';
    if (Math.abs(r - 2 * Math.sqrt(2)) < 0.02) return '2√2';
    return String(r);
  }

  /* 二面角：正四棱锥 P-ABCD，侧面与底面的二面角平面角 = ∠PMO */
  var DH_TABLE = { d1: { h: 1 }, d2: { h: Math.sqrt(3) }, d3: { h: 1 / Math.sqrt(3) } };
  R['ang:dihedral'] = {
    layout: 'full',
    build: function (ctx) {
      var s = 2.2, h = (DH_TABLE[ctx.msg.variant] || DH_TABLE.d1).h;
      var A0 = V(-s / 2, 0, -s / 2), B0 = V(s / 2, 0, -s / 2), C0 = V(s / 2, 0, s / 2), D0 = V(-s / 2, 0, s / 2);
      var P = V(0, h, 0), M = V(0, 0, -s / 2), O = V(0, 0, 0);
      var base = planeQ(A0, B0, C0, D0, C.plane, 0.24);
      var sideF = triFace(P, A0, B0, 0xf2b27a, 0.32);
      var edges = g();
      [[P, A0], [P, B0], [P, C0], [P, D0], [A0, B0], [B0, C0], [C0, D0], [D0, A0]]
        .forEach(function (e) { edges.add(line(e[0], e[1], 0x63788f, 0.035)); });
      var aux = g();
      aux.add(line(P, M, C.aux, 0.05));
      aux.add(line(O, M, C.aux, 0.05));
      var ra1 = A.rightAngle(P, M, O, '#e5524a', 0.4);
      var ra2 = A.rightAngle(O, M, C0, '#e5524a', 0.4);
      var arc = A.angleArc(P, M, O, '#e5524a', 'θ');
      var panel = g();
      [base, sideF, edges, aux, ra1, ra2, arc, panel,
        txt('P', P.clone().add(V(0, 0.35, 0)), '#31425f', 0.42),
        txt('M', M.clone().add(V(0, 0.05, -0.45)), '#1fa97a', 0.4),
        txt('O', O.clone().add(V(-0.35, 0.05, 0)), '#1fa97a', 0.4),
        txt('A', A0.clone().add(V(-0.15, 0.05, -0.35)), '#42586f', 0.38),
        txt('B', B0.clone().add(V(0.15, 0.05, -0.35)), '#42586f', 0.38)
      ].forEach(function (o) { ctx.add(o); });
      ctx.o = { aux: aux, ra1: ra1, ra2: ra2, arc: arc, panel: panel, P: P, M: M, O: O, h: h, s: s };
    },
    setStep: function (ctx, step) {
      var o = ctx.o;
      show(o.aux, false); show(o.ra1, false); show(o.ra2, false); show(o.arc, false); show(o.panel, false);
      if (step >= 2) show(o.aux, true);
      if (step >= 3) { show(o.ra1, true); show(o.ra2, true); show(o.arc, true); }
      if (step >= 4) {
        if (!o.panel.children.length) {
          var off = V(o.s * 1.35, 0.5, 0);
          var q = [o.P, o.M, o.O].map(function (v) { return v.clone().add(off); });
          o.panel.add(triFace(q[0], q[1], q[2], 0xff8a3d, 0.35));
          for (var i = 0; i < 3; i++) {
            var a1 = q[i], b1 = q[(i + 1) % 3];
            o.panel.add(line(a1, b1, 0xe2822f, 0.035));
            var d = a1.distanceTo(b1);
            var s = Math.abs(d - o.h) < 0.06 ? fmt(o.h) : (Math.abs(d - o.s / 2) < 0.06 ? fmt(o.s / 2) : fmt(d));
            o.panel.add(txt(s, a1.clone().add(b1).multiplyScalar(0.5).add(V(0.35, 0.1, 0)), '#c9822f', 0.36));
          }
          o.panel.add(txt('Rt△PMO', q[1].clone().add(V(0.2, -0.6, 0)), '#e5524a', 0.4));
        }
        show(o.panel, true);
      }
    }
  };

  /* ==================== 三、体积推导剧场 ==================== */

  /* 1) 三棱柱切成三个等体积的锥 ⇒ 锥 = ⅓ 柱 */
  R['vol:pyramid'] = {
    layout: 'full',
    build: function (ctx) {
      var s = 1.9, h = 2.6;
      var A0 = V(-s / 2, 0, -s / 2), B0 = V(s / 2, 0, -s / 2), C0 = V(0, 0, s * 0.72);
      var up = V(0, h, 0);
      var A1 = A0.clone().add(up), B1 = B0.clone().add(up), C1 = C0.clone().add(up);
      function cone3(apex, p1, p2, p3, color) {
        var grp = g();
        [[apex, p1, p2], [apex, p2, p3], [apex, p3, p1], [p1, p2, p3]].forEach(function (t) {
          grp.add(poly([t[0], t[1], t[2]], null, color, 0.72));
        });
        [[apex, p1], [apex, p2], [apex, p3], [p1, p2], [p2, p3], [p3, p1]].forEach(function (e) {
          grp.add(line(e[0], e[1], 0x4d6480, 0.028));
        });
        return grp;
      }
      // 三个等体积的锥：A1-ABC、A1-BCC1、A1-B1C1C
      var t1 = cone3(A1, A0, B0, C0, 0xcfe0f7);
      var t2 = cone3(A1, B0, C0, C1, 0xf2cfa8);
      var t3 = cone3(A1, B1, C1, C0, 0xd6efdc);
      var tags = [
        txt('①', A0.clone().add(V(-0.5, 0.2, -0.4)), '#31425f', 0.4),
        txt('②', B0.clone().add(V(0.5, 0.2, 0.1)), '#31425f', 0.4),
        txt('③', C1.clone().add(V(0.5, 0.3, 0.3)), '#31425f', 0.4)
      ];
      [t1, t2, t3].concat(tags).forEach(function (o) { ctx.add(o); });
      ctx.o = { t1: t1, t2: t2, t3: t3, tags: tags };
    },
    setStep: function (ctx, step) {
      var o = ctx.o;
      var targets = [V(-1.9, -0.35, -1.5), V(2.3, -0.35, -0.6), V(0.3, 1.9, 1.7)];
      var parts = [o.t1, o.t2, o.t3];
      o.tags.forEach(function (t) { show(t, step >= 2); });
      var t = step >= 3 ? 1 : 0;
      parts.forEach(function (p, i) {
        moveTo(p, targets[i].clone().multiplyScalar(t), 0.95);
      });
    }
  };

  /* 2) 圆锥 = ⅓ 圆柱：倒三次水装满圆柱 */
  R['vol:cone'] = {
    layout: 'full',
    build: function (ctx) {
      var r = 1.35, h = 2.6;
      var cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, h, 40, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xcfe0f7, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
      );
      cyl.position.y = h / 2;
      var cone = new THREE.Mesh(
        new THREE.ConeGeometry(r, h, 40),
        new THREE.MeshStandardMaterial({ color: 0xf2cfa8, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
      );
      cone.position.y = h / 2;
      var water = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.97, r * 0.97, 1, 32),
        new THREE.MeshStandardMaterial({ color: 0x2fa7e8, transparent: true, opacity: 0.55 })
      );
      water.position.y = 0;
      water.scale.y = 0.001;
      var ring = g();
      [
        [V(-r, 0, 0), V(-r, h, 0)], [V(r, 0, 0), V(r, h, 0)],
        [V(0, 0, -r), V(0, h, -r)], [V(0, 0, r), V(0, h, r)]
      ].forEach(function (e) { ring.add(line(e[0], e[1], 0x4d6480, 0.025)); });
      var tag = txt('', V(0, h + 0.5, 0), '#1fa97a', 0.44);
      [cyl, cone, water, ring, tag, txt('圆柱', V(-r - 0.5, h + 0.35, 0), '#5b6b85', 0.4),
        txt('圆锥', V(r + 0.55, h * 0.55, 0), '#c9822f', 0.4)
      ].forEach(function (o) { ctx.add(o); });
      ctx.o = { cyl: cyl, cone: cone, water: water, tag: tag, h: h };
    },
    setStep: function (ctx, step) {
      var o = ctx.o;
      var t = step >= 3 ? 1 : 0;
      var from = o.water.scale.y;
      var f = function (p) {
        var v = lerp(from, t * o.h, p);
        o.water.scale.y = Math.max(0.001, v);
        o.water.position.y = Math.max(0.001, v) / 2;
      };
      f.tag = 'water';
      tween(1.0, f);
    },
    onParam: function (ctx, msg) {
      var o = ctx.o;
      if (!o || msg.t === undefined) return;
      var v = clamp(msg.t, 0, 1) * o.h;
      o.water.scale.y = Math.max(0.001, v);
      o.water.position.y = Math.max(0.001, v) / 2;
    }
  };

  /* 3) 祖暅原理：半球 与 「圆柱挖去圆锥」 在任一高度截面面积相等 ⇒ 体积相等 */
  R['vol:sphere'] = {
    layout: 'full',
    build: function (ctx) {
      var R = 1.5;
      var hemi = new THREE.Mesh(
        new THREE.SphereGeometry(R, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xcfe0f7, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
      );
      hemi.position.x = -R * 1.6;
      var cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(R, R, R, 40, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xf2e3c8, transparent: true, opacity: 0.2, side: THREE.DoubleSide })
      );
      cyl.position.set(R * 1.6, R / 2, 0);
      var cone = new THREE.Mesh(
        new THREE.ConeGeometry(R, R, 40, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xf2cfa8, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
      );
      cone.position.set(R * 1.6, R / 2, 0);
      cone.rotation.x = Math.PI; // 倒扣的圆锥：从圆柱顶部挖下去
      var sec1 = new THREE.Mesh(new THREE.RingGeometry(0.001, R, 40),
        new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
      sec1.rotation.x = -Math.PI / 2;
      var sec2 = new THREE.Mesh(new THREE.RingGeometry(R * 0.5, R, 40),
        new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
      sec2.rotation.x = -Math.PI / 2;
      var tag = txt('S₁ = S₂', V(0, R + 0.75, 0), '#e5524a', 0.44);
      [hemi, cyl, cone, sec1, sec2, tag,
        txt('半球', V(-R * 1.6, -0.55, 0), '#5b6b85', 0.42),
        txt('圆柱−圆锥', V(R * 1.6, -0.55, 0), '#c9822f', 0.42)
      ].forEach(function (o) { ctx.add(o); });
      ctx.o = { hemi: hemi, cyl: cyl, cone: cone, sec1: sec1, sec2: sec2, tag: tag, R: R };
    },
    setStep: function (ctx, step) {
      var o = ctx.o;
      show(o.sec1, step >= 2); show(o.sec2, step >= 2); show(o.tag, step >= 3);
    },
    onParam: function (ctx, msg) {
      var o = ctx.o;
      if (!o || msg.t === undefined) return;
      var R = o.R;
      var h = clamp(msg.t, 0, 1) * R;
      var r = Math.sqrt(Math.max(0.0001, R * R - h * h));
      o.sec1.geometry.dispose();
      o.sec1.geometry = new THREE.RingGeometry(0.001, r, 40);
      o.sec1.position.set(-R * 1.6, h, 0);
      o.sec2.geometry.dispose();
      o.sec2.geometry = new THREE.RingGeometry(Math.max(0.002, h), R, 40);
      o.sec2.position.set(R * 1.6, h, 0);
    }
  };
})();
