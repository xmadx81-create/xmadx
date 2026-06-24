# 무지출용팔이 — Gemini AI 비서 연동 패키지

클라우드판(Node/Express + Cloud Run)의 **비서**를 Gemini로 업그레이드하는 드롭인 코드입니다.
하이브리드: 기존 규칙기반 비서는 그대로 두고, **안 걸리는 자연어만 Gemini**로 처리합니다.

## 들어있는 것
```
lib/ai-chat.js        ← 서버 프록시 라우트 모듈 (POST /api/ai-chat)
client-snippet.js     ← 클라이언트 callGemini() + 하이브리드 입력 처리
SYSTEM_PROMPT.txt     ← 시스템 프롬프트(무지출용팔이) — 자유 수정용 사본
```

## 적용 (PC에서 클라우드판 코드 폴더 `C:\AI_WORK\무지출용팔이`)

### 1) 서버
1. `lib/ai-chat.js` 를 클라우드판 `lib/` 로 복사
2. `server.js` 에서 app 생성·`express.json()` 이후 한 줄 추가:
   ```js
   const app = express();
   app.use(express.json());           // (이미 있으면 그대로)
   require('./lib/ai-chat')(app);     // ★ 추가
   ```

### 2) 클라이언트
`public/index.html` 의 비서 코드에 `client-snippet.js` 내용을 붙이고,
표시된 4개 함수만 기존 비서 UI에 연결:
- `renderUserBubble(text)` / `renderBotReply(text)` → 기존 말풍선 출력 함수
- `handleExistingCommand(text)` → 기존 규칙기반 핸들러(없으면 줄 삭제 → 항상 Gemini)
- `showTyping(bool)` → 로딩 표시(없으면 `function showTyping(){}` 빈 함수)
입력창 전송 시 `onAssistantInput(입력값)` 호출.

### 3) API 키 (환경변수)
- 키 발급(무료, 카드 불필요, 15 RPM): https://aistudio.google.com/apikey
- 로컬 테스트:
  ```bash
  set GEMINI_API_KEY=발급받은키      # Windows
  export GEMINI_API_KEY=발급받은키   # mac/Linux
  ```
- Cloud Run 배포 시 env 추가:
  ```bash
  gcloud run deploy muzichul --source . --project muzichul-yongpali --region asia-northeast3 \
    --update-env-vars GEMINI_API_KEY=발급받은키 --quiet
  ```
  > ⚠️ 키는 코드/깃에 넣지 말 것. 환경변수로만. (Secret Manager 사용 권장)

## 동작 / 안전
- 엔드포인트: `POST /api/ai-chat`  요청 `{message, history:[{who,text}]}` → 응답 `{reply}`
- 모델: `gemini-2.5-flash-lite` (무료 티어), 최근 10턴 맥락, 응답 최대 300토큰
- **키 없음 / Gemini 오류 / 타임아웃(15s) → `{reply:null}`** → 클라이언트가 기존 fallback 표시(앱 안 죽음)
- 기존 게임 로직 무손상(추가만). 규칙기반 비서 유지(빠른 응답) + 자연어만 AI.

## 검증 완료
- fetch 모킹 단위테스트 통과: URL/모델, system_instruction(무지출용팔이), contents roles(user,model,user), generationConfig(max300·temp0.8), 응답 파싱, 키없음·429·빈입력 graceful 처리.

## 무료 티어 제한
15 RPM / 100만 토큰·일 / 신용카드 불필요.
