const SAVE_KEY = 'redledger-save';
const STATS_KEY = 'redledger-stats';
const ACHIEVE_KEY = 'redledger-achievements';

export const ACHIEVEMENT_DEFS = [
  { id: 'first-win', name: '첫 승리', description: '게임에서 첫 승리를 달성하세요' },
  { id: 'hard-win', name: '완벽한 센터장', description: '어려움 난이도에서 승리하세요' },
  { id: 'speed-run', name: '스피드런', description: '8턴 이내에 승리하세요' },
  { id: 'full-equip', name: '장비 수집가', description: '4종 장비를 모두 설치한 상태로 승리' },
  { id: 'clean-win', name: '깨끗한 운영', description: 'SUS 20 이하로 승리하세요' },
  { id: 'all-requests', name: '카르테인의 총아', description: '5개 의뢰를 모두 완수하세요' },
  { id: 'combo-master', name: '콤보 마스터', description: '한 게임에서 콤보 5회 이상 발동' },
  { id: 'ten-games', name: '단골 손님', description: '10회 이상 플레이하세요' },
  { id: 'survivor', name: '생존 전문가', description: 'SUS 80 이상에서 승리하세요' },
  { id: 'big-collect', name: '대박 수집', description: '한 번에 BP 15 이상 수집' },
];

export function saveGame(state) {
  try {
    const serializable = { ...state };
    delete serializable.log;
    localStorage.setItem(SAVE_KEY, JSON.stringify(serializable));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    state.log = [];
    return state;
  } catch { return null; }
}

export function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
}

export function hasSave() {
  return !!localStorage.getItem(SAVE_KEY);
}

function defaultStats() {
  return {
    totalGames: 0,
    wins: { easy: 0, normal: 0, hard: 0 },
    losses: { easy: 0, normal: 0, hard: 0 },
    bestTurn: { easy: null, normal: null, hard: null },
    history: [],
  };
}

export function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? JSON.parse(raw) : defaultStats();
  } catch { return defaultStats(); }
}

export function recordGame(state, result) {
  const stats = loadStats();
  const diff = state.difficulty || 'normal';
  stats.totalGames++;

  const entry = {
    date: new Date().toISOString(),
    difficulty: diff,
    result,
    turn: state.turn,
    bp: state.resources.bp,
    rep: state.resources.rep,
    sus: state.resources.sus,
    completed: state.completedRequests,
  };

  if (result === 'win') {
    stats.wins[diff] = (stats.wins[diff] || 0) + 1;
    if (!stats.bestTurn[diff] || state.turn < stats.bestTurn[diff]) {
      stats.bestTurn[diff] = state.turn;
    }
  } else {
    stats.losses[diff] = (stats.losses[diff] || 0) + 1;
  }

  stats.history.unshift(entry);
  if (stats.history.length > 50) stats.history.length = 50;

  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch {}
  deleteSave();
  return stats;
}

export function loadAchievements() {
  try {
    const raw = localStorage.getItem(ACHIEVE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function unlockAchievement(id) {
  const unlocked = loadAchievements();
  if (unlocked.includes(id)) return false;
  unlocked.push(id);
  try { localStorage.setItem(ACHIEVE_KEY, JSON.stringify(unlocked)); } catch {}
  return true;
}

export function checkAchievements(state, result) {
  const newly = [];
  const stats = loadStats();

  if (result === 'win') {
    if (unlockAchievement('first-win')) newly.push('first-win');
    if (unlockAchievement('all-requests')) newly.push('all-requests');
    if (state.difficulty === 'hard' && unlockAchievement('hard-win')) newly.push('hard-win');
    if (state.turn <= 8 && unlockAchievement('speed-run')) newly.push('speed-run');
    if (state.resources.sus <= 20 && unlockAchievement('clean-win')) newly.push('clean-win');
    if (state.resources.sus >= 80 && unlockAchievement('survivor')) newly.push('survivor');
    if (state.equipment.length >= 4 && unlockAchievement('full-equip')) newly.push('full-equip');
  }

  if ((state.comboActivations || 0) >= 5 && unlockAchievement('combo-master')) newly.push('combo-master');
  if ((state.maxCollect || 0) >= 15 && unlockAchievement('big-collect')) newly.push('big-collect');
  if ((stats.totalGames + 1) >= 10 && unlockAchievement('ten-games')) newly.push('ten-games');

  return newly;
}
