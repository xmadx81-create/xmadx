const SAVE_KEY = 'redledger_save';

const DEFAULT_SAVE = {
  centerLevel: 1,
  centerXP: 0,
  cards: {},
  inventory: [],
  stageClears: {},
  quests: { daily: [], weekly: [], monthly: null, lastDailyReset: null, lastWeeklyReset: null, attendance: 0, lastLogin: null },
  stats: { wins: 0, losses: 0, totalBattles: 0, totalKills: 0 },
  towerBest: 0,
  defenseBest: 0,
  lastTeam: [],
  achievements: {},
  onboarded: false,
  recruitTickets: 3,
  bonds: {},
};

const STARTER_DECK = ['kim-doyun', 'choi-minseo', 'kwon-jihye'];

export function ensureStarterDeck(save) {
  if (Object.keys(save.cards).length > 0) return;
  STARTER_DECK.forEach(id => {
    save.cards[id] = { level: 1, xp: 0, count: 1 };
  });
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      const fresh = { ...DEFAULT_SAVE, cards: {}, quests: { ...DEFAULT_SAVE.quests }, stats: { ...DEFAULT_SAVE.stats } };
      ensureStarterDeck(fresh);
      return fresh;
    }
    const save = JSON.parse(raw);
    if (!save.stageClears) save.stageClears = {};
    if (!save.inventory) save.inventory = [];
    if (save.towerBest === undefined) save.towerBest = 0;
    if (save.defenseBest === undefined) save.defenseBest = 0;
    if (!save.lastTeam) save.lastTeam = [];
    if (!save.achievements) save.achievements = {};
    if (!save.bonds) save.bonds = {};
    ensureStarterDeck(save);
    return save;
  } catch { return { ...DEFAULT_SAVE }; }
}

export function saveGame(data) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function getCardData(save, charId) {
  return save.cards[charId] || { level: 1, xp: 0, count: 1 };
}

export function addCard(save, charId, rarity) {
  if (!save.cards[charId]) save.cards[charId] = { level: 1, xp: 0, count: 0 };
  save.cards[charId].count++;
  const rarityXP = { common: 5, uncommon: 15, rare: 30, legendary: 50 };
  save.centerXP += rarityXP[rarity] || 5;
  updateCenterLevel(save);
}

export function synthesizeCard(save, charId) {
  const card = save.cards[charId];
  if (!card) return { ok: false, reason: '카드 없음' };
  const cost = card.level < 3 ? 3 : card.level < 5 ? 4 : 5;
  if (card.count < cost) return { ok: false, reason: `카드 ${cost}장 필요 (현재 ${card.count}장)` };
  card.count -= (cost - 1);
  card.level++;
  card.xp = 0;
  save.centerXP += card.level * 10;
  save.synthCount = (save.synthCount || 0) + 1;
  updateCenterLevel(save);
  return { ok: true, newLevel: card.level, cost, remaining: card.count };
}

export function getSynthesisCost(level) {
  return level < 3 ? 3 : level < 5 ? 4 : 5;
}

export const ENHANCE_COSTS = { atk: 2, def: 2, hp: 3, crt: 3, eva: 3 };
export const ENHANCE_MAX = 10;

export function enhanceCard(save, charId, stat) {
  const card = save.cards[charId];
  if (!card) return { ok: false, reason: '카드 없음' };
  if (!card.enhance) card.enhance = { atk: 0, def: 0, hp: 0, crt: 0, eva: 0 };
  const cost = ENHANCE_COSTS[stat];
  if (!cost) return { ok: false, reason: '잘못된 스탯' };
  if (card.enhance[stat] >= ENHANCE_MAX) return { ok: false, reason: '최대 강화 도달' };
  if (card.count < cost) return { ok: false, reason: `카드 ${cost}장 필요 (현재 ${card.count}장)` };
  card.count -= cost;
  card.enhance[stat]++;
  return { ok: true, stat, newVal: card.enhance[stat], remaining: card.count };
}

export const LORE_MILESTONES = [
  { level: 1, label: '1단계 — 첫 만남' },
  { level: 3, label: '2단계 — 신뢰' },
  { level: 5, label: '3단계 — 진실' },
];

