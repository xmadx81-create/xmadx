// 사용법:
// 1. PC에 이 파일 저장 (gen-all-portraits.mjs)
// 2. 터미널에서:
//    set GEMINI_API_KEY=여기에키입력    (Windows cmd)
//    $env:GEMINI_API_KEY="여기에키입력"  (Windows PowerShell)
//    export GEMINI_API_KEY=여기에키입력  (Mac/Linux)
// 3. node gen-all-portraits.mjs

import fs from 'fs';
import path from 'path';
import https from 'https';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('❌ GEMINI_API_KEY 환경변수를 설정해주세요!');
  process.exit(1);
}

const OUTPUT_DIR = './portraits';
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const BASE_STYLE = `PURE CHARACTER ILLUSTRATION ONLY. No card frame, no text, no stats, no UI elements, no borders, no name labels. 512x512 square image. Korean mobile gacha game character portrait for "헌혈의 집". HIGH QUALITY Korean manhwa/webtoon illustration. Clean lines, vibrant warm colors, polished rendering. Warm golden bokeh background with sparkle particles and amber-cream gradient. Bust-up portrait, 3/4 angle. The image must contain ONLY the character artwork and background — nothing else.`;

const CHARACTERS = [
  {
    id: 'kim-seoha',
    prompt: `${BASE_STYLE}
Character: "Kim Seoha" — Rare-tier. Female Korean medical journalist, late 20s. Sharp, determined, stylish. "기사 한 줄이면 세상이 바뀐다."
- Chic black bob cut above shoulders
- Fierce dark brown eyes full of curiosity
- Beige trench coat over white blouse
- Press ID badge on red lanyard
- Holding digital voice recorder and notebook
- Confident, ambitious expression`
  },
  {
    id: 'viktor-hessen',
    prompt: `${BASE_STYLE}
Character: "Viktor Hessen" — Rare-tier. Male, elderly European butler/steward, late 60s. The loyal servant of the Kartein family for generations. "300년의 충성."
- Dignified elderly Western man with a straight posture
- Neatly combed white hair, clean-shaven
- Calm, loyal grey-blue eyes
- Wearing an impeccable black butler's tailcoat with white gloves
- A small gold Kartein family crest pin on lapel
- Holding a silver tray with a sealed envelope
- Serene, devoted expression — the perfect servant`
  },
  {
    id: 'yang-mira',
    prompt: `${BASE_STYLE}
Character: "Yang Mira" — Rare-tier. Female Korean blood donation ambassador, mid-30s. A passionate public figure who genuinely believes in the cause. "헌혈은 사랑입니다, 진심으로."
- Warm, beautiful Korean woman with a radiant smile
- Long wavy dark brown hair with soft highlights
- Bright, sincere dark eyes full of warmth
- Wearing a stylish red blazer with a white blood donation campaign ribbon pin
- A microphone headset on one ear
- Holding promotional materials with heart and blood drop designs
- Genuinely warm, inspirational expression`
  },
  {
    id: 'lee-seoyeon',
    prompt: `${BASE_STYLE}
Character: "Lee Seoyeon" — Uncommon-tier. Female Korean veteran phlebotomist, early 30s. Skilled and suspicious — she notices things others miss. "의심의 눈초리, 완벽한 기술."
- Professional Korean woman with sharp, observant features
- Dark hair tied in a neat low ponytail
- Piercing dark eyes with a slightly skeptical look
- Wearing a clean white nurse uniform with red cross emblem
- Blue surgical gloves, holding a blood collection needle with expert confidence
- Slight frown — always analyzing`
  },
  {
    id: 'yun-chaea',
    prompt: `${BASE_STYLE}
Character: "Yun Chaea" — Uncommon-tier. Female Korean blood researcher, late 20s. A data-driven scientist who trusts numbers over people. "데이터는 거짓말하지 않는다."
- Smart, focused Korean woman with glasses
- Straight dark hair in a neat shoulder-length cut
- Analytical dark eyes behind round silver-framed glasses
- Wearing a white lab coat over a light blue shirt
- Holding a test tube rack with blood samples, examining one closely
- Focused, intellectual expression`
  },
  {
    id: 'shin-yujin',
    prompt: `${BASE_STYLE}
Character: "Shin Yujin" — Uncommon-tier. Female Korean receptionist, mid-20s. By-the-book and principled. "원칙대로 하겠습니다."
- Neat, professional young Korean woman
- Short dark hair in a tidy bob with bangs
- Serious, determined dark brown eyes
- Wearing a clean white blouse with a blood donation center name tag
- Sitting at a reception desk with a computer monitor
- Holding a registration form and pen
- Earnest, no-nonsense expression`
  },
  {
    id: 'oh-taehyun',
    prompt: `${BASE_STYLE}
Character: "Oh Taehyun" — Uncommon-tier. Male Korean blood analyst, early 30s. Meticulous and honest — his analysis never lies. "분석은 거짓을 허용하지 않는다."
- Clean-cut, serious Korean man
- Short neat black hair, side-parted
- Focused dark eyes with a calm, precise gaze
- Wearing a white lab coat with a blood center emblem
- Looking at a blood analysis chart on a clipboard
- Pen in shirt pocket, ID badge visible
- Professional, methodical expression`
  },
  {
    id: 'elena-morgan',
    prompt: `${BASE_STYLE}
Character: "Elena Morgan" — Uncommon-tier. Female, young European woman, early 20s. A Kartein family trainee who works night shifts. "낮에는 졸고, 밤에 일한다."
- Young, pretty Western woman with a slightly sleepy look
- Wavy light brown hair, slightly messy
- Soft hazel eyes, half-lidded and drowsy but alert
- Wearing a dark navy work uniform with Kartein crest patch on sleeve
- Holding a coffee cup in one hand, documents in the other
- A yawn she's trying to hide — cute but dedicated`
  },
  {
    id: 'sergei-volkov',
    prompt: `${BASE_STYLE}
Character: "Sergei Volkov" — Uncommon-tier. Male, Eastern European liaison officer, late 30s. Handles the quiet international routes for the Kartein organization. "동유럽 루트는 조용해야 해."
- Rugged, serious-looking Slavic man with a strong jaw
- Short dark blonde hair, military-style cut
- Cold grey eyes, watchful and calculating
- Wearing a dark leather jacket over a black turtleneck
- A small earpiece in one ear — always connected
- Arms crossed, standing in a guarded posture
- Stoic, reliable, slightly intimidating`
  },
  {
    id: 'park-eunji',
    prompt: `${BASE_STYLE}
Character: "Park Eunji" — Uncommon-tier. Female Korean medical student intern, early 20s. Curious and slightly overwhelmed by what she's getting into. "실습이라면서 왜 이렇게 많이..."
- Cute, youthful Korean woman with a slightly confused expression
- Dark hair in a high ponytail with loose strands
- Wide, curious dark brown eyes
- Wearing a short white lab coat (student length) with a "실습생" (Intern) badge
- Holding a medical textbook and looking at a blood bag with surprise
- Expression mixing curiosity and slight concern`
  },
  {
    id: 'jang-hyunwoo',
    prompt: `${BASE_STYLE}
Character: "Jang Hyunwoo" — Uncommon-tier. Male Korean government health inspector, early 40s. Follows rules strictly — a potential ally or threat. "규정을 따르면 아무 문제 없습니다."
- Authoritative, clean-cut Korean man in his 40s
- Short black hair with some grey at temples, neatly styled
- Stern, evaluating dark eyes
- Wearing a navy government-issued suit with a health ministry ID badge on lanyard
- Holding a tablet with inspection checklist
- Straight posture, clipboard under arm
- Fair but rigid expression — the rule-follower`
  },
  {
    id: 'jung-woojin',
    prompt: `${BASE_STYLE}
Character: "Jung Woojin" — Uncommon-tier. Male Korean blood transport driver, late 20s. Works the secret early morning deliveries. "새벽 4시의 특별 배송."
- Friendly, reliable-looking young Korean man
- Messy dark hair under a navy cap with blood center logo
- Warm brown eyes with a laid-back but trustworthy look
- Wearing a dark blue delivery uniform jacket with reflective stripes
- Holding car keys and a sealed cold-storage container
- Slight grin — he knows more than he lets on`
  },
  {
    id: 'kim-doyun',
    prompt: `${BASE_STYLE}
Character: "Kim Doyun" — Common-tier. Male Korean rookie nurse, early 20s. Pure-hearted and dangerously naive. "순수한 열정, 위험한 무지."
- Fresh-faced, innocent-looking young Korean man
- Soft black hair, slightly tousled
- Bright, earnest dark eyes full of idealism
- Wearing a clean white nurse uniform, still crisp and new
- A stethoscope around his neck
- Giving a cheerful thumbs-up with a big genuine smile
- Radiating youthful energy and naivety`
  },
  {
    id: 'choi-minseo',
    prompt: `${BASE_STYLE}
Character: "Choi Minseo" — Common-tier. Male Korean regular blood donor, mid-40s. A veteran donor who loves helping. "헌혈 300회의 사나이."
- Friendly, sturdy middle-aged Korean man
- Short-cropped black hair with some grey
- Kind, crinkly eyes with laugh lines
- Wearing a casual polo shirt with a blood donation volunteer vest
- A "300회 헌혈" (300 donations) medal pinned on his vest proudly
- Rolling up one sleeve showing a small bandage on his arm
- Big warm dad-smile — the neighborhood hero`
  },
  {
    id: 'han-soyul',
    prompt: `${BASE_STYLE}
Character: "Han Soyul" — Common-tier. Female Korean college student volunteer, early 20s. Social media savvy, here for the likes AND the cause. "SNS 좋아요의 힘."
- Trendy, bright young Korean woman
- Long straight dark hair with subtle highlights, styled casually
- Lively, sparkling dark brown eyes
- Wearing a cute pink volunteer T-shirt with blood donation campaign logo
- Holding her phone up taking a selfie at the donation center
- Peace sign with the other hand
- Cheerful, bubbly expression — pure Gen-Z energy`
  },
];

