/* 高中化学 3D 学习引擎（three.js）。
 * 运行于独立 HTML（iframe / WKWebView），通过 postMessage 与 RN 宿主通信。 */
(function () {
  'use strict';

  var DATA = window.CHEM_DATA;
  var hasThree = typeof THREE !== 'undefined';

  /* ---------------- 基础工具 ---------------- */
  function byId(id) { return document.getElementById(id); }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function round3(v) { return Math.round(v * 100) / 100; }

  var elemMap = {};
  var molMap = {};
  if (DATA) {
    DATA.elements.forEach(function (e) { elemMap[e.symbol] = e; });
    DATA.molecules.forEach(function (m) { molMap[m.id] = m; });
  }

  function elementOf(z) {
    for (var i = 0; i < DATA.elements.length; i++) {
      if (DATA.elements[i].p === z) return DATA.elements[i];
    }
    return null;
  }

  var MAT_BOND = new THREE.Color(0xcfd8e8);
  var MAT_BOND_IONIC = new THREE.Color(0x9aa8c0);
  var MAT_BOND_VDW = new THREE.Color(0x8a63d2);

  function colorOf(el) { return new THREE.Color(elemMap[el] ? elemMap[el].color : '#b0b0b0'); }

  function stdMat(hex, opts) {
    opts = opts || {};
    return new THREE.MeshStandardMaterial({
      color: hex, roughness: opts.roughness !== undefined ? opts.roughness : 0.38,
      metalness: opts.metalness !== undefined ? opts.metalness : 0.04,
      transparent: true, opacity: opts.opacity !== undefined ? opts.opacity : 1,
      depthWrite: true
    });
  }

  /* 文字精灵（Canvas 纹理） */
  function textSprite(str, opts) {
    opts = opts || {};
    var color = opts.color || '#31425f';
    var size = opts.size || 46;
    var fontWeight = opts.bold ? 700 : 500;
    var font = fontWeight + ' ' + size + 'px -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif';
    var pad = 10;
    var cv = document.createElement('canvas');
    var ctx = cv.getContext('2d');
    ctx.font = font;
    var w = Math.ceil(ctx.measureText(str).width) + pad * 2;
    var h = Math.ceil(size * 1.4) + pad;
    cv.width = w; cv.height = h;
    ctx.font = font;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255,255,255,0.85)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.fillText(str, w / 2, h / 2);
    var tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearFilter;
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    var worldH = opts.worldH || 0.62;
    spr.userData = { color: color, size: size, bold: !!opts.bold, worldH: worldH };
    spr.scale.set((w / h) * worldH, worldH, 1);
    return spr;
  }
  // 重绘已有文字精灵的内容（用于把“Zn”更新为“Zn²⁺”等）
  function setSpriteText(spr, str, colorOverride) {
    if (!spr) return;
    var u = spr.userData || { size: 46, worldH: 0.62, bold: true };
    var color = colorOverride || u.color || '#31425f';
    var size = u.size || 46;
    var font = (u.bold ? 700 : 500) + ' ' + size + 'px -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif';
    var cv = document.createElement('canvas');
    var ctx = cv.getContext('2d');
    ctx.font = font;
    var w = Math.ceil(ctx.measureText(str).width) + 20;
    var h = Math.ceil(size * 1.4) + 10;
    cv.width = w; cv.height = h;
    ctx.font = font;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255,255,255,0.85)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.fillText(str, w / 2, h / 2);
    var tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearFilter;
    if (spr.material) { spr.material.map = tex; spr.material.needsUpdate = true; }
    spr.scale.set((w / h) * (u.worldH || 0.62), (u.worldH || 0.62), 1);
    spr.userData.color = color;
    spr.userData.str = str;
  }

  /* 沿 from->to 画键（支持 1/2/3 键、离子键样式，以及 vdw 虚线：层间范德华力） */
  function buildBond(mesh, from, to, order, style) {
    var group = new THREE.Group();
    var axis = new THREE.Vector3().subVectors(to, from);
    var len = axis.length();
    if (len < 1e-4) return group;
    var nAxis = axis.clone().normalize();
    if (style === 'vdw') {
      // 虚线：沿轴向摆一串短线，用来表示范德华力这类“弱相互作用”（不是化学键）
      var unit = clamp(Math.round(len / 0.62), 3, 9);
      var dashGeo = new THREE.CylinderGeometry(0.05, 0.05, (len / unit) * 0.5, 8);
      var dashMat = new THREE.MeshStandardMaterial({
        color: MAT_BOND_VDW, transparent: true, opacity: 0.55, roughness: 0.6
      });
      for (var d = 0; d < unit; d++) {
        var c = from.clone().lerp(to, (d + 0.5) / unit);
        var dm = new THREE.Mesh(dashGeo, dashMat);
        dm.position.copy(c);
        dm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nAxis);
        group.add(dm);
      }
      group.userData.vdw = true;
      return group;
    }
    // 求垂直于轴的参考方向
    var ref = new THREE.Vector3(0, 1, 0);
    if (Math.abs(nAxis.y) > 0.9) ref.set(1, 0, 0);
    var u = new THREE.Vector3().crossVectors(nAxis, ref).normalize();
    var offs;
    if (style === 'ionic' || order <= 1) offs = [0];
    else if (order === 2) offs = [-0.105, 0.105];
    else offs = [-0.12, 0, 0.12];
    var rad = style === 'ionic' ? 0.042 : 0.085;
    var geo = new THREE.CylinderGeometry(rad, rad, 1, 10);
    var mat;
    if (style === 'ionic') {
      mat = new THREE.MeshStandardMaterial({ color: MAT_BOND_IONIC, transparent: true, opacity: 0.85, roughness: 0.5 });
    } else {
      mat = new THREE.MeshStandardMaterial({ color: MAT_BOND, transparent: true, roughness: 0.5, metalness: 0.02 });
    }
    for (var i = 0; i < offs.length; i++) {
      var m = new THREE.Mesh(geo, mat);
      var c = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
      if (offs[i]) c.addScaledVector(u, offs[i]);
      m.position.copy(c);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nAxis);
      m.scale.y = len;
      m.userData.view = { from: from.clone(), to: to.clone() };
      m.visible = true;
      group.add(m);
    }
    group.userData.ionic = style === 'ionic';
    return group;
  }

  /* ---------------- DOM / 引导页 ---------------- */
  var appEl = byId('app');
  var bootEl = byId('boot');
  var hintEl = byId('hint');
  var hintText = byId('hintText');
  var centerMsgEl = byId('centerMsg');
  var errMsgEl = byId('errMsg');
  var tooltip = null;

  function makeTooltip() {
    tooltip = document.createElement('div');
    tooltip.id = 'tooltip';
    document.body.appendChild(tooltip);
  }

  function showHint(t, ms) {
    hintText.textContent = t;
    hintEl.classList.add('show');
    if (ms) setTimeout(function () { hintEl.classList.remove('show'); }, ms);
  }

  var centerTimer = null;
  function showCenter(text, cls) {
    centerMsgEl.innerHTML = '';
    var d = document.createElement('div');
    d.className = 'msg' + (cls ? ' ' + cls : '');
    d.textContent = text;
    centerMsgEl.appendChild(d);
    requestAnimationFrame(function () { d.classList.add('show'); });
    if (centerTimer) clearTimeout(centerTimer);
    centerTimer = setTimeout(function () {
      d.classList.remove('show');
    }, 2600);
  }

  function showError(t) {
    if (!errMsgEl) return;
    errMsgEl.innerHTML = '<div class="errbox">' + t + '</div>';
    if (bootEl) bootEl.classList.add('hide');
  }

  /* ---------------- three.js 初始化 ---------------- */
  var renderer, scene, camera;
  var W = window.innerWidth, H = window.innerHeight;
  var view = null; // 当前视图 {kind, id, root, update, atomMeshes, cleanups, autorotate, selected}
  var stageGroup = null; // 背景舞台盘（原子视图时隐藏，避免干扰电子层）

  function initGL() {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    appEl.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, W / H, 0.05, 3000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbcc9dd, 0.95));
    var dl = new THREE.DirectionalLight(0xffffff, 1.1);
    dl.position.set(4, 8, 6);
    scene.add(dl);
    var fill = new THREE.DirectionalLight(0xbcd3ff, 0.4);
    fill.position.set(-5, -2, -6);
    scene.add(fill);
    camera.position.set(5, 3, 9);

    // 舞台底盘已按要求移除（不再绘制灰色圆环 / 圆盘），场景保持干净渐变背景
    stageGroup = new THREE.Group();
    scene.add(stageGroup);
  }

  /* ---------------- 相机 & 控制 ---------------- */
  var camState = { az: 0.7, pl: 0.42, radius: 10 };
  var camTarget = new THREE.Vector3(0, 0.2, 0);
  // 观察中心的目标位置：方向键平移 / 分步自动居中都会改写它，主循环里平滑逼近
  var camTargetGoal = new THREE.Vector3(0, 0.2, 0);
  var autoRotate = false;
  var lastInteract = -10;
  var pointers = new Map();
  var dragActive = false;
  var tapInfo = { x: 0, y: 0, t: 0, moved: 0 };
  var pinchDist = 0;
  var mouseX = 0, mouseY = 0;
  // 用户是否手动缩放过画布：没缩放过才允许在画幅变化时自动重新取景
  var userZoomed = false;

  function applyCamera() {
    var cp = new THREE.Vector3();
    cp.x = Math.cos(camState.az) * Math.cos(camState.pl) * camState.radius + camTarget.x;
    cp.y = Math.sin(camState.pl) * camState.radius + camTarget.y;
    cp.z = Math.sin(camState.az) * Math.cos(camState.pl) * camState.radius + camTarget.z;
    camera.position.copy(cp);
    camera.lookAt(camTarget);
  }

  function clampCam() {
    camState.pl = clamp(camState.pl, -1.35, 1.45);
    if (view && view.fitR) {
      camState.radius = clamp(camState.radius, view.fitR * 1.5, view.fitR * 40);
    } else {
      camState.radius = clamp(camState.radius, 1.5, 200);
    }
  }

  /* ---------------- 观察中心平移（水平 / 垂直） ---------------- */
  var _panFwd = new THREE.Vector3();
  var _panRight = new THREE.Vector3();
  var _panUp = new THREE.Vector3();
  var WORLD_UP = new THREE.Vector3(0, 1, 0);

  // 限制观察中心不要跑出内容太远（以当前视图的“归位中心”为基准）
  function clampTargetGoal() {
    if (!view) return;
    var base = view.homeTarget || camTarget;
    var lim = Math.max((view.fitR || 1.2) * 2.4, 1.2);
    camTargetGoal.x = clamp(camTargetGoal.x, base.x - lim, base.x + lim);
    camTargetGoal.y = clamp(camTargetGoal.y, base.y - lim, base.y + lim);
    camTargetGoal.z = clamp(camTargetGoal.z, base.z - lim, base.z + lim);
  }

  // 以“屏幕方向”为基准平移观察中心：left/right 水平，up/down 垂直
  function panCamera(dir) {
    if (!view) return;
    var dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    var dy = dir === 'up' ? 1 : dir === 'down' ? -1 : 0;
    if (!dx && !dy) return;
    var step = Math.max((view.fitR || 1.2) * 0.32, 0.4);
    _panFwd.subVectors(camTarget, camera.position);
    if (_panFwd.lengthSq() < 1e-6) _panFwd.set(0, 0, -1);
    _panFwd.normalize();
    _panRight.crossVectors(_panFwd, WORLD_UP);
    if (_panRight.lengthSq() < 1e-6) _panRight.set(1, 0, 0);
    _panRight.normalize();
    _panUp.crossVectors(_panRight, _panFwd).normalize();
    camTargetGoal.addScaledVector(_panRight, dx * step);
    camTargetGoal.addScaledVector(_panUp, dy * step);
    clampTargetGoal();
    lastInteract = performance.now();
    autoRotate = false;
    // 用户手动平移过：反应场景的自动取景（跟拍）停止接管，直到重置视角
    if (view) view.userFramed = true;
  }

  // 把观察中心移到指定点（用于“重置视角”与分步自动居中）
  function focusTarget(x, y, z) {
    camTargetGoal.set(x, y, z);
    clampTargetGoal();
  }

  function pointNdc(e) {
    return { x: (e.clientX / W) * 2 - 1, y: -(e.clientY / H) * 2 + 1 };
  }

  function setupInput() {
    var el = renderer.domElement;

    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return; // 手指触摸交给下面的 touch 逻辑处理
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        tapInfo = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
        dragActive = false;
      } else if (pointers.size === 2) {
        var p = Array.from(pointers.values());
        pinchDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      }
      e.preventDefault();
    });

    function move(e) {
      if (!pointers.has(e.pointerId)) return;
      var prev = pointers.get(e.pointerId);
      var dx = e.clientX - prev.x;
      var dy = e.clientY - prev.y;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 1) {
        tapInfo.moved += Math.abs(dx) + Math.abs(dy);
        if (tapInfo.moved > 6) dragActive = true;
        if (dragActive) {
          camState.az -= dx * 0.0065;
          camState.pl += dy * 0.0065;
          lastInteract = performance.now();
          autoRotate = false;
          clampCam();
          renderer.domElement.classList.add('dragging');
        } else {
          mouseX = e.clientX; mouseY = e.clientY;
          hoverPick(e);
        }
      } else if (pointers.size === 2) {
        var p = Array.from(pointers.values());
        var d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        if (pinchDist > 0 && d > 0) {
          camState.radius = clamp(camState.radius * (pinchDist / d), 0.5, 400);
          clampCam();
          lastInteract = performance.now();
          userZoomed = true;
        }
        pinchDist = d;
      }
    }

    el.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      mouseX = e.clientX; mouseY = e.clientY;
      if (pointers.size === 0) { hoverPick(e); return; }
      move(e);
    });

    setupTouch(el);

    function up(e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      var wasTap = !dragActive && pointers.size === 0 && tapInfo.moved < 7 &&
        (performance.now() - tapInfo.t) < 700;
      if (wasTap) tapPick(tapInfo.x, tapInfo.y);
      if (pointers.size === 0) {
        dragActive = false;
        renderer.domElement.classList.remove('dragging');
        pinchDist = 0;
        if (autoRotateResume()) showHint('轻点原子可查看其电子结构', 1800);
      }
    }
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', function () {
      if (pointers.size === 0) hideTooltip();
    });

    el.addEventListener('wheel', function (e) {
      e.preventDefault();
      camState.radius *= (1 + Math.sign(e.deltaY) * 0.09);
      clampCam();
      lastInteract = performance.now();
      userZoomed = true;
    }, { passive: false });

    window.addEventListener('resize', onResize);
  }

  /**
   * 触摸手势：一指旋转、双指捏合缩放画布。
   * 之前只用 pointer 事件，iOS 的 WKWebView 里多指 pointer 事件不齐套，
   * 加上它会把双指当成“页面缩放”，所以这里用 touch 事件单独实现一遍。
   */
  function setupTouch(el) {
    var touches = new Map(); // id -> {x, y}

    function stoppable(e) {
      if (e.cancelable) e.preventDefault();
    }

    el.addEventListener('touchstart', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        touches.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
      if (touches.size === 1) {
        var only = Array.from(touches.values())[0];
        tapInfo = { x: only.x, y: only.y, t: performance.now(), moved: 0 };
        dragActive = false;
        pinchDist = 0;
      } else if (touches.size >= 2) {
        var p = Array.from(touches.values());
        pinchDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        dragActive = false;
        tapInfo.moved = 999; // 双指捏合不算“点一下”，抬手时不要触发拾取
      }
      stoppable(e);
    }, { passive: false });

    el.addEventListener('touchmove', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var tn = e.changedTouches[i];
        var prev = touches.get(tn.identifier);
        if (!prev) continue;
        var dx = tn.clientX - prev.x;
        var dy = tn.clientY - prev.y;
        prev.x = tn.clientX; prev.y = tn.clientY;

        if (touches.size === 1) {
          tapInfo.moved += Math.abs(dx) + Math.abs(dy);
          if (tapInfo.moved > 6) dragActive = true;
          if (dragActive) {
            camState.az -= dx * 0.0065;
            camState.pl += dy * 0.0065;
            lastInteract = performance.now();
            autoRotate = false;
            clampCam();
            renderer.domElement.classList.add('dragging');
          }
        }
      }
      if (touches.size >= 2) {
        var p = Array.from(touches.values());
        var d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        if (pinchDist > 0 && d > 0) {
          camState.radius = clamp(camState.radius * (pinchDist / d), 0.5, 400);
          clampCam();
          lastInteract = performance.now();
          userZoomed = true;
        }
        pinchDist = d;
      }
      stoppable(e);
    }, { passive: false });

    function end(e) {
      for (var i = 0; i < e.changedTouches.length; i++) touches.delete(e.changedTouches[i].identifier);
      if (touches.size === 0) {
        var wasTap = !dragActive && tapInfo.moved < 10 && (performance.now() - tapInfo.t) < 700;
        if (wasTap) tapPick(tapInfo.x, tapInfo.y);
        dragActive = false;
        renderer.domElement.classList.remove('dragging');
        pinchDist = 0;
        if (autoRotateResume()) showHint('轻点原子可查看其电子结构', 1800);
      }
      stoppable(e);
    }
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });

    // 拦住 WKWebView / Safari 自己的“双指页面缩放”，否则双指会被系统吃掉
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (n) {
      document.addEventListener(n, function (e) { e.preventDefault(); }, { passive: false });
    });
  }

  function onResize() {
    var prevAspect = camera.aspect;
    W = Math.max(1, window.innerWidth);
    H = Math.max(1, window.innerHeight);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H);
    // 画布尺寸 / 转屏变化：用户没手动缩放过时按新画幅重新取景，避免内容被切边
    // （含首次拿到真实尺寸的情况 —— 之前 W/H 可能是 0，aspect 是 NaN）
    var changed = !isFinite(prevAspect) || Math.abs(prevAspect - camera.aspect) > 0.02;
    if (view && view.fitR && changed && performance.now() - lastInteract > 1000 && !userZoomed) {
      camState.radius = fitDistance(view.fitR);
      clampCam();
    }
  }

  function autoRotateResume() {
    // 俯视时保持画面稳定（不恢复相机自转）
    if (view && view.autorotate && view.camMode !== 'top') {
      autoRotate = true;
      return true;
    }
    return false;
  }

  /* ---------------- 拾取 ---------------- */
  var raycaster = new THREE.Raycaster();
  var selected = null;

  function pickAt(px, py) {
    if (!view || !view.atomMeshes || !view.atomMeshes.length) return null;
    var ndc = { x: (px / W) * 2 - 1, y: -(py / H) * 2 + 1 };
    raycaster.setFromCamera(ndc, camera);
    var hits = raycaster.intersectObjects(view.atomMeshes, false);
    return hits.length ? hits[0].object : null;
  }

  function clearSelection() {
    if (selected) {
      if (selected.userData.mat0) selected.material.emissive = selected.userData.mat0;
      selected = null;
    }
  }

  // 拾取可点击的分子式标签精灵（仅在反应视图启用）
  function pickSpriteAt(px, py) {
    if (!view || !view.pickSprites || !view.pickSprites.length) return null;
    var ndc = { x: (px / W) * 2 - 1, y: -(py / H) * 2 + 1 };
    raycaster.setFromCamera(ndc, camera);
    var list = [];
    view.pickSprites.forEach(function (s) { if (s.visible) list.push(s); });
    if (!list.length) return null;
    var hits = raycaster.intersectObjects(list, false);
    return hits.length ? hits[0].object : null;
  }

  function tapPick(x, y) {
    // 优先拾取“分子式标签”：点击即打开对应分子 3D 结构
    var spr = pickSpriteAt(x, y);
    if (spr) {
      var mol = spr.userData && (spr.userData.mol || molMap[spr.userData.molId]);
      if (mol) {
        showCenter(mol.name + ' · ' + mol.formula + ' 已打开', 'cond');
        notify({ ev: 'formulaTap', id: mol.id, molId: mol.id, mol: mol, name: mol.name });
        return;
      }
    }
    var obj = pickAt(x, y);
    if (!obj) { clearSelection(); hideTooltip(); return; }
    clearSelection();
    selected = obj;
    if (!obj.userData.mat0) obj.userData.mat0 = obj.material.emissive.clone();
    obj.material.emissive = new THREE.Color(0xffc400);
    obj.material.emissiveIntensity = 0.9;
    var sym = obj.userData.element;
    var el = elemMap[sym];
    hideTooltip();
    showCenter(el.name + ' ' + sym + ' · 原子序数 ' + el.p, 'cond');
    notify({
      ev: 'atomPick', symbol: sym, name: el.name, z: el.p,
      mol: obj.userData.mol, ai: obj.userData.ai
    });
  }

  var hoverTimer = null;
  function hoverPick(e) {
    if (pointers.size > 0) return;
    if (!e) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function () {
      var obj = pickAt(e.clientX, e.clientY);
      if (!obj) { hideTooltip(); return; }
      var el = elemMap[obj.userData.element];
      if (!el) return;
      tooltip.textContent = el.symbol + '  ' + el.name;
      tooltip.style.display = 'block';
      var off = 6;
      tooltip.style.left = Math.min(Math.max(e.clientX, 40), W - 40) + 'px';
      tooltip.style.top = (e.clientY - off) + 'px';
    }, 28);
  }
  function hideTooltip() { if (tooltip) tooltip.style.display = 'none'; }

  /* ---------------- 视图框架 ---------------- */
  var sceneRoot = new THREE.Group(); // 装载所有可视内容（main() 中 initGL() 后挂入 scene）

  // 舞台灰色圆盘：分子/反应视图保留辅助感知空间，原子层级视图隐藏以免干扰
  function setStageVisible(v) {
    if (stageGroup) stageGroup.visible = !!v;
  }

  function clearView() {
    clearSelection();
    hideTooltip();
    autoRotate = false;
    radiusState = null; // 半径比实验室的场景状态随视图一起清空
    atomBond = null;    // 共价键形成演示同样随视图清空
    if (view && view.cleanups) {
      view.cleanups.forEach(function (f) { try { f(); } catch (e) {} });
    }
    for (var i = sceneRoot.children.length - 1; i >= 0; i--) {
      var c = sceneRoot.children[i];
      sceneRoot.remove(c);
      disposeDeep(c);
    }
    view = null;
  }

  function disposeDeep(obj) {
    obj.traverse(function (n) {
      if (n.geometry) n.geometry.dispose();
      if (n.material) {
        var ms = Array.isArray(n.material) ? n.material : [n.material];
        ms.forEach(function (m) {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      }
    });
  }

  /**
   * 让半径为 r 的包围球完整进画面所需的相机距离。
   * 关键点：fov 是纵向视角，横向可视范围 = 纵向 × aspect。
   * 手机竖屏（aspect < 1）时横向比纵向窄得多，只按纵向算的话
   * 横向摆着的分子（比如 N₂）两头就会顶出屏幕 —— 必须取两者里较小的那个方向。
   */
  function fitDistance(r, margin) {
    var m = margin === undefined ? 1.15 : margin;
    var vHalf = (camera.fov * Math.PI) / 360;
    var hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    var minHalf = Math.min(vHalf, hHalf);
    return (r * m) / Math.sin(minHalf);
  }

  function fitView(root, minR) {
    var box = new THREE.Box3().setFromObject(root);
    var sphere = box.getBoundingSphere(new THREE.Sphere());
    var r = Math.max(sphere.radius, minR || 1.2);
    var c = sphere.center;
    camTarget.copy(c);
    camTargetGoal.copy(c);
    view.homeTarget = c.clone();
    view.fitR = r;
    view.minR = minR || 1.2;
    camState.radius = fitDistance(r);
    camState.pl = clamp(camState.pl, 0.3, 0.7);
    camState.az = camState.az || 0.7;
    autoRotate = true;
    userZoomed = false;
    clampCam();
  }

  /* 原子视图取景：按“上下遮挡带”把原子核放到可视带中央。
   * 屏幕上下分别被顶部导航与底部信息卡占住（手机竖屏尤其明显），
   * 只按全屏取景的话原子核落在屏幕正中，相对“可视带”就是偏下的
   * （收起底部卡片后看着才居中）。这里和反应场景一样：
   * 观察中心下移 lift，内容即被抬到可视带中央；纵向真装不下时才适当拉远。 */
  function frameAtomView() {
    if (!view || view.kind !== 'atom') return;
    var r = view.fitR || 1.2;
    var top = clamp(rxBand.top || 0, 0, 0.4);
    var bottom = clamp(rxBand.bottom || 0, 0, 0.6);
    var vHalf = (camera.fov * Math.PI) / 360;
    var hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    var usable = Math.max(0.35, 1 - top - bottom);
    var needH = (r * 1.15) / Math.sin(hHalf);            // 横向不被裁（竖屏多半由它决定）
    var needV = (r * 1.06) / (Math.tan(vHalf) * usable); // 纵向装进可视带
    var need = Math.max(needH, needV);
    camState.radius = need;
    var visH = 2 * need * Math.tan(vHalf);
    var lift = visH * Math.max(0, (bottom - top) / 2);
    // 内容已回中到原点，观察中心下移 lift 即把原子核抬到可视带中央
    camTarget.set(0, -lift, 0);
    camTargetGoal.set(0, -lift, 0);
    view.homeTarget = new THREE.Vector3(0, -lift, 0);
    clampCam();
  }

  function setViewRotation(root, rot) {
    if (!rot) return;
    root.rotation.set(rot.rx || 0, rot.ry || 0, rot.rz || 0);
  }

  /* ================= 分子（球棍模型） ================= */
  var atomGeos = {};
  function ballGeo(r) {
    var key = String(Math.round(r * 1000));
    if (!atomGeos[key]) atomGeos[key] = new THREE.SphereGeometry(r, 28, 20);
    return atomGeos[key];
  }
  var cylGeo = new THREE.CylinderGeometry(1, 1, 1, 12);

  function buildMoleculeGroup(mol) {
    var root = new THREE.Group();
    var meshes = [];
    if (!mol.atoms || !mol.atoms.length) return { root: root, meshes: meshes };
    var pos = mol.atoms.map(function (a) { return new THREE.Vector3(a.pos[0], a.pos[1], a.pos[2]); });
    pos.forEach(function (p, i) {
      var el = mol.atoms[i].el;
      var radius = elemMap[el] ? elemMap[el].radius * 0.86 : 0.4;
      var m = new THREE.Mesh(ballGeo(radius), stdMat(colorOf(el)));
      m.position.copy(p);
      m.userData = { element: el, mol: mol.id, ai: i };
      meshes.push(m);
      root.add(m);
    });
    (mol.bonds || []).forEach(function (b) {
      var from = pos[b.a], to = pos[b.b];
      var g = buildBond(null, from, to, b.order || 1, b.style);
      root.add(g);
    });
    return { root: root, meshes: meshes };
  }

  /* 分子球棍模型上，每个原子的“元素符号”标注（跟随分子一起旋转） */
  function buildMoleculeLabels(mol) {
    var g = new THREE.Group();
    g.name = 'atomLabels';
    if (!mol.atoms || !mol.atoms.length) return g;
    mol.atoms.forEach(function (a, i) {
      var el = elemMap[a.el] ? elemMap[a.el].symbol : a.el;
      var r = (elemMap[a.el] ? elemMap[a.el].radius : 0.4) * 0.86;
      var h = clamp(r * 2.1, 0.36, 0.62); // 标签高度随原子半径自适应
      var spr = textSprite(el, { size: 42, worldH: h, color: '#1e2f4a', bold: true });
      spr.position.set(a.pos[0], a.pos[1] + r + h * 0.56 + 0.05, a.pos[2]);
      spr.userData.labelOf = i;
      g.add(spr);
    });
    return g;
  }

  // 大 π 键（离域 π 键）专用配色：紫色，与橙色共用电子对明确区分
  var BIG_PI_NUM = 0x7c3aed;

  /**
   * 大 π 键（离域 π 键）的“公有电子云”：
   * 若干原子各出一个 p 轨道，在分子平面上下侧向重叠成一整条云带，
   * 电子为这些原子共有、不专属某一对原子（O₃ 就是 Π₃⁴：3 个 O 共用 4 个电子）。
   * pts: 参与原子的坐标（按顺序串成云带）；返回云与电子小球，供分子视图 / 原子演示共用。
   */
  function makePiCloud(pts, opts) {
    opts = opts || {};
    var nE = opts.electrons || 4;
    var h = opts.height || 0.62;
    var mat = new THREE.MeshBasicMaterial({ color: BIG_PI_NUM, transparent: true, opacity: 0, depthWrite: false });
    var eMat = new THREE.MeshBasicMaterial({ color: BIG_PI_NUM, transparent: true, opacity: 0 });
    var g = new THREE.Group();
    var eList = [];
    if (!pts || pts.length < 2) return { group: g, mat: mat, eMat: eMat, electrons: eList, normal: new THREE.Vector3(0, 0, 1), height: h };
    // 分子平面法向：三点定面（共线时退化，取任一垂直方向）
    var normal = new THREE.Vector3();
    if (pts.length >= 3) {
      normal.crossVectors(
        new THREE.Vector3().subVectors(pts[1], pts[0]),
        new THREE.Vector3().subVectors(pts[2], pts[0])
      );
    }
    if (normal.lengthSq() < 1e-6) {
      var ax = new THREE.Vector3().subVectors(pts[pts.length - 1], pts[0]);
      normal.copy(perpBasis(ax.normalize()).u);
    }
    normal.normalize();
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      var dir = new THREE.Vector3().subVectors(b, a);
      var len = dir.length();
      if (len < 1e-4) continue;
      dir.normalize();
      var zAxis = new THREE.Vector3().crossVectors(normal, dir).normalize();
      var m4 = new THREE.Matrix4().makeBasis(normal, dir, zAxis);
      var mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
      for (var s = -1; s <= 1; s += 2) {
        var lobe = new THREE.Mesh(ballGeo(1), mat);
        lobe.position.copy(mid).addScaledVector(normal, s * h);
        lobe.quaternion.setFromRotationMatrix(m4);
        lobe.scale.set(opts.thickness || 0.3, len * 0.5 + 0.26, opts.width || 0.5);
        g.add(lobe);
      }
    }
    // 离域电子：沿整条云带均布，上下两片交替（直观表示“电子属于整条带”）
    var first = pts[0], last = pts[pts.length - 1];
    for (var e = 0; e < nE; e++) {
      var t = nE === 1 ? 0.5 : (e + 0.5) / nE;
      var p = new THREE.Vector3().lerpVectors(first, last, t);
      var side = (e % 2 === 0) ? 1 : -1;
      var m2 = new THREE.Mesh(ballGeo(opts.eR || 0.16), eMat);
      m2.position.copy(p).addScaledVector(normal, side * h);
      g.add(m2);
      eList.push(m2);
    }
    return { group: g, mat: mat, eMat: eMat, electrons: eList, normal: normal, height: h };
  }

  function setMoleculeLabelsVisible(show) {
    if (!view || !view.labels) return;
    view.labels.visible = !!show;
  }

  function showMoleculeScene(id, molData) {
    var mol = molData || molMap[id];
    if (!mol) { showError('未找到分子：' + id); return; }
    setStageVisible(true);
    var built;
    if (mol.scene === 'lattice') built = buildLattice(mol);
    else built = buildMoleculeGroup(mol);
    var root = built.root;
    setViewRotation(root, mol.view);
    sceneRoot.add(root);
    view = {
      kind: 'molecule', id: id, root: root,
      atomMeshes: built.meshes,
      autorotate: true
    };
    // 离域大 π 键（如 O₃ 的 Π₃⁴）：跨多个原子的公有电子云 + 标注，
    // 让“电子不属于某一对原子、两个 O–O 键因此完全相同”看得见
    if (mol.bigpi && mol.bigpi.atoms && mol.bigpi.atoms.length > 1 && mol.scene !== 'lattice') {
      var bpAtoms = mol.bigpi.atoms.filter(function (i) { return mol.atoms && mol.atoms[i]; });
      if (bpAtoms.length > 1) {
        var piPts = bpAtoms.map(function (i) {
          return new THREE.Vector3(mol.atoms[i].pos[0], mol.atoms[i].pos[1], mol.atoms[i].pos[2]);
        });
        var piE = mol.bigpi.electrons || 4;
        var pi = makePiCloud(piPts, { electrons: piE });
        pi.mat.opacity = 0.34;
        pi.eMat.opacity = 1;
        root.add(pi.group);
        var piC = new THREE.Vector3();
        piPts.forEach(function (p) { piC.add(p); });
        piC.multiplyScalar(1 / piPts.length);
        var piLab = textSprite(
          '大 π 键 ' + (mol.bigpi.label || '') + ' · ' + bpAtoms.length + ' 个原子共用 ' + piE + ' 个 e⁻（离域：不专属某一对原子）',
          { size: 30, worldH: 0.46, color: '#6d28d9', bold: true }
        );
        piLab.position.copy(piC).add(new THREE.Vector3(0, 1.55, 0));
        root.add(piLab);
        view.piCloud = pi;
      }
    }
    fitView(root);
    // 球棍模型：在原子球上方加元素符号标注（原子多的结构用 mol.noLabels 关掉）
    if (mol.scene !== 'lattice' && !mol.noLabels) {
      var labels = buildMoleculeLabels(mol);
      root.add(labels); // 挂在 root 下，随分子一起旋转/平移，且不参与 fitView 包围盒计算
      view.labels = labels;
      view.showLabels = true;
    }
    applyCamMode('solid');
    showHint('拖动旋转 · 滚轮/双指缩放 · 轻点原子查看结构', 2600);
  }

  /* ================= 离子晶体（NaCl） ================= */
  function buildLattice(mol) {
    var root = new THREE.Group();
    var meshes = [];
    var grid = 4; // 边离子数（4³ = 64 个离子，含中心区示意）
    var half = (grid - 1) / 2;
    var spacing = 2.1;
    var rIon = 0.55;
    var ai = 0;
    for (var i = 0; i < grid; i++) {
      for (var j = 0; j < grid; j++) {
        for (var k = 0; k < grid; k++) {
          var isNa = ((i + j + k) % 2) === 0; // Na⁺ / Cl⁻ 交替排列
          var elName = isNa ? 'Na' : 'Cl';
          var m = new THREE.Mesh(ballGeo(isNa ? rIon * 0.82 : rIon), stdMat(colorOf(elName)));
          m.position.set((i - half) * spacing, (j - half) * spacing, (k - half) * spacing);
          m.userData = { element: elName, mol: mol.id, lattice: true, ai: ai++ };
          meshes.push(m);
          root.add(m);
          // 只连最短邻键（避免重复过多几何体）
          if (i < grid - 1) root.add(thinBond(m.position, new THREE.Vector3((i + 1 - half) * spacing, (j - half) * spacing, (k - half) * spacing), '#c9d4e6'));
          if (j < grid - 1) root.add(thinBond(m.position, new THREE.Vector3((i - half) * spacing, (j + 1 - half) * spacing, (k - half) * spacing), '#c9d4e6'));
          if (k < grid - 1) root.add(thinBond(m.position, new THREE.Vector3((i - half) * spacing, (j - half) * spacing, (k + 1 - half) * spacing), '#c9d4e6'));
        }
      }
    }
    // 图例
    var lg = textSprite('Na⁺ 紫色 · Cl⁻ 绿色', { size: 34, worldH: 0.5, color: '#46536b' });
    lg.position.set(0, -spacing * half - 1.1, 0);
    root.add(lg);
    return { root: root, meshes: meshes };
  }

  function thinBond(a, b, col) {
    var from = a.clone(), to = b.clone();
    var axis = new THREE.Vector3().subVectors(to, from);
    var len = axis.length();
    var m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 8), stdMat(col, { opacity: 0.5, roughness: 0.6 }));
    m.position.addVectors(from, to).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
    m.scale.y = len;
    return m;
  }

  /* ================= 原子级视图（原子核 + 电子） ================= */

  // 视角预设：原子默认俯视（便于逐层数清电子），可随时切回立体视角
  function applyCamMode(mode) {
    if (!view) return;
    mode = mode === 'top' ? 'top' : (mode === 'flat' ? 'flat' : 'solid');
    view.camMode = mode;
    if (!view.fitR) return;
    // 基准距离随画幅自适应（竖屏会自动往后退一点，保证左右都装得下）
    var base = fitDistance(view.fitR);
    if (mode === 'top') {
      camState.az = 0;
      camState.pl = 1.45; // 接近正上方的俯视图
      camState.radius = Math.max(base * 0.8, 3);
      autoRotate = false;
    } else if (mode === 'flat') {
      // 平视视角：相机环绕到反应面侧向（az=90°），反应箭头在画面中水平向右
      camState.az = Math.PI / 2;
      camState.pl = 0.045;
      camState.radius = Math.max(base * 1.11, 3.2);
      autoRotate = false;
    } else {
      camState.az = 0.7;
      camState.pl = 0.6;
      camState.radius = base;
      autoRotate = view.autorotate !== false;
    }
    clampCam();
  }

  var SUP_CH = { '0': '\u2070', '1': '\u00B9', '2': '\u00B2', '3': '\u00B3', '4': '\u2074', '5': '\u2075', '6': '\u2076', '7': '\u2077', '8': '\u2078', '9': '\u2079' };
  function ionText(sym, q) {
    if (!q) return sym;
    var s = String(Math.abs(q)), sup = '';
    for (var i = 0; i < s.length; i++) sup += SUP_CH[s[i]] || s[i];
    return sym + sup + (q > 0 ? '\u207A' : '\u207B');
  }
  var SHELL_CAP = [2, 8, 18, 18, 18];
  // 离子态电子排布：按总电子数（质子数 - 电荷）从内层向外重排
  function shellsForCharge(el, q) {
    if (!q) return el.shells || [];
    var n = (el.p || 0) - q;
    var out = [];
    for (var i = 0; n > 0; i++) {
      var cap = i < SHELL_CAP.length ? SHELL_CAP[i] : 18;
      var c = Math.min(cap, n);
      if (c > 0) out.push(c);
      n -= c;
    }
    return out.length ? out : [0];
  }
  // 该原子在所在分子/晶体中的离子电荷（无上下文时按中性 0 处理）
  function ctxChargeOf(ctx, symbol) {
    if (!ctx || !ctx.molId) return 0;
    var mol = (ctx.mol) || molMap[ctx.molId];
    if (!mol) return 0;
    if (mol.scene === 'lattice') return symbol === 'Na' ? 1 : (symbol === 'Cl' ? -1 : 0);
    var ai = (ctx.ai !== undefined && ctx.ai !== null) ? ctx.ai : -1;
    if (!mol.atoms || ai < 0 || ai >= mol.atoms.length) return 0;
    var v = (mol.charges || [])[ai];
    return (v === undefined || v === null || isNaN(v)) ? 0 : v;
  }
  function latticeIdx(ai, grid) {
    var i = Math.floor(ai / (grid * grid));
    var r = ai % (grid * grid);
    return { i: i, j: Math.floor(r / grid), k: r % grid };
  }
  function latticeEl(i, j, k) { return ((i + j + k) % 2) === 0 ? 'Na' : 'Cl'; }

  // 收集被查看原子在分子里的邻接原子（方向 / 键级 / 键型 / 邻原子电荷）
  function collectContext(ctx, symbol, outerR) {
    var mol = (ctx.mol) || molMap[ctx.molId];
    if (!mol) return null;
    var out = { neighbors: [], outerR: outerR, note: null, molId: mol.id };
    if (mol.scene === 'lattice') {
      var grid = 4;
      var ai = (ctx.ai !== undefined && ctx.ai >= 0) ? ctx.ai : 0;
      var c = latticeIdx(ai, grid);
      var D = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      for (var d = 0; d < D.length; d++) {
        var ni = c.i + D[d][0], nj = c.j + D[d][1], nk = c.k + D[d][2];
        if (ni < 0 || ni >= grid || nj < 0 || nj >= grid || nk < 0 || nk >= grid) continue;
        var s = latticeEl(ni, nj, nk);
        var nai = ni * grid * grid + nj * grid + nk;
        out.neighbors.push({ sym: s, q: s === 'Na' ? 1 : -1, dir: new THREE.Vector3(D[d][0], D[d][1], D[d][2]), order: 0, ionic: true, ai: nai, mol: mol.id });
      }
      out.note = '离子键：Na 失去最外层 1 个电子成 Na⁺，Cl 得到 1 个电子成 Cl⁻，靠静电作用结合';
      return out;
    }
    if (!mol.atoms || !mol.atoms.length) return null;
    var ai2 = ctx.ai;
    if (!(ai2 >= 0 && ai2 < mol.atoms.length)) {
      ai2 = -1;
      for (var q2 = 0; q2 < mol.atoms.length; q2++) {
        if (mol.atoms[q2].el === symbol) { ai2 = q2; break; }
      }
    }
    if (ai2 < 0) return null;
    var pc = mol.atoms[ai2].pos;
    var charges = mol.charges || [];
    for (var b = 0; b < (mol.bonds || []).length; b++) {
      var bond = mol.bonds[b];
      var oth = -1;
      if (bond.a === ai2) oth = bond.b;
      else if (bond.b === ai2) oth = bond.a;
      if (oth < 0 || oth >= mol.atoms.length) continue;
      var A = mol.atoms[oth];
      var dvec = new THREE.Vector3(A.pos[0] - pc[0], A.pos[1] - pc[1], A.pos[2] - pc[2]);
      if (dvec.lengthSq() < 1e-6) continue;
      var dlen = dvec.length();
      out.neighbors.push({
        sym: A.el,
        q: charges[oth] || 0,
        dir: dvec.clone().normalize(),
        len: dlen,
        order: bond.order || 1,
        ionic: bond.style === 'ionic',
        ai: oth,
        mol: mol.id
      });
    }
    if (out.neighbors.length) {
      out.note = '两原子共用电子对后，最外层趋于 8 电子（氢为 2）的稳定结构';
    }
    // 离域大 π 键：该原子是否参与？参与的话贡献几个电子、另外两个原子分别在哪个方向
    var bp = mol.bigpi;
    if (bp && bp.atoms && bp.atoms.length > 1) {
      var slot = bp.atoms.indexOf(ai2);
      if (slot >= 0) {
        var per = bp.per || [];
        var selfE = per.length ? (per[slot] || 0) : 0;
        var others = [];
        bp.atoms.forEach(function (oi, k) {
          if (oi === ai2 || oi < 0 || oi >= mol.atoms.length) return;
          var A2 = mol.atoms[oi];
          // 它在分子里与哪个“同样参与大 π 键”的原子相连（用于画出那根 σ 键）
          var linkAi = -1;
          (mol.bonds || []).forEach(function (bd) {
            var nb2 = (bd.a === oi) ? bd.b : ((bd.b === oi) ? bd.a : -1);
            if (nb2 >= 0 && bp.atoms.indexOf(nb2) >= 0 && nb2 !== oi) linkAi = nb2;
          });
          others.push({
            sym: A2.el, ai: oi, linkAi: linkAi,
            // 以被查看原子为原点的真实坐标向量（保持分子原本的键角/相对距离）
            vec: new THREE.Vector3(A2.pos[0] - pc[0], A2.pos[1] - pc[1], A2.pos[2] - pc[2]),
            e: per.length ? (per[k] || 0) : 0
          });
        });
        out.bigpi = {
          centers: bp.atoms.length,
          electrons: bp.electrons || 4,
          label: bp.label || '',
          selfE: selfE,
          others: others
        };
        out.note = bp.atoms.length + ' 个原子的 p 轨道侧向重叠，' + (bp.electrons || 4) +
          ' 个电子为这 ' + bp.atoms.length + ' 个原子共有（大 π 键 ' + (bp.label || '') + '），不专属某一对原子';
      }
    }
    return out;
  }

  /* ============ 电子云辅助 ============ */
  var glowTexCache = null;
  function glowTex() {
    if (glowTexCache) return glowTexCache;
    var cv = document.createElement('canvas');
    var S = 64; cv.width = S; cv.height = S;
    var g = cv.getContext('2d');
    var grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.12)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
    glowTexCache = new THREE.CanvasTexture(cv);
    return glowTexCache;
  }
  function randGauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 0.9; }
  // 向 root 添加一团电子云点
  function addCloud(root, hex, count, size, opacity, sample) {
    var arr = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      var v = sample();
      arr[i * 3] = v[0]; arr[i * 3 + 1] = v[1]; arr[i * 3 + 2] = v[2];
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    var mat = new THREE.PointsMaterial({
      color: hex, size: size, map: glowTex(), transparent: true,
      opacity: opacity, depthWrite: false, sizeAttenuation: true
    });
    var pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    root.add(pts);
    return pts;
  }
  // 各能层“轨迹云”配色（由内向外：青 → 蓝 → 紫 → 品红 → 琥珀；在浅色背景上采用饱和深色，更醒目）
  var SHELL_CLOUD_COLORS = ['#0d9c90', '#2a6df4', '#7a48f5', '#e3377f', '#ff7d1a', '#f2b300'];
  // 共用电子对（共价成键电子）专用高对比配色：白底上远比淡金色醒目
  var SHARED_PAIR_CSS = '#ff5c00';
  var SHARED_PAIR_NUM = 0xff5c00;
  // 电子转移小球（离子型得失电子）用深琥珀色，与共用电子对区分但同样清晰
  var TRANSFER_ELECTRON_NUM = 0xff8a00;
  // “轨迹云”采样：粒子集中在多条随机倾角的轨道环带上，
  // 环带围绕原子核，立体旋转/俯视时呈现云雾状的轨迹感（非均匀实心球）
  function makeShellSample(R, sigma) {
    var rings = [];
    for (var i = 0; i < 6; i++) {
      var ax = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
      var tt = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
      var u = new THREE.Vector3().crossVectors(ax, tt);
      if (u.lengthSq() < 1e-4) u.set(1, 0, 0);
      u.normalize();
      var v = new THREE.Vector3().crossVectors(ax, u).normalize();
      rings.push({ ax: ax, u: u, v: v, ph: Math.random() * Math.PI * 2 });
    }
    return function () {
      var rg = rings[(Math.random() * rings.length) | 0];
      var a = rg.ph + Math.random() * Math.PI * 2;
      var ca = Math.cos(a), sa = Math.sin(a);
      var r = Math.max(R + randGauss() * sigma, 0.25);
      var along = randGauss() * sigma * 0.55; // 轨道平面外的轻微厚度
      return [
        rg.ax.x * along + (rg.u.x * ca + rg.v.x * sa) * r,
        rg.ax.y * along + (rg.u.y * ca + rg.v.y * sa) * r,
        rg.ax.z * along + (rg.u.z * ca + rg.v.z * sa) * r
      ];
    };
  }
  var SHELL_NAMES = ['K', 'L', 'M', 'N', 'O', 'P', 'Q'];
  // 每层按电子数在球壳面上均匀布置“电子小球”的位置（黄金角螺旋，间距均匀易数数）
  function shellDotSpots(n, R) {
    var out = [];
    if (n <= 0) return out;
    var golden = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < n; i++) {
      var y = 1 - (2 * (i + 0.5)) / n;
      var rr = Math.sqrt(Math.max(0, 1 - y * y));
      var phi = golden * i;
      out.push(new THREE.Vector3(Math.cos(phi) * rr * R, y * R, Math.sin(phi) * rr * R));
    }
    return out;
  }
  // 在壳面上画“表示单个电子的小球”（不同于整体轨迹云，用小球把每层电子数量直观标出）
  //  - 每层小球颜色与该层线框/电子云一致，便于“颜色即层”
  //  - 小球归入同一 group，随后按层在 view.update 里缓慢绕轴公转，呈现“绕核运动”
  function addShellDots(root, shellR, count, colorHex, k, spinList) {
    if (count <= 0) return null;
    var grp = new THREE.Group();
    var mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.98 });
    var spots = shellDotSpots(count, shellR);
    spots.forEach(function (p) {
      var m = new THREE.Mesh(ballGeo(0.17), mat);
      m.position.copy(p);
      grp.add(m);
    });
    grp.rotation.z = (k % 5) * 0.35; // 各层轴略倾，旋转时呈现不同“轨道面”
    grp.userData.spin = 0.22 + (k % 4) * 0.09; // 由内向外略快
    if (spinList) spinList.push(grp);
    root.add(grp);
    return grp;
  }
  // 绘制一个能层的“轨道云”：
  //  - 半透明同色线框球壳 → 把 K/L/M/N 各层清楚圈定出来，层与层空档明显
  //  - 粒子按该层轨道环带分布（weight 为该层需实画的电子数，0 表示全成键层只画壳线）
  //  - weight 个小球画在该层壳面上 = 直观计数（非键电子；共价成键电子以金色云/小球贴壳面外侧）
  function addShellCloud(root, shellR, weight, labelText, k, spinList, opts) {
    var colorHex = SHELL_CLOUD_COLORS[k % SHELL_CLOUD_COLORS.length] || '#2a6df4';
    opts = opts || {};
    var halo = new THREE.Mesh(
      new THREE.SphereGeometry(shellR, 30, 20),
      new THREE.MeshBasicMaterial({ color: colorHex, wireframe: true, transparent: true, opacity: 0.2, depthWrite: false })
    );
    root.add(halo);
    if (weight > 0) {
      var nDots = Math.max(Math.round(weight * 26), 130);
      var dotSize = 1.0 + (k % 3) * 0.15; // 外层云粒子略大，便于区分
      // 云带径向压薄：粒子大致停留在壳层半径上，层间留出清晰空档
      addCloud(root, colorHex, nDots, dotSize, 0.55, makeShellSample(shellR, shellR * 0.055));
      // 价层（有成键上下文时）按“两个一组”摆放，直观区分成对电子与未成对电子
      if (opts.pair) addPairedDots(root, shellR, Math.floor(weight / 2), colorHex, k, spinList, opts.avoidDir);
      else addShellDots(root, shellR, weight, colorHex, k, spinList);
    }
    if (labelText) {
      var lab = textSprite(labelText, { size: 40, worldH: 0.6, color: '#1c3152', bold: true });
      lab.position.set(0, shellR * 1.12, 0);
      root.add(lab);
    }
  }
  // 沿键轴方向画“共用电子对电子云”：高对比橙红色云带贴在最外层电子壳外侧，
  // 表示这些成键电子本就属于该原子的最外层（醒目亮带 = 共享后的最外层电子对）
  function addSharedCloud(root, dir, nPairs, OR, endSurf) {
    var ref = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    var u = new THREE.Vector3().crossVectors(dir, ref);
    if (u.lengthSq() < 1e-6) u.set(1, 0, 0);
    u.normalize();
    var v = new THREE.Vector3().crossVectors(dir, u).normalize();
    var start = OR * 1.02;              // 从最外层壳面开始
    var span = Math.max(endSurf - start, 0.55);
    var center = start + span * 0.34;   // 云带主体停留在壳层外侧
    var half = Math.max(span * 0.2, 0.3);
    addCloud(root, SHARED_PAIR_CSS, 14 + nPairs * 20, 0.52, 0.72, function () {
      var t = center + randGauss() * half;
      var px = randGauss() * 0.18;
      var py = randGauss() * 0.18;
      return [dir.x * t + u.x * px + v.x * py, dir.y * t + u.y * px + v.y * py, dir.z * t + u.z * px + v.z * py];
    });
    var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff7a1a, transparent: true, opacity: 0.3, depthWrite: false }));
    glow.scale.set(span * 1.3, span * 0.6, 1);
    glow.position.set(dir.x * center, dir.y * center, dir.z * center);
    root.add(glow);
    var dotMat = new THREE.MeshBasicMaterial({ color: SHARED_PAIR_NUM, transparent: true, opacity: 0.98 });
    for (var p = 0; p < nPairs; p++) {
      var az = p * Math.PI + 0.7;
      var px2 = Math.cos(az) * 0.3;
      var py2 = Math.sin(az) * 0.3;
      for (var side = -1; side <= 1; side += 2) {
        var dot = new THREE.Mesh(ballGeo(0.15), dotMat);
        dot.position.set(
          dir.x * (center + 0.14) + u.x * px2 + v.x * py2 * side,
          dir.y * (center + 0.14) + u.y * px2 + v.y * py2 * side,
          dir.z * (center + 0.14) + u.z * px2 + v.z * py2 * side);
        root.add(dot);
      }
    }
  }
  // 在电子层模型外围绘制：邻接原子、键轴、共用电子对电子云与电荷标注。
  // 邻原子球可被轻点拾取（跳转到该原子的视图），返回可拾取网格列表。
  function drawContext(root, info, charge, symbol, opts) {
    opts = opts || {};
    // shared=false：共用电子对交给“成键形成演示”动画去表现，这里只画键轴与邻原子核
    var shared = opts.shared !== false;
    var OR = info.outerR;
    var ballR = 0.7;
    var dist = OR + ballR + 1.3;
    var clickables = [];
    var partners = [];
    info.neighbors.forEach(function (nb) {
      var dir = nb.dir.clone();
      // 键轴（原子核 -> 邻原子）；离子键用淡灰色
      var col = nb.ionic ? '#aeb9cf' : '#c7d4ea';
      var axis = thinBond(dir.clone().multiplyScalar(0.5), dir.clone().multiplyScalar(dist - ballR - 0.1), col);
      root.add(axis);
      // 邻原子“核球”，可点击跳转
      var ball = new THREE.Mesh(ballGeo(ballR), stdMat(colorOf(nb.sym), { opacity: 0.97 }));
      ball.position.copy(dir).multiplyScalar(dist);
      ball.userData = { element: nb.sym, mol: nb.mol || info.molId || null, ai: nb.ai };
      clickables.push(ball);
      root.add(ball);
      // 共用电子对：高对比橙红色云贴在该原子最外层壳面外侧
      if (shared && !nb.ionic && nb.order) {
        addSharedCloud(root, dir, nb.order, OR, dist - ballR);
      }
      // 邻原子标签：离子标电荷，共价标元素
      var tq = nb.q;
      var txt = tq ? ionText(nb.sym, tq) : nb.sym;
      var lab = textSprite(txt, { size: 32, worldH: tq ? 0.7 : 0.52, color: tq ? (tq > 0 ? '#c2502f' : '#1d66c9') : '#33486b' });
      lab.position.copy(dir).multiplyScalar(dist + ballR + 0.75);
      root.add(lab);
      partners.push({ nb: nb, dir: dir, ball: ball, axis: axis, label: lab, dist: dist });
    });
    // 中央原子离子态标注
    if (charge) {
      var ctxt = textSprite(ionText(symbol, charge), { size: 44, worldH: 0.95, color: charge > 0 ? '#c2502f' : '#1d66c9' });
      ctxt.position.set(0, 1.6, 0);
      root.add(ctxt);
    }
    return { clickables: clickables, partners: partners };
  }

  /* ----- 共价键形成演示：轨道电子（成对 / 未成对）→ 两两配对 → σ / π 键 -----
   * 以 O₂ 为例：进入时先只画一个 O 原子，标明最外层哪些电子已成对（↑↓）、哪些是未成对的（↑）；
   * 再让另一个 O 原子沿键轴靠近，两对未成对电子两两配对 —— 头碰头成 σ 键、肩并肩成 π 键；
   * 最后在两核之间显示 4 个成键电子（共用电子对），双方都达到稳定结构。
   */
  var atomBond = null;                     // 当前原子视图的成键演示（没有共价邻居时为 null）
  var BOND_DUR = [1.4, 1.6, 1.9, 1.7, 2.8]; // 各阶段的停留时长（秒；第 5 步＝大 π 键，多留一会儿）
  var BOND_LERP = 3.0;                     // 阶段之间的过渡速度
  var BOND_SHARED = new THREE.Color(SHARED_PAIR_NUM);

  function perpBasis(dir) {
    var ref = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    var u = new THREE.Vector3().crossVectors(dir, ref);
    if (u.lengthSq() < 1e-6) u.set(1, 0, 0);
    u.normalize();
    var v = new THREE.Vector3().crossVectors(dir, u).normalize();
    return { u: u, v: v };
  }

  // 把圆柱摆到 from→to 之间（σ 键云、键轴共用）
  function alignCyl(mesh, from, to, r) {
    var dir = new THREE.Vector3().subVectors(to, from);
    var len = dir.length();
    if (len < 1e-4) { mesh.visible = false; return; }
    mesh.position.copy(from).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    mesh.scale.set(r, len, r);
  }

  /**
   * 价层的“成对电子”：每两个小球紧挨成一对（表示 ↑↓ 成对），
   * 并尽量摆到远离成键方向的一侧，避免和即将飞去配对的未成对电子混在一起。
   */
  function addPairedDots(root, shellR, pairs, colorHex, k, spinList, avoidDir) {
    if (pairs <= 0) return null;
    var grp = new THREE.Group();
    var mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.98 });
    var golden = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < pairs; i++) {
      var y = pairs === 1 ? 0.2 : (2 * (i + 0.5)) / pairs - 1;
      var rr = Math.sqrt(Math.max(0, 1 - y * y));
      var phi = golden * i;
      var d = new THREE.Vector3(Math.cos(phi) * rr, y, Math.sin(phi) * rr);
      if (avoidDir) {
        var dp = d.dot(avoidDir);
        if (dp > 0) {
          d.addScaledVector(avoidDir, -1.6 * dp);
          if (d.lengthSq() < 1e-6) d.copy(avoidDir).multiplyScalar(-1);
          d.normalize();
        }
      }
      var tan = perpBasis(d).u;
      for (var s = -1; s <= 1; s += 2) {
        var m = new THREE.Mesh(ballGeo(0.17), mat);
        m.position.copy(d).multiplyScalar(shellR).addScaledVector(tan, s * 0.3);
        grp.add(m);
      }
    }
    grp.userData.spin = 0.22 + (k % 4) * 0.09;
    if (spinList) spinList.push(grp);
    root.add(grp);
    return grp;
  }

  /** 各阶段的解说文案（随元素与键级变化；有大 π 键时多两步讲离域 π） */
  function bondSteps(cfg) {
    var s = cfg.symbol;
    var v = cfg.valenceE;
    var be = cfg.bondE;
    var pe = cfg.piE || 0;
    var pairs = Math.max(Math.floor((v - be - pe) / 2), 0);
    // 离域大 π 键（如 O₃ 的 Π₃⁴）：σ 骨架之外，多中心共用的那团电子要单独讲清楚
    if (cfg.bigpi) {
      var bp = cfg.bigpi;
      var sigmaPairs = cfg.bigpi.sigmaPairs || be;
      var sigmaTotal = cfg.bigpi.sigmaTotal || sigmaPairs;
      return [
        {
          title: '① 孤立的 ' + s + ' 原子',
          text: '最外层 ' + v + ' 个电子：' + pairs + ' 对成对电子（↑↓） + ' + (be + pe) + ' 个未成对电子（↑）'
        },
        {
          title: '② 三个 ' + s + ' 原子靠近',
          text: '排成 V 形（键角约 117°），中间一个 ' + s + ' 与两端的 ' + s + ' 各成一个 σ 键（头碰头重叠）'
        },
        {
          title: '③ 未成对电子两两配对',
          text: '每个 σ 键都由两个原子各出 1 个电子配对 → 三个 ' + s + ' 之间共 ' + sigmaTotal +
            ' 对共用电子对（本原子出 ' + sigmaPairs + ' 个，变橙色）'
        },
        {
          title: '④ p 轨道肩并肩重叠',
          text: '三个 ' + s + ' 各出一个垂直于分子平面的 p 轨道，侧面相互重叠（紫色示意）'
        },
        {
          title: '⑤ 形成大 π 键 ' + (bp.label || ''),
          text: bp.centers + ' 个 ' + s + ' 共用 ' + bp.electrons + ' 个电子：它们不属于某一对原子，而为三个原子共有（离域）→ 两个 ' + s + '–' + s + ' 键完全相同'
        }
      ];
    }
    var unpaired = be + pe;
    var hasPi = (cfg.maxOrder || 1) >= 2;
    var total = be * 2; // 每对 2 个电子：自己出 be 个，对方出 be 个
    var typeText = hasPi ? '头碰头成 σ 键 + 肩并肩成 π 键' : '头碰头重叠成 σ 键';
    return [
      {
        title: '① 孤立的 ' + s + ' 原子',
        text: '最外层 ' + v + ' 个电子：' + pairs + ' 对成对电子（↑↓） + ' + unpaired + ' 个未成对电子（↑）'
      },
      {
        title: '② 另一个原子靠近',
        text: '两个 ' + s + ' 原子沿键轴靠近，未成对电子迎面相对（蓝色小球 = 尚未配对的单电子）'
      },
      {
        title: '③ 未成对电子两两配对',
        text: be + ' 个未成对电子与对方 ' + be + " 个两两配对 → " + be + ' 对共用电子对（变橙色）'
      },
      {
        title: '④ 形成共价键',
        text: typeText + ' → 两核之间共 ' + total + ' 个成键电子，双方最外层都达到稳定结构'
      }
    ];
  }

  /**
   * 构造成键演示：为每个共价邻居生成 σ（+ π）键、参与配对的电子与配套标注。
   * cfg: { partners, OR, ballR, valenceE, bondE, maxOrder, symbol, shellColor }
   */
  function buildBondDemo(root, cfg) {
    var partners = cfg.partners || [];
    var OR = cfg.OR;
    var ballR = cfg.ballR;
    var shellCol = new THREE.Color(cfg.shellColor || '#2a6df4');
    var items = [];
    var pairCount = 0;
    var avgDir = new THREE.Vector3();
    partners.forEach(function (p) { avgDir.add(p.dir); });
    if (avgDir.lengthSq() < 1e-6) avgDir.set(1, 0, 0);
    avgDir.normalize();
    var basis0 = perpBasis(partners.length ? partners[0].dir : avgDir);

    partners.forEach(function (p) {
      if (p.piOnly) return; // 大 π 键体系里“不与被查看原子直接成键”的原子，单独按连线处理
      var order = Math.max(1, Math.min(p.nb.order || 1, 3));
      var basis = perpBasis(p.dir);
      var mid = p.dir.clone().multiplyScalar(p.dist * 0.5);
      for (var k = 0; k < order; k++) {
        pairCount++;
        var isSigma = k === 0;
        // σ 的电子对紧贴键轴；π 的电子对分列键轴两侧（肩并肩）
        var offDir = isSigma ? basis.v.clone() : (k === 1 ? basis.u.clone() : basis.v.clone());
        var off = isSigma ? 0 : 0.95;
        var center = isSigma ? mid.clone() : mid.clone().addScaledVector(offDir, off);
        var startC = p.dir.clone().multiplyScalar(OR);
        var startP = p.dir.clone().multiplyScalar(p.dist - ballR - 0.5);
        var endC = center.clone().addScaledVector(basis.u, 0.42);
        var endP = center.clone().addScaledVector(basis.u, -0.42);
        if (!isSigma) {
          startC.addScaledVector(offDir, 0.5);
          startP.addScaledVector(offDir, 0.5);
          endC = mid.clone().addScaledVector(offDir, off);
          endP = mid.clone().addScaledVector(offDir, -off);
        }
        // 参与成键的一对电子：中心原子出一个、邻居出一个（颜色随配对进度由壳色渐变为橙色）
        var eMat = new THREE.MeshBasicMaterial({ color: shellCol.clone(), transparent: true, opacity: 0.98 });
        var eC = new THREE.Mesh(ballGeo(0.2), eMat);
        var eP = new THREE.Mesh(ballGeo(0.2), eMat);
        eC.position.copy(startC);
        eP.position.copy(startP);
        root.add(eC);
        root.add(eP);
        // 键云：σ 沿键轴的圆柱；π 是键轴两侧的两块扁云
        var cloudMat = new THREE.MeshBasicMaterial({ color: SHARED_PAIR_NUM, transparent: true, opacity: 0, depthWrite: false });
        var cloud = new THREE.Group();
        if (isSigma) {
          var cyl = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 14), cloudMat);
          alignCyl(cyl, p.dir.clone().multiplyScalar(OR * 0.92), p.dir.clone().multiplyScalar(p.dist - ballR - 0.2), 0.24);
          cloud.add(cyl);
        } else {
          for (var sg = -1; sg <= 1; sg += 2) {
            var lobe = new THREE.Mesh(ballGeo(1), cloudMat);
            lobe.position.copy(mid).addScaledVector(offDir, sg * off);
            lobe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.dir.clone());
            lobe.scale.set(0.5, 1.3, 0.5);
            cloud.add(lobe);
          }
        }
        root.add(cloud);
        // 键型标注 σ / π
        var lpos = isSigma
          ? center.clone().addScaledVector(basis.v, 0.95)
          : center.clone().addScaledVector(offDir, 0.8);
        var lab = textSprite(isSigma ? 'σ' : 'π', { size: 34, worldH: 0.55, color: '#c2410c', bold: true });
        lab.position.copy(lpos);
        lab.material.opacity = 0;
        root.add(lab);
        items.push({
          partner: p, isSigma: isSigma,
          startC: startC, startP: startP, endC: endC, endP: endP,
          eC: eC, eP: eP, eMat: eMat, cloud: cloud, cloudMat: cloudMat, lab: lab
        });
      }
    });

    /* 大 π 键体系里“不与被查看原子直接成键”的原子（如 O₃ 另一端的 O）：
     * 它与相连的伙伴之间同样有一对 σ 电子，位置随两球实时变化，故每帧重算。 */
    var linkItems = [];
    partners.forEach(function (p) {
      if (!p.piOnly || !p.link) return;
      pairCount++;
      var lMat = new THREE.MeshBasicMaterial({ color: shellCol.clone(), transparent: true, opacity: 0.98 });
      var lC = new THREE.Mesh(ballGeo(0.2), lMat);
      var lP = new THREE.Mesh(ballGeo(0.2), lMat);
      root.add(lC);
      root.add(lP);
      var lCloudMat = new THREE.MeshBasicMaterial({ color: SHARED_PAIR_NUM, transparent: true, opacity: 0, depthWrite: false });
      var lCyl = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 14), lCloudMat);
      root.add(lCyl);
      var lLab = textSprite('σ', { size: 34, worldH: 0.55, color: '#c2410c', bold: true });
      lLab.material.opacity = 0;
      root.add(lLab);
      linkItems.push({ a: p.link, b: p, eC: lC, eP: lP, eMat: lMat, cyl: lCyl, cloudMat: lCloudMat, lab: lLab, ballR: ballR });
    });

    /* 离域大 π 键：三个（或多个）原子的 p 轨道侧向重叠成一整条云，
     * 电子从各原子旁飞入云中 —— 直观表达“电子为多原子共有、不专属某一对”。 */
    var piFx = null;
    if (cfg.bigpi) {
      var bpc = makePiCloud(cfg.bigpi.pts, {
        electrons: cfg.bigpi.electrons,
        height: cfg.bigpi.height || 1.25,
        thickness: 0.44, width: 0.9, eR: 0.22
      });
      root.add(bpc.group);
      // 每个电子的起点 = 它所属原子的 p 轨道位置（被查看原子在最外层壳面外，邻原子在核球旁）
      var per = cfg.bigpi.per || [];
      var starts = [];
      cfg.bigpi.pts.forEach(function (anchor, ai) {
        var n = per[ai] || 0;
        for (var c = 0; c < n; c++) {
          var base = (ai === 0)
            ? anchor.clone().addScaledVector(bpc.normal, OR + 0.9)
            : anchor.clone().addScaledVector(bpc.normal, 2.0);
          if (c > 0) base.addScaledVector(bpc.normal, (c % 2 ? 1 : -1) * 1.1);
          starts.push(base);
        }
      });
      bpc.electrons.forEach(function (m, mi) {
        m.userData.start = starts[mi] || m.position.clone();
        m.userData.end = m.position.clone();
        m.position.copy(m.userData.start);
      });
      var piC = new THREE.Vector3();
      cfg.bigpi.pts.forEach(function (p2) { piC.add(p2); });
      piC.multiplyScalar(1 / Math.max(cfg.bigpi.pts.length, 1));
      var piLab = textSprite(
        '大 π 键 ' + (cfg.bigpi.label || '') + ' · ' + cfg.bigpi.centers + ' 个原子共用 ' + cfg.bigpi.electrons + ' 个 e⁻',
        { size: 32, worldH: 0.62, color: '#6d28d9', bold: true }
      );
      piLab.position.copy(piC).addScaledVector(bpc.normal, (cfg.bigpi.height || 1.25) + 1.5);
      piLab.material.opacity = 0;
      root.add(piLab);
      piFx = { cloud: bpc, lab: piLab };
    }

    // 价层轨道标注：成对电子 / 未成对电子（成键后淡出）
    var pairs = Math.max(Math.floor((cfg.valenceE - cfg.bondE - (cfg.piE || 0)) / 2), 0);
    var piE = cfg.piE || 0;
    var singleTxt = piE
      ? ('未成对电子 ↑ ×' + (cfg.bondE + piE) + '（' + cfg.bondE + ' 个成 σ 键 · ' + piE + ' 个进大 π 键）')
      : ('未成对电子 ↑ ×' + cfg.bondE);
    var singleLab = textSprite(singleTxt, { size: 30, worldH: 0.52, color: '#1d4ed8', bold: true });
    singleLab.position.copy(avgDir).multiplyScalar(OR + 1.4).addScaledVector(basis0.u, 2.2);
    root.add(singleLab);
    var pairLab = textSprite('成对电子 ↑↓ ×' + pairs, { size: 30, worldH: 0.52, color: '#334155', bold: true });
    pairLab.position.copy(avgDir).multiplyScalar(-(OR + 1.6));
    root.add(pairLab);
    // 成键电子总数标注（摆在键区旁边）
    var totalLab = textSprite('共用 ' + pairCount * 2 + ' e⁻', { size: 34, worldH: 0.62, color: '#c2410c', bold: true });
    var firstMid = partners.length ? partners[0].dir.clone().multiplyScalar(partners[0].dist * 0.5) : new THREE.Vector3();
    totalLab.position.copy(firstMid).add(new THREE.Vector3(0, 1.9, 0)); // 摆在键区正上方，不随键轴方向转
    totalLab.material.opacity = 0;
    root.add(totalLab);
    // 阶段提示（放在场景上方，随播放推进更新文字）
    var stageLab = textSprite('', { size: 34, worldH: 0.6, color: '#0f172a', bold: true });
    stageLab.position.set(0, OR + 3.1, 0);
    root.add(stageLab);

    var demo = {
      steps: bondSteps({
        symbol: cfg.symbol, valenceE: cfg.valenceE, bondE: cfg.bondE,
        piE: cfg.piE || 0, maxOrder: cfg.maxOrder, bigpi: cfg.bigpi
          ? {
            label: cfg.bigpi.label, centers: cfg.bigpi.centers, electrons: cfg.bigpi.electrons,
            sigmaPairs: pairCount - linkItems.length, sigmaTotal: pairCount
          }
          : null
      }),
      step: 0, timer: 0, playing: false, done: false,
      cur: { near: 0, pair: 0, bond: 0, pi: 0 },
      goal: { near: 0, pair: 0, bond: 0, pi: 0 },
      items: items, linkItems: linkItems, partners: partners, ballR: ballR,
      singleLab: singleLab, pairLab: pairLab, totalLab: totalLab, stageLab: stageLab,
      piFx: piFx, hasBigPi: !!cfg.bigpi,
      shellCol: shellCol
    };
    return demo;
  }

  /** 把当前 cur 进度应用到场景（邻居位置、电子位置与颜色、键云与标注） */
  function bondApply(d) {
    var near = d.cur.near, pr = d.cur.pair, bd = d.cur.bond;
    for (var i = 0; i < d.partners.length; i++) {
      var p = d.partners[i];
      var dist = p.dist * 1.9 + (p.dist - p.dist * 1.9) * near;
      p.ball.position.copy(p.dir).multiplyScalar(dist);
      p.ball.visible = near > 0.02;
      if (p.ball.material) p.ball.material.opacity = 0.35 + 0.65 * near;
      if (p.axis) {
        p.axis.visible = near > 0.05;
        // 键距是演示专用的（比 drawContext 摆的更远），键轴要跟着拉长
        if (near > 0.05) {
          if (p.piOnly && p.link) {
            // 大 π 键体系里“伙伴之间”的键轴：连在中间原子与另一端原子之间
            alignCyl(p.axis, p.link.ball.position, p.ball.position, 1);
          } else {
            alignCyl(p.axis, p.dir.clone().multiplyScalar(0.5), p.dir.clone().multiplyScalar(dist - d.ballR - 0.1), 1);
          }
        }
      }
      if (p.label) {
        p.label.position.copy(p.dir).multiplyScalar(dist + d.ballR + 0.75);
        p.label.material.opacity = near;
      }
    }
    for (var j = 0; j < d.items.length; j++) {
      var it = d.items[j];
      it.eC.position.lerpVectors(it.startC, it.endC, pr);
      it.eP.position.lerpVectors(it.startP, it.endP, pr);
      if (it.eMat) it.eMat.color.copy(d.shellCol).lerp(BOND_SHARED, pr);
      if (it.cloudMat) it.cloudMat.opacity = 0.55 * bd;
      if (it.cloud) it.cloud.visible = bd > 0.02;
      if (it.lab) it.lab.material.opacity = bd;
    }
    // 大 π 键体系内“伙伴之间”的 σ 键（如 O₃ 中间 O 与另一端 O）：两端都在动，每帧按球位置重算
    for (var li = 0; li < (d.linkItems || []).length; li++) {
      var t = d.linkItems[li];
      var pa = t.a.ball.position, pb = t.b.position === undefined ? t.b.ball.position : t.b.ball.position;
      var ld = new THREE.Vector3().subVectors(pb, pa);
      if (ld.lengthSq() < 1e-4) continue;
      var un = ld.clone().normalize();
      var perpU = perpBasis(un).u;
      var lmid = pa.clone().addScaledVector(ld, 0.5);
      var sA = pa.clone().addScaledVector(un, t.ballR + 0.5);
      var sB = pb.clone().addScaledVector(un, -(t.ballR + 0.5));
      t.eC.position.lerpVectors(sA, lmid.clone().addScaledVector(perpU, 0.42), pr);
      t.eP.position.lerpVectors(sB, lmid.clone().addScaledVector(perpU, -0.42), pr);
      t.eMat.color.copy(d.shellCol).lerp(BOND_SHARED, pr);
      t.cloudMat.opacity = 0.55 * bd;
      t.cyl.visible = bd > 0.02;
      if (bd > 0.02) {
        alignCyl(t.cyl, pa.clone().addScaledVector(un, t.ballR + 0.2), pb.clone().addScaledVector(un, -(t.ballR + 0.2)), 0.24);
      }
      t.lab.position.copy(lmid).addScaledVector(perpU, 0.95);
      t.lab.material.opacity = bd;
    }
    // 离域大 π 键：电子从各原子 p 轨道飞入公有云
    if (d.piFx) {
      var pv = d.cur.pi || 0;
      d.piFx.cloud.mat.opacity = 0.36 * pv;
      d.piFx.cloud.eMat.opacity = pv;
      d.piFx.cloud.group.visible = pv > 0.02;
      d.piFx.lab.material.opacity = pv;
      d.piFx.cloud.electrons.forEach(function (m) {
        if (!m.userData.start) return;
        m.position.lerpVectors(m.userData.start, m.userData.end, pv);
      });
    }
    if (d.singleLab) d.singleLab.material.opacity = 1 - 0.75 * Math.max(pr, (d.hasBigPi ? (d.cur.pi || 0) : 0));
    if (d.pairLab) d.pairLab.material.opacity = 1 - 0.45 * pr;
    if (d.totalLab) d.totalLab.material.opacity = bd;
  }

  function bondGoals(d) {
    d.goal.near = d.step >= 1 ? 1 : 0;
    d.goal.pair = d.step >= 2 ? 1 : 0;
    d.goal.bond = d.step >= 3 ? 1 : 0;
    d.goal.pi = (d.hasBigPi && d.step >= 4) ? 1 : 0;
    if (d.stageLab) setSpriteText(d.stageLab, d.steps[d.step] ? d.steps[d.step].title : '');
  }

  function notifyBond(d) {
    notify({
      ev: 'bondDemo',
      step: d.step,
      steps: d.steps.length,
      playing: d.playing,
      title: d.steps[d.step] ? d.steps[d.step].title : '',
      text: d.steps[d.step] ? d.steps[d.step].text : ''
    });
  }

  function updateBondDemo(dt) {
    var d = atomBond;
    if (!d) return;
    if (d.playing) {
      d.timer += dt;
      if (d.timer >= (BOND_DUR[d.step] || 1.4)) {
        d.timer = 0;
        if (d.step < d.steps.length - 1) {
          d.step++;
          bondGoals(d);
          notifyBond(d);
          showHint(d.steps[d.step].text, 2600);
        } else {
          d.playing = false;
          d.done = true;
          notifyBond(d);
        }
      }
    }
    var kk = Math.min(1, dt * BOND_LERP);
    d.cur.near += (d.goal.near - d.cur.near) * kk;
    d.cur.pair += (d.goal.pair - d.cur.pair) * kk;
    d.cur.bond += (d.goal.bond - d.cur.bond) * kk;
    d.cur.pi += ((d.goal.pi || 0) - (d.cur.pi || 0)) * kk;
    bondApply(d);
  }

  function cmdAtomBond(action, value) {
    var d = atomBond;
    if (!d) return;
    var last = d.steps.length - 1;
    if (action === 'play') {
      if (d.done || d.step >= last) {
        d.step = 0;
        d.cur.near = 0; d.cur.pair = 0; d.cur.bond = 0; d.cur.pi = 0;
        bondGoals(d);
      }
      d.playing = true;
      d.done = false;
      d.timer = 0;
    } else if (action === 'pause') {
      d.playing = false;
    } else if (action === 'restart') {
      d.step = 0;
      d.playing = true;
      d.done = false;
      d.timer = 0;
      bondGoals(d);
    } else if (action === 'next') {
      d.playing = false;
      d.step = Math.min(d.step + 1, last);
      bondGoals(d);
    } else if (action === 'prev') {
      d.playing = false;
      d.step = Math.max(d.step - 1, 0);
      bondGoals(d);
    } else if (action === 'step' && typeof value === 'number') {
      d.playing = false;
      d.step = clamp(Math.round(value), 0, last);
      bondGoals(d);
    }
    notifyBond(d);
    if (d.steps[d.step]) showHint(d.steps[d.step].text, 2600);
  }

  function showAtomScene(symbol, ctx) {
    var el = elemMap[symbol];
    if (!el) {
      var byZ = elementOf(parseInt(symbol, 10));
      if (!byZ) { showError('未找到元素：' + symbol); return; }
      el = byZ;
    }
    var ctxMol = (ctx && ctx.mol) ? ctx.mol : (ctx && ctx.molId ? molMap[ctx.molId] : null);
    var charge = ctxChargeOf(ctx, el.symbol);
    var shells = shellsForCharge(el, charge);

    // 原子层级视图隐藏舞台灰色圆盘，避免“黄道圆盘”干扰观察电子层
    setStageVisible(false);

    var root = new THREE.Group();
    var cleanups = [];

    // --- 原子核：质子(红) / 中子(灰) —— 紧凑堆叠，缓慢旋转以示区分 ---
    var total = el.p + (el.n || 0);
    var rnd = mulberry32(el.p * 7919 + (el.n || 1) * 104729);
    var nr = total <= 10 ? 0.27 : 0.2;
    var clusterR = 0.3 + Math.cbrt(total) * nr * 0.62;
    var nucleus = new THREE.Group();
    var protonColor = new THREE.Color(0xff5a52), neutronColor = new THREE.Color(0x9aa3b2);
    for (var i = 0; i < total; i++) {
      var isP = i < el.p;
      var r = (total === 1) ? 0 : clusterR * Math.cbrt(rnd());
      var theta = Math.acos(2 * rnd() - 1);
      var phi = rnd() * Math.PI * 2;
      var m = new THREE.Mesh(ballGeo(nr * 0.8), stdMat(isP ? protonColor : neutronColor, { roughness: 0.42, metalness: 0.1 }));
      m.position.set(r * Math.sin(theta) * Math.cos(phi), r * Math.sin(theta) * Math.sin(phi), r * Math.cos(theta));
      nucleus.add(m);
    }
    root.add(nucleus);

    // --- 上下文与成键信息：先判定哪些外层电子参与共价共用 ---
    var ctxInfo = null;
    var ctxNote = null;
    var covNeighbors = 0;
    var bondE = 0;
    if (ctx && ctx.molId) {
      ctxInfo = collectContext(ctx, el.symbol, 2.8);
      if (ctxInfo && ctxInfo.neighbors && ctxInfo.neighbors.length) {
        ctxInfo.neighbors.forEach(function (nb) {
          if (!nb.ionic) { covNeighbors++; bondE += (nb.order || 0); }
        });
        ctxNote = ctxInfo.note || null;
      } else {
        ctxInfo = null;
      }
    }
    var valenceIdx = shells.length - 1;
    var valenceE = valenceIdx >= 0 ? shells[valenceIdx] : 0;
    // 大 π 键：该原子另外拿出几个电子进入多中心 π 体系（O₃ 中端位 O 出 1 个、中间 O 出 2 个）
    var piE = (ctxInfo && ctxInfo.bigpi) ? (ctxInfo.bigpi.selfE || 0) : 0;
    var lone = (covNeighbors > 0) ? Math.max(valenceE - bondE - piE, 0) : valenceE;

    // --- 共价邻居统计：决定价层电子怎样摆（成对 / 未成对），以及要不要演一遍成键过程 ---
    var bondPartners = [];
    var avgBondDir = new THREE.Vector3();
    var maxOrder = 1;
    if (ctxInfo) {
      ctxInfo.neighbors.forEach(function (nb) {
        if (nb.ionic) return;
        bondPartners.push(nb);
        avgBondDir.add(nb.dir);
        maxOrder = Math.max(maxOrder, nb.order || 1);
      });
    }
    if (avgBondDir.lengthSq() < 1e-6) avgBondDir.set(0, 1, 0);
    avgBondDir.normalize();

    // --- 电子云能层：层距拉大 + 线框能层球壳 + 静态轨迹云；成键外层电子画在最外层壳上 ---
    var shellGap = 2.1;
    var valenceSkipped = false;
    var shellNames = SHELL_NAMES;
    var orbitGroups = []; // 各层“电子小球”组，更新时绕轴缓慢公转
    for (var k = 0; k < shells.length; k++) {
      var count = shells[k];
      if (count <= 0) continue;
      var shellR = 2.8 + k * shellGap;
      var isValence = (k === valenceIdx);
      var weight = count;
      var shellOpts = null;
      if (isValence && covNeighbors > 0 && lone <= 0) {
        weight = 0; // 全成键：该层电子全部以橙红共用云出现在壳面外侧
        valenceSkipped = true;
      } else if (isValence && covNeighbors > 0) {
        weight = lone;
        // 价层按“两个一组”摆放：成对电子(↑↓)与待配对的未成对电子(↑)一眼可分
        shellOpts = { pair: true, avoidDir: avgBondDir };
      }
      addShellCloud(root, shellR, weight, (shellNames[k] || (k + 1)) + ' 层  ' + count + ' e⁻', k, orbitGroups, shellOpts);
    }
    if (valenceSkipped) {
      var allLab = textSprite('最外层 ' + valenceE + ' e⁻ 全部参与共用（金色云贴在最外层），共享后满足 2/8 稳定结构', { size: 30, worldH: 0.46, color: '#7c5a10', bold: true });
      allLab.position.set(0, -1.75, 0);
      root.add(allLab);
    }

    // --- 分子上下文：邻接原子 / 共用电子对 / 离子电荷；邻原子球可轻点跳转查看 ---
    //     有共价邻居时共用电子对交给“成键演示”动画表现（shared=false），不再画静态橙云
    var partnerMeshes = [];
    var covPartnerMeshes = [];
    atomBond = null;
    if (ctxInfo) {
      ctxInfo.outerR = 2.8 + valenceIdx * shellGap;
      var dc = drawContext(root, ctxInfo, charge, el.symbol, { shared: !(covNeighbors > 0 && bondE > 0) });
      partnerMeshes = (dc && dc.clickables) || [];
      covPartnerMeshes = ((dc && dc.partners) || []).filter(function (p) { return !p.nb.ionic; });
    }
    if (covPartnerMeshes.length && bondE > 0) {
      // 演示专用的键距：拉开到两个价层壳之外，两核之间留出空档，
      // 配对后的成键电子对才能清清楚楚地停在“中间”（否则会钻进电子壳里被盖住）
      var demoOR = 2.8 + valenceIdx * shellGap;
      covPartnerMeshes.forEach(function (p) {
        if (!p.piOnly) p.dist = demoOR * 2 + 3.0;
      });
      /* --- 离域大 π 键：把“参与但不与本原子直接成键”的原子也请进画面 ---
       * 例：看 O₃ 端位 O 时，另一端的 O 不直接与它成键，但三个 O 共享同一团 π 电子，
       * 缺了它就讲不清“大 π 键是三中心的”。位置按分子真实坐标等比缩放，
       * 键角（117°）与两个 O–O 键等长的关系保持与真实分子一致。 */
      var bigPiCfg = null;
      if (ctxInfo && ctxInfo.bigpi) {
        var bpi = ctxInfo.bigpi;
        var refP = null;
        covPartnerMeshes.forEach(function (p) { if (!refP && !p.piOnly) refP = p; });
        var pScale = (refP && refP.nb && refP.nb.len) ? (refP.dist / refP.nb.len) : 1;
        var piPts = [new THREE.Vector3(0, 0, 0)];
        var piPer = [bpi.selfE || 0];
        bpi.others.forEach(function (o) {
          var hit = null;
          covPartnerMeshes.forEach(function (p) { if (p.nb && p.nb.ai === o.ai) hit = p; });
          if (hit) { // 已是直接邻居（中间 O）：用它的演示位置
            piPts.push(hit.dir.clone().multiplyScalar(hit.dist));
            piPer.push(o.e || 0);
            return;
          }
          var v2 = o.vec;
          var len2 = v2.length();
          if (len2 < 1e-6) return;
          var dir2 = v2.clone().normalize();
          var dist2 = Math.max(len2 * pScale, (refP ? refP.dist : 12) * 0.9);
          var ball2 = new THREE.Mesh(ballGeo(0.7), stdMat(colorOf(o.sym), { opacity: 0.97 }));
          ball2.position.copy(dir2).multiplyScalar(dist2);
          ball2.userData = { element: o.sym, mol: ctxInfo.molId, ai: o.ai };
          root.add(ball2);
          partnerMeshes.push(ball2); // 同样可轻点跳转
          var lab2 = textSprite(o.sym, { size: 32, worldH: 0.52, color: '#33486b' });
          lab2.position.copy(dir2).multiplyScalar(dist2 + 1.45);
          root.add(lab2);
          var linkP = null;
          covPartnerMeshes.forEach(function (p) { if (p.nb && p.nb.ai === o.linkAi) linkP = p; });
          var axis2 = null;
          if (linkP) { // 它与中间 O 之间的 σ 键细杆
            axis2 = thinBond(new THREE.Vector3(), new THREE.Vector3(1, 0, 0), '#c7d4ea');
            root.add(axis2);
          }
          var extra = {
            nb: { order: 1, ionic: false, ai: o.ai, sym: o.sym, len: len2 },
            dir: dir2, ball: ball2, axis: axis2, label: lab2, dist: dist2,
            piOnly: true, link: linkP
          };
          covPartnerMeshes.push(extra);
          piPts.push(dir2.clone().multiplyScalar(dist2));
          piPer.push(o.e || 0);
        });
        if (piPts.length >= 2) {
          bigPiCfg = {
            pts: piPts, per: piPer, electrons: bpi.electrons,
            centers: bpi.centers, label: bpi.label, height: 1.25
          };
        }
      }
      atomBond = buildBondDemo(root, {
        partners: covPartnerMeshes,
        OR: 2.8 + valenceIdx * shellGap,
        ballR: 0.7,
        valenceE: valenceE,
        bondE: bondE,
        piE: piE,
        maxOrder: maxOrder,
        bigpi: bigPiCfg,
        symbol: el.symbol,
        shellColor: SHELL_CLOUD_COLORS[valenceIdx % SHELL_CLOUD_COLORS.length]
      });
      bondGoals(atomBond);
      bondApply(atomBond);
    }
    if (atomBond) {
      // 取景按“成键完成之后”的范围算：否则远处（还没靠近）的邻原子会把镜头拉得很远
      atomBond.partners.forEach(function (p) {
        p.ball.visible = true;
        p.ball.position.copy(p.dir).multiplyScalar(p.dist);
        if (p.label) p.label.material.opacity = 1;
      });
    }

    sceneRoot.add(root);
    var spinState = { t: 0 };

    view = {
      kind: 'atom', id: el.symbol, root: root,
      atomMeshes: partnerMeshes,
      autorotate: true,
      camMode: 'solid',
      update: function (dt) {
        spinState.t += dt;
        nucleus.rotation.y = spinState.t * 0.3;
        nucleus.rotation.x = Math.sin(spinState.t * 0.16) * 0.18;
        // 各能层“电子小球”绕本层轴缓慢公转（绕核运动的直观示意），轨迹云保持静态
        for (var oi = 0; oi < orbitGroups.length; oi++) {
          var og = orbitGroups[oi];
          og.rotation.y += og.userData.spin * dt;
        }
        // 共价键形成演示（靠近 → 配对 → 成键）
        updateBondDemo(dt);
        // 电子云整体保持静态（无环绕动画）
      }
    };
    fitView(root);
    if (atomBond) bondApply(atomBond); // 取景后回到“初始：只有一个原子”的状态
    // 整体回中，保证原子核始终在视口中心
    if (Math.abs(camTarget.x) > 1e-4 || Math.abs(camTarget.y) > 1e-4 || Math.abs(camTarget.z) > 1e-4) {
      root.position.sub(camTarget);
      camTarget.set(0, 0, 0);
      camTargetGoal.set(0, 0, 0);
      view.homeTarget = new THREE.Vector3(0, 0, 0);
    }
    applyCamMode('solid');
    // 再按上下可视带（顶部导航 ~ 底部信息卡）取景，原子核才落在“看得见的那一条”中央
    view.bandTop = rxBand.top;
    view.bandBottom = rxBand.bottom;
    frameAtomView();

    var tip;
    var bpCtx = ctxInfo && ctxInfo.bigpi ? ctxInfo.bigpi : null;
    if (atomBond) {
      tip = bpCtx
        ? '正在演示成键：σ 骨架 → p 轨道侧向重叠 → 三中心大 π 键 ' + (bpCtx.label || '')
        : '正在演示共价键的形成：轨道电子 → 两两配对 → σ / π 键';
    } else if (ctxMol) {
      tip = charge
        ? ('在 ' + ctxMol.name + ' 中，该原子以 ' + ionText(el.symbol, charge) + ' 形式存在')
        : (covNeighbors > 0
            ? ('在 ' + ctxMol.name + ' 中 · 最外层 ' + valenceE + ' 个 e⁻：' + lone + ' 个成对（孤对）· ' + bondE +
                ' 个成 σ 键' + (piE ? ' · ' + piE + ' 个进入大 π 键 ' + (bpCtx && bpCtx.label ? bpCtx.label : '') : '') +
                ' · 轻点外圈原子核球可切换查看')
            : ('在 ' + ctxMol.name + ' 中 · 彩色分层轨迹云示意，无固定轨道'));
    } else {
      tip = '立体视角查看能层分层 · 彩色线框=各层球壳 · 切俯视可逐层数电子 · 八隅体见下方卡片';
    }
    // 有共价成键演示时，进入后自动演一遍：先看清孤立原子的轨道电子，再演配对成键
    if (atomBond) {
      atomBond.playing = true;
      atomBond.done = false;
      atomBond.timer = -0.6; // 开头空一拍
      notifyBond(atomBond);
      showHint(atomBond.steps[0].text, 3200);
    } else {
      showHint(tip, 3600);
    }
    notify({
      ev: 'atomInfo', symbol: el.symbol, name: el.name, p: el.p, n: el.n,
      shells: shells, charge: charge,
      mol: ctx ? ctx.molId : null, ai: (ctx && ctx.ai !== undefined) ? ctx.ai : null,
      valenceE: valenceE, bondE: covNeighbors > 0 ? bondE : 0, shared: covNeighbors,
      molName: ctxMol ? ctxMol.name : null,
      // 最外层电子的去向：σ 键用掉几个、进大 π 键几个、剩下几对孤对电子
      sigmaE: covNeighbors > 0 ? bondE : 0,
      piE: piE,
      loneE: (covNeighbors > 0) ? lone : 0,
      bigPi: bpCtx ? { label: bpCtx.label || '', centers: bpCtx.centers, electrons: bpCtx.electrons, selfE: piE } : null,
      // 共价成键演示：有值时宿主显示“重播 / 分步”控制条
      bond: atomBond ? { steps: atomBond.steps.length } : null
    });
  }

  /* ================= 反应视图 ================= */
  function speciesScale(molId) {
    var mol = molMap[molId];
    if (!mol) return 1;
    // 估算分子包围半径（离子对/晶格使用固定参考尺度）
    var maxR = 0;
    if (mol.scene === 'lattice') {
      maxR = 2.2;
    } else if (mol.atoms) {
      mol.atoms.forEach(function (a) {
        var rr = Math.hypot(a.pos[0], a.pos[1], a.pos[2]) + (elemMap[a.el] ? elemMap[a.el].radius : 0.5);
        maxR = Math.max(maxR, rr);
      });
    }
    var visual = 1.05 + Math.min(maxR, 3.0) * 0.34;
    return visual / Math.max(maxR, 0.1);
  }

  function layoutSide(specs, centerX) {
    // 返回每个物种的 x 位置（含间隙）
    var units = [];
    specs.forEach(function (s) {
      for (var i = 0; i < s.count; i++) units.push(s.mol);
    });
    var n = units.length;
    var widths = units.map(function (u) {
      var mol = molMap[u];
      var scale = speciesScale(u);
      var maxR = mol.atoms ? mol.atoms.reduce(function (mx, a) {
        return Math.max(mx, Math.hypot(a.pos[0], a.pos[1], a.pos[2]) + (elemMap[a.el] ? elemMap[a.el].radius : 0.4));
      }, 0) : 1.4;
      return Math.max(scale * maxR, 1.05);
    });
    var total = widths.reduce(function (a, b) { return a + b; }, 0) + (n - 1) * 2.0;
    var out = [];
    var x = centerX - total / 2 + widths[0] / 2;
    for (var i = 0; i < n; i++) {
      out.push({ mol: units[i], x: x });
      x += widths[i] / 2 + 2.0 + widths[i + 1] / 2;
    }
    return out;
  }

  function setOpacityDeep(obj, op) {
    obj.traverse(function (c) {
      if (c.material) {
        var ms = Array.isArray(c.material) ? c.material : [c.material];
        ms.forEach(function (m) {
          if (m.userData && m.userData.opT === false) return;
          m.transparent = true;
          m.opacity = op;
        });
      }
    });
  }
  // 通用材料便于透明度控制（顶层层级，供 tickReaction 等调用）
  function setUnitOpacity(u, op, scaleForPulse) {
    setOpacityDeep(u.g, op);
    if (scaleForPulse) u.g.scale.setScalar(Math.max(u.sc * scaleForPulse, 0.001));
  }

  // 反应场景 v2 入口：可接收宿主下发的“电子级剧幕”（drrama）数据，
  // 也可回退到内容库 reaction（此时把旧步骤自动映射为分步模式）
  function showReactionScene(id, dramaIn) {
    var rx = null;
    if (dramaIn && dramaIn.lhs) {
      rx = {
        id: dramaIn.id || id,
        name: dramaIn.name || '',
        equation: dramaIn.equation || '',
        condition: dramaIn.condition || '',
        type: dramaIn.type || '',
        desc: dramaIn.desc || '',
        lhs: dramaIn.lhs,
        rhs: dramaIn.rhs,
        steps: dramaIn.steps || [],
        ions: dramaIn.ions || null,
        transfers: dramaIn.transfers || [],
        note: dramaIn.note || '',
        pairBonds: dramaIn.pairBonds !== false
      };
    } else {
      DATA.reactions.forEach(function (r) { if (r.id === id) rx = r; });
      if (rx) rx.transfers = []; // 无剧幕数据时仅做整分子过渡
    }
    if (!rx) { showError('未找到反应：' + id); return; }
    setStageVisible(true);
    buildReactionScene(id, rx);
  }

  function buildIonPair() {
    var root = new THREE.Group();
    var na = elemMap.Na, cl = elemMap.Cl;
    var m1 = new THREE.Mesh(ballGeo(0.9), stdMat(colorOf('Na')));
    m1.position.x = -1.1;
    root.add(m1);
    var m2 = new THREE.Mesh(ballGeo(1.05), stdMat(colorOf('Cl')));
    m2.position.x = 1.3;
    root.add(m2);
    // 简化表示键
    var g = buildBond(null, m1.position.clone(), m2.position.clone(), 0, 'ionic');
    root.add(g);
    // 电荷标注由宿主提供，这里加简单 ±
    var p = textSprite('+', { size: 30, worldH: 0.34, color: '#4660c0' });
    p.position.set(-1.1, 1.15, 0);
    root.add(p);
    var mi = textSprite('−', { size: 40, worldH: 0.4, color: '#d14a3a' });
    mi.position.set(1.3, 1.3, 0);
    root.add(mi);
    return { root: root, meshes: [m1, m2] };
  }

  /* ================= 反应“电子级”分步引擎 =================
   * 4 个模式：
   *   reactants  整分子显示反应物
   *   split      断键：分子层淡出，原子拆解成带元素色的“自由原子”
   *   transfer   电子得失/转移：橙黄色电子小球定向飞行、离子电荷标签出现
   *   products   重新成键：原子移入产物位点，产物分子长出、共用电子对显现
   */
  var reactionState = null;
  // 反应动画速度倍率（由宿主滑块下发：0.1 / 0.3 / 0.5 / 1 / 1.5）
  var reactionSpeed = 1;
  // 画布上下被遮挡的可视带（占屏高比例，由宿主 band 命令下发，含最新一次的画布高度换算）。
  // 存这里而不是只写在 view 上：宿主下发的 band 可能早于场景建立，
  // 之后 showReactionScene 重建反应场景时直接沿用，避免内容又退回屏幕正中（被底部说明卡压住）
  var rxBand = { top: 0, bottom: 0 };

  // atomOp：未配对到产物位点的自由原子透明度（拆解时出现、成键时淡出）
  // fragOp：已配对自由原子的透明度——成键一步保持 1，即“原原子直接移动到目标位点”，不再渐变消失
  var RXN_MODES = {
    reactants: { molOp: 1, atomOp: 0, fragOp: 0, move: 0, prodOp: 0, prodScale: 0.55, pairsOp: 0, spread: 0, fx: 0 },
    split: { molOp: 0, atomOp: 1, fragOp: 1, move: 0, prodOp: 0, prodScale: 0.55, pairsOp: 0, spread: 1, fx: 0 },
    transfer: { molOp: 0, atomOp: 1, fragOp: 1, move: 0.42, prodOp: 0, prodScale: 0.55, pairsOp: 0, spread: 1, fx: 1 },
    products: { molOp: 0, atomOp: 0.001, fragOp: 1, move: 1, prodOp: 1, prodScale: 1, pairsOp: 1, spread: 0, fx: 0 }
  };
  var MODE_ALIAS = {
    reactants: 'reactants', mixing: 'split', split: 'split', break: 'split',
    transfer: 'transfer', products: 'products', product: 'products', combine: 'products'
  };
  function reactionModeOf(index) {
    var st = (reactionState.rx.steps[index] || {});
    var raw = st.mode || st.show || '';
    if (MODE_ALIAS[raw]) return MODE_ALIAS[raw];
    if (String(raw).indexOf('产物') >= 0 || String(raw).indexOf('生成') >= 0) return 'products';
    if (String(raw).indexOf('断') >= 0 || String(raw).indexOf('拆') >= 0 || String(raw).indexOf('mix') >= 0) return 'split';
    if (String(raw).indexOf('电子') >= 0 || String(raw).indexOf('转移') >= 0 || String(raw).indexOf('得失') >= 0) return 'transfer';
    if (index === (reactionState.rx.steps.length - 1)) return 'products';
    if (index === 0) return 'reactants';
    if (reactionState.rx.steps[index - 1]) return 'split';
    return 'reactants';
  }
  function rxnHoldOf(mode) {
    // 每步停留时长放大，方便看清原子拆分、电子转移与重新成键
    return mode === 'transfer' ? 6 : (mode === 'products' ? 6.8 : (mode === 'split' ? 4.8 : 3.4));
  }

  // 键中段的“共用电子对”：每键 2 枚金球（单键=1 对，双键=2 对沿键轴向分布）
  function bondPairPoints(a, b, order) {
    var axis = new THREE.Vector3().subVectors(b, a);
    var len = axis.length();
    if (len < 1e-5) return [];
    var dir = axis.clone().normalize();
    var aux = Math.abs(dir.x) > 0.6 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    var p1 = new THREE.Vector3().crossVectors(dir, aux).normalize().multiplyScalar(0.2);
    var out = [];
    for (var i = 0; i < order; i++) {
      var off = order === 1 ? 0 : (i - (order - 1) / 2) * 0.26;
      var mid = new THREE.Vector3().lerpVectors(a, b, 0.5 + off / Math.max(len, 0.01));
      out.push(mid.clone().add(p1));
      out.push(mid.clone().sub(p1));
    }
    return out;
  }

  var pairMat = new THREE.MeshBasicMaterial({ color: SHARED_PAIR_NUM });
  function buildReactionScene(id, rx) {
    setStageVisible(true);
    var root = new THREE.Group();
    sceneRoot.add(root);
    // —— 布局：把物种按份数展开为“单元”，左反应物 / 右产物 ——
    function unitList(specs) {
      var out = [];
      specs.forEach(function (s, si) {
        for (var c = 0; c < (s.count || 1); c++) out.push({ s: s, si: si });
      });
      return out;
    }
    function rowX(specs, side) {
      // 版面：先构建单元（拿到真实包围尺寸），再按实测大小紧凑排版。
      // 旧的“按原子个数估算宽度”会把整行拉得非常宽，手机竖屏上相机被迫退得很远，分子只剩一小点。
      var units = unitList(specs).map(function (o) { return { s: o.s, si: o.si, u: rxnBuildMol(o.s) }; });
      if (!units.length) return [];
      var GAP = 0.9;         // 单元之间的空隙（' + ' 号要占位）
      var ARROW_EDGE = 2.15; // 行边缘到反应箭头中心的距离
      var widths = units.map(function (o) {
        // 半宽 = |包围球中心偏移| + 半径（不重新居中，避免与自由原子的目标坐标错位）
        return Math.max(1.7, (Math.abs(o.u.cen ? o.u.cen.x : 0) + o.u.R) * o.u.sc * 2);
      });
      var xs = [], acc = widths[0] / 2;
      units.forEach(function (o, i) {
        if (i > 0) acc += widths[i - 1] / 2 + GAP + widths[i] / 2;
        xs.push(acc);
      });
      // 行先以自身中线归零，再贴到箭头左侧/右侧
      var total = xs[xs.length - 1] + widths[widths.length - 1] / 2;
      var center = side < 0 ? -(ARROW_EDGE + total / 2) : (ARROW_EDGE + total / 2);
      return units.map(function (o, i) {
        return { x: xs[i] - total / 2 + center, w: widths[i], u: o.u, si: o.si };
      });
    }
    // 统一放缩：分子/离子对/晶体，按包围球归一到视觉合适尺寸
    function unitScale(s) {
      var m = s.mol || molMap[s.mol] || molMap[s.id];
      var nA = (m && m.atoms) ? m.atoms.length : 1;
      if (m && m.scene === 'lattice') return 1.15;
      if (nA <= 1) return 0.95;
      return Math.min(1.2, Math.max(0.68, 4.2 / (2.1 + nA * 0.5)));
    }
    function buildUnitGroup(s) {
      var m = s.mol || molMap[s.mol] || molMap[s.id];
      var sc = unitScale(s);
      var isIon = !m.atoms || !m.atoms.length || m.scene === 'lattice' || m.id === 'nacl';
      var built = isIon ? buildIonPair(m) : buildMoleculeGroup(m);
      var g = new THREE.Group();
      g.add(built.root);
      return { g: g, sc: sc, mol: m, built: built };
    }
    function rxnBuildMol(s, isProduct) {
      var u = buildUnitGroup(s);
      // 测包围球（未缩放）：R 用于公式标签与排版，cen 记录球心偏移
      u.g.updateMatrixWorld(true);
      var box = new THREE.Box3().setFromObject(u.g);
      var sphere = box.getBoundingSphere(new THREE.Sphere());
      u.R = Math.max(sphere.radius, 0.6);
      u.cen = sphere.center.clone();
      u.op = 0;
      return u;
    }
    function vecAt(m, ai, sc, x) {
      var a = m.atoms[ai];
      return new THREE.Vector3(a.pos[0] * sc + x, a.pos[1] * sc + 0.05, a.pos[2] * sc);
    }
    // 分子式标签：位于单元下方，可点击打开该分子 3D 结构页
    function unitFormulaLabel(u) {
      var lab = textSprite(u.mol.formula, { size: 30, worldH: 0.55, color: '#41557a', bold: true });
      lab.position.set(0, (-u.R * u.sc - 0.78) / u.sc, 0);
      u.g.add(lab);
      lab.visible = false;
      lab.userData.molId = u.mol.id;
      lab.userData.mol = u.mol;
      labelTargets.push(lab);
      u.lab = lab;
    }
    // —— 实例化两份单元并定位 ——
    var lhsUnits = [], rhsUnits = [], frags = [], decors = [], flights = [], breakFx = [], labelTargets = [];
    var LH = rowX(rx.lhs, -1), RH = rowX(rx.rhs, 1);
    var plusL = [], plusR = [];
    function addPlus(x, side) {
      var sp = textSprite('+', { size: 60, worldH: 1.15, color: '#5a6b8c' });
      sp.position.set(x, 0.15, 0);
      root.add(sp);
      decors.push(sp);
      if (side === 'l') plusL.push(sp); else plusR.push(sp);
    }
    // 布局坐标实际以箭头为中心（左右各留 ARROW_EDGE 的基线，再按实测宽度错开）
    LH.forEach(function (o) {
      var u = o.u; // 单元已在排版阶段构建好
      u.x = o.x; u.isLhs = true;
      u.g.position.set(u.x, 0.05, 0);
      u.g.scale.setScalar(u.sc);
      setOpacityDeep(u.g, 0);
      root.add(u.g);
      unitFormulaLabel(u);
      lhsUnits.push(u);
      // 每个原子注册为自由原子
      if (u.mol.atoms && u.mol.atoms.length && u.mol.scene !== 'lattice' && u.mol.id !== 'nacl') {
        u.mol.atoms.forEach(function (a, ai) {
          var c3 = colorOf(a.el);
          var base = vecAt(u.mol, ai, u.sc, u.x);
          var rad = (elemMap[a.el] ? elemMap[a.el].radius : 0.4) * 0.86 * u.sc;
          var mesh = new THREE.Mesh(ballGeo(Math.max(rad, 0.26)), stdMat(c3));
          mesh.position.copy(base);
          mesh.userData.el = a.el;
          mesh.visible = false;
          root.add(mesh);
          // 每个拆解原子附元素符号标注（transfer 后对有电荷者切换为离子文本）
          var elLab = textSprite(a.el, { size: 30, worldH: 0.4, color: '#22334f', bold: true });
          elLab.visible = false;
          root.add(elLab);
          var off = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(0.95);
          frags.push({ el: a.el, mesh: mesh, lab: elLab, base: base.clone(), off: off, q: 0, target: base.clone(), matched: false, spin: 0.5 + Math.random() * 0.8 });
        });
        // 记录该反应物共价键的键中点：断键时橙红色电子对从键中央飞回两端原子
        u.bondSeeds = [];
        u.mol.bonds.forEach(function (b) {
          if (!b.order) return;
          var pa = vecAt(u.mol, b.a, u.sc, u.x);
          var pb = vecAt(u.mol, b.b, u.sc, u.x);
          bondPairPoints(pa, pb, b.order).forEach(function (pt) {
            u.bondSeeds.push({ pos: pt.clone(), ends: [pa.clone(), pb.clone()] });
          });
        });
      }
    });
    RH.forEach(function (o) {
      var u = o.u;
      u.x = o.x; u.isLhs = false;
      u.g.position.set(u.x, 0.05, 0);
      u.g.scale.setScalar(u.sc);
      setOpacityDeep(u.g, 0);
      root.add(u.g);
      unitFormulaLabel(u);
      rhsUnits.push(u);
      // 每根成键的“共用电子对”（先隐藏）
      if (u.mol.atoms && u.mol.bonds) {
        var pairPts = [];
        u.mol.bonds.forEach(function (b) {
          var pa = vecAt(u.mol, b.a, u.sc, u.x);
          var pb = vecAt(u.mol, b.b, u.sc, u.x);
          pairPts = pairPts.concat(bondPairPoints(pa, pb, b.order || 1));
        });
        pairPts.forEach(function (pp) {
          var dm = new THREE.Mesh(ballGeo(0.1), pairMat);
          dm.position.copy(pp);
          dm.visible = false;
          root.add(dm);
          u.pairs = u.pairs || [];
          u.pairs.push(dm);
        });
      }
    });
    // 反应物分子之间的 '+' 装饰（仅在不同物种之间）
    function plusBetween(rowArr, side) {
      for (var i = 0; i < rowArr.length - 1; i++) {
        if (rowArr[i].u.si === rowArr[i + 1].u.si) continue;
        var m1 = rowArr[i].x + rowArr[i].w / 2;
        var m2 = rowArr[i + 1].x - rowArr[i + 1].w / 2;
        addPlus((m1 + m2) / 2, side);
      }
    }
    plusBetween(LH, 'l');
    plusBetween(RH, 'r');
    // 条件 + 箭头
    if (rx.condition) {
      var condT = textSprite(rx.condition, { size: 38, worldH: 0.6, color: '#c25b1e' });
      condT.position.set(0, 2.6, 0);
      root.add(condT);
      decors.push(condT);
    }
    var arrowGrp = new THREE.Group();
    // 反应箭头：颜色调浅、整体半透明，避免抢走分子主体的视觉
    var aMat = new THREE.MeshStandardMaterial({ color: 0x9db9ea, transparent: true, opacity: 0.5, roughness: 0.35, metalness: 0.05 });
    var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.5, 12), aMat);
    shaft.rotation.z = -Math.PI / 2;
    arrowGrp.add(shaft);
    var cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.8, 18), aMat);
    cone.rotation.z = -Math.PI / 2;
    cone.position.x = 1.65;
    arrowGrp.add(cone);
    arrowGrp.position.set(0, 0.05, 0);
    root.add(arrowGrp);
    decors.push(arrowGrp);
    // —— 原子 → 产物位点（同元素配对，守恒）——
    var slots = [];
    rhsUnits.forEach(function (u) {
      if (u.mol.atoms) {
        u.mol.atoms.forEach(function (a, ai) {
          slots.push({ el: a.el, p: vecAt(u.mol, ai, u.sc, u.x) });
        });
      }
    });
    var pool = frags.slice();
    slots.forEach(function (sl) {
      for (var i = 0; i < pool.length; i++) {
        if (pool[i].el === sl.el) {
          pool[i].target = sl.p.clone();
          pool[i].matched = true; // 该原子有产物位点：成键一步保持可见，直接“走”到位点
          pool.splice(i, 1);
          break;
        }
      }
    });
    // 电荷目标：rx.ions: { Na:1, Cl:-1 } → 电子转移完成后 Na⁺/Cl⁻
    if (rx.ions) {
      frags.forEach(function (f) {
        var q = rx.ions[f.el];
        if (!q) return;
        f.q = q;
      });
    }
    // 原子/离子标注跟随步骤：split 显示元素符号，transfer/products 对有电荷者显示离子
    function refreshFragLabels(index) {
      var mode = reactionModeOf(index);
      var ionShow = mode === 'transfer' || mode === 'products';
      frags.forEach(function (f) {
        if (!f.lab) return;
        if (f.q && ionShow) {
          var col = f.q > 0 ? '#1f66d0' : '#d34b3d';
          if (f.lab.userData.str !== ('i' + f.el + f.q)) setSpriteText(f.lab, ionText(f.el, f.q), col);
        } else if (f.lab.userData.str !== f.el) {
          setSpriteText(f.lab, f.el, '#22334f');
        }
      });
    }
    // 断键特效：反应物共价键上的橙红色电子对，在拆解瞬间从键中央飞回两端原子
    function spawnBondBreak() {
      lhsUnits.forEach(function (u) {
        if (!u.bondSeeds || !u.bondSeeds.length) return;
        u.bondSeeds.forEach(function (sd) {
          var em = new THREE.Mesh(ballGeo(0.13), pairMat);
          em.visible = false;
          root.add(em);
          breakFx.push({
            m: em, p0: sd.pos.clone(), p1: sd.ends[Math.random() < 0.5 ? 0 : 1].clone(),
            t: 0, seed: Math.random() * 0.4, life: 1.15
          });
        });
      });
    }
    function clearBondBreak() {
      for (var bj = 0; bj < breakFx.length; bj++) root.remove(breakFx[bj].m);
      breakFx.length = 0;
    }
    // 电子飞行对象：{a 供体 frag, b 受体 frag, t, life}
    function spawnFlights() {
      if (!rx.transfers) return;
      flights = [];
      rx.transfers.forEach(function (tr) {
        var donors = frags.filter(function (f) { return f.el === tr.a; });
        var accs = frags.filter(function (f) { return f.el === tr.b; });
        if (!donors.length || !accs.length) return;
        var n = tr.n || 1;
        var k = 0;
        for (var i = 0; i < n; i++) {
          var fd = donors[k % donors.length], fa = accs[k % accs.length];
          k++;
          var em = new THREE.Mesh(ballGeo(0.16), new THREE.MeshBasicMaterial({ color: TRANSFER_ELECTRON_NUM }));
          root.add(em);
          flights.push({ d: fd, a: fa, mesh: em, t: 0, life: 1.5, seed: Math.random() * 0.6 });
        }
      });
    }
    function clearFlights() {
      flights.forEach(function (fl) { root.remove(fl.mesh); });
      flights = [];
    }
    // —— 状态机 ——
    var cur = { molOp: 0, atomOp: 0, fragOp: 0, move: 0, prodOp: 0, prodScale: 0.55, pairsOp: 0, spread: 0 };
    reactionState = {
      rx: rx, step: 0, playing: false, timer: 0, done: false,
      root: root, frags: frags, lhsUnits: lhsUnits, rhsUnits: rhsUnits,
      decors: decors, cur: cur,
      flights: flights, breakFx: breakFx, fxEntered: false,
      spawnFx: spawnFlights, clearFx: clearFlights,
      spawnBreak: spawnBondBreak, clearBreak: clearBondBreak,
      refreshLabels: refreshFragLabels
    };
    view = {
      kind: 'reaction', id: id, root: root,
      atomMeshes: null,
      pickSprites: labelTargets,
      autorotate: false,
      update: function (dt) { tickReaction(dt); }
    };
    stepReactionTo(0);
    fitView(root);
    applyCamMode('flat');
    // 画面整体上移：避开底部说明卡，使内容居中于“顶部导航 ~ 说明卡”之间的可视带。
    // 上移量不再用固定的世界坐标偏移，而是“可视高度的比例”，
    // 由宿主通过 {cmd:'view', action:'band'} 告知上下遮挡区（像素），
    // 这样分步自动取景拉近/拉远后，上移量也会跟着缩放，内容始终落在可视带中央。
    view.bandTop = rxBand.top;
    view.bandBottom = rxBand.bottom;
    view.userFramed = false; // 新场景重新允许自动取景
    frameReactionView(1);    // 第一步就按“反应物行”取好景，不再退到能装下整条反应式的远机位
    showHint('平视视角 · 反应箭头水平向右 · 轻点分子式可查看分子结构 · 拖动观察断键成键', 3000);
    notify({ ev: 'reaction', step: 0, steps: rx.steps.length, playing: false });
  }

  function rxnModeTarget(mode) {
    return RXN_MODES[mode] || RXN_MODES.reactants;
  }
  // —— 反应过程的自动取景（跟拍）——
  // 每一步的主角不同：反应物行 / 散开的自由原子 / 生成物行。
  // 旧版只在动画停稳后把观察中心平移过去；现在每帧持续“跟拍”：
  // 既把主角中心移到画布可视带中央，也把机位拉近到刚好装下主角 —— 手机竖屏上才看得清分子和原子。
  function reactionActiveBounds() {
    if (!reactionState || !view) return null;
    var st = reactionState;
    var box = new THREE.Box3();
    var any = false;
    if (st.mode === 'reactants') {
      st.lhsUnits.forEach(function (u) { box.expandByObject(u.g); any = true; });
    } else if (st.mode === 'products') {
      st.rhsUnits.forEach(function (u) { box.expandByObject(u.g); any = true; });
    } else {
      // 断键/电子转移：以散开的自由原子（含飞行电子）为中心
      st.frags.forEach(function (f) {
        if (!f.mesh.visible) return;
        box.expandByPoint(f.mesh.position);
        any = true;
      });
      st.flights.forEach(function (fl) {
        if (fl.mesh && fl.mesh.visible) { box.expandByPoint(fl.mesh.position); any = true; }
      });
    }
    if (!any) return null;
    var sp = box.getBoundingSphere(new THREE.Sphere());
    return { c: sp.center, r: Math.max(sp.radius, 1.35) };
  }

  var rxFrameAcc = 1; // 初值设为 1：场景建好后的第一次调用立即取景
  var _rxFrameC = new THREE.Vector3();
  function frameReactionView(dt) {
    if (!reactionState || !view || view.kind !== 'reaction') return;
    if (view.userFramed) return; // 用户手动平移过就不再抢镜头（重置视角可恢复）
    rxFrameAcc += dt;
    if (rxFrameAcc < 0.12) return; // 包围盒重算限频，避免每帧全场景遍历
    rxFrameAcc = 0;
    var b = reactionActiveBounds();
    if (!b) return;
    // fitR 跟着当前一步的主角走：clampCam 的下限随之变小，才允许把机位拉近
    view.fitR = Math.max(b.r, 1.2);
    var need = userZoomed ? camState.radius : fitDistance(view.fitR, 1.08);
    // 依据“上下可视带”把内容抬到带中央（bandTop/bandBottom 为占屏高的比例）：
    // 底部说明卡比顶部导航占得更多时，内容中心应在屏带中央 = 屏幕中心上方 (bandBottom-bandTop)/2
    var visH = 2 * need * Math.tan((camera.fov * Math.PI) / 360);
    var lift = visH * Math.max(0, ((view.bandBottom || 0) - (view.bandTop || 0)) / 2);
    view.homeTarget = b.c.clone();
    _rxFrameC.set(b.c.x, b.c.y - lift, b.c.z);
    camTargetGoal.copy(_rxFrameC);
    if (!userZoomed) {
      camState.radius += (need - camState.radius) * 0.18;
      clampCam();
    }
  }
  function stepReactionTo(index) {
    if (!reactionState) return;
    var rx = reactionState.rx;
    index = clamp(index, 0, Math.max(rx.steps.length - 1, 0));
    reactionState.step = index;
    reactionState.timer = 0;
    var mode = reactionModeOf(index);
    var t = rxnModeTarget(mode);
    reactionState.target = t;
    reactionState.mode = mode;
    // 进入“电子转移”一步时生成飞行电子
    if (mode === 'transfer' && !reactionState.fxEntered) {
      if (reactionState.spawnFx) reactionState.spawnFx();
      reactionState.fxEntered = true;
    }
    if (mode !== 'transfer') {
      if (reactionState.clearFx) reactionState.clearFx();
      reactionState.fxEntered = false;
    }
    // split：让反应物共价键的电子对飞回两端原子（断键），离开 split 后清理
    if (mode === 'split' && !reactionState.breakDone) {
      if (reactionState.spawnBreak) reactionState.spawnBreak();
      reactionState.breakDone = true;
    } else if (mode !== 'split') {
      if (reactionState.clearBreak) reactionState.clearBreak();
      reactionState.breakDone = false;
    }
    // 更新原子/离子标注文本
    if (reactionState.refreshLabels) reactionState.refreshLabels(index);
    if (index === rx.steps.length - 1) reactionState.done = true;
    notify({ ev: 'reaction', step: index, steps: rx.steps.length, playing: reactionState.playing });
  }
  function tickReaction(dt) {
    if (!reactionState || !reactionState.root) return;
    var st = reactionState, cur = st.cur, t = st.target;
    // 步骤间动画基准放慢为 0.5 倍，再乘以宿主滑块下发的速度倍率（过渡补间、电子飞行与断键回归共用同一时钟）
    var adt = dt * 0.5 * reactionSpeed;
    var k = 1 - Math.exp(-adt * 1.7);

    // 最后一步（products）：离子先“走”到产物位点完成组合，产物分子在离子就位后才成形显现，
    // 避免“离子还在移动时化合物已经提前淡入”。
    var forming = st.mode === 'products';
    var kMove = 1 - Math.exp(-adt * (forming ? 3.2 : 1.7));
    cur.move += (t.move - cur.move) * kMove;
    if (Math.abs(t.move - cur.move) < 0.004) cur.move = t.move;
    var arrived = !forming || cur.move >= t.move - 0.015; // 离子已抵达产物位点

    var kForm = forming ? 1 - Math.exp(-adt * 3.0) : k; // 成形（产物显现 / 离子隐入）
    var targets = {
      molOp: t.molOp,
      atomOp: t.atomOp,
      // 组合完成：自由原子/离子淡出，把画面交给产物分子（未配对原子仍走 atomOp）
      fragOp: arrived && forming ? 0 : t.fragOp,
      prodOp: arrived ? t.prodOp : 0, // 就位前产物分子完全不显示
      prodScale: t.prodScale,
      pairsOp: arrived ? t.pairsOp : 0, // 共用电子对随产物一起出现
      spread: t.spread
    };
    ['molOp', 'atomOp', 'fragOp', 'prodOp', 'prodScale', 'pairsOp', 'spread'].forEach(function (key) {
      var tv = targets[key];
      var kk = (key === 'prodOp' || key === 'pairsOp' || key === 'fragOp') ? kForm : k;
      cur[key] += (tv - cur[key]) * kk;
      if (Math.abs(tv - cur[key]) < 0.003) cur[key] = tv;
    });
    // 反应物分子层
    st.lhsUnits.forEach(function (u) {
      setUnitOpacity(u, cur.molOp, 1);
      if (u.lab) u.lab.visible = cur.molOp > 0.06;
    });
    // 产物分子层 + 共用电子对
    st.rhsUnits.forEach(function (u) {
      setUnitOpacity(u, cur.prodOp, cur.prodScale);
      if (u.lab) u.lab.visible = cur.prodOp > 0.06;
      if (u.pairs) u.pairs.forEach(function (dm) {
        dm.visible = cur.pairsOp > 0.02;
        setOpacityDeep(dm, cur.pairsOp);
      });
    });
    // 自由原子位置/透明度（spread 使原子在拆解时从原分子处向外弹开，体现“断键”）
    // 已配对到产物位点的原子（matched）在成键一步保持不透明：原原子直接“走”到位点，不再渐变消失
    st.frags.forEach(function (f) {
      var op = f.matched ? cur.fragOp : cur.atomOp;
      var p = f.base.clone().addScaledVector(f.off, cur.spread);
      var pos = p.clone().lerp(f.target, cur.move);
      // 微浮摆动：成键到位后收敛，保证产物中原子的位置精确、不抖
      var sway = 1 - clamp((cur.move - 0.82) / 0.18, 0, 1);
      var sw = Math.sin((f.spin * (st.step + 1) * 3.2 + f.base.x * 9)) * 0.06 * sway;
      pos.x += sw; pos.y += Math.cos(f.base.z * 11 + f.spin) * 0.06 * sway;
      f.mesh.position.copy(pos);
      f.mesh.visible = op > 0.02;
      setOpacityDeep(f.mesh, op);
      // 元素符号 / 离子标注跟随原子
      if (f.lab) {
        f.lab.position.copy(pos);
        f.lab.position.y += 0.72;
        f.lab.visible = op > 0.1;
        setOpacityDeep(f.lab, Math.min(op, 1));
      }
    });
    // 全程跟拍：主角换步、原子散开/归位的过程中，画面中心与机位持续跟着调整
    frameReactionView(dt);
    // 电子飞行小球
    for (var i = st.flights.length - 1; i >= 0; i--) {
      var fl = st.flights[i];
      fl.t += adt;
      var p0 = fl.d.mesh.position, p1 = fl.a.mesh.position;
      var pr = Math.min(1, (fl.t - fl.seed) / fl.life);
      if (pr <= 0) { fl.mesh.visible = false; continue; }
      var ease = pr * pr * (3 - 2 * pr);
      var dir = new THREE.Vector3().subVectors(p1, p0).multiplyScalar(ease);
      fl.mesh.position.copy(p0).add(dir);
      fl.mesh.position.y += Math.sin(pr * Math.PI) * 0.5;
      fl.mesh.visible = true;
      setOpacityDeep(fl.mesh, pr > 1 ? 0 : (1 - pr));
      if (pr >= 1) { st.root.remove(fl.mesh); st.flights.splice(i, 1); }
    }
    // 断键：反应物电子对飞回两端原子
    for (var bj = st.breakFx.length - 1; bj >= 0; bj--) {
      var bf = st.breakFx[bj];
      bf.t += adt;
      var bpr = (bf.t - bf.seed) / bf.life;
      if (bpr <= 0) { bf.m.visible = false; continue; }
      if (bpr >= 1) { st.root.remove(bf.m); st.breakFx.splice(bj, 1); continue; }
      var be = bpr * bpr * (3 - 2 * bpr);
      bf.m.visible = true;
      bf.m.position.lerpVectors(bf.p0, bf.p1, be);
      bf.m.position.y += Math.sin(bpr * Math.PI) * 0.5;
      setOpacityDeep(bf.m, bpr > 0.72 ? (1 - (bpr - 0.72) / 0.28) : 1);
    }
    // 自动播放（每步停留时长同样按倍率缩放）
    if (st.playing) {
      st.timer += dt * reactionSpeed;
      var hold = st.done ? rxnHoldOf('products') + 1.6 : rxnHoldOf(st.mode);
      if (st.timer >= hold) {
        if (st.step < st.rx.steps.length - 1) {
          stepReactionTo(st.step + 1);
        } else {
          st.playing = false;
          notify({ ev: 'reaction', step: st.step, steps: st.rx.steps.length, playing: false });
        }
      }
    }
  }
  function root0remove(obj) { if (reactionState && reactionState.root) reactionState.root.remove(obj); }

  function cmdReaction(action, payload) {
    if (!reactionState) return;
    var steps = reactionState.rx.steps;
    if (action === 'play') {
      reactionState.playing = true;
      if (reactionState.done) {
        reactionState.done = false;
        stepReactionTo(0);
        reactionState.playing = true;
      }
      reactionState.timer = 0;
    } else if (action === 'pause') {
      reactionState.playing = false;
    } else if (action === 'restart') {
      reactionState.playing = true;
      reactionState.done = false;
      stepReactionTo(0);
      reactionState.timer = 0;
    } else if (action === 'prev') {
      reactionState.playing = false;
      stepReactionTo(reactionState.step - 1);
    } else if (action === 'next') {
      reactionState.playing = false;
      stepReactionTo(reactionState.step + 1);
    } else if (action === 'step' && typeof payload === 'number') {
      reactionState.playing = false;
      stepReactionTo(payload);
    } else if (action === 'speed' && typeof payload === 'number') {
      // 速度倍率：仅缩放动画与自动播放节拍，不改变播放/暂停状态
      reactionSpeed = clamp(payload, 0.1, 2);
    }
    notify({ ev: 'reaction', step: reactionState.step, steps: steps.length, playing: reactionState.playing });
  }

  /* ================= 半径比实验室（配位数 4 / 6 / 8） =================
   * 以负离子半径 r₋ 为 1 个长度单位，正离子半径就是半径比 k = r₊/r₋。
   * 摆放规则：负离子先“紧密堆积”（彼此相切），正离子长大到塞不进空隙时被迫把负离子撑开；
   * 一旦撑到临界半径比，同样的排列下正负离子再也兼顾不了，晶体只能重排成更高配位数的结构。
   * 因此：配位数不是连续变化的，而是在 0.414 / 0.732 处“跳变”。
   */
  var radiusState = null;
  var RAD_TRANS = 1.0;   // 配位数跳变总时长（秒）
  var RAD_STRAIN = 0.42; // 其中先维持旧结构示警的比例
  // 负离子紧密堆积时，空隙中心到负离子中心的距离（√(3/2)、√2、√3 对应的紧密堆积几何）
  var RAD_G = { 4: 1.2247, 6: 1.4142, 8: 1.7321 };
  // 该配位结构能容忍的最大半径比（超过就必须重排）
  var RAD_UPPER = { 4: 0.4142, 6: 0.732, 8: 1.0 };
  // 到达上临界时，负离子被撑开的程度（用于把“堆积受力”映射成颜色）
  var RAD_STRETCH = { 4: 0.155, 6: 0.225, 8: 0.155 };

  function radVec(a) { return new THREE.Vector3(a[0], a[1], a[2]).normalize(); }
  // 8 个立方体顶角方向：前 4 个正好构成一个正四面体（配位数 4）
  var RAD_SIGNS = [
    [1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1],
    [-1, -1, -1], [-1, 1, 1], [1, -1, 1], [1, 1, -1]
  ];
  var RAD_DIRS = RAD_SIGNS.map(radVec);
  var RAD_OCT = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(radVec);
  var RAD_EDGES = {
    4: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]],
    6: [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [2, 5], [3, 4], [3, 5]],
    8: (function () {
      var out = [];
      for (var i = 0; i < RAD_SIGNS.length; i++) {
        for (var j = i + 1; j < RAD_SIGNS.length; j++) {
          var s = RAD_SIGNS[i], t = RAD_SIGNS[j];
          var diff = (s[0] !== t[0] ? 1 : 0) + (s[1] !== t[1] ? 1 : 0) + (s[2] !== t[2] ? 1 : 0);
          if (diff === 1) out.push([i, j]);
        }
      }
      return out;
    })()
  };

  function radCnFor(k) {
    if (k < RAD_UPPER[4]) return 4;
    if (k < RAD_UPPER[6]) return 6;
    return 8;
  }
  function radVoidName(cn) { return cn === 4 ? '四面体空隙' : cn === 6 ? '八面体空隙' : '立方体空隙'; }
  function radTypeName(cn) {
    return cn === 4 ? 'ZnS 型（闪锌矿）' : cn === 6 ? 'NaCl 型（岩盐）' : 'CsCl 型（氯化铯）';
  }

  /** 某个配位结构在当前半径比下的摆放：8 个槽位的方向 / 距离 / 是否登场 */
  function radLayout(cn, k) {
    // 负离子想保持相切（距离 RAD_G[cn]），正离子又必须碰到它（距离 1+k）：取较大者
    var dist = Math.max(RAD_G[cn], 1 + k);
    var out = [];
    for (var i = 0; i < 8; i++) {
      var op = cn === 4 ? (i < 4 ? 1 : 0) : cn === 6 ? (i < 6 ? 1 : 0) : 1;
      var dir = (cn === 6 && i < 6) ? RAD_OCT[i] : RAD_DIRS[i];
      out.push({ dir: dir, dist: dist, op: op });
    }
    return out;
  }

  var ROD_UP = new THREE.Vector3(0, 1, 0);
  function rodUpdate(mesh, from, to, thick) {
    var dir = new THREE.Vector3().subVectors(to, from);
    var len = dir.length();
    if (len < 1e-4) { mesh.visible = false; return; }
    mesh.visible = true;
    mesh.position.copy(from).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(ROD_UP, dir.normalize());
    mesh.scale.set(thick, len, thick);
  }
  function makeRod(geo, hex, opacity) {
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: opacity }));
  }

  function showRadiusScene(ratio0) {
    setStageVisible(true);
    var k0 = (typeof ratio0 === 'number' && isFinite(ratio0)) ? clamp(ratio0, 0.2, 1) : 0.564;
    var cn0 = radCnFor(k0);
    var root = new THREE.Group();
    var anionGeo = new THREE.SphereGeometry(1, 26, 20);
    var catGeo = new THREE.SphereGeometry(1, 26, 20);
    var rodGeo = new THREE.CylinderGeometry(1, 1, 1, 10);

    var cation = new THREE.Mesh(catGeo, stdMat(0xF2A25C, { roughness: 0.42 })); // 橙 = 正离子 r₊
    cation.scale.setScalar(k0);
    root.add(cation);

    var i, anions = [], contacts = [], gapRods = [], links = [];
    for (i = 0; i < 8; i++) {
      var am = new THREE.Mesh(anionGeo, stdMat(0x5FBFA8, { roughness: 0.45 })); // 绿 = 负离子 r₋
      am.visible = false;
      root.add(am);
      anions.push(am);
      var cm = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), new THREE.MeshBasicMaterial({ color: 0x1fa97a, transparent: true, opacity: 0.95 }));
      cm.visible = false;
      root.add(cm);
      contacts.push(cm);
      var gr = makeRod(rodGeo, 0xe5524a, 0.8);
      gr.visible = false;
      root.add(gr);
      gapRods.push(gr);
    }
    // 负离子之间的“堆积接触”：每条棱用两段短线表示，接触时两段刚好接上
    for (i = 0; i < 24; i++) {
      var lr = makeRod(rodGeo, 0xb9c6d8, 0.8);
      lr.visible = false;
      root.add(lr);
      links.push(lr);
    }

    var labAnion = textSprite('r₋', { size: 30, worldH: 0.34, color: '#2f7f6a', bold: true });
    root.add(labAnion);
    var labCation = textSprite('r₊', { size: 30, worldH: 0.34, color: '#a55b1e', bold: true });
    root.add(labCation);

    sceneRoot.add(root);
    radiusState = {
      k: k0, kTarget: k0, cn: cn0, trans: null, blink: 0,
      slots: radLayout(cn0, k0).map(function (s) { return { dir: s.dir.clone(), dist: s.dist, op: s.op }; }),
      gaps: [0, 0, 0, 0, 0, 0, 0, 0], rattle: 0,
      cation: cation, anions: anions, contacts: contacts, gapRods: gapRods, links: links,
      labAnion: labAnion, labCation: labCation
    };
    view = {
      kind: 'radius', id: 'radius', root: root, atomMeshes: [], autorotate: true, update: radUpdate
    };
    fitView(root, 3.3);
    applyCamMode('solid');
    showHint('拖动页面上的滑块改变半径比 · 手指可旋转缩放', 2800);
  }

  /** 每帧更新：负离子不断向“当前该有的排布”逼近，跨临界值时先示警、再花约 1 秒滑到新结构 */
  function radUpdate(dt) {
    var st = radiusState;
    if (!st || !view || view.kind !== 'radius') return;

    st.k += (st.kTarget - st.k) * (1 - Math.exp(-dt * 9));
    var k = st.k;
    var targetCN = radCnFor(k);

    // 跳变时间线：先在旧结构上把“为什么撑不住”演出来，再滑到新排布
    if (st.trans) {
      st.trans.t += dt / RAD_TRANS;
      if (targetCN === st.trans.fromCN && st.trans.t < RAD_STRAIN) {
        st.trans = null; // 还没开始重排就被拖回去了，取消这次跳变
      } else if (st.trans.t >= RAD_STRAIN && st.cn !== st.trans.toCN) {
        st.cn = st.trans.toCN;
      }
      if (st.trans && st.trans.t >= 1) { st.cn = st.trans.toCN; st.trans = null; }
    }
    if (!st.trans && targetCN !== st.cn) st.trans = { t: 0, fromCN: st.cn, toCN: targetCN };

    var layoutCN = (st.trans && st.trans.t < RAD_STRAIN) ? st.trans.fromCN : st.cn;
    var tgt = radLayout(layoutCN, k);
    var rate = st.trans ? (st.trans.t < RAD_STRAIN ? 9 : 4.2) : 7;
    var f = 1 - Math.exp(-dt * rate);

    // 正离子太大 → 负离子堆积被破坏的强度（用于把棱染红并断裂）
    var fail = 0;
    if (st.trans && st.trans.toCN > st.trans.fromCN) {
      fail = st.trans.t < RAD_STRAIN ? 1 : clamp(1 - (st.trans.t - RAD_STRAIN) / 0.3, 0, 1);
    }
    st.blink += dt;
    var blink = 0.5 + 0.5 * Math.sin(st.blink * 11);

    var cGrey = new THREE.Color(0xb9c6d8), cWarn = new THREE.Color(0xe2822f), cBad = new THREE.Color(0xe5524a);
    var _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3(), _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), _dir = new THREE.Vector3();
    var maxDist = 0.001;
    var i;
    for (i = 0; i < 8; i++) {
      var t = tgt[i], s = st.slots[i];
      s.dir.lerp(t.dir, f);
      if (s.dir.lengthSq() < 1e-8) s.dir.copy(t.dir); else s.dir.normalize();
      s.dist += (t.dist - s.dist) * f;
      s.op += (t.op - s.op) * f;
      if (s.dist > maxDist) maxDist = s.dist;

      var a = st.anions[i];
      a.visible = s.op > 0.02;
      a.position.copy(s.dir).multiplyScalar(s.dist);
      if (a.visible) {
        a.scale.setScalar(0.85 + 0.15 * s.op);
      }

      // 接触检测：正离子够不够大，能不能同时碰到周围所有负离子
      var gap = s.dist - 1 - k;          // > 0 说明还够不着（太小），≈ 0 表示刚好接触
      st.gaps[i] = gap;
      var touching = Math.abs(gap) <= 0.025;
      var showDot = s.op > 0.35;
      var cm = st.contacts[i];
      cm.visible = showDot;
      if (showDot) {
        var md = touching ? Math.max(k, 0.06) : Math.max((k + s.dist - 1) / 2, 0.06);
        cm.position.copy(s.dir).multiplyScalar(md);
        cm.material.color.setHex(touching ? 0x1fa97a : 0xe5524a);
        cm.material.opacity = touching ? 0.95 : 0.35 + 0.6 * blink;
        cm.scale.setScalar(touching ? 1 : 1.2);
      }
      var gr = st.gapRods[i];
      gr.visible = showDot && gap > 0.025;
      if (gr.visible) {
        _p0.copy(s.dir).multiplyScalar(Math.max(k, 0.02));
        _p1.copy(s.dir).multiplyScalar(Math.max(s.dist - 1, 0.03));
        rodUpdate(gr, _p0, _p1, 0.05);
        gr.material.opacity = 0.3 + 0.5 * blink;
      }
    }

    // 正离子明显装不满空隙时，把负离子调成半透明，能直接看见里面“空荡荡”的正离子
    var maxGap = 0;
    for (i = 0; i < 8; i++) {
      if (st.slots[i].op > 0.5 && st.gaps[i] > maxGap) maxGap = st.gaps[i];
    }
    var hollow = clamp(maxGap / 0.14, 0, 1);
    for (i = 0; i < 8; i++) {
      var aa = st.anions[i];
      if (!aa.visible) continue;
      aa.material.opacity = (0.2 + 0.8 * st.slots[i].op) * (1 - 0.62 * hollow);
      aa.material.depthWrite = hollow < 0.04;
    }

    // 负离子之间的堆积接触线：被撑开先变橙，撑到极限变红并断裂
    var edges = RAD_EDGES[st.cn] || RAD_EDGES[8];
    var maxStretch = RAD_STRETCH[st.cn] || 0.2;
    var li = 0;
    for (i = 0; i < edges.length; i++) {
      var sa = st.slots[edges[i][0]], sb = st.slots[edges[i][1]];
      var vis = sa.op > 0.5 && sb.op > 0.5;
      var l1 = st.links[li++], l2 = st.links[li++];
      if (!vis) { l1.visible = false; l2.visible = false; continue; }
      _p0.copy(sa.dir).multiplyScalar(sa.dist);
      _p1.copy(sb.dir).multiplyScalar(sb.dist);
      var len = _p0.distanceTo(_p1);
      // 两球表面之间被撑开的缝：0 = 刚好相切（紧密堆积），越大说明被撑得越狠
      var press = clamp((len / 2 - 1) / maxStretch, 0, 1);
      var pv = Math.max(press * 0.7, fail);
      // 正离子变小、配位数下降的过程中，中间态会被算得“很撑”，但这时的原因是装不满而不是撑爆 → 不染成断裂红
      if (st.trans && st.trans.toCN < st.trans.fromCN) pv = Math.min(pv, 0.6);
      var col = pv < 0.5 ? cGrey.clone().lerp(cWarn, pv / 0.5) : cWarn.clone().lerp(cBad, (pv - 0.5) / 0.5);
      // 撑到极限：两段短线各自往自己的负离子上缩，中间裂开 → 看起来就是“断裂”
      var retract = pv > 0.8 ? 0.62 * ((pv - 0.8) / 0.2) : 0;
      var far = len / 2 - retract * (len / 2 - 1);
      if (far < 0.76) { l1.visible = false; l2.visible = false; continue; }
      _dir.subVectors(_p1, _p0).normalize();
      _t1.copy(_p0).addScaledVector(_dir, 0.72);
      _t2.copy(_p0).addScaledVector(_dir, far);
      rodUpdate(l1, _t1, _t2, 0.05);
      l1.material.color = col;
      l1.material.opacity = 0.9;
      _t1.copy(_p1).addScaledVector(_dir, -0.72);
      _t2.copy(_p1).addScaledVector(_dir, -far);
      rodUpdate(l2, _t1, _t2, 0.05);
      l2.material.color = col;
      l2.material.opacity = 0.9;
    }
    for (; li < st.links.length; li++) st.links[li].visible = false;

    // 够不着时让正离子在空隙里“晃动”，肉眼能看出它撑不满这个空隙
    st.rattle += dt;
    if (maxGap > 0.003) {
      var amp = Math.min(maxGap * 4, 0.24);
      st.cation.position.set(Math.sin(st.rattle * 9) * amp, Math.cos(st.rattle * 11.3) * amp * 0.7, Math.cos(st.rattle * 7.7) * amp * 0.5);
    } else {
      st.cation.position.set(0, 0, 0);
    }

    // 只标注 r₊ / r₋ 两个尺寸（配位数、半径比由页面上的面板显示）
    st.cation.scale.setScalar(Math.max(k, 0.05));
    st.labAnion.visible = st.slots[0].op > 0.5;
    if (st.labAnion.visible) {
      st.labAnion.position.copy(st.slots[0].dir).multiplyScalar(st.slots[0].dist + 1.05);
    }
    st.labCation.position.set(0, -maxDist - 0.85, 0);
  }

  /* ================= 主循环 / 命令 ================= */
  var clock = new THREE.Clock();
  function loop() {
    requestAnimationFrame(loop);
    var dt = Math.min(clock.getDelta(), 0.05);
    var now = performance.now();

    if (view && view.update) view.update(dt);
    if (autoRotate && now - lastInteract > 1800 && !(view && view.kind === 'reaction' && reactionState && reactionState.playing)) {
      camState.az += dt * 0.3;
    }
    // 观察中心平滑逼近目标（方向键平移 / 分步自动居中）
    camTarget.lerp(camTargetGoal, 1 - Math.exp(-dt * 9));
    applyCamera();
    renderer.render(scene, camera);
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

  var ready = false;
  var gotCommand = false;
  function handleCommand(raw) {
    var msg = raw;
    if (typeof raw === 'string') { try { msg = JSON.parse(raw); } catch (e) { return; } }
    if (!msg || typeof msg !== 'object') return;
    var cmd = msg.cmd;
    if (cmd === 'scene') {
      gotCommand = true;
      clearView();
      var mode = msg.mode;
      if (mode === 'molecule' || mode === 'lattice') showMoleculeScene(msg.id, msg.mol || null);
      else if (mode === 'atom') showAtomScene(msg.id, { molId: msg.molId, ai: msg.ai, mol: msg.mol || null });
      else if (mode === 'reaction') showReactionScene(msg.id, msg.reaction || null);
      else if (mode === 'radius') showRadiusScene(msg.ratio);
      notify({ ev: 'scene', mode: mode, id: msg.id });
    } else if (cmd === 'radius') {
      // 半径比实验室：滑块数值（0.2 ~ 1.0）
      if (radiusState && typeof msg.value === 'number' && isFinite(msg.value)) {
        radiusState.kTarget = clamp(msg.value, 0.2, 1);
      }
    } else if (cmd === 'reaction') {
      cmdReaction(msg.action, msg.value);
    } else if (cmd === 'atomBond') {
      // 原子视图里的“共价键形成”演示：play / pause / restart / next / prev / step
      cmdAtomBond(msg.action, msg.value);
    } else if (cmd === 'view') {
      if (msg.action === 'reset' && view) {
        userZoomed = false; // 复位后重新允许自动取景
        view.userFramed = false;
        applyCamMode(view.camMode || (view.kind === 'atom' ? 'top' : 'solid'));
        // 同时把观察中心归位（方向键平移 / 分步自动居中后可用它复位）
        if (view.homeTarget) focusTarget(view.homeTarget.x, view.homeTarget.y, view.homeTarget.z);
      } else if (msg.action === 'pan') {
        panCamera(msg.dir);
      } else if (msg.action === 'top') {
        applyCamMode('top');
      } else if (msg.action === 'solid') {
        applyCamMode('solid');
      } else if (msg.action === 'autorotate') {
        autoRotate = !!msg.value;
      } else if (msg.action === 'labels') {
        // 显示/隐藏分子原子球上的元素符号标注
        if (view) view.showLabels = !!msg.value;
        setMoleculeLabelsVisible(!!msg.value);
      } else if (msg.action === 'clearSel') {
        clearSelection();
      } else if (msg.action === 'band') {
        // 宿主告知 3D 画布上下被遮挡的区域（顶部导航 / 底部说明卡，单位 px），
        // 反应场景的自动取景会把内容放进这两条之间的可视带中央
        // px 换算依赖当时的画布高度 H（可能此刻为 0，宿主会在 ready 后重发），H>0 时才更新
        if (typeof msg.top === 'number' && typeof msg.bottom === 'number' && H > 0) {
          rxBand.top = clamp(msg.top / H, 0, 1);
          rxBand.bottom = clamp(msg.bottom / H, 0, 1);
          if (view && view.kind === 'reaction') {
            view.bandTop = rxBand.top;
            view.bandBottom = rxBand.bottom;
            rxFrameAcc = 1; // 下一帧立刻按新的可视带重新取景
          } else if (view && view.kind === 'atom') {
            // 底部信息卡高度变化（展开/收起介绍、出现成键演示卡）时重新取景
            view.bandTop = rxBand.top;
            view.bandBottom = rxBand.bottom;
            if (!userZoomed) frameAtomView();
          }
        }
      }
    } else if (cmd === 'ping') {
      notify({ ev: 'ready', ok: true });
    }
  }

  window.addEventListener('message', function (e) {
    handleCommand(e.data);
  });
  window.__dispatch = handleCommand;
  // 调试口：headless 截图 / 排查取景问题时读取当前相机与包围盒状态
  window.__chemDebug = function () {
    if (!view) return { view: null };
    var b = typeof reactionActiveBounds === 'function' && reactionState ? reactionActiveBounds() : null;
    return {
      kind: view.kind,
      mode: reactionState ? reactionState.mode : null,
      fitR: view.fitR,
      radius: camState.radius,
      aspect: camera.aspect,
      target: camTarget.toArray(),
      goal: camTargetGoal.toArray(),
      bounds: b ? { c: b.c.toArray(), r: b.r } : null,
      userFramed: !!view.userFramed,
      userZoomed: userZoomed,
      // 大 π 键（离域 π）相关：分子视图的公有云、原子视图的成键演示进度
      piCloud: view.piCloud ? view.piCloud.electrons.length : 0,
      // 大 π 键云的世界包围盒（确认它横跨了参与的每个原子，而不是缩在一处）
      piBox: (function () {
        var box = null;
        try {
          view.root.traverse(function (n) {
            if (n.material && n.material.color && n.material.color.getHex() === BIG_PI_NUM) {
              if (!box) box = new THREE.Box3();
              box.expandByObject(n);
            }
          });
        } catch (e) { return null; }
        return box ? { min: box.min.toArray().map(round3), max: box.max.toArray().map(round3) } : null;
      })(),
      bond: atomBond ? {
        steps: atomBond.steps.length, step: atomBond.step, hasBigPi: !!atomBond.hasBigPi,
        pi: atomBond.cur.pi, near: atomBond.cur.near, pair: atomBond.cur.pair, bond: atomBond.cur.bond,
        partners: atomBond.partners.length, linkItems: atomBond.linkItems.length,
        piE: atomBond.piFx ? atomBond.piFx.cloud.electrons.length : 0
      } : null
    };
  };
  // 调试口：快进 N 帧动画逻辑（headless 截图时渲染极慢，用它把动画推到稳态再截图）
  window.__chemWarm = function (frames) {
    var step = 1 / 60;
    for (var i = 0; i < frames; i++) {
      if (view && view.update) view.update(step);
      camTarget.lerp(camTargetGoal, 1 - Math.exp(-step * 9));
    }
    applyCamera();
    if (renderer) renderer.render(scene, camera);
    return { frames: frames, dbg: window.__chemDebug() };
  };

  /* ---------------- 启动 ---------------- */
  function main() {
    if (!hasThree || !DATA) {
      showError('引擎资源加载失败（缺少 THREE 或内容数据）。');
      return;
    }
    makeTooltip();
    initGL();
    scene.add(sceneRoot); // scene 由 initGL() 创建
    setupInput();
    applyCamera();

    // 心跳：告诉宿主引擎就绪，并带上“是否已收到场景命令”状态。
    // 宿主只在 got=false 时补发场景，避免启动阶段反复重建场景把初始动画重播好几遍。
    var attempts = 0;
    var hb = setInterval(function () {
      attempts++;
      notify({ ev: 'ready', got: gotCommand });
      if (attempts > 3 || gotCommand) clearInterval(hb);
    }, 300);

    setTimeout(function () {
      if (bootEl) bootEl.classList.add('hide');
      if (!gotCommand) {
        // 默认展示水分子，等待宿主指令
        clearView();
        showMoleculeScene('h2o');
        showHint('拖动旋转 · 滚轮/双指缩放 · 轻点原子查看电子结构', 3200);
      }
      ready = true;
    }, 60);

    requestAnimationFrame(loop);
    window.__engineReady = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
