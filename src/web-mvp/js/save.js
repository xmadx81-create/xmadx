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
  lastTeam: [],
  achievements: {},
  onboarded: false,
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
    if (!save.lastTeam) save.lastTeam = [];
    if (!save.achievements) save.achievements = {};
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
  { day: 1, cards: ['common'] },
  { day: 3, cards: ['common', 'common'] },
  { day: 5, cards: ['uncommon'] },
  { day: 7, cards: ['uncommon', 'common', 'common'] },
  { day: 10, cards: ['rare'] },
  { day: 14, cards: ['rare', 'uncommon'] },
  { day: 20, cards: ['legendary'] },
  { day: 30, cards: ['legendary', 'rare', 'rare'] },
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
