# 🎮 헌혈의 집 — 마인크래프트 픽셀아트 캐릭터 변환 프롬프트

## 🎯 목적
`portrait-prompts-300.json`의 기존 캐릭터 프롬프트를 **마인크래프트 스타일 픽셀아트**로 변환하여 타이쿤 게임 내 NPC 스프라이트로 사용

## 📐 출력 사양
- **크기**: 32×32px (게임 내 스프라이트), 64×64px (UI 초상화)
- **팔레트**: 캐릭터당 최대 12색 (배경 제외)
- **방향**: 정면 (32×32), 정면+측면+후면 (스프라이트시트 옵션)
- **배경**: 투명 (PNG)

---

## 🔧 Claude Design 마스터 프롬프트 (공통 접두사)

### 32×32 게임 스프라이트용
```
Minecraft-style pixel art character sprite. 32x32 pixels, transparent background.
Chunky blocky proportions: square head (10×10px), short body (8px tall), stubby arms and legs.
Limited palette — max 12 colors per character. Clean pixel edges, no anti-aliasing, no gradients.
Full-body front-facing standing pose. 1-pixel black outline on all edges.
Cute chibi Minecraft proportions — head is 40% of total height.
NO text, NO UI, NO frame. Pure sprite only.
```

### 64×64 UI 초상화용
```
Minecraft-style pixel art character portrait. 64x64 pixels, transparent background.
Blocky square face with visible individual pixels. Head and shoulders only.
Limited palette — max 16 colors. Clean pixel edges, no anti-aliasing, no smoothing.
Simple shading with 2-3 tones per color. 1-pixel black outline.
Cute chunky proportions, expressive pixel eyes (2×2 or 3×2 pixels).
NO text, NO UI, NO frame. Pure portrait only.
```

---

## 🧛 팩션별 픽셀아트 스타일 가이드

