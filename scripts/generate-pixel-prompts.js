import { readFileSync, writeFileSync } from 'fs';

const src = JSON.parse(readFileSync('scripts/portrait-prompts-300.json', 'utf-8'));

const FACTION_PALETTE = {
  center: {
    skin: '#FFD5B4, #EEBB99',
    hair: '#222222, #332211, #554433',
    outfit: 'white medical uniform (#FFFFFF, #E8E8E8, #D0D0D0), light blue trim (#88CCEE)',
    note: 'Clean medical look. ID badge = 1 yellow pixel.',
  },
  kartein: {
    skin: '#F5E6D0, #E8D5C0 (pale)',
    hair: '#222222 or #888888 silver or #BB8844 blonde',
    outfit: 'black suit/coat (#222222, #333333), crimson accents (#CC2222, #881111)',
    note: 'Aristocratic dark palette. Gold details = #FFD700 pixels.',
  },
  neutral: {
    skin: '#FFD5B4, #EEBB99',
    hair: '#222222, #443322, #665544',
    outfit: 'varied casual colors — pick 2-3 from the prompt',
    note: 'Everyday clothes, colorful and individual.',
  },
};

const RARITY_BORDER = {
  legendary: 'Gold 1-pixel glow border (#FFD700).',
  rare: 'Silver 1-pixel border (#CCCCCC).',
  uncommon: '',
  common: '',
};

const COMMON_PREFIX_32 = `Minecraft-style pixel art character sprite. 32x32 pixels, transparent background. Chunky blocky proportions: square head (10×10px), short body (8px tall), stubby arms and legs. Max 12 colors. Clean pixel edges, no anti-aliasing, no gradients. Full-body front-facing standing pose. 1-pixel black outline. Cute chibi Minecraft proportions. NO text, NO UI, NO frame.`;

const COMMON_PREFIX_64 = `Minecraft-style pixel art character portrait. 64x64 pixels, transparent background. Blocky square face with visible individual pixels. Head and shoulders only. Max 16 colors. Clean pixel edges, no anti-aliasing. Simple shading with 2-3 tones per color. 1-pixel black outline. Expressive pixel eyes (2×2 or 3×2 px). NO text, NO UI, NO frame.`;

function transformPrompt(char, size) {
  const prefix = size === 32 ? COMMON_PREFIX_32 : COMMON_PREFIX_64;
  const palette = FACTION_PALETTE[char.faction] || FACTION_PALETTE.neutral;
  const border = RARITY_BORDER[char.rarity] || '';

  let desc = char.prompt;
  desc = desc.replace(/semi-realistic/gi, '');
  desc = desc.replace(/warm golden bokeh background[^.]*\./gi, '');
  desc = desc.replace(/bust-up portrait/gi, 'full-body standing pose');
  desc = desc.replace(/detailed face/gi, 'pixel face with 2×2 eyes');

  const factionHint = `Faction palette: skin ${palette.skin}, hair ${palette.hair}, outfit ${palette.outfit}. ${palette.note}`;

  return `${prefix} ${border} ${factionHint} Character: ${desc}`.replace(/\s+/g, ' ').trim();
}

const output = {
  meta: {
    project: '헌혈의 집 — Red Ledger',
    purpose: '마인크래프트 픽셀아트 스프라이트 (32×32 & 64×64)',
    total: src.characters.length,
    generated: new Date().toISOString().slice(0, 10),
  },
  characters: src.characters.map(c => ({
    id: c.id,
    name: c.name,
    name_en: c.name_en,
    title: c.title,
    faction: c.faction,
    rarity: c.rarity,
    prompt_32: transformPrompt(c, 32),
    prompt_64: transformPrompt(c, 64),
  })),
};

writeFileSync('scripts/pixel-art-prompts-300.json', JSON.stringify(output, null, 2), 'utf-8');
console.log(`Generated ${output.characters.length} pixel art prompts → scripts/pixel-art-prompts-300.json`);
