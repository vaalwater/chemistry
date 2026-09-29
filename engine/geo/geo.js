/* 立体几何引擎（three.js）：3D 实体 ↔ 2D 斜二测投影联动、表面展开、
 * 定理场景 / 空间角场景 / 体积推导剧场。
 * 通过 window.__dispatch(msg) 接收宿主命令，notify() 回传事件。 */
(function () {
  'use strict';

  var A = {};
  window.GEO = A;

  var hasThree = typeof THREE !== 'undefined';
  var app = document.getElementById('app');
  var panel2d = document.getElementById('panel2d');
  var boot = document.getElementById('boot');
  var errBox = document.getElementById('errMsg');
  var hintBox = document.getElementById('hint');
  var hintText = document.getElementById('hintText');

  /* ---------------- 基础工具 ---------------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function V(x, y, z) { return new THREE.Vector3(x, y, z); }
  function notify(obj) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(obj));
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(obj, '*');
      }
    } catch (e) { /* noop */ }
  }
  function showErr(msg) {
    if (!errBox) return;
    errBox.textContent = msg;
    errBox.style.display = 'block';
  }
  function hint(msg) {
    if (!hintBox || !hintText) return;
    if (!msg) { hintBox.classList.remove('show'); return; }
    hintText.textContent = msg;
    hintBox.classList.add('show');
    clearTimeout(hint._t);
    hint._t = setTimeout(function () { hintBox.classList.remove('show'); }, 2600);
  }
  A.clamp = clamp; A.lerp = lerp; A.ease = ease; A.V = V; A.notify = notify; A.hint = hint;

  if (!hasThree) {
    showErr('三维引擎加载失败（THREE 未定义）');
    return;
  }

  /* ---------------- 渲染器 / 场景 ---------------- */
  var wrap = document.getElementById('view3d');
  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  wrap.appendChild(renderer.domElement);
  var canvas3 = renderer.domElement;
  canvas3.style.display = 'block';
  canvas3.style.touchAction = 'none';

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  var camState = { dist: 9, target: V(0, 0, 0) };
  var model = new THREE.Group();      // 学生拖动旋转的是“模型”本身（投影图才会跟着变）
  scene.add(model);
  var content = new THREE.Group();    // 当前几何体 / 场景内容
  model.add(content);

  scene.add(new THREE.AmbientLight(0xffffff, 0.72));
  var key = new THREE.DirectionalLight(0xffffff, 0.75);
  key.position.set(4, 8, 6);
  scene.add(key);
  var fill = new THREE.DirectionalLight(0xffffff, 0.28);
  fill.position.set(-6, 2, -5);
  scene.add(fill);

  var ctx2 = null, canvas2 = null;
  if (panel2d) {
    canvas2 = document.createElement('canvas');
    canvas2.style.display = 'block';
    canvas2.style.touchAction = 'none';
    panel2d.appendChild(canvas2);
    ctx2 = canvas2.getContext('2d');
  }

  /* ---------------- 布局 ---------------- */
  var layout = 'full';
  function setLayout(mode) {
    layout = mode === 'split' ? 'split' : 'full';
    if (!app) return;
    app.classList.toggle('split', layout === 'split');
    panel2d.style.display = layout === 'split' ? 'flex' : 'none';
    resize();
  }
  A.setLayout = setLayout;

  function resize() {
    var w = app.clientWidth || window.innerWidth;
    var h = app.clientHeight || window.innerHeight;
    var h3 = layout === 'split' ? Math.round(h * 0.56) : h;
    var h2 = h - h3;
    renderer.setSize(w, h3, false);
    camera.aspect = w / Math.max(1, h3);
    camera.updateProjectionMatrix();
    if (canvas2) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas2.width = Math.round(w * dpr);
      canvas2.height = Math.round(h2 * dpr);
      canvas2.style.width = w + 'px';
      canvas2.style.height = h2 + 'px';
      ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    drawProjection();
  }
  window.addEventListener('resize', resize);

  /* ---------------- 模型旋转 / 缩放（拖拽 = 转模型本身，2D 投影才同步） ---------------- */
  var rot = { yaw: -0.55, pitch: 0.28 };
  var VIEW_DIR = V(0.44, 0.4, 1).normalize();
  function applyCam() {
    camState.dist = clamp(camState.dist, 3.2, 26);
    camera.position.copy(camState.target).add(VIEW_DIR.clone().multiplyScalar(camState.dist));
    camera.lookAt(camState.target);
    // 关键：拖拽旋转的是“几何体”而不是相机 —— 2D 投影取世界坐标，因此会跟着一起变
    model.quaternion.setFromEuler(new THREE.Euler(rot.pitch, rot.yaw, 0, 'YXZ'));
  }
  A.applyCam = applyCam;
  A.camState = camState;
  A.rot = rot;

  (function bindInput() {
    var pointers = {};
    var last = null;
    var pinch = null;

    canvas3.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas3.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;
      canvas3.setPointerCapture && canvas3.setPointerCapture(e.pointerId);
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      last = { x: e.clientX, y: e.clientY };
    });
    canvas3.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      if (!last) return;
      var dx = e.clientX - last.x, dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      rotate(dx, dy);
    });
    function endPointer(e) {
      if (e.pointerType === 'touch') return;
      delete pointers[e.pointerId];
      last = null;
    }
    canvas3.addEventListener('pointerup', endPointer);
    canvas3.addEventListener('pointercancel', endPointer);

    canvas3.addEventListener('wheel', function (e) {
      e.preventDefault();
      camState.dist *= (1 + Math.sign(e.deltaY) * 0.08);
      applyCam();
    }, { passive: false });

    canvas3.addEventListener('touchstart', function (e) {
      var ts = e.touches;
      if (ts.length === 1) {
        last = { x: ts[0].clientX, y: ts[0].clientY };
      } else if (ts.length === 2) {
        pinch = Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
      }
    }, { passive: true });
    canvas3.addEventListener('touchmove', function (e) {
      var ts = e.touches;
      if (ts.length === 1 && last) {
        var dx = ts[0].clientX - last.x, dy = ts[0].clientY - last.y;
        last = { x: ts[0].clientX, y: ts[0].clientY };
        rotate(dx, dy);
      } else if (ts.length === 2 && pinch) {
        var d = Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
        camState.dist *= pinch / Math.max(1, d);
        pinch = d;
        applyCam();
      }
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
    canvas3.addEventListener('touchend', function (e) {
      if (e.touches.length === 0) { last = null; pinch = null; }
    }, { passive: true });

    function rotate(dx, dy) {
      rot.yaw += dx * 0.008;
      rot.pitch = clamp(rot.pitch + dy * 0.006, -1.35, 1.35);
      applyCam();
    }
  })();

  /* ---------------- 绘图小工具（同时给场景脚本用） ---------------- */
  function mat(color, opacity, opts) {
    opts = opts || {};
    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: opts.roughness !== undefined ? opts.roughness : 0.55,
      metalness: 0.02,
      transparent: opacity !== undefined && opacity < 1,
      opacity: opacity !== undefined ? opacity : 1,
      side: opts.side || THREE.DoubleSide,
      depthWrite: opts.depthWrite !== undefined ? opts.depthWrite : true,
    });
  }
  A.mat = mat;

  /** 线段（细圆柱，线宽可控，便于拾取与高亮） */
  function seg(a, b, r, color, opacity) {
    var dir = new THREE.Vector3().subVectors(b, a);
    var len = dir.length();
    if (len < 1e-6) return new THREE.Mesh(new THREE.BufferGeometry(), mat(color, opacity));
    var geo = new THREE.CylinderGeometry(r, r, len, 8, 1);
    var m = new THREE.Mesh(geo, mat(color, opacity));
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
    return m;
  }
  A.seg = seg;

  function polyMesh(pts, tri, color, opacity) {
    var pos = [];
    var idx = [];
    if (tri) {
      for (var i = 0; i < pts.length; i++) pos.push(pts[i].x, pts[i].y, pts[i].z);
      for (var t = 0; t < tri.length; t++) idx.push(tri[t][0], tri[t][1], tri[t][2]);
    } else {
      for (var j = 0; j < pts.length; j++) pos.push(pts[j].x, pts[j].y, pts[j].z);
      for (var k = 1; k < pts.length - 1; k++) idx.push(0, k, k + 1);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return new THREE.Mesh(g, mat(color, opacity));
  }
  A.polyMesh = polyMesh;

  /** 文字标签（Canvas 贴图 Sprite） */
  function label(text, opts) {
    opts = opts || {};
    var color = opts.color || '#31425f';
    var size = opts.size || 44;
    var weight = opts.bold === false ? 500 : 700;
    var pad = 10;
    var cv = document.createElement('canvas');
    var c = cv.getContext('2d');
    var font = weight + ' ' + size + 'px -apple-system, "PingFang SC", "Helvetica Neue", sans-serif';
    c.font = font;
    var w = Math.ceil(c.measureText(text).width) + pad * 2;
    var h = Math.ceil(size * 1.4) + pad;
    cv.width = w; cv.height = h;
    c.font = font;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (opts.halo !== false) {
      c.shadowColor = 'rgba(255,255,255,0.9)';
      c.shadowBlur = 8;
    }
    c.fillStyle = color;
    c.fillText(text, w / 2, h / 2);
    var tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearFilter;
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    var wh = opts.worldH || 0.5;
    spr.scale.set((w / h) * wh, wh, 1);
    spr.renderOrder = 20;
    return spr;
  }
  A.label = label;

  /** 直角符号：以 o 为顶点，向 a、b 方向各画一小段方形标记 */
  function rightAngle(a, o, b, color, size) {
    var s = size || 0.38;
    var u = new THREE.Vector3().subVectors(a, o).normalize();
    var v = new THREE.Vector3().subVectors(b, o).normalize();
    var g = new THREE.Group();
    var p1 = o.clone().add(u.clone().multiplyScalar(s));
    var p2 = p1.clone().add(v.clone().multiplyScalar(s));
    var p3 = o.clone().add(v.clone().multiplyScalar(s));
    g.add(seg(p1, p2, 0.022, color, 1));
    g.add(seg(p2, p3, 0.022, color, 1));
    return g;
  }
  A.rightAngle = rightAngle;

  /** 角弧 + 文字：用于标出“所求角” */
  function angleArc(a, o, b, color, text) {
    var u = new THREE.Vector3().subVectors(a, o);
    var v = new THREE.Vector3().subVectors(b, o);
    var r = Math.min(u.length(), v.length()) * 0.32;
    u.normalize(); v.normalize();
    var pts = [];
    var n = 16;
    var ang = u.angleTo(v);
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var d = new THREE.Vector3().copy(u).lerp(v, t).normalize();
      if (d.lengthSq() < 1e-6) d.copy(u);
      pts.push(o.clone().add(d.multiplyScalar(r)));
    }
    var g = new THREE.Group();
    for (var k = 0; k < pts.length - 1; k++) g.add(seg(pts[k], pts[k + 1], 0.02, color, 1));
    if (text) {
      var bis = new THREE.Vector3().copy(u).add(v).normalize();
      var lb = label(text, { color: '#d9534f', size: 40, worldH: 0.42 });
      lb.position.copy(o.clone().add(bis.multiplyScalar(r * 1.75)));
      g.add(lb);
    }
    g.userData.angle = ang;
    return g;
  }
  A.angleArc = angleArc;

  /* ---------------- 补间动画 ---------------- */
  var tweens = [];
  function tween(dur, apply, onDone) {
    for (var i = 0; i < tweens.length; i++) if (tweens[i].tag && apply.tag && tweens[i].tag === apply.tag) tweens.splice(i, 1);
    tweens.push({ t: 0, dur: Math.max(0.01, dur), apply: apply, onDone: onDone, tag: apply.tag });
  }
  A.tween = tween;
  function stepTweens(dt) {
    for (var i = tweens.length - 1; i >= 0; i--) {
      var tw = tweens[i];
      tw.t += dt;
      var p = clamp(tw.t / tw.dur, 0, 1);
      tw.apply(ease(p), p);
      if (p >= 1) {
        tweens.splice(i, 1);
        if (tw.onDone) tw.onDone();
      }
    }
  }
  function clearTweens(tag) {
    for (var i = tweens.length - 1; i >= 0; i--) {
      if (!tag || tweens[i].tag === tag) tweens.splice(i, 1);
    }
  }
  A.clearTweens = clearTweens;

  /* ---------------- 形状库 ----------------
   * face = { id, v:[Vector3], tri?:[[i,j,k]], color, edgeIds:[...], soft?:true, unfolded?:[Vector3] }
   * 展开：平面多面体走“绕棱旋转”的刚体插值；曲面（圆柱/圆锥）走顶点级插值（soft）。
   */
  var FACE_COLORS = {
    base: 0xdfe9f7, side: 0xcfe0f7, top: 0xe6eefb, cap: 0xd8e6fa,
    alt: 0xe3ecfa, alt2: 0xd4e3f8
  };

  function autoOrient(faces) {
    // 让每个面的顶点序满足“外法线朝外”（凸体：面法线与 面心-体心 同向）
    var c = new THREE.Vector3();
    var all = [];
    faces.forEach(function (f) { f.v.forEach(function (p) { all.push(p); }); });
    all.forEach(function (p) { c.add(p); });
    c.multiplyScalar(1 / Math.max(1, all.length));
    faces.forEach(function (f) {
      var fc = new THREE.Vector3();
      f.v.forEach(function (p) { fc.add(p); });
      fc.multiplyScalar(1 / f.v.length);
      var n = normalOf(f.v);
      if (n.dot(new THREE.Vector3().subVectors(fc, c)) < 0) {
        f.v.reverse();
        if (f.tri) f.tri = f.tri.map(function (t) { return [t[2], t[1], t[0]]; });
      }
    });
  }
  function normalOf(v) {
    var a = new THREE.Vector3().subVectors(v[1], v[0]);
    var b = new THREE.Vector3().subVectors(v[2], v[1]);
    return new THREE.Vector3().crossVectors(a, b).normalize();
  }
  A.normalOf = normalOf;

  function shapeCube() {
    var s = 2;
    var p = {
      A: V(0, 0, 0), B: V(s, 0, 0), C: V(s, 0, s), D: V(0, 0, s),
      A1: V(0, s, 0), B1: V(s, s, 0), C1: V(s, s, s), D1: V(0, s, s)
    };
    return {
      id: 'cube', name: '正方体',
      labels: [
        { t: 'A', p: p.A }, { t: 'B', p: p.B }, { t: 'C', p: p.C }, { t: 'D', p: p.D },
        { t: "A'", p: p.A1 }, { t: "B'", p: p.B1 }, { t: "C'", p: p.C1 }, { t: "D'", p: p.D1 }
      ],
      faces: [
        { id: 'f-bottom', v: [p.A, p.B, p.C, p.D], color: FACE_COLORS.base, edgeIds: ['AB', 'BC', 'CD', 'DA'] },
        { id: 'f-front', v: [p.A, p.A1, p.B1, p.B], color: FACE_COLORS.side, edgeIds: ["AA'", "A'B'", "B'B", 'BA'] },
        { id: 'f-right', v: [p.B, p.B1, p.C1, p.C], color: FACE_COLORS.side, edgeIds: ["BB'", "B'C'", "C'C", 'CB'] },
        { id: 'f-back', v: [p.C, p.C1, p.D1, p.D], color: FACE_COLORS.alt, edgeIds: ["CC'", "C'D'", "D'D", 'DC'] },
        { id: 'f-left', v: [p.D, p.D1, p.A1, p.A], color: FACE_COLORS.side, edgeIds: ["DD'", "D'A'", "A'A", 'AD'] },
        { id: 'f-top', v: [p.A1, p.D1, p.C1, p.B1], color: FACE_COLORS.top, edgeIds: ["A'D'", "D'C'", "C'B'", "B'A'"] }
      ]
    };
  }

  function shapeTetra() {
    var s = 2.1;
    var h = Math.sqrt(2 / 3) * s;
    var B = V(0, 0, 0), C = V(s, 0, 0);
    var D = V(s / 2, 0, s * Math.sqrt(3) / 2);
    var cen = new THREE.Vector3().copy(B).add(C).add(D).multiplyScalar(1 / 3);
    var A = cen.clone().add(V(0, h, 0));
    return {
      id: 'tetra', name: '正四面体',
      labels: [{ t: 'A', p: A }, { t: 'B', p: B }, { t: 'C', p: C }, { t: 'D', p: D }],
      faces: [
        { id: 'f-base', v: [B, C, D], color: FACE_COLORS.base, edgeIds: ['BC', 'CD', 'DB'] },
        { id: 'f-abc', v: [A, B, C], color: FACE_COLORS.side, edgeIds: ['AB', 'BC', 'CA'] },
        { id: 'f-acd', v: [A, C, D], color: FACE_COLORS.alt, edgeIds: ['AC', 'CD', 'DA'] },
        { id: 'f-abd', v: [A, D, B], color: FACE_COLORS.alt2, edgeIds: ['AD', 'DB', 'BA'] }
      ]
    };
  }

  function shapePrism3() {
    var s = 2, h = 2.6;
    var A = V(0, 0, 0), B = V(s, 0, 0), C = V(s / 2, 0, s * Math.sqrt(3) / 2);
    var A1 = V(0, h, 0), B1 = V(s, h, 0), C1 = V(s / 2, h, s * Math.sqrt(3) / 2);
    return {
      id: 'prism3', name: '直三棱柱',
      labels: [
        { t: 'A', p: A }, { t: 'B', p: B }, { t: 'C', p: C },
        { t: "A'", p: A1 }, { t: "B'", p: B1 }, { t: "C'", p: C1 }
      ],
      faces: [
        { id: 'f-base', v: [A, B, C], color: FACE_COLORS.base, edgeIds: ['AB', 'BC', 'CA'] },
        { id: 'f-top', v: [A1, C1, B1], color: FACE_COLORS.top, edgeIds: ["A'C'", "C'B'", "B'A'"] },
        { id: 'f-abb', v: [A, A1, B1, B], color: FACE_COLORS.side, edgeIds: ["AA'", "A'B'", "B'B", 'BA'] },
        { id: 'f-bcc', v: [B, B1, C1, C], color: FACE_COLORS.alt, edgeIds: ["BB'", "B'C'", "C'C", 'CB'] },
        { id: 'f-caa', v: [C, C1, A1, A], color: FACE_COLORS.alt2, edgeIds: ["CC'", "C'A'", "A'A", 'AC'] }
      ]
    };
  }

  function shapePyramid4() {
    var s = 2.2, h = 2.4;
    var A = V(-s / 2, 0, -s / 2), B = V(s / 2, 0, -s / 2), C = V(s / 2, 0, s / 2), D = V(-s / 2, 0, s / 2);
    var P = V(0, h, 0);
    return {
      id: 'pyramid4', name: '正四棱锥',
      labels: [
        { t: 'P', p: P }, { t: 'A', p: A }, { t: 'B', p: B }, { t: 'C', p: C }, { t: 'D', p: D }
      ],
      faces: [
        { id: 'f-base', v: [A, B, C, D], color: FACE_COLORS.base, edgeIds: ['AB', 'BC', 'CD', 'DA'] },
        { id: 'f-pab', v: [P, A, B], color: FACE_COLORS.side, edgeIds: ['PA', 'AB', 'BP'] },
        { id: 'f-pbc', v: [P, B, C], color: FACE_COLORS.alt, edgeIds: ['PB', 'BC', 'CP'] },
        { id: 'f-pcd', v: [P, C, D], color: FACE_COLORS.alt2, edgeIds: ['PC', 'CD', 'DP'] },
        { id: 'f-pda', v: [P, D, A], color: FACE_COLORS.side, edgeIds: ['PD', 'DA', 'AP'] }
      ]
    };
  }

  function shapeFrustum() {
    var b = 2.4, t = 1.2, h = 2.2;
    function ring(r, y) {
      return [V(-r / 2, y, -r / 2), V(r / 2, y, -r / 2), V(r / 2, y, r / 2), V(-r / 2, y, r / 2)];
    }
    var lo = ring(b, 0), hi = ring(t, h);
    var L = ['A', 'B', 'C', 'D'], U = ["A'", "B'", "C'", "D'"];
    var labels = [];
    lo.forEach(function (p, i) { labels.push({ t: L[i], p: p }); });
    hi.forEach(function (p, i) { labels.push({ t: U[i], p: p }); });
    var faces = [
      { id: 'f-base', v: [lo[0], lo[1], lo[2], lo[3]], color: FACE_COLORS.base, edgeIds: ['AB', 'BC', 'CD', 'DA'] },
      { id: 'f-top', v: [hi[3], hi[2], hi[1], hi[0]], color: FACE_COLORS.top, edgeIds: ["A'D'", "D'C'", "C'B'", "B'A'"] }
    ];
    for (var i = 0; i < 4; i++) {
      var j = (i + 1) % 4;
      faces.push({
        id: 'f-s' + i, v: [lo[i], lo[j], hi[j], hi[i]], color: i % 2 ? FACE_COLORS.alt : FACE_COLORS.side,
        edgeIds: [L[i] + L[j], L[j] + U[j], U[j] + U[i], U[i] + L[i]]
      });
    }
    return { id: 'frustum', name: '正四棱台', labels: labels, faces: faces };
  }

  var SEG = 28;
  /** 圆环轮廓线（曲面自己给出要描的边，避免把三角网格当成多边形来画） */
  function ringOutline(offset, n) {
    var o = [];
    for (var i = 0; i < n; i++) o.push([offset + i, offset + ((i + 1) % n)]);
    return o;
  }

  function shapeCylinder() {
    var r = 1.3, h = 2.8;
    var lo = [], hi = [], tri = [];
    for (var i = 0; i < SEG; i++) {
      var a = (i / SEG) * Math.PI * 2;
      lo.push(V(r * Math.cos(a), 0, r * Math.sin(a)));
      hi.push(V(r * Math.cos(a), h, r * Math.sin(a)));
    }
    for (var k = 0; k < SEG; k++) {
      var k2 = (k + 1) % SEG;
      tri.push([k, SEG + k, SEG + k2]);
      tri.push([k, SEG + k2, k2]);
    }
    var side = {
      id: 'f-side', v: lo.concat(hi), tri: tri, color: FACE_COLORS.side, soft: true, edgeIds: [],
      outline: ringOutline(0, SEG).concat(ringOutline(SEG, SEG), [[0, SEG], [14, SEG + 14]])
    };
    var capB = {
      id: 'f-capB', v: lo.slice().reverse(), color: FACE_COLORS.base, soft: true, edgeIds: [],
      outline: ringOutline(0, SEG)
    };
    var capT = {
      id: 'f-capT', v: hi.slice(), color: FACE_COLORS.top, soft: true, edgeIds: [],
      outline: ringOutline(0, SEG)
    };
    // 展开：侧面摊成矩形、两个底圆摊到矩形上下两侧
    var ufSide = [], ufCapB = [], ufCapT = [];
    var w = 2 * Math.PI * r;
    var y0 = -0.9 - Math.PI * r;
    for (var m = 0; m < SEG; m++) {
      var aa = (m / SEG) * Math.PI * 2;
      ufSide.push(V(-w / 2 + (m / SEG) * w, y0, 0));
      ufSide.push(V(-w / 2 + (m / SEG) * w, y0 + h, 0));
      ufCapB.push(V(r * Math.cos(aa), y0 - r - 0.5, r * Math.sin(aa) * 0.62));
      ufCapT.push(V(r * Math.cos(aa), y0 + h + r + 0.5, r * Math.sin(aa) * 0.62));
    }
    side.unfolded = ufSide; capB.unfolded = ufCapB; capT.unfolded = ufCapT;
    return {
      id: 'cylinder', name: '圆柱',
      labels: [{ t: 'O', p: V(0, -0.55, 0) }, { t: "O'", p: V(0, h + 0.55, 0) }],
      faces: [side, capB, capT]
    };
  }

  function shapeCone() {
    var r = 1.35, h = 2.9;
    var base = [], tri = [];
    var P = V(0, h, 0);
    for (var i = 0; i < SEG; i++) {
      var a = (i / SEG) * Math.PI * 2;
      base.push(V(r * Math.cos(a), 0, r * Math.sin(a)));
    }
    for (var k = 0; k < SEG; k++) {
      var k2 = (k + 1) % SEG;
      tri.push([SEG, k, k2]);
    }
    var side = {
      id: 'f-side', v: base.concat([P]), tri: tri, color: FACE_COLORS.side, soft: true, edgeIds: [],
      outline: ringOutline(0, SEG).concat([[0, SEG], [14, SEG]])
    };
    var cap = {
      id: 'f-cap', v: base.slice(), color: FACE_COLORS.base, soft: true, edgeIds: [],
      outline: ringOutline(0, SEG)
    };
    // 展开：侧面 → 扇形（半径 = 母线 L，圆心角 = 2πr/L），底圆 → 圆
    var L = Math.hypot(r, h);
    var span = (2 * Math.PI * r) / L;
    var y0 = -1.6 - L / 2;
    var ufSide = [], ufCap = [];
    for (var m = 0; m < SEG; m++) {
      var th = -span / 2 + (m / SEG) * span;
      ufSide.push(V(L * Math.sin(th), y0 + L * 0.5 - L * Math.cos(th) * 0.5, 0));
    }
    ufSide.push(V(0, y0 + L * 0.5, 0));
    for (var n = 0; n < SEG; n++) {
      var an = (n / SEG) * Math.PI * 2;
      ufCap.push(V(r * Math.cos(an), y0 - r - 0.7, r * Math.sin(an) * 0.62));
    }
    side.unfolded = ufSide; cap.unfolded = ufCap;
    return {
      id: 'cone', name: '圆锥',
      labels: [{ t: 'P', p: V(0, h + 0.5, 0) }, { t: 'O', p: V(0, -0.5, 0) }],
      faces: [side, cap]
    };
  }

  var SHAPES = {
    cube: shapeCube, tetra: shapeTetra, prism3: shapePrism3,
    pyramid4: shapePyramid4, frustum: shapeFrustum, cylinder: shapeCylinder, cone: shapeCone
  };
  A.SHAPES = SHAPES;

  /* ---------------- 展开方案：平面多面体按“绕棱旋转”生成网图 ---------------- */
  function unfoldPlan(faces) {
    // 面法线
    faces.forEach(function (f) { f.n = normalOf(f.v); });
    // 邻接：共享棱（两端点重合）的面
    function key(p) { return p.x.toFixed(3) + ',' + p.y.toFixed(3) + ',' + p.z.toFixed(3); }
    var adj = faces.map(function () { return []; });
    for (var i = 0; i < faces.length; i++) {
      for (var j = i + 1; j < faces.length; j++) {
        var shared = sharedEdge(faces[i].v, faces[j].v);
        if (shared) {
          adj[i].push({ f: j, hinge: shared });
          adj[j].push({ f: i, hinge: shared });
        }
      }
    }
    // 基准面：面积最大、法线竖直的面（底面优先）
    var baseIdx = 0, bestArea = -1;
    faces.forEach(function (f, i) {
      var area = areaOf(f.v) * (Math.abs(f.n.y) > 0.5 ? 1.6 : 1);
      if (area > bestArea) { bestArea = area; baseIdx = i; }
    });

    var order = [baseIdx];
    var seen = {}; seen[baseIdx] = true;
    var parent = {}; parent[baseIdx] = null;
    var queue = [baseIdx];
    while (queue.length) {
      var cur = queue.shift();
      for (var a = 0; a < adj[cur].length; a++) {
        var nx = adj[cur][a].f;
        if (seen[nx]) continue;
        seen[nx] = true;
        parent[nx] = { f: cur, hinge: adj[cur][a].hinge };
        order.push(nx);
        queue.push(nx);
      }
    }
    // 逐面计算“摊平到基准面所在平面”的刚体变换 M
    var M = {};
    M[baseIdx] = new THREE.Matrix4();
    for (var o = 1; o < order.length; o++) {
      var idx = order[o];
      var pr = parent[idx];
      if (!pr) { M[idx] = new THREE.Matrix4(); continue; }
      var A3 = pr.hinge[0].clone(), B3 = pr.hinge[1].clone();
      // 在父面的展开坐标系下：把父/子面变换到“世界展开”前，先把 hinge 用 M[父] 变换
      var Am = A3.clone().applyMatrix4(M[pr.f]);
      var Bm = B3.clone().applyMatrix4(M[pr.f]);
      var axis = new THREE.Vector3().subVectors(Bm, Am).normalize();
      var nChild = faces[idx].n.clone().applyMatrix4(new THREE.Matrix4().extractRotation(M[pr.f]));
      var nParent = faces[pr.f].n.clone().applyMatrix4(new THREE.Matrix4().extractRotation(M[pr.f]));
      var m = new THREE.Matrix4().makeRotationAxis(axis, angleBetweenAbout(nChild, nParent, axis));
      var toOrigin = new THREE.Matrix4().makeTranslation(-Am.x, -Am.y, -Am.z);
      var back = new THREE.Matrix4().makeTranslation(Am.x, Am.y, Am.z);
      var local = new THREE.Matrix4().multiplyMatrices(back, new THREE.Matrix4().multiplyMatrices(m, toOrigin));
      M[idx] = new THREE.Matrix4().multiplyMatrices(M[pr.f], local);
    }
    faces.forEach(function (f, i) { f.unfoldM = M[i] || new THREE.Matrix4(); });
  }

  function angleBetweenAbout(nc, np, axis) {
    // 绕 axis 旋转多少能把 nc 转到 np（摊平：子面法线转到父面法线方向）
    var pc = nc.clone().sub(axis.clone().multiplyScalar(nc.dot(axis))).normalize();
    var pp = np.clone().sub(axis.clone().multiplyScalar(np.dot(axis))).normalize();
    var cross = new THREE.Vector3().crossVectors(pc, pp);
    var s = clamp(cross.dot(axis), -1, 1);
    var c = clamp(pc.dot(pp), -1, 1);
    return Math.atan2(s, c);
  }

  function sharedEdge(v1, v2) {
    var res = [];
    for (var i = 0; i < v1.length; i++) {
      var a = v1[i], b = v1[(i + 1) % v1.length];
      for (var j = 0; j < v2.length; j++) {
        var c = v2[j], d = v2[(j + 1) % v2.length];
        if ((a.distanceTo(c) < 1e-3 && b.distanceTo(d) < 1e-3) || (a.distanceTo(d) < 1e-3 && b.distanceTo(c) < 1e-3)) {
          res.push(a.clone(), b.clone());
        }
      }
    }
    return res.length === 2 ? res : null;
  }
  function areaOf(v) {
    var s = 0;
    for (var i = 1; i < v.length - 1; i++) {
      var a = new THREE.Vector3().subVectors(v[i], v[0]);
      var b = new THREE.Vector3().subVectors(v[i + 1], v[0]);
      s += new THREE.Vector3().crossVectors(a, b).length() / 2;
    }
    return s;
  }

  /* ---------------- 当前几何体（形状模式） ---------------- */
  var geoState = null;
  // geoState = { shape, faces:[{group, mesh, lines:[], base:[Vector3], unfolded:[Vector3], soft, edgeIds}], labels, unfoldT, edges:{} }

  function clearContent() {
    clearTweens();
    while (content.children.length) content.remove(content.children[0]);
    geoState = null;
    if (A.sceneApi && A.sceneApi.current) A.sceneApi.current = null;
  }
  A.clearContent = clearContent;

  var EDGE_COLOR = 0x39506f;
  var EDGE_HL = 0xff8a3d;

  function loadShape(id) {
    clearContent();
    var build = SHAPES[id] || SHAPES.cube;
    var shape = build();
    autoOrient(shape.faces);
    unfoldPlan(shape.faces);

    var root = new THREE.Group();
    content.add(root);

    var faces = [];
    shape.faces.forEach(function (f) {
      var grp = new THREE.Group();
      var mesh = polyMesh(f.v, f.tri, f.color, 0.92);
      grp.add(mesh);
      // 要描的边：曲面（圆柱/圆锥）自己给 outline，多面体就是面的边界
      var pairs = f.outline
        ? f.outline.map(function (p) { return [p[0], p[1]]; })
        : f.v.map(function (_, i) { return [i, (i + 1) % f.v.length]; });
      var lines = pairs.map(function (pr) {
        var ln = seg(f.v[pr[0]], f.v[pr[1]], 0.028, EDGE_COLOR, 1);
        grp.add(ln);
        return ln;
      });
      // 展开后的顶点（平面多面体用刚体矩阵，曲面用给定坐标）
      var un = [];
      if (f.unfolded) {
        f.unfolded.forEach(function (p) { un.push(p.clone()); });
      } else {
        for (var k = 0; k < f.v.length; k++) un.push(f.v[k].clone().applyMatrix4(f.unfoldM));
      }
      // 网图整体放平到 y ≈ 0 附近（基准面不动，其它面可能在不同高度）
      root.add(grp);
      faces.push({
        id: f.id, group: grp, mesh: mesh, lines: lines, pairs: pairs,
        base: f.v.map(function (p) { return p.clone(); }),
        unfolded: un, soft: !!f.unfolded, unfoldM: f.unfoldM,
        edgeIds: f.edgeIds || [], tri: f.tri, color: f.color
      });
    });

    var labels = [];
    (shape.labels || []).forEach(function (l) {
      var sp = label(l.t, { color: '#2b3f5c', size: 40, worldH: 0.46 });
      sp.position.copy(l.p).add(V(0, 0.16, 0));
      sp.userData.text = l.t;
      root.add(sp);
      labels.push(sp);
    });

    geoState = {
      shapeId: shape.id, shapeName: shape.name, root: root, faces: faces, labels: labels,
      unfoldT: 0, highlight: null, projMode: 'oblique', meshes: faces.map(function (f) { return f.mesh; })
    };
    // 展开图整体居中：把网图平移到原点附近
    centerNet();
    applyUnfold(0);
    fitShape();
    setLayout('split');
    notify({ ev: 'geo', state: 'shape', shape: shape.id, name: shape.name });
  }
  A.loadShape = loadShape;

  function centerNet() {
    if (!geoState) return;
    var box = new THREE.Box3();
    geoState.faces.forEach(function (f) {
      f.unfolded.forEach(function (p) { box.expandByPoint(p); });
    });
    var c = box.getCenter(new THREE.Vector3());
    geoState.faces.forEach(function (f) {
      f.unfolded.forEach(function (p) { p.y -= c.y; });
    });
  }

  /** 展开进度 t：0 = 立体，1 = 完全摊平 */
  function applyUnfold(t) {
    if (!geoState) return;
    geoState.unfoldT = t;
    geoState.faces.forEach(function (f) {
      if (f.soft || !f.unfolded) {
        // 曲面：顶点级插值
        var pos = f.mesh.geometry.attributes.position;
        var arr = pos.array;
        for (var i = 0; i < f.base.length; i++) {
          var p = f.base[i].clone().lerp(f.unfolded[i], t);
          arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z;
        }
        pos.needsUpdate = true;
        f.mesh.geometry.computeVertexNormals();
        // 轮廓线跟着顶点一起走
        for (var k = 0; k < f.pairs.length; k++) {
          var pa = f.base[f.pairs[k][0]].clone().lerp(f.unfolded[f.pairs[k][0]], t);
          var pb = f.base[f.pairs[k][1]].clone().lerp(f.unfolded[f.pairs[k][1]], t);
          placeSeg(f.lines[k], pa, pb);
        }
        return;
      }
      // 平面：刚体变换（位置 lerp + 四元数 slerp）
      var m = new THREE.Matrix4();
      var p0 = new THREE.Vector3(), q0 = new THREE.Quaternion(), s0 = new THREE.Vector3();
      var p1 = new THREE.Vector3(), q1 = new THREE.Quaternion(), s1 = new THREE.Vector3();
      f.unfoldM.decompose(p1, q1, s1);
      p0.set(0, 0, 0); q0.identity(); s0.set(1, 1, 1);
      if (t <= 0) {
        f.group.position.set(0, 0, 0);
        f.group.quaternion.identity();
        f.group.scale.set(1, 1, 1);
      } else {
        var q = q0.slerp(q1, t);
        f.group.quaternion.copy(q);
        f.group.position.copy(p0.clone().lerp(p1, t));
        f.group.scale.copy(s0.clone().lerp(s1, t));
      }
      m.identity();
    });
    // 展开时藏掉顶点标签（网图里顶点会分裂，标注会重影）
    if (geoState.labels) {
      geoState.labels.forEach(function (sp) { sp.visible = t < 0.06; });
    }
  }
  A.applyUnfold = applyUnfold;

  function placeSeg(mesh, a, b) {
    var dir = new THREE.Vector3().subVectors(b, a);
    var len = dir.length();
    if (len < 1e-6) return;
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
    mesh.scale.set(1, len / Math.max(1e-6, mesh.userData.baseLen || len), 1);
    if (!mesh.userData.baseLen) mesh.userData.baseLen = len;
  }

  function animateUnfold(to, dur) {
    if (!geoState) return;
    var from = geoState.unfoldT;
    var f = function (p) { applyUnfold(lerp(from, to, p)); };
    f.tag = 'unfold';
    tween(dur || 1.1, f);
  }
  A.animateUnfold = animateUnfold;

  function fitShape() {
    var box = new THREE.Box3().setFromObject(content);
    var c = box.getCenter(new THREE.Vector3());
    var size = box.getSize(new THREE.Vector3());
    var r = Math.max(size.x, size.y, size.z) * 0.5 || 1;
    camState.target.set(0, c.y, 0);
    camState.dist = clamp(r * 3.1, 4.5, 18);
    applyCam();
  }
  A.fitShape = fitShape;

  /* ---------------- 2D 投影（斜二测 / 正等测） ---------------- */
  /* 投影函数 f 与其“投影方向” dir：沿 dir 移动点，投影不变（平行投影的定义）。
   * 判断遮挡时沿 -dir（朝观察者）发射线，先撞到别的面就是被挡住的棱。 */
  function projFn(mode) {
    if (mode === 'isometric') {
      var c30 = Math.cos(Math.PI / 6), s30 = Math.sin(Math.PI / 6);
      return {
        f: function (p) { return { x: (p.x - p.z) * c30, y: p.y + (p.x + p.z) * s30 }; },
        dir: V(1, -1, 1).normalize()
      };
    }
    var k = 0.5 * Math.SQRT1_2;
    return {
      f: function (p) { return { x: p.x - p.z * k, y: p.y - p.z * k }; },
      dir: V(k, k, 1).normalize()
    };
  }

  var raycaster = new THREE.Raycaster();

  function worldFacePoints(f) {
    var out = [];
    var pos = f.mesh.geometry.attributes.position;
    f.mesh.updateWorldMatrix(true, false);
    for (var i = 0; i < pos.count; i++) {
      out.push(V(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(f.mesh.matrixWorld));
    }
    return out;
  }

  /** 判断某点是否被遮挡：沿“看向观察者”的方向射线，命中别的面即为遮挡 */
  function occluded(p, dir, meshes) {
    raycaster.set(p.clone().add(dir.clone().multiplyScalar(0.02)), dir);
    var hits = raycaster.intersectObjects(meshes, false);
    for (var i = 0; i < hits.length; i++) {
      if (hits[i].distance > 0.03) return true;
    }
    return false;
  }

  var projCache = { segs: [], mode: '' };

  function drawProjection() {
    if (!ctx2 || !canvas2 || layout !== 'split') return;
    var w = canvas2.clientWidth, h = canvas2.clientHeight;
    ctx2.clearRect(0, 0, w, h);
    ctx2.fillStyle = 'rgba(255,255,255,0.55)';
    ctx2.fillRect(0, 0, w, h);
    if (!geoState) {
      ctx2.fillStyle = '#93a6c0';
      ctx2.font = '13px -apple-system, "PingFang SC", sans-serif';
      ctx2.textAlign = 'center';
      ctx2.fillText('拖动上方立体，这里会同步画出它的平面直观图', w / 2, h / 2);
      return;
    }
    var mode = geoState.projMode;
    var P = projFn(mode);
    var meshes = geoState.meshes;
    var facePts = geoState.faces.map(function (f) { return worldFacePoints(f); });

    // 收集投影点，计算包围盒 → 自适应缩放
    var xs = [], ys = [];
    facePts.forEach(function (pts) {
      pts.forEach(function (p) { var q = P.f(p); xs.push(q.x); ys.push(q.y); });
    });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var pad = 34;
    var sc = Math.min((w - pad * 2) / Math.max(1e-6, maxX - minX), (h - pad * 2) / Math.max(1e-6, maxY - minY));
    var ox = (w - (maxX - minX) * sc) / 2 - minX * sc;
    var oy = (h - (maxY - minY) * sc) / 2 + maxY * sc;
    function S(p) { var q = P.f(p); return { x: ox + q.x * sc, y: oy - q.y * sc }; }

    // 面填充（按面心沿视线方向的深度排序，远的先画）
    var order = [];
    geoState.faces.forEach(function (f, i) {
      var c = new THREE.Vector3();
      facePts[i].forEach(function (p) { c.add(p); });
      c.multiplyScalar(1 / facePts[i].length);
      order.push({ i: i, d: c.dot(P.dir) });
    });
    order.sort(function (a, b) { return a.d - b.d; });
    order.forEach(function (o) {
      var f = geoState.faces[o.i];
      var pts = facePts[o.i].map(S);
      if (pts.length < 3) return;
      ctx2.fillStyle = 'rgba(226,238,252,0.78)';
      if (f.tri) {
        // 曲面：按三角条带填充，不能直接把采样点连成多边形
        f.tri.forEach(function (t) {
          ctx2.beginPath();
          ctx2.moveTo(pts[t[0]].x, pts[t[0]].y);
          ctx2.lineTo(pts[t[1]].x, pts[t[1]].y);
          ctx2.lineTo(pts[t[2]].x, pts[t[2]].y);
          ctx2.closePath();
          ctx2.fill();
        });
        return;
      }
      ctx2.beginPath();
      ctx2.moveTo(pts[0].x, pts[0].y);
      for (var i = 1; i < pts.length; i++) ctx2.lineTo(pts[i].x, pts[i].y);
      ctx2.closePath();
      ctx2.fill();
    });

    // 棱：可见 = 实线，被遮挡 = 虚线
    var segs = [];
    var seen = {};
    var unfolded = geoState.unfoldT > 0.02;
    geoState.faces.forEach(function (f, fi) {
      var pts = facePts[fi];
      f.pairs.forEach(function (pr, i) {
        var a3 = pts[pr[0]], b3 = pts[pr[1]];
        var eid = f.edgeIds && f.edgeIds[i] ? f.edgeIds[i] : (f.id + '#' + i);
        // 立体状态下共享棱只画一次；摊开后每个面各自一份（网图里棱被切开）
        var dupKey = unfolded ? (eid + '|' + f.id) : eid;
        if (seen[dupKey]) return;
        seen[dupKey] = true;
        var mid = a3.clone().add(b3).multiplyScalar(0.5);
        var hidden = occluded(mid, P.dir.clone().multiplyScalar(-1), meshes);
        var hl = geoState.highlight && geoState.highlight.indexOf(eid) >= 0;
        var sa = S(a3), sb = S(b3);
        segs.push({ a: sa, b: sb, hidden: hidden, id: eid, hl: hl });
        ctx2.save();
        ctx2.beginPath();
        ctx2.moveTo(sa.x, sa.y);
        ctx2.lineTo(sb.x, sb.y);
        if (hl) {
          ctx2.strokeStyle = '#ff8a3d';
          ctx2.lineWidth = 4.5;
          ctx2.setLineDash([]);
        } else if (hidden) {
          ctx2.strokeStyle = '#9db0c8';
          ctx2.lineWidth = 1.6;
          ctx2.setLineDash([5, 5]);
        } else {
          ctx2.strokeStyle = '#2f4a6d';
          ctx2.lineWidth = 2.4;
          ctx2.setLineDash([]);
        }
        ctx2.stroke();
        ctx2.restore();
      });
    });

    // 顶点标签
    if (geoState.unfoldT < 0.06 && geoState.labels) {
      ctx2.fillStyle = '#31425f';
      ctx2.font = '600 12px -apple-system, "PingFang SC", sans-serif';
      ctx2.textAlign = 'center';
      geoState.labels.forEach(function (sp) {
        var wp = sp.position.clone().applyMatrix4(content.matrixWorld).applyMatrix4(model.matrixWorld);
        var s = S(wp);
        ctx2.fillText(sp.userData.text || '', s.x, s.y - 8);
      });
    }

    projCache.segs = segs;
    projCache.mode = mode;
  }
  A.drawProjection = drawProjection;

  // 2D 图点击 → 高亮 3D 对应棱
  if (canvas2) {
    canvas2.addEventListener('pointerdown', function (e) {
      if (!geoState || !projCache.segs.length) return;
      var r = canvas2.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      var best = null, bd = 12;
      projCache.segs.forEach(function (s) {
        var d = distToSeg(x, y, s.a.x, s.a.y, s.b.x, s.b.y);
        if (d < bd) { bd = d; best = s; }
      });
      if (best) {
        setHighlight([best.id], true);
        notify({ ev: 'pick', source: '2d', id: best.id, hidden: best.hidden });
      }
    });
    function distToSeg(px, py, x1, y1, x2, y2) {
      var dx = x2 - x1, dy = y2 - y1;
      var l2 = dx * dx + dy * dy;
      if (l2 < 1e-6) return Math.hypot(px - x1, py - y1);
      var t = clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
      return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    }
  }

  // 3D 点击棱 → 高亮（用细圆柱拾取）
  var pickRay = new THREE.Raycaster();
  canvas3.addEventListener('click', function (e) {
    if (!geoState) return;
    var r = canvas3.getBoundingClientRect();
    var nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    var ny = -((e.clientY - r.top) / r.height) * 2 + 1;
    pickRay.setFromCamera({ x: nx, y: ny }, camera);
    var targets = [];
    geoState.faces.forEach(function (f) { f.lines.forEach(function (l) { targets.push(l); }); });
    var hits = pickRay.intersectObjects(targets, false);
    if (hits.length) {
      var obj = hits[0].object;
      for (var fi = 0; fi < geoState.faces.length; fi++) {
        var f = geoState.faces[fi];
        var i = f.lines.indexOf(obj);
        if (i >= 0) {
          var eid = f.edgeIds && f.edgeIds[i] ? f.edgeIds[i] : f.id + '#' + i;
          setHighlight([eid], true);
          notify({ ev: 'pick', source: '3d', id: eid });
          return;
        }
      }
    }
  });

  var flashT = 0;
  function setHighlight(ids, flash) {
    if (!geoState) return;
    geoState.highlight = ids || null;
    geoState.flash = !!flash;
    flashT = flash ? 0 : -1;
    geoState.faces.forEach(function (f) {
      f.lines.forEach(function (ln, i) {
        var eid = f.edgeIds && f.edgeIds[i] ? f.edgeIds[i] : null;
        var on = ids && eid && ids.indexOf(eid) >= 0;
        ln.material.color.setHex(on ? EDGE_HL : EDGE_COLOR);
        ln.scale.set(on ? 1.9 : 1, ln.scale.y, on ? 1.9 : 1);
      });
    });
    drawProjection();
  }
  A.setHighlight = setHighlight;

  /* ---------------- 主循环 ---------------- */
  var clock = new THREE.Clock();
  function loop() {
    var dt = Math.min(0.05, clock.getDelta());
    stepTweens(dt);
    if (geoState && geoState.flash && geoState.highlight) {
      flashT += dt;
      var k = 0.55 + 0.45 * Math.sin(flashT * 9);
      geoState.faces.forEach(function (f) {
        f.lines.forEach(function (ln, i) {
          var eid = f.edgeIds && f.edgeIds[i] ? f.edgeIds[i] : null;
          if (eid && geoState.highlight.indexOf(eid) >= 0) {
            ln.material.color.setHex(EDGE_HL);
            ln.material.opacity = k;
            ln.material.transparent = true;
          }
        });
      });
    }
    // 模型旋转后投影要重画（旋转是通过 root 的子级 matrixWorld 生效的）
    content.updateMatrixWorld(true);
    model.updateMatrixWorld(true);
    renderer.render(scene, camera);
    if (layout === 'split' && geoState) drawProjection();
    requestAnimationFrame(loop);
  }

  /* ---------------- 命令 ---------------- */
  function handleCommand(msg) {
    var m = msg;
    if (typeof m === 'string') {
      try { m = JSON.parse(m); } catch (e) { return; }
    }
    if (!m || m.cmd !== 'geo') return;
    var act = m.action;

    if (act === 'shape') {
      setLayout(m.layout || 'split');
      loadShape(m.shape);
      if (m.proj) geoState && (geoState.projMode = m.proj);
    } else if (act === 'proj') {
      if (geoState) { geoState.projMode = m.mode === 'isometric' ? 'isometric' : 'oblique'; drawProjection(); }
    } else if (act === 'unfold') {
      if (m.animate) animateUnfold(clamp(m.t !== undefined ? m.t : (geoState && geoState.unfoldT > 0.5 ? 0 : 1), 0, 1), m.dur);
      else if (m.t !== undefined) applyUnfold(clamp(m.t, 0, 1));
    } else if (act === 'highlight') {
      setHighlight(m.ids || null, !!m.flash);
    } else if (act === 'layout') {
      setLayout(m.mode);
    } else if (act === 'view') {
      if (m.yaw !== undefined) rot.yaw = m.yaw;
      if (m.pitch !== undefined) rot.pitch = m.pitch;
      if (m.resetView) { camState.target.set(0, camState.target.y, 0); fitShape(); }
      applyCam();
    } else if (act === 'scene') {
      runScene(m.id, m.step || 1, !!m.counter, m);
    } else if (act === 'reset') {
      rot.yaw = -0.62; rot.pitch = 0.36;
      applyCam();
    }
  }
  A.handleCommand = handleCommand;

  /* 场景（定理 / 空间角 / 体积）由 scenes.js 注册 */
  A.sceneApi = { registry: {}, current: null };
  function runScene(id, step, counter, msg) {
    msg = msg || {};
    var reg = A.sceneApi.registry[id];
    if (!reg) { hint('未找到场景：' + id); return; }
    setLayout(reg.layout || 'full');
    var sig = id + '|' + (counter ? 1 : 0) + '|' + (msg.variant || '');
    var cur = A.sceneApi.current;
    if (!cur || cur.sig !== sig) {
      clearContent();
      var ctx = {
        root: content, add: function (o) { content.add(o); return o; },
        counter: counter, step: step, msg: msg,
        A: A
      };
      cur = A.sceneApi.current = { id: id, sig: sig, ctx: ctx, step: -1, counter: counter };
      reg.build(ctx);
      fitScene();
    } else {
      cur.ctx.msg = msg;
      cur.ctx.counter = counter;
    }
    if (cur.step !== step || cur.counter !== counter) {
      cur.step = step;
      cur.counter = counter;
      reg.setStep(cur.ctx, step, counter);
    }
    if (reg.onParam) reg.onParam(cur.ctx, msg);
    notify({ ev: 'scene', id: id, step: step, counter: counter });
  }
  A.runScene = runScene;

  function fitScene() {
    var box = new THREE.Box3().setFromObject(content);
    var c = box.getCenter(new THREE.Vector3());
    var size = box.getSize(new THREE.Vector3());
    var r = Math.max(size.x, size.y, size.z) * 0.5 || 1;
    camState.target.set(c.x, c.y, c.z);
    camState.dist = clamp(r * 2.9, 4.5, 20);
    rot.yaw = -0.62; rot.pitch = 0.34;
    applyCam();
  }
  A.fitScene = fitScene;

  /* 调试口：headless 冒烟测试时读取引擎状态 */
  A.debug = function () {
    return {
      shape: geoState ? geoState.shapeId : null,
      faces: geoState ? geoState.faces.length : 0,
      unfoldT: geoState ? geoState.unfoldT : -1,
      scene: A.sceneApi.current ? A.sceneApi.current.id : null,
      step: A.sceneApi.current ? A.sceneApi.current.step : -1,
      counter: A.sceneApi.current ? !!A.sceneApi.current.counter : false,
      objects: content.children.length,
      projSegs: projCache.segs.length,
      tris: renderer.info.render.triangles,
      layout: layout,
      rot: { yaw: +rot.yaw.toFixed(3), pitch: +rot.pitch.toFixed(3) },
      segsSample: projCache.segs.slice(0, 3).map(function (s) {
        return { id: s.id, x: Math.round((s.a.x + s.b.x) / 2), y: Math.round((s.a.y + s.b.y) / 2) };
      })
    };
  };

  /* ---------------- 启动 ---------------- */
  window.addEventListener('message', function (e) { handleCommand(e.data); });
  window.__dispatch = handleCommand;

  applyCam();
  resize();
  loop();
  if (boot) boot.style.display = 'none';
  notify({ ev: 'ready', ok: true });
  // 形状模式下默认载入正方体，保证首屏有内容
  setTimeout(function () {
    if (!geoState && !A.sceneApi.current) loadShape('cube');
  }, 60);
})();