export function getUnlockedLoreStage(save, charId) {
  const card = save.cards[charId];
  if (!card || card.count <= 0) return 0;
  if (card.level >= 5) return 3;
  if (card.level >= 3) return 2;
  return 1;
}

function updateCenterLevel(save) {
  const totalCardLevels = Object.values(save.cards).reduce((s, c) => s + c.level * c.count, 0);
  save.centerXP = Math.max(save.centerXP, totalCardLevels);
  const nextLevel = save.centerLevel * 100;
  while (save.centerXP >= nextLevel) {
    save.centerXP -= save.centerLevel * 100;
    save.centerLevel++;
  }
}

export function getCenterBuff(save) {
  const commonCount = Object.entries(save.cards)
    .filter(([, c]) => c.count > 0)
    .length;
  return {
    defBuff: Math.floor(save.centerLevel * 0.5),
    atkBuff: Math.floor(commonCount * 0.2),
    hpBuff: save.centerLevel * 2,
    label: `센터 Lv.${save.centerLevel} — DEF+${Math.floor(save.centerLevel*0.5)} ATK+${Math.floor(commonCount*0.2)} HP+${save.centerLevel*2}`,
  };
}

// ── Quests ──

const DAILY_QUEST_POOL = [
  { id: 'dq-battle-1', name: '일일 전투 1회', goal: 1, type: 'battle', reward: { cards: ['common'], xp: 20 } },
  { id: 'dq-battle-3', name: '일일 전투 3회', goal: 3, type: 'battle', reward: { cards: ['common','common'], xp: 50 } },
  { id: 'dq-kill-5', name: '적 5명 처치', goal: 5, type: 'kill', reward: { cards: ['common'], xp: 30 } },
  { id: 'dq-win-1', name: '승리 1회', goal: 1, type: 'win', reward: { cards: ['common','uncommon'], xp: 40 } },
  { id: 'dq-skill-3', name: '스킬 3회 사용', goal: 3, type: 'skill', reward: { cards: ['common'], xp: 25 } },
  { id: 'dq-ult-1', name: '궁극기 1회 사용', goal: 1, type: 'ultimate', reward: { cards: ['uncommon'], xp: 35 } },
];

const WEEKLY_QUEST_POOL = [
  { id: 'wq-battle-10', name: '주간 전투 10회', goal: 10, type: 'battle', reward: { cards: ['rare','common','common','common'], xp: 200 } },
  { id: 'wq-win-5', name: '주간 승리 5회', goal: 5, type: 'win', reward: { cards: ['rare','uncommon'], xp: 300 } },
  { id: 'wq-kill-30', name: '주간 적 30명 처치', goal: 30, type: 'kill', reward: { cards: ['uncommon','uncommon','common','common','common'], xp: 250 } },
  { id: 'wq-stage4', name: '스테이지 4 클리어', goal: 1, type: 'clear_stage4', reward: { cards: ['rare','rare'], xp: 400 } },
  { id: 'wq-ult-5', name: '궁극기 5회 사용', goal: 5, type: 'ultimate', reward: { cards: ['uncommon','uncommon','uncommon'], xp: 200 } },
];

const MONTHLY_QUEST = { id: 'mq-attend', name: '월간 만근 보상 (20일 출석)', goal: 20, type: 'attendance', reward: { cards: ['legendary','rare','rare','uncommon','uncommon','uncommon','common','common','common','common'], xp: 1000 } };

const ATTENDANCE_REWARDS = [
  { day: 1, cards: ['common'], tickets: 1, items: ['heal'] },
  { day: 2, cards: ['common'], tickets: 1 },
  { day: 3, cards: ['common', 'common'], tickets: 2 },
  { day: 5, cards: ['uncommon'], tickets: 2, items: ['mp', 'heal'] },
  { day: 7, cards: ['uncommon', 'common', 'common'], tickets: 3 },
  { day: 10, cards: ['rare'], tickets: 3, items: ['atkBuff', 'defBuff'] },
  { day: 14, cards: ['rare', 'uncommon'], tickets: 5 },
  { day: 20, cards: ['legendary'], tickets: 5, items: ['crtBuff', 'xp'] },
  { day: 30, cards: ['legendary', 'rare', 'rare'], tickets: 10, items: ['heal', 'mp', 'atkBuff', 'defBuff', 'crtBuff'] },
];

