/**
 * UNI-VERSE demo — DOM, storage and the game clock. All rules live in logic.js,
 * all numbers in data.js.
 */
(function () {
  'use strict';
  const D = window.GAME_DATA;
  const L = window.GameLogic;
  const rng = Math.random;
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Math.floor(n).toLocaleString('ko-KR');
  const pct = (f) => '+' + Math.round(f * 100) + '%';

  let state = null;
  let picks = [];
  let pendingClass = null;
  let timer = null;
  let berserkerFrame = 0;

  // ---------- storage (never trusted to exist) ----------
  function save() {
    try { localStorage.setItem(D.saveKey, JSON.stringify(state)); } catch (e) { /* private mode: play without saving */ }
  }
  function load() {
    try { const raw = localStorage.getItem(D.saveKey); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function wipe() {
    try { localStorage.removeItem(D.saveKey); } catch (e) { /* ignore */ }
  }

  // ---------- helpers ----------
  function show(id) {
    for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden');
    $(id).classList.remove('hidden');
  }
  function sprite(classId) { return D.spriteBase + D.classes[classId].sprite; }
  let toastT = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 2200);
  }
  function modal(html, onClose) {
    $('modal-box').innerHTML = html + '<button class="btn primary" id="modal-ok">확인</button>';
    $('modal').classList.remove('hidden');
    $('modal-ok').onclick = () => { $('modal').classList.add('hidden'); if (onClose) onClose(); };
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function gradeOf(id) { return D.potential.grades.find(g => g.id === id); }
  function statLabel(id) { return D.potential.stats.find(s => s.id === id).label; }
  function timeLeft(ms) {
    const h = Math.floor(Math.abs(ms) / L.HOUR);
    if (h >= 24) return Math.floor(h / 24) + '일 ' + (h % 24) + '시간';
    return h + '시간 ' + Math.floor((Math.abs(ms) % L.HOUR) / 60000) + '분';
  }

  // ---------- Uni test ----------
  function renderQuestion() {
    const i = picks.length;
    const q = D.uniTest[i];
    $('test-box').innerHTML =
      '<div class="q-progress">유니 테스트 ' + (i + 1) + ' / ' + D.uniTest.length + '</div>' +
      '<div class="q-title">' + esc(q.q) + '</div>' +
      q.a.map((a, k) => '<button class="btn" data-k="' + k + '">' + esc(a[0]) + '</button>').join('');
    for (const b of $('test-box').querySelectorAll('button')) {
      b.onclick = () => {
        picks.push(q.a[+b.dataset.k][1]);
        if (picks.length < D.uniTest.length) renderQuestion();
        else reveal(L.assignClass(picks, D, rng));
      };
    }
  }
  function renderPicker() {
    $('pick-box').innerHTML = Object.keys(D.classes).map(id =>
      '<button class="btn" data-id="' + id + '">' + esc(D.classes[id].name) + ' · ' + esc(D.classes[id].role) + '</button>').join('');
    for (const b of $('pick-box').querySelectorAll('button')) b.onclick = () => reveal(b.dataset.id);
  }
  function reveal(classId) {
    pendingClass = classId;
    const c = D.classes[classId];
    $('reveal-img').src = sprite(classId);
    $('reveal-name').textContent = c.name;
    $('reveal-role').textContent = c.role;
    $('reveal-skill').innerHTML = '<b>[' + esc(c.skill) + ']</b><br>' + esc(c.desc);
    show('screen-reveal');
  }
  function startTest() {
    picks = [];
    renderQuestion(); renderPicker();
    $('pick-box').classList.add('hidden');
    show('screen-test');
  }

  // ---------- game screen ----------
  function renderHero() {
    const c = D.classes[state.classId];
    const now = Date.now();
    $('hero-name').textContent = c.name;
    $('hero-lv').textContent = 'Lv.' + state.level;
    $('hero-gold').textContent = '💰 ' + fmt(state.gold) + ' G';
    const need = L.expToNext(state.level, D);
    $('exp-fill').style.width = Math.min(100, state.exp / need * 100) + '%';
    $('exp-text').textContent = 'EXP ' + fmt(state.exp) + ' / ' + fmt(need);
    const r = L.rates(state, D, now);
    $('skill-chip').textContent = '[' + c.skill + '] ' + (r.skill.active ? '발동 중 · ' : '') + r.skill.note;
    $('skill-chip').classList.toggle('on', r.skill.active);
    $('rate-exp').textContent = 'EXP ' + r.expPerSec.toFixed(1) + '/s';
    $('rate-gold').textContent = '골드 ' + r.goldPerSec.toFixed(1) + '/s';
    const stacks = L.comboStacks(state, D);
    $('combo').textContent = '집중 콤보 x' + stacks + (stacks ? ' (' + pct(r.combo) + ')' : '');
    const s = Math.floor(sessionSec);
    $('study-time').textContent = String(Math.floor(s / 3600)).padStart(2, '0') + ':' +
      String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  function renderEquip(flashSlot) {
    $('tab-equip').innerHTML = D.equipment.slots.map(s => {
      const it = state.equipment[s.id];
      const up = L.upgradeCost(it.level, D);
      const rr = L.rerollCost(it.level, D);
      const lines = it.lines.map(l => {
        const g = gradeOf(l.grade);
        return '<div class="line' + (flashSlot === s.id ? ' flash' : '') + '" style="color:' + g.color + '"><span>' +
          esc(statLabel(l.stat)) + ' +' + l.value + '%</span><span>' + g.name + '</span></div>';
      }).join('');
      return '<div class="item"><div class="item-head"><span class="item-name">' + s.icon + ' ' + s.name +
        ' <span class="plus">+' + it.level + '</span></span><span class="small">' + esc(statLabel(s.stat)) + ' ' +
        pct(s.perLevel * it.level) + '</span></div><div class="lines">' + lines + '</div><div class="btns">' +
        '<button class="btn small-btn" data-up="' + s.id + '"' + (state.gold < up ? ' disabled' : '') + '>강화 ' + fmt(up) + 'G</button>' +
        '<button class="btn small-btn" data-rr="' + s.id + '"' + (state.gold < rr ? ' disabled' : '') + '>잠재 리롤 ' + fmt(rr) + 'G</button>' +
        '</div></div>';
    }).join('');
    for (const b of $('tab-equip').querySelectorAll('[data-up]')) b.onclick = () => {
      if (L.upgrade(state, b.dataset.up, D)) { toast('강화 성공! +' + state.equipment[b.dataset.up].level); save(); renderAll(); }
    };
    for (const b of $('tab-equip').querySelectorAll('[data-rr]')) b.onclick = () => {
      const lines = L.reroll(state, b.dataset.rr, D, rng);
      if (!lines) return;
      const best = lines.reduce((a, l) => D.potential.grades.findIndex(g => g.id === l.grade) > D.potential.grades.findIndex(g => g.id === a.grade) ? l : a);
      if (best.grade === 'legendary') toast('🌟 레전드리 등장!!');
      else if (best.grade === 'unique') toast('✨ 유니크 옵션!');
      save(); renderHero(); renderEquip(b.dataset.rr);
    };
  }

  function renderQuests() {
    const now = Date.now();
    const sorted = state.quests.slice().sort((a, b) => a.due - b.due);
    $('tab-quest').innerHTML = '<div class="small">LMS 연동 데모 · 샘플 과제 (실제 과목·과제·마감은 그대로, 설정만 덧붙임)</div>' +
      sorted.map(q => {
        const st = L.questStatus(q, now);
        const tag = { done: '클리어', failed: '실패', urgent: '마감 임박', open: '진행 중' }[st];
        const due = st === 'failed' ? '마감 ' + timeLeft(now - q.due) + ' 지남' : st === 'done' ? '완료' : timeLeft(q.due - now) + ' 남음';
        return '<div class="quest ' + st + '"><div class="row"><span class="quest-dungeon">⚔ ' + esc(q.dungeon) + '</span>' +
          '<span class="tag ' + st + '">' + tag + '</span></div>' +
          '<div>' + esc(q.monster) + '이(가) 「' + esc(q.title) + '」를 지키고 있다.</div>' +
          '<div class="row"><span class="quest-real">' + esc(q.subject) + ' · ' + esc(q.title) + '</span>' +
          '<span class="quest-real quest-due ' + st + '">' + due + '</span></div>' +
          (st === 'open' || st === 'urgent' ? '<div class="btns"><button class="btn small-btn" data-q="' + q.id + '">제출 완료! 보상 받기</button></div>' : '') +
          '</div>';
      }).join('');
    for (const b of $('tab-quest').querySelectorAll('[data-q]')) b.onclick = () => {
      const r = L.completeQuest(state, +b.dataset.q, D, Date.now());
      if (!r) return;
      save();
      modal('<div>퀘스트 클리어!</div><div class="big-num">+' + fmt(r.gold) + ' G</div><div>+' + fmt(r.exp) + ' EXP</div>' +
        (r.levels ? '<div class="lv">레벨 업! Lv.' + state.level + '</div>' : '') +
        (r.planner ? '<div class="skill-box"><b>[완벽한 타임라인]</b> 계획의 징표 획득! 30분간 잠재능력 강화</div>' : ''), renderAll);
    };
  }

  function renderMe() {
    const now = Date.now();
    const r = L.rates(state, D, now);
    const c = D.classes[state.classId];
    const rows = [
      ['직업', c.name + ' (' + c.role + ')'],
      ['스킬', c.skill],
      ['총 공부 시간', Math.floor(state.totalStudySec / 60) + '분'],
      ['경험치 배율', 'x' + r.expMul.toFixed(2)],
      ['골드 배율', 'x' + r.goldMul.toFixed(2)],
      ['퀘스트 보상', pct(L.equipBonus(state, 'quest', D) + L.potentialPct(state, 'quest', D, now) / 100)],
      ['오프라인 효율', Math.round(D.idle.offlineRate * (1 + L.equipBonus(state, 'offline', D) + L.potentialPct(state, 'offline', D, now) / 100) * 100) + '%']
    ];
    $('tab-me').innerHTML = '<div class="row"><div class="sprite-frame mini"><img src="' + sprite(state.classId) + '" alt=""></div>' +
      '<div class="skill-box" style="flex:1;margin:0"><b>[' + esc(c.skill) + ']</b><br>' + esc(c.desc) + '</div></div>' +
      '<table class="stat-table">' + rows.map(x => '<tr><td>' + x[0] + '</td><td>' + esc(x[1]) + '</td></tr>').join('') + '</table>' +
      '<button class="btn small-btn" id="btn-reset" style="margin-top:12px">처음부터 다시 (유니 테스트)</button>';
    $('btn-reset').onclick = () => { if (confirm('진행 상황이 모두 사라집니다. 다시 시작할까요?')) { wipe(); state = null; stop(); if (scene) scene.stop(); startTest(); } };
  }

  function renderAll() { renderHero(); renderEquip(); renderSkills(); renderQuests(); renderMe(); }

  // ---------- clock ----------
  let sessionSec = 0;
  let lastFrame = 0;
  let lastStacks = 0;
  function loop() {
    if (document.hidden) return; // away time is paid by applyOffline on return
    const now = Date.now();
    const dt = Math.min(5, (now - lastFrame) / 1000);
    lastFrame = now;
    L.accrue(state, D, dt, now); // paid out when the scene's mob dies
    sessionSec += dt;
    const stacks = L.comboStacks(state, D);
    if (stacks > lastStacks) { $('combo').classList.remove('pulse'); void $('combo').offsetWidth; $('combo').classList.add('pulse'); }
    lastStacks = stacks;
    renderHero();
    // refresh affordability on the visible tab without rebuilding every frame
    if (!$('tab-equip').classList.contains('hidden')) {
      for (const b of $('tab-equip').querySelectorAll('[data-up],[data-rr]')) {
        const it = state.equipment[b.dataset.up || b.dataset.rr];
        const cost = b.dataset.up ? L.upgradeCost(it.level, D) : L.rerollCost(it.level, D);
        b.disabled = state.gold < cost;
      }
    }
    for (const b of $('tab-skill').querySelectorAll('[data-cost]')) b.disabled = state.gold < +b.dataset.cost;
    if (Math.floor(sessionSec) % 5 === 0) save();
  }
  function start() {
    stop();
    lastFrame = Date.now();
    timer = setInterval(loop, D.tickMs);
  }
  function stop() { if (timer) clearInterval(timer); timer = null; }

  let scene = null;
  /** Scene callback: a mob died, pay the banked study gains and advance the round. */
  function onKill(mob) {
    const r = L.payout(state, D, mob.boss ? D.battle.bossMult : 1);
    const k = L.recordKill(state, D);
    if (r.levels) { toast('🎉 레벨 업! Lv.' + state.level); renderSkills(); }
    if (mob.boss) toast('👑 ' + mob.def.name + ' 처치! 보상 x' + D.battle.bossMult);
    save();
    renderHero();
    return Object.assign(r, k);
  }
  const sceneOpts = {
    data: D,
    onKill,
    onBossFail: () => { L.failBoss(state); save(); toast('보스에게 패배… 강화하고 다시 도전!'); },
    nextMob: () => {
      const round = state.round || 1;
      const info = L.roundInfo(round, D);
      const pool = info.isBoss ? D.battle.bosses : D.battle.mobs;
      const def = info.isBoss ? pool[(Math.floor(round / D.combat.bossEvery) - 1) % pool.length]
                              : pool[Math.floor(Math.random() * pool.length)];
      return { def, boss: info.isBoss, hp: L.mobHp(round, info.isBoss, D) };
    },
    getRound: () => {
      const round = state.round || 1;
      return Object.assign({ round, roundKills: state.roundKills || 0 }, L.roundInfo(round, D));
    },
    heroAtk: () => L.heroAtk(state, D),
    skills: () => L.classSkills(state, D).map(s => ({ id: s.def.id, name: s.def.name, cd: s.def.cd, unlock: s.def.unlock, unlocked: s.unlocked, level: s.level })),
    castSkill: (id) => {
      const def = D.skills.byClass[state.classId].find(s => s.id === id);
      const dmg = L.skillHitDamage(state, id, D);
      return { hits: def.type === 'haste' ? [] : Array.from({ length: def.hits || 1 }, () => dmg), haste: L.skillHaste(state, id, D) };
    }
  };

  function renderSkills() {
    if (!state) return;
    const list = L.classSkills(state, D);
    $('tab-skill').innerHTML = '<div class="small">전투 중 자동 발동 · 레벨에 따라 해금 · 골드로 강화</div>' + list.map(s => {
      const d = s.def;
      const cost = L.skillUpgradeCost(s.tier, s.level, D);
      const eff = d.type === 'haste' ? '공격 속도 x' + d.mult + ' · ' + L.skillHaste(state, d.id, D).dur.toFixed(1) + '초'
        : (d.hits ? d.hits + '회 × ' : '') + fmt(L.skillHitDamage(state, d.id, D)) + ' 피해';
      return '<div class="item"><div class="item-head"><span class="item-name">' + esc(d.name) +
        (s.unlocked ? ' <span class="plus">Lv.' + s.level + '</span>' : '') + '</span><span class="small">쿨타임 ' + d.cd + '초</span></div>' +
        '<div class="small">' + esc(d.desc) + '</div>' +
        (s.unlocked
          ? '<div class="lines"><div class="line"><span>' + eff + '</span></div></div><div class="btns"><button class="btn small-btn" data-sk="' + d.id + '" data-cost="' + cost + '"' + (state.gold < cost ? ' disabled' : '') + '>강화 ' + fmt(cost) + 'G</button></div>'
          : '<div class="lines"><div class="line"><span>🔒 Lv.' + d.unlock + '에 해금</span></div></div>') +
        '</div>';
    }).join('');
    for (const b of $('tab-skill').querySelectorAll('[data-sk]')) b.onclick = () => {
      if (L.upgradeSkill(state, b.dataset.sk, D)) { toast('스킬 강화!'); save(); renderHero(); renderSkills(); }
    };
  }

  function enterGame(offlineReport) {
    show('screen-game');
    const c = D.classes[state.classId];
    if (!scene) scene = window.Scene.create($('scene'), sceneOpts);
    else scene.reset();
    scene.setHero((c.frames || [c.sprite]).map(f => D.spriteBase + f));
    scene.start();
    renderAll();
    start();
    if (offlineReport && offlineReport.seconds) {
      modal('<div>자리를 비운 ' + Math.floor(offlineReport.seconds / 60) + '분 동안 유니가 공부했어요</div>' +
        '<div class="big-num">+' + fmt(offlineReport.gold) + ' G</div><div>+' + fmt(offlineReport.exp) + ' EXP</div>' +
        (offlineReport.levels ? '<div class="lv">레벨 업! Lv.' + state.level + '</div>' : ''));
    }
  }

  // Leaving the page = touching your phone: breaks focus combo.
  document.addEventListener('visibilitychange', () => {
    if (!state || !timer) return;
    if (document.hidden) {
      state.lastTick = Date.now();
      save();
    } else {
      const off = L.applyOffline(state, D, Date.now());
      const r = L.breakCombo(state);
      lastFrame = Date.now();
      save(); renderAll();
      if (r.shielded) toast('🍚 [든든한 국밥] 집중 콤보를 지켰다!');
      else if (r.broken) toast('폰을 만졌다… 집중 콤보 초기화');
      if (off.seconds) toast('자리 비운 동안 +' + fmt(off.gold) + 'G');
    }
  });

  // tabs
  for (const t of document.querySelectorAll('.tab')) t.onclick = () => {
    for (const x of document.querySelectorAll('.tab')) x.classList.toggle('active', x === t);
    for (const p of ['equip', 'skill', 'quest', 'me']) $('tab-' + p).classList.toggle('hidden', p !== t.dataset.tab);
    renderAll();
  };
  $('btn-pick').onclick = () => $('pick-box').classList.toggle('hidden');
  $('btn-start').onclick = () => {
    state = L.newState(pendingClass, D, Date.now(), rng);
    save();
    enterGame(null);
  };

  // boot
  const saved = load();
  if (saved && saved.classId && D.classes[saved.classId]) {
    state = saved;
    const off = L.applyOffline(state, D, Date.now());
    state.shieldsLeft = D.classes[state.classId].shields || 0;
    save();
    enterGame(off);
  } else {
    startTest();
  }
})();
