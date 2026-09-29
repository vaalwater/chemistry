/* =========================================================================
 * 场库：8 个电磁学场的物理模型
 * -------------------------------------------------------------------------
 * 每个场的接口：
 *   field(p, opt, out)   → out（THREE.Vector3）该点场强（无量纲可视化单位）
 *   potential(p, opt)    → 标量（电场=电势 V；磁场=等 |B| 参考量 / 磁标势）
 *   seeds(opt)           → 场线起点 [{p:Vector3, dir:1|-1}]
 *   stop(p)              → 贴近源时停止追踪
 *   build(root, A, opt)  → 画源实体（电荷球 / 导线 / 线圈 / 磁铁）
 *   gpu                  → 等势面（raymarch）或等值切片（slice heatmap）配置
 *   opt.mode             → 'a' 只有 A 源 | 'b' 只有 B 源 | 'sum' 叠加
 * ========================================================================= */
(function () {
  'use strict';
  var A = window.PHYS;
  var U = A.util;
  var V = U.V;
  var REG = A.fieldApi.registry;

  /* ------------------------------------------------------------ 通用工具 */
  /** 球面均匀分布（Fibonacci） */
  function fibDir(i, n) {
    var y = 1 - (2 * i + 1) / n;
    var r = Math.sqrt(Math.max(0, 1 - y * y));
    var th = Math.PI * (1 + Math.sqrt(5)) * i;
    return V(Math.cos(th) * r, y, Math.sin(th) * r);
  }
  /** 圆盘内均匀分布（向日葵） */
  function discPt(i, n, R) {
    var r = R * Math.sqrt((i + 0.5) / n);
    var th = Math.PI * (1 + Math.sqrt(5)) * i;
    return { x: r * Math.cos(th), z: r * Math.sin(th) };
  }

  /** 点电荷系（库仑场）：E = Σ qᵢ (p-pᵢ)/|p-pᵢ|³ */
  function pointField(srcs) {
    return function (p, opt, out) {
      var mode = (opt && opt.mode) || 'sum';
      var x = 0, y = 0, z = 0;
      for (var i = 0; i < srcs.length; i++) {
        var s = srcs[i];
        if (mode === 'a' && i !== 0) continue;
        if (mode === 'b' && i !== 1) continue;
        var dx = p.x - s.p[0], dy = p.y - s.p[1], dz = p.z - s.p[2];
        var r2 = dx * dx + dy * dy + dz * dz + 0.03;
        var r = Math.sqrt(r2);
        var k = s.q / (r2 * r);
        x += dx * k; y += dy * k; z += dz * k;
      }
      return out.set(x, y, z);
    };
  }
  /** 点电荷系电势：V = Σ qᵢ / rᵢ */
  function pointPot(srcs) {
    return function (p, opt) {
      var mode = (opt && opt.mode) || 'sum';
      var s = 0;
      for (var i = 0; i < srcs.length; i++) {
        if (mode === 'a' && i !== 0) continue;
        if (mode === 'b' && i !== 1) continue;
        var dx = p.x - srcs[i].p[0], dy = p.y - srcs[i].p[1], dz = p.z - srcs[i].p[2];
        s += srcs[i].q / Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 0.12);
      }
      return s;
    };
  }
  /** 贴源停止 */
  function nearStop(srcs, r) {
    return function (p) {
      for (var i = 0; i < srcs.length; i++) {
        var dx = p.x - srcs[i].p[0], dy = p.y - srcs[i].p[1], dz = p.z - srcs[i].p[2];
        if (dx * dx + dy * dy + dz * dz < r * r) return true;
      }
      return false;
    };
  }

  /* ------------------------------------------------------- 实体绘制助手 */
  function ball(pos, sign, r, text) {
    var g = new THREE.Group();
    var col = sign > 0 ? 0xff6a5a : 0x4aa8ff;
    var m = new THREE.Mesh(
      new THREE.SphereGeometry(r, 26, 20),
      new THREE.MeshStandardMaterial({
        color: col, emissive: col, emissiveIntensity: 0.55, roughness: 0.28, metalness: 0.2,
      })
    );
    g.add(m);
    g.add(U.glow(col, r * 7, 0.5));
    var lb = U.label(text, { color: sign > 0 ? '#ffd9d2' : '#d6ecff', worldH: 0.38 });
    lb.position.set(0, r + 0.44, 0);
    g.add(lb);
    g.position.set(pos[0], pos[1], pos[2]);
    return g;
  }

  /** 螺旋线（线圈 / 螺线管）路径点 */
  function helixPts(axis, len, R, turns, segPerTurn, phase) {
    var pts = [], n = turns * segPerTurn;
    for (var i = 0; i <= n; i++) {
      var t = i / segPerTurn * Math.PI * 2 + (phase || 0);
      var u = (i / n - 0.5) * len;
      if (axis === 'y') pts.push(V(R * Math.cos(t), u, R * Math.sin(t)));
      else pts.push(V(u, R * Math.cos(t), R * Math.sin(t)));
    }
    return pts;
  }

  function metalMat(col) {
    return new THREE.MeshStandardMaterial({
      color: col || 0xd8a24a, emissive: 0x2a1602, emissiveIntensity: 0.4,
      roughness: 0.32, metalness: 0.75,
    });
  }

  /* =====================================================================
   * 1. 单个点电荷
   * =================================================================== */
  (function () {
    var srcs = [{ p: [0, 0, 0], q: 1 }];
    REG.point = {
      id: 'point', tone: 'E', canSplit: false, domain: 5.2, step: 0.14, maxSteps: 200,
      field: pointField(srcs),
      potential: pointPot(srcs),
      stop: nearStop(srcs, 0.34),
      probeAt: function () { return V(1.5, 1.1, 0.9); },
      seeds: function () {
        var out = [], n = 34;
        for (var i = 0; i < n; i++) out.push({ p: fibDir(i, n).multiplyScalar(0.36), dir: 1 });
        return out;
      },
      build: function (g) { g.add(ball([0, 0, 0], 1, 0.34, '+Q')); },
      gpu: {
        kind: 'raymarch', box: [-4.2, -3.4, -4.2, 4.2, 3.4, 4.2], step: 0.12, steps: 84, opacity: 0.6,
        srcs: srcs,
        vals: [1.05, 0.62, 0.38, 0.24],
        cols: [[1.0, 0.85, 0.45], [1.0, 0.62, 0.35], [1.0, 0.42, 0.42], [0.85, 0.35, 0.75]],
      },
    };
  })();

  /* =====================================================================
   * 2. 等量同种电荷（可拆分：只有 A / 只有 B / 叠加）
   * =================================================================== */
  (function () {
    var srcs = [{ p: [-1.75, 0, 0], q: 1 }, { p: [1.75, 0, 0], q: 1 }];
    REG.same = {
      id: 'same', tone: 'E', canSplit: true, domain: 5.6, step: 0.14, maxSteps: 220,
      field: pointField(srcs),
      potential: pointPot(srcs),
      stop: nearStop(srcs, 0.32),
      probeAt: function () { return V(0, 1.7, 1.0); },
      seeds: function () {
        var out = [], n = 22, i, k;
        for (k = 0; k < srcs.length; k++) {
          for (i = 0; i < n; i++) {
            out.push({ p: V(srcs[k].p[0], srcs[k].p[1], srcs[k].p[2]).add(fibDir(i, n).multiplyScalar(0.38)), dir: 1 });
          }
        }
        return out;
      },
      build: function (g, AA, opt) {
        var mode = (opt && opt.mode) || 'sum';
        if (mode !== 'b') g.add(ball(srcs[0].p, 1, 0.32, '+Q₁'));
        if (mode !== 'a') g.add(ball(srcs[1].p, 1, 0.32, '+Q₂'));
        if (mode === 'sum') {
          var lb = U.label('中点 E = 0（两场抵消）', { color: '#bfe3ff', worldH: 0.34 });
          lb.position.set(0, 2.5, 0);
          g.add(lb);
        }
      },
      gpu: {
        kind: 'raymarch', box: [-4.6, -3.6, -4.6, 4.6, 3.6, 4.6], step: 0.13, steps: 88, opacity: 0.58,
        srcs: srcs,
        vals: [0.95, 0.66, 0.46, 0.33],
        cols: [[1.0, 0.88, 0.52], [1.0, 0.66, 0.36], [1.0, 0.45, 0.45], [0.82, 0.32, 0.78]],
      },
    };
  })();

  /* =====================================================================
   * 3. 等量异种电荷（电偶极子）
   * =================================================================== */
  (function () {
    var srcs = [{ p: [-1.75, 0, 0], q: 1 }, { p: [1.75, 0, 0], q: -1 }];
    REG.opp = {
      id: 'opp', tone: 'E', canSplit: true, domain: 5.6, step: 0.14, maxSteps: 230,
      field: pointField(srcs),
      potential: pointPot(srcs),
      stop: nearStop(srcs, 0.32),
      probeAt: function () { return V(0, 1.6, 0.8); },
      seeds: function () {
        var out = [], n = 26, i;
        for (i = 0; i < n; i++) out.push({ p: V(-1.75, 0, 0).add(fibDir(i, n).multiplyScalar(0.38)), dir: 1 });
        for (i = 0; i < 14; i++) out.push({ p: V(1.75, 0, 0).add(fibDir(i, 14).multiplyScalar(0.38)), dir: -1 });
        return out;
      },
      build: function (g, AA, opt) {
        var mode = (opt && opt.mode) || 'sum';
        if (mode !== 'b') g.add(ball(srcs[0].p, 1, 0.32, '+Q'));
        if (mode !== 'a') g.add(ball(srcs[1].p, -1, 0.32, '−Q'));
      },
      gpu: {
        kind: 'raymarch', box: [-4.6, -3.6, -4.6, 4.6, 3.6, 4.6], step: 0.13, steps: 88, opacity: 0.58,
        srcs: srcs,
        vals: [0.62, 0.3, -0.3, -0.62],
        cols: [[1.0, 0.8, 0.42], [1.0, 0.55, 0.5], [0.45, 0.85, 1.0], [0.35, 0.6, 1.0]],
      },
    };
  })();

  /* =====================================================================
   * 4. 匀强电场（平行板电容器，真实离散点电荷求和 → 自带边缘效应）
   * =================================================================== */
  (function () {
    var N = 26, R = 2.7, HH = 1.55, q = 0.09;
    var srcs = [];
    var i;
    for (i = 0; i < N; i++) {
      var d = discPt(i, N, R * 0.92);
      srcs.push({ p: [d.x, HH, d.z], q: q, grp: 0 });
      srcs.push({ p: [d.x, -HH, d.z], q: -q, grp: 1 });
    }
    function use(i2, mode) {
      if (mode === 'a') return srcs[i2].grp === 0;
      if (mode === 'b') return srcs[i2].grp === 1;
      return true;
    }
    REG.uniform = {
      id: 'uniform', tone: 'E', canSplit: true, domain: 5.4, step: 0.16, maxSteps: 190,
      field: function (p, opt, out) {
        var mode = (opt && opt.mode) || 'sum';
        var x = 0, y = 0, z = 0;
        for (var k = 0; k < srcs.length; k++) {
          if (!use(k, mode)) continue;
          var dx = p.x - srcs[k].p[0], dy = p.y - srcs[k].p[1], dz = p.z - srcs[k].p[2];
          var r2 = dx * dx + dy * dy + dz * dz + 0.05;
          var kk = srcs[k].q / (r2 * Math.sqrt(r2));
          x += dx * kk; y += dy * kk; z += dz * kk;
        }
        return out.set(x, y, z);
      },
      potential: function (p, opt) {
        var mode = (opt && opt.mode) || 'sum';
        var s = 0;
        for (var k = 0; k < srcs.length; k++) {
          if (!use(k, mode)) continue;
          var dx = p.x - srcs[k].p[0], dy = p.y - srcs[k].p[1], dz = p.z - srcs[k].p[2];
          s += srcs[k].q / Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 0.14);
        }
        return s;
      },
      stop: function (p) {
        return Math.abs(p.y) > HH - 0.05 && Math.sqrt(p.x * p.x + p.z * p.z) < R;
      },
      probeAt: function () { return V(0.7, 0.2, 0.6); },
      seeds: function () {
        var out = [], n = 30, j;
        for (j = 0; j < n; j++) {
          var d = discPt(j, n, R * 0.86);
          out.push({ p: V(d.x, HH - 0.12, d.z), dir: 1 });
          out.push({ p: V(d.x, -HH + 0.12, d.z), dir: -1 });
        }
        return out;
      },
      build: function (g, AA, opt) {
        var mode = (opt && opt.mode) || 'sum';
        var plateMat = function (c) {
          return new THREE.MeshStandardMaterial({
            color: c, emissive: c, emissiveIntensity: 0.22, roughness: 0.35, metalness: 0.55,
            transparent: true, opacity: 0.55, side: THREE.DoubleSide,
          });
        };
        if (mode !== 'b') {
          var p1 = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.08, 40), plateMat(0xff7a6a));
          p1.position.y = HH; g.add(p1);
          var l1 = U.label('+ 板', { color: '#ffd9d2', worldH: 0.36 });
          l1.position.set(R + 0.5, HH + 0.3, 0); g.add(l1);
        }
        if (mode !== 'a') {
          var p2 = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.08, 40), plateMat(0x5aa9ff));
          p2.position.y = -HH; g.add(p2);
          var l2 = U.label('− 板', { color: '#d6ecff', worldH: 0.36 });
          l2.position.set(R + 0.5, -HH - 0.3, 0); g.add(l2);
        }
      },
      gpu: {
        kind: 'raymarch', box: [-3.1, -1.45, -3.1, 3.1, 1.45, 3.1], step: 0.1, steps: 70, opacity: 0.5,
        srcs: [],
        pot: 'return -p.y * 1.0;',
        vals: [1.1, 0.55, 0.0, -0.55],
        cols: [[1.0, 0.82, 0.4], [1.0, 0.6, 0.45], [0.6, 0.95, 0.9], [0.45, 0.7, 1.0]],
      },
    };
  })();

  /* =====================================================================
   * 5. 通电直导线（B = μ₀I/2πρ，磁感线是环绕导线的同心圆）
   * =================================================================== */
  (function () {
    var K = 1;
    function field(p, opt, out) {
      var x = p.x, z = p.z;
      var r2 = Math.max(x * x + z * z, 0.05);
      var k = K / r2;
      return out.set(z * k, 0, -x * k);
    }
    REG.wire = {
      id: 'wire', tone: 'B', canSplit: false, domain: 4.4, step: 0.13, maxSteps: 260,
      field: field,
      potential: function (p) { return K / Math.max(Math.sqrt(p.x * p.x + p.z * p.z), 0.16); },
      stop: function (p) { return Math.abs(p.y) > 2.7; },
      probeAt: function () { return V(1.3, 0.5, 0.3); },
      seeds: function () {
        var out = [], ys = [-1.6, -0.5, 0.6, 1.7], rs = [0.55, 1.15, 2.0, 2.9];
        for (var a = 0; a < ys.length; a++) {
          for (var b = 0; b < rs.length; b++) {
            for (var c = 0; c < 3; c++) {
              var th = (c / 3) * Math.PI * 2 + b * 0.4;
              out.push({ p: V(rs[b] * Math.cos(th), ys[a], rs[b] * Math.sin(th)), dir: 1 });
            }
          }
        }
        return out;
      },
      build: function (g) {
        var wire = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 5.6, 18), metalMat(0xf0c46a));
        g.add(wire);
        g.add(U.glow(0xffd98a, 0.9, 0.35));
        for (var i = 0; i < 4; i++) {
          var ar = U.arrow(V(0, -2.5 + i * 1.5, 0), V(0, 1, 0), 0.55, 0xffd166, 0.05);
          g.add(ar);
        }
        var lb = U.label('I ↑', { color: '#ffe9b0', worldH: 0.42 });
        lb.position.set(0.62, 2.55, 0);
        g.add(lb);
      },
      gpu: {
        kind: 'raymarch', box: [-3.2, -2.6, -3.2, 3.2, 2.6, 3.2], step: 0.1, steps: 78, opacity: 0.5,
        srcs: [],
        pot: 'return 1.0 / max(length(p.xz), 0.28);',
        vals: [2.4, 1.35, 0.8, 0.5],
        cols: [[0.5, 1.0, 0.95], [0.2, 0.85, 1.0], [0.3, 0.5, 1.0], [0.6, 0.32, 1.0]],
      },
    };
  })();

  /* =====================================================================
   * 6. 环形电流（Biot–Savart 数值求和）
   * =================================================================== */
  (function () {
    var R = 1.65, SEG = 40, K = 0.42;
    var seg = [];
    for (var i = 0; i < SEG; i++) {
      var t0 = (i / SEG) * Math.PI * 2, t1 = ((i + 1) / SEG) * Math.PI * 2;
      var a = V(R * Math.cos(t0), 0, R * Math.sin(t0));
      var b = V(R * Math.cos(t1), 0, R * Math.sin(t1));
      seg.push({ mid: a.clone().add(b).multiplyScalar(0.5), d: b.clone().sub(a) });
    }
    function field(p, opt, out) {
      var x = 0, y = 0, z = 0;
      for (var k = 0; k < seg.length; k++) {
        var rx = p.x - seg[k].mid.x, ry = p.y - seg[k].mid.y, rz = p.z - seg[k].mid.z;
        var r2 = rx * rx + ry * ry + rz * rz + 0.02;
        var inv = K / (r2 * Math.sqrt(r2));
        var dx = seg[k].d.x, dy = seg[k].d.y, dz = seg[k].d.z;
        x += (dy * rz - dz * ry) * inv;
        y += (dz * rx - dx * rz) * inv;
        z += (dx * ry - dy * rx) * inv;
      }
      return out.set(x, y, z);
    }
    REG.loop = {
      id: 'loop', tone: 'B', canSplit: false, domain: 4.6, step: 0.14, maxSteps: 260,
      field: field,
      potential: function (p) { return field(p, null, new THREE.Vector3()).length(); },
      stop: function (p) {
        var rho = Math.sqrt(p.x * p.x + p.z * p.z);
        return Math.abs(rho - R) < 0.16 && Math.abs(p.y) < 0.18;
      },
      probeAt: function () { return V(0, 0.5, 0); },
      seeds: function () {
        var out = [], rs = [0.12, 0.4, 0.75, 1.15, 1.42], j;
        for (var a = 0; a < rs.length; a++) {
          for (j = 0; j < 5; j++) {
            var th = (j / 5) * Math.PI * 2;
            out.push({ p: V(rs[a] * Math.cos(th), 0, rs[a] * Math.sin(th)), dir: 1 });
          }
        }
        for (j = 0; j < 6; j++) {
          var th2 = (j / 6) * Math.PI * 2;
          out.push({ p: V(3.4 * Math.cos(th2), -1.6, 3.4 * Math.sin(th2)), dir: -1 });
        }
        return out;
      },
      build: function (g) {
        var pts = [], n = 120;
        for (var i = 0; i <= n; i++) {
          var t = (i / n) * Math.PI * 2;
          pts.push(V(R * Math.cos(t), 0, R * Math.sin(t)));
        }
        g.add(U.tube(pts, 0.075, 0xf0c46a, 1));
        var ar = U.arrow(V(R, 0.05, 0), V(0, 0, 1), 0.6, 0xffd166, 0.05);
        g.add(ar);
        var lb = U.label('I', { color: '#ffe9b0', worldH: 0.4 });
        lb.position.set(0, 0.55, -R - 0.4);
        g.add(lb);
      },
      gpu: {
        kind: 'slice', ref: 0.55, opacity: 0.9,
        planes: [{ axis: 'y', at: 0, w: 8.4, h: 8.4 }, { axis: 'z', at: 0, w: 8.4, h: 5.2 }],
        mag: [
          'float s = 0.0;',
          'vec3 B = vec3(0.0);',
          'for (int i = 0; i < 16; i++) {',
          '  float a0 = float(i) / 16.0 * 6.2831853;',
          '  float a1 = float(i + 1) / 16.0 * 6.2831853;',
          '  vec3 a = vec3(1.65 * cos(a0), 0.0, 1.65 * sin(a0));',
          '  vec3 b = vec3(1.65 * cos(a1), 0.0, 1.65 * sin(a1));',
          '  vec3 mid = (a + b) * 0.5;',
          '  vec3 dl = b - a;',
          '  vec3 r = p - mid;',
          '  float r2 = dot(r, r) + 0.02;',
          '  B += cross(dl, r) * (0.42 * 40.0 / 16.0) / (r2 * sqrt(r2));',
          '}',
          'return length(B);',
        ].join('\n'),
      },
    };
  })();

  /* =====================================================================
   * 7. 通电螺线管（内部近似匀强，外部同条形磁铁）
   * =================================================================== */
  (function () {
    var R = 1.05, LEN = 4.6, TURNS = 13;
    var seg = [];
    for (var t = 0; t < TURNS; t++) {
      var x0 = -LEN / 2 + (t / TURNS) * LEN;
      for (var s = 0; s < 12; s++) {
        var a0 = (s / 12) * Math.PI * 2, a1 = ((s + 1) / 12) * Math.PI * 2;
        var a = V(x0, R * Math.cos(a0), R * Math.sin(a0));
        var b = V(x0, R * Math.cos(a1), R * Math.sin(a1));
        seg.push({ mid: a.clone().add(b).multiplyScalar(0.5), d: b.clone().sub(a) });
      }
    }
    var K = 0.05;
    function field(p, opt, out) {
      var x = 0, y = 0, z = 0;
      for (var k = 0; k < seg.length; k++) {
        var rx = p.x - seg[k].mid.x, ry = p.y - seg[k].mid.y, rz = p.z - seg[k].mid.z;
        var r2 = rx * rx + ry * ry + rz * rz + 0.02;
        var inv = K / (r2 * Math.sqrt(r2));
        var dx = seg[k].d.x, dy = seg[k].d.y, dz = seg[k].d.z;
        x += (dy * rz - dz * ry) * inv;
        y += (dz * rx - dx * rz) * inv;
        z += (dx * ry - dy * rx) * inv;
      }
      return out.set(x, y, z);
    }
    REG.solenoid = {
      id: 'solenoid', tone: 'B', canSplit: false, domain: 5.0, step: 0.15, maxSteps: 250,
      field: field,
      potential: function (p) { return field(p, null, new THREE.Vector3()).length(); },
      stop: function (p) {
        var rho = Math.sqrt(p.y * p.y + p.z * p.z);
        return rho < R + 0.1 && Math.abs(p.x) < LEN / 2 + 0.1 && rho > R - 0.12;
      },
      probeAt: function () { return V(0, 0, 0); },
      seeds: function () {
        var out = [], i, j;
        for (i = 0; i < 6; i++) {
          var x0 = -LEN / 2 + 0.35 + (i / 5) * (LEN - 0.7);
          for (j = 0; j < 4; j++) {
            var th = (j / 4) * Math.PI * 2 + i * 0.35;
            var rr = 0.18 + 0.21 * j;
            out.push({ p: V(x0, rr * Math.cos(th), rr * Math.sin(th)), dir: 1 });
          }
        }
        for (j = 0; j < 8; j++) {
          var th2 = (j / 8) * Math.PI * 2 + 0.3;
          out.push({ p: V(0, 3.2 * Math.cos(th2), 3.2 * Math.sin(th2)), dir: -1 });
        }
        return out;
      },
      build: function (g) {
        var pts = helixPts('x', LEN, R, TURNS, 22, 0);
        var curve = new THREE.CatmullRomCurve3(pts);
        var mesh = new THREE.Mesh(
          new THREE.TubeGeometry(curve, TURNS * 26, 0.06, 7, false),
          metalMat(0xf0c46a)
        );
        g.add(mesh);
        var lb = U.label('内部匀强 B →', { color: '#cdeaff', worldH: 0.38 });
        lb.position.set(0, R + 0.75, 0);
        g.add(lb);
      },
      gpu: {
        kind: 'slice', ref: 0.9, opacity: 0.9,
        planes: [{ axis: 'y', at: 0, w: 9.0, h: 9.0 }, { axis: 'z', at: 0, w: 9.0, h: 5.4 }],
        mag: [
          'vec3 B = vec3(0.0);',
          'for (int t = 0; t < 7; t++) {',
          '  float x0 = -2.3 + float(t) * 0.766;',
          '  for (int s = 0; s < 8; s++) {',
          '    float a0 = float(s) / 8.0 * 6.2831853;',
          '    float a1 = float(s + 1) / 8.0 * 6.2831853;',
          '    vec3 a = vec3(x0, 1.05 * cos(a0), 1.05 * sin(a0));',
          '    vec3 b = vec3(x0, 1.05 * cos(a1), 1.05 * sin(a1));',
          '    vec3 mid = (a + b) * 0.5;',
          '    vec3 dl = b - a;',
          '    vec3 r = p - mid;',
          '    float r2 = dot(r, r) + 0.02;',
          '    B += cross(dl, r) * (0.05 * 13.0 * 12.0 / 56.0) / (r2 * sqrt(r2));',
          '  }',
          '}',
          'return length(B);',
        ].join('\n'),
      },
    };
  })();

  /* =====================================================================
   * 8. 条形磁铁（磁偶极子：N 极出、S 极入）
   * =================================================================== */
  (function () {
    var srcs = [{ p: [1.5, 0, 0], q: 1 }, { p: [-1.5, 0, 0], q: -1 }];
    var field = pointField(srcs);
    var pot = pointPot(srcs);
    REG.magnet = {
      id: 'magnet', tone: 'B', canSplit: false, domain: 5.2, step: 0.14, maxSteps: 230,
      field: field,
      potential: pot,
      stop: nearStop(srcs, 0.42),
      probeAt: function () { return V(0, 1.5, 0.9); },
      seeds: function () {
        var out = [], n = 30, i;
        for (i = 0; i < n; i++) out.push({ p: V(1.5, 0, 0).add(fibDir(i, n).multiplyScalar(0.5)), dir: 1 });
        for (i = 0; i < 16; i++) out.push({ p: V(-1.5, 0, 0).add(fibDir(i, 16).multiplyScalar(0.5)), dir: -1 });
        return out;
      },
      build: function (g) {
        var N = new THREE.Mesh(
          new THREE.BoxGeometry(1.6, 0.85, 0.85),
          new THREE.MeshStandardMaterial({ color: 0xe8564b, emissive: 0x510f0a, emissiveIntensity: 0.4, roughness: 0.35, metalness: 0.35 })
        );
        N.position.x = 0.8; g.add(N);
        var S = new THREE.Mesh(
          new THREE.BoxGeometry(1.6, 0.85, 0.85),
          new THREE.MeshStandardMaterial({ color: 0x4a7fe0, emissive: 0x081a44, emissiveIntensity: 0.4, roughness: 0.35, metalness: 0.35 })
        );
        S.position.x = -0.8; g.add(S);
        var ln = U.label('N', { color: '#ffd9d2', worldH: 0.5 });
        ln.position.set(1.5, 0.75, 0); g.add(ln);
        var ls = U.label('S', { color: '#d6ecff', worldH: 0.5 });
        ls.position.set(-1.5, 0.75, 0); g.add(ls);
      },
      gpu: {
        kind: 'raymarch', box: [-4.2, -3.2, -4.2, 4.2, 3.2, 4.2], step: 0.12, steps: 84, opacity: 0.56,
        srcs: srcs,
        vals: [0.7, 0.34, -0.34, -0.7],
        cols: [[0.55, 1.0, 0.9], [0.25, 0.9, 1.0], [0.4, 0.55, 1.0], [0.68, 0.35, 1.0]],
      },
    };
  })();
})();
