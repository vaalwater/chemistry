/* =========================================================================
 * 物理 · 电磁学引擎（three.js）
 * -------------------------------------------------------------------------
 * 宿主：engine/phys/index.template.html（打包进 src/engine/physicsHtml.ts）
 * 命令：window.__dispatch({cmd:'phys', ...})；宿主也用 postMessage 下发
 * 事件：notify({ev:'ready'|'probe'|'pick'|'scene'|'tick', ...})
 *
 * 三大能力：
 *   1) 场可视化：场线（CPU 追踪）+ 流光粒子（GPU Points）+ 等势面/等值切片（GLSL）
 *   2) 场强探针：空间中任意点插针，实时读出场强大小 / 方向 / 电势
 *   3) 演示场景：三方向定则、电磁感应、交流电波形（2D canvas 图表）
 * ========================================================================= */
(function () {
  'use strict';

  var A = (window.PHYS = window.PHYS || {});
  A.fieldApi = { registry: {} };
  A.sceneApi = { registry: {} };

  /* ---------------------------------------------------------------- DOM */
  var host = document.getElementById('view3d');
  var panelEl = document.getElementById('panel2d');
  var chart = document.getElementById('chart2d');
  var ctx2 = chart && chart.getContext ? chart.getContext('2d') : null;
  var hintBox = document.getElementById('hint');
  var hintText = document.getElementById('hintText');
  var errBox = document.getElementById('errMsg');
  var hudEl = document.getElementById('probeHud');
  var bootEl = document.getElementById('boot');

  /* -------------------------------------------------------------- 工具 */
  function V(x, y, z) { return new THREE.Vector3(x, y, z); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(a, b, x) {
    var t = clamp((x - a) / (b - a || 1e-6), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function notify(obj) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(obj));
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(obj, '*');
      }
    } catch (e) { /* noop */ }
  }
  function hint(msg) {
    if (!hintBox || !hintText) return;
    if (!msg) { hintBox.classList.remove('show'); return; }
    hintText.textContent = msg;
    hintBox.classList.add('show');
    clearTimeout(hint._t);
    hint._t = setTimeout(function () { hintBox.classList.remove('show'); }, 2800);
  }
  function showErr(msg) {
    if (!errBox) return;
    errBox.textContent = msg;
    errBox.style.display = msg ? 'block' : 'none';
  }
  window.addEventListener('error', function (e) { showErr('引擎错误：' + (e.message || e)); });

  /** 颜色带：电场暖色（强=亮黄白 → 弱=品红），磁场冷色（强=青白 → 弱=深紫） */
  var RAMPS = {
    E: [[1.0, 0.96, 0.72], [1.0, 0.68, 0.22], [1.0, 0.36, 0.36], [0.72, 0.16, 0.55]],
    B: [[0.86, 1.0, 0.96], [0.18, 0.9, 1.0], [0.22, 0.48, 1.0], [0.48, 0.22, 0.98]],
  };
  /** t: 0 = 最弱，1 = 最强 */
  function ramp(tone, t) {
    var r = RAMPS[tone] || RAMPS.E;
    t = clamp(t, 0, 1) * (r.length - 1);
    var i = Math.min(Math.floor(t), r.length - 2), f = t - i;
    var a = r[i], b = r[i + 1];
    return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
  }
  function css(tone, t) {
    var c = ramp(tone, t);
    return 'rgb(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ')';
  }

  /* --------------------------------------------------- 公共素材（贴图） */
  function glowTexture() {
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var g = c.getContext('2d');
    var rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    rg.addColorStop(0.6, 'rgba(255,255,255,0.14)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 64, 64);
    var t = new THREE.CanvasTexture(c);
    return t;
  }
  var TEX_GLOW = null;

  function makeGlow(color, size, opacity) {
    if (!TEX_GLOW) TEX_GLOW = glowTexture();
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: TEX_GLOW, color: color, transparent: true, opacity: opacity == null ? 0.85 : opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sp.scale.set(size, size, 1);
    return sp;
  }

  function makeLabel(text, opt) {
    opt = opt || {};
    var fs = opt.size || 42;
    var c = document.createElement('canvas');
    var g = c.getContext('2d');
    g.font = '700 ' + fs + 'px -apple-system, "PingFang SC", sans-serif';
    var w = Math.ceil(g.measureText(text).width) + 24;
    c.width = w; c.height = Math.ceil(fs * 1.5);
    g = c.getContext('2d');
    g.font = '700 ' + fs + 'px -apple-system, "PingFang SC", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(6,12,26,0.55)';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = opt.color || '#eaf4ff';
    g.fillText(text, c.width / 2, c.height / 2 + 1);
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
    var h = opt.worldH || 0.42;
    sp.scale.set(h * (c.width / c.height), h, 1);
    return sp;
  }

  /** 有体积的箭头：圆柱杆 + 圆锥头，dir 为世界方向，从 from 出发长 len */
  function makeArrow(from, dir, len, color, radius) {
    radius = radius || 0.045;
    var g = new THREE.Group();
    var headLen = Math.min(0.3, len * 0.34);
    var bodyLen = Math.max(0.001, len - headLen);
    var mat = new THREE.MeshStandardMaterial({
      color: color, emissive: color, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.1,
    });
    var body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, bodyLen, 12), mat);
    body.position.y = bodyLen / 2;
    var head = new THREE.Mesh(new THREE.ConeGeometry(radius * 2.5, headLen, 14), mat);
    head.position.y = bodyLen + headLen / 2;
    g.add(body, head);
    g.position.copy(from);
    g.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
    g.userData.setVec = function (f, d, L) {
      var hl = Math.min(0.3, L * 0.34), bl = Math.max(0.001, L - hl);
      body.scale.y = bl / bodyLen;
      body.position.y = bl / 2;
      head.position.y = bl + hl / 2;
      head.scale.set(1, hl / headLen, 1);
      g.position.copy(f);
      g.quaternion.setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
    };
    return g;
  }

  function makeTube(points, radius, color, opacity) {
    var curve = new THREE.CatmullRomCurve3(points);
    var seg = Math.min(160, Math.max(12, points.length));
    var geo = new THREE.TubeGeometry(curve, seg, radius, 8, false);
    var mat = new THREE.MeshStandardMaterial({
      color: color, emissive: color, emissiveIntensity: 0.35,
      roughness: 0.4, metalness: 0.25, transparent: opacity < 1, opacity: opacity,
    });
    return new THREE.Mesh(geo, mat);
  }

  A.util = {
    V: V, clamp: clamp, lerp: lerp, smooth: smooth, ramp: ramp, css: css,
    hint: hint, notify: notify, glow: makeGlow, label: makeLabel, arrow: makeArrow, tube: makeTube,
  };
  A.notify = notify;
  A.hint = hint;

  /* ------------------------------------------------------- 渲染器 / 相机 */
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(46, 1, 0.08, 400);
  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0x93a9d6, 0.8));
  var dl1 = new THREE.DirectionalLight(0xffffff, 0.9); dl1.position.set(6, 9, 7); scene.add(dl1);
  var dl2 = new THREE.DirectionalLight(0x6fa8ff, 0.4); dl2.position.set(-7, -4, -6); scene.add(dl2);

  var cam = { theta: -0.62, phi: 1.12, dist: 9.6, target: V(0, 0, 0) };
  function applyCam() {
    cam.phi = clamp(cam.phi, 0.16, Math.PI - 0.16);
    cam.dist = clamp(cam.dist, 3.2, 30);
    var s = Math.sin(cam.phi), c = Math.cos(cam.phi);
    camera.position.set(
      cam.target.x + cam.dist * s * Math.sin(cam.theta),
      cam.target.y + cam.dist * c,
      cam.target.z + cam.dist * s * Math.cos(cam.theta)
    );
    camera.lookAt(cam.target);
  }

  /** 内容根节点：场内容 / 演示场景都挂在这里 */
  var root = new THREE.Group();
  scene.add(root);

  /* ------------------------------------------------------------ 背景星尘 */
  (function starDust() {
    var N = 420;
    var pos = new Float32Array(N * 3);
    var col = new Float32Array(N * 3);
    var siz = new Float32Array(N);
    for (var i = 0; i < N; i++) {
      var r = 16 + Math.random() * 22;
      var th = Math.random() * Math.PI * 2;
      var ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      var c = Math.random() < 0.3 ? 1 : 0.55;
      col[i * 3] = 0.45 * c; col[i * 3 + 1] = 0.6 * c; col[i * 3 + 2] = 1.0 * c;
      siz[i] = 0.06 + Math.random() * 0.08;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    var al = new Float32Array(N);
    for (var k = 0; k < N; k++) al[k] = 0.35 + Math.random() * 0.5;
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(al, 1));
    var mat = particleMaterial();
    var pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.userData.dust = true;
    scene.add(pts);
    A.dust = pts;
  })();

  /* -------------------------------------------------------- 粒子材质/系统 */
  function particleMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: { uH: { value: 700 } },
      vertexShader: [
        'attribute vec3 aColor;',
        'attribute float aSize;',
        'attribute float aAlpha;',
        'uniform float uH;',
        'varying vec3 vC;',
        'varying float vA;',
        'void main(){',
        '  vC = aColor; vA = aAlpha;',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  gl_PointSize = aSize * uH / max(-mv.z, 0.05);',
        '  gl_Position = projectionMatrix * mv;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vC;',
        'varying float vA;',
        'void main(){',
        '  vec2 d = gl_PointCoord - vec2(0.5);',
        '  float r = length(d) * 2.0;',
        '  if (r > 1.0) discard;',
        '  float core = pow(1.0 - r, 2.6);',
        '  float glow = pow(1.0 - r, 0.8) * 0.42;',
        '  float a = (core + glow) * vA;',
        '  gl_FragColor = vec4(vC * (core + glow * 1.2), a);',
        '}',
      ].join('\n'),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
  }

  var P_MAX = 2400;
  var pPos = new Float32Array(P_MAX * 3);
  var pCol = new Float32Array(P_MAX * 3);
  var pSize = new Float32Array(P_MAX);
  var pAlpha = new Float32Array(P_MAX);
  var pLine = new Int32Array(P_MAX);
  var pIdx = new Float32Array(P_MAX);
  var pSpd = new Float32Array(P_MAX);
  var pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute('aColor', new THREE.BufferAttribute(pCol, 3).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute('aAlpha', new THREE.BufferAttribute(pAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  var pMat = particleMaterial();
  var pPoints = new THREE.Points(pGeo, pMat);
  pPoints.frustumCulled = false;
  pPoints.visible = false;
  scene.add(pPoints);
  var pCount = 0;

  /** 场线缓存 */
  var fieldLines = [];   // [{ pts:[V], mags:[n], len:number }]
  var lineStep = 0.13;

  function assignParticles() {
    var total = 0, i;
    for (i = 0; i < fieldLines.length; i++) total += Math.max(fieldLines[i].len, 0.1);
    if (!total || !fieldLines.length) { pCount = 0; pPoints.visible = false; return; }
    // 按线长加权分配粒子，保证各线亮度一致
    var acc = [], s = 0;
    for (i = 0; i < fieldLines.length; i++) { s += Math.max(fieldLines[i].len, 0.1); acc.push(s / total); }
    for (i = 0; i < P_MAX; i++) {
      var r = Math.random();
      var li = 0;
      while (li < acc.length - 1 && acc[li] < r) li++;
      pLine[i] = li;
      pIdx[i] = Math.random() * (fieldLines[li].pts.length - 1);
      pSpd[i] = 12 + Math.random() * 16;
    }
    pCount = P_MAX;
    pPoints.visible = true;
    pGeo.setDrawRange(0, P_MAX);
  }

  var tmpV = new THREE.Vector3();
  function stepParticles(dt, tone, norm) {
    if (!pCount) return;
    var posAttr = pGeo.attributes.position, colAttr = pGeo.attributes.aColor;
    var sizeAttr = pGeo.attributes.aSize, alAttr = pGeo.attributes.aAlpha;
    for (var i = 0; i < pCount; i++) {
      var li = pLine[i];
      var L = fieldLines[li];
      if (!L) continue;
      var n = L.pts.length;
      pIdx[i] += pSpd[i] * dt;
      if (pIdx[i] >= n - 1) pIdx[i] -= (n - 1);
      var i0 = Math.floor(pIdx[i]);
      var f = pIdx[i] - i0;
      var a = L.pts[i0], b = L.pts[Math.min(i0 + 1, n - 1)];
      tmpV.copy(a).lerp(b, f);
      pPos[i * 3] = tmpV.x; pPos[i * 3 + 1] = tmpV.y; pPos[i * 3 + 2] = tmpV.z;
      var m = lerp(L.mags[i0], L.mags[Math.min(i0 + 1, n - 1)], f);
      var t = clamp(Math.pow(m / norm, 0.42), 0, 1);
      var c = ramp(tone, t);
      pCol[i * 3] = c[0]; pCol[i * 3 + 1] = c[1]; pCol[i * 3 + 2] = c[2];
      var s01 = pIdx[i] / (n - 1);
      var fade = smooth(0, 0.07, s01) * smooth(1, 0.9, s01);
      pAlpha[i] = (0.35 + 0.65 * t) * fade;
      pSize[i] = 0.055 + 0.075 * t;
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    alAttr.needsUpdate = true;
  }

  /* -------------------------------------------------------------- 场线绘制 */
  var lineMat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  var lineMesh = null;

  function drawFieldLines(tone, norm) {
    if (lineMesh) { root.remove(lineMesh); lineMesh.geometry.dispose(); lineMesh = null; }
    var segs = 0, i, k;
    for (i = 0; i < fieldLines.length; i++) segs += Math.max(fieldLines[i].pts.length - 1, 0);
    if (!segs) return;
    var pos = new Float32Array(segs * 6);
    var col = new Float32Array(segs * 6);
    var o = 0;
    for (i = 0; i < fieldLines.length; i++) {
      var L = fieldLines[i], pts = L.pts, n = pts.length;
      for (k = 0; k < n - 1; k++) {
        var p = pts[k], q = pts[k + 1];
        pos[o] = p.x; pos[o + 1] = p.y; pos[o + 2] = p.z;
        pos[o + 3] = q.x; pos[o + 4] = q.y; pos[o + 5] = q.z;
        var t1 = clamp(Math.pow(L.mags[k] / norm, 0.42), 0, 1);
        var t2 = clamp(Math.pow(L.mags[k + 1] / norm, 0.42), 0, 1);
        var c1 = ramp(tone, t1), c2 = ramp(tone, t2);
        col[o] = c1[0] * 0.75; col[o + 1] = c1[1] * 0.75; col[o + 2] = c1[2] * 0.75;
        col[o + 3] = c2[0] * 0.75; col[o + 4] = c2[1] * 0.75; col[o + 5] = c2[2] * 0.75;
        o += 6;
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    lineMesh = new THREE.LineSegments(geo, lineMat);
    lineMesh.frustumCulled = false;
    root.add(lineMesh);
  }

  /* --------------------------------------------------- 等势面 / 等值切片 */
  var equiMesh = null;
  function clearEqui() {
    if (equiMesh) { root.remove(equiMesh); if (equiMesh.geometry) equiMesh.geometry.dispose(); equiMesh = null; }
  }

  var EQUIVS = [
    'varying vec3 vPos;',
    'void main(){',
    '  vPos = (modelMatrix * vec4(position, 1.0)).xyz;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}',
  ].join('\n');

  var EQUIFS = [
    'precision highp float;',
    'varying vec3 vPos;',
    'uniform vec3 uCam;',
    'uniform vec3 uBmin;',
    'uniform vec3 uBmax;',
    'uniform vec3 uSrc[4];',
    'uniform float uQ[4];',
    'uniform int uSrcN;',
    'uniform float uVals[4];',
    'uniform vec3 uCols[4];',
    'uniform int uValN;',
    'uniform float uStep;',
    'uniform int uSteps;',
    'uniform float uOpacity;',
    'float potAt(vec3 p){ @@POT@@ }',
    'vec3 gradAt(vec3 p){',
    '  float e = 0.05;',
    '  return vec3(potAt(p + vec3(e,0.0,0.0)) - potAt(p - vec3(e,0.0,0.0)),',
    '               potAt(p + vec3(0.0,e,0.0)) - potAt(p - vec3(0.0,e,0.0)),',
    '               potAt(p + vec3(0.0,0.0,e)) - potAt(p - vec3(0.0,0.0,e)));',
    '}',
    'void main(){',
    '  vec3 rd = normalize(vPos - uCam);',
    '  vec3 inv = 1.0 / rd;',
    '  vec3 t0 = (uBmin - uCam) * inv;',
    '  vec3 t1 = (uBmax - uCam) * inv;',
    '  vec3 tA = min(t0, t1);',
    '  vec3 tB = max(t0, t1);',
    '  float tn = max(max(tA.x, tA.y), tA.z);',
    '  float tf = min(min(tB.x, tB.y), tB.z);',
    '  tn = max(tn, 0.0);',
    '  if (tf <= tn) discard;',
    '  vec3 col = vec3(0.0);',
    '  float acc = 0.0;',
    '  float t = tn;',
    '  float prev = potAt(uCam + rd * tn);',
    '  for (int i = 0; i < 110; i++) {',
    '    if (i >= uSteps || t > tf || acc > 0.985) break;',
    '    float nt = t + uStep;',
    '    float cur = potAt(uCam + rd * nt);',
    '    for (int k = 0; k < 4; k++) {',
    '      if (k >= uValN) break;',
    '      float da = prev - uVals[k];',
    '      float db = cur - uVals[k];',
    '      if (da * db < 0.0) {',
    '        float lo = t, hi = nt;',
    '        for (int j = 0; j < 5; j++) {',
    '          float mid = (lo + hi) * 0.5;',
    '          float vm = potAt(uCam + rd * mid) - uVals[k];',
    '          if (da * vm < 0.0) hi = mid; else lo = mid;',
    '        }',
    '        vec3 p = uCam + rd * ((lo + hi) * 0.5);',
    '        vec3 N = normalize(gradAt(p) + vec3(1e-5));',
    '        if (dot(N, rd) > 0.0) N = -N;',
    '        vec3 Ld = normalize(vec3(0.5, 0.85, 0.55));',
    '        float dif = 0.35 + 0.65 * abs(dot(N, Ld));',
    '        float rim = pow(1.0 - abs(dot(N, rd)), 2.2);',
    '        vec3 cc = uCols[k] * (dif + rim * 1.25);',
    '        float al = uOpacity * (0.26 + 0.74 * rim);',
    '        col += cc * al * (1.0 - acc);',
    '        acc += al * (1.0 - acc);',
    '      }',
    '    }',
    '    prev = cur; t = nt;',
    '  }',
    '  if (acc < 0.004) discard;',
    '  gl_FragColor = vec4(col, acc);',
    '}',
  ].join('\n');

  /** 默认的「势」= 点电荷系电势 Σ qᵢ/rᵢ（场可自定义 pot 覆盖，如匀强电场 -y、直导线 1/ρ） */
  var DEFAULT_POT = [
    'float s = 0.0;',
    'for (int i = 0; i < 4; i++) {',
    '  if (i >= uSrcN) break;',
    '  s += uQ[i] / max(length(p - uSrc[i]), 0.12);',
    '}',
    'return s;',
  ].join('\n');

  var SLICEFS = [
    'precision highp float;',
    'varying vec3 vPos;',
    'uniform float uRef;',
    'uniform float uOpacity;',
    'uniform float uTime;',
    'uniform vec3 uTint;',
    'float magAt(vec3 p){ @@MAG@@ }',
    'vec3 rampc(float u){',
    '  vec3 c0 = vec3(0.06, 0.10, 0.28);',
    '  vec3 c1 = vec3(0.12, 0.55, 0.95);',
    '  vec3 c2 = vec3(0.25, 0.95, 0.98);',
    '  vec3 c3 = vec3(0.95, 0.98, 0.85);',
    '  if (u < 0.34) return mix(c0, c1, u / 0.34);',
    '  if (u < 0.68) return mix(c1, c2, (u - 0.34) / 0.34);',
    '  return mix(c2, c3, clamp((u - 0.68) / 0.32, 0.0, 1.0));',
    '}',
    'void main(){',
    '  float m = magAt(vPos);',
    '  float u = clamp(pow(m / uRef, 0.40), 0.0, 1.0);',
    '  vec3 c = rampc(u) * uTint;',
    '  float lv = log(m / uRef + 1e-4);',
    '  float st = fract(lv * 1.9 + uTime * 0.04);',
    '  float ln = smoothstep(0.90, 1.0, max(st, 1.0 - st));',
    '  c += vec3(0.85, 0.95, 1.0) * ln * 0.55;',
    '  gl_FragColor = vec4(c, uOpacity * (0.18 + 0.82 * u) + ln * 0.45);',
    '}',
  ].join('\n');

  /** 传入的是 spec.gpu（等势面 / 切片配置） */
  function buildEqui(gpu) {
    clearEqui();
    if (!gpu) return;
    var g = gpu;
    if (g.kind === 'raymarch') {
      var bmin = g.box ? V(g.box[0], g.box[1], g.box[2]) : V(-5.4, -4.2, -5.4);
      var bmax = g.box ? V(g.box[3], g.box[4], g.box[5]) : V(5.4, 4.2, 5.4);
      var size = bmax.clone().sub(bmin);
      var geo = new THREE.BoxGeometry(size.x, size.y, size.z);
      var uni = {
        uCam: { value: new THREE.Vector3() },
        uBmin: { value: bmin },
        uBmax: { value: bmax },
        uSrc: { value: [V(0, 0, 0), V(0, 0, 0), V(0, 0, 0), V(0, 0, 0)] },
        uQ: { value: [0, 0, 0, 0] },
        uSrcN: { value: 0 },
        uVals: { value: [0, 0, 0, 0] },
        uCols: { value: [V(1, 1, 1), V(1, 1, 1), V(1, 1, 1), V(1, 1, 1)] },
        uValN: { value: 0 },
        uStep: { value: g.step || 0.14 },
        uSteps: { value: g.steps || 78 },
        uOpacity: { value: g.opacity == null ? 0.55 : g.opacity },
      };
      var srcs = g.srcs || [];
      for (var i = 0; i < Math.min(4, srcs.length); i++) {
        uni.uSrc.value[i] = V(srcs[i].p[0], srcs[i].p[1], srcs[i].p[2]);
        uni.uQ.value[i] = srcs[i].q;
      }
      uni.uSrcN.value = Math.min(4, srcs.length);
      var vals = g.vals || [];
      for (var k = 0; k < Math.min(4, vals.length); k++) {
        uni.uVals.value[k] = vals[k];
        var c = (g.cols && g.cols[k]) || [0.4, 0.8, 1];
        uni.uCols.value[k] = V(c[0], c[1], c[2]);
      }
      uni.uValN.value = Math.min(4, vals.length);
      var mat = new THREE.ShaderMaterial({
        uniforms: uni, vertexShader: EQUIVS,
        fragmentShader: g.fs || EQUIFS.replace('@@POT@@', function () { return g.pot || DEFAULT_POT; }),
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(bmin).add(bmax).multiplyScalar(0.5);
      mesh.renderOrder = 3;
      mesh.frustumCulled = false;
      equiMesh = mesh;
      root.add(mesh);
    } else if (g.kind === 'slice') {
      var grp = new THREE.Group();
      var planes = g.planes || [
        { axis: 'y', at: 0, w: 9, h: 9 },
        { axis: 'z', at: 0, w: 9, h: 6 },
      ];
      for (var p = 0; p < planes.length; p++) {
        var pl = planes[p];
        var pg = new THREE.PlaneGeometry(pl.w, pl.h, 1, 1);
        var pm = new THREE.ShaderMaterial({
          uniforms: {
            uRef: { value: g.ref || 1 },
            uOpacity: { value: g.opacity == null ? 0.85 : g.opacity },
            uTime: { value: 0 },
            uTint: { value: V(1, 1, 1) },
          },
          vertexShader: EQUIVS,
          fragmentShader: SLICEFS.replace('@@MAG@@', g.mag || 'return 1.0;'),
          transparent: true, depthWrite: false, side: THREE.DoubleSide,
          blending: THREE.NormalBlending,
        });
        var pm2 = new THREE.Mesh(pg, pm);
        if (pl.axis === 'y') pm2.rotation.x = -Math.PI / 2;
        else if (pl.axis === 'x') pm2.rotation.y = Math.PI / 2;
        pm2.position.set(pl.axis === 'x' ? pl.at : 0, pl.axis === 'y' ? pl.at : 0, pl.axis === 'z' ? pl.at : 0);
        pm2.renderOrder = 2;
        grp.add(pm2);
      }
      grp.userData.sliceMats = grp.children.map(function (c) { return c.material; });
      equiMesh = grp;
      root.add(grp);
    }
  }

  /* --------------------------------------------------------------- 场状态 */
  var fState = {
    spec: null, id: null, mode: 'sum', view: 'lines',
    tone: 'E', norm: 1, probe: null, probeOn: false,
  };

  function clearRoot() {
    var i;
    for (i = root.children.length - 1; i >= 0; i--) {
      var c = root.children[i];
      root.remove(c);
      if (c.geometry) c.geometry.dispose();
    }
    // 探针对象若也在 root 里，已随之被移除：置空，下次 addProbe 才会重新建
    if (probeObj) { probeObj = null; probeArrow = null; probeCore = null; probeGlow = null; }
    clearEqui();
    if (lineMesh) { lineMesh.geometry.dispose(); lineMesh = null; }
    fieldLines = [];
    pCount = 0;
    pPoints.visible = false;
  }

  /** 沿场方向追踪一条场线 */
  function traceLine(start, sign, spec, opt) {
    var pts = [], mags = [];
    var p = start.clone();
    var h = spec.step || 0.13;
    var maxSteps = spec.maxSteps || 230;
    var R = spec.domain || 6;
    var f = new THREE.Vector3(), f2 = new THREE.Vector3(), mid = new THREE.Vector3();
    for (var i = 0; i < maxSteps; i++) {
      spec.field(p, opt, f);
      var m = f.length();
      if (!isFinite(m) || m < 1e-8) break;
      pts.push(p.clone());
      mags.push(m);
      if (spec.stop && spec.stop(p)) break;
      if (p.length() > R) break;
      var d = f.multiplyScalar(sign / m);
      mid.copy(p).addScaledVector(d, h * 0.5);
      spec.field(mid, opt, f2);
      var m2 = f2.length();
      if (!isFinite(m2) || m2 < 1e-8) break;
      p = p.clone().addScaledVector(f2.multiplyScalar(sign / m2), h);
    }
    if (pts.length < 3) return null;
    var len = 0;
    for (var k = 1; k < pts.length; k++) len += pts[k].distanceTo(pts[k - 1]);
    return { pts: pts, mags: mags, len: len };
  }

  function computeLines(spec, opt) {
    fieldLines = [];
    var seeds = spec.seeds(opt) || [];
    for (var i = 0; i < seeds.length; i++) {
      var s = seeds[i];
      var L = traceLine(s.p, s.dir || 1, spec, opt);
      if (L && L.len > 0.3) fieldLines.push(L);
    }
  }

  /** 颜色归一化：取所有采样点场强的 88 分位，避免手工调参 */
  function autoNorm() {
    var all = [], i, k;
    for (i = 0; i < fieldLines.length; i++) {
      var m = fieldLines[i].mags;
      for (k = 0; k < m.length; k += 2) if (isFinite(m[k])) all.push(m[k]);
    }
    if (!all.length) return 1;
    all.sort(function (a, b) { return a - b; });
    return Math.max(all[Math.floor(all.length * 0.88)] * 0.85, 1e-4);
  }

  /** 切换场 / 模式 / 视图 */
  function setField(id, opt) {
    opt = opt || {};
    var spec = A.fieldApi.registry[id];
    if (!spec) { hint('未找到场：' + id); return; }
    fState.spec = spec;
    fState.id = id;
    fState.mode = opt.mode || 'sum';
    fState.view = opt.view || 'lines';
    fState.tone = spec.tone || 'E';
    fState.norm = spec.norm || 1;
    setLayout(spec.layout || 'full');
    clearRoot();
    var fo = { mode: fState.mode };
    if (spec.build) spec.build(root, A, fo);
    computeLines(spec, fo);
    fState.norm = spec.norm || autoNorm();
    lineStep = spec.step || 0.13;
    if (fState.view === 'lines') {
      drawFieldLines(fState.tone, fState.norm);
      assignParticles();
    } else {
      buildEqui(spec.gpuFor ? spec.gpuFor(fo) : spec.gpu);
      if (spec.showLinesWithEqui !== false) drawFieldLines(fState.tone, fState.norm);
    }
    // 探针
    if (fState.probeOn) {
      if (!fState.probe) fState.probe = spec.probeAt ? spec.probeAt() : V(1.8, 1.2, 1.4);
      addProbe();
      updateProbe(true);
    } else {
      probeObj = null;
    }
    updateLegend(spec);
    notify({ ev: 'field', id: id, mode: fState.mode, view: fState.view, lines: fieldLines.length });
  }

  function setView(view) {
    if (!fState.spec || fState.view === view) return;
    fState.view = view;
    if (view === 'lines') {
      clearEqui();
      if (!lineMesh) drawFieldLines(fState.tone, fState.norm);
      assignParticles();
      pPoints.visible = true;
    } else {
      var fo = { mode: fState.mode };
      buildEqui(fState.spec.gpuFor ? fState.spec.gpuFor(fo) : fState.spec.gpu);
      pPoints.visible = fState.spec.particlesWithEqui === true;
    }
    notify({ ev: 'field', id: fState.id, mode: fState.mode, view: view });
  }

  function setMode(mode) {
    if (!fState.spec) return;
    fState.mode = mode;
    setField(fState.id, { mode: mode, view: fState.view });
  }

  /* ----------------------------------------------------------------- 探针 */
  var probeObj = null, probeArrow = null, probeCore = null, probeGlow = null;
  function addProbe() {
    if (probeObj) return;
    probeObj = new THREE.Group();
    probeCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 20, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2b0, emissiveIntensity: 0.9, roughness: 0.2 })
    );
    probeGlow = makeGlow(0xffe08a, 1.1, 0.9);
    probeObj.add(probeCore, probeGlow);
    probeArrow = makeArrow(V(0, 0, 0), V(0, 1, 0), 1, 0xffd166, 0.04);
    probeObj.add(probeArrow);
    root.add(probeObj);
  }

  function updateProbe(silent) {
    if (!fState.spec || !fState.probe) return;
    var p = fState.probe;
    var spec = fState.spec;
    var f = new THREE.Vector3();
    spec.field(p, { mode: fState.mode }, f);
    var m = f.length();
    var isB = spec.tone === 'B';
    var pot = spec.potential ? spec.potential(p, { mode: fState.mode }) : null;
    if (probeObj) {
      probeObj.position.copy(p);
      var dir = m > 1e-9 ? f.clone().multiplyScalar(1 / m) : V(0, 1, 0);
      var L = clamp(0.55 + 1.15 * Math.pow(m / fState.norm, 0.35), 0.5, 2.1);
      if (probeArrow.userData.setVec) probeArrow.userData.setVec(V(0, 0, 0), dir, L);
      var t = clamp(Math.pow(m / fState.norm, 0.42), 0, 1);
      var c = ramp(spec.tone || 'E', t);
      var cc = new THREE.Color(c[0], c[1], c[2]);
      probeArrow.children.forEach(function (ch) {
        if (ch.material) { ch.material.color = cc; ch.material.emissive = cc; }
      });
      if (probeGlow) probeGlow.material.color = cc;
    }
    if (hudEl) {
      var unit = isB ? 'mT' : 'N/C';
      var uDir = m > 1e-9 ? f.clone().multiplyScalar(1 / m) : V(0, 0, 0);
      hudEl.innerHTML =
        '<b>' + (isB ? 'B' : 'E') + ' = ' + m.toFixed(3) + ' ' + unit + '</b>' +
        '<span>' + (isB ? '磁感应强度' : '电场强度') + '</span>' +
        '<span>方向 (' + uDir.x.toFixed(2) + ', ' + uDir.y.toFixed(2) + ', ' + uDir.z.toFixed(2) + ')</span>' +
        (pot == null ? '' : '<span>' + (isB ? '|B| 参考' : '电势 V') + ' = ' + pot.toFixed(3) + '</span>');
      hudEl.classList.add('show');
    }
    if (!silent) {
      notify({
        ev: 'probe', mag: +m.toFixed(4),
        dir: [+f.x.toFixed(4), +f.y.toFixed(4), +f.z.toFixed(4)],
        pos: [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)],
        pot: pot == null ? null : +pot.toFixed(4),
        isB: !!isB,
      });
    }
  }

  function setProbeOn(on) {
    fState.probeOn = !!on;
    if (on) {
      if (!fState.probe) fState.probe = fState.spec && fState.spec.probeAt ? fState.spec.probeAt() : V(1.8, 1.3, 1.4);
      addProbe();
      updateProbe(true);
      if (hudEl) hudEl.classList.add('show');
    } else {
      if (probeObj) { root.remove(probeObj); probeObj = null; }
      if (hudEl) hudEl.classList.remove('show');
    }
  }

  /* --------------------------------------------------------------- 图例 */
  var legendEl = document.getElementById('legend');
  function updateLegend(spec) {
    if (!legendEl) return;
    var tone = spec.tone || 'E';
    var isB = tone === 'B';
    var stops = [0, 0.34, 0.68, 1].map(function (t) { return css(tone, t); });
    legendEl.innerHTML =
      '<div class="lg-row"><span class="lg-bar" style="background:linear-gradient(90deg,' +
      stops.join(',') + ')"></span></div>' +
      '<div class="lg-row"><span class="lg-t">' + (isB ? 'B 弱' : 'E 弱') + '</span>' +
      '<span class="lg-t right">' + (isB ? 'B 强' : 'E 强') + '</span></div>';
    legendEl.classList.add('show');
  }

  /* ------------------------------------------------------------ 演示场景 */
  var sceneCur = null;
  function runScene(id, step, params, counter) {
    params = params || {};
    var reg = A.sceneApi.registry[id];
    if (!reg) { hint('未找到场景：' + id); return; }
    setLayout(reg.layout || 'full');
    var sig = id + '|' + (counter || 0);
    if (!sceneCur || sceneCur.sig !== sig) {
      clearRoot();
      sceneCur = {
        id: id, sig: sig, step: -1,
        ctx: {
          root: root, add: function (o) { root.add(o); return o; }, util: A.util,
          params: params, t: 0, notify: notify, hint: hint, three: THREE,
        },
      };
      if (reg.build) reg.build(sceneCur.ctx);
      if (reg.fit !== false) fitBox(reg.fit || 7, reg.cam);
    }
    sceneCur.ctx.params = params;
    if (sceneCur.step !== step) {
      sceneCur.step = step;
      if (reg.setStep) reg.setStep(sceneCur.ctx, step);
    }
    if (reg.onParams) reg.onParams(sceneCur.ctx, params);
    if (reg.draw2d && ctx2 && layout !== 'full') reg.draw2d(ctx2, chartW, chartH, sceneCur.ctx, 0);
    notify({ ev: 'scene', id: id, step: step });
  }

  function fitBox(size, camOpt) {
    if (camOpt) {
      if (camOpt.theta != null) cam.theta = camOpt.theta;
      if (camOpt.phi != null) cam.phi = camOpt.phi;
    }
    cam.dist = clamp(size * 1.5, 4, 26);
    cam.target.set(0, 0, 0);
    applyCam();
  }
  A.fitBox = fitBox;

  /* -------------------------------------------------------- 布局 / 尺寸 */
  var layout = 'full';
  function setLayout(mode) {
    layout = mode;
    var app = document.getElementById('app');
    if (app) app.classList.toggle('panel', mode === 'panel');
    resize();
  }
  A.setLayout = setLayout;

  var chartW = 360, chartH = 240;
  function resize() {
    if (layout === 'panel') {
      host.style.display = 'none';
      if (panelEl) panelEl.style.display = 'flex';
    } else if (layout === 'split') {
      host.style.display = 'block';
      if (panelEl) panelEl.style.display = 'flex';
    } else {
      host.style.display = 'block';
      if (panelEl) panelEl.style.display = 'none';
    }
    var w = host.clientWidth || 360;
    var h = host.clientHeight || 320;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    pMat.uniforms.uH.value = (h * renderer.getPixelRatio()) * 0.5 / Math.tan((camera.fov * Math.PI / 180) / 2);
    if (A.dust) A.dust.material.uniforms.uH.value = pMat.uniforms.uH.value;
    if (chart && panelEl) {
      var pw = panelEl.clientWidth || w;
      var ph = panelEl.clientHeight || h;
      chart.width = Math.round(pw * dpr);
      chart.height = Math.round(ph * dpr);
      chart.style.width = pw + 'px';
      chart.style.height = ph + 'px';
      chartW = pw; chartH = ph;
      if (ctx2) ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }
  window.addEventListener('resize', resize);

  /* -------------------------------------------------------------- 交互 */
  var ray = new THREE.Raycaster();
  var ndc = new THREE.Vector2();
  var dragPlane = new THREE.Plane();
  var hitSphere = new THREE.Sphere(new THREE.Vector3(), 0.42);
  var dragMode = null; // 'cam' | 'probe'
  var lastPt = { x: 0, y: 0 };
  var movedPx = 0;
  var pinchStart = 0, pinchDist0 = 0;
  var pointers = {};

  function toNdc(x, y) {
    var r = renderer.domElement.getBoundingClientRect();
    ndc.x = ((x - r.left) / r.width) * 2 - 1;
    ndc.y = -((y - r.top) / r.height) * 2 + 1;
    return ndc;
  }

  function pickProbe(x, y) {
    if (!fState.probe || !probeObj) return false;
    ray.setFromCamera(toNdc(x, y), camera);
    hitSphere.center.copy(fState.probe);
    hitSphere.radius = 0.42;
    return !!ray.ray.intersectSphere(hitSphere, new THREE.Vector3());
  }

  function planePoint(x, y, through) {
    ray.setFromCamera(toNdc(x, y), camera);
    var n = camera.getWorldDirection(new THREE.Vector3()).negate();
    dragPlane.setFromNormalAndCoplanarPoint(n, through);
    var p = new THREE.Vector3();
    return ray.ray.intersectPlane(dragPlane, p) ? p : null;
  }

  var el = renderer.domElement;
  el.style.touchAction = 'none';

  function onDown(e) {
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var keys = Object.keys(pointers);
    if (keys.length === 2) {
      var a = pointers[keys[0]], b = pointers[keys[1]];
      pinchDist0 = Math.hypot(a.x - b.x, a.y - b.y);
      pinchStart = cam.dist;
      dragMode = 'pinch';
      return;
    }
    movedPx = 0;
    lastPt.x = e.clientX; lastPt.y = e.clientY;
    dragMode = pickProbe(e.clientX, e.clientY) ? 'probe' : 'cam';
  }
  function onMove(e) {
    if (pointers[e.pointerId]) { pointers[e.pointerId].x = e.clientX; pointers[e.pointerId].y = e.clientY; }
    if (!dragMode) return;
    if (dragMode === 'pinch') {
      var keys = Object.keys(pointers);
      if (keys.length < 2) return;
      var a = pointers[keys[0]], b = pointers[keys[1]];
      var d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist0 > 1 && d > 1) {
        cam.dist = clamp(pinchStart * (pinchDist0 / d), 3.2, 30);
        applyCam();
      }
      return;
    }
    var dx = e.clientX - lastPt.x, dy = e.clientY - lastPt.y;
    movedPx += Math.abs(dx) + Math.abs(dy);
    lastPt.x = e.clientX; lastPt.y = e.clientY;
    if (dragMode === 'cam') {
      cam.theta -= dx * 0.006;
      cam.phi -= dy * 0.006;
      applyCam();
    } else if (dragMode === 'probe' && fState.probe) {
      var p = planePoint(e.clientX, e.clientY, fState.probe);
      if (p) {
        var R = (fState.spec && fState.spec.domain) || 6;
        if (p.length() > R - 0.2) p.setLength(R - 0.2);
        fState.probe.copy(p);
        updateProbe(false);
      }
    }
  }
  function onUp(e) {
    delete pointers[e.pointerId];
    if (dragMode === 'cam' && movedPx < 6 && fState.spec && fState.probeOn) {
      // 轻点 → 把探针挪到该处
      var p = planePoint(e.clientX, e.clientY, V(0, 0, 0));
      if (p) {
        var R = (fState.spec && fState.spec.domain) || 6;
        if (p.length() > R - 0.2) p.setLength(R - 0.2);
        fState.probe.copy(p);
        updateProbe(false);
      }
    }
    dragMode = null;
  }
  el.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  el.addEventListener('wheel', function (e) {
    e.preventDefault();
    cam.dist = clamp(cam.dist * (1 + (e.deltaY > 0 ? 0.12 : -0.12)), 3.2, 30);
    applyCam();
  }, { passive: false });

  /* ---------------------------------------------------------------- 主循环 */
  var lastT = performance.now();
  var clock = 0;
  function loop(now) {
    try { tickFrame(now); } catch (e) {
      A.lastError = String((e && e.stack) || e);
      if (window.console) console.error('[phys-loop] ' + A.lastError);
      showErr('渲染异常：' + (e && e.message || e));
    }
    requestAnimationFrame(loop);
  }

  function tickFrame(now) {
    var dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    clock += dt;

    if (A.dust) A.dust.rotation.y += dt * 0.012;

    var reg = sceneCur && sceneCur.ctx ? A.sceneApi.registry[sceneCur.id] : null;
    if (reg && reg.tick) reg.tick(sceneCur.ctx, dt, clock);
    if (reg && reg.draw2d && ctx2 && layout !== 'full') {
      reg.draw2d(ctx2, chartW, chartH, sceneCur.ctx, clock);
    }
    if (layout !== 'panel') {
      if (fState.spec) {
        stepParticles(dt, fState.tone, fState.norm);
        if (equiMesh) {
          if (equiMesh.material && equiMesh.material.uniforms && equiMesh.material.uniforms.uCam) {
            equiMesh.material.uniforms.uCam.value.copy(camera.position);
          } else if (equiMesh.userData && equiMesh.userData.sliceMats) {
            equiMesh.userData.sliceMats.forEach(function (m) { m.uniforms.uTime.value = clock; });
          }
        }
      }
      renderer.render(scene, camera);
    }
  }

  /* --------------------------------------------------------------- 命令 */
  function handleCommand(msg) {
    var m = msg;
    if (typeof m === 'string') { try { m = JSON.parse(m); } catch (e) { return; } }
    if (!m || typeof m !== 'object') return;
    if (m.cmd === 'ping') { notify({ ev: 'ready' }); return; }
    if (m.cmd === 'shake') { hint('用一根手指拖动可以转视角，两指捏合缩放'); return; }
    if (m.cmd === 'phys') {
      try { handlePhys(m); } catch (e) {
        A.lastError = String((e && e.stack) || e);
        if (window.console) console.error('[phys] ' + A.lastError);
      }
    }
  }
  function handlePhys(m) {
    {
      switch (m.action) {
        case 'field':
          sceneCur = null;
          fState.probe = m.probePos ? V(m.probePos[0], m.probePos[1], m.probePos[2]) : null;
          fState.probeOn = !!m.probe;
          setField(m.id, { mode: m.mode || 'sum', view: m.view || 'lines' });
          break;
        case 'view': setView(m.view); break;
        case 'mode': setMode(m.mode); break;
        case 'probe':
          if (m.on != null) setProbeOn(m.on);
          if (m.pos) { fState.probe = V(m.pos[0], m.pos[1], m.pos[2]); updateProbe(true); }
          break;
        case 'scene':
          // 注意：不能在这里无条件 clearRoot —— runScene 对「同 id」不会重建，
          // 清了场又不重建就会让整个 3D 画面消失。清场交给 runScene 真正重建时做。
          if (fState.spec) sceneCur = null;   // 从「场」切到「场景」时必须重建
          fState.spec = null;
          pPoints.visible = false;
          if (hudEl) hudEl.classList.remove('show');
          if (legendEl) legendEl.classList.remove('show');
          runScene(m.id, m.step || 0, m.params || {}, m.counter || 0);
          break;
        case 'param':
          if (sceneCur && A.sceneApi.registry[sceneCur.id]) {
            var reg = A.sceneApi.registry[sceneCur.id];
            sceneCur.ctx.params = m.params || {};
            if (reg.onParams) reg.onParams(sceneCur.ctx, m.params || {});
            if (reg.setStep && m.step != null) { sceneCur.step = m.step; reg.setStep(sceneCur.ctx, m.step); }
          }
          break;
        case 'cam':
          if (m.reset) { cam.theta = -0.62; cam.phi = 1.12; cam.dist = 9.6; cam.target.set(0, 0, 0); applyCam(); }
          break;
        default: break;
      }
    }
  }
  window.addEventListener('message', function (e) { handleCommand(e.data); });

  window.__dispatch = handleCommand;

  /** 调试/自检：宿主可读取当前引擎状态 */
  A.debug = function () {
    return {
      lines: fieldLines.length,
      particles: pCount,
      view: fState.view,
      mode: fState.mode,
      field: fState.id,
      norm: +fState.norm.toFixed(4),
      scene: sceneCur ? sceneCur.id : null,
      layout: layout,
      equi: !!equiMesh,
      rootChildren: root.children.length,
      camDist: +cam.dist.toFixed(2),
      camPos: camera.position.toArray().map(function (v) { return +v.toFixed(2); }),
      canvasSize: [renderer.domElement.width, renderer.domElement.height],
      probe: fState.probe ? fState.probe.toArray() : null,
      probeObj: !!probeObj,
      fields: Object.keys(A.fieldApi.registry),
      scenes: Object.keys(A.sceneApi.registry),
    };
  };

  /* --------------------------------------------------------------- 启动 */
  applyCam();
  resize();
  requestAnimationFrame(loop);
  if (bootEl) bootEl.style.display = 'none';
  notify({ ev: 'ready' });
  // 宿主的 message 监听器可能晚于本脚本执行才挂上（srcdoc 加载很快），延迟补发一次 ready
  setTimeout(function () { notify({ ev: 'ready' }); }, 300);
})();
