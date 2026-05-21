# Lumina Daily — 명언 풀 생성 프롬프트

ChatGPT(또는 Claude·Gemini 웹 UI)에 아래 프롬프트를 복사한 뒤
`{LANGUAGE_NAME}` 과 `{THEME_DESCRIPTION}` 부분만 표에 따라 바꿔서 실행한다.

---

## 0. 한눈에 보는 작업

목표: **9 테마 × 4 언어 × 50개 = 1,800개** 명언을 풀로 적재한다.

| 단계 | 설명 | 위치 |
|------|------|------|
| 1 | 아래 프롬프트 복사 → ChatGPT에 붙여넣기 (필요한 자리만 치환) | (브라우저) |
| 2 | 응답(JSON 배열)을 통째로 저장 | `scripts/quote-drafts/{lang}-{theme}.json` |
| 3 | 모든 버킷이 모이면 임포트 실행 | `node scripts/import-quotes.mjs` |
| 4 | 산출물 확인 | `src/data/quotes.json` |

진행 상황 확인은 언제든 `node scripts/import-quotes.mjs --status` 로.

---

## 1. 프롬프트 (복사용)

> **사용 방법**: 아래 블록 전체를 복사 → ChatGPT에 붙여넣기 →
> `{LANGUAGE_NAME}` 과 `{THEME_DESCRIPTION}` (3군데)를 표에 따라 바꿔서 전송.

```
You are curating short inspirational quotes for "Lumina Daily" — a calm,
minimal Korean daily-quote app used by everyday people of all ages.

Generate exactly 50 DISTINCT quotes on the theme "{THEME_DESCRIPTION}".
ALL fields (text, author, explanation) must be written entirely in {LANGUAGE_NAME}.

For each quote, provide:
- text:        1–2 sentences. Powerful and concise.
               If {LANGUAGE_NAME} is Korean / Japanese / Chinese: 12–60 characters.
               If {LANGUAGE_NAME} is English: 30–140 characters.
- author:      Use the REAL author's name ONLY when you are confident the quote
               is genuinely from them. Otherwise use exactly:
                 Korean   → "작자 미상"
                 English  → "Unknown"
                 Japanese → "詠み人知らず"
                 Chinese  → "佚名"
               Do NOT fabricate attributions. Better unknown than wrong.
- explanation: 2–3 warm, insightful sentences in {LANGUAGE_NAME} explaining
               the meaning and how it applies to everyday life.
               No meta-commentary ("This quote means…"). Just speak to the reader.

Variety rules (very important):
- All 50 quotes must be substantively different — no paraphrases of each other.
- Vary tone: some uplifting, some reflective, some bold, some gentle, some witty.
- Mix sources: classical wisdom, modern thinkers, original anonymous lines.
- Avoid extreme cliches everyone has heard a thousand times.
- Do not repeat the same author more than twice in the batch.

Forbidden:
- Vulgar, sexual, hateful, political, religious-proselytizing, or self-harm content.
- Quotes attributed to specific living controversial figures.
- Anything that would make a calm morning notification feel uncomfortable.

Output: Valid JSON array only. No markdown fences, no preamble, no trailing comments.

[
  { "text": "...", "author": "...", "explanation": "..." },
  { "text": "...", "author": "...", "explanation": "..." }
  // ... 50 items total
]
```

---

## 2. 치환 표

`{LANGUAGE_NAME}` 자리에 들어갈 값:

| 언어 코드 | LANGUAGE_NAME |
|-----------|---------------|
| `ko` | `Korean (한국어)` |
| `en` | `English` |
| `ja` | `Japanese (日本語)` |
| `zh` | `Simplified Chinese (简体中文)` |

`{THEME_DESCRIPTION}` 자리에 들어갈 값 (언어별로 자연스러운 표현 권장 — 영어 그대로 써도 OK):

| 테마 | KO | EN | JA | ZH |
|------|----|----|----|----|
| `motivation` | 동기부여와 영감 | motivation and inspiration | モチベーションとインスピレーション | 激励与启发 |
| `comfort`    | 위로와 치유 | comfort and healing | 慰めと癒し | 安慰与治愈 |
| `humor`      | 유머와 재치 | humor and wit | ユーモアと機知 | 幽默与机智 |
| `success`    | 성공과 성취 | success and achievement | 成功と達成 | 成功与成就 |
| `business`   | 비즈니스와 리더십 | business and leadership | ビジネスとリーダーシップ | 商业与领导力 |
| `love`       | 사랑과 관계 | love and relationships | 愛と人間関係 | 爱与人际关系 |
| `philosophy` | 철학과 깊은 사유 | philosophy and deep thought | 哲学と深い思考 | 哲学与深思 |
| `wisdom`     | 지혜와 삶의 교훈 | wisdom and life lessons | 知恵と人生の教訓 | 智慧与人生哲理 |
| `life`       | 인생과 일상 | life and living | 人生と日常 | 生活与日常 |

---

## 3. 응답 저장 규칙

ChatGPT가 반환한 JSON 배열을 그대로 다음 파일로 저장한다:

```
scripts/quote-drafts/{lang}-{theme}.json
```

예시:
- `scripts/quote-drafts/ko-motivation.json`
- `scripts/quote-drafts/en-philosophy.json`
- `scripts/quote-drafts/ja-comfort.json`
- `scripts/quote-drafts/zh-wisdom.json`

총 **36개 파일**이 모이면 임포트 가능.

> **마크다운 코드펜스(```)가 끼어 있어도 임포터가 알아서 벗겨낸다.**
> 응답 앞뒤에 다른 설명 텍스트가 있어도 JSON 배열만 추출한다.

---

## 4. 임포트 실행

```bash
# 진행 상황만 확인
node scripts/import-quotes.mjs --status

# 실제로 src/data/quotes.json 생성/업데이트
node scripts/import-quotes.mjs

# 검증만 (파일 쓰지 않음)
node scripts/import-quotes.mjs --dry-run
```

검증 통과 기준:
- 필수 필드(text, author, explanation) 모두 있음
- 텍스트 길이 범위 OK
- 금칙어 미포함
- 중복(같은 텍스트 정규화 후) 제거

검증 실패 항목은 콘솔에 사유와 함께 표시되고, 통과한 것만 풀에 들어간다.

---

## 5. 팁

- 한 번에 모든 테마를 ChatGPT가 잘 못 만들면 **테마 하나당 한 채팅**으로 분리.
- 같은 버킷을 두 번 돌려도 임포터가 중복을 제거하므로 풀이 부족하면 추가 실행 안전함.
- 영어 버전은 영어 사용자에게도 자연스러워야 함 — 한국어 번역체가 섞이지 않도록 프롬프트에서 강조.
- 너무 비슷한 명언이 많이 나오면 ChatGPT에 "더 다양하게" "더 톤을 다르게" 라고 후속 요청.
