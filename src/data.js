/**
 * UNI-VERSE demo — all gameplay values live here (data-driven, no magic numbers in logic).
 * Source: design/game-brief.md (MVP 1–6). Tune numbers here, not in logic.js.
 */
window.GAME_DATA = {
  saveKey: 'universe-demo-v1',
  spriteBase: '../assets/sprites/classes/',
  tickMs: 1000,

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
