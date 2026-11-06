/**
 * UNI-VERSE demo — pure game logic. No DOM, no storage, no Date.now():
 * every function takes `data` (GAME_DATA), `now` (ms) and `rng` (() => [0,1)) as
 * arguments so it can be unit-tested with fixed inputs.
 */
(function (root) {
  'use strict';

  const HOUR = 3600 * 1000;

  /** EXP needed to go from `level` to `level + 1`. */
  function expToNext(level, data) {
    return Math.floor(data.idle.expCurveBase * Math.pow(data.idle.expCurveGrowth, level - 1));
  }

  /** Picks one grade by weight. */
  function rollGrade(data, rng) {
    const grades = data.potential.grades;
    const total = grades.reduce((s, g) => s + g.weight, 0);
    let r = rng() * total;
    for (const g of grades) { if ((r -= g.weight) < 0) return g; }
    return grades[grades.length - 1];
  }

  /** Rolls one potential line: { grade, stat, value } (value in %). */
  function rollLine(data, rng) {
    const g = rollGrade(data, rng);
    const stats = data.potential.stats;
    const stat = stats[Math.floor(rng() * stats.length)].id;
    const value = g.min + Math.floor(rng() * (g.max - g.min + 1));
    return { grade: g.id, stat, value };
  }

  function rollLines(data, rng) {
    return Array.from({ length: data.potential.lines }, () => rollLine(data, rng));
  }

  /** Fresh save for a class. */
  function newState(classId, data, now, rng) {
    const equipment = {};
    for (const s of data.equipment.slots) equipment[s.id] = { level: 0, lines: rollLines(data, rng) };
    const q = data.quests;
    const quests = q.sample.map((a, i) => ({
      id: i,
      subject: a.subject,
      title: a.title,
      due: now + a.dueInHours * HOUR,
      done: false,
      dungeon: a.subject + q.dungeons[i % q.dungeons.length],
      monster: q.monsters[i % q.monsters.length]
    }));
    return {
      classId, level: 1, exp: 0, gold: 0,
      lastTick: now, comboSeconds: 0,
      shieldsLeft: (data.classes[classId].shields || 0),
      equipment, quests,
      plannerBuffUntil: 0,
      rogueDay: '', rogueUsedSec: 0,
      totalStudySec: 0,
      round: 1, roundKills: 0, kills: 0, skills: {}
    };
  }

  /** Sum of potential % for a stat across all items (planner buff scales it). */
  function potentialPct(state, stat, data, now) {
    let sum = 0;
    for (const id in state.equipment) {
      for (const l of state.equipment[id].lines) if (l.stat === stat) sum += l.value;
    }
    const p = data.classes.planner;
    if (state.classId === 'planner' && now < state.plannerBuffUntil) sum *= (1 + p.potentialBoost);
    return sum;
  }

  /** Flat bonus from equipment upgrade levels for a stat (fraction, 0.12 = +12%). */
  function equipBonus(state, stat, data) {
    let b = 0;
    for (const s of data.equipment.slots) if (s.stat === stat) b += s.perLevel * state.equipment[s.id].level;
    return b;
  }

  function dayKey(now) {
    const d = new Date(now);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  /** Class skill effects at `now`. Returns additive fractions plus a gold multiplier. */
  function skillModifiers(state, data, now) {
    const c = data.classes[state.classId];
    const m = { exp: 0, gold: 0, goldMult: 1, active: false, note: '' };
    switch (state.classId) {
      case 'insider':
        m.gold = c.demoNearbyMembers * c.goldPerMember; m.active = true;
        m.note = '근처 길드원 ' + c.demoNearbyMembers + '명';
        break;
      case 'hermit': {
        const h = new Date(now).getHours();
        if (h >= c.nightStart && h < c.nightEnd) { m.exp = c.nightExp; m.active = true; m.note = '심야 시간'; }
        else m.note = '01~05시에 발동';
        break;
      }
      case 'berserker': {
        const urgent = state.quests.some(q => !q.done && q.due > now && q.due - now <= c.deadlineHours * HOUR);
        if (urgent) { m.exp = m.gold = c.deadlineBonus; m.active = true; m.note = '마감 임박!'; }
        else m.note = '24시간 내 마감 없음';
        break;
      }
      case 'planner':
        if (now < state.plannerBuffUntil) {
          m.active = true; m.note = '계획의 징표 ' + Math.ceil((state.plannerBuffUntil - now) / 60000) + '분';
        } else m.note = '징표 없음';
        break;
      case 'foodie':
        m.active = state.shieldsLeft > 0; m.note = '보호 ' + state.shieldsLeft + '회';
        break;
      case 'rogue': {
        const used = state.rogueDay === dayKey(now) ? state.rogueUsedSec : 0;
        const left = c.dailyMinutes * 60 - used;
        if (left > 0) { m.goldMult = c.goldMultiplier; m.active = true; m.note = '분신 ' + Math.ceil(left / 60) + '분 남음'; }
        else m.note = '오늘 분신 소진';
        break;
      }
    }
    return m;
  }

  // ---------- relics ----------

  /** Number of pieces owned from a set. */
  function relicCount(state, set) {
    return set.pieces.filter(p => state.relics && state.relics[p.id]).length;
  }

  /**
   * Active set bonuses. Each set's 2-piece and 4-piece effect is { stat, value }:
   * gold/exp/offline are additive fractions, bossReward adds to the boss payout
   * multiplier as a fraction, levelBonusMult multiplies the per-level bonus,
   * comboMax replaces the combo stack cap.
   */
  function relicBonus(state, data) {
    const b = { gold: 0, exp: 0, offline: 0, bossReward: 0, levelBonusMult: 1, comboMax: data.idle.comboMaxStacks };
    for (const set of data.relics.sets) {
      const n = relicCount(state, set);
      for (const [need, eff] of [[2, set.two], [4, set.four]]) {
        if (n < need) continue;
        if (eff.stat === 'levelBonusMult') b.levelBonusMult *= eff.value;
        else if (eff.stat === 'comboMax') b.comboMax = Math.max(b.comboMax, eff.value);
        else b[eff.stat] += eff.value;
      }
    }
    return b;
  }

  /**
   * Pulls `count` relics (uniform over all pieces). Spends `cost`; duplicates refund
   * `dupRefund` gold each. Returns [{ piece, set, dup }] or null if gold is short.
   */
  function pullRelics(state, data, count, cost, rng) {
    if (state.gold < cost) return null;
    state.gold -= cost;
    if (!state.relics) state.relics = {};
    const all = [];
    for (const set of data.relics.sets) for (const piece of set.pieces) all.push({ piece, set });
    const out = [];
    for (let k = 0; k < count; k++) {
      const r = all[Math.floor(rng() * all.length)];
      const dup = !!state.relics[r.piece.id];
      if (dup) state.gold += data.relics.dupRefund;
      state.relics[r.piece.id] = true;
      out.push({ piece: r.piece, set: r.set, dup });
    }
    return out;
  }

  /** Offline efficiency (fraction of on-screen rate). */
  function offlineEfficiency(state, data, now) {
    return data.idle.offlineRate * (1 + equipBonus(state, 'offline', data) + potentialPct(state, 'offline', data, now) / 100 + relicBonus(state, data).offline);
  }

  function comboStacks(state, data) {
    return Math.min(relicBonus(state, data).comboMax, Math.floor(state.comboSeconds / data.idle.comboSecondsPerStack));
  }

  /** Per-second rates on screen, with a breakdown for the UI. */
  function rates(state, data, now) {
    const i = data.idle;
    const rb = relicBonus(state, data);
    const lvl = (state.level - 1) * i.levelBonusPerLevel * rb.levelBonusMult;
    const combo = comboStacks(state, data) * i.comboBonusPerStack;
    const sk = skillModifiers(state, data, now);
    const expMul = 1 + lvl + combo + sk.exp + rb.exp + equipBonus(state, 'exp', data) + potentialPct(state, 'exp', data, now) / 100;
    const goldMul = (1 + lvl + combo + sk.gold + rb.gold + equipBonus(state, 'gold', data) + potentialPct(state, 'gold', data, now) / 100) * sk.goldMult;
    return { expPerSec: i.baseExpPerSec * expMul, goldPerSec: i.baseGoldPerSec * goldMul, expMul, goldMul, combo, skill: sk };
  }

  /** Adds EXP and resolves level-ups. Returns number of levels gained. */
  function addExp(state, amount, data) {
    state.exp += amount;
    let gained = 0;
    while (state.exp >= expToNext(state.level, data)) {
      state.exp -= expToNext(state.level, data);
      state.level++; gained++;
    }
    return gained;
  }

  /**
   * Advances `seconds` of on-screen study into the bank (state.bank) without paying
   * it out. Returns the { exp, gold } added. Paid by `payout` when a mob dies.
   */
  function accrue(state, data, seconds, now) {
    const r = rates(state, data, now);
    const exp = r.expPerSec * seconds;
    const gold = r.goldPerSec * seconds;
    if (!state.bank) state.bank = { exp: 0, gold: 0 };
    state.bank.exp += exp;
    state.bank.gold += gold;
    advanceClock(state, seconds, now);
    return { exp, gold };
  }

  /** Pays the bank times `mult` into gold/EXP and empties it. Returns { exp, gold, levels }. */
  function payout(state, data, mult) {
    const b = state.bank || { exp: 0, gold: 0 };
    const gold = b.gold * mult;
    const exp = b.exp * mult;
    state.gold += gold;
    const levels = addExp(state, exp, data);
    state.bank = { exp: 0, gold: 0 };
    return { exp, gold, levels };
  }

  /** Advances `seconds` of on-screen study and pays it at once. Returns { exp, gold, levels }. */
  function tick(state, data, seconds, now) {
    const r = rates(state, data, now);
    const exp = r.expPerSec * seconds;
    const gold = r.goldPerSec * seconds;
    state.gold += gold;
    const levels = addExp(state, exp, data);
    advanceClock(state, seconds, now);
    return { exp, gold, levels };
  }

  function advanceClock(state, seconds, now) {
    state.comboSeconds += seconds;
    state.totalStudySec += seconds;
    if (state.classId === 'rogue') {
      const k = dayKey(now);
      if (state.rogueDay !== k) { state.rogueDay = k; state.rogueUsedSec = 0; }
      state.rogueUsedSec += seconds;
    }
    state.lastTick = now;
  }

  /** Away-time reward when the app reopens. Mutates state; returns gains and seconds counted. */
  function applyOffline(state, data, now) {
    const i = data.idle;
    const away = Math.max(0, (now - state.lastTick) / 1000);
    const seconds = Math.min(away, i.offlineCapHours * 3600);
    if (seconds < 60) { state.lastTick = now; return { seconds: 0, exp: 0, gold: 0, levels: 0 }; }
    const base = { ...state, comboSeconds: 0 };
    const r = rates(base, data, now);
    const eff = offlineEfficiency(state, data, now);
    const exp = r.expPerSec * seconds * eff;
    const gold = (r.goldPerSec / r.skill.goldMult) * seconds * eff; // rogue's clone needs you on screen
    state.gold += gold;
    const levels = addExp(state, exp, data);
    state.comboSeconds = 0;
    state.lastTick = now;
    return { seconds, exp, gold, levels };
  }

  /** Leaving the screen breaks focus combo unless a foodie shield absorbs it. */
  function breakCombo(state) {
    if (state.comboSeconds <= 0) return { broken: false, shielded: false };
    if (state.shieldsLeft > 0) { state.shieldsLeft--; return { broken: false, shielded: true }; }
    state.comboSeconds = 0;
    return { broken: true, shielded: false };
  }

  function upgradeCost(level, data) {
    return Math.floor(data.equipment.upgradeCostBase * Math.pow(data.equipment.upgradeCostGrowth, level));
  }

  /** Spends gold to upgrade a slot. Returns true on success. */
  function upgrade(state, slotId, data) {
    const item = state.equipment[slotId];
    const cost = upgradeCost(item.level, data);
    if (state.gold < cost) return false;
    state.gold -= cost; item.level++;
    return true;
  }

  function rerollCost(level, data) {
    return data.potential.rerollCostBase + data.potential.rerollCostPerItemLevel * level;
  }

  /** Spends gold to reroll all 3 lines of a slot. Returns the new lines or null. */
  function reroll(state, slotId, data, rng) {
    const item = state.equipment[slotId];
    const cost = rerollCost(item.level, data);
    if (state.gold < cost) return null;
    state.gold -= cost;
    item.lines = rollLines(data, rng);
    return item.lines;
  }

  /** 'done' | 'failed' | 'urgent' | 'open' */
  function questStatus(q, now) {
    if (q.done) return 'done';
    if (q.due <= now) return 'failed';
    if (q.due - now <= 24 * HOUR) return 'urgent';
    return 'open';
  }

  /** Clears a quest. Returns reward or null (already done / overdue). */
  function completeQuest(state, id, data, now) {
    const q = state.quests.find(x => x.id === id);
    if (!q || questStatus(q, now) === 'done' || questStatus(q, now) === 'failed') return null;
    const mul = 1 + equipBonus(state, 'quest', data) + potentialPct(state, 'quest', data, now) / 100;
    const gold = data.quests.baseGold * mul;
    const exp = data.quests.baseExp * mul;
    let planner = false;
    const p = data.classes.planner;
    if (state.classId === 'planner' && q.due - now >= p.earlyHours * HOUR) {
      state.plannerBuffUntil = now + p.buffMinutes * 60000; planner = true;
    }
    q.done = true;
    state.gold += gold;
    const levels = addExp(state, exp, data);
    return { gold, exp, levels, planner };
  }

  /** Uni test scoring: `picks` is an array of class ids. Ties broken by rng. */
  function assignClass(picks, data, rng) {
    const score = {};
    for (const id in data.classes) score[id] = 0;
    for (const p of picks) score[p]++;
    const max = Math.max(...Object.values(score));
    const top = Object.keys(score).filter(k => score[k] === max);
    return top[Math.floor(rng() * top.length)];
  }

  // ---------- rounds & combat ----------

  /** Hero auto-attack damage. */
  function heroAtk(state, data) {
    const c = data.combat;
    return c.atkBase * (1 + c.atkPerLevel * (state.level - 1));
  }

  /** { isBoss, count } for a round number (1-based). */
  function roundInfo(round, data) {
    const isBoss = round % data.combat.bossEvery === 0;
    return { isBoss, count: isBoss ? 1 : data.combat.mobsPerRound };
  }

  /** Max HP of a mob in `round`. */
  function mobHp(round, isBoss, data) {
    const c = data.combat;
    const hp = c.mobHpBase * Math.pow(c.mobHpGrowth, round - 1);
    return Math.ceil(isBoss ? hp * c.bossHpMult : hp);
  }

  /** Records a kill. Returns { roundCleared, round } after the update. */
  function recordKill(state, data) {
    const info = roundInfo(state.round || 1, data);
    state.roundKills = (state.roundKills || 0) + 1;
    state.kills = (state.kills || 0) + 1;
    if (state.roundKills >= info.count) {
      state.round = (state.round || 1) + 1;
      state.roundKills = 0;
      return { roundCleared: true, round: state.round };
    }
    return { roundCleared: false, round: state.round };
  }

  /** Boss timer ran out: drop back one round. */
  function failBoss(state) {
    state.round = Math.max(1, (state.round || 1) - 1);
    state.roundKills = 0;
  }

  /** This class's skills with unlock state and level. */
  function classSkills(state, data) {
    const list = data.skills.byClass[state.classId] || [];
    return list.map((def, tier) => ({
      def, tier,
      unlocked: state.level >= def.unlock,
      level: (state.skills && state.skills[def.id]) || 1
    }));
  }

  function skillUpgradeCost(tier, level, data) {
    const s = data.skills;
    return Math.floor(s.upgradeCostBase * s.tierCostMult[tier] * Math.pow(s.upgradeCostGrowth, level - 1));
  }

  /** Spends gold to level a skill. Returns true on success. */
  function upgradeSkill(state, skillId, data) {
    const sk = classSkills(state, data).find(s => s.def.id === skillId);
    if (!sk || !sk.unlocked) return false;
    const cost = skillUpgradeCost(sk.tier, sk.level, data);
    if (state.gold < cost) return false;
    state.gold -= cost;
    if (!state.skills) state.skills = {};
    state.skills[skillId] = sk.level + 1;
    return true;
  }

  /** Damage per hit of a skill at its current level (haste skills return 0). */
  function skillHitDamage(state, skillId, data) {
    const sk = classSkills(state, data).find(s => s.def.id === skillId);
    if (!sk || sk.def.type === 'haste') return 0;
    return heroAtk(state, data) * sk.def.mult * (1 + data.skills.dmgPerLevel * (sk.level - 1));
  }

  /** Haste multiplier and duration for a haste skill, scaled by level (+10%/level duration). */
  function skillHaste(state, skillId, data) {
    const sk = classSkills(state, data).find(s => s.def.id === skillId);
    if (!sk || sk.def.type !== 'haste') return null;
    return { mult: sk.def.mult, dur: sk.def.dur * (1 + 0.1 * (sk.level - 1)) };
  }

  const api = {
    relicCount, relicBonus, pullRelics, offlineEfficiency,
    heroAtk, roundInfo, mobHp, recordKill, failBoss, classSkills, skillUpgradeCost, upgradeSkill,
    skillHitDamage, skillHaste,
    HOUR, expToNext, rollLine, newState, potentialPct, equipBonus, skillModifiers, comboStacks,
    rates, addExp, tick, accrue, payout, applyOffline, breakCombo, upgradeCost, upgrade, rerollCost, reroll,
    questStatus, completeQuest, assignClass
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GameLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