### CENTER (혈연센터) 🏥
- **기본 의상 팔레트**: 흰색(#FFFFFF, #E8E8E8, #D0D0D0), 하늘색(#88CCEE)
- **특징**: 흰 가운/유니폼, ID 배지(노란 1px 점), 깔끔한 느낌
- **피부톤**: #FFD5B4, #EEBB99, #CC9966
- **머리색**: #332211(검정), #554433(갈색)

### KARTEIN (카르테인 가문) 🧛
- **기본 의상 팔레트**: 검정(#222222, #333333), 진홍(#CC2222, #881111)
- **특징**: 정장/망토, 금장식(#FFD700 1px), 창백한 피부
- **피부톤**: #F5E6D0, #E8D5C0 (창백하게)
- **머리색**: #888888(은색), #222222(검정), #BB8844(금발)
- **눈**: 밝은 회색/파랑 (#AABBCC)

### NEUTRAL (비소속) 👤
- **기본 의상 팔레트**: 다양 — 캐주얼/사복 컬러풀
- **특징**: 일상복, 개성 표현, 소품(가방/폰)
- **피부톤**: 표준 (#FFD5B4)

---

## 📋 캐릭터별 변환 프롬프트

### 변환 공식
```
[공통 접두사] + [팩션 스타일] + [개별 프롬프트 핵심 요소 추출]
```

### 예시 변환 (주요 캐릭터 15명)

---

### 1. park-harin (박하린) — 혈연센터장 [RARE]
**원본**: "Female Korean blood center director, mid-30s... white doctor's coat over wine-red blouse, gold-framed glasses..."
```
Minecraft-style pixel art character sprite. 32x32 pixels, transparent background.
Chunky blocky proportions: square head, short body, stubby arms and legs.
Max 12 colors. Clean pixel edges, no anti-aliasing. 1-pixel black outline.
Korean woman, short wavy dark brown pixel hair (3 colors: #443322, #554433, #332211).
White lab coat (#FFFFFF body, #E8E8E8 shading) over wine-red blouse (#882233 visible at collar).
Gold pixel glasses (2 yellow #FFD700 pixels on face).
Confident standing pose, holding tiny tablet (grey rectangle in hand).
```

### 2. kim-doyun (김도윤) — 신입 간호사 [COMMON]
**원본**: "Male Korean rookie nurse, early 20s... white nurse uniform... stethoscope..."
```
Minecraft-style pixel art character sprite. 32x32 pixels, transparent background.
Chunky blocky proportions: square head, short body, stubby arms and legs.
Max 12 colors. Clean pixel edges, no anti-aliasing. 1-pixel black outline.
Young Korean man, short neat black pixel hair (#222222, #333333).
Crisp white nurse uniform (#FFFFFF, #EEEEEE). Stethoscope = grey curved line on neck (#888888).
Big cheerful pixel smile (1px pink line). Bright dark eyes (2×2 black pixels with white highlight).
Thumbs-up pose (one arm raised).
```

### 3. kartein-duke (카르테인 듀크) — 혈액관리국장 [LEGENDARY]
**원본**: "Male European aristocrat... silver-streaked dark hair... black three-piece suit with crimson cravat..."
```
Minecraft-style pixel art character sprite. 32x32 pixels, transparent background.
Chunky blocky proportions: square head, short body, stubby arms and legs.
Max 12 colors. Clean pixel edges, no anti-aliasing. 1-pixel black outline.
Pale-skinned aristocrat man, slicked-back dark hair with silver streak (#333333 + #AAAAAA 1px line).
Black suit (#222222, #333333, #111111 three-tone). Crimson cravat (#CC2222 at neck).
Gold cufflink dots (#FFD700). Holding wine glass (small red+clear pixels in hand).
Intense grey-blue pixel eyes (#8899BB). Commanding pose.
```

### 4. lee-seoyeon (이서연) — 베테랑 채혈사 [UNCOMMON]
```
Minecraft-style pixel art character sprite. 32x32 pixels, transparent background.
Chunky blocky Minecraft proportions. Max 12 colors. No anti-aliasing. 1-pixel black outline.
Korean woman, dark hair in low ponytail (#332211, extending 3px behind head).
White nurse uniform (#FFFFFF, #E8E8E8). Blue surgical glove on one hand (#4488CC).
Holding needle/syringe (thin grey line with red tip). Slight frown expression.
Sharp observant eyes (2×2 dark pixels, slightly angled).
```

### 5. viktor-hessen (빅토르 헤센) — 카르테인 집사 [RARE]
```
Minecraft-style pixel art character sprite. 32x32 pixels, transparent background.
Chunky blocky Minecraft proportions. Max 12 colors. No anti-aliasing. 1-pixel black outline.
Elderly man, neatly combed white pixel hair (#CCCCCC, #EEEEEE).
Black butler tailcoat (#111111, #222222, #333333). White shirt front (#FFFFFF).
White gloves (#EEEEEE on hands). Gold pin (1 #FFD700 pixel on chest).
Holding silver tray (small grey rectangle). Dignified upright posture. Pale skin (#F5E6D0).
```

### 6. han-soyul (한소율) — 대학생 봉사자 [COMMON]
```
Minecraft-style pixel art character sprite. 32x32 pixels, transparent background.
Chunky blocky Minecraft proportions. Max 12 colors. No anti-aliasing. 1-pixel black outline.
Young Korean woman, trendy dyed brown hair with highlight (#886644, #AA8866, #CCAA88).
Casual outfit with volunteer vest (#FF6633 vest over #EEDDCC top).
Phone in one hand (small grey/black rectangle). Peace sign pose (V-shaped hand).
Cheerful pixel smile, bright eyes. Small bandage on arm (1 beige pixel).
```

### 7. isadora-kartein (이사도라 카르테인) — 카르테인 영애 [LEGENDARY]
```
Minecraft-style pixel art character sprite. 32x32 pixels, transparent background.
Chunky blocky Minecraft proportions. Max 12 colors. No anti-aliasing. 1-pixel black outline.
Elegant young woman, long flowing platinum blonde hair (#EEDDAA, #CCBB88 — 6px flowing down).
Deep crimson evening dress (#991122, #BB2233). Pale porcelain skin (#F5E6D0).
Ruby pendant at neck (1 red #CC0000 pixel). Piercing violet eyes (#9966CC).
Regal aristocratic pose, hands clasped.
```

### 8. yang-mira (양미라) — 헌혈 홍보대사 [RARE]
```
Minecraft-style pixel art character sprite. 32x32 pixels, transparent background.
Chunky blocky Minecraft proportions. Max 12 colors. No anti-aliasing. 1-pixel black outline.
Beautiful Korean woman, elegantly styled dark hair (#332211, swept shape).
Professional suit jacket (#444466, #555577). Red campaign ribbon (1 red pixel on lapel).
Camera-ready smile (pink pixel line). Polished look.
Warm skin tone (#FFD5B4). Perfect posture.
```

### 9. nigel-crowe (나이젤 크로우) — 언론인 [RARE]
```
Minecraft-style pixel art character sprite. 32x32 pixels, transparent background.
Chunky blocky Minecraft proportions. Max 12 colors. No anti-aliasing. 1-pixel black outline.
British man, messy dark auburn hair (#774433, #885544). Tired eyes with dark circles.
Worn brown trench coat (#887755, #776644) over dark shirt (#333333).
Press badge (yellow pixel). Holding notepad (white rectangle in hand).
Disheveled but determined look. Stubble (dark pixels on jaw).
```

### 10. elena-morgan (엘레나 모건) — 카르테인 외교관 [RARE]
```
Minecraft-style pixel art character sprite. 32x32 pixels, transparent background.
Chunky blocky Minecraft proportions. Max 12 colors. No anti-aliasing. 1-pixel black outline.
Elegant European woman, auburn wavy hair (#AA5533, #CC7744).
Dark navy diplomatic outfit (#222244, #333355). Gold brooch (1 #FFD700 pixel).
Pale skin (#F0DEC8). Green eyes (bright #44AA66 pixels).
Composed smile, diplomatic bearing. Pearls at neck (small white dots).
```

### 11. nam-kihyun (남기현) — 응급의학과 의사 [UNCOMMON]
```
Minecraft-style pixel art character sprite. 32x32 pixels, transparent background.
Chunky blocky Minecraft proportions. Max 12 colors. No anti-aliasing. 1-pixel black outline.
Korean man, short messy dark hair (#222222). Tired intense eyes.
Green surgical scrubs (#448844, #55AA55). Stethoscope (#888888 line on neck).
Five o'clock shadow (dark pixels on jaw). Blood spatter (1-2 red #CC2222 pixels on sleeve).
Determined exhausted expression.
```

### 12. shin-yujin (신유진) — 접수 담당자 [UNCOMMON]
```
Minecraft-style pixel art character sprite. 32x32 pixels, transparent background.
Chunky blocky Minecraft proportions. Max 12 colors. No anti-aliasing. 1-pixel black outline.
Korean woman, neat bob-cut black hair (#222222, #333333, clean square shape).
Reception uniform (#FFFFFF top, #4488AA trim). Glasses (#888888 line across eyes).
Small notebook in hand (white rectangle). Calm composed pixel expression.
Organized methodical appearance.
```

### 13. dimitri-rad (디미트리 라드) — 카르테인 전사 [RARE]
```
Minecraft-style pixel art character sprite. 32x32 pixels, transparent background.
Chunky blocky Minecraft proportions. Max 12 colors. No anti-aliasing. 1-pixel black outline.
Tall muscular Eastern European man, military buzzcut (#555555).
Dark tactical outfit (#222222, #333333, #111111). Pale skin (#E8D5C0).
Scar across face (1 dark red pixel line). Sharp cold grey eyes (#99AABB).
Combat-ready stance, arms at sides. Silver dog tags (#CCCCCC pixels at neck).
```

### 14. choi-minseo (최민서) — 단골 헌혈자 [COMMON]
```
Minecraft-style pixel art character sprite. 32x32 pixels, transparent background.
Chunky blocky Minecraft proportions. Max 12 colors. No anti-aliasing. 1-pixel black outline.
Middle-aged Korean man, short-cropped greying hair (#555555, #777777).
Casual polo shirt (#4488AA) with volunteer vest (#FF8833).
Medal on chest (gold #FFD700 pixel). One sleeve rolled up, small bandage (#FFDDBB).
Big warm pixel smile. Kind crinkly eyes. Friendly dad energy.
```

### 15. park-eunji (박은지) — 인턴기자 [COMMON]
```
Minecraft-style pixel art character sprite. 32x32 pixels, transparent background.
Chunky blocky Minecraft proportions. Max 12 colors. No anti-aliasing. 1-pixel black outline.
Young Korean woman, shoulder-length wavy hair (#332211).
Casual reporter outfit — denim jacket (#6688AA) over white top (#FFFFFF).
Camera around neck (#444444 pixels). Notebook in hand (white rectangle).
Excited eager expression, wide bright eyes. Energetic pose.
```

---

## 🔄 일괄 변환 스크립트 구조

### 자동 프롬프트 변환 규칙
`portrait-prompts-300.json` → 픽셀아트 프롬프트 자동 변환:

```
1. base_style 교체:
   기존: "Korean mobile gacha game character portrait. 512x512..."
   변환: "Minecraft-style pixel art character sprite. 32x32 pixels, transparent background.
          Chunky blocky proportions. Max 12 colors. No anti-aliasing. 1-pixel black outline."

2. 팩션별 팔레트 주입:
   center  → 흰/하늘 의상 팔레트
   kartein → 검정/진홍 팔레트 + 창백 피부
   neutral → 캐주얼 다양 팔레트

3. 프롬프트 변환 키워드 매핑:
   "semi-realistic" → 삭제
   "warm golden bokeh background" → "transparent background"
   "bust-up portrait" → "full-body front-facing standing pose"
   "detailed face" → "pixel face with 2×2 eyes"
   "hair" → "pixel hair" + 색상 HEX 추가
   "coat/uniform/suit" → 색상 HEX + "pixel" 접두사
   "holding X" → "holding tiny pixel X"
   소품/장신구 → "1-2 pixel" 크기 명시

4. 해상도별 분기:
   32×32 → 게임 스프라이트 (정면 전신)
   64×64 → UI 초상화 (얼굴+어깨)
   96×32 → 스프라이트시트 (정면+측면+후면)
```

---

## 🎨 게임 적용 방법

### 파일 구조
```
src/web-mvp/assets/
  sprites/           ← 32×32 게임용 스프라이트
    park-harin.png
    kim-doyun.png
    ...
  pixel-portraits/   ← 64×64 UI 초상화
    park-harin.png
    kim-doyun.png
    ...
```

### tycoon-renderer.js 적용
```javascript
// CHAR_MAP을 확장 — 300캐릭터 자동 매핑
const PIXEL_CHARS = {};  // portrait-prompts-300.json에서 자동 생성

// 간호사/NPC 렌더링 시 픽셀 스프라이트 사용
_drawNpcSlot(x, y, charId) {
  const tex = `sprite_${charId}`;
  if (this.textures.exists(tex)) {
    this.add.image(x, y, tex).setScale(1);
  } else {
    // 폴백: 이모지
  }
}
```

---

## ⚠️ 주의사항
- 32×32에서는 디테일이 매우 제한적 — 핵심 식별 요소(머리색, 의상색, 소품 1개)만 유지
- 레어도별 광택 효과: LEGENDARY = 금테두리(1px #FFD700), RARE = 은테두리(#CCCCCC)
- 모든 캐릭터는 동일한 체형(마인크래프트 비율) — 성별/나이는 머리+의상으로만 구분
- 투명 배경 필수 — 게임 내 바닥 타일 위에 겹쳐 표시됨