export function refreshQuests(save) {
  const now = new Date();
  const today = now.toDateString();

  if (save.quests.lastLogin !== today) {
    save.quests.attendance++;
    save.quests.lastLogin = today;
  }

  if (!save.quests.lastDailyReset || new Date(save.quests.lastDailyReset).toDateString() !== today) {
    const shuffled = [...DAILY_QUEST_POOL].sort(() => Math.random() - 0.5);
    save.quests.daily = shuffled.slice(0, 3).map(q => ({ ...q, progress: 0, completed: false }));
    save.quests.lastDailyReset = now.toISOString();
  }

  const weekStart = getWeekStart(now);
  if (!save.quests.lastWeeklyReset || new Date(save.quests.lastWeeklyReset) < weekStart) {
    const shuffled = [...WEEKLY_QUEST_POOL].sort(() => Math.random() - 0.5);
    save.quests.weekly = shuffled.slice(0, 3).map(q => ({ ...q, progress: 0, completed: false }));
    save.quests.lastWeeklyReset = now.toISOString();
  }

  if (!save.quests.monthly) {
    save.quests.monthly = { ...MONTHLY_QUEST, progress: save.quests.attendance, completed: false };
  } else {
    save.quests.monthly.progress = save.quests.attendance;
  }
}

function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function progressQuest(save, type, amount = 1) {
  const completed = [];
  [...save.quests.daily, ...save.quests.weekly].forEach(q => {
    if (q.completed || q.type !== type) return;
    q.progress += amount;
    if (q.progress >= q.goal) {
      q.completed = true;
      completed.push(q);
    }
  });
  if (save.quests.monthly && !save.quests.monthly.completed && save.quests.monthly.type === type) {
    save.quests.monthly.progress += amount;
    if (save.quests.monthly.progress >= save.quests.monthly.goal) {
      save.quests.monthly.completed = true;
      completed.push(save.quests.monthly);
    }
  }
  return completed;
}

export function getAttendanceReward(attendance) {
  return ATTENDANCE_REWARDS.find(r => r.day === attendance) || null;
}

export function getQuestSummary(save) {
  const daily = save.quests.daily || [];
  const weekly = save.quests.weekly || [];
  const monthly = save.quests.monthly;
  return { daily, weekly, monthly, attendance: save.quests.attendance };
}

export function saveCharProgress(save, battleUnits) {
  if (!battleUnits) return;
  battleUnits.forEach(u => {
    if (u.team !== 'player') return;
    const charId = u.charId || u.id;
    if (!save.cards[charId]) save.cards[charId] = { level: 1, xp: 0, count: 1 };
    const card = save.cards[charId];
    if (u.level > card.level) {
      card.level = u.level;
      card.xp = u.xp;
    } else if (u.level === card.level && u.xp > card.xp) {
      card.xp = u.xp;
    }
  });
}

// ── Achievements ──

