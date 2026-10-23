/* =========================================================================
 * 化学 · 酸碱性引擎（three.js）
 * -------------------------------------------------------------------------
 * 宿主：engine/acid/index.template.html（打包进 src/engine/acidHtml.ts）
 * 命令：{cmd:'acid', case, script} 建场并播放
 *      {cmd:'acidCtl', action:'play'|'pause'|'toggle'|'next'|'prev'|'restart'|'goto'|'speed'|'cam'}
 *      {cmd:'ping'}
 * 事件：{ev:'ready'} / {ev:'acid', step, steps, playing, title, text, kind, h, oh}
 *
 * 动画只做「演出」，化学判断全部在 src/acid/acidRule.ts 里，节拍由宿主下发。
 * 画面约定：灰色小分子 = 水；红小球 = H⁺；蓝小球 = OH⁻；橙球 = 阳离子；青球 = 阴离子；
 *          紫球 = 水解生成的弱电解质（NH₃·H₂O / CH₃COOH …）
 * ========================================================================= */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ DOM */
  var hostEl = document.getElementById('view3d');
  var bootEl = document.getElementById('boot');
  var hintBox = document.getElementById('hint');
  var hintText = document.getElementById('hintText');
  var errBox = document.getElementById('errMsg');

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
    errBox.innerHTML = '';
    var box = document.createElement('div');
    box.className = 'errbox';
    box.textContent = msg;
    errBox.appendChild(box);
    errBox.style.display = msg ? 'flex' : 'none';
  }
  window.addEventListener('error', function (e) { showErr('引擎错误：' + (e.message || e)); });

  /* ---------------------------------------------------------------- 工具 */
  function V(x, y, z) { return new THREE.Vector3(x, y, z); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function randDir() {
    var v = V(rnd(-1, 1), rnd(-0.5, 0.5), rnd(-1, 1));
    if (v.lengthSq() < 1e-4) v.set(1, 0, 0);
    return v.normalize();
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  /* -------------------------------------------------------------- 渲染器 */
  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);
  if (hostEl) hostEl.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(46, 1, 0.1, 200);
  var cam = { theta: -0.45, phi: 1.16, dist: 10.4, target: V(0, 0, 0), auto: true };
  function applyCam() {
    var sp = Math.sin(cam.phi), cp = Math.cos(cam.phi);
    camera.position.set(
      cam.target.x + cam.dist * sp * Math.sin(cam.theta),
      cam.target.y + cam.dist * cp,
      cam.target.z + cam.dist * sp * Math.cos(cam.theta)
    );
    camera.lookAt(cam.target);
  }
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9d8ee, 1.05));
  var dl1 = new THREE.DirectionalLight(0xffffff, 0.85); dl1.position.set(3, 6, 6); scene.add(dl1);
  var dl2 = new THREE.DirectionalLight(0xbfd8ff, 0.4); dl2.position.set(-4, -2, -3); scene.add(dl2);

  function resize() {
    if (!hostEl) return;
    var w = hostEl.clientWidth || 320;
    var h = hostEl.clientHeight || 260;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  /* ---------------------------------------------------------------- 交互 */
  var canvas = renderer.domElement;
  var pts = {};
  var lastPinch = 0;
  canvas.addEventListener('pointerdown', function (e) {
    pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    canvas.classList.add('dragging');
    cam.auto = false;
  });
  window.addEventListener('pointermove', function (e) {
    var p = pts[e.pointerId];
    if (!p) return;
    var dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    var keys = Object.keys(pts);
    if (keys.length === 1) {
      cam.theta -= dx * 0.006;
      cam.phi = clamp(cam.phi - dy * 0.005, 0.35, 2.5);
    } else if (keys.length >= 2) {
      var a = pts[keys[0]], b = pts[keys[1]];
      var d = Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
      if (lastPinch > 0 && d > 0) cam.dist = clamp(cam.dist * (lastPinch / d), 6, 20);
      lastPinch = d;
    }
    applyCam();
  });
  function pointerUp(e) {
    delete pts[e.pointerId];
    if (Object.keys(pts).length < 2) lastPinch = 0;
    if (Object.keys(pts).length === 0) canvas.classList.remove('dragging');
  }
  window.addEventListener('pointerup', pointerUp);
  window.addEventListener('pointercancel', pointerUp);
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    cam.auto = false;
    cam.dist = clamp(cam.dist * (1 + e.deltaY * 0.0012), 6, 20);
    applyCam();
  }, { passive: false });

  /* ---------------------------------------------------------------- 素材 */
  var SPH = new THREE.SphereGeometry(1, 20, 14);
  var COL = {
    h: 0xff5252, oh: 0x2f6fed, cat: 0xf5a623, an: 0x2fbfa0,
    weak: 0x9a6bd6, mol: 0x7f8fa6, wO: 0xa9b4c4, wH: 0xd8dee8, bond: 0xbfcadb,
  };
  var BOX = { x: 4.5, y: 2.3, z: 2.3 };

  function mat(color, opacity, emissive) {
    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.38,
      metalness: 0.06,
      emissive: emissive || 0x000000,
      emissiveIntensity: 0.35,
      transparent: opacity != null && opacity < 1,
      opacity: opacity == null ? 1 : opacity,
    });
  }
  function glowTexture() {
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var g = c.getContext('2d');
    var rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.25, 'rgba(255,255,255,0.5)');
    rg.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  var TEX_GLOW = null;
  function makeGlow(color, size, opacity) {
    if (!TEX_GLOW) TEX_GLOW = glowTexture();
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: TEX_GLOW, color: color, transparent: true,
      opacity: opacity == null ? 0.8 : opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sp.scale.set(size, size, 1);
    return sp;
  }
  function makeLabel(text, opt) {
    opt = opt || {};
    var fs = opt.size || 44;
    var font = '700 ' + fs + 'px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    var c = document.createElement('canvas');
    var g = c.getContext('2d');
    g.font = font;
    var w = Math.ceil(g.measureText(text).width) + 36;
    c.width = Math.max(64, w);
    c.height = Math.ceil(fs * 1.55);
    g = c.getContext('2d');
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (opt.chip !== false) {
      g.fillStyle = opt.bg || 'rgba(255,255,255,0.88)';
      roundRect(g, 3, 3, c.width - 6, c.height - 6, 14);
      g.fill();
      g.strokeStyle = opt.border || 'rgba(90,120,170,0.28)';
      g.lineWidth = 2;
      roundRect(g, 3, 3, c.width - 6, c.height - 6, 14);
      g.stroke();
    }
    g.fillStyle = opt.color || '#16324f';
    g.fillText(text, c.width / 2, c.height / 2 + 1);
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, depthTest: false,
    }));
    var h = opt.worldH || 0.36;
    sp.scale.set(h * (c.width / c.height), h, 1);
    return sp;
  }
  function disposeSprite(sp) {
    if (!sp) return;
    if (sp.material) {
      if (sp.material.map) sp.material.map.dispose();
      sp.material.dispose();
    }
  }
  function stick(a, b, m, r) {
    var d = new THREE.Vector3().subVectors(b, a);
    var len = d.length();
    var mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), m);
    mesh.position.copy(a).addScaledVector(d, 0.5);
    mesh.quaternion.setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
    return mesh;
  }

  /* ------------------------------------------------------------ 粒子容器 */
  var root = new THREE.Group();
  scene.add(root);
  var waters = [];
  var actors = [];
  var curCase = null;

  function clearScene() {
    root.clear ? root.clear() : (root.children.length = 0);
    waters = [];
    actors = [];
  }

  /* ------------------------------------------------------------ 水分子 */
  function makeWater(pos) {
    var g = new THREE.Group();
    var om = mat(COL.wO, 0.92), hm = mat(COL.wH, 0.95), bm = mat(COL.bond, 0.8);
    var O = new THREE.Mesh(SPH, om); O.scale.setScalar(0.17); g.add(O);
    var h1 = new THREE.Mesh(SPH, hm); h1.scale.setScalar(0.095); h1.position.set(0.22, 0.16, 0);
    var h2 = new THREE.Mesh(SPH, hm); h2.scale.setScalar(0.095); h2.position.set(-0.22, 0.16, 0);
    g.add(h1, h2);
    g.add(stick(V(0, 0, 0), h1.position, bm, 0.022));
    g.add(stick(V(0, 0, 0), h2.position, bm, 0.022));
    g.position.copy(pos);
    root.add(g);
    var w = {
      obj: g, dead: false, holding: false, scripted: false,
      vel: V(rnd(-0.2, 0.2), rnd(-0.15, 0.15), rnd(-0.15, 0.15)),
      from: V(0, 0, 0), to: V(0, 0, 0), t: 0, dur: 1,
      spin: V(rnd(-0.5, 0.5), rnd(-0.5, 0.5), rnd(-0.5, 0.5)),
    };
    waters.push(w);
    return w;
  }
  function removeWater(w) {
    w.dead = true;
    if (w.obj && w.obj.parent) w.obj.parent.remove(w.obj);
    waters = waters.filter(function (x) { return !x.dead; });
  }
  function nearestWaters(pos, n) {
    var alive = waters.filter(function (w) { return !w.dead && !w.holding; });
    alive.sort(function (a, b) {
      return a.obj.position.distanceToSquared(pos) - b.obj.position.distanceToSquared(pos);
    });
    return alive.slice(0, n || 1);
  }
  /** 让水分子的某一侧朝向离子：mode='H' → H 端朝离子；'O' → O 端朝离子 */
  function faceWater(w, ionPos, mode) {
    var dir = new THREE.Vector3().subVectors(ionPos, w.obj.position);
    if (dir.lengthSq() < 1e-6) return;
    dir.normalize();
    if (mode === 'O') dir.multiplyScalar(-1);
    w.obj.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
  }

  /* -------------------------------------------------------------- 溶质粒子 */
  function ionKindOf(label) {
    if (label === 'H⁺' || label === 'H+') return 'h';
    if (label === 'OH⁻' || label === 'OH-') return 'oh';
    return 'ion';
  }
  function colorOf(label, charge) {
    var k = ionKindOf(label);
    if (k === 'h') return COL.h;
    if (k === 'oh') return COL.oh;
    return charge > 0 ? COL.cat : COL.an;
  }
  function radiusOf(label, charge) {
    var k = ionKindOf(label);
    if (k === 'h') return 0.145;
    if (k === 'oh') return 0.2;
    return 0.18 + Math.min(3, Math.abs(charge || 1)) * 0.055;
  }
  function textColorOf(label) {
    var k = ionKindOf(label);
    if (k === 'h') return '#c62828';
    if (k === 'oh') return '#1565c0';
    return '#16324f';
  }

  function newActor(kind, label, charge, color, r, opt) {
    opt = opt || {};
    var g = new THREE.Group();
    var m = mat(color);
    var s = new THREE.Mesh(SPH, m);
    s.scale.setScalar(r);
    g.add(s);
    var glow = null;
    if (opt.glow) {
      glow = makeGlow(color, r * 7, 0.55);
      g.add(glow);
    }
    var lab = makeLabel(label, { color: opt.textColor || textColorOf(label), worldH: opt.labelH || 0.34 });
    lab.position.y = r + 0.3;
    g.add(lab);
    root.add(g);
    var a = {
      kind: kind, label: label, charge: charge || 0, obj: g, sphere: s, mat: m, lab: lab, glow: glow,
      r: r, dead: false, free: !!opt.free, solute: !!opt.solute, role: opt.role || 'spectator',
      vel: V(rnd(-0.25, 0.25), rnd(-0.2, 0.2), rnd(-0.2, 0.2)),
      scripted: false, from: V(0, 0, 0), to: V(0, 0, 0), t: 0, dur: 1,
    };
    actors.push(a);
    return a;
  }
  function removeActor(a) {
    a.dead = true;
    if (a.obj && a.obj.parent) a.obj.parent.remove(a.obj);
    actors = actors.filter(function (x) { return !x.dead; });
  }
  function aliveActors() {
    return actors.filter(function (a) { return !a.dead; });
  }
  function findActors(label) {
    return aliveActors().filter(function (a) { return a.label === label; });
  }

  /* ------------------------------------------------------------ 运动 */
  function moveTo(a, to, dur) {
    a.scripted = true;
    a.from.copy(a.obj.position);
    a.to.copy(to);
    a.t = 0;
    a.dur = Math.max(0.05, dur);
  }
  function updateScripted(a, dt) {
    a.t += dt / a.dur;
    var k = a.t >= 1 ? 1 : a.t;
    a.obj.position.lerpVectors(a.from, a.to, ease(k));
    if (k >= 1) a.scripted = false;
  }
  function moveToW(w, to, dur) {
    w.scripted = true;
    w.from.copy(w.obj.position);
    w.to.copy(to);
    w.t = 0;
    w.dur = Math.max(0.05, dur);
  }
  function updateScriptedW(w, dt) {
    w.t += dt / w.dur;
    var k = w.t >= 1 ? 1 : w.t;
    w.obj.position.lerpVectors(w.from, w.to, ease(k));
    if (k >= 1) w.scripted = false;
  }
  function drift(o, vel, dt, jitter, maxSpeed) {
    vel.x += rnd(-1, 1) * dt * jitter;
    vel.y += rnd(-1, 1) * dt * jitter;
    vel.z += rnd(-1, 1) * dt * jitter;
    vel.multiplyScalar(0.965);
    var sp = vel.length();
    if (sp > maxSpeed) vel.multiplyScalar(maxSpeed / sp);
    o.position.addScaledVector(vel, dt);
    if (o.position.x > BOX.x) { o.position.x = BOX.x; vel.x = -Math.abs(vel.x); }
    if (o.position.x < -BOX.x) { o.position.x = -BOX.x; vel.x = Math.abs(vel.x); }
    if (o.position.y > BOX.y) { o.position.y = BOX.y; vel.y = -Math.abs(vel.y); }
    if (o.position.y < -BOX.y) { o.position.y = -BOX.y; vel.y = Math.abs(vel.y); }
    if (o.position.z > BOX.z) { o.position.z = BOX.z; vel.z = -Math.abs(vel.z); }
    if (o.position.z < -BOX.z) { o.position.z = -BOX.z; vel.z = Math.abs(vel.z); }
  }
  function spreadPos(i, n) {
    var ang = (i / Math.max(1, n)) * Math.PI * 2 + rnd(-0.4, 0.4);
    var rad = 1.7 + Math.random() * 1.2;
    return V(Math.cos(ang) * rad * 1.3, rnd(-1.6, 1.6), Math.sin(ang) * rad * 0.7);
  }

  /* ------------------------------------------------------------ 播放器 */
  var player = { list: [], i: -1, t: 0, playing: false, speed: 1, cur: null };

  function counts() {
    var h = 0, oh = 0;
    var list = aliveActors();
    for (var i = 0; i < list.length; i++) {
      if (list[i].kind === 'h') h++;
      else if (list[i].kind === 'oh') oh++;
    }
    return { h: h, oh: oh };
  }
  function notifyStep() {
    var c = counts();
    var o = { ev: 'acid', step: player.i + 1, steps: player.list.length, playing: player.playing, h: c.h, oh: c.oh };
    if (player.cur) {
      o.title = player.cur.title;
      o.text = player.cur.text;
      o.kind = player.cur.kind;
    }
    notify(o);
  }
  function gotoBeat(i) {
    if (!player.list.length) return;
    if (player.cur && player.cur.exit) {
      try { player.cur.exit(player.cur); } catch (e) { /* noop */ }
    }
    player.i = clamp(i, 0, player.list.length - 1);
    player.cur = player.list[player.i] || null;
    player.t = 0;
    if (player.cur && player.cur.enter) {
      try { player.cur.enter(player.cur); } catch (e) { showErr('节拍错误：' + (e && e.message || e)); }
    }
    notifyStep();
  }

  /* ---------------------------------------------- 快进（练习模式用）
   * 练习模式要「直接跳到第 N 拍」演示某一步（比如只看水解），但前面的节拍
   * （溶解、电离…）必须已经发生过，场景状态才对。这里把前 N-1 拍瞬间跑完。 */
  function settleAll() {
    var k;
    var list = aliveActors();
    for (k = 0; k < list.length; k++) {
      var a = list[k];
      if (a.scripted) { a.obj.position.copy(a.to); a.scripted = false; }
    }
    for (k = 0; k < waters.length; k++) {
      var w = waters[k];
      if (!w.dead && w.scripted) { w.obj.position.copy(w.to); w.scripted = false; }
    }
  }
  function fastForward(b) {
    if (!b) return;
    if (b.enter) { try { b.enter(b); } catch (e) { /* noop */ } }
    settleAll();
    var total = Math.ceil(b.dur / 0.2) + 6;
    for (var s = 1; s <= total; s += 1) {
      if (b.step) { try { b.step(b, s * 0.2, 0.2); } catch (e) { /* noop */ } }
      settleAll();
    }
    if (b.exit) { try { b.exit(b); } catch (e) { /* noop */ } }
  }

  /* ------------------------------------------------------------ 各节拍 */

  function enterDissolve() {
    var sol = aliveActors().filter(function (a) { return a.solute; });
    sol.forEach(function (a, i) {
      a.obj.visible = true; // 这一步溶质才正式登场（前一步先演纯水的动态平衡）
      a.obj.scale.setScalar(0.4);
      moveTo(a, spreadPos(i, sol.length), 1.6);
    });
  }
  function stepDissolve(b, tt) {
    aliveActors().forEach(function (a) {
      if (a.solute && a.obj.scale.x < 1) {
        a.obj.scale.setScalar(Math.min(1, a.obj.scale.x + 0.04));
      }
    });
  }

  function spawnProducts(center, products, dir) {
    return products.map(function (p, i) {
      var a = newActor(ionKindOf(p.label), p.label, p.charge, colorOf(p.label, p.charge), radiusOf(p.label, p.charge), {
        glow: ionKindOf(p.label) !== 'ion',
        free: ionKindOf(p.label) !== 'ion',
      });
      a.obj.position.copy(center);
      var sign = i === 0 ? 1 : (i === 1 ? -1 : (i % 2 ? -1 : 1));
      moveTo(a, center.clone().addScaledVector(dir, sign * (0.8 + i * 0.35)), 1.4);
      return a;
    });
  }

  function enterIonize(b) {
    var mols = aliveActors().filter(function (a) { return a.kind === 'mol'; });
    var n = b.full ? mols.length : Math.min(1, mols.length);
    b.pairs = [];
    mols.slice(0, n).forEach(function (m) {
      var center = m.obj.position.clone();
      var dir = randDir();
      removeActor(m);
      var prods = spawnProducts(center, curCase.moleculeIons || [], dir);
      b.pairs.push({ prods: prods, center: center, dir: dir });
    });
    if (!b.full && b.pairs.length) {
      var p0 = b.pairs[0];
      b.rev = makeLabel('⇌ 可逆：边电离边结合', { worldH: 0.34, size: 40, color: '#43597a' });
      b.rev.position.copy(p0.center).add(V(0, 1.15, 0));
      root.add(b.rev);
    }
  }
  function stepIonize(b, tt) {
    if (b.full || !b.pairs) return;
    if (tt < 1.5) return;
    var amp = 0.85 + 0.38 * Math.sin((tt - 1.5) * 3.2);
    b.pairs.forEach(function (p) {
      p.prods.forEach(function (a, i) {
        if (a.scripted) return;
        var sign = i === 0 ? 1 : -1;
        a.obj.position.copy(p.center).addScaledVector(p.dir, sign * amp);
      });
    });
  }
  function exitIonize(b) {
    if (b.rev) { root.remove(b.rev); disposeSprite(b.rev); b.rev = null; }
  }

  function enterHydrate(b) {
    var ions = aliveActors().filter(function (a) { return a.kind === 'ion'; });
    b.groups = [];
    ions.slice(0, 2).forEach(function (ion) {
      var ws = nearestWaters(ion.obj.position, 3);
      if (!ws.length) return;
      ws.forEach(function (w) { w.holding = true; });
      b.groups.push({ ion: ion, ws: ws });
    });
  }
  function stepHydrate(b, tt) {
    (b.groups || []).forEach(function (g) {
      g.ws.forEach(function (w, i) {
        if (w.dead) return;
        var ang = (i / g.ws.length) * Math.PI * 2 + tt * 0.7;
        var dir = V(Math.cos(ang), Math.sin(ang) * 0.7, Math.sin(ang * 1.3) * 0.6);
        if (dir.lengthSq() < 1e-6) return;
        dir.normalize();
        w.obj.position.copy(g.ion.obj.position).addScaledVector(dir, 1.15);
        faceWater(w, g.ion.obj.position, g.ion.charge > 0 ? 'O' : 'H');
      });
    });
  }
  function exitHydrate(b) {
    (b.groups || []).forEach(function (g) {
      g.ws.forEach(function (w) { w.holding = false; });
    });
  }

  /** 水解：离子抢走水里的 OH⁻ / H⁺ → 生成弱电解质 + 释放另一个离子 */
  function newHydroJob(ion, spec) {
    var w = nearestWaters(ion.obj.position, 1)[0];
    if (!w) return null;
    w.holding = true;
    return {
      ion: ion, w: w, spec: spec, t: 0, swapped: false, done: false,
      dir: new THREE.Vector3().subVectors(w.obj.position, ion.obj.position).normalize(),
      start: w.obj.position.clone(),
    };
  }
  function stepHydroJob(j, dt) {
    if (!j || j.done) return;
    j.t += dt;
    var spec = j.spec;
    var ion = j.ion, w = j.w;
    if (j.t < 1.0) {
      // 水分子靠近离子，并把要被抢走的那一侧转向离子
      if (!w.dead) {
        var contact = ion.obj.position.clone().addScaledVector(j.dir, 1.2);
        var k = ease(j.t / 1.0);
        w.obj.position.lerpVectors(j.start, contact, k);
        faceWater(w, ion.obj.position, spec.take === 'OH' ? 'O' : 'H');
      }
      return;
    }
    if (!j.swapped) {
      j.swapped = true;
      if (w && !w.dead) {
        j.wpos = w.obj.position.clone();
        removeWater(w);
      } else {
        j.wpos = ion.obj.position.clone().addScaledVector(j.dir, 1.2);
      }
      // 离子 → 弱电解质（换个颜色 + 换标签）
      if (!ion.dead) removeActor(ion);
      var weak = newActor('weak', spec.product, 0, COL.weak, 0.3, { textColor: '#5b3a9e', labelH: 0.36 });
      weak.obj.position.copy(ion.obj.position);
      j.weak = weak;
      // 剩下的那部分变成自由离子飞出去
      var isH = spec.release === 'H';
      var rel = newActor(isH ? 'h' : 'oh', isH ? 'H⁺' : 'OH⁻', isH ? 1 : -1, isH ? COL.h : COL.oh,
        isH ? 0.145 : 0.2, { glow: true, free: true });
      rel.obj.position.copy(j.wpos);
      j.rel = rel;
      j.from = j.wpos.clone();
      j.to = j.wpos.clone().addScaledVector(j.dir.clone().multiplyScalar(-1), 1.9);
      j.to.y = clamp(j.to.y + rnd(-0.5, 0.5), -BOX.y, BOX.y);
      j.to.x = clamp(j.to.x, -BOX.x, BOX.x);
      // 补一个水分子，保持溶剂数量
      makeWater(V(rnd(-BOX.x, BOX.x), rnd(-BOX.y, BOX.y), rnd(-BOX.z, BOX.z)));
      return;
    }
    var k2 = ease((j.t - 1.0) / 1.7);
    if (j.rel) {
      j.rel.obj.position.lerpVectors(j.from, j.to, k2);
      j.rel.obj.scale.setScalar(1 + 0.22 * Math.sin(j.t * 9));
    }
    if (k2 >= 1) {
      if (j.rel) j.rel.obj.scale.setScalar(1);
      j.done = true;
    }
  }

  function enterHydrolyze(b) {
    var n = (b.spec && b.spec.count) || 1;
    b.jobs = [];
    findActors(b.spec.ion).slice(0, n).forEach(function (ion) {
      var j = newHydroJob(ion, b.spec);
      if (j) b.jobs.push(j);
    });
  }
  function stepHydrolyze(b, tt, dt) {
    (b.jobs || []).forEach(function (j) { stepHydroJob(j, dt); });
  }

  function enterIonizeIon(b) {
    var spec = b.spec;
    var n = spec.count || (spec.full ? 3 : 1);
    b.jobs = [];
    findActors(spec.ion).slice(0, n).forEach(function (ion) {
      b.jobs.push({ ion: ion, t: 0, done: false, spec: spec });
    });
  }
  function stepIonizeIon(b, tt, dt) {
    (b.jobs || []).forEach(function (j) {
      if (j.done) return;
      j.t += dt;
      if (j.t < 0.6) return;
      var center = j.ion.obj.position.clone();
      var dir = randDir();
      removeActor(j.ion);
      j.prods = spawnProducts(center, j.spec.into, dir);
      j.done = true;
    });
    // 放出的 H⁺ / OH⁻ 轻微脉动，提示它已自由
    (b.jobs || []).forEach(function (j) {
      (j.prods || []).forEach(function (a) {
        if (a.kind === 'h' || a.kind === 'oh') a.obj.scale.setScalar(1 + 0.2 * Math.sin(tt * 8));
      });
    });
  }

  /** 竞争：同一个离子，一部分走水解，一部分走电离 */
  function enterCompete(b) {
    var pool = findActors(b.hyd.ion || b.ion.ion);
    var hn = b.hyd.count || 2;
    var inN = b.ion.count || 1;
    b.hydJobs = [];
    b.ionJobs = [];
    pool.slice(0, hn).forEach(function (ion) {
      var j = newHydroJob(ion, b.hyd);
      if (j) b.hydJobs.push(j);
    });
    pool.slice(hn, hn + inN).forEach(function (ion) {
      b.ionJobs.push({ ion: ion, t: 0, done: false, spec: b.ion });
    });
    if (b.hydJobs.length) {
      var p0 = b.hydJobs[0].ion.obj.position;
      b.hydTag = makeLabel('① 水解 → 放出 OH⁻', { worldH: 0.4, size: 40, color: '#1565c0' });
      b.hydTag.position.set(p0.x, p0.y + 1.2, p0.z);
      root.add(b.hydTag);
    }
    if (b.ionJobs.length) {
      var p1 = b.ionJobs[0].ion.obj.position;
      b.ionTag = makeLabel('② 电离 → 放出 H⁺', { worldH: 0.4, size: 40, color: '#c62828' });
      b.ionTag.position.set(p1.x, p1.y + 1.2, p1.z);
      root.add(b.ionTag);
    }
  }
  function stepCompete(b, tt, dt) {
    (b.hydJobs || []).forEach(function (j) { stepHydroJob(j, dt); });
    (b.ionJobs || []).forEach(function (j) {
      if (j.done) return;
      j.t += dt;
      if (j.t < 1.4) return;
      var center = j.ion.obj.position.clone();
      var dir = randDir();
      removeActor(j.ion);
      j.prods = spawnProducts(center, j.spec.into, dir);
      j.done = true;
    });
    // 收尾：胜方的产物放大脉动一下
    if (tt > 3.4 && !b.marked) {
      b.marked = true;
      var win = b.winner === 'hydrolysis' ? b.hydJobs : b.ionJobs;
      (win || []).forEach(function (j) {
        var a = j.rel || (j.prods && j.prods[0]);
        if (a) a.obj.scale.setScalar(1.35);
      });
    }
    if (b.marked) {
      var all = (b.hydJobs || []).concat(b.ionJobs || []);
      all.forEach(function (j) {
        var a = j.rel || (j.prods && j.prods[0]);
        if (a) a.obj.scale.setScalar(1 + 0.25 * Math.sin(tt * 6));
      });
    }
  }
  function exitCompete(b) {
    if (b.hydTag) { root.remove(b.hydTag); disposeSprite(b.hydTag); b.hydTag = null; }
    if (b.ionTag) { root.remove(b.ionTag); disposeSprite(b.ionTag); b.ionTag = null; }
  }

  /* ---------------------------------------------- 纯水的动态平衡
   * H₂O ⇌ H⁺ + OH⁻ 两个方向同时跑：一对离子撞到一起变回水分子的同一瞬间，
   * 另一个水分子电离出新的一对 —— 数量始终 4 : 4，这就是「动态平衡」。 */
  function pickWaterNear(pos) {
    var ws = nearestWaters(pos, 1);
    return ws.length ? ws[0] : null;
  }
  function enterEquilibrium(b) {
    var hs = aliveActors().filter(function (a) { return a.kind === 'h'; });
    var ohs = aliveActors().filter(function (a) { return a.kind === 'oh'; });
    var n = Math.min(hs.length, ohs.length, b.pairs || 4);
    b.units = [];
    for (var i = 0; i < n; i++) {
      // 错峰启动，看起来就是「此起彼伏、一直在进行」
      b.units.push({ h: hs[i], oh: ohs[i], t: -i * 0.5, phase: 'free', born: 0 });
    }
    b.tag = makeLabel('H₂O ⇌ H⁺ + OH⁻ · 电离速率 = 结合速率', { worldH: 0.4, size: 40, color: '#43597a' });
    b.tag.position.set(0, BOX.y + 0.85, 0);
    root.add(b.tag);
  }
  function stepEquilibrium(b, tt, dt) {
    (b.units || []).forEach(function (u) {
      u.t += dt;
      // 刚从水分子里电离出来的那一对：由小长大，突出「诞生」
      if (u.born > 0) {
        u.born -= dt;
        var g = 1 - Math.max(0, u.born) / 0.45;
        if (!u.h.dead) u.h.obj.scale.setScalar(0.25 + 0.75 * g);
        if (!u.oh.dead) u.oh.obj.scale.setScalar(0.25 + 0.75 * g);
        if (u.born <= 0) { if (!u.h.dead) u.h.obj.scale.setScalar(1); if (!u.oh.dead) u.oh.obj.scale.setScalar(1); }
      }
      if (u.phase === 'free' && u.t > 0.9) {
        u.w = pickWaterNear(u.h.obj.position);
        if (!u.w) { u.t = 0; return; }
        u.phase = 'merge';
        u.t = 0;
        moveTo(u.h, u.w.obj.position.clone(), 0.5);
        moveTo(u.oh, u.w.obj.position.clone(), 0.5);
      } else if (u.phase === 'merge' && u.t >= 0.55) {
        // 旧的一对并入水分子的同一时刻，这个水分子电离出新的一对 → 总数不变
        var pos = u.w && !u.w.dead ? u.w.obj.position.clone() : u.h.obj.position.clone();
        var dir = randDir();
        var nh = newActor('h', 'H⁺', 1, COL.h, 0.145, { glow: true, free: true });
        var noh = newActor('oh', 'OH⁻', -1, COL.oh, 0.2, { glow: true, free: true });
        nh.obj.position.copy(pos);
        noh.obj.position.copy(pos);
        nh.obj.scale.setScalar(0.25);
        noh.obj.scale.setScalar(0.25);
        moveTo(nh, pos.clone().addScaledVector(dir, 1.05), 0.7);
        moveTo(noh, pos.clone().addScaledVector(dir, -1.05), 0.7);
        removeActor(u.h);
        removeActor(u.oh);
        u.h = nh;
        u.oh = noh;
        u.phase = 'free';
        u.t = 0;
        u.born = 0.45;
      }
    });
  }
  function exitEquilibrium(b) {
    if (b.tag) { root.remove(b.tag); disposeSprite(b.tag); b.tag = null; }
    (b.units || []).forEach(function (u) {
      if (!u.h.dead) u.h.obj.scale.setScalar(1);
      if (!u.oh.dead) u.oh.obj.scale.setScalar(1);
    });
  }

  /* ---------------------------------------------- 离子积：平衡移动
   * ① 溶质把该放的 H⁺ / OH⁻ 全部放出来（粒子数骤增）
   * ② 大量 H⁺ 撞上 OH⁻ 结合成水，OH⁻ 被消耗 —— 水的电离平衡左移
   * ③ 落到满足 c(H⁺)·c(OH⁻) = Kw 的终态：H⁺ 多、OH⁻ 少，但 OH⁻ 一个都没凭空消失 */
  function forceCounts(hWant, ohWant) {
    var c = counts();
    var hs = aliveActors().filter(function (a) { return a.kind === 'h'; });
    var ohs = aliveActors().filter(function (a) { return a.kind === 'oh'; });
    var i;
    for (i = 0; i < c.h - hWant && i < hs.length; i++) removeActor(hs[hs.length - 1 - i]);
    for (i = 0; i < c.oh - ohWant && i < ohs.length; i++) removeActor(ohs[ohs.length - 1 - i]);
    for (i = c.h; i < hWant; i++) {
      var a1 = newActor('h', 'H⁺', 1, COL.h, 0.145, { glow: true, free: true });
      a1.obj.position.set(rnd(-BOX.x * 0.8, BOX.x * 0.8), rnd(-BOX.y * 0.8, BOX.y * 0.8), rnd(-BOX.z * 0.8, BOX.z * 0.8));
    }
    for (i = c.oh; i < ohWant; i++) {
      var a2 = newActor('oh', 'OH⁻', -1, COL.oh, 0.2, { glow: true, free: true });
      a2.obj.position.set(rnd(-BOX.x * 0.8, BOX.x * 0.8), rnd(-BOX.y * 0.8, BOX.y * 0.8), rnd(-BOX.z * 0.8, BOX.z * 0.8));
    }
  }
  function enterKwShift(b) {
    var sol = aliveActors().filter(function (a) { return a.solute || a.role === 'active'; });
    b.src = sol.length ? sol : aliveActors();
    b.jobs = [];
    var i;
    for (i = 0; i < (b.addH || 0); i++) b.jobs.push({ kind: 'h', t: -(0.25 + i * 0.11), done: false });
    for (i = 0; i < (b.addOH || 0); i++) b.jobs.push({ kind: 'oh', t: -(0.25 + i * 0.11), done: false });
    b.quenchJobs = [];
    b.quenchAt = 0.3 + (b.jobs.length ? b.jobs.length * 0.11 : 0) + 0.9;
    b.phase = 'add';
    b.tag = null;
    b.setTag = function (txt, color) {
      if (b.tag) { root.remove(b.tag); disposeSprite(b.tag); b.tag = null; }
      b.tag = makeLabel(txt, { worldH: 0.42, size: 42, color: color || '#43597a' });
      b.tag.position.set(0, BOX.y + 0.9, 0);
      root.add(b.tag);
    };
    b.setTag(b.jobs.length ? '溶质继续放出离子 → 粒子数骤增' : '平衡左移：H⁺ + OH⁻ → H₂O', b.jobs.length ? '#c62828' : '#1565c0');
  }
  function stepKwShift(b, tt, dt) {
    var i;
    /* ① 补充：溶质继续放出 H⁺ / OH⁻ */
    (b.jobs || []).forEach(function (j, idx) {
      if (j.done) return;
      j.t += dt;
      if (j.t < 0) return;
      j.done = true;
      var isH = j.kind === 'h';
      var a = newActor(isH ? 'h' : 'oh', isH ? 'H⁺' : 'OH⁻', isH ? 1 : -1, isH ? COL.h : COL.oh,
        isH ? 0.145 : 0.2, { glow: true, free: true });
      var s = b.src[idx % b.src.length];
      var from = s && !s.dead ? s.obj.position.clone() : V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1));
      a.obj.position.copy(from);
      a.obj.scale.setScalar(0.3);
      b.grow = b.grow || [];
      b.grow.push(a);
      var to = V(rnd(-BOX.x * 0.85, BOX.x * 0.85), rnd(-BOX.y * 0.85, BOX.y * 0.85), rnd(-BOX.z * 0.85, BOX.z * 0.85));
      moveTo(a, to, 1.0);
    });
    if (b.grow) {
      b.grow = b.grow.filter(function (a) {
        if (a.dead) return false;
        var k = Math.min(1, a.obj.scale.x + dt * 2.2);
        a.obj.scale.setScalar(k);
        return k < 1;
      });
    }
    /* ② 平衡左移：多余的 H⁺ 与 OH⁻ 结合成水 */
    if (b.phase === 'add' && tt >= b.quenchAt) {
      b.phase = 'quench';
      b.setTag('平衡左移：H⁺ + OH⁻ → H₂O，OH⁻ 被消耗', '#1565c0');
      var hs = aliveActors().filter(function (a) { return a.kind === 'h'; });
      var ohs = aliveActors().filter(function (a) { return a.kind === 'oh'; });
      var n = Math.min(b.quench || 0, hs.length, ohs.length);
      for (i = 0; i < n; i++) {
        b.quenchJobs.push({ h: hs[hs.length - 1 - i], oh: ohs[ohs.length - 1 - i], t: -i * 0.45, phase: 'wait', done: false });
      }
      if (!n) b.phase = 'done';
    }
    (b.quenchJobs || []).forEach(function (j) {
      if (j.done) return;
      j.t += dt;
      if (j.phase === 'wait') {
        if (j.t < 0) return;
        var mid = j.h.obj.position.clone().add(j.oh.obj.position).multiplyScalar(0.5);
        j.mid = mid;
        moveTo(j.h, mid.clone(), 0.75);
        moveTo(j.oh, mid.clone(), 0.75);
        j.phase = 'move';
        j.t = 0;
      } else if (j.phase === 'move' && j.t >= 0.8) {
        makeWater(j.mid || j.h.obj.position.clone());
        removeActor(j.h);
        removeActor(j.oh);
        j.done = true;
      }
    });
    /* ③ 收尾：亮出 Kw 恒等式 */
    var allDone = (b.quenchJobs || []).every(function (j) { return j.done; });
    if (b.phase === 'quench' && allDone) {
      b.phase = 'done';
      b.setTag('c(H⁺)·c(OH⁻) = 1.0×10⁻¹⁴ = Kw（恒定）', '#00695c');
    }
    if (b.phase === 'done' && b.tag) {
      aliveActors().forEach(function (a) {
        if (a.kind === 'h' || a.kind === 'oh') a.obj.scale.setScalar(1 + 0.18 * Math.sin(tt * 6 + a.obj.position.x));
      });
    }
  }
  function exitKwShift(b) {
    if (b.tag) { root.remove(b.tag); disposeSprite(b.tag); b.tag = null; }
    aliveActors().forEach(function (a) { if (!a.dead) a.obj.scale.setScalar(1); });
    // 兜底校正：暂停 / 跳拍 / 拖进度条都可能打断动画，退出时强制对齐到满足 Kw 的终态
    if (b.h != null && b.oh != null) forceCounts(b.h, b.oh);
  }

  function enterTally(b) {
    var c = counts();
    var txt = c.h > c.oh ? 'c(H⁺) > c(OH⁻) → 酸性'
      : c.oh > c.h ? 'c(OH⁻) > c(H⁺) → 碱性'
        : 'c(H⁺) = c(OH⁻) → 中性';
    var color = c.h > c.oh ? '#c62828' : c.oh > c.h ? '#1565c0' : '#43597a';
    b.tag = makeLabel(txt, { worldH: 0.5, size: 50, color: color });
    b.tag.position.set(0, BOX.y + 0.9, 0);
    root.add(b.tag);
    notifyStep();
  }
  function stepTally(b, tt) {
    aliveActors().forEach(function (a) {
      if (a.kind === 'h' || a.kind === 'oh') {
        a.obj.scale.setScalar(1 + 0.2 * Math.sin(tt * 7 + a.obj.position.x));
      }
    });
  }
  function exitTally(b) {
    if (b.tag) { root.remove(b.tag); disposeSprite(b.tag); b.tag = null; }
    aliveActors().forEach(function (a) { a.obj.scale.setScalar(1); });
  }

  function buildBeats(script) {
    var out = [];
    (script || []).forEach(function (s) {
      var b = { kind: s.kind, title: s.title, text: s.text, dur: 2.2, enter: null, step: null, exit: null };
      switch (s.kind) {
        case 'intro': b.dur = 2.0; break;
        case 'equilibrium':
          b.dur = 4.2; b.pairs = s.pairs || 4;
          b.enter = enterEquilibrium; b.step = stepEquilibrium; b.exit = exitEquilibrium;
          break;
        case 'dissolve': b.dur = 2.4; b.enter = enterDissolve; b.step = stepDissolve; break;
        case 'ionize':
          b.dur = s.full ? 2.6 : 3.6;
          b.full = !!s.full;
          b.enter = enterIonize; b.step = stepIonize; b.exit = exitIonize;
          break;
        case 'hydrate': b.dur = 3.2; b.enter = enterHydrate; b.step = stepHydrate; b.exit = exitHydrate; break;
        case 'hydrolyze': b.dur = 3.6; b.spec = s.spec; b.enter = enterHydrolyze; b.step = stepHydrolyze; break;
        case 'ionizeIon': b.dur = 3.2; b.spec = s.spec; b.enter = enterIonizeIon; b.step = stepIonizeIon; break;
        case 'compete':
          b.dur = 5.0; b.hyd = s.hyd; b.ion = s.ion; b.winner = s.winner;
          b.enter = enterCompete; b.step = stepCompete; b.exit = exitCompete;
          break;
        case 'kwShift':
          b.dur = 5.6; b.addH = s.addH || 0; b.addOH = s.addOH || 0; b.quench = s.quench || 0;
          b.h = s.h; b.oh = s.oh;
          b.enter = enterKwShift; b.step = stepKwShift; b.exit = exitKwShift;
          break;
        case 'tally': b.dur = 4.0; b.enter = enterTally; b.step = stepTally; b.exit = exitTally; break;
        default: break;
      }
      out.push(b);
    });
    return out;
  }

  /* ------------------------------------------------------------ 建场 */
  function buildCase(c, script, fromBeat, play) {
    curCase = c;
    player.rawScript = script; // 留着：倒退 / 重播时用它重建场景（前进模型无法反向撤销）
    clearScene();
    var i;
    for (i = 0; i < 22; i++) {
      makeWater(V(rnd(-BOX.x, BOX.x), rnd(-BOX.y, BOX.y), rnd(-BOX.z, BOX.z)));
    }
    // 纯水的基线：H⁺、OH⁻ 各 4 个（纯水浓度记作 1.0×10⁻⁷），4 × 4 = 16 = 离子积 Kw 的粒子数常数。
    // 之后任何一步都必须满足 h × oh = 16 —— H⁺ 变多，OH⁻ 就一定变少。
    var KW_BASE = 4;
    for (i = 0; i < KW_BASE; i++) {
      var hp = spreadPos(i, KW_BASE);
      var h0 = newActor('h', 'H⁺', 1, COL.h, 0.145, { glow: true, free: true });
      h0.obj.position.set(hp.x * 0.8, hp.y * 0.7 - 0.6, hp.z);
      var o0 = newActor('oh', 'OH⁻', -1, COL.oh, 0.2, { glow: true, free: true });
      o0.obj.position.set(-hp.x * 0.8 + 0.6, -hp.y * 0.7 - 0.6, -hp.z);
    }

    // 溶质先藏起来：第一拍要展示的是「纯水的动态平衡」，溶质等溶解那一步再登场
    if (c.form === 'salt') {
      for (i = 0; i < 3; i++) {
        (c.ions || []).forEach(function (ion) {
          var a = newActor('ion', ion.label, ion.charge, colorOf(ion.label, ion.charge),
            radiusOf(ion.label, ion.charge), { solute: true, role: ion.role });
          a.obj.position.set(rnd(-0.35, 0.35), rnd(-0.35, 0.35), rnd(-0.35, 0.35));
          a.obj.visible = false;
        });
      }
    } else {
      for (i = 0; i < 3; i++) {
        var m = newActor('mol', c.molecule || c.formula, 0, COL.mol, 0.26, { solute: true });
        m.obj.position.set(rnd(-0.4, 0.4), rnd(-0.4, 0.4), rnd(-0.4, 0.4));
        m.obj.visible = false;
      }
    }

    player.list = buildBeats(script);
    player.speed = 1;
    player.cur = null;
    var target = 0;
    if (typeof fromBeat === 'number' && fromBeat > 0) {
      target = Math.min(Math.round(fromBeat), player.list.length - 1);
    }
    player.from = target;
    // 把目标拍之前的节拍瞬间跑完，保证场景状态是「已经走到这一步」
    for (var k = 0; k < target; k += 1) fastForward(player.list[k]);
    gotoBeat(target);
    player.playing = play !== false;
    notifyStep();
  }

  /* ------------------------------------------------------------ 主循环 */
  var last = 0;
  function tick(dt) {
    var i;
    for (i = 0; i < waters.length; i++) {
      var w = waters[i];
      if (w.dead) continue;
      if (w.scripted) updateScriptedW(w, dt);
      else if (!w.holding) {
        drift(w.obj, w.vel, dt, 0.6, 0.42);
        w.obj.rotation.x += w.spin.x * dt * 0.5;
        w.obj.rotation.y += w.spin.y * dt * 0.5;
      }
    }
    var list = aliveActors();
    for (i = 0; i < list.length; i++) {
      var a = list[i];
      if (a.scripted) updateScripted(a, dt);
      else drift(a.obj, a.vel, dt, 0.5, 0.45);
    }

    if (player.cur && player.playing) {
      var d = dt * (player.speed || 1);
      player.t += d;
      if (player.cur.step) {
        try { player.cur.step(player.cur, player.t, d); } catch (e) { /* noop */ }
      }
      if (player.t >= player.cur.dur) {
        if (player.i < player.list.length - 1) gotoBeat(player.i + 1);
        else { player.playing = false; notifyStep(); }
      }
    }
    if (cam.auto) { cam.theta += dt * 0.05; applyCam(); }
    renderer.render(scene, camera);
  }
  function loop(now) {
    requestAnimationFrame(loop);
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    tick(dt);
  }

  /* ------------------------------------------------------------ 命令 */
  function handleAcid(m) {
    if (m.case && m.script) {
      buildCase(m.case, m.script, m.from, m.play);
      resetView(); // 换物质 / 重开练习时视角回到出厂位置（用户平移过也不残留）
    }
  }
  /** 倒退 / 重播：前进的节拍无法反向撤销（粒子已经生成过），干脆重建场景再快进到目标拍 */
  function replayTo(i, keepPlaying) {
    if (!curCase || !player.rawScript) return;
    var wasPlaying = keepPlaying === undefined ? player.playing : keepPlaying;
    buildCase(curCase, player.rawScript, i, wasPlaying);
  }
  function handleCtl(m) {
    var act = m.action;
    if (act === 'play') { player.playing = true; notifyStep(); }
    else if (act === 'pause') { player.playing = false; notifyStep(); }
    else if (act === 'toggle') { player.playing = !player.playing; notifyStep(); }
    else if (act === 'next') gotoBeat(player.i + 1);
    else if (act === 'prev') replayTo(player.i - 1);
    else if (act === 'restart') replayTo(player.from || 0, true);
    else if (act === 'goto' && m.step != null) replayTo(clamp(Number(m.step) - 1, 0, player.list.length - 1));
    else if (act === 'speed') player.speed = clamp(Number(m.value) || 1, 0.4, 2.5);
    else if (act === 'cam') resetView();
  }

  /* ---- 视角：方向盘平移观察中心 / 复位 ---- */
  var WORLD_UP = new THREE.Vector3(0, 1, 0);
  var _pf = new THREE.Vector3(), _pr = new THREE.Vector3(), _pu = new THREE.Vector3();
  /** 以"屏幕方向"为基准平移观察中心：left/right 水平，up/down 垂直（与化学引擎 panCamera 一致） */
  function panCamera(dir) {
    var dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    var dy = dir === 'up' ? 1 : dir === 'down' ? -1 : 0;
    if (!dx && !dy) return;
    var step = 0.9;
    _pf.subVectors(cam.target, camera.position);
    if (_pf.lengthSq() < 1e-6) _pf.set(0, 0, -1);
    _pf.normalize();
    _pr.crossVectors(_pf, WORLD_UP);
    if (_pr.lengthSq() < 1e-6) _pr.set(1, 0, 0);
    _pr.normalize();
    _pu.crossVectors(_pr, _pf).normalize();
    var lim = { x: BOX.x + 1.4, y: BOX.y + 1.4, z: BOX.z + 1.4 };
    cam.target.set(
      clamp(cam.target.x + (_pr.x * dx + _pu.x * dy) * step, -lim.x, lim.x),
      clamp(cam.target.y + (_pr.y * dx + _pu.y * dy) * step, -lim.y, lim.y),
      clamp(cam.target.z + (_pr.z * dx + _pu.z * dy) * step, -lim.z, lim.z)
    );
    cam.auto = false; // 用户手动平移后停止自动巡游，交给用户控制
    applyCam();
  }
  /** 角度、距离、观察中心全部归位 */
  function resetView() {
    cam.theta = -0.45; cam.phi = 1.16; cam.dist = 10.4;
    cam.target.set(0, 0, 0);
    cam.auto = true;
    applyCam();
  }

  function handleCommand(msg) {
    var m = msg;
    if (typeof m === 'string') { try { m = JSON.parse(m); } catch (e) { return; } }
    if (!m || typeof m !== 'object') return;
    if (m.cmd === 'ping') { notify({ ev: 'ready' }); return; }
    if (m.cmd === 'shake') { hint('拖动可以转视角，双指捏合缩放'); return; }
    if (m.cmd === 'acid') {
      try { handleAcid(m); } catch (e) { showErr('酸碱性引擎错误：' + (e && e.message || e)); }
      return;
    }
    if (m.cmd === 'acidCtl') { handleCtl(m); return; }
    if (m.cmd === 'view') {
      if (m.action === 'pan') panCamera(m.dir);
      else if (m.action === 'reset') resetView();
      return;
    }
  }
  window.addEventListener('message', function (e) { handleCommand(e.data); });
  window.__dispatch = handleCommand;
  window.ACID = {
    debug: function () {
      return { waters: waters.length, actors: aliveActors().length, beat: player.i + 1, playing: player.playing };
    },
  };

  /* ------------------------------------------------------------ 起步 */
  var i0;
  for (i0 = 0; i0 < 22; i0++) {
    makeWater(V(rnd(-BOX.x, BOX.x), rnd(-BOX.y, BOX.y), rnd(-BOX.z, BOX.z)));
  }
  resize();
  applyCam();
  requestAnimationFrame(loop);
  if (bootEl) setTimeout(function () { bootEl.classList.add('hide'); }, 240);
  notify({ ev: 'ready' });
})();
