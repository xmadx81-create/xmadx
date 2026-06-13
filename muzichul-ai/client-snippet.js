/*
 * 무지출용팔이 — Gemini AI 비서 클라이언트 (드롭인)
 * 클라우드판 public/index.html (단일 클라이언트)에 붙여넣기.
 *
 * 하이브리드 전략:
 *   1) 기존 규칙기반 비서 핸들러가 처리 가능하면 그대로 (빠른 응답)
 *   2) 안 걸리는 자연어 → callGemini() 로 Gemini 호출
 *   3) Gemini 실패(null) → 기존 fallback 메시지
 */

// ── 1) 서버 프록시 호출 (스펙 그대로) ──────────────────────────────
async function callGemini(message, chatHistory) {
  try {
    const history = (chatHistory || []).slice(-10).map(h => ({
      who: h.who, text: (h.text || '').substring(0, 300)
    }));
    const resp = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history })
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.reply || null;
  } catch (e) { return null; }
}

// ── 2) 대화 히스토리 (최근 N턴 유지) ──────────────────────────────
const aiChatHistory = [];               // [{who:'user'|'bot', text:'...'}]
function pushChat(who, text) {
  aiChatHistory.push({ who, text });
  if (aiChatHistory.length > 20) aiChatHistory.splice(0, aiChatHistory.length - 20);
}

/*
 * ── 3) 비서 입력 처리 (하이브리드) ──────────────────────────────
 * handleExistingCommand(text): 기존 규칙기반 비서가 처리했으면 응답문자열, 아니면 null 을 반환하도록
 *   여러분의 기존 핸들러에 맞춰 연결하세요. (예: 명령어 매칭 함수)
 * renderBotReply(text): 화면에 비서 말풍선 출력하는 기존 함수에 연결.
 */
async function onAssistantInput(text) {
  text = (text || '').trim();
  if (!text) return;
  pushChat('user', text);
  renderUserBubble(text);             // ← 기존 사용자 말풍선 출력 함수에 연결

  // (1) 기존 규칙기반 핸들러 우선
  let reply = (typeof handleExistingCommand === 'function') ? handleExistingCommand(text) : null;

  // (2) 안 걸리면 Gemini
  if (reply == null) {
    showTyping(true);                 // ← "입력 중…" 표시(있으면)
    reply = await callGemini(text, aiChatHistory);
    showTyping(false);
  }

  // (3) Gemini도 실패하면 fallback
  if (reply == null) {
    reply = '지금은 답하기 어려워요. 잠시 후 다시 시도하거나, 아래 메뉴를 이용해 주세요 🙏';
  }

  pushChat('bot', reply);
  renderBotReply(reply);              // ← 기존 비서 말풍선 출력 함수에 연결
}

/*
 * 연결 예시 (여러분의 비서 UI에 맞게 함수명만 바꾸세요):
 *   - 입력창 전송 버튼:  onAssistantInput(inputEl.value)
 *   - renderUserBubble(text) / renderBotReply(text): 기존 말풍선 렌더 함수
 *   - handleExistingCommand(text): 기존 BYOK 규칙기반 핸들러 (없으면 이 줄 삭제 → 항상 Gemini)
 *   - showTyping(bool): 로딩 인디케이터 (없으면 빈 함수)
 */