const ACHIEVEMENTS = [
  { id: 'first-blood', name: '첫 번째 승리', desc: '전투에서 승리하라', check: s => s.stats.wins >= 1, reward: ['uncommon'] },
  { id: 'veteran', name: '백전노장', desc: '10회 전투', check: s => s.stats.totalBattles >= 10, reward: ['rare'] },
  { id: 'slayer-10', name: '사냥꾼', desc: '적 10명 처치', check: s => s.stats.totalKills >= 10, reward: ['uncommon'] },
  { id: 'slayer-50', name: '학살자', desc: '적 50명 처치', check: s => s.stats.totalKills >= 50, reward: ['rare', 'uncommon'] },
  { id: 'collector-5', name: '수집가', desc: '카드 5종 보유', check: s => Object.keys(s.cards).length >= 5, reward: ['uncommon'] },
  { id: 'collector-20', name: '도감 마스터', desc: '카드 20종 보유', check: s => Object.keys(s.cards).length >= 20, reward: ['rare', 'rare'] },
  { id: 'tower-3', name: '탑 등반가', desc: '무한의 탑 3층 돌파', check: s => (s.towerBest || 0) >= 3, reward: ['rare'] },
  { id: 'tower-10', name: '탑의 정복자', desc: '무한의 탑 10층 돌파', check: s => (s.towerBest || 0) >= 10, reward: ['legendary'] },
  { id: 'perfect', name: '완벽한 승리', desc: '3성 클리어 달성', check: s => Object.values(s.stageClears || {}).some(c => c.stars === 3), reward: ['uncommon', 'common'] },
  { id: 'all-clear', name: '카르테인 토벌', desc: '모든 스테이지 클리어', check: s => {
    const stageIds = ['stage-1','stage-2','stage-3','stage-4','stage-5','stage-6','stage-7'];
    return stageIds.every(id => s.stageClears?.[id]);
  }, reward: ['legendary', 'rare'] },
  { id: 'synth-1', name: '연금술사', desc: '카드 합성 1회', check: s => (s.synthCount || 0) >= 1, reward: ['common', 'common'] },
  { id: 'attend-7', name: '개근상', desc: '7일 출석', check: s => s.quests.attendance >= 7, reward: ['rare'] },
];

export { ACHIEVEMENTS };

export function checkAchievements(save) {
  const newlyUnlocked = [];
  ACHIEVEMENTS.forEach(a => {
    if (save.achievements[a.id]) return;
    if (a.check(save)) {
      save.achievements[a.id] = { unlockedAt: new Date().toISOString() };
      newlyUnlocked.push(a);
    }
  });
  return newlyUnlocked;
}

export function doRecruit(save, characters, count = 1) {
  if ((save.recruitTickets || 0) < count) return { ok: false, reason: '모집권 부족' };
  save.recruitTickets -= count;
  const results = [];
  for (let i = 0; i < count; i++) {
    const roll = Math.random();
    const rarity = roll < 0.02 ? 'legendary' : roll < 0.12 ? 'rare' : roll < 0.40 ? 'uncommon' : 'common';
    const pool = characters.filter(c => c.rarity === rarity);
    const char = pool[Math.floor(Math.random() * pool.length)] || characters[Math.floor(Math.random() * characters.length)];
    addCard(save, char.id, rarity);
    results.push({ name: char.name, id: char.id, rarity });
  }
  return { ok: true, results };
}

export function recordStageClear(save, stageId, turnCount) {
  if (!save.stageClears) save.stageClears = {};
  const prev = save.stageClears[stageId];
  const stars = turnCount <= 5 ? 3 : turnCount <= 8 ? 2 : 1;
  if (!prev || stars > prev.stars) {
    save.stageClears[stageId] = { stars, bestTurns: turnCount, clears: (prev?.clears || 0) + 1 };
  } else {
    save.stageClears[stageId].clears++;
    if (turnCount < prev.bestTurns) save.stageClears[stageId].bestTurns = turnCount;
  }
}

// ── Bonds ──

function bondKey(a, b) { return [a, b].sort().join(':'); }

export function progressBonds(save, teamIds) {
  if (!save.bonds) save.bonds = {};
  const upgraded = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      const key = bondKey(teamIds[i], teamIds[j]);
      if (!save.bonds[key]) save.bonds[key] = { xp: 0, level: 0 };
      save.bonds[key].xp += 1;
      const next = (save.bonds[key].level + 1) * 3;
      if (save.bonds[key].xp >= next) {
        save.bonds[key].xp -= next;
        save.bonds[key].level++;
        upgraded.push({ a: teamIds[i], b: teamIds[j], level: save.bonds[key].level });
      }
    }
  }
  return upgraded;
}

export function getBondLevel(save, idA, idB) {
  if (!save.bonds) return 0;
  const key = bondKey(idA, idB);
  return save.bonds[key]?.level || 0;
}

export function getBondBuff(save, teamIds) {
  if (!save.bonds) return { atk: 0, def: 0 };
  let totalBond = 0;
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      totalBond += getBondLevel(save, teamIds[i], teamIds[j]);
    }
  }
  return { atk: Math.floor(totalBond * 0.5), def: Math.max(totalBond > 0 ? 1 : 0, Math.floor(totalBond * 0.3)) };
}
