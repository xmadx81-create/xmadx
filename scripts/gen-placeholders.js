const CHARACTERS = [
  { id: 'park-harin', name: '박하린', title: '혈연센터장', faction: 'center', rarity: 'rare', initial: '하' },
  { id: 'kim-doyun', name: '김도윤', title: '신입 간호사', faction: 'center', rarity: 'common', initial: '도' },
  { id: 'lee-seoyeon', name: '이서연', title: '베테랑 채혈사', faction: 'center', rarity: 'uncommon', initial: '서' },
  { id: 'kartein-duke', name: '카르테인 듀크', title: '혈액관리국장', faction: 'kartein', rarity: 'legendary', initial: 'K' },
  { id: 'choi-minseo', name: '최민서', title: '단골 헌혈자', faction: 'neutral', rarity: 'common', initial: '민' },
  { id: 'jung-woojin', name: '정우진', title: '혈액운송기사', faction: 'neutral', rarity: 'uncommon', initial: '우' },
  { id: 'viktor-hessen', name: '빅토르 헤센', title: '카르테인 집사', faction: 'kartein', rarity: 'rare', initial: 'V' },
  { id: 'han-soyul', name: '한소율', title: '대학생 봉사자', faction: 'center', rarity: 'common', initial: '소' },
  { id: 'nigel-crowe', name: '나이젤 크로우', title: '야간 감사관', faction: 'kartein', rarity: 'rare', initial: 'N' },
  { id: 'yun-chaea', name: '윤채아', title: '혈액연구원', faction: 'center', rarity: 'uncommon', initial: '채' },
  { id: 'shin-yujin', name: '신유진', title: '접수 담당자', faction: 'center', rarity: 'uncommon', initial: '유' },
  { id: 'oh-taehyun', name: '오태현', title: '혈액분석사', faction: 'center', rarity: 'uncommon', initial: '태' },
  { id: 'yang-mira', name: '양미라', title: '헌혈 홍보대사', faction: 'center', rarity: 'rare', initial: '미' },
  { id: 'elena-morgan', name: '엘레나 모르간', title: '야행성 수습생', faction: 'kartein', rarity: 'uncommon', initial: 'E' },
  { id: 'sergei-volkov', name: '세르게이 볼코프', title: '동유럽 연락관', faction: 'kartein', rarity: 'uncommon', initial: 'S' },
  { id: 'isadora-kartein', name: '이사도라 카르테인', title: '가문 장녀', faction: 'kartein', rarity: 'legendary', initial: 'I' },
  { id: 'dimitri-rad', name: '디미트리 라드', title: '혈액 감정사', faction: 'kartein', rarity: 'rare', initial: 'D' },
  { id: 'park-eunji', name: '박은지', title: '의대생 실습생', faction: 'neutral', rarity: 'uncommon', initial: '은' },
  { id: 'jang-hyunwoo', name: '장현우', title: '보건복지부 조사관', faction: 'neutral', rarity: 'uncommon', initial: '현' },
  { id: 'kim-seoha', name: '김서하', title: '의료 전문기자', faction: 'neutral', rarity: 'rare', initial: '서' },
];

const COLORS = {
  center: { bg: '#1a3a5c', accent: '#4a7fb5', text: '#c9daf8' },
  kartein: { bg: '#3d1a2a', accent: '#c4374b', text: '#f6c5be' },
  neutral: { bg: '#2a2a2a', accent: '#888888', text: '#cccccc' },
};

const RARITY_GLOW = {
  common: '#888888',
  uncommon: '#4b9b6e',
  rare: '#4a7fb5',
  legendary: '#d4a843',
};

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../src/web-mvp/assets/portraits');
mkdirSync(outDir, { recursive: true });

CHARACTERS.forEach(char => {
  const c = COLORS[char.faction];
  const glow = RARITY_GLOW[char.rarity];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="${c.accent}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${c.bg}"/>
    </radialGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <circle cx="200" cy="155" r="75" fill="${c.bg}" stroke="${c.accent}" stroke-width="3" filter="url(#glow)"/>
  <text x="200" y="178" text-anchor="middle" font-family="sans-serif" font-size="56" font-weight="bold" fill="${c.text}">${char.initial}</text>
  <rect x="40" y="270" width="320" height="2" fill="${glow}" opacity="0.5"/>
  <text x="200" y="310" text-anchor="middle" font-family="sans-serif" font-size="24" font-weight="bold" fill="${c.text}">${char.name}</text>
  <text x="200" y="340" text-anchor="middle" font-family="sans-serif" font-size="16" fill="${c.text}" opacity="0.7">${char.title}</text>
  <rect x="0" y="0" width="400" height="400" fill="none" stroke="${glow}" stroke-width="4" rx="8" opacity="0.6"/>
</svg>`;

  writeFileSync(resolve(outDir, `${char.id}.svg`), svg);
  console.log(`  [OK] ${char.id}.svg`);
});

console.log(`\n${CHARACTERS.length}개 플레이스홀더 생성 완료 → ${outDir}`);
