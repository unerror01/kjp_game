/**
 * UNI-VERSE demo — campus battle scene (canvas). Purely presentational: it walks
 * the hero through a parallax campus, fights mobs, and on each kill asks the game
 * for the reward via `onKill(mob)` → { gold, exp, levels }.
 */
(function (root) {
  'use strict';

  // ---------- sprite loading: downscale + strip baked backgrounds ----------
  /**
   * Loads an image into a size×size canvas (contain-fit) and flood-fills the
   * background from the edges: low-saturation light/mid pixels (white or a
   * baked-in checkerboard) become transparent. Black outlines stop the fill.
   * Falls back to the raw image if the canvas is tainted (file://).
   * With `trim`, empty margins are cut so the figure fills the box (wide source
   * images such as the dragon and the soldier would otherwise look tiny).
   */
  function loadSprite(url, outSize, trim) {
    const size = trim ? outSize * 2 : outSize; // work at 2× so the trimmed figure stays sharp
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = true;
        const s = Math.min(size / img.width, size / img.height);
        const w = img.width * s, h = img.height * s;
        g.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        try {
          const d = g.getImageData(0, 0, size, size);
          const px = d.data;
          const bg = (i) => {
            const r = px[i], gg = px[i + 1], b = px[i + 2], a = px[i + 3];
            if (a < 20) return true;
            const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
            return mx - mn < 22 && mx > 70;
          };
          const seen = new Uint8Array(size * size);
          const stack = [];
          for (let k = 0; k < size; k++) stack.push(k, (size - 1) * size + k, k * size, k * size + size - 1);
          while (stack.length) {
            const p = stack.pop();
            if (seen[p]) continue;
            seen[p] = 1;
            if (!bg(p * 4)) continue;
            px[p * 4 + 3] = 0;
            const x = p % size, y = (p / size) | 0;
            if (x > 0) stack.push(p - 1);
            if (x < size - 1) stack.push(p + 1);
            if (y > 0) stack.push(p - size);
            if (y < size - 1) stack.push(p + size);
          }
          g.putImageData(d, 0, 0);
          resolve(trim ? trimToBox(c, px, size, outSize) : c);
        } catch (e) {
          resolve(img); // tainted canvas: draw as-is
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  /** Crops `c` (size×size, alpha in px) to its opaque bounding box, fits it into outSize, bottom-centred. */
  function trimToBox(c, px, size, outSize) {
    let x0 = size, y0 = size, x1 = -1, y1 = -1;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (px[(y * size + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    const o = document.createElement('canvas');
    o.width = o.height = outSize;
    if (x1 < 0) return o;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, k = Math.min(outSize / bw, outSize / bh);
    const g = o.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.drawImage(c, x0, y0, bw, bh, (outSize - bw * k) / 2, outSize - bh * k, bw * k, bh * k);
    return o;
  }

  // ---------- deterministic campus layout ----------
  function rand(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  const r1 = rand(7);
  const FAR_W = 720;
  const buildings = [];
  for (let x = 0; x < FAR_W;) {
    const w = 70 + Math.floor(r1() * 70);
    buildings.push({ x, w, h: 60 + Math.floor(r1() * 60), hue: r1() });
    x += w + 8 + Math.floor(r1() * 20);
  }
  const SIGN_AT = 1; // building index carrying the INU sign
  const NEAR_W = 480;
  const props = [];
  for (let x = 20; x < NEAR_W; x += 80 + Math.floor(r1() * 60)) props.push({ x, kind: r1() < 0.6 ? 'tree' : 'lamp' });

  function create(canvas, opts) {
    const D = opts.data.battle;
    const ctx = canvas.getContext('2d');
    let W = 360, H = D.sceneHeight, dpr = 1, scale = 1;
    let heroFrames = [], mobSprites = {}, bossSprites = {};
    let scroll = 0, t = 0, last = 0, raf = 0;
    let mob = null, gap = 60;
    let hitT = 0, lunge = 0, haste = 0, hasteMult = 1, bossT = 0, castLabel = null;
    const cooldowns = {};       // skill id -> seconds left
    const pendingHits = [];     // { at, dmg, fx } queued multi-hit damage
    const projectiles = [];     // { fx, x0, y0, t, dur, dmg } flying nuke skills
    const bursts = [];          // { fx, x, y, life, max, size, ring } hit effects
    const floats = [];
    let heroHp = null, down = 0, mobAtkT = 0, banner = null, shakeT = 0, flashT = 0, petSprite = null;
    const particles = [];       // { x, y, vx, vy, life, max, color, size, shape }
    const beams = [];           // { life, max, color } hero→mob laser

    /** Class-themed particle spray at (x, y). */
    function spray(x, y, n, speed, sizeMul) {
      const th = opts.classFx();
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.8);
        const life = 0.35 + Math.random() * 0.4;
        particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, life, max: life,
          color: th.colors[i % th.colors.length], size: (3 + Math.random() * 4) * (sizeMul || 1), shape: th.shape });
      }
    }

    /** Logical world is sceneHeight tall; on tall screens (PC) it is scaled up uniformly. */
    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const cssW = canvas.clientWidth || 360;
      const cssH = canvas.clientHeight || D.sceneHeight;
      scale = cssH / D.sceneHeight;
      W = cssW / scale;
      canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    }

    function spawn() {
      const m = opts.nextMob(); // { def, boss, hp }
      mob = { def: m.def, boss: m.boss, x: W + 40, hp: m.hp, max: m.hp, flash: 0, dying: 0,
              size: (m.boss ? D.bossSize : D.mobSize) * (m.def.scale || 1) };
      mob.atk = m.atk;
      mob.siege = m.siege || null;
      mobAtkT = 0;
      bossT = m.boss ? (m.timeLimit || opts.data.combat.bossTimeLimit) : 0;
      mob.timeLimit = bossT;
      if (m.boss) { banner = { title: m.bannerTitle || '⚠ BOSS 등장 ⚠', name: m.def.name, life: 2.4 }; shakeT = 0.5; }
    }

    function fmtN(n) { return Math.floor(n).toLocaleString('ko-KR'); }

    /** Applies damage with a crit roll. Crits show bigger orange numbers. */
    function damage(dmg, big) {
      if (!mob || mob.dying > 0) return;
      const c = opts.heroCrit();
      const crit = Math.random() < c.rate;
      if (crit) dmg *= c.mult;
      mob.hp -= dmg; mob.flash = 0.12;
      const x = mob.x + mob.size / 2 + (Math.random() - 0.5) * 30, y = H - 40 - mob.size;
      if (crit) { float('CRIT ' + fmtN(dmg), x, y - 8, '#ff7a1a', true); shakeT = Math.max(shakeT, 0.08); }
      else float(fmtN(dmg), x, y, big ? '#ffd84a' : '#ffffff', big);
      if (mob.hp <= 0) kill();
    }

    function clearAttacks() { pendingHits.length = 0; projectiles.length = 0; }

    /** Big impact: emoji burst, particle explosion, flash and shake. */
    function impact(fx, x, y, big) {
      if (big) { burst(fx, x, y, 96, true); spray(x, y, 70, 300, 2); shakeT = 0.25; flashT = 0.12; }
      else { burst(fx, x, y, 44, false); spray(x, y, 22, 200, 1.6); shakeT = Math.max(shakeT, 0.06); }
    }

    // ---------- skill-specific animations ----------
    // Each anim(s, r, c) schedules visuals in `effects` and damage in `pendingHits`.
    // s = skill (fx emoji, name), r.hits = per-hit damage, c = mob centre at cast.
    const effects = [];         // { t, dur, draw(k, t) }
    let heroHideT = 0, curHero = null;

    function fxAdd(dur, draw) { effects.push({ t: 0, dur, draw }); }
    function hitAt(at, dmg, big, fx, x, y) { pendingHits.push({ at, dmg, big, fx, x, y }); }
    function heroCenter() { return { x: D.heroX + D.heroSize / 2, y: H - 34 - D.heroSize / 2 }; }
    function emoji(ch, x, y, size, rot, alpha) {
      ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.translate(x, y); if (rot) ctx.rotate(rot);
      ctx.font = Math.round(size) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ch, 0, 0); ctx.restore();
    }
    function ghost(x, y, alpha, hue) { if (curHero) drawSprite(curHero, x, y, D.heroSize, alpha, 0, hue); }
    function ring(x, y, r, color, w, alpha) {
      ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = w;
      ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
    function slashLine(x0, y0, x1, y1, color, w, alpha) {
      ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, w / 3);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.globalAlpha = 1;
    }
    const lerp = (a, b, k) => a + (b - a) * k;

    const ANIMS = {
      // ===== 초인싸 =====
      /** 깃발 휘두르기: a giant flag sweeps in front of the hero. */
      swing(s, r, c) {
        const h = heroCenter();
        fxAdd(0.4, (k) => {
          const a = lerp(-1.6, 1.1, Math.min(1, k * 1.4)), len = 90;
          const tx = h.x + 20 + Math.cos(a) * len, ty = h.y + Math.sin(a) * len;
          ctx.globalAlpha = 0.35; ctx.strokeStyle = '#4aa8ff'; ctx.lineWidth = 18;
          ctx.beginPath(); ctx.arc(h.x + 20, h.y, len, -1.6, a); ctx.stroke(); ctx.globalAlpha = 1;
          ctx.strokeStyle = '#e8ecff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(h.x + 20, h.y); ctx.lineTo(tx, ty); ctx.stroke();
          emoji('🚩', tx, ty, 44, a + 1.6);
        });
        hitAt(0.22, r.hits[0], true, '⭐', c.x, c.y);
      },
      /** 단톡방 소환: chat bubbles pop around the mob, each one a hit. */
      bubbles(s, r, c) {
        const words = ['ㅋㅋ', '!!', 'ㄱㄱ', '@@', '출첵', '팀플?'];
        r.hits.forEach((d, i) => {
          const x = c.x + (Math.random() - 0.5) * 110, y = c.y - 30 - Math.random() * 60, at = 0.08 + i * 0.12, w = words[i % words.length];
          fxAdd(at + 0.25, (k, t) => {
            if (t < at - 0.12) return;
            const g = Math.min(1, (t - (at - 0.12)) / 0.12), pop = t > at ? 1 - (t - at) / 0.13 : 1;
            if (pop <= 0) return;
            ctx.globalAlpha = pop; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#123a8c'; ctx.lineWidth = 3;
            const bw = 46 * g, bh = 28 * g;
            ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh); ctx.strokeRect(x - bw / 2, y - bh / 2, bw, bh);
            ctx.beginPath(); ctx.moveTo(x - 6, y + bh / 2); ctx.lineTo(x, y + bh / 2 + 9 * g); ctx.lineTo(x + 6, y + bh / 2); ctx.fill();
            ctx.fillStyle = '#123a8c'; ctx.font = 'bold ' + Math.round(13 * g) + 'px Galmuri11, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(w, x, y); ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
          });
          hitAt(at, d, false, '💬', x, y);
        });
      },
      /** 인싸력 폭발: rainbow shockwaves from the hero and confetti everywhere. */
      shockwave(s, r, c) {
        const h = heroCenter();
        fxAdd(0.8, (k) => {
          ['#ff5a9a', '#ffd84a', '#4aa8ff'].forEach((col, i) => ring(h.x, h.y, (k - i * 0.1) * W * 1.1, col, 10 - i * 2, Math.max(0, 1 - k)));
          if (k < 0.5) emoji('🎉', h.x, h.y - 50, 40 + k * 60, 0, 1 - k * 2);
        });
        for (let i = 0; i < 6; i++) spray(Math.random() * W, 20 + Math.random() * 60, 10, 160, 1.3);
        flashT = 0.1;
        hitAt(0.3, r.hits[0], true, '🎉', c.x, c.y);
      },

      // ===== 은둔형 =====
      /** 노트북 단검: two daggers flung straight and fast. */
      daggers(s, r, c) {
        const h = heroCenter();
        r.hits.forEach((d, i) => {
          const y = c.y + (i ? 10 : -10), t0 = i * 0.1;
          fxAdd(t0 + 0.16, (k, t) => {
            if (t < t0) return;
            const kk = Math.min(1, (t - t0) / 0.16), x = lerp(h.x + 20, c.x, kk);
            slashLine(x - 40, y, x - 6, y, '#7b4bff', 4, 0.5);
            emoji('🗡️', x, y, 32, Math.PI / 4);
          });
          hitAt(t0 + 0.16, d, false, '✖', c.x, y);
        });
      },
      /** 그림자 습격: the hero vanishes and strikes from behind the mob. */
      blink(s, r, c) {
        heroHideT = 0.55;
        const bx = mob.x + mob.size * 0.7, by = H - 34 - D.heroSize;
        fxAdd(0.55, (k) => {
          const a = k < 0.25 ? k / 0.25 : k > 0.7 ? (1 - k) / 0.3 : 1;
          ctx.fillStyle = 'rgba(30,10,60,' + 0.5 * a + ')'; ctx.beginPath(); ctx.ellipse(bx + D.heroSize / 2, H - 32, 40, 8, 0, 0, Math.PI * 2); ctx.fill();
          ghost(bx, by, 0.85 * a, 250);
          if (k > 0.3 && k < 0.6) {
            const q = (k - 0.3) / 0.3;
            slashLine(c.x + 40, c.y - 40, lerp(c.x + 40, c.x - 40, q), lerp(c.y - 40, c.y + 40, q), '#7b4bff', 8, 1);
            slashLine(c.x - 40, c.y - 40, lerp(c.x - 40, c.x + 40, q), lerp(c.y - 40, c.y + 40, q), '#c6b3ff', 8, 1);
          }
        });
        hitAt(0.32, r.hits[0], true, '🌙', c.x, c.y);
      },
      /** 심야의 암살: the screen goes dark and a crescent cuts through. */
      eclipse(s, r, c) {
        fxAdd(0.9, (k) => {
          const dark = k < 0.3 ? k / 0.3 : k > 0.75 ? (1 - k) / 0.25 : 1;
          ctx.fillStyle = 'rgba(8,4,30,' + 0.65 * dark + ')'; ctx.fillRect(-10, -10, W + 20, H + 20);
          emoji('🌑', W * 0.75, 50, 46, 0, dark);
          if (k > 0.35 && k < 0.75) {
            const q = (k - 0.35) / 0.4;
            ctx.globalAlpha = 1 - q * 0.6; ctx.strokeStyle = '#e8e0ff'; ctx.lineWidth = 12;
            ctx.beginPath(); ctx.arc(c.x - 30, c.y, 70, -1.2 + q * 0.4, 1.2 + q * 0.4); ctx.stroke();
            ctx.strokeStyle = '#7b4bff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(c.x - 22, c.y, 60, -1.1 + q * 0.4, 1.1 + q * 0.4); ctx.stroke();
            ctx.globalAlpha = 1;
          }
        });
        hitAt(0.5, r.hits[0], true, '🌙', c.x, c.y);
      },

      // ===== 벼락치기 =====
      /** 연필검 내려찍기: a giant pencil slams down point-first. */
      slam(s, r, c) {
        fxAdd(0.45, (k) => {
          const q = Math.min(1, k / 0.75), y = lerp(-60, c.y - 10, q * q);
          emoji('✏️', c.x, y, 90, Math.PI * 0.75);
          if (k > 0.75) ring(c.x, H - 34, (k - 0.75) * 400, '#ffe14a', 6, (1 - k) * 4);
        });
        hitAt(0.34, r.hits[0], true, '💥', c.x, H - 50);
      },
      /** 벼락치기 연타: lightning bolts strike the mob from the sky. */
      lightning(s, r, c) {
        r.hits.forEach((d, i) => {
          const at = 0.05 + i * 0.09, x = c.x + (Math.random() - 0.5) * 60;
          const pts = []; let px = x + (Math.random() - 0.5) * 40;
          for (let yy = -10; yy < c.y; yy += 22) { pts.push([px, yy]); px += (Math.random() - 0.5) * 30; }
          pts.push([x, c.y]);
          fxAdd(at + 0.14, (k, t) => {
            if (t < at) return;
            const a = 1 - (t - at) / 0.14;
            ctx.globalAlpha = a; ctx.lineJoin = 'round';
            ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 7; ctx.beginPath(); pts.forEach(([u, v], j) => j ? ctx.lineTo(u, v) : ctx.moveTo(u, v)); ctx.stroke();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
          });
          hitAt(at, d, false, '⚡', x, c.y);
        });
        flashT = 0.06;
      },
      /** 데드라인 폭발: a pillar of fire erupts under the mob. */
      eruption(s, r, c) {
        fxAdd(0.75, (k) => {
          const hgt = (k < 0.3 ? k / 0.3 : 1) * (H - 20), a = k > 0.6 ? (1 - k) / 0.4 : 1;
          const g = ctx.createLinearGradient(0, H - 34, 0, H - 34 - hgt);
          g.addColorStop(0, 'rgba(255,225,74,' + a + ')'); g.addColorStop(0.5, 'rgba(255,90,26,' + a + ')'); g.addColorStop(1, 'rgba(255,58,26,0)');
          ctx.fillStyle = g; const w = 70 + Math.sin(k * 40) * 8;
          ctx.fillRect(c.x - w / 2, H - 34 - hgt, w, hgt);
          for (let i = 0; i < 4; i++) emoji('🔥', c.x + (i - 1.5) * 22, H - 50 - ((k * 300 + i * 40) % hgt), 28, 0, a);
        });
        shakeT = 0.4;
        hitAt(0.28, r.hits[0], true, '🔥', c.x, c.y);
      },

      // ===== 계획형 =====
      /** 플래너 방패 강타: the hero charges shield-first into the mob. */
      shieldbash(s, r, c) {
        heroHideT = 0.35;
        const h = heroCenter();
        fxAdd(0.35, (k) => {
          const q = k < 0.5 ? k / 0.5 : 1 - (k - 0.5) / 0.5, x = lerp(D.heroX, mob ? mob.x - D.heroSize * 0.6 : c.x, q);
          for (let j = 1; j <= 3; j++) ghost(x - j * 18 * q, H - 34 - D.heroSize, 0.15, 0);
          ghost(x, H - 34 - D.heroSize, 1, 0);
          emoji('🛡️', x + D.heroSize * 0.85, h.y, 44);
        });
        hitAt(0.17, r.hits[0], true, '🛡️', c.x - 20, c.y);
      },
      /** 체크리스트 연격: check marks stamp onto the mob one by one. */
      stamps(s, r, c) {
        r.hits.forEach((d, i) => {
          const x = c.x + ((i % 2) - 0.5) * 50, y = c.y + (Math.floor(i / 2) - 0.5) * 44, at = 0.1 + i * 0.13;
          fxAdd(at + 0.45, (k, t) => {
            if (t < at - 0.1) return;
            const q = Math.min(1, (t - (at - 0.1)) / 0.1), z = lerp(70, 34, q), a = t > at + 0.25 ? 1 - (t - at - 0.25) / 0.2 : 1;
            ctx.globalAlpha = Math.max(0, a); ctx.strokeStyle = '#3ee07a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
            ctx.strokeRect(x - z / 2, y - z / 2, z, z);
            ctx.beginPath(); ctx.moveTo(x - z * 0.3, y); ctx.lineTo(x - z * 0.05, y + z * 0.25); ctx.lineTo(x + z * 0.35, y - z * 0.3); ctx.stroke();
            ctx.globalAlpha = 1;
          });
          hitAt(at, d, false, '✅', x, y);
        });
      },
      /** 완벽한 타임라인: a golden clock spins over the hero (attack speed buff). */
      aura(s, r, c) {
        const dur = (r.haste && r.haste.dur) || 3;
        fxAdd(dur, (k, t) => {
          const h = heroCenter(), a = t < 0.3 ? t / 0.3 : k > 0.9 ? (1 - k) * 10 : 0.9, y = h.y - D.heroSize * 0.85;
          ring(h.x, y, 22, '#ffd84a', 4, a);
          ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(h.x, y); ctx.lineTo(h.x + Math.cos(t * 12) * 16, y + Math.sin(t * 12) * 16); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(h.x, y); ctx.lineTo(h.x + Math.cos(t * 1.5) * 10, y + Math.sin(t * 1.5) * 10); ctx.stroke();
          ctx.globalAlpha = 1;
          ring(h.x, h.y, D.heroSize * 0.6 + Math.sin(t * 8) * 4, '#ffd84a', 3, a * 0.6);
        });
        const h = heroCenter(); burst('⏰', h.x, h.y - 40, 46, true);
      },

      // ===== 출튀 =====
      /** 출튀 대시: the hero dashes through the mob leaving afterimages. */
      dashthrough(s, r, c) {
        heroHideT = 0.5;
        const x0 = D.heroX, x1 = (mob ? mob.x + mob.size : c.x + 60) + 10, y = H - 34 - D.heroSize;
        fxAdd(0.5, (k) => {
          const q = k < 0.55 ? k / 0.55 : 1 - (k - 0.55) / 0.45, x = lerp(x0, x1, q);
          for (let j = 1; j <= 4; j++) ghost(x - j * 26 * Math.sign(k < 0.55 ? 1 : -1), y, 0.4 - j * 0.08, 0);
          ghost(x, y, 1, 0);
          if (k < 0.55) slashLine(x0 + D.heroSize, c.y, x + D.heroSize * 0.6, c.y, '#5af0ff', 6, 0.6);
        });
        r.hits.forEach((d, i) => hitAt(0.12 + i * 0.07, d, false, '💨', c.x + (i - 1) * 16, c.y + (i - 1) * 10));
      },
      /** 분신 난무: clones pop up around the mob, strike once each and vanish. */
      clones(s, r, c) {
        const n = r.hits.length;
        r.hits.forEach((d, i) => {
          const ang = Math.PI + (i / Math.max(1, n - 1) - 0.5) * Math.PI * 1.4;
          const sx = c.x + Math.cos(ang) * 95 - D.heroSize / 2, sy = c.y + Math.sin(ang) * 55 - D.heroSize / 2 - 10;
          const t0 = i * 0.08;
          fxAdd(t0 + 0.42, (k, t) => {
            if (t < t0) return;
            const u = t - t0;
            const a = u < 0.08 ? u / 0.08 : u > 0.3 ? Math.max(0, 1 - (u - 0.3) / 0.12) : 1;
            const lungeK = u > 0.1 && u < 0.2 ? (u - 0.1) / 0.1 : u >= 0.2 ? 1 - Math.min(1, (u - 0.2) / 0.1) : 0;
            const gx = lerp(sx, c.x - D.heroSize / 2, lungeK * 0.5), gy = lerp(sy, c.y - D.heroSize / 2, lungeK * 0.5);
            if (u < 0.08) ring(sx + D.heroSize / 2, sy + D.heroSize / 2, 30 * (1 - u / 0.08), '#5af0ff', 3, 1);
            ring(gx + D.heroSize / 2, gy + D.heroSize / 2, D.heroSize * 0.45, '#5af0ff', 3, 0.6 * a);
            ghost(gx, gy, 0.8 * a, 0);
            if (u > 0.16 && u < 0.26) slashLine(gx + D.heroSize / 2, gy + D.heroSize / 2, c.x, c.y, '#5af0ff', 5, 1);
            if (u > 0.3 && u < 0.42) spray(gx + D.heroSize / 2, gy + D.heroSize / 2, 1, 60, 0.8);
          });
          hitAt(t0 + 0.18, d, false, '👤', c.x + (Math.random() - 0.5) * 30, c.y + (Math.random() - 0.5) * 30);
        });
      },
      /** 혜성 강하: a blazing comet streaks down from the sky and craters the mob. */
      comet(s, r, c) {
        const sx = W + 60, sy = -80, land = 0.5;
        fxAdd(0.95, (k, t) => {
          if (t < land) {
            const q = t / land, x = lerp(sx, c.x, q * q), y = lerp(sy, c.y, q * q);
            const tx = x + (sx - c.x) * 0.35, ty = y + (sy - c.y) * 0.35;
            const g = ctx.createLinearGradient(x, y, tx, ty);
            g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.3, 'rgba(90,240,255,0.8)'); g.addColorStop(1, 'rgba(58,123,255,0)');
            ctx.strokeStyle = g; ctx.lineWidth = 26; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
            ring(x, y, 22, '#5af0ff', 6, 0.9);
            spray(x, y, 2, 40, 1.2);
          } else {
            const q = (t - land) / (0.95 - land);
            ring(c.x, H - 34, q * 220, '#5af0ff', 10, 1 - q);
            ring(c.x, H - 34, q * 140, '#ffffff', 6, 1 - q);
            ctx.fillStyle = 'rgba(40,30,20,' + 0.5 * (1 - q) + ')'; ctx.beginPath(); ctx.ellipse(c.x, H - 30, 60, 10, 0, 0, Math.PI * 2); ctx.fill();
          }
        });
        pendingHits.push({ at: land, dmg: r.hits[0], big: true, fx: '☄️', x: c.x, y: c.y, after: () => { flashT = 0.16; shakeT = 0.45; spray(c.x, H - 40, 40, 320, 1.8); } });
      }
    };

    function burst(fx, x, y, size, ring) { bursts.push({ fx, x, y, size, ring, life: 0.45, max: 0.45 }); }

    function mobCenter() { return { x: mob.x + mob.size / 2, y: H - 34 - mob.size / 2 }; }

    /** Hero HP hit 0: lose the fight, respawn after a short stun. */
    function heroDown() {
      down = opts.data.combat.respawnSec;
      clearAttacks(); heroHideT = 0;
      float('기절…', D.heroX + D.heroSize / 2, H - 60 - D.heroSize, '#ff5a6a', true);
      if (mob && mob.dying <= 0) {
        if (mob.boss) { opts.onBossFail(mob); float('보스전 패배…', W / 2, 80, '#ff5a6a', true); }
        else opts.onHeroDown(mob);
        mob.dying = 0.5; mob.fled = true;
      }
    }

    function kill() {
      mob.hp = 0; mob.dying = 0.5; clearAttacks();
      const r = opts.onKill(mob);
      const cx = mob.x + mob.size / 2, top = H - 44 - mob.size;
      float('+' + fmtN(r.gold) + ' G', cx, top - 4, '#ffd84a', true);
      float('+' + fmtN(r.exp) + ' EXP', cx, top + 14, '#5af0a8', true);
      if (r.levels) float('LEVEL UP!', D.heroX + D.heroSize / 2, H - 50 - D.heroSize, '#ff9a3c', true);
      if (r.roundCleared) float('ROUND ' + r.round, W / 2, 70, '#ffffff', true);
    }

    /** Auto-casts every ready, unlocked skill while fighting. */
    function castSkills(dt) {
      for (const id in cooldowns) cooldowns[id] = Math.max(0, cooldowns[id] - dt);
      if (!mob || mob.dying > 0 || mob.x - D.heroX > D.engageDistance) return;
      for (const s of opts.skills()) {
        if (!s.unlocked || (cooldowns[s.id] || 0) > 0) continue;
        cooldowns[s.id] = s.cd;
        castLabel = { text: s.name, life: 1 };
        lunge = 0.2;
        const r = opts.castSkill(s.id);
        const hx = D.heroX + D.heroSize, hy = H - 34 - D.heroSize / 2;
        if (r.haste) { haste = r.haste.dur; hasteMult = r.haste.mult; burst(s.fx, D.heroX + D.heroSize / 2, hy, 46, true); }
        const c = mobCenter();
        const anim = s.anim || (s.type === 'nuke' ? 'projectile' : 'slashes');
        if (ANIMS[anim]) {
          ANIMS[anim](s, r, c);
        } else if (anim === 'projectile') {
          projectiles.push({ fx: s.fx, x0: hx, y0: hy, x1: c.x, y1: c.y, t: 0, dur: 0.28, dmg: r.hits[0], big: true, arc: 30 });
        } else if (anim === 'meteor') {
          projectiles.push({ fx: s.fx, x0: c.x + 70, y0: -30, x1: c.x, y1: c.y, t: -0.1, dur: 0.38, dmg: r.hits[0], big: true, arc: 0, size: 54 });
          float('!', c.x, 40, '#ff3a50', true);
        } else if (anim === 'beam') {
          beams.push({ life: 0.45, max: 0.45 });
          pendingHits.push({ at: 0.15, dmg: r.hits[0], fx: s.fx, big: true });
        } else if (anim === 'summon') {
          r.hits.forEach((d, i) => projectiles.push({ ghost: true, fx: s.fx, x0: D.heroX, y0: H - 34 - D.heroSize, x1: c.x - D.heroSize / 2, y1: H - 34 - D.heroSize,
            t: -i * 0.1, dur: 0.22, dmg: d, big: false, arc: 0 }));
        } else if (anim === 'rain') {
          r.hits.forEach((d, i) => {
            const x = c.x + (Math.random() - 0.5) * mob.size * 0.8;
            projectiles.push({ fx: s.fx, x0: x, y0: -20, x1: x, y1: c.y + (Math.random() - 0.5) * 20, t: -i * 0.1, dur: 0.3, dmg: d, big: false, arc: 0, size: 26 });
          });
        } else if (anim === 'slashes') {
          r.hits.forEach((d, i) => pendingHits.push({ at: 0.08 + i * 0.09, dmg: d, fx: s.fx }));
        }
        break; // one skill per frame
      }
    }

    function float(text, x, y, color, big) {
      floats.push({ text, x, y, color, big, life: 1.4 });
    }

    // ---------- drawing ----------
    function sky() {
      const h = new Date().getHours();
      const night = h < 6 || h >= 19;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      if (night) { g.addColorStop(0, '#0b1240'); g.addColorStop(1, '#2a2f6e'); }
      else { g.addColorStop(0, '#6ec3ff'); g.addColorStop(1, '#c9ecff'); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (night) {
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 30; i++) ctx.fillRect((i * 97 + 13) % W, (i * 53) % (H * 0.5), 2, 2);
        ctx.fillStyle = '#ffe9a0'; ctx.fillRect(W - 60, 20, 22, 22);
      } else {
        ctx.fillStyle = '#fff6';
        const cx = -(scroll * 0.08) % 300;
        for (let x = cx + 40; x < W + 300; x += 300) {
          ctx.fillRect(x, 26, 60, 12); ctx.fillRect(x + 12, 18, 36, 10);
        }
      }
      return night;
    }

    function farLayer(night) {
      const base = H - 46;
      const off = -(scroll * 0.25) % FAR_W;
      for (let rep = 0; rep < Math.ceil(W / FAR_W) + 1; rep++) {
        for (let i = 0; i < buildings.length; i++) {
          const b = buildings[i];
          const x = Math.floor(off + rep * FAR_W + b.x);
          if (x > W || x + b.w < 0) continue;
          const y = base - b.h;
          ctx.fillStyle = night ? '#2c3570' : (b.hue < 0.5 ? '#9fb4d8' : '#b7c3db');
          ctx.fillRect(x, y, b.w, b.h);
          ctx.fillStyle = night ? '#1d2558' : '#7f93bb';
          ctx.fillRect(x, y, b.w, 4);
          for (let wy = y + 10; wy < base - 10; wy += 14) {
            for (let wx = x + 8; wx < x + b.w - 10; wx += 14) {
              ctx.fillStyle = night ? ((wx + wy) % 3 ? '#ffe28a' : '#3a447e') : '#e8f4ff';
              ctx.fillRect(wx, wy, 7, 8);
            }
          }
          if (i === SIGN_AT) {
            ctx.fillStyle = '#123a8c'; ctx.fillRect(x + b.w / 2 - 22, y - 16, 44, 14);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Galmuri11, sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('INU', x + b.w / 2, y - 5);
          }
        }
      }
    }

    function nearLayer(night) {
      const base = H - 40;
      const off = -(scroll * 0.6) % NEAR_W;
      for (let rep = 0; rep < Math.ceil(W / NEAR_W) + 1; rep++) {
        for (const p of props) {
          const x = Math.floor(off + rep * NEAR_W + p.x);
          if (x > W + 30 || x < -30) continue;
          if (p.kind === 'tree') {
            ctx.fillStyle = '#6b4a2b'; ctx.fillRect(x - 3, base - 26, 6, 26);
            ctx.fillStyle = night ? '#1f5a3a' : '#3fae5a';
            ctx.fillRect(x - 16, base - 52, 32, 28); ctx.fillRect(x - 10, base - 62, 20, 12);
            ctx.fillStyle = night ? '#2a7048' : '#5cd174'; ctx.fillRect(x - 12, base - 50, 10, 8);
          } else {
            ctx.fillStyle = '#39405e'; ctx.fillRect(x - 2, base - 50, 4, 50);
            ctx.fillStyle = night ? '#ffe28a' : '#d9dde8'; ctx.fillRect(x - 6, base - 56, 12, 8);
          }
        }
      }
    }

    function ground() {
      const y = H - 40;
      ctx.fillStyle = '#5fbf4f'; ctx.fillRect(0, y, W, 6);
      ctx.fillStyle = '#c98f5c'; ctx.fillRect(0, y + 6, W, 34);
      ctx.fillStyle = '#a8703f';
      const off = -scroll % 32;
      for (let x = off; x < W; x += 32) { ctx.fillRect(x, y + 6, 2, 34); ctx.fillRect(x + 16, y + 23, 2, 17); }
      ctx.fillRect(0, y + 22, W, 2);
    }

    function drawSprite(sp, x, y, size, alpha, flash, hue) {
      if (!sp) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.imageSmoothingEnabled = false;
      const f = [];
      if (hue) f.push('hue-rotate(' + hue + 'deg)');
      if (flash > 0) f.push('brightness(2.2)');
      if (f.length) ctx.filter = f.join(' ');
      ctx.drawImage(sp, x, y, size, size);
      ctx.restore();
    }

    function shadow(cx, w) {
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath(); ctx.ellipse(cx, H - 32, w / 2, 5, 0, 0, Math.PI * 2); ctx.fill();
    }

    function frame(ts) {
      const dt = Math.min(0.05, (ts - last) / 1000 || 0);
      last = ts; t += dt;
      const C = opts.data.combat;
      const maxHp = opts.heroMaxHp();
      if (heroHp === null || heroHp > maxHp) heroHp = maxHp;
      const engaged = !!(mob && mob.dying <= 0 && mob.x - D.heroX <= D.engageDistance);
      const walking = !engaged && down <= 0;

      // world update
      if (down > 0) {
        down -= dt;
        if (down <= 0) { heroHp = maxHp; float('부활!', D.heroX + D.heroSize / 2, H - 60 - D.heroSize, '#5af0a8', true); }
      } else if (walking && !(mob && mob.dying > 0)) {
        scroll += D.walkSpeed * dt;
        heroHp = Math.min(maxHp, heroHp + maxHp * C.heroRegenPerSec * dt);
        if (mob) mob.x -= D.walkSpeed * dt;
        else if ((gap -= D.walkSpeed * dt) <= 0) spawn();
      } else if (engaged) {
        hitT += dt * (haste > 0 ? hasteMult : 1) * opts.heroAspd();
        if (hitT >= D.hitInterval) {
          hitT = 0; lunge = 0.14;
          if (mob) { const c = mobCenter(); spray(c.x - mob.size * 0.2, c.y, 16, 170, 1.4); burst("", c.x - mob.size * 0.2, c.y, 26, true); }
          damage(opts.heroAtk() * (0.9 + Math.random() * 0.2), false);
        }
        // mob hits back
        if (mob && mob.dying <= 0) {
          mobAtkT += dt;
          if (mobAtkT >= C.mobAtkInterval) {
            mobAtkT = 0; mob.lunge = 0.15;
            const d = mob.atk * (0.85 + Math.random() * 0.3);
            heroHp -= d;
            float('-' + fmtN(d), D.heroX + D.heroSize / 2, H - 44 - D.heroSize, '#ff5a6a', false);
            if (heroHp <= 0) { heroHp = 0; heroDown(); }
          }
        }
        if (mob && mob.boss && mob.dying <= 0) {
          bossT -= dt;
          if (bossT <= 0) {
            opts.onBossFail(mob);
            float('시간 초과… 보스 대기로 복귀', W / 2, 80, '#ff5a6a', true);
            mob.dying = 0.5; mob.fled = true; clearAttacks();
          }
        }
      }
      // flying nukes
      // iterate a snapshot: a killing hit calls clearAttacks(), which empties the list
      for (const p of projectiles.slice()) {
        if (!projectiles.includes(p)) continue;
        p.t += dt;
        if (p.t < 0) continue;
        if (!p.ghost) { const k = Math.min(1, p.t / p.dur); spray(p.x0 + (p.x1 - p.x0) * k, p.y0 + (p.y1 - p.y0) * k - Math.sin(k * Math.PI) * (p.arc || 0), p.big ? 5 : 2, 50, p.big ? 1.3 : 0.8); }
        if (p.t >= p.dur) {
          projectiles.splice(projectiles.indexOf(p), 1);
          if (mob && mob.dying <= 0) {
            const c = mobCenter();
            impact(p.fx, p.ghost ? c.x + (Math.random() - 0.5) * 20 : p.x1, p.ghost ? c.y : p.y1, p.big);
          }
          damage(p.dmg, true);
        }
      }
      // queued multi hits
      for (const h of pendingHits) h.at -= dt;
      const ready = pendingHits.filter(h => h.at <= 0);
      for (const h of ready) pendingHits.splice(pendingHits.indexOf(h), 1);
      for (const h of ready) {
        if (mob && mob.dying <= 0) {
          const c = mobCenter();
          const px = h.x != null ? h.x : h.big ? c.x : c.x + (Math.random() - 0.5) * mob.size * 0.6;
          const py = h.y != null ? h.y : h.big ? c.y : c.y + (Math.random() - 0.5) * mob.size * 0.5;
          impact(h.fx, px, py, !!h.big);
          if (h.after) h.after();
        }
        damage(h.dmg, true);
      }
      for (let i = beams.length - 1; i >= 0; i--) { beams[i].life -= dt; if (beams[i].life <= 0) beams.splice(i, 1); }
      if (down <= 0) castSkills(dt);
      haste = Math.max(0, haste - dt);
      if (mob && mob.dying > 0) {
        mob.dying -= dt;
        if (mob.fled) mob.x += 160 * dt;
        if (mob.dying <= 0) { mob = null; gap = 40 + Math.random() * 60; }
      }
      if (mob) { mob.flash = Math.max(0, mob.flash - dt); mob.lunge = Math.max(0, (mob.lunge || 0) - dt); }
      lunge = Math.max(0, lunge - dt);
      shakeT = Math.max(0, shakeT - dt);
      flashT = Math.max(0, flashT - dt);

      // draw
      const sx = shakeT > 0 ? (Math.random() - 0.5) * 8 : 0, sy = shakeT > 0 ? (Math.random() - 0.5) * 6 : 0;
      const k = dpr * scale;
      ctx.setTransform(k, 0, 0, k, sx * k, sy * k);
      const night = sky();
      farLayer(night);
      nearLayer(night);
      ground();

      const fighting = engaged;
      const bob = walking ? Math.abs(Math.sin(t * 9)) * 5 : 0;
      const hx = D.heroX + (lunge > 0 ? 12 : 0);
      const hs = D.heroSize;
      if (petSprite) {
        const px = hx - 30, py = H - 34 - hs * 0.9 + Math.sin(t * 3) * 6;
        drawSprite(petSprite, px, py, 46, down > 0 ? 0.4 : 1, 0);
        if (Math.random() < dt * 4) particles.push({ x: px + 23 + (Math.random() - 0.5) * 30, y: py + 10, vx: 0, vy: -20, life: 0.6, max: 0.6, color: '#ffe68a', size: 3, shape: 'star' });
      }
      shadow(hx + hs / 2, hs * 0.6);
      const hf = heroFrames.length ? heroFrames[Math.floor(t * 6) % heroFrames.length] : null;
      curHero = hf;
      if (haste > 0) {
        ctx.fillStyle = 'rgba(255,216,74,' + (0.25 + 0.15 * Math.sin(t * 20)) + ')';
        ctx.beginPath(); ctx.ellipse(hx + hs / 2, H - 34 - hs / 2, hs * 0.55, hs * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      }
      heroHideT = Math.max(0, heroHideT - dt);
      const blink = heroHideT > 0 ? 0 : down > 0 ? (Math.floor(t * 10) % 2 ? 0.25 : 0.6) : 1;
      drawSprite(hf, hx, H - 34 - hs - bob, hs, blink, 0);
      // hero HP bar
      {
        const bw = hs * 0.8, bx = hx + hs * 0.1, by = H - 30 - hs - 8;
        ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, by - 1, bw + 2, 7);
        const f = maxHp ? heroHp / maxHp : 0;
        ctx.fillStyle = f > 0.5 ? '#3ee07a' : f > 0.25 ? '#ffd84a' : '#ff5a6a'; ctx.fillRect(bx, by, bw * f, 5);
        ctx.font = '9px Galmuri11, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#000';
        ctx.fillText('HP ' + fmtN(heroHp) + '/' + fmtN(maxHp), bx + bw / 2 + 1, by - 2);
        ctx.fillStyle = '#fff'; ctx.fillText('HP ' + fmtN(heroHp) + '/' + fmtN(maxHp), bx + bw / 2, by - 3);
      }
      if (fighting && lunge > 0) {
        const th = opts.classFx(), cx = hx + hs - 2, cy = H - 34 - hs / 2;
        ctx.lineWidth = 5; ctx.strokeStyle = th.colors[0];
        if (th.swing === 'x') {
          ctx.beginPath(); ctx.moveTo(cx - 6, cy - 22); ctx.lineTo(cx + 26, cy + 18); ctx.moveTo(cx + 26, cy - 22); ctx.lineTo(cx - 6, cy + 18); ctx.stroke();
        } else if (th.swing === 'line') {
          ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 46, cy); ctx.stroke();
          ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx + 36, cy - 6); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.arc(cx, cy, 24, -1.1, 1.1); ctx.stroke();
          ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 18, -0.9, 0.9); ctx.stroke();
        }
      }

      if (mob) {
        const sp = (mob.boss ? bossSprites : mobSprites)[mob.def.sprite];
        const shake = mob.flash > 0 ? (Math.random() - 0.5) * 6 : 0;
        const alpha = mob.dying > 0 ? Math.max(0, mob.dying / 0.5) : 1;
        const my = H - 34 - mob.size + (Math.sin(t * 3) * 2);
        shadow(mob.x + mob.size / 2, mob.size * 0.6);
        drawSprite(sp, mob.x + shake - (mob.lunge > 0 ? 10 : 0), my, mob.size, alpha, mob.flash, mob.def.hue || 0);
        if (mob.dying <= 0 && !mob.boss) {
          const bw = mob.size * 0.8, bx = mob.x + mob.size * 0.1, by = my - 4;
          ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, by - 1, bw + 2, 7);
          ctx.fillStyle = '#ff9a3c'; ctx.fillRect(bx, by, bw * Math.max(0, mob.hp) / mob.max, 5);
          ctx.font = '10px Galmuri11, sans-serif'; ctx.textAlign = 'center';
          ctx.fillStyle = '#000'; ctx.fillText(mob.def.name, mob.x + mob.size / 2 + 1, by - 3);
          ctx.fillStyle = '#fff'; ctx.fillText(mob.def.name, mob.x + mob.size / 2, by - 4);
        }
        if (mob.dying <= 0 && mob.boss && mob.x < W) {
          // boss HP bar across the top, plus timer
          const bx = 110, bw = W - 120, by = 10;
          ctx.fillStyle = '#000'; ctx.fillRect(bx - 2, by - 2, bw + 4, 18);
          ctx.fillStyle = '#5a1020'; ctx.fillRect(bx, by, bw, 14);
          ctx.fillStyle = '#ff3a50'; ctx.fillRect(bx, by, bw * Math.max(0, mob.hp) / mob.max, 14);
          ctx.font = 'bold 10px Galmuri11, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
          ctx.fillText('👑 ' + mob.def.name + '  ' + fmtN(Math.max(0, mob.hp)) + ' / ' + fmtN(mob.max), bx + bw / 2, by + 11);
          const limit = mob.timeLimit || opts.data.combat.bossTimeLimit;
          ctx.fillStyle = '#000'; ctx.fillRect(bx - 2, by + 17, bw + 4, 6);
          ctx.fillStyle = bossT < 8 ? '#ff5a6a' : '#ffd84a'; ctx.fillRect(bx, by + 18, bw * Math.max(0, bossT) / limit, 4);
        }
      }

      // skill effects
      for (const p of projectiles) {
        if (p.t < 0) continue;
        const k = Math.min(1, p.t / p.dur);
        const x = p.x0 + (p.x1 - p.x0) * k, y = p.y0 + (p.y1 - p.y0) * k - Math.sin(k * Math.PI) * (p.arc || 0);
        if (p.ghost) {
          // a translucent copy of the hero dashing in
          drawSprite(hf, x, y, D.heroSize, 0.45, 0, 180);
          continue;
        }
        const z = p.size || 34;
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.35; ctx.font = Math.round(z * 0.75) + 'px sans-serif'; ctx.fillText(p.fx, x - (p.x1 - p.x0) * 0.08, y - (p.y1 - p.y0) * 0.08 + z * 0.25);
        ctx.globalAlpha = 1; ctx.font = z + 'px sans-serif'; ctx.fillText(p.fx, x, y + z * 0.35);
      }
      for (let i = effects.length - 1; i >= 0; i--) {
        const e = effects[i];
        e.t += dt;
        if (e.t >= e.dur) { effects.splice(i, 1); continue; }
        ctx.save(); e.draw(e.t / e.dur, e.t); ctx.restore();
      }
      for (const b of beams) {
        const k = b.life / b.max, th = opts.classFx();
        const y = H - 34 - D.heroSize / 2, x0 = D.heroX + D.heroSize - 6, x1 = mob ? mob.x + mob.size / 2 : W;
        ctx.globalAlpha = k;
        ctx.fillStyle = th.colors[0]; ctx.fillRect(x0, y - 14 * k, x1 - x0, 28 * k);
        ctx.fillStyle = '#fff'; ctx.fillRect(x0, y - 5 * k, x1 - x0, 10 * k);
        ctx.globalAlpha = 1;
      }
      if (haste > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          const yy = H - 40 - ((t * 300 + i * 23) % D.heroSize);
          ctx.beginPath(); ctx.moveTo(D.heroX - 30, yy); ctx.lineTo(D.heroX - 6, yy); ctx.stroke();
        }
      }
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        b.life -= dt;
        if (b.life <= 0) { bursts.splice(i, 1); continue; }
        const k = 1 - b.life / b.max;
        ctx.globalAlpha = 1 - k;
        if (b.ring) {
          ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(b.x, b.y, 10 + k * b.size, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(b.x, b.y, 4 + k * b.size * 0.6, 0, Math.PI * 2); ctx.stroke();
        } else {
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(b.x - 14, b.y - 14 + k * 4); ctx.lineTo(b.x + 14, b.y + 14 - k * 4); ctx.stroke();
        }
        ctx.font = Math.round(b.size * (0.6 + k * 0.6)) + 'px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(b.fx, b.x, b.y + b.size * 0.25);
        ctx.globalAlpha = 1;
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const q = particles[i];
        q.life -= dt;
        if (q.life <= 0) { particles.splice(i, 1); continue; }
        q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 300 * dt; q.vx *= 0.96;
        ctx.globalAlpha = Math.min(1, q.life / q.max * 1.5);
        ctx.fillStyle = q.color;
        const z = q.size;
        if (q.shape === 'star') { ctx.fillRect(q.x - z / 2, q.y - z / 6, z, z / 3); ctx.fillRect(q.x - z / 6, q.y - z / 2, z / 3, z); }
        else if (q.shape === 'ring') { ctx.strokeStyle = q.color; ctx.lineWidth = 2; ctx.strokeRect(q.x - z / 2, q.y - z / 2, z, z); }
        else if (q.shape === 'drop') { ctx.beginPath(); ctx.arc(q.x, q.y, z / 2, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(q.x - z / 2, q.y - z / 2, z, z);
      }
      ctx.globalAlpha = 1;
      if (particles.length > 400) particles.splice(0, particles.length - 400);
      if (flashT > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (flashT / 0.12 * 0.45) + ')'; ctx.fillRect(-10, -10, W + 20, H + 20); }

      // skill bar (bottom right, over the path)
      const sk = opts.skills();
      const sw = 66, sh = 26;
      sk.forEach((s, i) => {
        const x = W - (sk.length - i) * (sw + 4) - 2, y = H - sh - 6;
        ctx.fillStyle = s.unlocked ? '#101a5ccc' : '#000a'; ctx.fillRect(x, y, sw, sh);
        ctx.strokeStyle = s.unlocked ? '#e8ecff' : '#555'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, sw - 1, sh - 1);
        if (s.unlocked && cooldowns[s.id] > 0) {
          ctx.fillStyle = '#000b'; ctx.fillRect(x, y, sw * cooldowns[s.id] / s.cd, sh);
        }
        ctx.font = '9px Galmuri11, sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = s.unlocked ? '#fff' : '#888';
        ctx.fillText(s.unlocked ? s.name : '🔒 Lv.' + s.unlock, x + sw / 2, y + 11);
        if (s.unlocked) {
          ctx.fillStyle = '#ffd84a';
          ctx.fillText(cooldowns[s.id] > 0 ? cooldowns[s.id].toFixed(1) + 's' : 'Lv.' + s.level, x + sw / 2, y + 22);
        }
      });
      if (castLabel) {
        castLabel.life -= dt;
        if (castLabel.life <= 0) castLabel = null;
        else {
          ctx.globalAlpha = Math.min(1, castLabel.life * 2);
          ctx.font = 'bold 16px Galmuri11, sans-serif'; ctx.textAlign = 'left';
          ctx.fillStyle = '#000'; ctx.fillText('【' + castLabel.text + '】', D.heroX - 20 + 1, H - 50 - D.heroSize + 1);
          ctx.fillStyle = '#ffd84a'; ctx.fillText('【' + castLabel.text + '】', D.heroX - 20, H - 50 - D.heroSize);
          ctx.globalAlpha = 1;
        }
      }

      for (let i = floats.length - 1; i >= 0; i--) {
        const f = floats[i];
        f.life -= dt; f.y -= 28 * dt;
        if (f.life <= 0) { floats.splice(i, 1); continue; }
        ctx.globalAlpha = Math.min(1, f.life * 1.5);
        ctx.font = (f.big ? 'bold 15px' : 'bold 12px') + ' Galmuri11, sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = '#000'; ctx.fillText(f.text, f.x + 1, f.y + 1);
        ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
        ctx.globalAlpha = 1;
      }

      // BOSS banner
      if (banner) {
        banner.life -= dt;
        if (banner.life <= 0) banner = null;
        else {
          ctx.globalAlpha = Math.max(0, Math.min(1, banner.life * 2, (2.4 - banner.life) * 6));
          ctx.fillStyle = '#000c'; ctx.fillRect(0, H / 2 - 44, W, 76);
          ctx.fillStyle = '#c8102e';
          for (let x = -40 + (t * 80) % 40; x < W; x += 40) { ctx.fillRect(x, H / 2 - 44, 20, 6); ctx.fillRect(x + 20, H / 2 + 26, 20, 6); }
          const pulse = 1 + Math.sin(t * 12) * 0.05;
          ctx.save(); ctx.translate(W / 2, H / 2 - 6); ctx.scale(pulse, pulse);
          ctx.font = 'bold 30px Galmuri11, sans-serif'; ctx.textAlign = 'center';
          ctx.fillStyle = '#000'; ctx.fillText(banner.title, 2, 2);
          ctx.fillStyle = '#ff3a50'; ctx.fillText(banner.title, 0, 0);
          ctx.restore();
          ctx.font = 'bold 14px Galmuri11, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd84a';
          ctx.fillText('👑 ' + banner.name, W / 2, H / 2 + 18);
          ctx.globalAlpha = 1;
        }
      }

      // round HUD
      const rd = opts.getRound();
      ctx.font = 'bold 11px Galmuri11, sans-serif'; ctx.textAlign = 'left';
      ctx.fillStyle = '#000a'; ctx.fillRect(6, 6, 96, 32);
      ctx.fillStyle = rd.isBoss || rd.siege ? '#ff5a6a' : '#ffd84a'; ctx.fillText(rd.siege ? '⚔ 점령전' : 'ROUND ' + rd.round + (rd.isBoss ? ' BOSS' : ''), 12, 19);
      ctx.font = '10px Galmuri11, sans-serif'; ctx.fillStyle = '#fff';
      const fightingBoss = mob && mob.boss && mob.dying <= 0;
      ctx.fillText(rd.siege ? (fightingBoss ? '제한 ' + Math.ceil(Math.max(0, bossT)) + '초' : rd.siege) : rd.isBoss ? (fightingBoss ? '제한 ' + Math.ceil(Math.max(0, bossT)) + '초' : '보스 대기 중') : '처치 ' + rd.roundKills + ' / ' + rd.count, 12, 32);

      raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    const mobLoads = D.mobs.map(m => loadSprite(D.mobBase + m.sprite, 192, true).then(s => { mobSprites[m.sprite] = s; }));
    const bossLoads = D.bosses.map(m => loadSprite(D.mobBase + m.sprite, 192, true).then(s => { bossSprites[m.sprite] = s; }));
    Promise.all(mobLoads.concat(bossLoads));

    return {
      /** Swap the hero's frames (array of URLs). */
      setHero(urls) {
        heroFrames = [];
        Promise.all(urls.map(u => loadSprite(u, 192))).then(f => { heroFrames = f.filter(Boolean); });
      },
      start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } },
      stop() { cancelAnimationFrame(raf); raf = 0; },
      /** Drop the current mob (e.g. after a reset). */
      reset() { mob = null; gap = 60; clearAttacks(); for (const k in cooldowns) delete cooldowns[k]; haste = 0; heroHp = null; down = 0; banner = null; },
      /** Pet that follows the hero (URL or null). */
      setPet(url) { petSprite = null; if (url) loadSprite(url, 128).then(sp => { petSprite = sp; }); },
      /** Player pressed "보스 도전": drop the current mob so the boss spawns next. */
      challenge() { if (mob && !mob.boss && mob.dying <= 0) { mob = null; clearAttacks(); } gap = 10; },
      /** True while a boss is on screen and alive. */
      isBossActive() { return !!(mob && mob.boss && mob.dying <= 0); },
      /** True while the hero is stunned. */
      isDown() { return down > 0; }
    };
  }

  root.Scene = { create, loadSprite };
})(window);
