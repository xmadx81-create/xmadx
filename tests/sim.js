import { createGameState, runFullTurn } from '../src/web-mvp/js/engine.js';

const SIMULATIONS = 1000;
const results = { win: 0, 'lose-rep': 0, 'lose-sus': 0, stalemate: 0 };
const turnCounts = [];

for (let i = 0; i < SIMULATIONS; i++) {
  const state = createGameState();
  let result = null;
  let maxTurns = 50;

  while (!state.gameOver && maxTurns-- > 0) {
    result = runFullTurn(state);
  }

  if (result) {
    results[result]++;
  } else {
    results.stalemate++;
  }
  turnCounts.push(state.turn);
}

const avgTurns = (turnCounts.reduce((a, b) => a + b, 0) / turnCounts.length).toFixed(1);
const winRate = ((results.win / SIMULATIONS) * 100).toFixed(1);

console.log(`\n=== Red Ledger 시뮬레이션 결과 (${SIMULATIONS}회) ===`);
console.log(`승리: ${results.win} (${winRate}%)`);
console.log(`패배 (평판): ${results['lose-rep']}`);
console.log(`패배 (적발): ${results['lose-sus']}`);
console.log(`교착: ${results.stalemate}`);
console.log(`평균 턴: ${avgTurns}`);
console.log(`최소/최대 턴: ${Math.min(...turnCounts)}/${Math.max(...turnCounts)}`);
