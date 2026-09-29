/* =========================================================================
 * 演示场景库
 * -------------------------------------------------------------------------
 * A. 三方向定则训练器（3D）：安培力 / 洛伦兹力 / 右手定则
 * B. 电磁感应探究台（3D + 2D 曲线）：磁铁插拔线圈，Φ 与 I 实时联动
 * C. 交流电波形实验室（2D 图表）：相量同步 / 有效值探究 / 变压器 / 远距离输电
 *
 * 坐标约定：x 向右，y 向上，z 垂直纸面向外（朝观察者）
 * ========================================================================= */
(function () {
  'use strict';
  var A = window.PHYS;
  var U = A.util;
  var V = U.V;
  var REG = A.sceneApi.registry;

  var DIRS = {
    left: [-1, 0, 0], right: [1, 0, 0], up: [0, 1, 0], down: [0, -1, 0], inn: [0, 0, -1], out: [0, 0, 1],
  };
  var DIR_CN = { left: '左', right: '右', up: '上', down: '下', inn: '垂直纸面向里', out: '垂直纸面向外' };

  function v3(a) { return V(a[0], a[1], a[2]); }
  function dirKey(vec) {
    var best = null, bs = -2;
    Object.keys(DIRS).forEach(function (k) {
      var d = v3(DIRS[k]);
      var s = vec.clone().normalize().dot(d);
      if (s > bs) { bs = s; best = k; }
    });
    return bs > 0.5 ? best : null;
  }

  function metalMat(col) {
    return new THREE.MeshStandardMaterial({
      color: col || 0xd8a24a, emissive: 0x2a1602, emissiveIntensity: 0.4, roughness: 0.32, metalness: 0.75,
    });
  }

  /** 「× / ·」符号贴图：into=true → 向里（×），false → 向外（·） */
  function fieldTex(into) {
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var g = c.getContext('2d');
    if (into) {
      g.strokeStyle = '#7fd7ff';
      g.lineWidth = 6;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(18, 18); g.lineTo(46, 46);
      g.moveTo(46, 18); g.lineTo(18, 46);
      g.stroke();
    } else {
      g.fillStyle = '#7fd7ff';
      g.beginPath(); g.arc(32, 32, 5.5, 0, 6.284); g.fill();
      g.globalAlpha = 0.55;
      g.beginPath(); g.arc(32, 32, 14, 0, 6.284); g.fill();
      g.globalAlpha = 1;
      g.strokeStyle = '#7fd7ff'; g.lineWidth = 3;
      g.beginPath(); g.arc(32, 32, 22, 0, 6.284); g.stroke();
    }
    return new THREE.CanvasTexture(c);
  }
  var TEX_X = null, TEX_DOT = null;

  /** 一片 ×（或 ·）符号阵列，代表垂直纸面的匀强磁场 */
  function fieldSymbols(into, x0, x1, y0, y1, z, nx, ny) {
    if (!TEX_X) TEX_X = fieldTex(true);
    if (!TEX_DOT) TEX_DOT = fieldTex(false);
    var grp = new THREE.Group();
    var mat = new THREE.SpriteMaterial({
      map: into ? TEX_X : TEX_DOT, transparent: true, opacity: 0.78, depthWrite: false,
    });
    for (var i = 0; i < nx; i++) {
      for (var j = 0; j < ny; j++) {
        var sp = new THREE.Sprite(mat);
        sp.position.set(
          x0 + (x1 - x0) * (nx === 1 ? 0.5 : i / (nx - 1)),
          y0 + (y1 - y0) * (ny === 1 ? 0.5 : j / (ny - 1)),
          z
        );
        sp.scale.set(0.5, 0.5, 1);
        grp.add(sp);
      }
    }
    return grp;
  }

  /* =====================================================================
   * A1. 安培力 · 左手定则
   * =================================================================== */
  REG['rule-ampere'] = {
    layout: 'full', fit: 8.2,
    build: function (ctx) {
      var v = ctx.v = {};
      var G = ctx.add(new THREE.Group());
      var railMat = new THREE.MeshStandardMaterial({ color: 0x93a7c8, roughness: 0.4, metalness: 0.6 });
      [-1.75, 1.75].forEach(function (y) {
        var r = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.13, 0.18), railMat);
        r.position.set(0.2, y, 0);
        G.add(r);
      });
      // 电源
      var bat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.34),
        new THREE.MeshStandardMaterial({ color: 0x3d5480, roughness: 0.5, metalness: 0.3 }));
      bat.position.set(-2.95, 0, 0);
      G.add(bat);
      var lb = U.label('电源', { color: '#cfe0ff', worldH: 0.32 });
      lb.position.set(-2.95, 0.95, 0); G.add(lb);

      // 导体棒（沿 y）
      v.bar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.4, 16), metalMat(0xf0c46a));
      v.bar.position.set(0.9, 0, 0);
      G.add(v.bar);

      // 磁场符号
      v.sym = fieldSymbols(true, -2.3, 2.3, -1.25, 1.25, -0.85, 7, 5);
      G.add(v.sym);

      // 三个矢量箭头
      v.arrowI = U.arrow(V(0, 0, 0), V(0, 1, 0), 1.5, 0xffe066, 0.055);
      v.arrowB = U.arrow(V(2.6, 1.5, 0.6), V(0, 0, -1), 1.2, 0x66d9ff, 0.055);
      v.arrowF = U.arrow(V(0, 0, 0), V(-1, 0, 0), 1.6, 0xff9f43, 0.065);
      v.arrowF.visible = false;
      G.add(v.arrowI, v.arrowB, v.arrowF);
      v.lbB = U.label('B ⊗ 向里', { color: '#bfefff', worldH: 0.36 });
      v.lbB.position.set(2.6, 2.2, 0.6); G.add(v.lbB);
      v.lbF = U.label('F', { color: '#ffd9a8', worldH: 0.44 });
      v.lbF.visible = false;
      G.add(v.lbF);
      v.note = U.label('', { color: '#ffd9a8', worldH: 0.34 });
      v.note.position.set(0, -2.5, 0);
      G.add(v.note);
    },
    onParams: function (ctx, p) {
      var v = ctx.v;
      var bIn = p.bIn !== false;
      var iUp = p.iUp !== false;
      var parallel = p.variant === 'parallel';

      // 反例：导体棒与磁场平行（沿 z 摆放）
      if (parallel) {
        v.bar.rotation.x = Math.PI / 2;
        v.bar.position.set(0.9, 0, 0);
        v.arrowF.visible = false;
        v.lbF.visible = false;
        v.arrowI.userData.setVec(V(0.9, 0, -1.7), V(0, 0, 1), 1.5);
        v.note.userData = null;
        v.note.visible = true;
        setLabel(v.note, 'I ∥ B ⇒ F = 0，不受安培力', '#ffd9a8');
        return;
      }
      v.bar.rotation.x = 0;
      v.note.visible = false;

      // 磁场符号方向
      G_replaceSymbol(v, bIn);
      v.arrowB.userData.setVec(V(2.6, 1.5, 0.9), bIn ? V(0, 0, -1) : V(0, 0, 1), 1.2);
      setLabel(v.lbB, bIn ? 'B ⊗ 向里' : 'B ⊙ 向外', '#bfefff');
      v.lbB.position.set(2.6, 2.2, 0.9);

      // 电流箭头
      var L = iUp ? V(0, 1, 0) : V(0, -1, 0);
      var from = iUp ? V(0.9, -1.5, 0) : V(0.9, 1.5, 0);
      v.arrowI.userData.setVec(from, L, 1.5);

      // 正确受力：F = I L × B
      var Bv = bIn ? V(0, 0, -1) : V(0, 0, 1);
      var F = new THREE.Vector3().crossVectors(L, Bv);
      ctx.v.answer = dirKey(F);
      ctx.v.answerVec = F;

      var show = p.reveal || !!p.choose;
      var chosen = p.choose ? v3(DIRS[p.choose]) : null;
      v.arrowF.visible = !!show;
      v.lbF.visible = !!show;
      if (show) {
        var dir = (p.reveal && !chosen) ? F.clone().normalize() : chosen.clone().normalize();
        var ok = p.choose && p.choose === ctx.v.answer;
        var col = ok ? 0x4ce08a : 0xff6b6b;
        v.arrowF.children.forEach(function (c) {
          if (c.material) { c.material.color.setHex(col); c.material.emissive.setHex(col); }
        });
        v.arrowF.userData.setVec(V(0.9, 0, 0), dir, 1.7);
        setLabel(v.lbF, ok ? 'F ✓ 正确' : (p.reveal ? 'F（正确方向）' : 'F ✗ 再想想'), ok ? '#c8ffe0' : '#ffc9c9');
        v.lbF.position.copy(V(0.9, 0, 0)).addScaledVector(dir, 2.0);
        if (p.choose) {
          A.notify({
            ev: 'answer', ok: !!ok, answer: ctx.v.answer,
            answerCn: DIR_CN[ctx.v.answer] || '', chooseCn: DIR_CN[p.choose] || '',
          });
        }
      }
    },
  };

  function setLabel(sp, text, color) {
    var c = document.createElement('canvas');
    var fs = 42;
    var g0 = c.getContext('2d');
    g0.font = '700 ' + fs + 'px -apple-system, "PingFang SC", sans-serif';
    c.width = Math.ceil(g0.measureText(text).width) + 26;
    c.height = Math.ceil(fs * 1.5);
    var g = c.getContext('2d');
    g.font = '700 ' + fs + 'px -apple-system, "PingFang SC", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(6,12,26,0.55)';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = color || '#eaf4ff';
    g.fillText(text, c.width / 2, c.height / 2 + 1);
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    var old = sp.material.map;
    sp.material.map = tex;
    sp.material.needsUpdate = true;
    if (old && old.dispose) old.dispose();
    sp.scale.set(sp.scale.y * (c.width / c.height), sp.scale.y, 1);
  }

  function G_replaceSymbol(v, bIn) {
    if (v.symIn === bIn) return;
    v.symIn = bIn;
    v.sym.children.forEach(function (s) {
      s.material.map = bIn ? TEX_X : TEX_DOT;
      s.material.needsUpdate = true;
    });
  }

  /* =====================================================================
   * A2. 洛伦兹力 · 带电粒子在磁场中的运动（圆 / 螺旋 / 直线）
   * =================================================================== */
  (function () {
    var BMAG = 2.2, V0 = 1.75, DT = 0.02;
    /** Boris 推进器：能量精确守恒，圆周/螺旋轨迹不漂移 */
    function integrate(q, angleDeg) {
      var th = angleDeg * Math.PI / 180;
      var v = V(Math.sin(th), 0, -Math.cos(th)).multiplyScalar(V0);
      var p = V(-1.9, 0, 0);
      var Bv = V(0, 0, -BMAG);
      var pts = [p.clone()], vs = [v.clone()];
      var t = V(0, 0, -BMAG * q * DT * 0.5);          // t = qB·dt/2（单位电荷质量）
      var s = t.clone().multiplyScalar(2 / (1 + t.dot(t)));
      var vm = new THREE.Vector3(), v1 = new THREE.Vector3(), cr = new THREE.Vector3();
      for (var i = 0; i < 900; i++) {
        cr.crossVectors(v, t);
        vm.copy(v).add(cr);                // v⁻ = v + v×t
        cr.crossVectors(vm, t);
        v1.copy(vm).add(cr);               // v' = v⁻ + v⁻×t
        cr.crossVectors(v1, s);
        v.copy(vm).add(cr);                // v⁺ = v⁻ + v'×s
        p.addScaledVector(v, DT);
        pts.push(p.clone());
        vs.push(v.clone());
        if (p.length() > 4.6) break;
      }
      return { pts: pts, vs: vs };
    }
    REG['rule-lorentz'] = {
      layout: 'full', fit: 8,
      build: function (ctx) {
        var v = ctx.v = {};
        var G = ctx.add(new THREE.Group());
        v.sym = fieldSymbols(true, -3.2, 3.2, -2.4, 2.4, -1.1, 9, 7);
        G.add(v.sym);
        v.arrowB = U.arrow(V(2.9, 2.0, 0.9), V(0, 0, -1), 1.1, 0x66d9ff, 0.055);
        G.add(v.arrowB);
        v.lbB = U.label('B ⊗', { color: '#bfefff', worldH: 0.36 });
        v.lbB.position.set(2.9, 2.6, 0.9); G.add(v.lbB);

        v.trail = null;
        v.dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 20, 16),
          new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffb066, emissiveIntensity: 1.0, roughness: 0.2 })
        );
        v.glow = U.glow(0xffb066, 1.2, 0.85);
        G.add(v.dot, v.glow);
        v.arrowV = U.arrow(V(0, 0, 0), V(1, 0, 0), 1.1, 0xffe066, 0.05);
        v.arrowF = U.arrow(V(0, 0, 0), V(0, 1, 0), 1.0, 0xff9f43, 0.055);
        G.add(v.arrowV, v.arrowF);
        v.note = U.label('', { color: '#ffe0b0', worldH: 0.34 });
        v.note.position.set(0, -3.0, 0);
        G.add(v.note);
        v.t = 0;
      },
      onParams: function (ctx, p) {
        var v = ctx.v;
        var q = p.q === -1 ? -1 : 1;
        var ang = p.angle == null ? 90 : p.angle;
        if (v.q !== q || v.ang !== ang) {
          v.q = q; v.ang = ang; v.t = 0;
          var r = integrate(q, ang);
          v.pts = r.pts; v.vs = r.vs;
          if (v.trail) { ctx.root.remove(v.trail); v.trail.geometry.dispose(); }
          var col = q > 0 ? 0xffa94d : 0x74c0fc;
          var pos = new Float32Array(v.pts.length * 3);
          for (var i = 0; i < v.pts.length; i++) {
            pos[i * 3] = v.pts[i].x; pos[i * 3 + 1] = v.pts[i].y; pos[i * 3 + 2] = v.pts[i].z;
          }
          var geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
          v.trail = new THREE.Line(geo, new THREE.LineBasicMaterial({
            color: col, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false,
          }));
          ctx.root.add(v.trail);
          var dotCol = q > 0 ? 0xffb066 : 0x8ad4ff;
          v.dot.material.emissive.setHex(dotCol);
          v.glow.material.color.setHex(dotCol);
        }
        // 初始受力方向（学生要判断的）
        var v0 = v.vs[0].clone();
        var F0 = new THREE.Vector3().crossVectors(v0, V(0, 0, -BMAG)).multiplyScalar(q);
        v.answer = ang < 8 ? 'none' : (dirKey(F0) || 'none');
        v.arrowV.userData.setVec(v.pts[0].clone(), v0.clone().normalize(), 1.2);
        var note = ang < 8 ? 'v ∥ B ⇒ F = 0，粒子做匀速直线运动'
          : (ang > 82 ? 'v ⊥ B ⇒ 匀速圆周运动，半径 r = mv/(qB)' : 'v 与 B 斜交 ⇒ 螺旋线（分解：平行方向匀速 + 垂直方向圆周）');
        setLabel(v.note, note, '#ffe0b0');
        var show = p.reveal || !!p.choose;
        v.arrowF.visible = !!show;
        if (show) {
          var dir = (p.reveal && !p.choose) ? F0.clone().normalize() : v3(DIRS[p.choose] || DIRS.up).normalize();
          var ok = p.choose && p.choose === v.answer;
          var col = ok ? 0x4ce08a : (p.choose ? 0xff6b6b : 0xff9f43);
          v.arrowF.children.forEach(function (c) {
            if (c.material) { c.material.color.setHex(col); c.material.emissive.setHex(col); }
          });
          v.arrowF.userData.setVec(v.pts[0].clone(), dir, 1.1);
          if (p.choose) {
            A.notify({
              ev: 'answer', ok: !!ok, answer: v.answer,
              answerCn: v.answer === 'none' ? '不受力，不偏转' : DIR_CN[v.answer],
              chooseCn: DIR_CN[p.choose] || '',
            });
          }
        }
      },
      tick: function (ctx, dt) {
        var v = ctx.v;
        if (!v.pts) return;
        v.t += dt * 2.4;
        var n = v.pts.length;
        if (v.t > n - 2) v.t = 0;
        var i0 = Math.floor(v.t), f = v.t - i0;
        var p = v.pts[i0].clone().lerp(v.pts[Math.min(i0 + 1, n - 1)], f);
        v.dot.position.copy(p);
        v.glow.position.copy(p);
        var vel = v.vs[i0].clone();
        var F = new THREE.Vector3().crossVectors(vel, V(0, 0, -BMAG)).multiplyScalar(v.q);
        if (F.length() > 1e-6 && v.arrowF.visible) {
          v.arrowF.userData.setVec(p, F.clone().normalize(), 1.0);
        }
      },
    };
  })();

  /* =====================================================================
   * A3. 右手定则 · 导体切割磁感线（含楞次定律的“阻碍”）
   * =================================================================== */
  REG['rule-induction'] = {
    layout: 'full', fit: 8.4,
    build: function (ctx) {
      var v = ctx.v = {};
      var G = ctx.add(new THREE.Group());
      var railMat = new THREE.MeshStandardMaterial({ color: 0x93a7c8, roughness: 0.4, metalness: 0.6 });
      // U 形导轨：左竖 + 上下横
      var left = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.5, 0.18), railMat);
      left.position.set(-2.6, 0, 0); G.add(left);
      [-1.75, 1.75].forEach(function (y) {
        var r = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.13, 0.18), railMat);
        r.position.set(0, y, 0); G.add(r);
      });
      // 导体棒
      v.bar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.4, 16), metalMat(0xf0c46a));
      v.bar.position.set(0.4, 0, 0);
      G.add(v.bar);
      v.sym = fieldSymbols(true, -2.4, 2.4, -1.3, 1.3, -0.85, 7, 5);
      G.add(v.sym);
      v.arrowB = U.arrow(V(2.7, 1.6, 0.9), V(0, 0, -1), 1.1, 0x66d9ff, 0.055);
      G.add(v.arrowB);
      v.lbB = U.label('B ⊗', { color: '#bfefff', worldH: 0.34 });
      v.lbB.position.set(2.7, 2.3, 0.9); G.add(v.lbB);

      v.arrowV = U.arrow(V(0.4, 2.3, 0), V(1, 0, 0), 1.3, 0x8affc1, 0.05);
      v.arrowF = U.arrow(V(0.4, 0, 0), V(-1, 0, 0), 1.3, 0xff6b8a, 0.055);
      v.arrowF.visible = false;
      G.add(v.arrowV, v.arrowF);
      v.lbV = U.label('v', { color: '#c8ffe0', worldH: 0.36 });
      v.lbV.position.set(1.5, 2.3, 0); G.add(v.lbV);

      // 回路电流：一圈流动的发光小球
      v.flow = [];
      for (var i = 0; i < 22; i++) {
        var sp = U.glow(0xffe066, 0.34, 0.9);
        G.add(sp);
        v.flow.push(sp);
      }
      v.note = U.label('', { color: '#ffe0b0', worldH: 0.34 });
      v.note.position.set(0, -2.7, 0);
      G.add(v.note);
      v.u = 0;
    },
    onParams: function (ctx, p) {
      var v = ctx.v;
      var bIn = p.bIn !== false;
      var vRight = p.vRight !== false;
      G_replaceSymbol(v, bIn);
      v.arrowB.userData.setVec(V(2.7, 1.6, 0.9), bIn ? V(0, 0, -1) : V(0, 0, 1), 1.1);
      var vd = vRight ? V(1, 0, 0) : V(-1, 0, 0);
      v.arrowV.userData.setVec(V(0.4, 2.3, 0), vd, 1.3);
      v.lbV.position.set(vRight ? 1.6 : -1.6, 2.3, 0);

      // 棒中正电荷受力 F = qv × B ⇒ 感应电流沿棒的方向
      var Bv = bIn ? V(0, 0, -1) : V(0, 0, 1);
      var F = new THREE.Vector3().crossVectors(vd, Bv);
      var iUp = F.y > 0;
      // 回路方向（从 +z 看）：棒向上 → 上轨向左 → 左侧向下 → 下轨向右 = 逆时针
      v.loopCCW = iUp;
      v.answer = iUp ? 'ccw' : 'cw';
      v.dirSign = iUp ? 1 : -1;

      var show = !!p.reveal;
      v.arrowF.visible = show;
      if (show) {
        v.arrowF.userData.setVec(V(0.4, 0, 0), vd.clone().negate(), 1.3);
      }
      var txt = '右手定则：手心朝 B（' + (bIn ? '向里' : '向外') + '），大姆指指 v（' +
        (vRight ? '右' : '左') + '）⇒ 四指指向感应电流方向（沿棒' + (iUp ? '向上' : '向下') + '）';
      setLabel(v.note, txt, '#ffe0b0');
      if (p.choose) {
        var ok = p.choose === v.answer;
        A.notify({
          ev: 'answer', ok: ok, answer: v.answer,
          answerCn: v.answer === 'ccw' ? '逆时针' : '顺时针',
          chooseCn: p.choose === 'ccw' ? '逆时针' : '顺时针',
        });
      }
    },
    tick: function (ctx, dt) {
      var v = ctx.v;
      if (!v.flow) return;
      var s = v.dirSign || 1;
      v.u += dt * 0.42 * s;
      if (v.u > 1) v.u -= 1;
      if (v.u < 0) v.u += 1;
      // 回路路径（从棒的 x=0.4 出发）：棒向上 → 上轨向左 → 左侧向下 → 下轨向右 → 回棒
      var pts = [
        V(0.4, -1.75, 0), V(0.4, 1.75, 0), V(-2.6, 1.75, 0), V(-2.6, -1.75, 0),
      ];
      var segLen = [3.5, 3.0, 3.5, 3.0];
      var total = 13.0;
      var d = v.u * total, acc = 0, i;
      for (i = 0; i < 4; i++) {
        if (d <= acc + segLen[i]) {
          var f = (d - acc) / segLen[i];
          var a = pts[i], b = pts[(i + 1) % 4];
          var p = a.clone().lerp(b, f);
          var off = (i % 4) * 0;
          v.flow.forEach(function (sp, k) {
            var uu = v.u - k * 0.045;
            if (uu < 0) uu += 1;
            var dd = uu * total, ac = 0, j;
            for (j = 0; j < 4; j++) {
              if (dd <= ac + segLen[j]) {
                var ff = (dd - ac) / segLen[j];
                sp.position.copy(pts[j].clone().lerp(pts[(j + 1) % 4], ff));
                break;
              }
              ac += segLen[j];
            }
          });
          break;
        }
        acc += segLen[i];
      }
    },
  };

  /* =====================================================================
   * B. 电磁感应探究台（3D + 下方 Φ-t / I-t 曲线）
   * =================================================================== */
  REG['induction'] = {
    layout: 'split', fit: 7,
    build: function (ctx) {
      var v = ctx.v = {};
      var G = ctx.add(new THREE.Group());
      // 线圈
      var pts = [], n = 300, R = 1.35, LEN = 2.6, TURNS = 14;
      for (var i = 0; i <= n; i++) {
        var t = (i / n) * TURNS * Math.PI * 2;
        var x = -LEN / 2 + (i / n) * LEN;
        pts.push(V(x, R * Math.cos(t), R * Math.sin(t)));
      }
      v.coilPts = pts;
      var curve = new THREE.CatmullRomCurve3(pts);
      G.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 420, 0.055, 6, false), metalMat(0xf0c46a)));
      v.lbCoil = U.label('线圈 N 匝', { color: '#ffe9b0', worldH: 0.34 });
      v.lbCoil.position.set(0, R + 0.7, 0); G.add(v.lbCoil);

      // 磁铁
      v.magnet = new THREE.Group();
      var mn = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.62, 0.62),
        new THREE.MeshStandardMaterial({ color: 0xe8564b, emissive: 0x4a0f0a, emissiveIntensity: 0.45, roughness: 0.35 }));
      mn.position.x = 0.45;
      var ms = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.62, 0.62),
        new THREE.MeshStandardMaterial({ color: 0x4a7fe0, emissive: 0x08123a, emissiveIntensity: 0.45, roughness: 0.35 }));
      ms.position.x = -0.45;
      v.magnet.add(mn, ms);
      v.lbN = U.label('N', { color: '#ffd9d2', worldH: 0.34 });
      v.lbN.position.set(0.9, 0.55, 0);
      v.lbS = U.label('S', { color: '#d6ecff', worldH: 0.34 });
      v.lbS.position.set(-0.9, 0.55, 0);
      v.magnet.add(v.lbN, v.lbS);
      G.add(v.magnet);

      // 电流粒子
      v.flow = [];
      for (var k = 0; k < 16; k++) {
        var sp = U.glow(0xffe066, 0.3, 0.9);
        G.add(sp);
        v.flow.push(sp);
      }
      v.x = -4.2;
      v.flowU = 0;
      v.hist = [];
      v.lastNotify = 0;
      v.R = 1.35;
    },
    onParams: function (ctx, p) {
      var v = ctx.v;
      v.N = p.N || 200;
      v.Rt = p.R || 50;
      v.speed = p.speed == null ? 0 : p.speed;
      v.auto = p.auto || 'stop';
      v.flip = !!p.flip;
      v.magnet.rotation.y = v.flip ? Math.PI : 0;
      v.lbN.position.x = v.flip ? -0.9 : 0.9;
      v.lbS.position.x = v.flip ? 0.9 : -0.9;
      if (p.pos != null) { v.x = p.pos; v.speed = 0; }
      setLabel(v.lbCoil, '线圈 ' + v.N + ' 匝', '#ffe9b0');
    },
    tick: function (ctx, dt, clock) {
      var v = ctx.v;
      if (!v.N) v.N = 200;
      var prevX = v.x;
      if (v.auto === 'in') { v.x += dt * 1.5; if (v.x > 4.6) v.auto = 'out'; }
      else if (v.auto === 'out') { v.x -= dt * 1.5; if (v.x < -4.6) v.auto = 'in'; }
      else if (v.speed) v.x += dt * v.speed;
      if (v.x > 4.6) { v.x = 4.6; }
      if (v.x < -4.6) { v.x = -4.6; }
      v.magnet.position.x = v.x;

      // Φ(x)：磁偶极子穿过线圈的磁通（远场近似），中心处归一化为 1
      var RR = v.R * v.R;
      var phi = Math.pow(RR / (RR + v.x * v.x), 1.5);
      if (v.flip) phi = -phi;
      var dx = v.x - prevX;
      var dphi = (phi - (v.prevPhi == null ? phi : v.prevPhi));
      v.prevPhi = phi;
      var emf = -v.N * dphi / Math.max(dt, 1e-4);   // ε = -N dΦ/dt
      var I = emf / v.Rt;
      v.phi = phi; v.I = I;
      v.hist.push({ t: clock, phi: phi, I: I });
      if (v.hist.length > 400) v.hist.shift();

      // 电流粒子沿线圈流动
      v.flowU += dt * I * 0.08;
      if (v.flowU > 1) v.flowU -= 1;
      if (v.flowU < 0) v.flowU += 1;
      var n = v.coilPts.length;
      v.flow.forEach(function (sp, i) {
        var u = v.flowU + i / v.flow.length;
        u = u - Math.floor(u);
        var idx = Math.min(n - 1, Math.floor(u * (n - 1)));
        sp.position.copy(v.coilPts[idx]);
        var mag = Math.min(Math.abs(I) / 6, 1);
        sp.material.opacity = 0.15 + 0.85 * mag;
        sp.material.color.setHex(I >= 0 ? 0xffe066 : 0x8ad4ff);
      });

      if (clock - v.lastNotify > 0.12) {
        v.lastNotify = clock;
        A.notify({ ev: 'induction', x: +v.x.toFixed(3), phi: +phi.toFixed(4), I: +I.toFixed(3), emf: +emf.toFixed(2) });
      }
    },
    draw2d: function (c, W, H, ctx) {
      var v = ctx.v;
      drawChartBg(c, W, H);
      T(c, '磁通量 Φ 与感应电流 I', 12, 16, '#eaf2ff', 13, 'left');
      T(c, 'Φ（蓝）', 12, 34, '#66d9ff', 11, 'left');
      T(c, 'I（橙）', 74, 34, '#ffb648', 11, 'left');
      T(c, (v.phi == null ? 'Φ = —' : 'Φ = ' + v.phi.toFixed(3)) +
        '   ' + (v.I == null ? '' : 'I = ' + v.I.toFixed(2) + '（' + (Math.abs(v.I) < 1e-3 ? '磁铁静止，无电流' : v.I > 0 ? '正向' : '反向') + '）'),
        W - 12, 34, '#c9d8f0', 11, 'right');

      var x0 = 34, x1 = W - 12, y0 = 52, y1 = H - 16;
      var mid = (y0 + y1) / 2;
      // 坐标轴
      c.strokeStyle = '#22304e'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x0, mid); c.lineTo(x1, mid); c.stroke();
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0, y1); c.stroke();
      var amp = (y1 - y0) / 2 - 4;
      var n = v.hist.length;
      if (n > 1) {
        var step = Math.max(1, Math.floor(n / (x1 - x0)));
        var i, first = true;
        c.strokeStyle = '#66d9ff'; c.lineWidth = 2;
        c.beginPath();
        for (i = 0; i < n; i += step) {
          var xx = x0 + (i / (n - 1)) * (x1 - x0);
          var yy = mid - v.hist[i].phi * amp * 0.8;
          if (first) { c.moveTo(xx, yy); first = false; } else c.lineTo(xx, yy);
        }
        c.stroke();
        first = true;
        c.strokeStyle = '#ffb648'; c.lineWidth = 2;
        c.beginPath();
        for (i = 0; i < n; i += step) {
          var x2 = x0 + (i / (n - 1)) * (x1 - x0);
          var y2 = mid - Math.max(-1.6, Math.min(1.6, v.hist[i].I / 8)) * amp * 0.8;
          if (first) { c.moveTo(x2, y2); first = false; } else c.lineTo(x2, y2);
        }
        c.stroke();
      }
      // 磁铁位置条
      var px = x0 + ((v.x + 4.6) / 9.2) * (x1 - x0);
      c.fillStyle = '#e8564b';
      c.fillRect(px - 7, y0 - 12, 7, 9);
      c.fillStyle = '#4a7fe0';
      c.fillRect(px, y0 - 12, 7, 9);
      T(c, '磁铁', px, H - 8, '#8fa3c4', 10, 'center');
    },
  };

  /* =====================================================================
   * C. 交流电波形实验室（2D）
   * =================================================================== */
  var C = {
    bg0: '#0b1226', bg1: '#070c1a', grid: '#1b2745', ink: '#eaf2ff',
    sub: '#8fa3c4', amber: '#ffb648', cyan: '#66d9ff', green: '#3ef2a0', red: '#ff6b6b', violet: '#a78bfa',
  };

  function drawChartBg(c, W, H) {
    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, C.bg0);
    g.addColorStop(1, C.bg1);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }
  function T(c, s, x, y, col, size, align) {
    c.fillStyle = col || C.ink;
    c.font = (size || 13) + 'px -apple-system, "PingFang SC", sans-serif';
    c.textAlign = align || 'left';
    c.textBaseline = 'middle';
    c.fillText(s, x, y);
  }
  function box(c, x, y, w, h, fill, stroke) {
    c.beginPath();
    var r = Math.min(10, h / 2);
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
  }
  function gridLines(c, x0, x1, y0, y1, nx, ny) {
    c.strokeStyle = C.grid; c.lineWidth = 1;
    var i;
    for (i = 0; i <= nx; i++) {
      var x = x0 + (x1 - x0) * i / nx;
      c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.stroke();
    }
    for (i = 0; i <= ny; i++) {
      var y = y0 + (y1 - y0) * i / ny;
      c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
    }
  }

  /* ---------------- C1. 波形与相量同步 ---------------- */
  REG['ac-phasor'] = {
    layout: 'panel',
    build: function (ctx) { ctx.v = { t: 0 }; },
    tick: function (ctx, dt) {
      if (ctx.params && ctx.params.paused) return;
      ctx.v.t += dt * (ctx.params && ctx.params.freq ? ctx.params.freq : 1) * 1.1;
    },
    draw2d: function (c, W, H, ctx) {
      var p = ctx.params || {};
      drawChartBg(c, W, H);
      var A1 = Math.min(H * 0.3, W * 0.26);
      var cx = 24 + A1, cy = H * 0.44;
      var wx0 = cx + A1 + 26, wx1 = W - 14;
      var midY = cy, amp = A1 * 0.78;

      T(c, '旋转矢量转一圈 = 波形走一个周期', 14, 16, C.ink, 13.5, 'left');

      // 相量圆
      c.strokeStyle = C.grid; c.lineWidth = 1;
      c.beginPath(); c.arc(cx, cy, A1, 0, 6.284); c.stroke();
      c.beginPath(); c.moveTo(cx - A1 - 8, cy); c.lineTo(cx + A1 + 8, cy); c.stroke();
      c.beginPath(); c.moveTo(cx, cy - A1 - 8); c.lineTo(cx, cy + A1 + 8); c.stroke();

      var th = ctx.v.t % 6.2831853;
      var ex = cx + A1 * Math.cos(th), ey = cy - A1 * Math.sin(th);
      // 矢量
      c.strokeStyle = C.amber; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(ex, ey); c.stroke();
      c.fillStyle = C.amber;
      c.beginPath(); c.arc(ex, ey, 5, 0, 6.284); c.fill();
      // 投影
      c.strokeStyle = 'rgba(255,182,72,0.45)';
      c.setLineDash([4, 4]); c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(ex, ey); c.lineTo(wx0, ey); c.stroke();
      c.setLineDash([]);
      T(c, 'ωt = ' + (th * 57.3).toFixed(0) + '°', cx, cy + A1 + 18, C.sub, 11, 'center');

      // 波形区
      var cycles = 2, period = (wx1 - wx0) / cycles;
      gridLines(c, wx0, wx1, cy - amp - 10, cy + amp + 10, cycles * 4, 4);
      c.strokeStyle = '#2c3c63'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(wx0, midY); c.lineTo(wx1, midY); c.stroke();

      // 完整正弦（暗）
      c.strokeStyle = 'rgba(102,217,255,0.28)'; c.lineWidth = 2;
      c.beginPath();
      for (var i = 0; i <= 200; i++) {
        var a = (i / 200) * cycles * 6.2831853;
        var x = wx0 + (i / 200) * (wx1 - wx0);
        var y = midY - Math.sin(a) * amp;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
      // 已扫过部分（亮）
      var frac = (th / 6.2831853) / cycles;
      c.strokeStyle = C.cyan; c.lineWidth = 2.6;
      c.beginPath();
      for (var j = 0; j <= 200; j++) {
        var a2 = (j / 200) * cycles * 6.2831853;
        if (a2 > th + (ctx.v.t - th) * 0 + 1e-9) { if (a2 > th) break; }
        var x2 = wx0 + (a2 / (cycles * 6.2831853)) * (wx1 - wx0);
        var y2 = midY - Math.sin(a2) * amp;
        if (j === 0) c.moveTo(x2, y2); else c.lineTo(x2, y2);
      }
      c.stroke();
      // 当前点
      var px = wx0 + (th / (cycles * 6.2831853)) * (wx1 - wx0);
      var py = midY - Math.sin(th) * amp;
      c.fillStyle = C.amber;
      c.beginPath(); c.arc(px, py, 5.5, 0, 6.284); c.fill();
      c.strokeStyle = 'rgba(255,182,72,0.35)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(px, midY); c.lineTo(px, py); c.stroke();

      // 峰值 / 有效值标注
      if (p.showRms !== false) {
        var rms = amp / Math.SQRT2;
        c.strokeStyle = 'rgba(62,242,160,0.75)';
        c.setLineDash([6, 4]); c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(wx0, midY - amp); c.lineTo(wx1, midY - amp); c.stroke();
        c.beginPath(); c.moveTo(wx0, midY - rms); c.lineTo(wx1, midY - rms); c.stroke();
        c.setLineDash([]);
        T(c, '峰值 Uₘ', wx1 - 4, midY - amp - 10, C.sub, 10.5, 'right');
        T(c, '有效值 Uₘ/√2 = ' + (0.707).toFixed(2) + 'Uₘ', wx1 - 4, midY - rms - 10, C.green, 10.5, 'right');
      }
      T(c, 'u = Uₘ sin ωt', wx0 + 4, H - 14, C.sub, 11, 'left');
      T(c, '瞬时值 ' + (Math.sin(th)).toFixed(2) + ' Uₘ', W - 14, H - 14, C.amber, 11, 'right');
    },
  };

  /* ---------------- C2. 有效值探究 ---------------- */
  REG['ac-rms'] = {
    layout: 'panel',
    build: function (ctx) { ctx.v = { qAc: 0, qDc: 0, t: 0 }; },
    onParams: function (ctx, p) {
      if (p.reset) { ctx.v.qAc = 0; ctx.v.qDc = 0; ctx.v.t = 0; }
    },
    tick: function (ctx, dt) {
      var p = ctx.params || {};
      var v = ctx.v;
      if (p.paused) return;
      v.t += dt * 1.2;
      var A1 = 1;
      var u = waveValue(p.wave || 'sine', v.t) * A1;
      var rms = rmsValue(p.wave || 'sine');
      v.qAc += u * u * dt * 3;
      v.qDc += rms * rms * dt * 3;
      if (v.qAc > 40) { v.qAc = 40; v.qDc = 40; }
    },
    draw2d: function (c, W, H, ctx) {
      var p = ctx.params || {};
      var wave = p.wave || 'sine';
      var v = ctx.v;
      drawChartBg(c, W, H);
      T(c, '有效值 = 相同电阻、相同时间，产生相同热量的直流值', 14, 16, C.ink, 13, 'left');
      var rms = rmsValue(wave);
      T(c, '波形：' + ({ sine: '正弦', square: '方波', half: '半波整流' }[wave]) +
        '   有效值 U = ' + rms.toFixed(3) + ' Uₘ', 14, 34, C.amber, 12, 'left');

      // 波形区
      var x0 = 30, x1 = W - 14, yTop = 52, yBot = H * 0.52;
      var midY = (yTop + yBot) / 2, amp = (yBot - yTop) / 2 - 8;
      gridLines(c, x0, x1, yTop, yBot, 8, 4);
      c.strokeStyle = '#2c3c63';
      c.beginPath(); c.moveTo(x0, midY); c.lineTo(x1, midY); c.stroke();
      var cycles = 2;
      c.strokeStyle = C.cyan; c.lineWidth = 2.4;
      c.beginPath();
      for (var i = 0; i <= 300; i++) {
        var a = (i / 300) * cycles * 6.2831853;
        var x = x0 + (i / 300) * (x1 - x0);
        var y = midY - waveValue(wave, a) * amp;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
      // 有效值线
      c.strokeStyle = C.green; c.setLineDash([6, 4]); c.lineWidth = 1.6;
      var yR = midY - rms * amp;
      c.beginPath(); c.moveTo(x0, yR); c.lineTo(x1, yR); c.stroke();
      c.setLineDash([]);
      T(c, 'Ueff = ' + rms.toFixed(3) + 'Uₘ', x1 - 6, yR - 11, C.green, 11, 'right');
      // 当前瞬时值
      var cur = waveValue(wave, v.t);
      var cx = x0 + ((v.t % (cycles * 6.2831853)) / (cycles * 6.2831853)) * (x1 - x0);
      var cy = midY - cur * amp;
      c.fillStyle = C.amber;
      c.beginPath(); c.arc(cx, cy, 5, 0, 6.284); c.fill();
      T(c, '瞬时 ' + cur.toFixed(2), cx, cy - 14, C.amber, 10.5, 'center');

      // 两个电阻发热对比
      var by = yBot + 18, bh = H - by - 14;
      var bw = (W - 44) / 2;
      drawResistorHeat(c, 14, by, bw, bh, '交流 u(t) 接 R', v.qAc, C.cyan);
      drawResistorHeat(c, 14 + bw + 16, by, bw, bh, '直流 U = Ueff 接 R', v.qDc, C.amber);
      var diff = Math.abs(v.qAc - v.qDc) / Math.max(v.qAc, 1e-6);
      T(c, '两者热量' + (diff < 0.02 ? '始终相等 → 这就是有效值的定义' : '正在累积对比中…'),
        W / 2, H - 8, diff < 0.02 ? C.green : C.sub, 11, 'center');
    },
  };

  function waveValue(wave, t) {
    var s = Math.sin(t);
    if (wave === 'square') return s >= 0 ? 1 : -1;
    if (wave === 'half') return s > 0 ? s : 0;
    return s;
  }
  function rmsValue(wave) {
    if (wave === 'square') return 1;
    if (wave === 'half') return 0.5;
    return 1 / Math.SQRT2;
  }
  function drawResistorHeat(c, x, y, w, h, title, q, col) {
    box(c, x, y, w, h, 'rgba(255,255,255,0.04)', '#1e2c4d');
    T(c, title, x + 10, y + 14, C.sub, 11, 'left');
    var barW = w - 20, barH = 16, by = y + h - 26;
    var frac = Math.min(q / 40, 1);
    box(c, x + 10, by, barW, barH, 'rgba(255,255,255,0.07)');
    var g = c.createLinearGradient(x + 10, 0, x + 10 + barW * frac, 0);
    g.addColorStop(0, col);
    g.addColorStop(1, '#ff8a4c');
    c.fillStyle = g;
    box(c, x + 10, by, Math.max(2, barW * frac), barH, g);
    T(c, '热量 ' + q.toFixed(2), x + 10, y + h - 38, col, 11, 'left');
    // 电阻符号
    var rx = x + 10, ry = y + 32;
    c.strokeStyle = C.sub; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(rx, ry); c.lineTo(rx + 14, ry); c.stroke();
    c.strokeRect(rx + 14, ry - 7, 26, 14);
    c.beginPath(); c.moveTo(rx + 40, ry); c.lineTo(rx + 54, ry); c.stroke();
  }

  /* ---------------- C3. 变压器 ---------------- */
  REG['ac-transformer'] = {
    layout: 'panel',
    build: function (ctx) { ctx.v = { u: 0 }; },
    tick: function (ctx, dt) { ctx.v.u += dt * 0.55; },
    draw2d: function (c, W, H, ctx) {
      var p = ctx.params || {};
      var U1 = p.U1 || 220, N1 = p.N1 || 1000, N2 = p.N2 || 500, R = p.R || 44;
      var U2 = U1 * N2 / N1;
      var I2 = U2 / R;
      var P2 = U2 * I2;
      var I1 = U2 === 0 ? 0 : P2 / U1;
      drawChartBg(c, W, H);
      T(c, '理想变压器：U₁/U₂ = N₁/N₂，P 不变', 14, 16, C.ink, 13, 'left');
      T(c, '频率 f 不变 · 功率 P 不变（理想）· 电压随匝数变 · 电流随负载变', 14, 34, C.sub, 11, 'left');

      var cy = H * 0.36;
      var xL = W * 0.2, xR = W * 0.8;
      // 铁芯
      c.strokeStyle = '#43587f'; c.lineWidth = 5;
      c.strokeRect(xL - 26, cy - 46, (xR - xL) + 52, 92);
      T(c, '铁芯', (xL + xR) / 2, cy + 62, C.sub, 11, 'center');
      // 原线圈
      drawCoil(c, xL, cy, N1 / 1000, C.cyan, ctx.v.u, Math.min(I1 / 5, 1));
      T(c, '原线圈 N₁ = ' + N1, xL, cy - 62, C.cyan, 11.5, 'center');
      T(c, 'U₁ = ' + U1.toFixed(0) + ' V', xL, cy + 78, C.ink, 12, 'center');
      T(c, 'I₁ = ' + I1.toFixed(2) + ' A', xL, cy + 96, C.sub, 11.5, 'center');
      // 副线圈
      drawCoil(c, xR, cy, N2 / 1000, C.amber, ctx.v.u, Math.min(I2 / 5, 1));
      T(c, '副线圈 N₂ = ' + N2, xR, cy - 62, C.amber, 11.5, 'center');
      T(c, 'U₂ = ' + U2.toFixed(1) + ' V', xR, cy + 78, C.ink, 12, 'center');
      T(c, 'I₂ = ' + I2.toFixed(2) + ' A', xR, cy + 96, C.sub, 11.5, 'center');
      // 负载
      var ly = cy + 118;
      c.strokeStyle = C.sub; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(xR, ly - 10); c.lineTo(xR, ly); c.stroke();
      c.strokeRect(xR - 16, ly, 32, 16);
      c.beginPath(); c.moveTo(xR, ly + 16); c.lineTo(xR, ly + 26); c.stroke();
      T(c, 'R = ' + R + ' Ω', xR + 24, ly + 8, C.sub, 11, 'left');
      T(c, 'P₂ = U₂²/R = ' + P2.toFixed(1) + ' W', xR, ly + 40, C.green, 11.5, 'center');

      // 结论条
      var by = H - 34;
      box(c, 14, by, W - 28, 26, 'rgba(255,255,255,0.05)', '#22304e');
      T(c, '匝数比 ' + (N2 / N1).toFixed(2) + '：U 变了 ' + (N2 / N1).toFixed(2) +
        ' 倍，I 变了 ' + (N1 / N2).toFixed(2) + ' 倍，功率仍是 ' + P2.toFixed(1) + ' W',
        W / 2, by + 13, C.amber, 11.5, 'center');
    },
  };

  function drawCoil(c, x, y, scale, col, u, flow) {
    var turns = Math.max(3, Math.round(4 + scale * 4));
    c.strokeStyle = col; c.lineWidth = 2.2;
    c.beginPath();
    for (var i = 0; i <= turns * 12; i++) {
      var t = i / 12;
      var px = x + 20;
      var py = y - 34 + (t / turns) * 68;
      var r = 9;
      var ang = t * 6.2831853;
      var xx = px + Math.cos(ang) * r * 0.6;
      var yy = py + Math.sin(ang) * r * 0.3;
      if (i === 0) c.moveTo(xx, yy); else c.lineTo(xx, yy);
    }
    c.stroke();
    // 电流流动点
    if (flow > 0.02) {
      var f = (u * flow * 3) % 1;
      c.fillStyle = col;
      for (var k = 0; k < 4; k++) {
        var ff = (f + k / 4) % 1;
        var py2 = y - 34 + ff * 68;
        c.beginPath();
        c.arc(x + 20, py2, 3.2, 0, 6.284);
        c.fill();
      }
    }
  }

  /* ---------------- C4. 远距离输电损耗链 ---------------- */
  REG['ac-transmit'] = {
    layout: 'panel',
    build: function (ctx) { ctx.v = { u: 0 }; },
    tick: function (ctx, dt) { ctx.v.u += dt * 0.8; },
    draw2d: function (c, W, H, ctx) {
      var p = ctx.params || {};
      var hv = !!p.hv;
      var P = p.P || 100;        // 输送功率 kW
      var r = p.r || 5;          // 线路电阻 Ω
      var U = hv ? (p.Uhv || 20) : (p.Ulv || 2);  // 输电电压 kV
      var I = P * 1000 / (U * 1000);              // A
      var loss = I * I * r / 1000;                // kW
      var lossPct = Math.min(loss / P * 100, 100);
      var Udrop = I * r / 1000;                   // kV
      var Uuser = Math.max(U - Udrop, 0);

      drawChartBg(c, W, H);
      T(c, hv ? '高压输电' : '低压输电', 14, 16, hv ? C.green : C.red, 14, 'left');
      T(c, '输送功率 P = ' + P + ' kW，线路电阻 r = ' + r + ' Ω', 14, 34, C.sub, 11.5, 'left');

      var nodes = [
        { name: '发电机', v: (p.Ugen || 1) + ' kV', i: I.toFixed(1) + ' A', col: C.cyan },
        { name: '升压变压器', v: U + ' kV', i: I.toFixed(1) + ' A', col: C.violet },
        { name: '输电线', v: '−' + Udrop.toFixed(2) + ' kV', i: I.toFixed(1) + ' A', col: C.amber },
        { name: '降压变压器', v: Uuser.toFixed(2) + ' kV', i: I.toFixed(1) + ' A', col: C.violet },
        { name: '用户', v: '0.22 kV', i: (P * 1000 / 220).toFixed(0) + ' A', col: C.green },
      ];
      var n = nodes.length;
      var gap = (W - 40) / n;
      var bw = Math.min(gap - 10, 84);
      var by = H * 0.2;
      for (var i = 0; i < n; i++) {
        var x = 22 + i * gap + (gap - bw) / 2;
        box(c, x, by, bw, 46, 'rgba(255,255,255,0.05)', nodes[i].col);
        T(c, nodes[i].name, x + bw / 2, by + 13, C.ink, 10.5, 'center');
        T(c, nodes[i].v, x + bw / 2, by + 28, nodes[i].col, 11.5, 'center');
        T(c, nodes[i].i, x + bw / 2, by + 40, C.sub, 10, 'center');
        if (i < n - 1) {
          c.strokeStyle = '#2c3c63'; c.lineWidth = 2;
          c.beginPath(); c.moveTo(x + bw, by + 23); c.lineTo(x + gap - (gap - bw) / 2, by + 23); c.stroke();
          // 电流流动点
          var f = (ctx.v.u * Math.min(I / 60, 1.4)) % 1;
          c.fillStyle = C.amber;
          c.beginPath();
          c.arc(x + bw + (gap - bw) * ((f + i * 0.2) % 1), by + 23, 3, 0, 6.284);
          c.fill();
        }
      }

      // 损耗条
      var ly = by + 66;
      T(c, '线路损耗 P损 = I²r', 22, ly, C.sub, 11.5, 'left');
      var barW = W - 44, barH = 20;
      box(c, 22, ly + 12, barW, barH, 'rgba(255,255,255,0.07)');
      var frac = Math.min(lossPct / 100, 1);
      var g = c.createLinearGradient(22, 0, 22 + barW, 0);
      g.addColorStop(0, C.green);
      g.addColorStop(0.5, C.amber);
      g.addColorStop(1, C.red);
      c.fillStyle = g;
      box(c, 22, ly + 12, Math.max(3, barW * frac), barH, g);
      T(c, loss.toFixed(1) + ' kW（' + lossPct.toFixed(1) + '%）', 22 + 8, ly + 22, '#0b1226', 11.5, 'left');
      T(c, '用户得到 ' + Math.max(P - loss, 0).toFixed(1) + ' kW', W - 22, ly + 22, C.ink, 11.5, 'right');

      var ty = ly + 48;
      box(c, 14, ty, W - 28, 40, 'rgba(255,255,255,0.05)', '#22304e');
      var msg = hv
        ? '电压提高 ' + ((p.Uhv || 20) / (p.Ulv || 2)).toFixed(0) + ' 倍 ⇒ 电流降为 1/' +
          ((p.Uhv || 20) / (p.Ulv || 2)).toFixed(0) + ' ⇒ 损耗降为 1/' +
          Math.pow((p.Uhv || 20) / (p.Ulv || 2), 2).toFixed(0)
        : '电压低 ⇒ 电流大 ⇒ P损 = I²r 惊人，这就是为什么必须高压输电';
      T(c, msg, W / 2, ty + 14, hv ? C.green : C.red, 11.5, 'center');
      T(c, '同一条线，同一批用户：变的只有输电电压 U，I 与 P损 都跟着它变', W / 2, ty + 30, C.sub, 10.5, 'center');
    },
  };

  /* ---------------- C5. 能量流：电场把能量从电源搬到负载（电 / 能 / 场） ---------------- */
  /* ac-energy 专用：把行波的瞬时值刷到波形带 / 矢量箭头 / 涡旋环上 */
  function updWave(w, fn, NS, HALF) {
    var pa = w.geo.attributes.position.array, cb = w.geo.attributes.color.array;
    for (var k = 0; k < NS; k++) {
      var sw = k / (NS - 1);
      var val = fn(sw);
      var o = k * 6;
      var x = -HALF + sw * (HALF * 2);
      var y = w.yBase + w.amp * val;
      pa[o] = x; pa[o + 1] = y - w.halfW; pa[o + 2] = 0;
      pa[o + 3] = x; pa[o + 4] = y + w.halfW; pa[o + 5] = 0;
      var mag = Math.min(1, Math.abs(val) + 0.18);
      var col = val >= 0 ? w.posCol : w.negCol;
      cb[o] = mag * col[0]; cb[o + 1] = mag * col[1]; cb[o + 2] = mag * col[2];
      cb[o + 3] = mag * col[0]; cb[o + 4] = mag * col[1]; cb[o + 5] = mag * col[2];
    }
    w.geo.attributes.position.needsUpdate = true;
    w.geo.attributes.color.needsUpdate = true;
  }

  // 箭头默认沿 +Y：axis='y' 表示 ±Y（电场），axis='z' 表示 ±Z（磁场）
  function setArrow3(g, x, val, baseLen, axis) {
    var mag = Math.abs(val);
    if (mag < 0.05) { g.visible = false; return; }
    g.visible = true;
    g.position.set(x, 0, 0);
    g.scale.set(1, baseLen * mag, 1);
    if (axis === 'z') g.rotation.set(val >= 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0);
    else g.rotation.set(0, 0, val >= 0 ? 0 : Math.PI);
    g.userData.mat.opacity = 0.42 + 0.55 * Math.min(1, mag);
  }

  // rate ∝ ∂(场)/∂t：环的大小随之变化，符号决定旋向（每半周翻转一次）
  function setVortex2(g, rate) {
    var mag = Math.abs(rate);
    if (mag < 0.08) { g.visible = false; return; }
    g.visible = true;
    var s = 0.55 + 0.6 * mag;
    g.scale.set(s, s, s);
    g.userData.inner.scale.y = rate >= 0 ? 1 : -1;
    g.userData.mat.opacity = 0.24 + 0.66 * mag;
  }

  REG['ac-energy'] = {
    layout: 'split', fit: 10.4, cam: { theta: 0.44, phi: 1.24 },
    build: function (ctx) {
      var HALF = 3.9, YW = 0.86, NS = 88;
      var v = ctx.v = {
        t: 0, hist: [], lastNotify: 0, bulbLevel: 0,
        Um: 1, R: 10, freq: 1, paused: false,
        showQ: true, showE: true, showB: true,
        uSrc: 0, uLoad: 0, iLoad: 0, pLoad: 0, Pavg: 0,
        HALF: HALF, YW: YW, NS: NS,
        stretch: true,
        // 波长到底多长？真实 50 Hz 的行波 λ = c/f ≈ 6000 km（≈ 北京到新加坡），
        // 家里几米的线路只占它的百万分之一，所以实际整段几乎同相位、根本看不出推进。
        // 「夸张」档把空间轴压缩约 10⁶ 倍（整段 ≈ 0.6 λ），才看得见一节一节往前推；
        // 「接近真实」档把比例还原，你会看到整条线几乎同时变色 —— 那才是家里的样子。
        loops: 0.6,        // 夸张可视化
        loopsReal: 0.02,   // 接近真实（几米 vs 6000 km）
        NA: 9, NV: 7,
      };
      var G = ctx.add(new THREE.Group());

      // 两根导线（上=火线，下=零线）
      var wireMat = metalMat(0xd9a05b);
      [YW, -YW].forEach(function (y) {
        var w = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, HALF * 2, 10), wireMat);
        w.rotation.z = Math.PI / 2;
        w.position.y = y;
        G.add(w);
      });

      // 左：交流电源
      var src = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 2.0, 0.9),
        new THREE.MeshStandardMaterial({ color: 0x2a4a86, emissive: 0x0b1f4a, emissiveIntensity: 0.5, roughness: 0.4 })
      );
      src.position.set(-HALF - 0.45, 0, 0);
      G.add(src);
      v.lbSrc = U.label('~ 交流电源', { color: '#bcd8ff', worldH: 0.3 });
      v.lbSrc.position.set(-HALF - 0.45, 1.12, 0);
      G.add(v.lbSrc);
      // 电源到导线的连接竖线
      var link = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, YW * 2, 8), wireMat);
      link.position.set(-HALF, 0, 0);
      G.add(link);

      // 右：灯泡（负载）
      v.bulbMat = new THREE.MeshStandardMaterial({
        color: 0xfff3c4, emissive: 0xffc233, emissiveIntensity: 0.4,
        roughness: 0.25, transparent: true, opacity: 0.92,
      });
      var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), v.bulbMat);
      bulb.position.set(HALF + 0.95, 0, 0);
      G.add(bulb);
      v.bulbGlow = U.glow(0xffd45e, 1.9, 0.5);
      v.bulbGlow.position.copy(bulb.position);
      G.add(v.bulbGlow);
      v.lbBulb = U.label('灯泡（负载 R）', { color: '#ffe9b0', worldH: 0.3 });
      v.lbBulb.position.set(HALF + 0.95, 1.0, 0);
      G.add(v.lbBulb);
      var link2 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, YW * 2, 8), wireMat);
      link2.position.set(HALF, 0, 0);
      G.add(link2);

      /* ------------------------------------------------------------------
         电场的真身是一条「行波」：E(x,t) = Um · sin(2π·x/λ − ωt)
         同一瞬间沿线路各处大小方向都不一样，波峰一路向灯泡推过去。
         下面三层都是同一个波的不同画法：来源（电荷团）、强度（竖短线）、波形（波带）。
      ------------------------------------------------------------------ */

      // ① 导线表面的电荷密度波：+（橙）/ −（青）的电荷团沿导线推进，它就是电场的源头
      var rhoN = NS;
      var rhoPos = new Float32Array(rhoN * 3), rhoCol = new Float32Array(rhoN * 3);
      for (var qi = 0; qi < rhoN; qi++) {
        rhoPos[qi * 3] = -HALF + (Math.floor(qi / 2) / (rhoN / 2 - 1)) * (HALF * 2);
        rhoPos[qi * 3 + 1] = (qi % 2 === 0) ? YW : -YW;
        rhoPos[qi * 3 + 2] = 0;
      }
      var rhoGeo = new THREE.BufferGeometry();
      rhoGeo.setAttribute('position', new THREE.BufferAttribute(rhoPos, 3));
      rhoGeo.setAttribute('color', new THREE.BufferAttribute(rhoCol, 3));
      v.rhoGeo = rhoGeo;
      v.rho = new THREE.Points(rhoGeo, new THREE.PointsMaterial({
        size: 0.2, vertexColors: true, transparent: true, opacity: 0.95,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
      }));
      G.add(v.rho);

      /* ------------------------------------------------------------------
         同一条行波：E_y(x,t) = Eₘ·sin(kx − ωt)，B_z 与它严格同相，传播沿 +x，
         所以 E ⟂ B ⟂ 传播方向（TEM）。下面用三种画法把它摊开给你看：
         矢量阵列（E/B 正交）、涡旋环（谁生了谁）、波形带（波的形状）。
      ------------------------------------------------------------------ */

      // 小零件：矢量箭头（默认沿 +Y，用 rotation 转到目标方向）
      var mkArrow = function (color) {
        var g = new THREE.Group();
        var m = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9, depthWrite: false });
        var body = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 1, 8), m);
        body.position.y = 0.5;
        var tip = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.2, 10), m);
        tip.position.y = 1;
        g.add(body, tip);
        g.userData.mat = m;
        return g;
      };
      // 小零件：带箭头的一段圆弧 —— 表示「涡旋」的方向与强弱（旋向量由 inner 镜像翻转）
      var mkVortex = function (color, axis) {
        var wrap = new THREE.Group(), inner = new THREE.Group();
        var m = new THREE.MeshBasicMaterial({
          color: color, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        var R = 0.27, th = Math.PI * 1.4;
        inner.add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.013, 6, 22, th), m));
        var tip = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.14, 8), m);
        tip.position.set(Math.cos(th) * R, Math.sin(th) * R, 0);
        tip.rotation.z = th;                       // 圆锥默认 +Y → 转到圆弧切向
        inner.add(tip);
        wrap.add(inner);
        if (axis === 'y') wrap.rotation.x = Math.PI / 2;   // 环平面 xy → xz（绕 y 轴的涡旋）
        wrap.userData.mat = m; wrap.userData.inner = inner;
        return wrap;
      };
      // ① 导线表面的电荷密度波：± 电荷团的疏密沿导线推进，它就是电场的源头

      // ② 波形带：把 E(x,t) / B(x,t) 直接画成随时间向 +x 推移的正弦波（两条同相推进）
      var mkWave = function (yBase, amp, halfW, posCol, negCol) {
        var pos = new Float32Array(NS * 6), col = new Float32Array(NS * 6), idx = [];
        for (var k = 0; k < NS - 1; k++) {
          var a = k * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
        var g2 = new THREE.BufferGeometry();
        g2.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g2.setAttribute('color', new THREE.BufferAttribute(col, 3));
        g2.setIndex(idx);
        var m2 = new THREE.MeshBasicMaterial({
          vertexColors: true, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        var mesh = new THREE.Mesh(g2, m2);
        G.add(mesh);
        return { mesh: mesh, geo: g2, yBase: yBase, amp: amp, halfW: halfW, posCol: posCol, negCol: negCol };
      };
      v.waveE = mkWave(0.52, 0.22, 0.034, [1, 0.68, 0.22], [0.3, 0.78, 1]);     // E(x,t)
      v.waveB = mkWave(-0.52, 0.22, 0.034, [0.32, 0.82, 1], [0.66, 0.5, 1]);    // B(x,t)

      // ③ E / B 矢量阵列：同一位置，E 沿 ±y、B 沿 ±z，传播沿 +x —— 三者两两垂直
      v.eArrows = []; v.bArrows = [];
      for (var ai = 0; ai < v.NA; ai++) {
        var ea = mkArrow(0xffb648); G.add(ea); v.eArrows.push(ea);
        var ba = mkArrow(0x66d9ff); G.add(ba); v.bArrows.push(ba);
      }
      v.axAt = function (i) { return -HALF + 0.42 + (i / (v.NA - 1)) * (HALF * 2 - 0.84); };

      // ④ 「谁生了谁」：法拉第 ∂B/∂t ⇒ 涡旋 E（橙，后排）；麦克斯韦-安培 ∂E/∂t ⇒ 环形 B（青，前排）
      v.vortexE = []; v.vortexB = [];
      for (var vi = 0; vi < v.NV; vi++) {
        var ve = mkVortex(0xffb648, 'z');
        ve.position.set(-HALF + 0.7 + (vi / (v.NV - 1)) * (HALF * 2 - 1.4), 0, -0.62);
        G.add(ve); v.vortexE.push(ve);
        var vb = mkVortex(0x66d9ff, 'y');
        vb.position.set(-HALF + 0.7 + (vi / (v.NV - 1)) * (HALF * 2 - 1.4), 0, 0.62);
        G.add(vb); v.vortexB.push(vb);
      }

      v.lbE = U.label('E ⟂ B ⟂ 传播方向：同一条行波的两个面', { color: '#ffcf87', worldH: 0.27 });
      v.lbE.position.set(0.1, YW + 1.15, 0);
      G.add(v.lbE);
      v.lbInter = U.label('橙环：变化的磁场 ∂B/∂t 生出涡旋电场 ｜ 青环：变化的电场 ∂E/∂t 生出环形磁场', { color: '#c9d8f0', worldH: 0.23 });
      v.lbInter.position.set(0, YW + 0.76, 0);
      G.add(v.lbInter);

      // （磁场不再用静态环表示：它与电场是同一条行波的两个分量，见上面的 B 矢量阵列与青色涡旋环）

      // ⑤ 导线里的自由电子：只在一个极小范围内来回振荡，一辈子也走不到灯泡
      v.charges = [];
      [YW, -YW].forEach(function (y, wi) {
        for (var k = 0; k < 13; k++) {
          var sp = U.glow(0xfff0a8, 0.22, 0.95);
          sp.userData.base = -HALF + 0.3 + (k / 12) * (HALF * 2 - 0.6);
          sp.userData.wire = wi;
          sp.position.set(sp.userData.base, y, 0);
          G.add(sp);
          v.charges.push(sp);
        }
      });
      v.lbQ = U.label('电子：只在原地来回振荡（位移已放大亿万倍）', { color: '#fff0a8', worldH: 0.26 });
      v.lbQ.position.set(0, YW + 1.54, 0);
      G.add(v.lbQ);

      // ⑥ 波长标尺：这条线路到底占了波长的几分之几（诚实交代比例）
      v.measure = new THREE.Group();
      var mMat = new THREE.MeshBasicMaterial({ color: 0x9fb4d8, transparent: true, opacity: 0.65, depthWrite: false });
      var mY = -YW - 1.0;
      var mLine = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, HALF * 2, 6), mMat);
      mLine.rotation.z = Math.PI / 2; mLine.position.set(0, mY, 0);
      v.measure.add(mLine);
      [-HALF, HALF].forEach(function (mx, idx) {
        var tip2 = new THREE.Mesh(new THREE.ConeGeometry(0.062, 0.18, 8), mMat);
        tip2.position.set(mx + (idx ? -0.09 : 0.09), mY, 0);
        tip2.rotation.z = idx ? -Math.PI / 2 : Math.PI / 2;
        v.measure.add(tip2);
      });
      G.add(v.measure);
      v.lbLam = U.label('整段 ≈ 0.6 λ —— 真实 50 Hz 的 λ ≈ 6000 km，这里把空间压扁了约 10⁶ 倍', { color: '#a8bedd', worldH: 0.24 });
      v.lbLam.position.set(0, mY - 0.42, 0);
      G.add(v.lbLam);
    },

    onParams: function (ctx, p) {
      var v = ctx.v;
      if (!v) return;
      v.Um = p.Um == null ? 1 : p.Um;
      v.R = p.R || 10;
      v.freq = p.freq || 1;
      v.paused = !!p.paused;
      if (p.stretch != null) v.stretch = !!p.stretch;
      if (p.showQ != null) v.showQ = !!p.showQ;
      if (p.showE != null) v.showE = !!p.showE;
      if (p.showB != null) v.showB = !!p.showB;
      v.charges.forEach(function (m) { m.visible = v.showQ; });
      v.lbQ.visible = v.showQ;
      v.rho.visible = v.showE;
      v.waveE.mesh.visible = v.showE;
      v.waveB.mesh.visible = v.showB;
      v.eArrows.forEach(function (m) { m.visible = v.showE; });
      v.bArrows.forEach(function (m) { m.visible = v.showB; });
      v.vortexE.forEach(function (m) { m.visible = v.showE && v.showB; });
      v.vortexB.forEach(function (m) { m.visible = v.showE && v.showB; });
      v.lbE.visible = v.showE || v.showB;
      v.lbInter.visible = v.showE && v.showB;
      v.measure.visible = v.showE;
      v.lbLam.visible = v.showE;
      setLabel(v.lbLam, v.stretch
        ? '整段 ≈ 0.6 λ —— 真实 50 Hz 的 λ ≈ 6000 km，这里把空间压扁了约 10⁶ 倍'
        : '接近真实比例：几米线路只占 λ 的百万分之一，所以整段几乎同时变色 —— 家里看不到这道波',
        '#a8bedd');
      setLabel(v.lbBulb, '灯泡（负载 R = ' + v.R + ' Ω）', '#ffe9b0');
      setLabel(v.lbSrc, '~ 交流电源 ' + (v.Um * 220).toFixed(0) + ' V', '#bcd8ff');
    },

    tick: function (ctx, dt, clock) {
      var v = ctx.v;
      if (!v.paused) v.t += dt * 1.15 * (v.freq || 1);
      var ph = v.t;
      var TAU = Math.PI * 2;
      var NS = v.NS;
      var loops = v.stretch ? v.loops : v.loopsReal;

      // 沿线路的行波：E_y(x,t) = Eₘ·sin(kx − ωt)，B_z 与它严格同相，两者都沿 +x 推进
      var eAt = function (s) { return Math.sin(TAU * loops * s - ph); };
      var dAt = function (s) { return Math.cos(TAU * loops * s - ph); };   // ∝ ∂E/∂t、∂B/∂t

      // 源端 / 负载端：同一时刻并不同步 —— 差的这段时间就是波把能量送过去的过程
      var uS = v.Um * Math.sin(-ph);
      var uL = v.Um * eAt(1);
      var iL = uL / v.R;                      // 负载电流 ∝ 到达那里的 B
      var pL = uL * iL;                       // 到达灯泡的瞬时功率 ≥ 0（纯电阻）
      var Pavg = v.Um * v.Um / (2 * v.R);
      // 思想实验：假装电场不存在（现实里做不到），灯泡端就什么都收不到
      if (!v.showE) { uL = 0; iL = 0; pL = 0; }
      v.uSrc = uS; v.uLoad = uL; v.iLoad = iL; v.pLoad = pL; v.Pavg = Pavg;

      if (v.showE) {
        // 电荷密度：ρ ∝ ∂E/∂x，比电压超前 90°，+/- 团块沿导线移动
        var ca = v.rhoGeo.attributes.color.array;
        for (var qi = 0; qi < NS; qi++) {
          var s = Math.floor(qi / 2) / (NS / 2 - 1);
          var isUp = (qi % 2 === 0);
          var sv = dAt(s) * (isUp ? 1 : -1);
          var m = Math.abs(sv);
          var bright = 0.12 + 0.88 * m * m;
          if (sv >= 0) { ca[qi * 3] = bright; ca[qi * 3 + 1] = bright * 0.62; ca[qi * 3 + 2] = bright * 0.16; }
          else { ca[qi * 3] = bright * 0.2; ca[qi * 3 + 1] = bright * 0.7; ca[qi * 3 + 2] = bright; }
        }
        v.rhoGeo.attributes.color.needsUpdate = true;

        // E 波形带 + E 矢量阵列（沿 ±y）
        updWave(v.waveE, eAt, NS, v.HALF);
        for (var ai = 0; ai < v.eArrows.length; ai++) {
          setArrow3(v.eArrows[ai], v.axAt(ai), eAt(ai / (v.NA - 1)), 0.82, 'y');
        }
      }

      if (v.showB) {
        // B 波形带 + B 矢量阵列（沿 ±z）：与 E 严格同相 —— 它是同一条波的另一个分量
        updWave(v.waveB, eAt, NS, v.HALF);
        for (var bi = 0; bi < v.bArrows.length; bi++) {
          setArrow3(v.bArrows[bi], v.axAt(bi), eAt(bi / (v.NA - 1)), 0.64, 'z');
        }
      }

      if (v.showE && v.showB) {
        // 互生：∂B/∂t ⇒ 涡旋 E（法拉第），∇×E 绕 +z；∂E/∂t ⇒ 环形 B（麦克斯韦-安培），∇×B 绕 −y。
        // 两者都 ∝ cos(kx − ωt)：变化最剧烈的地方正是「互生」最猛的地方，且旋向相反、每半周翻一次。
        for (var vi = 0; vi < v.NV; vi++) {
          var rate = dAt(vi / (v.NV - 1));
          setVortex2(v.vortexE[vi], rate);
          setVortex2(v.vortexB[vi], -rate);
        }
      }

      // 电子：位移 ∝ ∫i dt ∝ −cos(ωt)，只在原地极其微小的范围里来回（位移已极度放大）
      var amp = 0.26;
      var vs = Math.abs(Math.sin(-ph));
      v.charges.forEach(function (sp) {
        sp.position.x = sp.userData.base - Math.cos(ph) * amp * (sp.userData.wire ? -1 : 1);
        sp.material.opacity = 0.32 + 0.6 * vs;
      });

      // 灯泡：吃到了「抵达负载的电场波」才亮；关掉电场，它立刻灭 —— 能量是场送来的
      var rel = v.showE ? (Pavg > 1e-9 ? pL / Pavg : 0) : 0;
      v.bulbLevel += (rel - v.bulbLevel) * Math.min(1, dt * 3.2);   // 灯丝热惯性：只轻微闪
      var lv = Math.min(v.bulbLevel, 2);
      v.bulbMat.emissiveIntensity = 0.12 + 0.85 * lv;
      v.bulbGlow.material.opacity = 0.05 + 0.55 * lv / 2;
      v.bulbGlow.scale.setScalar(1.4 + 0.7 * lv / 2);

      v.hist.push({
        us: uS / (v.Um || 1), ul: uL / (v.Um || 1),
        il: iL / ((v.Um || 1) / v.R), pl: Pavg > 1e-9 ? pL / Pavg : 0,
      });
      if (v.hist.length > 360) v.hist.shift();
      if (clock - v.lastNotify > 0.12) {
        v.lastNotify = clock;
        A.notify({
          ev: 'acEnergy', u: +uS.toFixed(3), i: +iL.toFixed(4),
          p: +pL.toFixed(4), Pavg: +Pavg.toFixed(4),
        });
      }
    },

    draw2d: function (c, W, H, ctx) {
      var v = ctx.v;
      drawChartBg(c, W, H);
      T(c, '同一条行波的两个端点：慢半拍的那点时间，就是能量在赶路', 12, 15, C.ink, 11.5, 'left');
      T(c, '电源侧 u ∝ E（橙实）', 12, 32, C.amber, 10.5, 'left');
      T(c, '灯泡侧 u（橙虚）', 122, 32, '#ff9d3f', 10.5, 'left');
      T(c, '灯泡侧 i ∝ B（青）', 220, 32, C.cyan, 10.5, 'left');

      var x0 = 28, x1 = W - 12, y0 = 44, y1 = H - 26;
      gridLines(c, x0, x1, y0, y1, 8, 4);
      var mid = y0 + (y1 - y0) * 0.44;
      var zU = y0 + (mid - y0) * 0.55;
      c.strokeStyle = '#2c3c63'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x0, zU); c.lineTo(x1, zU); c.stroke();
      c.beginPath(); c.moveTo(x0, mid); c.lineTo(x1, mid); c.stroke();
      var ampU = (mid - y0) * 0.42;
      var pBase = y1 - 2, ampP = (y1 - mid) - 12;
      var n = v.hist.length, i2, xx, yy, first;
      if (n > 1) {
        var step = Math.max(1, Math.floor(n / (x1 - x0)));
        var put = function (key, color, gain, dash) {
          c.strokeStyle = color; c.lineWidth = key === 'pl' ? 2.2 : 2;
          if (dash) c.setLineDash(dash);
          c.beginPath(); first = true;
          for (i2 = 0; i2 < n; i2 += step) {
            xx = x0 + (i2 / (n - 1)) * (x1 - x0);
            yy = key === 'pl'
              ? pBase - Math.max(0, v.hist[i2].pl) * 0.5 * ampP
              : zU - v.hist[i2][key] * ampU * gain;
            if (first) { c.moveTo(xx, yy); first = false; } else c.lineTo(xx, yy);
          }
          c.stroke();
          c.setLineDash([]);
        };
        put('us', C.amber, 1.0);                 // 电源侧电压（∝ E）
        put('ul', '#ff9d3f', 1.0, [5, 4]);       // 灯泡侧电压：明显滞后同一条波的另一个片段
        put('il', C.cyan, 0.78);                 // 灯泡侧电流 ∝ B（与 E 严格同相）
        put('pl', C.green, 1.0);                 // 灯泡侧功率 p = ui ≥ 0

        // 平均功率
        c.setLineDash([4, 4]); c.strokeStyle = '#7de3b0'; c.lineWidth = 1.2;
        var yap = pBase - 0.5 * ampP;
        c.beginPath(); c.moveTo(x0, yap); c.lineTo(x1, yap); c.stroke();
        c.setLineDash([]);
        T(c, 'P̄ = UI', x1 - 2, yap - 8, '#7de3b0', 10, 'right');
        T(c, 'p = ui ≥ 0：能量始终单向流向灯泡', x0 + 2, mid + 12, C.green, 10, 'left');
        T(c, '橙与青严格同相：E 与 B 只是同一条波的两个面', x0 + 2, y0 + 12, C.cyan, 10, 'left');
        T(c, '橙虚线总是慢半拍 → 波先到，灯泡才亮', x0 + 2, y0 + 24, '#ff9d3f', 10, 'left');
      }

      var msg = !v.showE
        ? '电场被藏起来了：波没了，灯泡立刻不亮 —— 灯泡吃的是场送过来的能量'
        : (!v.showQ
          ? '把电子也藏起来：灯泡照样亮 —— 能量不在电子身上，它只是原地踏步'
          : (!v.showB
            ? '磁场藏起来了：还剩半个故事 —— E 与 B 是互相生成的姐妹，缺一就不成波'
            : 'E 生 B、B 再生 E（两者严格同相）：这对互相托举的场一路推向灯泡，全程不带任何电子跑腿'));
      box(c, 12, H - 22, W - 24, 18, 'rgba(255,255,255,0.06)', '#22304e');
      T(c, msg, W / 2, H - 13, C.sub, 10.5, 'center');
    },
  };

  /* ---------------- C6. 交流发电机：正弦从哪来（法拉第 + 楞次） ---------------- */
  REG['ac-gen'] = {
    layout: 'split', fit: 8.8, cam: { theta: 0.3, phi: 1.3 },
    build: function (ctx) {
      var v = ctx.v = {
        th: 0, hist: [], lastNotify: 0,
        omega: 1, B: 1, N: 100, paused: false, showTorque: true,
      };
      var G = ctx.add(new THREE.Group());

      // 磁极 N（左）/ S（右）
      var poleGeo = new THREE.BoxGeometry(0.4, 3.0, 3.0);
      var nPole = new THREE.Mesh(poleGeo, new THREE.MeshStandardMaterial({
        color: 0xe8564b, emissive: 0x4a0f0a, emissiveIntensity: 0.45, roughness: 0.5,
      }));
      nPole.position.set(-3.1, 0, 0);
      var sPole = new THREE.Mesh(poleGeo, new THREE.MeshStandardMaterial({
        color: 0x4a7fe0, emissive: 0x08123a, emissiveIntensity: 0.45, roughness: 0.5,
      }));
      sPole.position.set(3.1, 0, 0);
      G.add(nPole, sPole);
      v.lbN = U.label('N', { color: '#ffd9d2', worldH: 0.42 });
      v.lbN.position.set(-3.1, 1.8, 0);
      v.lbS = U.label('S', { color: '#d6ecff', worldH: 0.42 });
      v.lbS.position.set(3.1, 1.8, 0);
      G.add(v.lbN, v.lbS);

      // 匀强磁场：从 N 指向 S（+x）
      v.bLines = [];
      for (var a = 0; a < 3; a++) {
        for (var b = 0; b < 3; b++) {
          var ln = new THREE.Mesh(
            new THREE.CylinderGeometry(0.016, 0.016, 5.4, 6),
            new THREE.MeshBasicMaterial({ color: 0x66d9ff, transparent: true, opacity: 0.55 })
          );
          ln.rotation.z = Math.PI / 2;
          ln.position.set(0, -1.0 + a * 1.0, -1.0 + b * 1.0);
          G.add(ln);
          v.bLines.push(ln);
        }
      }
      v.lbB = U.label('匀强磁场 B（N → S）', { color: '#9fe4ff', worldH: 0.28 });
      v.lbB.position.set(-2.2, -2.1, 0);
      G.add(v.lbB);

      // 转子：矩形线圈（绕竖直轴 y 旋转）
      v.coil = new THREE.Group();
      var HW = 1.0, HH = 1.3;
      var pts = [
        V(0, -HH, -HW), V(0, -HH, HW), V(0, HH, HW), V(0, HH, -HW), V(0, -HH, -HW),
      ];
      v.coil.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.055, 8, false), metalMat(0xf0c46a)));
      // 转轴
      var axle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 4.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x9aa6bd, roughness: 0.5, metalness: 0.6 })
      );
      v.coil.add(axle);
      G.add(v.coil);
      v.coilPts = pts;
      v.closed = [pts[0], pts[1], pts[2], pts[3], pts[0]];

      // 感应电流粒子
      v.flow = [];
      for (var k = 0; k < 12; k++) {
        var sp = U.glow(0xffe066, 0.26, 0.9);
        v.coil.add(sp);
        v.flow.push(sp);
      }
      v.flowU = 0;

      // 阻力矩（楞次：阻碍转动）
      v.torque = [];
      for (var t = 0; t < 4; t++) {
        var ar = U.arrow(V(0, 0, 0), V(0, 0, 1), 0.7, 0xff6b6b, 0.04);
        G.add(ar);
        v.torque.push(ar);
      }
      v.lbT = U.label('阻力矩（楞次：阻碍转动）', { color: '#ffb3b3', worldH: 0.28 });
      v.lbT.position.set(0, 2.85, 0);
      G.add(v.lbT);

      // 状态标签
      v.lbState = U.label('线圈平面 ⊥ 磁感线：中性面（Φ 最大，e = 0）', { color: '#ffe9b0', worldH: 0.3 });
      v.lbState.position.set(0, -2.95, 0);
      G.add(v.lbState);
      v.lbCoil = U.label('线圈 N = 100 匝', { color: '#ffe9b0', worldH: 0.28 });
      v.lbCoil.position.set(0, 1.95, 0);
      G.add(v.lbCoil);
    },

    onParams: function (ctx, p) {
      var v = ctx.v;
      if (!v) return;
      v.omega = p.omega == null ? 1 : p.omega;
      v.B = p.B == null ? 1 : p.B;
      v.N = p.N || 100;
      v.paused = !!p.paused;
      if (p.showTorque != null) v.showTorque = !!p.showTorque;
      v.torque.forEach(function (a) { a.visible = v.showTorque; });
      v.lbT.visible = v.showTorque;
      setLabel(v.lbCoil, '线圈 N = ' + v.N + ' 匝', '#ffe9b0');
      v.bLines.forEach(function (m) { m.material.opacity = 0.22 + 0.4 * Math.min(v.B, 2) / 2; });
    },

    tick: function (ctx, dt, clock) {
      var v = ctx.v;
      if (!v.paused) v.th += dt * 0.9 * (v.omega || 1);
      var th = v.th;
      v.coil.rotation.y = th;

      var S = 2.0 * 1.3;                        // 线圈面积（半宽 1.0、半高 1.3）
      var phim = v.B * S;                       // 最大磁通
      var phi = phim * Math.cos(th);            // Φ = BS cos θ
      var emf = v.N * phim * (v.omega || 0) * Math.sin(th);  // e = -N dΦ/dt 的大小与方向
      v.phi = phi; v.emf = emf;
      var rel = Math.abs(Math.sin(th));

      // 感应电流沿线圈流动（方向随 e 的符号）
      if (!v.paused) v.flowU += dt * emf * 0.06;
      v.flowU = v.flowU - Math.floor(v.flowU);
      var segs = 4, per = 12;
      v.flow.forEach(function (sp, idx) {
        var u = (v.flowU + idx / v.flow.length) % 1;
        var f = u * segs;
        var si = Math.min(segs - 1, Math.floor(f));
        var lt = f - si;
        var a = v.closed[si], b = v.closed[si + 1];
        sp.position.lerpVectors(a, b, lt);
        sp.material.opacity = 0.15 + 0.8 * rel;
        sp.material.color.setHex(emf >= 0 ? 0xffe066 : 0x8ad4ff);
      });

      // 阻力矩：始终与转动方向相反，大小 ∝ |e|·|I|
      if (v.showTorque) {
        var dirSign = (v.omega || 0) >= 0 ? -1 : 1;
        v.torque.forEach(function (ar, k) {
          var ang = th * 0 + (k / v.torque.length) * Math.PI * 2 + clock * 0.6 * dirSign;
          var R = 1.55, y = 1.75;
          var pos = V(Math.cos(ang) * R, y, Math.sin(ang) * R);
          // 切向（与转动反向）
          var tan = V(-Math.sin(ang), 0, Math.cos(ang)).multiplyScalar(dirSign);
          var L = 0.35 + 0.75 * rel;
          if (ar.userData.setVec) ar.userData.setVec(pos, tan, L);
          ar.children.forEach(function (ch) {
            if (ch.material) ch.material.opacity = 0.35 + 0.6 * rel;
          });
        });
      }

      // 中性面提示
      var cosT = Math.cos(th);
      if (Math.abs(cosT) > 0.9) {
        setLabel(v.lbState, '中性面：线圈平面 ⊥ 磁感线，Φ 最大但 e = 0', '#ffe9b0');
      } else if (Math.abs(cosT) < 0.25) {
        setLabel(v.lbState, '线圈平面 ∥ 磁感线：Φ = 0 但 e 最大', '#8bf5c2');
      } else {
        setLabel(v.lbState, 'e = −N·ΔΦ/Δt：看的是变化率，不是磁通本身', '#cfe3ff');
      }

      v.hist.push({ phi: phim ? phi / phim : 0, e: Math.sin(th) });
      if (v.hist.length > 360) v.hist.shift();
      if (clock - v.lastNotify > 0.12) {
        v.lastNotify = clock;
        A.notify({
          ev: 'acGen', th: +(th % 6.2832).toFixed(3),
          phi: +phi.toFixed(3), emf: +emf.toFixed(2),
        });
      }
    },

    draw2d: function (c, W, H, ctx) {
      var v = ctx.v;
      drawChartBg(c, W, H);
      T(c, '正弦交流电是怎么“转”出来的', 12, 15, C.ink, 12.5, 'left');
      T(c, 'Φ（蓝）', 12, 33, C.cyan, 10.5, 'left');
      T(c, 'e（橙）', 58, 33, C.amber, 10.5, 'left');

      var x0 = 30, x1 = W - 12, y0 = 48, y1 = H - 26;
      gridLines(c, x0, x1, y0, y1, 8, 4);
      var mid = (y0 + y1) / 2;
      c.strokeStyle = '#2c3c63'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x0, mid); c.lineTo(x1, mid); c.stroke();
      var amp = (y1 - mid) - 6;
      var n = v.hist.length, i2, first;
      if (n > 1) {
        var step = Math.max(1, Math.floor(n / (x1 - x0)));
        [[ 'phi', C.cyan ], [ 'e', C.amber ]].forEach(function (pair) {
          c.strokeStyle = pair[1]; c.lineWidth = 2; first = true;
          c.beginPath();
          for (i2 = 0; i2 < n; i2 += step) {
            var xx = x0 + (i2 / (n - 1)) * (x1 - x0);
            var yy = mid - v.hist[i2][pair[0]] * amp * 0.85;
            if (first) { c.moveTo(xx, yy); first = false; } else c.lineTo(xx, yy);
          }
          c.stroke();
        });
      }

      var msg = '线圈每转一周：两次经过中性面（Φ 最大、e = 0），两次与磁感线平行（Φ = 0、e 最大）';
      box(c, 12, H - 22, W - 24, 18, 'rgba(255,255,255,0.06)', '#22304e');
      T(c, msg, W / 2, H - 13, C.sub, 10.5, 'center');
    },
  };
})();
