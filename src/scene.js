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
   */
  function loadSprite(url, size) {
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
          resolve(c);
        } catch (e) {
          resolve(img); // tainted canvas: draw as-is
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
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
    let W = 360, H = D.sceneHeight, dpr = 1;
    let heroFrames = [], mobSprites = {}, bossSprites = {};
    let scroll = 0, t = 0, last = 0, raf = 0;
    let mob = null, gap = 60;
    let hitT = 0, lunge = 0, haste = 0, hasteMult = 1, bossT = 0, castLabel = null;
    const cooldowns = {};       // skill id -> seconds left
    const pendingHits = [];     // { at, dmg } queued multi-hit damage
    const floats = [];

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.clientWidth || 360;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.height = H + 'px';
    }

    function spawn() {
      const m = opts.nextMob(); // { def, boss, hp }
      mob = { def: m.def, boss: m.boss, x: W + 40, hp: m.hp, max: m.hp, flash: 0, dying: 0,
              size: m.boss ? D.bossSize : D.mobSize };
      bossT = m.boss ? opts.data.combat.bossTimeLimit : 0;
      if (m.boss) float('⚠ BOSS ⚠', W / 2, 60, '#ff5a6a', true);
    }

    function fmtN(n) { return Math.floor(n).toLocaleString('ko-KR'); }

    function damage(dmg, big) {
      if (!mob || mob.dying > 0) return;
      mob.hp -= dmg; mob.flash = 0.12;
      float(fmtN(dmg), mob.x + mob.size / 2 + (Math.random() - 0.5) * 30, H - 40 - mob.size, big ? '#ffd84a' : '#ffffff', big);
      if (mob.hp <= 0) kill();
    }

    function kill() {
      mob.hp = 0; mob.dying = 0.5; pendingHits.length = 0;
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
        if (r.haste) { haste = r.haste.dur; hasteMult = r.haste.mult; }
        r.hits.forEach((d, i) => pendingHits.push({ at: i * 0.09, dmg: d }));
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
      const walking = !mob || mob.x - D.heroX > D.engageDistance || mob.dying > 0;

      // world update
      if (walking && !(mob && mob.dying > 0)) {
        scroll += D.walkSpeed * dt;
        if (mob) mob.x -= D.walkSpeed * dt;
        else if ((gap -= D.walkSpeed * dt) <= 0) spawn();
      } else if (mob && mob.dying <= 0) {
        hitT += dt * (haste > 0 ? hasteMult : 1);
        if (hitT >= D.hitInterval) {
          hitT = 0; lunge = 0.14;
          damage(opts.heroAtk() * (0.9 + Math.random() * 0.2), false);
        }
        if (mob && mob.boss && mob.dying <= 0) {
          bossT -= dt;
          if (bossT <= 0) {
            opts.onBossFail(mob);
            float('시간 초과… ROUND 후퇴', W / 2, 70, '#ff5a6a', true);
            mob.dying = 0.5; pendingHits.length = 0;
          }
        }
      }
      // queued skill hits
      for (const h of pendingHits) h.at -= dt;
      const ready = pendingHits.filter(h => h.at <= 0);
      for (const h of ready) pendingHits.splice(pendingHits.indexOf(h), 1);
      for (const h of ready) damage(h.dmg, true);
      castSkills(dt);
      haste = Math.max(0, haste - dt);
      if (mob && mob.dying > 0) {
        mob.dying -= dt;
        if (mob.dying <= 0) { mob = null; gap = 40 + Math.random() * 60; }
      }
      if (mob) mob.flash = Math.max(0, mob.flash - dt);
      lunge = Math.max(0, lunge - dt);

      // draw
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const night = sky();
      farLayer(night);
      nearLayer(night);
      ground();

      const fighting = !walking;
      const bob = walking ? Math.abs(Math.sin(t * 9)) * 5 : 0;
      const hx = D.heroX + (lunge > 0 ? 12 : 0);
      const hs = D.heroSize;
      shadow(hx + hs / 2, hs * 0.6);
      const hf = heroFrames.length ? heroFrames[Math.floor(t * 6) % heroFrames.length] : null;
      if (haste > 0) {
        ctx.fillStyle = 'rgba(255,216,74,' + (0.25 + 0.15 * Math.sin(t * 20)) + ')';
        ctx.beginPath(); ctx.ellipse(hx + hs / 2, H - 34 - hs / 2, hs * 0.55, hs * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      }
      drawSprite(hf, hx, H - 34 - hs - bob, hs, 1, 0);
      if (fighting && lunge > 0) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(hx + hs - 4, H - 34 - hs / 2, 18, -0.9, 0.9); ctx.stroke();
      }

      if (mob) {
        const sp = (mob.boss ? bossSprites : mobSprites)[mob.def.sprite];
        const shake = mob.flash > 0 ? (Math.random() - 0.5) * 6 : 0;
        const alpha = mob.dying > 0 ? Math.max(0, mob.dying / 0.5) : 1;
        const my = H - 34 - mob.size + (Math.sin(t * 3) * 2);
        shadow(mob.x + mob.size / 2, mob.size * 0.6);
        drawSprite(sp, mob.x + shake, my, mob.size, alpha, mob.flash, mob.boss ? 0 : mob.def.hue);
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
          const limit = opts.data.combat.bossTimeLimit;
          ctx.fillStyle = '#000'; ctx.fillRect(bx - 2, by + 17, bw + 4, 6);
          ctx.fillStyle = bossT < 8 ? '#ff5a6a' : '#ffd84a'; ctx.fillRect(bx, by + 18, bw * Math.max(0, bossT) / limit, 4);
        }
      }

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

      // round HUD
      const rd = opts.getRound();
      ctx.font = 'bold 11px Galmuri11, sans-serif'; ctx.textAlign = 'left';
      ctx.fillStyle = '#000a'; ctx.fillRect(6, 6, 96, 32);
      ctx.fillStyle = rd.isBoss ? '#ff5a6a' : '#ffd84a'; ctx.fillText('ROUND ' + rd.round + (rd.isBoss ? ' BOSS' : ''), 12, 19);
      ctx.font = '10px Galmuri11, sans-serif'; ctx.fillStyle = '#fff';
      ctx.fillText(rd.isBoss ? '제한 ' + opts.data.combat.bossTimeLimit + '초' : '처치 ' + rd.roundKills + ' / ' + rd.count, 12, 32);

      raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    const mobLoads = D.mobs.map(m => loadSprite(D.mobBase + m.sprite, 192).then(s => { mobSprites[m.sprite] = s; }));
    const bossLoads = D.bosses.map(m => loadSprite(D.mobBase + m.sprite, 192).then(s => { bossSprites[m.sprite] = s; }));
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
      reset() { mob = null; gap = 60; pendingHits.length = 0; for (const k in cooldowns) delete cooldowns[k]; haste = 0; }
    };
  }

  root.Scene = { create, loadSprite };
})(window);
