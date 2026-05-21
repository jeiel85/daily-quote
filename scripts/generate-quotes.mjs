#!/usr/bin/env node
/**
 * generate-quotes.mjs — Lumina Daily 명언 풀 대량 생성
 *
 * 사용법:
 *   GEMINI_API_KEY=... node scripts/generate-quotes.mjs
 *
 * 옵션:
 *   --themes=motivation,life       특정 테마만 (기본: 전체 9개)
 *   --langs=ko,en                  특정 언어만 (기본: ko,en,ja,zh)
 *   --per-bucket=50                (테마,언어) 조합당 목표 개수 (기본 50)
 *   --batch-size=25                1회 API 호출당 요청 개수 (기본 25)
 *   --out=src/data/quotes.json     출력 파일 (기본 src/data/quotes.json)
 *   --resume                       기존 파일 이어쓰기 (있는 ID는 스킵)
 *   --dry-run                      API 호출 없이 환경만 점검
 *
 * 결과 형식 (src/data/quotes.json):
 *   {
 *     "version": 1,
 *     "generatedAt": "2026-05-21T...",
 *     "quotes": [
 *       { "id": "ko-motivation-0001", "lang": "ko", "theme": "motivation",
 *         "text": "...", "author": "...", "explanation": "..." },
 *       ...
 *     ]
 *   }
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

// ─── 설정 ──────────────────────────────────────────────────────────────────────

const THEMES = ['motivation', 'comfort', 'humor', 'success', 'business', 'love', 'philosophy', 'wisdom', 'life'];
const LANGS  = ['ko', 'en', 'ja', 'zh'];

const THEME_NAMES = {
  motivation: { ko: '동기부여와 영감', en: 'motivation and inspiration', ja: 'モチベーションとインスピレーション', zh: '激励与启发' },
  comfort:    { ko: '위로와 치유',     en: 'comfort and healing',       ja: '慰めと癒し',                       zh: '安慰与治愈' },
  humor:      { ko: '유머와 재치',     en: 'humor and wit',             ja: 'ユーモアと機知',                   zh: '幽默与机智' },
  success:    { ko: '성공과 성취',     en: 'success and achievement',   ja: '成功と達成',                       zh: '成功与成就' },
  business:   { ko: '비즈니스와 리더십', en: 'business and leadership', ja: 'ビジネスとリーダーシップ',         zh: '商业与领导力' },
  love:       { ko: '사랑과 관계',     en: 'love and relationships',    ja: '愛と人間関係',                     zh: '爱与人际关系' },
  philosophy: { ko: '철학과 깊은 사유', en: 'philosophy and deep thought', ja: '哲学と深い思考',                 zh: '哲学与深思' },
  wisdom:     { ko: '지혜와 삶의 교훈', en: 'wisdom and life lessons',   ja: '知恵と人生の教訓',                 zh: '智慧与人生哲理' },
  life:       { ko: '인생과 일상',     en: 'life and living',           ja: '人生と日常',                       zh: '生活与日常' },
};

const LANG_FULL_NAMES = {
  ko: 'Korean (한국어)',
  en: 'English',
  ja: 'Japanese (日本語)',
  zh: 'Simplified Chinese (简体中文)',
};

const UNKNOWN_AUTHOR = {
  ko: '작자 미상',
  en: 'Unknown',
  ja: '詠み人知らず',
  zh: '佚名',
};

const BLOCKED_KEYWORDS = ['섹스', '야동', 'sex', 'porn', 'nude', 'naked', '씨발', '개새끼', '좆', '보지', '자지', 'fuck', 'shit', 'bitch', 'nigger', 'faggot', '음란', '폭력'];

// ─── 옵션 파싱 ─────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  })
);

const TARGET_THEMES = args.themes ? args.themes.split(',') : THEMES;
const TARGET_LANGS  = args.langs  ? args.langs.split(',')  : LANGS;
const PER_BUCKET    = parseInt(args['per-bucket'] || '50', 10);
const BATCH_SIZE    = parseInt(args['batch-size'] || '25', 10);
const OUT_PATH      = resolve(args.out || 'src/data/quotes.json');
const RESUME        = !!args.resume;
const DRY_RUN       = !!args['dry-run'];

console.log('┌─ generate-quotes.mjs ──────────────────────────────────');
console.log(`│ themes:     ${TARGET_THEMES.join(', ')}`);
console.log(`│ langs:      ${TARGET_LANGS.join(', ')}`);
console.log(`│ per bucket: ${PER_BUCKET}`);
console.log(`│ batch size: ${BATCH_SIZE}`);
console.log(`│ output:     ${OUT_PATH}`);
console.log(`│ resume:     ${RESUME}`);
console.log(`│ dry run:    ${DRY_RUN}`);
console.log(`│ buckets:    ${TARGET_THEMES.length * TARGET_LANGS.length}`);
console.log(`│ target:     ${TARGET_THEMES.length * TARGET_LANGS.length * PER_BUCKET} quotes`);
console.log('└─────────────────────────────────────────────────────────');

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY && !DRY_RUN) {
  console.error('\n❌ GEMINI_API_KEY 환경변수 필요');
  console.error('   Windows PowerShell:  $env:GEMINI_API_KEY="..."');
  console.error('   bash:                export GEMINI_API_KEY="..."');
  console.error('   Firebase secret에서: firebase functions:secrets:access GEMINI_API_KEY');
  process.exit(1);
}

// ─── 기존 파일 로드 (resume 모드) ──────────────────────────────────────────────

let existing = { version: 1, generatedAt: new Date().toISOString(), quotes: [] };
if (RESUME && existsSync(OUT_PATH)) {
  try {
    existing = JSON.parse(readFileSync(OUT_PATH, 'utf-8'));
    console.log(`▶ 기존 파일 로드: ${existing.quotes.length}개`);
  } catch (e) {
    console.warn('⚠ 기존 파일 파싱 실패, 새로 시작:', e.message);
  }
}

const bucketCount = (lang, theme) =>
  existing.quotes.filter((q) => q.lang === lang && q.theme === theme).length;

const seenTexts = new Set(existing.quotes.map((q) => normalize(q.text)));

function normalize(s) {
  return s.replace(/\s+/g, ' ').replace(/[""''「」『』]/g, '').trim().toLowerCase();
}

function nextId(lang, theme) {
  const used = existing.quotes
    .filter((q) => q.lang === lang && q.theme === theme)
    .map((q) => parseInt(q.id.split('-').pop(), 10))
    .filter((n) => !isNaN(n));
  const max = used.length ? Math.max(...used) : 0;
  return `${lang}-${theme}-${String(max + 1).padStart(4, '0')}`;
}

// ─── 프롬프트 생성 ─────────────────────────────────────────────────────────────

function buildPrompt(theme, lang, count) {
  const themeName = THEME_NAMES[theme][lang];
  const langName  = LANG_FULL_NAMES[lang];
  const unknownLabel = UNKNOWN_AUTHOR[lang];

  return `You are curating inspirational quotes for "Lumina Daily", a calm daily-quote app.

Generate exactly ${count} DISTINCT quotes on the theme "${themeName}".
ALL text fields (text, author, explanation) must be written entirely in ${langName}.

Requirements per quote:
- text:        1–2 sentences. Powerful and concise.
               Korean/Japanese/Chinese: 12–60 characters.
               English: 30–140 characters.
- author:      Use the REAL author's name only when you are confident the quote is genuinely from them.
               Otherwise use exactly: "${unknownLabel}".
               Do NOT fabricate attributions. Better unknown than wrong.
- explanation: 2–3 warm, insightful sentences in ${langName} explaining the meaning
               and how it applies to daily life. NO meta-commentary about the quote.

Variety rules (very important):
- Every quote must be substantively different. No paraphrases of each other.
- Vary tone across the batch: some uplifting, some reflective, some bold, some gentle.
- Mix sources: classical wisdom, modern thinkers, original anonymous lines.
- Avoid extreme cliches everyone has heard a thousand times.

Forbidden:
- Vulgar, sexual, hateful, political, or self-harm content.
- Religious proselytizing.
- Quotes attributed to specific living controversial figures.

Output: Valid JSON only. No markdown fences, no preamble.

{
  "quotes": [
    { "text": "...", "author": "...", "explanation": "..." }
    // ... ${count} items total
  ]
}`;
}

// ─── Gemini 호출 ───────────────────────────────────────────────────────────────

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
const model = genAI?.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: { responseMimeType: 'application/json', temperature: 1.0 },
});

async function generateBatch(theme, lang, count) {
  if (DRY_RUN) {
    return Array.from({ length: count }, (_, i) => ({
      text: `[dry-run ${lang}/${theme}/${i}]`,
      author: UNKNOWN_AUTHOR[lang],
      explanation: 'dry-run placeholder',
    }));
  }

  const prompt = buildPrompt(theme, lang, count);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      const raw = result.response.text();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.quotes)) throw new Error('quotes not array');
      return parsed.quotes;
    } catch (err) {
      console.warn(`  ⚠ attempt ${attempt}/3 failed: ${err.message}`);
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  return [];
}

// ─── 검증 ──────────────────────────────────────────────────────────────────────

function isBlocked(s) {
  const lower = s.toLowerCase();
  return BLOCKED_KEYWORDS.some((kw) => lower.includes(kw));
}

function validate(q, lang) {
  if (!q?.text || !q?.author || !q?.explanation) return 'missing fields';
  if (isBlocked(q.text) || isBlocked(q.explanation)) return 'blocked keyword';
  const len = q.text.length;
  if (lang === 'en') {
    if (len < 15 || len > 200) return `length ${len} out of range`;
  } else {
    if (len < 8 || len > 100) return `length ${len} out of range`;
  }
  if (seenTexts.has(normalize(q.text))) return 'duplicate';
  return null;
}

// ─── 메인 루프 ─────────────────────────────────────────────────────────────────

function saveProgress() {
  const dir = dirname(OUT_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  existing.generatedAt = new Date().toISOString();
  writeFileSync(OUT_PATH, JSON.stringify(existing, null, 2), 'utf-8');
}

let totalAdded = 0;
let totalRejected = 0;

for (const lang of TARGET_LANGS) {
  for (const theme of TARGET_THEMES) {
    const have = bucketCount(lang, theme);
    let need = PER_BUCKET - have;
    if (need <= 0) {
      console.log(`✓ ${lang}/${theme}: 이미 ${have}개 (목표 ${PER_BUCKET})`);
      continue;
    }

    console.log(`\n▶ ${lang}/${theme}: ${have} → ${PER_BUCKET} (need ${need})`);

    let safety = 0;
    while (need > 0 && safety < 10) {
      safety++;
      const reqCount = Math.min(BATCH_SIZE, need + 5); // 검증 탈락 대비 약간 더 요청
      let batch;
      try {
        batch = await generateBatch(theme, lang, reqCount);
      } catch (err) {
        console.error(`  ✗ 배치 실패, 다음 버킷으로:`, err.message);
        break;
      }

      let added = 0, rejected = 0;
      for (const q of batch) {
        if (need <= 0) break;
        const reason = validate(q, lang);
        if (reason) {
          rejected++;
          continue;
        }
        existing.quotes.push({
          id: nextId(lang, theme),
          lang,
          theme,
          text: q.text.trim(),
          author: q.author.trim(),
          explanation: q.explanation.trim(),
        });
        seenTexts.add(normalize(q.text));
        added++;
        need--;
      }
      totalAdded += added;
      totalRejected += rejected;
      console.log(`  · batch ${safety}: +${added} (rejected ${rejected}), remaining ${need}`);
      saveProgress();
    }
  }
}

saveProgress();
console.log(`\n┌─ 완료 ────────────────────────────────────────────────`);
console.log(`│ 총 ${existing.quotes.length}개 (이번에 +${totalAdded}, 검증탈락 ${totalRejected})`);
console.log(`│ 저장: ${OUT_PATH}`);
console.log(`└──────────────────────────────────────────────────────`);
