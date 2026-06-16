# Red Ledger MVP 빌드 현황 — 2026-06-16

## Phase 1 체크리스트

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 1 | 게임 디자인 문서 (CARD_GAME_DESIGN_001.md) | DONE | 세계관, 자원, 카드, 턴, 승패 조건 |
| 2 | 캐릭터 초상화 프롬프트 (PORTRAIT_PROMPTS_001.md) | DONE | 10명 프롬프트 + 금지어 검증 통과 |
| 3 | 카드 데이터 (cards.js) | DONE | 10 캐릭터 + 혈액/이벤트/장비/의뢰 |
| 4 | 턴 엔진 (engine.js) | DONE | 전체 턴 루프 + 자원 관리 + 승패 판정 |
| 5 | hub.html — 카드 도감 + 게임 UI | DONE | 탭 기반 (도감/게임/규칙) |
| 6 | CSS 디자인 | DONE | 다크 테마 + 뱀파이어 누아르 톤 |
| 7 | 테스트 (vitest) | DONE | 19개 테스트 전체 통과 |
| 8 | 시뮬레이션 (sim.js) | DONE | 1000회 자동 플레이 — 승률 ~16% |
| 9 | 프롬프트 검증 (prompts.js) | DONE | 10개 프롬프트 금지어/스타일 검증 통과 |
| 10 | 캐릭터 초상화 이미지 생성 | TODO | openai-image MCP 사용 예정 |
| 11 | Vite dev server (npm run play) | DONE | localhost:5173/hub.html |

## 시뮬레이션 밸런스 (최신)

```
승률: ~16% (자동 플레이 기준)
패배(적발): ~84%
평균 턴: ~28
```

> 인간 플레이어는 전략적 선택이 가능하므로 40-60% 승률 기대

## 기술 스택

- Vite 8 + Vanilla JS (ESM)
- Vitest 4 (테스트)
- Node.js 18+ (시뮬레이션/검증)

## 다음 작업

1. 캐릭터 초상화 10장 AI 생성 (openai-image MCP)
2. 카드 도감에 초상화 반영 확인
3. Phase 2 설계 (드래그&드롭, 애니메이션)