async function generateImage(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`;

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  });

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.candidates?.[0]?.content?.parts) {
            for (const part of json.candidates[0].content.parts) {
              if (part.inlineData) {
                resolve(Buffer.from(part.inlineData.data, 'base64'));
                return;
              }
            }
          }
          console.error('API 응답에 이미지 없음:', JSON.stringify(json).slice(0, 500));
          resolve(null);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log(`\n🎨 헌혈의 집 캐릭터 초상화 자동 생성`);
  console.log(`📁 저장 폴더: ${path.resolve(OUTPUT_DIR)}`);
  console.log(`👥 대상: ${CHARACTERS.length}명\n`);

  for (let i = 0; i < CHARACTERS.length; i++) {
    const char = CHARACTERS[i];
    const outPath = path.join(OUTPUT_DIR, `${char.id}.png`);

    if (fs.existsSync(outPath)) {
      console.log(`⏩ [${i + 1}/${CHARACTERS.length}] ${char.id} — 이미 존재, 건너뜀`);
      continue;
    }

    console.log(`🖌️  [${i + 1}/${CHARACTERS.length}] ${char.id} 생성 중...`);

    try {
      const imgBuffer = await generateImage(char.prompt);
      if (imgBuffer) {
        fs.writeFileSync(outPath, imgBuffer);
        console.log(`✅ ${char.id}.png 저장 완료 (${(imgBuffer.length / 1024).toFixed(0)}KB)`);
      } else {
        console.log(`❌ ${char.id} — 이미지 생성 실패`);
      }
    } catch (err) {
      console.log(`❌ ${char.id} — 에러: ${err.message}`);
    }

    // API 속도 제한 방지 (3초 대기)
    if (i < CHARACTERS.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log(`\n🎉 완료! ${OUTPUT_DIR} 폴더를 확인하세요.`);
  console.log(`📦 생성된 이미지를 이 채팅에 업로드하면 게임에 반영해드립니다.\n`);
}

main();
