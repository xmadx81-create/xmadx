# Red Ledger MVP 빌드 현황 — 2026-06-16

## 전체 진행 현황

| # | 항목 | 상태 | 커밋 |
|---|------|------|------|
| 1 | 게임 디자인 문서 | DONE | 24ef500 |
| 2 | 카드 데이터 (10캐릭터 + 혈액/이벤트/장비/의뢰) | DONE | 24ef500 |
| 3 | 턴 엔진 (engine.js) | DONE | 24ef500 |
| 4 | hub.html — 탭 기반 UI (도감/게임/규칙) | DONE | 24ef500 |
| 5 | SVG 플레이스홀더 초상화 10명 | DONE | b69761e |
| 6 | 인터랙티브 수동 플레이 UI | DONE | b69761e |
| 7 | 초상화 생성 파이프라인 (npm run gen:portraits) | DONE | 77693ed |
| 8 | 장비 상점 (구매→영구 효과) | DONE | 22ad740 |
| 9 | 카드 상세 팝업 (도감 클릭→상세 뷰) | DONE | 22ad740 |
| 10 | 난이도 선택 (쉬움/보통/어려움) | DONE | 22ad740 |
| 11 | BGM + SFX (Web Audio API) | DONE | 22ad740 |
| 12 | 세션 시작 훅 (npm test 자동) | DONE | 1fdeb39 |
| 13 | AI 초상화 10명 생성 | TODO | 환경 설정 후 |

## 테스트 현황

- **vitest:** 24개 전체 통과
- **prompts:** 10개 프롬프트 검증 통과
- **sim:** 1000회 시뮬레이션 (자동 플레이 ~15% 승률)

## npm 스크립트

| 명령 | 설명 |
|------|------|
| `npm run play` | Vite dev server → localhost:5173/hub.html |
| `npm test` | Vitest 24개 테스트 |
| `npm run sim` | 1000회 자동 플레이 시뮬레이션 |
| `npm run prompts` | 프롬프트 금지어/스타일 검증 |
| `npm run gen:portraits` | OpenAI API로 초상화 10장 일괄 생성 |
| `npm run gen:placeholders` | SVG 플레이스홀더 재생성 |

## 다음 작업

1. 원격 환경에 OPENAI_API_KEY + api.openai.com 네트워크 허용 → `npm run gen:portraits`
2. 드래그&드롭 카드 배치
3. 카드 뒤집기 애니메이션
4. 세이브/로드 (localStorage)
5. 스토리 모드 설계
