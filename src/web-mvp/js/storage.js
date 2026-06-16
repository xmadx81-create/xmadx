const SAVE_KEY = 'redledger-save';
const STATS_KEY = 'redledger-stats';

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
