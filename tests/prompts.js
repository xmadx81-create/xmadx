import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const promptsPath = resolve(__dirname, '../docs/game-design/PORTRAIT_PROMPTS_001.md');

const content = readFileSync(promptsPath, 'utf-8');

const promptBlocks = content.split(/^## \d+\./m).slice(1);
const errors = [];

promptBlocks.forEach((block, i) => {
  const num = i + 1;
  const idMatch = block.match(/\(([a-z-]+)\)/);
  const id = idMatch ? idMatch[1] : `unknown-${num}`;

  const quoteMatch = block.match(/^> (.+)/m);
  if (!quoteMatch) {
    errors.push(`#${num} ${id}: 프롬프트 텍스트 없음`);
    return;
  }

  const prompt = quoteMatch[1];

  if (prompt.length < 50) {
    errors.push(`#${num} ${id}: 프롬프트가 너무 짧음 (${prompt.length}자)`);
  }

  const forbidden = [
    { pattern: /\bred\s+cross\b/i, label: 'red cross' },
    { pattern: /\bwar\b/i, label: 'war' },
    { pattern: /\bgore\b/i, label: 'gore' },
    { pattern: /\bruins\b/i, label: 'ruins' },
    { pattern: /\bdestruction\b/i, label: 'destruction' },
    { pattern: /적십자/, label: '적십자' },
    { pattern: /전쟁/, label: '전쟁' },
    { pattern: /고어/, label: '고어' },
    { pattern: /폐허/, label: '폐허' },
  ];
  forbidden.forEach(({ pattern, label }) => {
    if (pattern.test(prompt)) {
      errors.push(`#${num} ${id}: 금지 단어 발견 — "${label}"`);
    }
  });

  if (!prompt.toLowerCase().includes('semi-realistic') && !prompt.toLowerCase().includes('anime')) {
    errors.push(`#${num} ${id}: 스타일 키워드 누락 (semi-realistic/anime)`);
  }

  console.log(`  [OK] #${num} ${id} (${prompt.length}자)`);
});

console.log(`\n=== 프롬프트 검증 결과 ===`);
console.log(`총: ${promptBlocks.length}개`);

if (errors.length) {
  console.log(`오류: ${errors.length}개`);
  errors.forEach(e => console.log(`  [ERR] ${e}`));
  process.exit(1);
} else {
  console.log('모든 프롬프트 검증 통과!');
}
