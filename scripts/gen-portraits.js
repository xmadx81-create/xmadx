import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_PATH = resolve(__dirname, '../docs/game-design/PORTRAIT_PROMPTS_001.md');
const OUT_DIR = resolve(__dirname, '../src/web-mvp/assets/portraits');

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('OPENAI_API_KEY 환경 변수를 설정하세요.');
  process.exit(1);
}

const MODEL = process.env.IMAGE_MODEL || 'gpt-image-1';
const SIZE = '1024x1024';
const DELAY_MS = 2000;

function parsePrompts(md) {
  const blocks = md.split(/^## \d+\./m).slice(1);
  return blocks.map(block => {
    const idMatch = block.match(/\(([a-z-]+)\)/);
    const nameMatch = block.match(/— (.+)/);
    const promptMatch = block.match(/^> (.+(?:\n> .+)*)/m);
    if (!idMatch || !promptMatch) return null;
    return {
      id: idMatch[1],
      name: nameMatch ? nameMatch[1].trim() : idMatch[1],
      prompt: promptMatch[1].replace(/\n> /g, ' '),
    };
  }).filter(Boolean);
}

async function generateImage(prompt, savePath, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          prompt,
          n: 1,
          size: SIZE,
          response_format: 'b64_json',
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`API ${res.status}: ${err}`);
      }

      const data = await res.json();
      const b64 = data.data[0].b64_json;
      writeFileSync(savePath, Buffer.from(b64, 'base64'));
      return true;
    } catch (e) {
      console.error(`  [retry ${attempt}/${retries}] ${e.message}`);
      if (attempt < retries) await sleep(DELAY_MS * attempt);
    }
  }
  return false;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const md = readFileSync(PROMPTS_PATH, 'utf-8');
  const chars = parsePrompts(md);

  console.log(`\n=== Red Ledger 초상화 생성 (${MODEL}) ===`);
  console.log(`대상: ${chars.length}명\n`);

  let ok = 0;
  let fail = 0;

  for (const char of chars) {
    const savePath = resolve(OUT_DIR, `${char.id}.png`);
    process.stdout.write(`  [${ok + fail + 1}/${chars.length}] ${char.name} (${char.id})...`);

    const success = await generateImage(char.prompt, savePath);
    if (success) {
      console.log(' OK');
      ok++;
    } else {
      console.log(' FAIL');
      fail++;
    }

    if (ok + fail < chars.length) await sleep(DELAY_MS);
  }

  console.log(`\n=== 결과: ${ok} 성공 / ${fail} 실패 ===`);
  if (fail > 0) process.exit(1);
}

main();
