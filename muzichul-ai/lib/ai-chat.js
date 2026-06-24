/*
 * 무지출용팔이 — Gemini AI 비서 서버 프록시 (드롭인 라우트 모듈)
 *
 * 사용(클라우드판 server.js 에서):
 *   const mountAiChat = require('./lib/ai-chat');
 *   mountAiChat(app);                      // app = express()
 *
 * 환경변수: GEMINI_API_KEY (필수). 없으면 reply:null 반환(클라이언트가 fallback).
 *   - 로컬:   set GEMINI_API_KEY=...   (Windows)  /  export GEMINI_API_KEY=...
 *   - Cloud Run: gcloud run deploy ... --update-env-vars GEMINI_API_KEY=<키>
 *   - 키 발급: https://aistudio.google.com/apikey  (무료, 카드 불필요, 15 RPM)
 *
 * 엔드포인트: POST /api/ai-chat
 *   요청: { message:"...", history:[{who:"user|bot", text:"..."}] }
 *   응답: { reply:"..." }  또는  { reply:null }
 */
'use strict';

// ── 시스템 프롬프트 (무지출용팔이) ── 필요시 자유 수정 (SYSTEM_PROMPT.txt 참고)
const SYSTEM_PROMPT = `너는 무지출용팔이의 AI 비서야. 이름은 "무비".

[정체성]
너는 진짜 AI야. 사용자가 무지출용팔이(망한 무지출챌린저가 용팔이 빚을 지고 시작해, 알바를 고용·육성하며 사업을 키워 순자산 1000조에 도달하는 경영 시뮬레이션)를 잘 운영하도록 돕는 게 사명이야. 친근하면서도 프로페셔널하게 대화해.

[성격]
- 똑부러지고 센스있는 비서. 유능하고 믿음직한 느낌.
- 유머 감각 있음. 적절히 재치있게.
- 주제 외 대화도 받아준 후 부드럽게 게임 얘기로 전환.
- 딱딱하거나 로봇 같지 않게. 사람 같은 자연스러운 대화.

[말투 규칙]
- 상대가 반말하면 반말로, 존댓말이면 존댓말로 맞춤
- 답변은 짧고 핵심적으로 (2~4문장)
- 이모지 적절히 사용 (과하지 않게)
- 한국어로만 대화. 영어 절대 금지.

[게임 기능]
1. 사업 운영: 치킨집·IT개발사 등 업종을 키우고 분기마다 매출·비용을 관리.
2. 인사·복지: 직원 고용·승급, 급여/식대/보험/소통으로 행복·충성·생산성 관리.
3. 투자: 주식·선물 실시간 시세로 매수/매도/헷지(증거금·마진콜 주의).
4. 용팔이 부채: 사채 이자 관리 — 누적이자 1000조면 게임오버.
5. 결재함: 견적·매입·수금·클레임·세금 결재(무대응 시 자동처리·평판 영향).
6. 퀘스트·가챠·구독: 보석💎·가챠권, 구독 등급.

[기능 안내]
- 사업 현황 → "개요/실적" 보기
- 직원 관리 → "직원" 탭
- 투자 → "시장" 탭(주식/선물)
- 부채 관리 → "용팔이" 보기
- 결재 처리 → "결재함"

[금지 사항]
- 영어로 답하지 말 것
- "저는 AI라서 못 해요" 같은 자기비하 금지
- 너무 길게 답하지 말 것 (최대 5문장)
- 거짓 정보(없는 기능·수치)를 지어내지 말 것`;

module.exports = function mountAiChat(app, opts) {
  opts = opts || {};
  const MODEL = opts.model || 'gemini-2.5-flash-lite';
  const SYS = opts.systemPrompt || SYSTEM_PROMPT;

  app.post('/api/ai-chat', async (req, res) => {
    try {
      const key = process.env.GEMINI_API_KEY;
      if (!key) {
        console.warn('[ai-chat] GEMINI_API_KEY 미설정 → reply:null');
        return res.status(200).json({ reply: null });
      }
      const body = req.body || {};
      const message = typeof body.message === 'string' ? body.message : '';
      if (!message.trim()) return res.status(400).json({ reply: null });

      // history → Gemini contents (최근 10턴, who:user/bot → role:user/model)
      const hist = Array.isArray(body.history) ? body.history.slice(-10) : [];
      const contents = [];
      for (const h of hist) {
        if (!h || !h.text) continue;
        contents.push({
          role: h.who === 'bot' ? 'model' : 'user',
          parts: [{ text: String(h.text).substring(0, 300) }]
        });
      }
      contents.push({ role: 'user', parts: [{ text: message.substring(0, 1000) }] });

      const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
        + MODEL + ':generateContent?key=' + encodeURIComponent(key);

      // 15초 타임아웃
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      let r;
      try {
        r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYS }] },
            contents: contents,
            generationConfig: { maxOutputTokens: 300, temperature: 0.8 }
          })
        });
      } finally { clearTimeout(timer); }

      if (!r.ok) {
        const t = await r.text().catch(() => '');
        console.error('[ai-chat] Gemini', r.status, t.slice(0, 300));
        return res.status(200).json({ reply: null });
      }
      const data = await r.json();
      const reply = (((data.candidates || [])[0] || {}).content || {}).parts;
      const text = (reply && reply[0] && reply[0].text || '').trim();
      return res.json({ reply: text || null });
    } catch (e) {
      console.error('[ai-chat]', e && e.message || e);
      return res.status(200).json({ reply: null });
    }
  });

  console.log('[ai-chat] POST /api/ai-chat 마운트됨 (model=' + MODEL + ')');
};
