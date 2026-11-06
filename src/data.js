/**
 * UNI-VERSE demo — all gameplay values live here (data-driven, no magic numbers in logic).
 * Source: design/game-brief.md (MVP 1–6). Tune numbers here, not in logic.js.
 */
window.GAME_DATA = {
  saveKey: 'universe-demo-v1',
  spriteBase: '../assets/sprites/classes/',
  tickMs: 1000,

  /**
   * Campus battle scene. Idle gains bank up while walking and pay out when a mob
   * dies, so rewards are visible. Bosses pay `bossMult` times the bank.
   */
  battle: {
    mobBase: '../assets/sprites/mobs/',
    sceneHeight: 230,
    heroX: 64,
    heroSize: 84,
    mobSize: 72,
    bossSize: 120,
    walkSpeed: 120,         // px/s ground scroll
    engageDistance: 74,     // px between hero and mob when the fight starts
    hitInterval: 0.4,       // s between hero auto attacks
    bossMult: 3,
    mobs: [
      { name: '무임승차 슬라임',   sprite: 'slime.png', hue: 0 },
      { name: '지각 슬라임',       sprite: 'slime.png', hue: 160 },
      { name: '과제 미루기 슬라임', sprite: 'slime.png', hue: 260 }
    ],
    bosses: [
      { name: '무임승차 슬라임 킹', sprite: 'slime.png' },
      { name: 'F폭격 교수',        sprite: 'professor.png' },
      { name: '영어 회화 마왕',    sprite: 'english.png', scale: 1.4 },
      { name: '이별의 망령',       sprite: 'breakup.png' },
      { name: '입영통지 헌병',     sprite: 'army.png', scale: 1.4 }
    ]
  },

  /**
   * Rounds and combat math. A round is `mobsPerRound` mobs; every `bossEvery`-th
   * round is a boss gate: you keep farming normal mobs there until you press
   * "보스 도전". The boss has `bossHpMult` × mob HP and a time limit; losing (timer
   * or hero HP 0) sends you back to farming at the gate.
   */
  combat: {
    mobsPerRound: 3,
    bossEvery: 5,
    mobHpBase: 40,
    mobHpGrowth: 1.12,       // per round
    bossHpMult: 20,
    bossTimeLimit: 30,       // seconds
    atkBase: 10,
    atkPerLevel: 0.12,       // +12% attack per level above 1
    heroHpBase: 200,
    heroHpPerLevel: 0.25,    // +25% max HP per level above 1
    heroRegenPerSec: 0.04,   // fraction of max HP regained per second while walking
    respawnSec: 3,
    mobAtkBase: 6,           // damage per mob attack at round 1 (grows like HP)
    mobAtkInterval: 1.0,     // s between mob attacks
    bossAtkMult: 1.5
  },

  /**
   * Attack skills: 3 per class, unlocked by level, upgraded with gold, auto-cast
   * in battle when off cooldown. type 'nuke' = one hit of mult × ATK,
   * 'multi' = `hits` hits of mult × ATK, 'haste' = attack speed × mult for `dur` s.
   * anim (visual only) names a function in scene.js ANIMS (swing, bubbles,
   * shockwave, daggers, blink, eclipse, slam, lightning, eruption, shieldbash,
   * stamps, aura, dashthrough, clones, comet) or a generic one (projectile, meteor,
   * beam, slashes, summon, rain). fx is the emoji used by the effect.
   */
  skills: {
    dmgPerLevel: 0.25,       // +25% skill damage per skill level above 1
    upgradeCostBase: 120,
    upgradeCostGrowth: 1.55,
    tierCostMult: [1, 2.5, 6],
    byClass: {
      insider: [
        { id: 'flag', anim: 'swing', fx: '🚩', name: '깃발 휘두르기', unlock: 1,  type: 'nuke',  mult: 3,   cd: 4,  desc: '학잠 깃발로 강타' },
        { id: 'groupcall', anim: 'bubbles', fx: '💬', name: '단톡방 소환', unlock: 5,  type: 'multi', hits: 5, mult: 1.2, cd: 10, desc: '길드원 5명이 몰려와 때린다' },
        { id: 'insta', anim: 'shockwave', fx: '🎉', name: '인싸력 폭발',   unlock: 10, type: 'nuke',  mult: 12,  cd: 25, desc: '오라가 폭발하며 큰 피해' }
      ],
      hermit: [
        { id: 'dagger', anim: 'daggers', fx: '🗡️', name: '노트북 단검',   unlock: 1,  type: 'multi', hits: 2, mult: 1.8, cd: 3, desc: '두 번 빠르게 찌른다' },
        { id: 'shadow', anim: 'blink', fx: '🌙', name: '그림자 습격',   unlock: 5,  type: 'nuke',  mult: 6,   cd: 9,  desc: '어둠 속에서 급습' },
        { id: 'midnight', anim: 'eclipse', fx: '🌑', name: '심야의 암살',  unlock: 10, type: 'nuke',  mult: 15,  cd: 25, desc: '초승달 일격' }
      ],
      berserker: [
        { id: 'pencil', anim: 'slam', fx: '✏️', name: '연필검 내려찍기', unlock: 1, type: 'nuke', mult: 3.5, cd: 5,  desc: '거대 연필검으로 내려찍기' },
        { id: 'cram', anim: 'lightning', fx: '⚡', name: '벼락치기 연타',  unlock: 5,  type: 'multi', hits: 8, mult: 0.9, cd: 12, desc: '정신없이 8연타' },
        { id: 'deadline', anim: 'eruption', fx: '🔥', name: '데드라인 폭발', unlock: 10, type: 'nuke',  mult: 14,  cd: 25, desc: '붉은 불꽃 대폭발' }
      ],
      planner: [
        { id: 'shield', anim: 'shieldbash', fx: '🛡️', name: '플래너 방패 강타', unlock: 1, type: 'nuke', mult: 2.8, cd: 4, desc: '방패로 후려친다' },
        { id: 'checklist', anim: 'stamps', fx: '✅', name: '체크리스트 연격', unlock: 5, type: 'multi', hits: 4, mult: 1.6, cd: 10, desc: '할 일을 하나씩 지운다' },
        { id: 'timeline', anim: 'aura', fx: '⏰', name: '완벽한 타임라인', unlock: 10, type: 'haste', mult: 3, dur: 10, cd: 30, desc: '10초간 공격 속도 3배' }
      ],
      foodie: [
        { id: 'tray', anim: 'projectile', fx: '🍱', name: '식판 던지기',   unlock: 1,  type: 'nuke',  mult: 3,   cd: 4.5, desc: '식판 투척' },
        { id: 'soup', anim: 'rain', fx: '🍲', name: '뜨거운 국밥',   unlock: 5,  type: 'multi', hits: 6, mult: 1.1, cd: 11, desc: '펄펄 끓는 국물 세례' },
        { id: 'feast', anim: 'meteor', fx: '🍚', name: '학식 대폭발',   unlock: 10, type: 'nuke',  mult: 13,  cd: 25, desc: '오늘의 특식이 터진다' }
      ],
      rogue: [
        { id: 'dash', anim: 'dashthrough', fx: '💨', name: '출튀 대시',     unlock: 1,  type: 'multi', hits: 3, mult: 1.2, cd: 3.5, desc: '스치듯 3연타' },
        { id: 'clones', anim: 'clones', fx: '👤', name: '분신 난무',     unlock: 5,  type: 'multi', hits: 6, mult: 1.3, cd: 10, desc: '분신들이 동시에 공격' },
        { id: 'comet', anim: 'comet', fx: '☄️', name: '혜성 강하',     unlock: 10, type: 'nuke',  mult: 14,  cd: 25, desc: '혜성처럼 떨어진다' }
      ]
    }
  },

  /**
   * Relic gacha: 3 sets × 4 pieces, uniform odds, no equipping — owning pieces
   * activates set effects (see logic.js#relicBonus for the stat meanings).
   */
  relics: {
    pullCost: 300,
    tenCost: 2700,
    dupRefund: 50,
    sets: [
      { id: 'checkshirt', name: '고인물의 체크셔츠', icon: '👕',
        pieces: [
          { id: 'shirt', name: '체크셔츠', icon: '👕' }, { id: 'idcard', name: '학생증', icon: '🪪' },
          { id: 'slipper', name: '슬리퍼', icon: '🩴' }, { id: 'keyring', name: '백팩 키링', icon: '🔑' } ],
        two:  { stat: 'gold', value: 0.15, label: '골드 +15%' },
        four: { stat: 'bossReward', value: 1.0, label: '보스 보상 +100%' } },
      { id: 'freshman', name: '새내기의 꿈', icon: '🌱',
        pieces: [
          { id: 'jacket', name: '새 학잠', icon: '🧥' }, { id: 'timetable', name: '시간표', icon: '🗓' },
          { id: 'nametag', name: 'OT 명찰', icon: '📛' }, { id: 'guidebook', name: '신입생 가이드북', icon: '📘' } ],
        two:  { stat: 'exp', value: 0.15, label: 'EXP +15%' },
        four: { stat: 'levelBonusMult', value: 2, label: '레벨 보너스 2배' } },
      { id: 'library', name: '도서관 지박령', icon: '📚',
        pieces: [
          { id: 'seat', name: '열람실 좌석표', icon: '🎫' }, { id: 'earplug', name: '귀마개', icon: '🎧' },
          { id: 'americano', name: '아메리카노', icon: '☕' }, { id: 'highlighter', name: '형광펜', icon: '🖍' } ],
        two:  { stat: 'offline', value: 0.20, label: '오프라인 효율 +20%' },
        four: { stat: 'comboMax', value: 20, label: '집중 콤보 최대 20스택' } }
    ]
  },

  /**
   * 학점 펫 gacha. Grade sets the floor/ceiling of each potential line (%).
   * One pet per grade; a duplicate grade refunds gold. The equipped pet follows
   * the hero in battle. Stats: atk/hp feed combat, exp/gold feed idle rates.
   */
  pets: {
    spriteBase: '../assets/sprites/pets/',
    pullCost: 500,
    tenCost: 4500,
    dupRefund: 100,
    lines: 2,
    rerollCostBase: 200,          // × grade index + 1
    stats: [
      { id: 'atk',  label: '공격력' },
      { id: 'hp',   label: '최대 HP' },
      { id: 'exp',  label: '경험치 획득량' },
      { id: 'gold', label: '골드 획득량' }
    ],
    grades: [
      { id: 'F',  name: 'F',  sprite: 'F.png',  weight: 25, min: 1,  max: 5,  color: '#9aa6d8' },
      { id: 'D0', name: 'D0', sprite: 'D0.png', weight: 20, min: 3,  max: 8,  color: '#9aa6d8' },
      { id: 'Dp', name: 'D+', sprite: 'Dp.png', weight: 16, min: 5,  max: 12, color: '#5ab4ff' },
      { id: 'C0', name: 'C0', sprite: 'C0.png', weight: 13, min: 8,  max: 16, color: '#5ab4ff' },
      { id: 'Cp', name: 'C+', sprite: 'Cp.png', weight: 10, min: 12, max: 22, color: '#b57bff' },
      { id: 'B0', name: 'B0', sprite: 'B0.png', weight: 7,  min: 16, max: 28, color: '#b57bff' },
      { id: 'Bp', name: 'B+', sprite: 'Bp.png', weight: 5,  min: 22, max: 36, color: '#ffcc33' },
      { id: 'A0', name: 'A0', sprite: 'A0.png', weight: 3,  min: 30, max: 50, color: '#ffcc33' },
      { id: 'Ap', name: 'A+', sprite: 'Ap.png', weight: 1,  min: 50, max: 75, color: '#6dff8a' }
    ]
  },

  /**
   * Per-class battle effect theme: particle colours and the shape of the basic
   * attack swing. shape: 'square' | 'star' | 'ring' | 'drop'; swing: 'arc' | 'x' | 'line'.
   */
  classFx: {
    insider:   { colors: ['#4aa8ff', '#ffffff', '#ffd84a'], shape: 'star',   swing: 'arc'  },
    hermit:    { colors: ['#7b4bff', '#2a1a5e', '#c6b3ff'], shape: 'square', swing: 'x'    },
    berserker: { colors: ['#ff3a1a', '#ff9a3c', '#ffe14a'], shape: 'square', swing: 'arc'  },
    planner:   { colors: ['#3ee07a', '#ffffff', '#1f8a55'], shape: 'ring',   swing: 'line' },
    foodie:    { colors: ['#ffb347', '#fff3d6', '#ff7a3c'], shape: 'drop',   swing: 'arc'  },
    rogue:     { colors: ['#5af0ff', '#ffffff', '#3a7bff'], shape: 'star',   swing: 'line' }
  },

  /**
   * LMS import: the button opens the LMS calendar export page; the player
   * downloads the .ics file and uploads it here. Parsed in the browser only —
   * nothing is sent to a server. Set exportUrl to the real 코스모스 export page.
   */
  lms: {
    exportUrl: 'https://lms.inu.ac.kr/calendar/export.php',
    // Hourly sync: the player pastes the subscription URL from 「캘린더 URL 얻기」;
    // it stays in this browser and is fetched through the /api/ics proxy (CORS).
    proxy: '/api/ics',
    allowedHost: 'lms.inu.ac.kr',
    syncMinutes: 60,
    rewardGold: 400,
    rewardExp: 120
  },

  /**
   * 길드 점령전 (single-player simulation). You join a 학과; the other 학과 are AI
   * guilds that own campus buildings. Attacking a building is a timed siege
   * against its guardian. Owned buildings give buffs; AI guilds try to retake
   * them every `counterIntervalMin` real minutes (fortify lowers the odds).
   * 학과 names are real (see colleges); building names other than 학산도서관 are placeholders.
   */
  territory: {
    // Source: ko.wikipedia.org/wiki/인천대학교 (개설 학과), with 2025–26 renames
    // (신문방송학과 → 미디어커뮤니케이션학과, 무역학부 → Global Trade & Service학부).
    colleges: [
      { name: '인문대학', color: '#ff9a9a', depts: ['국어국문학과', '독어독문학과', '일어일문학과', '영어영문학과', '불어불문학과', '중어중국학과'] },
      { name: '자연과학대학', color: '#7ad7ff', depts: ['수학과', '물리학과', '화학과', '패션산업학과', '해양학과'] },
      { name: '사회과학대학', color: '#ffc46b', depts: ['사회복지학과', '미디어커뮤니케이션학과', '문헌정보학과', '창의인재개발학과'] },
      { name: '글로벌법정경대학', color: '#c39bff', depts: ['행정학과', '정치외교학과', '경제학과', 'Global Trade & Service학부', '소비자학과', '동북아국제통상학부', '법학부'] },
      { name: '공과대학', color: '#ff7a3c', depts: ['기계공학과', '전기공학과', '전자공학과', '산업경영공학과', '신소재공학과', '안전공학과', '에너지화학공학과', '메카트로닉스공학과'] },
      { name: '정보기술대학', color: '#4aa8ff', depts: ['컴퓨터공학부', '정보통신공학과', '임베디드시스템공학과'] },
      { name: '경영대학', color: '#ff5a9a', depts: ['경영학부', '세무회계학과', '데이터과학과'] },
      { name: '예술체육대학', color: '#ffe14a', depts: ['조형예술학부', '디자인학부', '공연예술학과', '체육학부', '운동건강학부'] },
      { name: '사범대학', color: '#3ee07a', depts: ['국어교육과', '영어교육과', '일어교육과', '수학교육과', '체육교육과', '유아교육과', '역사교육과', '윤리교육과'] },
      { name: '도시과학대학', color: '#9be36b', depts: ['도시행정학과', '도시환경공학부', '도시공학과', '도시건축학부'] },
      { name: '생명과학기술대학', color: '#6bffd1', depts: ['생명과학부', '생명공학부'] }
    ],
    buildings: [
      { id: 'b1',  name: '1호관',   tier: 1,  buff: { stat: 'gold', value: 0.05, label: '골드 +5%' } },
      { id: 'b2',  name: '2호관',   tier: 2,  buff: { stat: 'exp',  value: 0.05, label: 'EXP +5%' } },
      { id: 'b3',  name: '3호관',   tier: 3,  buff: { stat: 'atk',  value: 0.06, label: '공격력 +6%' } },
      { id: 'b4',  name: '4호관',   tier: 4,  buff: { stat: 'hp',   value: 0.08, label: '최대 HP +8%' } },
      { id: 'b5',  name: '5호관',   tier: 5,  buff: { stat: 'gold', value: 0.08, label: '골드 +8%' } },
      { id: 'b6',  name: '6호관',   tier: 6,  buff: { stat: 'exp',  value: 0.08, label: 'EXP +8%' } },
      { id: 'b7',  name: '7호관',   tier: 7,  buff: { stat: 'atk',  value: 0.10, label: '공격력 +10%' } },
      { id: 'b8',  name: '8호관',   tier: 8,  buff: { stat: 'hp',   value: 0.12, label: '최대 HP +12%' } },
      { id: 'lib', name: '학산도서관',   tier: 9,  buff: { stat: 'exp',  value: 0.15, label: 'EXP +15%' } },
      { id: 'sub', name: '학생회관', tier: 10, buff: { stat: 'gold', value: 0.15, label: '골드 +15%' } }
    ],
    siegeHpBase: 500,
    siegeHpGrowth: 1.45,       // per building tier
    siegeAtkBase: 9,
    siegeAtkGrowth: 1.28,
    siegeTimeLimit: 40,        // seconds
    captureRewardMult: 4,      // banked study gains × this on capture
    recLevelPerTier: 4,        // shown as "권장 Lv."
    counterIntervalMin: 15,
    retakeChance: 0.35,        // per owned building per interval, before fortify
    fortifyReduce: 0.07,       // −7%p retake chance per fortify level
    fortifyMax: 5,
    fortifyCostBase: 300,
    fortifyCostGrowth: 1.7,
    maxCounterTicks: 8,        // cap on intervals processed after a long absence
    logSize: 8
  },

  /**
   * 성장 stats bought with gold. Each level adds `per` (fraction, or flat for
   * critRate). Cost = costBase × costGrowth^level. `max` caps the level.
   */
  stats: {
    list: [
      { id: 'atk',      name: '공격력',      icon: '⚔️', per: 0.06, unit: '%', max: 200, costBase: 60,  costGrowth: 1.15 },
      { id: 'hp',       name: '최대 HP',     icon: '❤️', per: 0.08, unit: '%', max: 200, costBase: 60,  costGrowth: 1.15 },
      { id: 'critRate', name: '치명타 확률', icon: '🎯', per: 0.01, unit: '%', max: 50,  costBase: 150, costGrowth: 1.22 },
      { id: 'critDmg',  name: '치명타 피해', icon: '💥', per: 0.05, unit: '%', max: 100, costBase: 150, costGrowth: 1.2 },
      { id: 'aspd',     name: '공격 속도',   icon: '⚡', per: 0.02, unit: '%', max: 50,  costBase: 200, costGrowth: 1.25 }
    ],
    baseCritRate: 0.05,
    baseCritDmg: 1.5
  },

  /** Demo/testing helpers shown in the 정보 tab. */
  debug: { testGold: 10000 },

  /** Idle farming (MVP 2). Rates are per second at level 1 with no bonuses. */
  idle: {
    baseExpPerSec: 1,
    baseGoldPerSec: 2,
    levelBonusPerLevel: 0.05,      // +5% EXP/gold per level above 1
    expCurveBase: 60,              // EXP needed for level 2
    expCurveGrowth: 1.18,          // each level needs 18% more
    offlineRate: 0.5,              // away time earns 50% of on-screen rate
    offlineCapHours: 8,
    comboSecondsPerStack: 60,      // 1 focus stack per minute on screen
    comboMaxStacks: 10,
    comboBonusPerStack: 0.05       // +5% per stack, up to +50%
  },

  /** Equipment (MVP 3). Each slot boosts one stat per upgrade level. */
  equipment: {
    upgradeCostBase: 40,
    upgradeCostGrowth: 1.3,
    slots: [
      { id: 'book',     name: '전공책', icon: '📕', stat: 'exp',     perLevel: 0.06 },
      { id: 'laptop',   name: '노트북', icon: '💻', stat: 'gold',    perLevel: 0.06 },
      { id: 'tumbler',  name: '텀블러', icon: '🥤', stat: 'quest',   perLevel: 0.08 },
      { id: 'backpack', name: '백팩',   icon: '🎒', stat: 'offline', perLevel: 0.08 }
    ]
  },

  /** Potential lines (MVP 3). 3 lines per item, rerolled with gold. */
  potential: {
    rerollCostBase: 60,
    rerollCostPerItemLevel: 15,
    lines: 3,
    grades: [
      { id: 'rare',      name: '레어',     weight: 60, min: 3,  max: 6,  color: '#5ab4ff' },
      { id: 'epic',      name: '에픽',     weight: 28, min: 7,  max: 12, color: '#b57bff' },
      { id: 'unique',    name: '유니크',   weight: 10, min: 13, max: 20, color: '#ffcc33' },
      { id: 'legendary', name: '레전드리', weight: 2,  min: 21, max: 30, color: '#6dff8a' }
    ],
    stats: [
      { id: 'exp',     label: '경험치 획득량' },
      { id: 'gold',    label: '골드 획득량' },
      { id: 'quest',   label: '퀘스트 보상' },
      { id: 'offline', label: '오프라인 효율' }
    ]
  },

  /** Quests (MVP 4). Demo uses sample assignments; due = now + hours at first run. */
  quests: {
    baseGold: 400,
    baseExp: 120,
    sample: [
      { subject: '임베디드시스템', title: '3주차 실습 보고서', dueInHours: 18 },
      { subject: '자료구조',       title: '과제 #2 연결 리스트 구현', dueInHours: 80 },
      { subject: '대학영어',       title: 'Essay Draft 제출', dueInHours: 40 },
      { subject: '선형대수',       title: '연습문제 4.1~4.3', dueInHours: 150 },
      { subject: '교양 심리학',     title: '중간 리포트', dueInHours: -5 }
    ],
    dungeons: ['의 지하 서고', '의 저주받은 강의실', '의 잊혀진 실습실', '의 심연 열람실'],
    monsters: ['망각의 리치', '무임승차 슬라임', '마감의 망령', '표절의 도플갱어', '졸음의 서큐버스']
  },

  /** Classes and skills (MVP 1, 5). Skill math lives in logic.js#skillModifiers. */
  classes: {
    insider: {
      name: '초인싸 유니', role: '파티장', sprite: 'insider.png',
      skill: '인싸력 폭발', desc: '근처 길드원 1명당 골드 +10% (데모: 2명 가정)',
      demoNearbyMembers: 2, goldPerMember: 0.10
    },
    hermit: {
      name: '은둔형 유니', role: '그림자 암살자', sprite: 'hermit.png',
      skill: '심야의 암살자', desc: '01:00~05:00 방치 시 경험치 +30%',
      nightStart: 1, nightEnd: 5, nightExp: 0.30
    },
    berserker: {
      name: '벼락치기 유니', role: '버서커', sprite: 'berserker_1.png',
      frames: ['berserker_1.png', 'berserker_2.png', 'berserker_3.png', 'berserker_4.png'],
      frameUnlocks: [1, 5, 10, 20],  // sprite changes as skills unlock (Lv20: awakened)
      skill: '데드라인의 지배자', desc: '24시간 내 마감 퀘스트가 있으면 경험치·골드 +50%',
      deadlineHours: 24, deadlineBonus: 0.50
    },
    planner: {
      name: '계획형 유니', role: '전략가', sprite: 'planner.png',
      skill: '완벽한 타임라인', desc: '마감 3일 전 클리어 시 [계획의 징표]: 30분간 잠재능력 수치 +30%',
      earlyHours: 72, buffMinutes: 30, potentialBoost: 0.30
    },
    foodie: {
      name: '학식 미식가 유니', role: '힐러', sprite: 'foodie.png',
      skill: '든든한 국밥', desc: '화면을 벗어나 집중 콤보가 끊겨도 1회 보호 (재접속마다 충전)',
      shields: 1
    },
    rogue: {
      name: '출튀 유니', role: '도적', sprite: 'rogue.png',
      skill: '환영 분신', desc: '하루 첫 1시간 동안 두 건물 동시 체크인: 골드 x2',
      dailyMinutes: 60, goldMultiplier: 2
    }
  },

  /** Uni test (MVP 1). Each answer adds 1 point to its class; ties pick randomly. */
  uniTest: [
    { q: '과제 공지가 올라왔다!', a: [
      ['바로 플래너에 적는다', 'planner'], ['마감 전날 몰아서 한다', 'berserker'],
      ['단톡방에 공유한다', 'insider'], ['일단 학식부터 먹는다', 'foodie'] ] },
    { q: '출석 부르는 수업, 내 자리는?', a: [
      ['맨 앞자리', 'planner'], ['친구들이랑 뒷자리', 'insider'],
      ['출석만 하고 문 쪽', 'rogue'], ['아무도 없는 구석', 'hermit'] ] },
    { q: '공부가 제일 잘 되는 시간은?', a: [
      ['다들 자는 새벽', 'hermit'], ['마감 3시간 전', 'berserker'],
      ['정해둔 루틴 시간', 'planner'], ['밥 먹고 든든할 때', 'foodie'] ] },
    { q: '팀플에서 나는…', a: [
      ['조장, 단톡방 방장', 'insider'], ['조용히 자료조사 다 함', 'hermit'],
      ['발표 전날 밤샘 담당', 'berserker'], ['회의 끝나면 사라짐', 'rogue'] ] },
    { q: '공강 시간에는?', a: [
      ['학식 맛집 탐방', 'foodie'], ['동아리방 출근', 'insider'],
      ['학교 탈출', 'rogue'], ['다음 수업 예습', 'planner'] ] }
  ]
};
