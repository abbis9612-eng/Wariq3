// «العالم» GW12 — محرك الخرائط الاحترافي v2 (I-107، D-052):
// تضاريس حقيقية مظلّلة + أعماق بحار + تلوين سياسي هجين بحدود متدرّجة (أسلوب Victoria 3 / HOI4)
// + Path2D مسرّع بالـC++ لكل الحدود والأنهار والجبهات + تسمية ذكية بلا تداخل + بطاقات وحدات بسيلويت حاد وحركة ناعمة.
(function (root) {
  'use strict';

  const PI = Math.PI, TAU = PI * 2;
  // نفس حدود levels.json في world3d/terrain (Web Mercator [0..1])
  const ME_BOX = [(2 * 0.5625 - 1) * PI, (2 * 0.3515625 - 1) * PI, (2 * 0.6875 - 1) * PI, (2 * 0.4765625 - 1) * PI];
  // قصّ القطب الجنوبي الفارغ (تحت −60°) حتى الخريطة تطلع متوازنة ونظيفة مثل HOI4 وVictoria 3
  const WORLD_Y_MAX = Math.log(Math.tan(PI / 4 + 60 * PI / 360)); // ~1.317 بـ MY (الجنوب موجب)

  // باليت ألوان استراتيجية متناسقة لكل ثيم (هادية ونبيلة، وتسمح للتضاريس تبين تحتها)
  const PAL_DARK = [
    '#4f8d65', '#be904b', '#816fae', '#4786a3', '#b85d4f',
    '#829d4c', '#5476ad', '#a8678a', '#489886', '#a3815b',
  ];
  const PAL_LIGHT = [
    '#79a368', '#cfa25d', '#8e7cb5', '#6498b0', '#c57263',
    '#9bb062', '#6a89c2', '#b77b9e', '#5ca692', '#b89470',
  ];
  // أسماء مختصرة نظيفة للكيانات الطويلة على الخريطة (الاسم الكامل يبقى بالبطاقة)
  const SHORT_LBL = {
    'إدارة السويداء (الحرس الوطني الدرزي)': 'السويداء',
    'الحوثيين (أنصار الله)': 'الحوثيون',
    'قوات الدعم السريع': 'الدعم السريع',
    'قوات شرق ليبيا (حفتر)': 'شرق ليبيا',
    'الإدارة الذاتية لشمال وشرق سوريا': 'شرق الفرات',
    'حكومة الإنقاذ الوطني': 'إدلب',
    'جمهورية شمال قبرص': 'شمال قبرص',
    'جيش أراكان والمقاومة': 'أراكان',
  };

  // الممرات البحرية الاستراتيجية العالمية
  const LANES = [
    { st: 'hormuz', pts: [[50.0, 29.2], [53.0, 26.8], [56.3, 26.5], [59.5, 24.5], [61.5, 21.0]] },
    { st: 'mandeb', pts: [[61.5, 21.0], [54.0, 15.0], [45.0, 12.2], [43.3, 12.6], [39.5, 20.0], [34.2, 27.6], [32.5, 29.9]] },
    { st: 'suez', pts: [[32.5, 29.9], [32.3, 31.3], [28.0, 34.0], [18.0, 35.8], [10.5, 37.5], [2.0, 37.2], [-5.4, 36.0]] },
    { st: 'gibraltar', pts: [[-5.4, 36.0], [-10.0, 36.5], [-14.0, 42.0], [-6.0, 49.5], [1.5, 51.1]] },
    { st: 'bosporus', pts: [[26.0, 39.8], [29.0, 41.2], [32.5, 43.2], [36.5, 45.2]] },
    { st: 'malacca', pts: [[61.5, 21.0], [72.0, 12.0], [81.0, 5.5], [96.0, 5.5], [100.8, 3.0], [103.8, 1.2], [109.0, 6.0], [115.0, 14.0]] },
    { st: 'taiwan', pts: [[115.0, 14.0], [119.5, 24.2], [125.0, 30.5], [131.0, 34.5], [140.0, 35.0]] },
    { st: 'panama', pts: [[-85.0, 7.0], [-79.9, 9.1], [-76.0, 16.0], [-74.0, 22.0], [-66.0, 28.0]] },
    { st: 'cape', pts: [[45.0, 12.2], [42.0, -5.0], [38.0, -22.0], [20.0, -35.2], [10.0, -28.0], [-5.0, -5.0], [-18.0, 16.0], [-10.0, 36.5]] },
  ];

  // ===== تحميل خرائط التضاريس 4K =====
  const TEX = { w_dark: null, w_light: null, me_dark: null, me_light: null };
  let onTexReady = null;
  function loadTextures(cb) {
    onTexReady = cb;
    for (const k of Object.keys(TEX)) {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => {
        TEX[k] = im;
        // نسخة مصغّرة 1024 (mip) للعرض البعيد: تصغير 3072→450px كل إطار مكلف جداً على المعالج
        if (k[0] === 'w') try {
          const c = document.createElement('canvas'); c.width = c.height = 1024;
          const q = c.getContext('2d'); q.imageSmoothingQuality = 'high'; q.drawImage(im, 0, 0, 1024, 1024);
          TEX[k + '_s'] = c;
        } catch (e) { }
        onTexReady && onTexReady();
      };
      im.src = 'map/' + k + '.webp';
    }
  }

  // ===== بناء Path2D مسرّع مرة وحدة لكل المضلّعات والخطوط =====
  function polyPath(rings) {
    const p = new Path2D();
    for (const f of rings) {
      if (f.length < 4) continue;
      p.moveTo(f[0], f[1]);
      for (let i = 2; i < f.length; i += 2) p.lineTo(f[i], f[i + 1]);
      p.closePath();
    }
    return p;
  }
  function linePath(a) {
    const p = new Path2D();
    if (a.length < 4) return p;
    p.moveTo(a[0], a[1]);
    for (let i = 2; i < a.length; i += 2) p.lineTo(a[i], a[i + 1]);
    return p;
  }

  let GL_RIVERS = null, GL_ROADS = null, LANE_M = null, ALL_LOD_PATH = null;
  function initGeo(WR, MX, MY, R, LOD, S) {
    // 3 مستويات تفصيل: كامل / متوسط (≈1px عند تكبير 1500) / بعيد (≈1px عند 500)
    // المسارات المبسّطة تقلّل الرؤوس اللي يرسمها المعالج ~3-6 مرات بلا فرق مرئي
    const lv = o => { o._p2 = polyPath(o.p); o._pl = [o._p2, ...SIMP.slice(1).map(t => polyPath(simplify(o.p, t)))]; };
    if (R) for (const r of R) if (!r._pl) lv(r);
    if (R && !REG_B) REG_B = [0, 1, 2, 3].map(i => bucketize(R, () => 0, r => r._pl[i]));
    if (S) for (const s of S) if (!s._p2) s._p2 = polyPath(s.p);
    if (LOD && !ALL_LOD_PATH) {
      for (const L of LOD) lv(L);
      ALL_LOD_PATH = [0, 1, 2, 3].map(i => bucketize(LOD, () => 0, L => L._pl[i]));
    }
    if (!LANE_M) {
      LANE_M = LANES.map(L => {
        const pts = L.pts.map(([lo, la]) => [MX(lo), MY(la)]);
        const p = new Path2D();
        pts.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y));
        return { st: L.st, pts, p };
      });
    }
    if (!WR || GL_RIVERS) return;
    const dec = f => {
      const n = f.length, a = new Float32Array(n);
      let x = 0, y = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i < n; i += 2) {
        x += f[i]; y += f[i + 1];
        const mx = MX(x / 100), my = MY(y / 100);
        a[i] = mx; a[i + 1] = my;
        if (mx < x0) x0 = mx; if (mx > x1) x1 = mx;
        if (my < y0) y0 = my; if (my > y1) y1 = my;
      }
      return { a, bb: [x0, y0, x1, y1], p: linePath(a) };
    };
    GL_RIVERS = (WR.v || []).map(v => { const d = dec(v.slice(1)); d.sc = v[0]; return d; });
    GL_ROADS = (WR.r || []).map(r => { const d = dec(r.slice(1)); d.c = r[0]; return d; });
    // دمج الأنهار والطرق بحزم (درجة الأهمية × مربع 30°) → عشرات الضربات بدل المئات
    RIV_B = bucketize(GL_RIVERS, v => v.sc <= 4 ? 4 : v.sc <= 6 ? 6 : 9, v => v.p);
    ROAD_B = bucketize(GL_ROADS, r => r.c === 2 ? 2 : 1, r => r.p);
  }

  // ===== تبسيط الحلقات (مسافة شعاعية): نحذف الرؤوس الأقرب من tol للرأس السابق =====
  const SIMP = [0, 0.0004, 0.0012, 0.0045];
  function simplify(rings, tol) {
    const t2 = tol * tol, out = [];
    for (const f of rings) {
      const n = f.length; if (n < 8) { out.push(f); continue; }
      const a = [f[0], f[1]]; let lx = f[0], ly = f[1];
      for (let i = 2; i < n - 2; i += 2) {
        const dx = f[i] - lx, dy = f[i + 1] - ly;
        if (dx * dx + dy * dy >= t2) { a.push(f[i], f[i + 1]); lx = f[i]; ly = f[i + 1]; }
      }
      a.push(f[n - 2], f[n - 1]);
      if (a.length >= 6) out.push(a);
    }
    return out;
  }

  // ===== حزم مكانية: كل نمط × مربع 30° = Path2D واحد مع bbox للقصّ =====
  let RIV_B = null, ROAD_B = null, REG_B = null;
  function bucketize(items, styleOf, pathOf) {
    const m = new Map(), T = TAU / 12;
    for (const it of items) {
      const bb = it.bb; if (!bb) continue;
      const k = styleOf(it) + '|' + Math.floor(((bb[0] + bb[2]) / 2 + PI) / T) + '|' + Math.floor(((bb[1] + bb[3]) / 2 + PI) / T);
      let b = m.get(k);
      if (!b) { b = { st: styleOf(it), p: new Path2D(), bb: [1e9, 1e9, -1e9, -1e9] }; m.set(k, b); }
      b.p.addPath(pathOf(it));
      b.bb[0] = Math.min(b.bb[0], bb[0]); b.bb[1] = Math.min(b.bb[1], bb[1]);
      b.bb[2] = Math.max(b.bb[2], bb[2]); b.bb[3] = Math.max(b.bb[3], bb[3]);
    }
    return [...m.values()];
  }

  // ===== أنماط تظليل المناطق المحتلة (خطوط قطرية) =====
  const HATCH = {};
  function getHatch(cx, light) {
    const k = light ? 'L' : 'D';
    if (HATCH[k]) return HATCH[k];
    const c = document.createElement('canvas'); c.width = 10; c.height = 10;
    const g = c.getContext('2d');
    g.strokeStyle = light ? 'rgba(42,18,14,.32)' : 'rgba(255,212,162,.28)';
    g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(-2, 10); g.lineTo(10, -2); g.moveTo(2, 12); g.lineTo(12, 2); g.stroke();
    return HATCH[k] = cx.createPattern(c, 'repeat');
  }

  // ===== استخراج خطوط التماس الحقيقية على الحدود المشتركة ودمجها بـ Path2D واحد =====
  function buildFrontSegs(FRONT, MX, MY) {
    const path = new Path2D();
    const Q = v => Math.round(v * 2500);
    let count = 0;
    for (const [a, b] of FRONT) {
      const verts = new Set();
      for (const f of a.p) for (let i = 0; i < f.length; i += 2) verts.add(Q(f[i]) + ',' + Q(f[i + 1]));
      let found = 0;
      for (const f of b.p) {
        let cur = null;
        for (let i = 0; i < f.length; i += 2) {
          const hit = verts.has(Q(f[i]) + ',' + Q(f[i + 1]));
          if (hit) {
            if (!cur) cur = [];
            cur.push(f[i], f[i + 1]);
          } else if (cur) {
            if (cur.length >= 4) {
              path.moveTo(cur[0], cur[1]);
              for (let k = 2; k < cur.length; k += 2) path.lineTo(cur[k], cur[k + 1]);
              found++; count++;
            }
            cur = null;
          }
        }
        if (cur && cur.length >= 4) {
          path.moveTo(cur[0], cur[1]);
          for (let k = 2; k < cur.length; k += 2) path.lineTo(cur[k], cur[k + 1]);
          found++; count++;
        }
      }
      if (!found) {
        const x1 = MX(a.ll[0]), y1 = MY(a.ll[1]), x2 = MX(b.ll[0]), y2 = MY(b.ll[1]);
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = (y2 - y1) * .22, dy = (x1 - x2) * .22;
        path.moveTo(mx - dx, my - dy); path.lineTo(mx + dx, my + dy);
        count++;
      }
    }
    return { path, count };
  }

  // ===== مكان اسم الدولة الذكي: أكبر كتلة متصلة فعلياً (حتى أمريكا ما تروح لألاسكا!) =====
  function buildLabels(R, MX, MY) {
    const byC = {}, byId = new Map();
    for (const r of R) { byId.set(r.id, r); if (r.ctl) (byC[r.ctl] ||= []).push(r); }
    const out = {};
    for (const k in byC) {
      const list = byC[k];
      const seen = new Set();
      let bestComp = null, bestScore = -1, totA = 0;
      for (const r of list) totA += r.a;
      for (const r of list) {
        if (seen.has(r.id)) continue;
        // BFS على نفس الدولة حتى نلقى أكبر كتلة برية متصلة (مع تفضيل الكتلة اللي بيها العاصمة)
        const q = [r], comp = []; seen.add(r.id);
        let ca = 0, hasCap = 0;
        while (q.length) {
          const u = q.pop(); comp.push(u); ca += u.a; if (u.cap) hasCap = 1;
          for (const nid of u.nb) {
            const v = byId.get(nid);
            if (v && v.ctl === k && !seen.has(v.id)) { seen.add(v.id); q.push(v); }
          }
        }
        const score = ca * (hasCap ? 2.5 : 1);
        if (score > bestScore) { bestScore = score; bestComp = comp; }
      }
      let sx = 0, sy = 0, sa = 0;
      for (const r of bestComp) { sx += MX(r.ll[0]) * r.a; sy += MY(r.ll[1]) * r.a; sa += r.a; }
      out[k] = { x: sx / sa, y: sy / sa, a: totA };
    }
    return out;
  }

  // ===== رسم صورة مقصوصة للجزء المرئي فقط (مع قصّ القطب الجنوبي) =====
  function drawCroppedTex(cx, im, x0, y0, x1, y1, cam, W, H, clipYMax) {
    if (!im || im.complete === false || !(im.naturalWidth || im.width)) return false;
    const sx0 = (x0 - cam.x) * cam.s + W / 2, sy0 = (y0 - cam.y) * cam.s + H / 2;
    const sx1 = (x1 - cam.x) * cam.s + W / 2, sy1 = (y1 - cam.y) * cam.s + H / 2;
    const syMax = clipYMax != null ? Math.min(sy1, (clipYMax - cam.y) * cam.s + H / 2) : sy1;
    if (sx1 <= 0 || sx0 >= W || syMax <= 0 || sy0 >= H) return false;
    const dx0 = Math.max(0, sx0), dy0 = Math.max(0, sy0);
    const dx1 = Math.min(W, sx1), dy1 = Math.min(H, syMax);
    const dw = dx1 - dx0, dh = dy1 - dy0;
    if (dw <= 0 || dh <= 0) return false;
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    const u0 = (dx0 - sx0) / (sx1 - sx0) * iw, v0 = (dy0 - sy0) / (sy1 - sy0) * ih;
    const uw = (dw / (sx1 - sx0)) * iw, vh = (dh / (sy1 - sy0)) * ih;
    cx.drawImage(im, u0, v0, uw, vh, dx0, dy0, dw, dh);
    return true;
  }

  // ===== خطوط الطول والعرض الكارتوغرافية =====
  function drawGraticule(cx, cam, W, H, light, MX, MY) {
    const step = cam.s < 220 ? 30 : cam.s < 750 ? 15 : cam.s < 2200 ? 5 : 2;
    cx.save();
    cx.strokeStyle = light ? 'rgba(28,58,82,.09)' : 'rgba(150,205,235,.065)';
    cx.lineWidth = .7;
    cx.beginPath();
    const w0 = (-W / 2) / cam.s + cam.x, w1 = (W / 2) / cam.s + cam.x;
    const h0 = (-H / 2) / cam.s + cam.y, h1 = (H / 2) / cam.s + cam.y;
    const lon0 = Math.max(-180, Math.floor((w0 * 180 / PI) / step) * step);
    const lon1 = Math.min(180, Math.ceil((w1 * 180 / PI) / step) * step);
    for (let lo = lon0; lo <= lon1; lo += step) {
      const sx = (MX(lo) - cam.x) * cam.s + W / 2;
      cx.moveTo(sx, 0); cx.lineTo(sx, H);
    }
    for (let la = -60; la <= 75; la += step) {
      const my = MY(la);
      if (my < h0 || my > h1) continue;
      const sy = (my - cam.y) * cam.s + H / 2;
      cx.moveTo(0, sy); cx.lineTo(W, sy);
    }
    cx.stroke();
    if (cam.s >= 160) {
      cx.font = '600 9px ui-monospace,monospace';
      cx.fillStyle = light ? 'rgba(28,55,78,.36)' : 'rgba(170,212,235,.30)';
      cx.textAlign = 'left';
      for (let la = -55; la <= 75; la += step) {
        const my = MY(la); if (my < h0 || my > h1) continue;
        const sy = (my - cam.y) * cam.s + H / 2;
        if (sy > 115 && sy < H - 80) cx.fillText(Math.abs(la) + '°' + (la > 0 ? 'N' : la < 0 ? 'S' : ''), 5, sy - 3);
      }
    }
    cx.restore();
  }

  // ===== الكاش الداخلي للخريطة الثابتة =====
  let cacheCv = null, cacheCx = null, cacheKey = '', lastKey = '';
  function invalidate() { cacheKey = ''; lastKey = ''; }
  function ensureCache(W, H, DPR) {
    if (!cacheCv) { cacheCv = document.createElement('canvas'); cacheCx = cacheCv.getContext('2d'); }
    const pw = Math.round(W * DPR), ph = Math.round(H * DPR);
    if (cacheCv.width !== pw || cacheCv.height !== ph) { cacheCv.width = pw; cacheCv.height = ph; cacheKey = ''; }
    return cacheCx;
  }

  // ===== دالة الرسم الرئيسية للخريطة (مسرّعة بـ Path2D + كاش 60 إطار) =====
  function drawMap(ctx) {
    const { cx, W, H, DPR, cam, mode, light, R, S, LOD, WD, CS, ENT, LBL, frontSegs, sel, me, G,
      colIdx, relCol, fillRes, TCOL, MX, MY, nameOf, mapRev, stxKey, css } = ctx;

    const key = `${cam.x.toFixed(5)}|${cam.y.toFixed(5)}|${cam.s.toFixed(2)}|${mode}|${light ? 1 : 0}|${mapRev}|${W}|${H}|${DPR}|${sel ? sel.id : -1}|${me || ''}|${stxKey}`;
    if (key === cacheKey && cacheCv) {
      cx.setTransform(1, 0, 0, 1, 0, 0);
      cx.drawImage(cacheCv, 0, 0);
      cx.setTransform(DPR, 0, 0, DPR, 0, 0);
      return true;
    }
    // أثناء السحب/التكبير المفتاح يتغيّر كل إطار → نرسم مباشرة على الشاشة (بلا نسخ كاش)
    // ولما تثبت الكاميرا إطارين متتاليين نبني الكاش لإطارات حركة الطيران/المسرح
    const direct = key !== lastKey;
    lastKey = key;
    const g = direct ? cx : ensureCache(W, H, DPR);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    const far = cam.s < 520;
    const LV = cam.s < 180 ? 3 : cam.s < 500 ? 2 : cam.s < 1500 ? 1 : 0;
    const vis = bb => {
      const a = (bb[0] - cam.x) * cam.s + W / 2, b = (bb[1] - cam.y) * cam.s + H / 2;
      const c = (bb[2] - cam.x) * cam.s + W / 2, d = (bb[3] - cam.y) * cam.s + H / 2;
      return c >= -4 && a <= W + 4 && d >= -4 && b <= H + 4;
    };
    const toS = (x, y) => [(x - cam.x) * cam.s + W / 2, (y - cam.y) * cam.s + H / 2];
    const setWorldXf = () => g.setTransform(DPR * cam.s, 0, 0, DPR * cam.s, DPR * (W / 2 - cam.x * cam.s), DPR * (H / 2 - cam.y * cam.s));

    // 1) خلفية المحيط مطابقة بالضبط لحافة التضاريس 4K (بلا أي خط فاصل!)
    g.fillStyle = light ? '#528bb6' : '#062c4f';
    g.fillRect(0, 0, W, H);

    // 2) خريطة التضاريس وأعماق البحار 4K (مع قصّ القطب الجنوبي)
    const mip = cam.s * TAU * DPR < 1500;
    const wTex = (mip && TEX[(light ? 'w_light' : 'w_dark') + '_s']) || (light ? TEX.w_light : TEX.w_dark);
    const meTex = light ? TEX.me_light : TEX.me_dark;
    let hasTex = false;
    if (wTex) {
      for (const k of [-1, 0, 1]) {
        if (drawCroppedTex(g, wTex, -PI + k * TAU, -PI, PI + k * TAU, PI, cam, W, H, WORLD_Y_MAX)) hasTex = true;
      }
      if (meTex && cam.s > 360) {
        drawCroppedTex(g, meTex, ME_BOX[0], ME_BOX[1], ME_BOX[2], ME_BOX[3], cam, W, H, null);
      }
    }

    // 3) خطوط الطول والعرض
    drawGraticule(g, cam, W, H, light, MX, MY);

    // ===== كل المسارات المسرّعة بـ Path2D بإحداثيات العالم =====
    setWorldXf();
    const px = n => n / cam.s;
    // خط شعري: أقل من بكسل جهاز واحد → Skia يرسمه بمسار hairline السريع (بدل تحويل الخط لمضلّع)
    const hair = 0.95 / (cam.s * DPR);

    // 3ب) حدود المناطق البحرية الناعمة + الممرات البحرية الاستراتيجية
    if (!far) {
      g.strokeStyle = light ? 'rgba(20,55,85,.07)' : 'rgba(140,205,240,.06)';
      g.lineWidth = px(.9);
      for (const s of S) if (vis(s.bb)) g.stroke(s._p2);
    }
    if (LANE_M && cam.s < 4000) {
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const L of LANE_M) {
        const dis = G && G.stx && G.stx[L.st] > 0;
        g.setLineDash(dis ? [px(5), px(4)] : [px(3), px(6)]);
        g.strokeStyle = dis ? 'rgba(255,95,65,.8)' : (light ? 'rgba(24,78,118,.26)' : 'rgba(130,200,235,.22)');
        g.lineWidth = px(dis ? 2.2 : 1.1);
        g.stroke(L.p);
      }
      g.setLineDash([]);
    }

    // 4) التلوين الهجين (السياسة / الأرض / العلاقات / الطاقة) مع إبقاء التضاريس ظاهرة!
    const PAL = light ? PAL_LIGHT : PAL_DARK;
    const polCol = k => !k ? (light ? '#8d9289' : '#58605d') : ENT[k] ? (light ? '#b84b44' : '#b8433b') : PAL[colIdx[k] % PAL.length];
    const fillOf = r => {
      if (mode === 'ter') return TCOL[r.t];
      if (mode === 'rel') return relCol(r.ctl);
      if (mode === 'res') return fillRes(r, light);
      if ((mode === 'eco' || mode === 'mil' || mode === 'ally') && ctx.fillX) return ctx.fillX(r, light);
      return polCol(r.ctl);
    };
    const useLOD = far && mode === 'pol' && !window.MAPCHANGED;
    const polAlpha = mode === 'ter'
      ? (hasTex ? (light ? .15 : .20) : .92)
      : (hasTex
        ? (far ? (light ? .42 : .38) : Math.max(light ? .22 : .20, (light ? .38 : .34) - (cam.s - 500) / 9500))
        : .95);

    const dataL = mode === 'eco' || mode === 'mil' || mode === 'ally';   // طبقات البيانات: لون أقوى حتى يبين
    g.save();
    if (hasTex && light && mode !== 'res' && !dataL) g.globalCompositeOperation = 'multiply';
    g.globalAlpha = dataL ? (hasTex ? .62 : .95) : polAlpha;
    // تجميع المرئي حسب اللون → ضربة fill وحدة لكل لون (بدل مئات الضربات)
    const groups = new Map();
    const addG = (col, p) => { let q = groups.get(col); if (!q) { q = new Path2D(); groups.set(col, q); } q.addPath(p); };
    if (useLOD) {
      for (const L of LOD) if (vis(L.bb)) addG(L.k[0] === '~' ? (light ? '#8d9289' : '#58605d') : polCol(L.k), L._pl[LV]);
    } else {
      for (const r of R) if (vis(r.bb)) addG(fillOf(r), r._pl[LV]);
    }
    for (const [col, q] of groups) { g.fillStyle = col; g.fill(q); }
    g.restore();

    // تظليل المناطق المحتلة بخطوط قطرية (عند التقريب أو بعرض المناطق)
    if (!far) {
      g.save();
      const pat = getHatch(g, light);
      if (pat && pat.setTransform) pat.setTransform(new DOMMatrix().scale(1 / cam.s, 1 / cam.s));
      g.fillStyle = pat;
      const occ = new Path2D(); let nOcc = 0;
      for (const r of R) if (r.c && r.ctl && r.ctl !== r.c && vis(r.bb)) { occ.addPath(r._pl[LV]); nOcc++; }
      if (nOcc) g.fill(occ);
      g.restore();
    }

    // 5) الأنهار والطرق العالمية (Path2D + bbox culling)
    if (RIV_B && cam.s > 420) {
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = light ? 'rgba(40,115,178,.68)' : 'rgba(72,158,218,.58)';
      const maxSc = cam.s < 850 ? 4 : cam.s < 1600 ? 6 : 9;
      g.lineWidth = px(Math.min(2.2, .75 + cam.s / 1800));
      for (const b of RIV_B) if (b.st <= maxSc && vis(b.bb)) g.stroke(b.p);
    }
    if (ROAD_B && cam.s > 1100) {
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const r of ROAD_B) {
        if (r.st !== 2 && cam.s < 2100) continue;
        if (!vis(r.bb)) continue;
        g.strokeStyle = r.st === 2
          ? (light ? 'rgba(138,78,36,.42)' : 'rgba(222,168,96,.34)')
          : (light ? 'rgba(120,90,60,.25)' : 'rgba(190,155,105,.20)');
        g.lineWidth = r.st === 2 ? px(Math.min(1.8, .85 + cam.s / 3200)) : hair;
        g.stroke(r.p);
      }
    }

    // 6) حدود المحافظات الناعمة (عند التقريب)
    if (!far) {
      g.strokeStyle = light ? 'rgba(45,38,28,.16)' : 'rgba(235,228,205,.12)';
      g.lineWidth = hair;
      for (const b of REG_B[LV]) if (vis(b.bb)) g.stroke(b.p);
    }

    // 7) شريط الحدود الدولية المتدرّج (أسلوب Paradox) + خط حبر واحد مسرّع
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (!far && (mode === 'pol' || mode === 'rel')) {
      g.save();
      g.globalAlpha = light ? .42 : .44;
      g.lineWidth = px(Math.min(5.2, 2.4 + cam.s / 1100));
      for (const L of LOD) if (vis(L.bb)) {
        g.strokeStyle = mode === 'rel' ? relCol(L.k) : (L.k[0] === '~' ? '#6c726d' : polCol(L.k));
        g.stroke(L._pl[LV]);
      }
      g.restore();
    }
    if (ALL_LOD_PATH) {
      g.strokeStyle = light ? 'rgba(42,36,26,.72)' : 'rgba(12,16,14,.84)';
      g.lineWidth = far ? hair : px(Math.min(1.8, 1.15 + cam.s / 4500));
      for (const b of ALL_LOD_PATH[LV]) if (vis(b.bb)) g.stroke(b.p);
      if (!far && !light) {
        g.strokeStyle = 'rgba(255,244,214,.14)';
        g.lineWidth = hair;
        for (const b of ALL_LOD_PATH[LV]) if (vis(b.bb)) g.stroke(b.p);
      }
    }

    // 8) خطوط التماس الحقيقية (Path2D واحد مدمج — رسم فوري!)
    if (frontSegs && frontSegs.count) {
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = 'rgba(255,68,42,.30)';
      g.lineWidth = px(far ? 3.5 : 6.2);
      g.stroke(frontSegs.path);
      g.strokeStyle = light ? '#c92a14' : '#ff5438';
      g.lineWidth = px(far ? 1.4 : 2.2);
      g.setLineDash([px(6), px(4)]);
      g.stroke(frontSegs.path);
      g.setLineDash([]);
    }

    // 9) المنطقة المختارة بتوهج ذهبي
    if (sel && sel._p2) {
      g.strokeStyle = 'rgba(224,181,88,.34)'; g.lineWidth = px(6); g.stroke(sel._p2);
      g.strokeStyle = css('--gold'); g.lineWidth = px(2.2); g.stroke(sel._p2);
    }

    // ===== الرجوع لإحداثيات الشاشة للنصوص والرموز =====
    g.setTransform(DPR, 0, 0, DPR, 0, 0);

    // 10) علامات حقول النفط بوضع الطاقة
    if (mode === 'res' && cam.s > 600) {
      for (const r of R) {
        if (!(r.oil > 50 || r.gas > 10) || !vis(r.bb)) continue;
        const [x, y] = toS(MX(r.ll[0]), MY(r.ll[1]));
        const rad = Math.min(8, 3 + Math.sqrt((r.oil + r.gas * 6) / 60));
        g.beginPath(); g.arc(x, y, rad, 0, TAU);
        g.fillStyle = 'rgba(245,186,58,.85)'; g.fill();
        g.strokeStyle = '#231908'; g.lineWidth = 1.2; g.stroke();
      }
    }

    // 11) نظام التسمية الذكي بلا تداخل
    const boxes = [];
    const tryBox = (x, y, w, h, pad = 3) => {
      const a = x - w / 2 - pad, b = y - h / 2 - pad, c = x + w / 2 + pad, d = y + h / 2 + pad;
      for (let i = 0; i < boxes.length; i++) {
        const o = boxes[i];
        if (a < o[2] && c > o[0] && b < o[3] && d > o[1]) return false;
      }
      boxes.push([a, b, c, d]);
      return true;
    };
    const haloCol = light ? 'rgba(248,244,232,.88)' : 'rgba(14,18,16,.84)';
    const inkCol = light ? '#1d2219' : '#f4efdf';
    const capCol = light ? '#7a4d04' : '#f3cb6c';
    const subCol = light ? '#333b2e' : '#dcd6c2';

    // 11أ) أسماء الدول (تختفي بنعومة عند التقريب العالي)
    if (cam.s < 2100) {
      g.save();
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      const fade = cam.s > 1400 ? Math.max(0, 1 - (cam.s - 1400) / 700) : 1;
      g.globalAlpha = fade;
      const entries = Object.entries(LBL).sort((a, b) => b[1].a - a[1].a);
      for (const [k, L] of entries) {
        if (!CS[k] && !ENT[k]) continue;
        const pxS = Math.sqrt(L.a) / 6371 * cam.s;
        if (pxS < 24) continue;
        const [x, y] = toS(L.x, L.y);
        if (x < -40 || x > W + 40 || y < 55 || y > H - 40) continue;
        const raw = nameOf(k), tx = SHORT_LBL[raw] || raw;
        const fs = Math.round(Math.max(10.5, Math.min(20, pxS / 6.8)));
        g.font = `700 ${fs}px "IBM Plex Sans Arabic",Tahoma`;
        const tw = g.measureText(tx).width;
        if (!tryBox(x, y, tw, fs, 4)) continue;
        g.strokeStyle = haloCol; g.lineWidth = light ? 3.2 : 3.6;
        g.strokeText(tx, x, y);
        g.fillStyle = ENT[k] ? (light ? '#8f2419' : '#ff9a8a') : inkCol;
        g.fillText(tx, x, y);
      }
      g.restore();
    }

    // 11ب) المضائق الاستراتيجية
    g.save();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    for (const st of WD.st) {
      const [x, y] = toS(MX(st.ll[0]), MY(st.ll[1]));
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
      const dis = G && G.stx && G.stx[st.id] > 0;
      const sz = far ? 4.2 : 5.5;
      g.beginPath(); g.moveTo(x, y - sz); g.lineTo(x + sz, y); g.lineTo(x, y + sz); g.lineTo(x - sz, y); g.closePath();
      g.fillStyle = dis ? '#ff4430' : css('--gold'); g.fill();
      g.strokeStyle = light ? '#261e0c' : '#0a0e0c'; g.lineWidth = 1.2; g.stroke();
      if (cam.s > 280) {
        g.font = '600 10.5px "IBM Plex Sans Arabic",Tahoma';
        const tx = st.n, tw = g.measureText(tx).width;
        const ly = tryBox(x, y - 12, tw, 12, 3) ? y - 12 : (tryBox(x, y + 12, tw, 12, 3) ? y + 12 : null);
        if (ly != null) {
          g.strokeStyle = haloCol; g.lineWidth = 3; g.strokeText(tx, x, ly);
          g.fillStyle = dis ? '#ff6a54' : (light ? '#1b4f78' : '#8ed0f0');
          g.fillText(tx, x, ly);
        }
      }
    }
    g.restore();

    // 11ج) العواصم والمدن الكبرى (تجرّب فوق النقطة ثم تحتها حتى تبان «بغداد» و«العراق» سوا!)
    if (cam.s > 360) {
      g.save();
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      for (const r of R) {
        if (!r.cap || !r.cities.length || !vis(r.bb)) continue;
        const [x, y] = toS(MX(r.ll[0]), MY(r.ll[1]));
        g.beginPath(); g.arc(x, y, 4.2, 0, TAU); g.fillStyle = light ? '#f8f2df' : '#121614'; g.fill();
        g.strokeStyle = capCol; g.lineWidth = 1.6; g.stroke();
        g.beginPath(); g.arc(x, y, 1.8, 0, TAU); g.fillStyle = capCol; g.fill();
        const tx = r.cities[0][0];
        g.font = '700 11px "IBM Plex Sans Arabic",Tahoma';
        const tw = g.measureText(tx).width;
        const ly = tryBox(x, y - 11, tw, 12, 2.5) ? y - 11 : (tryBox(x, y + 12, tw, 12, 2.5) ? y + 12 : null);
        if (ly != null) {
          g.strokeStyle = haloCol; g.lineWidth = 3; g.strokeText(tx, x, ly);
          g.fillStyle = capCol; g.fillText(tx, x, ly);
        }
      }
      if (cam.s > 800) {
        for (const r of R) {
          if (r.cap || !r.cities.length || !vis(r.bb)) continue;
          const big = r.cities[0][1];
          if (cam.s < 1400 && big < 1.5e6) continue;
          if (cam.s < 2600 && big < 4e5) continue;
          const [x, y] = toS(MX(r.ll[0]), MY(r.ll[1]));
          g.beginPath(); g.arc(x, y, big >= 1e6 ? 2.8 : 2.1, 0, TAU);
          g.fillStyle = subCol; g.fill();
          g.strokeStyle = haloCol; g.lineWidth = 1; g.stroke();
          const tx = r.cities[0][0];
          g.font = '500 10.5px "IBM Plex Sans Arabic",Tahoma';
          const tw = g.measureText(tx).width;
          const ly = tryBox(x, y - 9, tw, 11, 2) ? y - 9 : (tryBox(x, y + 10, tw, 11, 2) ? y + 10 : null);
          if (ly != null) {
            g.strokeStyle = haloCol; g.lineWidth = 2.6; g.strokeText(tx, x, ly);
            g.fillStyle = subCol; g.fillText(tx, x, ly);
          }
        }
      }
      g.restore();
    }

    // 12) الـVignette صار طبقة CSS فوق الكانفس (#vig) — يركّبها الـGPU بلا أي كلفة CPU

    if (direct) { cx.setTransform(DPR, 0, 0, DPR, 0, 0); return false; }
    cacheKey = key;
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.drawImage(cacheCv, 0, 0);
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
    return false;
  }

  // ===== مقياس المسافة (كم) =====
  function drawScaleAndCompass(cx, cam, W, H, light, bottomPx) {
    const lat = (2 * Math.atan(Math.exp(-cam.y)) - PI / 2);
    const kmPerPx = (6371 * Math.max(0.2, Math.cos(lat))) / cam.s;
    const steps = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    let km = steps[0];
    for (const s of steps) { if (s / kmPerPx <= 96) km = s; }
    const barW = Math.max(28, Math.min(100, km / kmPerPx));
    const y = H - bottomPx - 14, x = 14;
    cx.save();
    cx.fillStyle = light ? 'rgba(247,242,228,.82)' : 'rgba(20,26,22,.78)';
    cx.strokeStyle = light ? 'rgba(50,45,35,.25)' : 'rgba(235,229,210,.2)';
    cx.lineWidth = 1;
    roundRect(cx, x - 6, y - 14, barW + 18, 20, 6); cx.fill(); cx.stroke();
    cx.strokeStyle = light ? '#262d22' : '#ece6d3';
    cx.lineWidth = 1.6;
    cx.beginPath();
    cx.moveTo(x, y - 3); cx.lineTo(x, y + 1); cx.lineTo(x + barW, y + 1); cx.lineTo(x + barW, y - 3);
    cx.stroke();
    cx.font = '600 9.5px "IBM Plex Sans Arabic",Tahoma';
    cx.fillStyle = light ? '#262d22' : '#ece6d3';
    cx.textAlign = 'center';
    cx.fillText((km >= 1000 ? (km / 1000) + ' ألف كم' : km + ' كم'), x + barW / 2, y - 4);
    cx.restore();
  }

  function roundRect(cx, x, y, w, h, r) {
    cx.beginPath();
    cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r);
    cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r);
    cx.arcTo(x, y, x + w, y, r); cx.closePath();
  }

  // ===== سيلويت عسكري حاد ونظيف للوحدات (أوضح 10× من الصورة المصغّرة بـ 28 بكسل على التلفون!) =====
  function drawUnitIcon(cx, kind, x, y, sc, col) {
    cx.save();
    cx.translate(x, y);
    cx.scale(sc, sc);
    cx.fillStyle = col;
    cx.strokeStyle = col;
    if (kind === 'arm') {
      // سيلويت دبابة قتال رئيسية جانبي حاد
      cx.beginPath();
      cx.roundRect(-8.5, 1.2, 17, 3.4, 1.7); // الجنازير
      cx.fill();
      cx.beginPath();
      cx.moveTo(-7.5, 1.2); cx.lineTo(-5.5, -1.6); cx.lineTo(6.5, -1.6); cx.lineTo(8, 1.2); cx.closePath(); // البدن
      cx.fill();
      cx.beginPath();
      cx.moveTo(-4, -1.6); cx.lineTo(-2.5, -4.4); cx.lineTo(2.8, -4.4); cx.lineTo(4.2, -1.6); cx.closePath(); // البرج
      cx.fill();
      cx.lineWidth = 1.5; cx.lineCap = 'round';
      cx.beginPath(); cx.moveTo(3.2, -3.2); cx.lineTo(10.5, -3.8); cx.stroke(); // السبطانة
    } else if (kind === 'mec') {
      // سيلويت مدرعة قتال مشاة (IFV)
      cx.beginPath();
      cx.roundRect(-7.5, 1.3, 15, 3.1, 1.5); // العجلات/الجنازير
      cx.fill();
      cx.beginPath();
      cx.moveTo(-7.2, 1.3); cx.lineTo(-6.2, -2.6); cx.lineTo(4.6, -2.6); cx.lineTo(7.5, -.2); cx.lineTo(7.5, 1.3); cx.closePath();
      cx.fill();
      cx.beginPath(); cx.roundRect(-2.4, -4.6, 5.2, 2.2, .8); cx.fill(); // برج رشاش
      cx.lineWidth = 1.25; cx.lineCap = 'round';
      cx.beginPath(); cx.moveTo(2.5, -3.7); cx.lineTo(8.2, -4.2); cx.stroke();
    } else {
      // رمز مشاة تكتيكي (خوذة/رمز X حاد)
      cx.lineWidth = 1.7; cx.lineCap = 'round';
      cx.beginPath();
      cx.moveTo(-6, -3.6); cx.lineTo(6, 3.6);
      cx.moveTo(6, -3.6); cx.lineTo(-6, 3.6);
      cx.stroke();
      cx.beginPath(); cx.arc(0, -4.2, 1.7, 0, TAU); cx.fill();
    }
    cx.restore();
  }

  // ===== رسم المسرح النظيف (بدون فوضى السداسيات + بطاقات وحدات بسيلويت حاد + حركة ناعمة) =====
  function drawTheater(o) {
    const { cx, T, cam, W, H, light, toS, MX, MY, SM, VIEW, FX,
      selD, PLAN, HPS, speed, css } = o;
    const Wd = T.W, me0 = css('--me'), en = css('--neg');
    const isHome = !!(T.side && (!T.side[1] || !T.side[1].length));
    const r = Math.abs(toS(MX(T.lon0 + T.hs / T.KX), 0)[0] - toS(MX(T.lon0), 0)[0]) / 2;

    // 1) طبقة الخلايا النظيفة + خط الجبهة الفعلي
    if (r > 3) {
      const showGrid = !!(selD || PLAN) || cam.s > 2800;
      cx.save();
      for (let i = 0; i < T.cells.length; i++) {
        const c = T.cells[i], [x, y] = toS(MX(c.ll[0]), MY(c.ll[1]));
        if (x < -r * 1.4 || x > W + r * 1.4 || y < -r * 1.4 || y > H + r * 1.4) continue;
        const flipped = Wd.ctrl[i] !== c.s;
        const isFort = c.t === 'fort';
        const needHex = flipped || showGrid || (!isHome && cam.s > 1100);
        if (needHex) {
          cx.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = PI / 6 + k * PI / 3;
            const px = x + r * 1.12 * Math.cos(a), py = y + r * 1.12 * Math.sin(a);
            k ? cx.lineTo(px, py) : cx.moveTo(px, py);
          }
          cx.closePath();
          if (flipped) {
            cx.fillStyle = (Wd.ctrl[i] === 0 ? me0 : en) + '44';
            cx.fill();
          } else if (!isHome) {
            cx.fillStyle = (Wd.ctrl[i] === 0 ? me0 : en) + '15';
            cx.fill();
          }
          if (showGrid) {
            cx.strokeStyle = (selD || PLAN)
              ? (light ? 'rgba(30,45,30,.22)' : 'rgba(224,181,88,.18)')
              : (light ? 'rgba(20,25,20,.08)' : 'rgba(255,255,255,.06)');
            cx.lineWidth = .6;
            cx.stroke();
          }
        }
        if (isFort && r > 7) {
          cx.font = '700 10px sans-serif'; cx.textAlign = 'center';
          cx.fillStyle = light ? 'rgba(40,35,25,.42)' : 'rgba(235,220,180,.35)';
          cx.fillText('⩚', x, y + 3);
        }
      }
      if (!isHome) {
        cx.lineCap = 'round';
        for (let i = 0; i < T.cells.length; i++) {
          if (Wd.ctrl[i] !== 0) continue;
          const ci = T.cells[i], [x1, y1] = toS(MX(ci.ll[0]), MY(ci.ll[1]));
          if (x1 < -r * 2 || x1 > W + r * 2 || y1 < -r * 2 || y1 > H + r * 2) continue;
          for (const j of Wd.cells[i].nb) {
            if (Wd.ctrl[j] !== 1) continue;
            const cj = T.cells[j], [x2, y2] = toS(MX(cj.ll[0]), MY(cj.ll[1]));
            const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
            const vx = (y1 - y2) * .33, vy = (x2 - x1) * .33;
            cx.beginPath(); cx.moveTo(mx - vx, my - vy); cx.lineTo(mx + vx, my + vy);
            cx.strokeStyle = 'rgba(255,70,40,.32)'; cx.lineWidth = 5; cx.stroke();
            cx.strokeStyle = '#ff4f36'; cx.lineWidth = 2; cx.stroke();
          }
        }
      }
      cx.restore();
    }

    // 2) الجسور (المضروبة بوضوح، والسالِمة بتقريب عالي فقط)
    if (cam.s > 1200 && Wd.bridges && Wd.bridges.length) {
      cx.save();
      cx.textAlign = 'center'; cx.textBaseline = 'middle';
      for (const br of Wd.bridges) {
        if (br.down <= 0 && cam.s < 2400) continue;
        const [x, y] = toS(MX(T.lon0 + br.p[0] / T.KX), MY(T.lat1 - br.p[1] / T.KY));
        if (x < -12 || x > W + 12 || y < -12 || y > H + 12) continue;
        if (br.down > 0) {
          cx.beginPath(); cx.arc(x, y, 6, 0, TAU); cx.fillStyle = '#c82d1a'; cx.fill();
          cx.fillStyle = '#fff'; cx.font = '700 9px sans-serif'; cx.fillText('✕', x, y + .5);
        } else {
          cx.strokeStyle = light ? 'rgba(50,45,35,.55)' : 'rgba(220,210,185,.45)';
          cx.lineWidth = 1.6;
          cx.beginPath(); cx.moveTo(x - 3.5, y - 2); cx.lineTo(x + 3.5, y - 2); cx.moveTo(x - 3.5, y + 2); cx.lineTo(x + 3.5, y + 2); cx.stroke();
        }
      }
      cx.restore();
    }

    // 3) الجو الحقيقي
    let anim = false;
    if (T.A && VIEW && T.vInit) {
      const now = performance.now(), fdt = Math.min(.1, (now - (T.lastF || now)) / 1000); T.lastF = now;
      VIEW.gs = HPS[speed] * 3600;
      VIEW.drawBases(-1);
      FX.update(speed ? fdt : 0); FX.drawGround(); VIEW.drawFx(speed ? fdt : 0); FX.draw(); VIEW.drawAir(fdt); VIEW.soundTick(fdt, Wd.battles.size);
      if (speed || (T.A.planes && T.A.planes.length) || (T.A.msls && T.A.msls.length)) anim = true;
    }

    // 4) خطط الهجوم بالأسهم
    const drawArrow = (path, col, dash) => {
      if (path.length < 2) return;
      cx.save();
      cx.beginPath();
      path.forEach((c, i) => { const cl = T.cells[c], [x, y] = toS(MX(cl.ll[0]), MY(cl.ll[1])); i ? cx.lineTo(x, y) : cx.moveTo(x, y); });
      cx.lineCap = 'round'; cx.lineJoin = 'round';
      cx.strokeStyle = 'rgba(0,0,0,.35)'; cx.lineWidth = 7; cx.stroke();
      cx.strokeStyle = col; cx.lineWidth = 4; cx.setLineDash(dash ? [8, 6] : []); cx.stroke(); cx.setLineDash([]);
      const a = T.cells[path[path.length - 2]], b = T.cells[path[path.length - 1]];
      const [ax, ay] = toS(MX(a.ll[0]), MY(a.ll[1])), [bx, by2] = toS(MX(b.ll[0]), MY(b.ll[1])), h = Math.atan2(by2 - ay, bx - ax);
      cx.beginPath(); cx.moveTo(bx, by2);
      cx.lineTo(bx - 15 * Math.cos(h - .46), by2 - 15 * Math.sin(h - .46));
      cx.lineTo(bx - 15 * Math.cos(h + .46), by2 - 15 * Math.sin(h + .46));
      cx.closePath(); cx.fillStyle = col; cx.fill();
      cx.restore();
    };
    for (const P of Wd.plans || []) if (P.side === 0 && (P.st === 'prep' || P.st === 'go')) drawArrow(P.path, P.st === 'go' ? 'rgba(255,196,46,.9)' : 'rgba(255,196,46,.55)', P.st === 'prep');
    if (PLAN) drawArrow(PLAN, 'rgba(255,232,125,.95)', true);

    // 5) المعارك النشطة: شارة ⚔ بمقياس تفوّق دائري
    for (const b of Wd.battles.values()) {
      const c = T.cells[b.tg], [x, y] = toS(MX(c.ll[0]), MY(c.ll[1]));
      if (x < -30 || x > W + 30 || y < -30 || y > H + 30) continue;
      const win = b.side === 0 ? b.win : 1 - b.win;
      const br = Math.max(10, Math.min(14, r * .55));
      cx.save();
      cx.beginPath(); cx.arc(x, y, br + 3, 0, TAU); cx.fillStyle = 'rgba(255,68,42,.22)'; cx.fill();
      cx.beginPath(); cx.arc(x, y, br, 0, TAU); cx.fillStyle = 'rgba(18,16,14,.92)'; cx.fill();
      cx.lineWidth = 3;
      cx.beginPath(); cx.arc(x, y, br, -PI / 2, -PI / 2 + TAU * win); cx.strokeStyle = '#58c472'; cx.stroke();
      cx.beginPath(); cx.arc(x, y, br, -PI / 2 + TAU * win, -PI / 2 + TAU); cx.strokeStyle = '#e84a38'; cx.stroke();
      cx.font = '700 11px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillStyle = '#fff'; cx.fillText('⚔', x, y + .5);
      cx.restore();
    }

    // 6) بطاقات الفرق الاحترافية (بسيلويت دبابة/مدرعة/مشاة حاد + حركة ناعمة + شريطي القوة والتنظيم)
    const visDivs = [...Wd.divs.filter(d => !d.dead && d.side === 0), ...SM.known(Wd, 0)];
    const by = new Map();
    for (const d of visDivs) {
      const k = d.cell * 2 + d.side;
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(d);
    }
    const cw = cam.s > 1600 ? 32 : 26, ch = cam.s > 1600 ? 22 : 18;
    const iconSc = cam.s > 1600 ? 1.0 : 0.82;

    cx.save();
    for (const [k, L] of by) {
      const i = k >> 1, s = k & 1, c = T.cells[i];
      let lon = c.ll[0], lat = c.ll[1];
      const mv = L.find(d => d.path && d.path.length && d.prog > 0 && !d.ghost);
      if (mv) {
        const nxt = T.cells[mv.path[0]];
        if (nxt) {
          const t = Math.min(.82, mv.prog);
          lon = c.ll[0] + (nxt.ll[0] - c.ll[0]) * t;
          lat = c.ll[1] + (nxt.ll[1] - c.ll[1]) * t;
        }
      }
      let [x, y] = toS(MX(lon), MY(lat));
      if (x < -30 || x > W + 30 || y < -30 || y > H + 30) continue;
      if (by.has(i * 2 + (1 - s))) x += s ? (cw * .55) : -(cw * .55);

      const top = L.slice().sort((a, b) => ({ arm: 0, mec: 1, inf: 2 })[a.kind] - ({ arm: 0, mec: 1, inf: 2 })[b.kind])[0];
      const org = L.reduce((t, d) => t + (d.org / (d.orgMax || 1)), 0) / L.length;
      const str = L.reduce((t, d) => t + (d.str ?? 1), 0) / L.length;
      const isSel = !!(selD && L.some(d => selD.includes(d)));
      const ghost = L.some(d => d.ghost);

      if (s === 0) {
        for (const d of L) if (d.path && d.path.length) {
          const tc = T.cells[d.path[d.path.length - 1]], [tx, ty] = toS(MX(tc.ll[0]), MY(tc.ll[1]));
          cx.save();
          cx.beginPath(); cx.moveTo(x, y); cx.lineTo(tx, ty);
          cx.strokeStyle = 'rgba(255,214,102,.82)'; cx.lineWidth = 1.8; cx.setLineDash([4, 3]); cx.stroke();
          cx.beginPath(); cx.arc(tx, ty, 3, 0, TAU); cx.fillStyle = '#ffd666'; cx.fill();
          cx.restore();
        }
      }

      cx.save();
      if (ghost) cx.globalAlpha = Math.max(.36, .70 - (L[0].ghost || 0) / 200);
      cx.fillStyle = 'rgba(0,0,0,.44)';
      roundRect(cx, x - cw / 2 + 1.5, y - ch / 2 + 2, cw, ch, 5); cx.fill();

      roundRect(cx, x - cw / 2, y - ch / 2, cw, ch, 5);
      cx.fillStyle = s === 0 ? '#183121' : '#3b1916';
      cx.fill();
      cx.save(); cx.clip();
      cx.fillStyle = s === 0 ? '#42ad5e' : '#df4837';
      cx.fillRect(x - cw / 2, y - ch / 2, cw, 3.5);
      cx.restore();

      roundRect(cx, x - cw / 2, y - ch / 2, cw, ch, 5);
      if (ghost) cx.setLineDash([3, 2]);
      cx.strokeStyle = isSel ? '#ffd166' : (s === 0 ? 'rgba(136,232,158,.88)' : 'rgba(248,124,106,.88)');
      cx.lineWidth = isSel ? 2.2 : 1.1;
      cx.stroke();
      cx.setLineDash([]);

      // سيلويت السلاح الحاد (دبابة / مدرعة / مشاة)
      drawUnitIcon(cx, top.kind, x, y + .2, iconSc, s === 0 ? '#eef7ef' : '#fcebe8');

      // شريطي القوة والتنظيم بأسفل البطاقة
      const bw = cw - 4, bx = x - bw / 2, by0 = y + ch / 2 - 4.2;
      cx.fillStyle = 'rgba(0,0,0,.55)'; cx.fillRect(bx, by0, bw, 3.2);
      cx.fillStyle = str > .55 ? '#6be078' : str > .3 ? '#f0be4a' : '#ff5a3c';
      cx.fillRect(bx, by0, bw * Math.max(0, Math.min(1, str)), 1.5);
      cx.fillStyle = org > .55 ? '#f5cd5b' : '#ff7b4a';
      cx.fillRect(bx, by0 + 1.7, bw * Math.max(0, Math.min(1, org)), 1.5);

      if (L.length > 1 || ghost) {
        const badge = ghost ? (L.length > 1 ? L.length + '؟' : '؟') : String(L.length);
        cx.font = '700 9px "IBM Plex Sans Arabic",Tahoma';
        const tw = Math.max(12, cx.measureText(badge).width + 5);
        roundRect(cx, x + cw / 2 - tw * .7, y - ch / 2 - 5, tw, 12, 6);
        cx.fillStyle = isSel ? '#ffd166' : (s === 0 ? '#2f8a48' : '#b83224'); cx.fill();
        cx.strokeStyle = '#0e120f'; cx.lineWidth = 1; cx.stroke();
        cx.fillStyle = isSel ? '#1c1708' : '#fff';
        cx.textAlign = 'center'; cx.textBaseline = 'middle';
        cx.fillText(badge, x + cw / 2 - tw * .2, y - ch / 2 + 1.3);
      }
      cx.restore();
    }
    cx.restore();
    return anim;
  }

  root.MAPFX = { loadTextures, initGeo, buildFrontSegs, buildLabels, drawMap, drawScaleAndCompass, drawTheater, invalidate };
})(window);
