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
  /** Appends a line to the 전투 기록 panel (newest first, capped). */
  function logBattle(msg) {
    const box = $('battle-log');
    if (!box) return;
    const cls = /패배|실패|탈환당|기절|초기화/.test(msg) ? 'bad' : /레벨 업|점령|처치|획득|NEW/.test(msg) ? 'good' : /G\b|골드/.test(msg) ? 'gold' : '';
    const d = document.createElement('div');
    d.className = 'log-line ' + cls;
    d.textContent = msg;
    box.prepend(d);
    while (box.children.length > 40) box.lastChild.remove();
  }
  function toast(msg) {
    logBattle(msg);
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
    $('hero-cp').textContent = fmt(L.combatPower(state, D));
    const av = D.spriteBase + c.sprite;
    if ($('hero-avatar').getAttribute('src') !== av) $('hero-avatar').src = av;
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
    const src = state.questSource === 'lms' ? 'LMS에서 가져온 과제' : '샘플 과제 (LMS 파일을 불러오면 교체돼요)';
    $('tab-quest').innerHTML =
      '<div class="lms-box"><div class="small">① 버튼으로 LMS 캘린더 내보내기 페이지 열기 → ② .ics 파일 다운로드 → ③ 파일 불러오기</div>' +
      '<div class="btns" style="margin-top:6px"><button class="btn small-btn" id="btn-lms-open">① LMS 열기</button>' +
      '<label class="btn small-btn file-btn">③ .ics 파일 불러오기<input type="file" id="lms-file" accept=".ics,text/calendar"></label></div>' +
      '<div class="small">파일은 이 브라우저 안에서만 읽어요.</div>' +
      '<div class="small" style="margin-top:8px">🔄 자동 동기화: LMS 내보내기 화면의 <b>「캘린더 URL 얻기」</b> 주소를 붙여넣으면 ' + D.lms.syncMinutes + '분마다 자동 갱신돼요. (주소는 이 기기에만 저장)</div>' +
      '<div class="lms-sub"><input id="lms-url" type="url" placeholder="https://lms.inu.ac.kr/calendar/export_execute.php?..." value="' + esc(lmsUrl()) + '">' +
      '<button class="btn small-btn" id="btn-lms-save">' + (lmsUrl() ? '저장·동기화' : '연결') + '</button>' +
      (lmsUrl() ? '<button class="btn small-btn" id="btn-lms-clear">해제</button>' : '') + '</div>' +
      (state.lmsSyncedAt ? '<div class="small">마지막 동기화: ' + new Date(state.lmsSyncedAt).toLocaleString('ko-KR') + '</div>' : '') + '</div>' +
      '<div class="small">' + src + ' · 실제 과목·과제·마감은 그대로, 설정만 덧붙임</div>' +
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

  function wireLms() {
    $('btn-lms-save').onclick = () => {
      const u = $('lms-url').value.trim();
      let ok = false;
      try { const x = new URL(u); ok = x.protocol === 'https:' && x.hostname === D.lms.allowedHost; } catch (e) { ok = false; }
      if (!ok) { toast(D.lms.allowedHost + ' 주소만 연결할 수 있어요'); return; }
      setLmsUrl(u); syncLms(true);
    };
    if ($('btn-lms-clear')) $('btn-lms-clear').onclick = () => { setLmsUrl(''); renderQuests(); wireLms(); toast('LMS 자동 동기화 해제'); };
    $('btn-lms-open').onclick = () => {
      if (!D.lms.exportUrl) { toast('LMS 주소가 아직 설정되지 않았어요 (data.js의 lms.exportUrl)'); return; }
      window.open(D.lms.exportUrl, '_blank', 'noopener');
    };
    $('lms-file').onchange = (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const items = L.parseIcs(String(reader.result || ''));
        if (!items.length) { toast('과제를 찾지 못했어요. .ics 파일이 맞는지 확인해 주세요'); return; }
        const n = L.importQuests(state, items, D);
        save(); renderQuests(); wireLms();
        toast('📥 과제 ' + n + '개를 퀘스트로 불러왔어요');
      };
      reader.onerror = () => toast('파일을 읽지 못했어요');
      reader.readAsText(f);
    };
  }

  function renderPets() {
    if (!state) return;
    const P = D.pets;
    const owned = state.pets || {};
    const statLabelP = (id) => P.stats.find(x => x.id === id).label;
    const cards = P.grades.map(g => {
      const pet = owned[g.id];
      if (!pet) return '<div class="pet-card locked"><div class="pet-img">❔</div><div class="pet-grade">' + g.name + '</div><div class="small">' + g.min + '~' + g.max + '%</div></div>';
      const eq = state.petEquipped === g.id;
      const rr = L.petRerollCost(g.id, D);
      return '<div class="pet-card' + (eq ? ' equipped' : '') + '" style="border-color:' + g.color + '">' +
        '<div class="pet-img"><img src="' + P.spriteBase + g.sprite + '" alt=""></div>' +
        '<div class="pet-grade" style="color:' + g.color + '">' + g.name + (eq ? ' ★' : '') + '</div>' +
        pet.lines.map(l => '<div class="pet-line">' + esc(statLabelP(l.stat)) + ' +' + l.value + '%</div>').join('') +
        '<div class="pet-btns">' + (eq ? '' : '<button class="btn small-btn" data-peq="' + g.id + '">장착</button>') +
        '<button class="btn small-btn" data-prr="' + g.id + '" data-cost="' + rr + '"' + (state.gold < rr ? ' disabled' : '') + '>리롤 ' + fmt(rr) + 'G</button></div></div>';
    }).join('');
    const pb = L.petBonus(state, D);
    $('tab-pet').innerHTML = '<div class="small">학점 펫 뽑기 · 등급이 높을수록 잠재능력 범위가 커요 · 장착한 펫이 전투에 함께해요</div>' +
      '<div class="btns" style="margin:8px 0">' +
      '<button class="btn small-btn" data-ppull="1" data-cost="' + P.pullCost + '"' + (state.gold < P.pullCost ? ' disabled' : '') + '>1회 ' + fmt(P.pullCost) + 'G</button>' +
      '<button class="btn small-btn" data-ppull="10" data-cost="' + P.tenCost + '"' + (state.gold < P.tenCost ? ' disabled' : '') + '>10연차 ' + fmt(P.tenCost) + 'G</button></div>' +
      '<div class="small">장착 효과: 공격력 ' + pct(pb.atk) + ' · HP ' + pct(pb.hp) + ' · EXP ' + pct(pb.exp) + ' · 골드 ' + pct(pb.gold) + '</div>' +
      '<div class="pet-grid">' + cards + '</div>';
    for (const b of $('tab-pet').querySelectorAll('[data-ppull]')) b.onclick = () => {
      const n = +b.dataset.ppull;
      const res = L.pullPets(state, D, n, n === 1 ? P.pullCost : P.tenCost, rng);
      if (!res) return;
      save(); updatePet();
      const best = res.reduce((a, x) => P.grades.indexOf(x.grade) > P.grades.indexOf(a.grade) ? x : a);
      if (['A0', 'Ap'].includes(best.grade.id) && !best.dup) toast('🌟 ' + best.grade.name + ' 펫 획득!!');
      modal('<div>학점 펫 뽑기 결과</div><div class="relic-row" style="justify-content:center;margin:10px 0">' +
        res.map(x => '<span class="relic owned' + (x.dup ? ' dup' : ' new') + '" style="border-color:' + x.grade.color + '"><img class="pet-mini" src="' + P.spriteBase + x.grade.sprite + '" alt=""><small style="color:' + x.grade.color + '">' +
          x.grade.name + (x.dup ? '<br>+' + P.dupRefund + 'G' : '<br>NEW!') + '</small></span>').join('') + '</div>', renderAll);
    };
    for (const b of $('tab-pet').querySelectorAll('[data-peq]')) b.onclick = () => { L.equipPet(state, b.dataset.peq); save(); updatePet(); renderAll(); };
    for (const b of $('tab-pet').querySelectorAll('[data-prr]')) b.onclick = () => {
      if (L.rerollPet(state, b.dataset.prr, D, rng)) { save(); renderAll(); toast('펫 잠재능력 재설정!'); }
    };
  }

  let petKey = null;
  function updatePet() {
    if (!scene) return;
    const g = state.petEquipped && D.pets.grades.find(x => x.id === state.petEquipped);
    const url = g ? D.pets.spriteBase + g.sprite : null;
    if (url === petKey) return;
    petKey = url;
    scene.setPet(url);
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
      ['오프라인 효율', Math.round(L.offlineEfficiency(state, D, now) * 100) + '%'],
      ['라운드', String(state.round || 1)]
    ];
    $('tab-me').innerHTML = '<div class="row"><div class="sprite-frame mini"><img src="' + sprite(state.classId) + '" alt=""></div>' +
      '<div class="skill-box" style="flex:1;margin:0"><b>[' + esc(c.skill) + ']</b><br>' + esc(c.desc) + '</div></div>' +
      '<table class="stat-table">' + rows.map(x => '<tr><td>' + x[0] + '</td><td>' + esc(x[1]) + '</td></tr>').join('') + '</table>' +
      '<div class="btns" style="margin-top:12px;justify-content:space-between">' +
      '<button class="btn small-btn" id="btn-testgold">🧪 테스트 골드 +' + fmt(D.debug.testGold) + 'G</button>' +
      '<button class="btn small-btn" id="btn-reset">처음부터 다시 (유니 테스트)</button></div>';
    $('btn-testgold').onclick = () => { state.gold += D.debug.testGold; save(); renderAll(); toast('🧪 테스트 골드 +' + fmt(D.debug.testGold) + 'G'); };
    $('btn-reset').onclick = () => { if (confirm('진행 상황이 모두 사라집니다. 다시 시작할까요?')) { wipe(); state = null; stop(); if (scene) scene.stop(); startTest(); } };
  }

  function renderRelics() {
    if (!state) return;
    const R = D.relics;
    const owned = state.relics || {};
    const sets = R.sets.map(set => {
      const n = L.relicCount(state, set);
      const pieces = set.pieces.map(p => '<span class="relic' + (owned[p.id] ? ' owned' : '') + '">' +
        (owned[p.id] ? p.icon : '❔') + '<small>' + esc(p.name) + '</small></span>').join('');
      const eff = (need, e) => '<div class="line' + (n >= need ? ' on' : '') + '"><span>' + need + '세트</span><span>' + esc(e.label) + '</span></div>';
      return '<div class="item"><div class="item-head"><span class="item-name">' + set.icon + ' ' + esc(set.name) +
        '</span><span class="small">' + n + ' / 4</span></div><div class="relic-row">' + pieces + '</div>' +
        '<div class="lines set-eff">' + eff(2, set.two) + eff(4, set.four) + '</div></div>';
    }).join('');
    $('tab-relic').innerHTML = '<div class="small">캠퍼스 유물 뽑기 · 모으면 세트 효과 자동 발동 · 중복은 ' + R.dupRefund + 'G 환급</div>' +
      '<div class="btns" style="margin:8px 0">' +
      '<button class="btn small-btn" data-pull="1" data-cost="' + R.pullCost + '"' + (state.gold < R.pullCost ? ' disabled' : '') + '>1회 뽑기 ' + fmt(R.pullCost) + 'G</button>' +
      '<button class="btn small-btn" data-pull="10" data-cost="' + R.tenCost + '"' + (state.gold < R.tenCost ? ' disabled' : '') + '>10연차 ' + fmt(R.tenCost) + 'G</button></div>' + sets;
    for (const b of $('tab-relic').querySelectorAll('[data-pull]')) b.onclick = () => {
      const n = +b.dataset.pull;
      const res = L.pullRelics(state, D, n, n === 1 ? R.pullCost : R.tenCost, rng);
      if (!res) return;
      save();
      const news = res.filter(x => !x.dup).length;
      modal('<div>유물 뽑기 결과</div><div class="relic-row" style="justify-content:center;margin:10px 0">' +
        res.map(x => '<span class="relic owned' + (x.dup ? ' dup' : ' new') + '">' + x.piece.icon + '<small>' + esc(x.piece.name) +
          (x.dup ? '<br>+' + R.dupRefund + 'G' : '<br>NEW!') + '</small></span>').join('') + '</div>' +
        '<div class="small">새 유물 ' + news + '개</div>', renderAll);
    };
  }

  function renderGuild() {
    if (!state) return;
    const T = D.territory;
    const t = state.territory;
    if (!t) {
      $('tab-guild').innerHTML = '<div class="small">길드 점령전 · 내 학과를 선택하면 캠퍼스 건물 쟁탈전에 참가해요 (한 번 고르면 처음부터 다시 하기 전까지 유지)</div>' +
        T.colleges.map(c => '<div class="college"><div class="college-name" style="color:' + c.color + '">' + esc(c.name) + '</div><div class="dept-list">' +
          c.depts.map(n => '<button class="btn small-btn dept-btn" data-dept="' + esc(n) + '">' + esc(n) + '</button>').join('') + '</div></div>').join('');
      for (const b of $('tab-guild').querySelectorAll('[data-dept]')) b.onclick = () => {
        if (!confirm(b.dataset.dept + '(으)로 참가할까요?')) return;
        L.joinDept(state, b.dataset.dept, D, Date.now()); save(); renderGuild(); toast('🚩 ' + b.dataset.dept + ' 길드 참가!');
      };
      return;
    }
    const depts = L.deptList(D);
    const me = depts.find(d => d.id === t.dept);
    const tb = L.territoryBonus(state, D);
    const rank = L.deptRanking(state, D);
    const tiles = T.buildings.map(bd => {
      const owner = depts.find(d => d.id === t.owners[bd.id]);
      const mine = t.owners[bd.id] === t.dept;
      const fl = t.fortify[bd.id] || 0;
      const rec = bd.tier * T.recLevelPerTier;
      let btn;
      if (mine) {
        const cost = L.fortifyCost(fl, D);
        btn = fl >= T.fortifyMax ? '<div class="small">방어 최대</div>' :
          '<button class="btn small-btn" data-fort="' + bd.id + '" data-cost="' + cost + '"' + (state.gold < cost ? ' disabled' : '') + '>방어 강화 ' + fmt(cost) + 'G</button>';
      } else {
        btn = '<button class="btn small-btn' + (state.level >= rec ? '' : ' warn') + '" data-siege="' + bd.id + '"' + (siegeTarget ? ' disabled' : '') + '>⚔ 공격 (권장 Lv.' + rec + ')</button>';
      }
      return '<div class="bld' + (mine ? ' mine' : '') + '" style="border-color:' + owner.color + '">' +
        '<div class="bld-head"><b>' + esc(bd.name) + '</b><span class="small">' + '★'.repeat(Math.min(5, Math.ceil(bd.tier / 2))) + '</span></div>' +
        '<div class="bld-owner" style="color:' + owner.color + '">' + (mine ? '🚩 ' : '') + esc(owner.name) + '</div>' +
        '<div class="small">' + esc(bd.buff.label) + (mine ? ' · 방어 Lv.' + fl + ' (탈환 ' + Math.round(L.retakeChance(state, bd.id, D) * 100) + '%)' : '') + '</div>' + btn + '</div>';
    }).join('');
    $('tab-guild').innerHTML =
      '<div class="row"><span>🚩 <b style="color:' + me.color + '">' + esc(me.name) + '</b></span><span class="small">' + esc(me.college) + '</span></div>' +
      '<div class="small">점령 효과: 골드 ' + pct(tb.gold) + ' · EXP ' + pct(tb.exp) + ' · 공격력 ' + pct(tb.atk) + ' · HP ' + pct(tb.hp) + '</div>' +
      '<div class="small">다른 학과가 ' + T.counterIntervalMin + '분마다 탈환을 시도해요. 방어 강화로 확률을 낮추세요.</div>' +
      '<div class="rank">' + rank.map((r, i) => '<span class="rank-chip' + (r.dept.id === t.dept ? ' me' : '') + '" style="border-color:' + r.dept.color + '">' + (i + 1) + '. ' + esc(r.dept.name) + ' ' + r.count + '</span>').join('') + '</div>' +
      '<div class="bld-grid">' + tiles + '</div>' +
      '<div class="small" style="margin-top:8px">전황</div><div class="lines">' +
      (t.log.length ? t.log.map(l => '<div class="line"><span>' + esc(l.text) + '</span></div>').join('') : '<div class="line"><span>아직 전투 기록이 없어요</span></div>') + '</div>';
    for (const b of $('tab-guild').querySelectorAll('[data-siege]')) b.onclick = () => {
      if (!scene || scene.isDown()) { toast('기절 중에는 공격할 수 없어요'); return; }
      if (scene.isBossActive()) { toast('보스전 중에는 공격할 수 없어요'); return; }
      siegeTarget = b.dataset.siege;
      bossChallenge = false;
      scene.challenge();
      renderGuild(); updateBossButton();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    for (const b of $('tab-guild').querySelectorAll('[data-fort]')) b.onclick = () => {
      if (L.fortify(state, b.dataset.fort, D)) { save(); renderAll(); toast('🛡 방어 강화!'); }
    };
  }

  /** AI 학과 counterattacks for elapsed intervals. */
  function runCounter() {
    if (!state || !state.territory) return;
    const lost = L.simulateCounter(state, D, Date.now(), rng);
    if (lost.length) {
      save(); renderAll();
      toast('🛡 ' + lost.map(x => x.building.name).join(', ') + ' 탈환당함!');
    }
  }

  function renderGrow() {
    if (!state) return;
    const crit = L.heroCrit(state, D);
    $('tab-grow').innerHTML = '<div class="small">골드로 스탯을 올려요 · 전투력 <b style="color:#ff9a3c">' + fmt(L.combatPower(state, D)) + '</b></div>' +
      '<div class="small">공격력 ' + fmt(L.heroAtk(state, D)) + ' · HP ' + fmt(L.heroMaxHp(state, D)) + ' · 치명타 ' + Math.round(crit.rate * 100) + '% / x' + crit.mult.toFixed(2) +
      ' · 공속 x' + L.heroAspd(state, D).toFixed(2) + '</div>' +
      D.stats.list.map(st => {
        const lv = L.statLevel(state, st.id);
        const maxed = lv >= st.max;
        const cost = L.statCost(state, st.id, D);
        const val = Math.round(st.per * lv * 1000) / 10;
        return '<div class="stat-row"><span class="stat-icon">' + st.icon + '</span><div class="stat-main"><div>' + st.name + ' <b>Lv.' + lv + '</b></div>' +
          '<div class="small">+' + val + '% (레벨당 +' + Math.round(st.per * 1000) / 10 + '%, 최대 Lv.' + st.max + ')</div></div>' +
          (maxed ? '<span class="small">MAX</span>' :
            '<button class="btn small-btn" data-stat="' + st.id + '" data-cost="' + cost + '"' + (state.gold < cost ? ' disabled' : '') + '>강화 ' + fmt(cost) + 'G</button>') +
          '</div>';
      }).join('');
    for (const b of $('tab-grow').querySelectorAll('[data-stat]')) b.onclick = () => {
      if (L.upgradeStat(state, b.dataset.stat, D)) { save(); renderHero(); renderGrow(); }
    };
  }

  // ---------- LMS hourly sync (subscription URL, fetched through /api/ics) ----------
  const LMS_KEY = 'universe-lms-url';
  function lmsUrl() { try { return localStorage.getItem(LMS_KEY) || ''; } catch (e) { return ''; } }
  function setLmsUrl(u) { try { if (u) localStorage.setItem(LMS_KEY, u); else localStorage.removeItem(LMS_KEY); } catch (e) { /* ignore */ } }
  /** Pulls the subscription .ics via the serverless proxy and imports it. */
  async function syncLms(manual) {
    const u = lmsUrl();
    if (!u || !state) return;
    try {
      const res = await fetch(D.lms.proxy + '?url=' + encodeURIComponent(u));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const items = L.parseIcs(await res.text());
      if (!items.length) throw new Error('과제 없음');
      const n = L.importQuests(state, items, D);
      state.lmsSyncedAt = Date.now();
      save(); renderQuests(); wireLms();
      if (manual) toast('🔄 LMS 동기화 완료 · 과제 ' + n + '개');
    } catch (e) {
      if (manual) toast('LMS 동기화 실패: ' + e.message);
    }
  }
  setInterval(() => syncLms(false), D.lms.syncMinutes * 60000);

  function renderAll() { renderHero(); renderEquip(); renderSkills(); renderRelics(); renderPets(); renderGuild(); renderGrow(); renderQuests(); wireLms(); renderMe(); }

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
    for (const b of document.querySelectorAll('#tab-skill [data-cost], #tab-relic [data-cost], #tab-pet [data-cost], #tab-guild [data-cost], #tab-grow [data-cost]')) b.disabled = state.gold < +b.dataset.cost;
    if (Math.floor(sessionSec) % 5 === 0) save();
    if (Math.floor(sessionSec) % 30 === 0) runCounter();
    updateBossButton();
  }

  /** "보스 도전" shows only at a boss gate when no boss fight is running. */
  function updateBossButton() {
    const show = state && scene && L.atBossGate(state, D) && !bossChallenge && !siegeTarget && !scene.isBossActive();
    $('btn-boss').classList.toggle('hidden', !show);
  }
  $('btn-boss').onclick = () => {
    if (!state || !scene || scene.isDown()) { toast('기절 중에는 도전할 수 없어요'); return; }
    bossChallenge = true;
    scene.challenge();
    updateBossButton();
  };
  function start() {
    stop();
    lastFrame = Date.now();
    timer = setInterval(loop, D.tickMs);
  }
  function stop() { if (timer) clearInterval(timer); timer = null; }

  let scene = null;
  /** Scene callback: a mob died, pay the banked study gains and advance the round. */
  function onKill(mob) {
    if (mob.siege) {
      const r = L.payout(state, D, D.territory.captureRewardMult);
      L.captureBuilding(state, mob.siege, D, Date.now());
      const bd = D.territory.buildings.find(b => b.id === mob.siege);
      siegeTarget = null;
      toast('🚩 ' + bd.name + ' 점령! ' + bd.buff.label);
      if (r.levels) { toast('🎉 레벨 업! Lv.' + state.level); renderSkills(); updateHeroSprite(); }
      save(); renderAll();
      return Object.assign(r, { roundCleared: false });
    }
    const bossMult = D.battle.bossMult * (1 + L.relicBonus(state, D).bossReward);
    const r = L.payout(state, D, mob.boss ? bossMult : 1);
    const k = L.recordKill(state, D, mob.boss);
    if (mob.boss) { bossChallenge = false; toast('👑 ' + mob.def.name + ' 처치! 보상 x' + bossMult); }
    if (r.levels) { toast('🎉 레벨 업! Lv.' + state.level); renderSkills(); updateHeroSprite(); }
    save();
    renderHero();
    return Object.assign(r, k);
  }

  /** Hero sprite frames; classes with frameUnlocks change look as skills unlock. */
  function heroFrameUrls() {
    const c = D.classes[state.classId];
    if (!c.frameUnlocks) return [D.spriteBase + c.sprite];
    const idx = c.frameUnlocks.filter(lv => state.level >= lv).length - 1;
    return [D.spriteBase + c.frames[Math.max(0, idx)]];
  }
  let heroUrlKey = '';
  function updateHeroSprite() {
    const urls = heroFrameUrls();
    if (urls.join() === heroUrlKey || !scene) return;
    if (heroUrlKey) toast('✨ 외형 변화!');
    heroUrlKey = urls.join();
    scene.setHero(urls);
  }

  let bossChallenge = false;
  let siegeTarget = null;   // building id while a siege is queued or running
  const sceneOpts = {
    data: D,
    onKill,
    onBossFail: (mob) => {
      if (mob && mob.siege) { siegeTarget = null; toast('점령 실패… 강화하고 다시 도전!'); renderGuild(); return; }
      bossChallenge = false; L.failBoss(state); save(); toast('보스에게 패배… 강화하고 다시 도전!');
    },
    onHeroDown: () => { L.heroDown(state); save(); toast('기절… 라운드 진행이 초기화됐어요'); },
    heroMaxHp: () => L.heroMaxHp(state, D),
    nextMob: () => {
      if (siegeTarget && state.territory) {
        const T = D.territory;
        const bd = T.buildings.find(b => b.id === siegeTarget);
        const owner = L.deptList(D).find(d => d.id === state.territory.owners[bd.id]);
        const boss = D.battle.bosses[(bd.tier - 1) % D.battle.bosses.length];
        const lines = boss.lines.concat(D.battle.siegeLines.map(l => l.replace('{dept}', owner.name)));
        return { def: { name: owner.name + ' 수비대장', sprite: boss.sprite, scale: boss.scale, siege: bd.id, lines }, boss: true, siege: bd.id,
          hp: L.siegeHp(bd.tier, D), atk: L.siegeAtk(bd.tier, D), timeLimit: T.siegeTimeLimit,
          bannerTitle: '⚔ ' + bd.name + ' 점령전 ⚔' };
      }
      const round = state.round || 1;
      const info = L.roundInfo(round, D);
      const boss = info.isBoss && bossChallenge;
      const pool = boss ? D.battle.bosses : D.battle.mobs;
      const def = boss ? pool[(Math.floor(round / D.combat.bossEvery) - 1) % pool.length]
                       : pool[Math.floor(Math.random() * pool.length)];
      return { def, boss, hp: L.mobHp(round, boss, D), atk: L.mobAtk(round, boss, D) };
    },
    getRound: () => {
      const round = state.round || 1;
      const siege = siegeTarget ? D.territory.buildings.find(b => b.id === siegeTarget).name + ' 진격 중' : null;
      return Object.assign({ round, roundKills: state.roundKills || 0, siege }, L.roundInfo(round, D));
    },
    heroAtk: () => L.heroAtk(state, D),
    classFx: () => D.classFx[state.classId],
    heroCrit: () => L.heroCrit(state, D),
    onBossTalk: (mob, line) => logBattle('👑 ' + mob.def.name + ': "' + line + '"'),
    heroAspd: () => L.heroAspd(state, D),
    skills: () => L.classSkills(state, D).map(s => ({ id: s.def.id, name: s.def.name, fx: s.def.fx, type: s.def.type, anim: s.def.anim, cd: s.def.cd, unlock: s.def.unlock, unlocked: s.unlocked, level: s.level })),
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
    bossChallenge = false;
    heroUrlKey = '';
    updateHeroSprite();
    petKey = undefined;
    updatePet();
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
    for (const p of ['grow', 'equip', 'skill', 'relic', 'pet', 'guild', 'quest', 'me']) $('tab-' + p).classList.toggle('hidden', p !== t.dataset.tab);
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
    runCounter();
    syncLms(false);
  } else {
    startTest();
  }
})();
