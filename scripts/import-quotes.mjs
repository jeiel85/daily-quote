#!/usr/bin/env node
/**
 * import-quotes.mjs — scripts/quote-drafts/*.json 을 읽어
 * 검증·중복제거·ID부여 후 src/data/quotes.json 으로 합친다.
 *
 * 워크플로우는 scripts/QUOTE_PROMPT.md 참고.
 *
 * 사용법:
 *   node scripts/import-quotes.mjs              # 임포트 실행 (src/data/quotes.json 갱신)
 *   node scripts/import-quotes.mjs --status     # 진행 상황만 표시
 *   node scripts/import-quotes.mjs --dry-run    # 검증만, 파일 안 씀
 *   node scripts/import-quotes.mjs --strict     # 검증 실패가 1개라도 있으면 중단
 *
 * 드래프트 파일 이름 규칙:
 *   scripts/quote-drafts/{lang}-{theme}.json
 *   예: scripts/quote-drafts/ko-motivation.json
 *
 * 파일 내용:
 *   ChatGPT가 반환한 JSON 배열 그대로 (```json 코드펜스가 있어도 자동 제거)
 *   [
 *     { "text": "...", "author": "...", "explanation": "..." },
 *     ...
 *   ]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { dirname, resolve, basename } from 'path';

// ─── 상수 ──────────────────────────────────────────────────────────────────────

const THEMES = ['motivation', 'comfort', 'humor', 'success', 'business', 'love', 'philosophy', 'wisdom', 'life'];
const LANGS  = ['ko', 'en', 'ja', 'zh'];

const TARGET_PER_BUCKET = 50;

const BLOCKED_KEYWORDS = ['섹스', '야동', 'sex', 'porn', 'nude', 'naked', '씨발', '개새끼', '좆', '보지', '자지', 'fuck', 'shit', 'bitch', 'nigger', 'faggot', '음란', '폭력'];

const DRAFTS_DIR = resolve('scripts/quote-drafts');
const OUT_PATH   = resolve('src/data/quotes.json');

// ─── 옵션 파싱 ─────────────────────────────────────────────────────────────────

const args = new Set(process.argv.slice(2));
const STATUS_ONLY = args.has('--status');
const DRY_RUN     = args.has('--dry-run');
const STRICT      = args.has('--strict');

// ─── 유틸 ──────────────────────────────────────────────────────────────────────

function normalize(s) {
  return s.replace(/\s+/g, ' ').replace(/[""''「」『』「」]/g, '').trim().toLowerCase();
}

function isBlocked(s) {
  const lower = s.toLowerCase();
  return BLOCKED_KEYWORDS.some((kw) => lower.includes(kw));
}

/** JSON 배열만 추출 — 마크다운 펜스, 앞뒤 설명 텍스트 무시 */
function extractJsonArray(raw) {
  // 1) 코드펜스 제거
  let txt = raw.replace(/^```(?:json)?\s*/im, '').replace(/```\s*$/im, '');
  // 2) 첫 '[' 부터 마지막 ']' 까지
  const start = txt.indexOf('[');
  const end = txt.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('JSON 배열을 찾지 못함');
  }
  txt = txt.slice(start, end + 1);
  return JSON.parse(txt);
}

function validateQuote(q, lang) {
  if (!q || typeof q !== 'object') return 'not an object';
  if (!q.text || typeof q.text !== 'string') return 'missing text';
  if (!q.author || typeof q.author !== 'string') return 'missing author';
  if (!q.explanation || typeof q.explanation !== 'string') return 'missing explanation';
  if (isBlocked(q.text) || isBlocked(q.explanation)) return 'blocked keyword';
  const len = q.text.trim().length;
  if (lang === 'en') {
    if (len < 15 || len > 220) return `text length ${len} out of range (15-220)`;
  } else {
    if (len < 6 || len > 120) return `text length ${len} out of range (6-120)`;
  }
  return null;
}

// ─── 드래프트 스캔 ─────────────────────────────────────────────────────────────

function scanDrafts() {
  if (!existsSync(DRAFTS_DIR)) {
    mkdirSync(DRAFTS_DIR, { recursive: true });
    return [];
  }
  return readdirSync(DRAFTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const name = f.replace(/\.json$/, '');
      const [lang, ...themeParts] = name.split('-');
      const theme = themeParts.join('-');
      return { file: resolve(DRAFTS_DIR, f), name, lang, theme };
    });
}

// ─── 상태 표시 ─────────────────────────────────────────────────────────────────

function printStatus(drafts, existingPool) {
  console.log('\n┌─ 진행 상황 ─────────────────────────────────────────────');
  console.log(`│ 드래프트 폴더:  ${DRAFTS_DIR}`);
  console.log(`│ 현재 풀 파일:    ${existsSync(OUT_PATH) ? OUT_PATH : '(없음)'}`);
  console.log(`│ 목표/버킷:       ${TARGET_PER_BUCKET}개`);
  console.log('└─────────────────────────────────────────────────────────');

  const draftMap = new Map();
  for (const d of drafts) draftMap.set(`${d.lang}-${d.theme}`, d);

  const poolCounts = new Map();
  if (existingPool) {
    for (const q of existingPool.quotes) {
      const k = `${q.lang}-${q.theme}`;
      poolCounts.set(k, (poolCounts.get(k) ?? 0) + 1);
    }
  }

  console.log('\n버킷별 상태 (P=풀 안 개수 / D=드래프트 파일 유무):\n');
  const header = `${'테마'.padEnd(12)}` + LANGS.map((l) => l.toUpperCase().padStart(12)).join('');
  console.log('  ' + header);
  console.log('  ' + '─'.repeat(header.length));

  let totalDrafted = 0, totalInPool = 0, totalBuckets = 0, doneBuckets = 0;
  for (const theme of THEMES) {
    const cells = [];
    for (const lang of LANGS) {
      const k = `${lang}-${theme}`;
      const pool = poolCounts.get(k) ?? 0;
      const hasDraft = draftMap.has(k) ? '✓' : ' ';
      const cell = `P${String(pool).padStart(3)} D${hasDraft}`;
      cells.push(cell.padStart(12));
      totalInPool += pool;
      totalBuckets++;
      if (pool >= TARGET_PER_BUCKET) doneBuckets++;
    }
    console.log('  ' + theme.padEnd(12) + cells.join(''));
  }
  console.log();
  console.log(`  풀 합계:      ${totalInPool}개  (목표 ${LANGS.length * THEMES.length * TARGET_PER_BUCKET}개)`);
  console.log(`  완료 버킷:    ${doneBuckets}/${totalBuckets}`);
  console.log(`  드래프트 파일: ${drafts.length}개`);
  console.log();
}

// ─── 메인 ──────────────────────────────────────────────────────────────────────

// 기존 풀 로드
let existing = { version: 1, generatedAt: new Date().toISOString(), quotes: [] };
if (existsSync(OUT_PATH)) {
  try {
    existing = JSON.parse(readFileSync(OUT_PATH, 'utf-8'));
    if (!Array.isArray(existing.quotes)) existing.quotes = [];
  } catch (e) {
    console.warn('⚠ 기존 풀 파일 파싱 실패, 새로 시작:', e.message);
    existing = { version: 1, generatedAt: new Date().toISOString(), quotes: [] };
  }
}

const drafts = scanDrafts();

if (STATUS_ONLY) {
  printStatus(drafts, existing);
  process.exit(0);
}

if (drafts.length === 0) {
  console.log('\n드래프트 파일이 없다.');
  console.log(`다음 경로에 ChatGPT 결과 JSON을 저장한 뒤 다시 실행:`);
  console.log(`  ${DRAFTS_DIR}/{lang}-{theme}.json`);
  console.log(`\n자세한 방법은 scripts/QUOTE_PROMPT.md 참고.`);
  process.exit(0);
}

// 기존 풀의 텍스트·ID 인덱스
const seenTexts = new Set(existing.quotes.map((q) => normalize(q.text)));
const bucketCounts = new Map();
const bucketMaxId = new Map();
for (const q of existing.quotes) {
  const k = `${q.lang}-${q.theme}`;
  bucketCounts.set(k, (bucketCounts.get(k) ?? 0) + 1);
  const n = parseInt(String(q.id).split('-').pop(), 10);
  if (!isNaN(n)) bucketMaxId.set(k, Math.max(bucketMaxId.get(k) ?? 0, n));
}

function nextId(lang, theme) {
  const k = `${lang}-${theme}`;
  const n = (bucketMaxId.get(k) ?? 0) + 1;
  bucketMaxId.set(k, n);
  return `${lang}-${theme}-${String(n).padStart(4, '0')}`;
}

// 드래프트 처리
console.log(`\n▶ ${drafts.length}개 드래프트 파일 처리 시작\n`);
let totalAdded = 0, totalRejected = 0, totalParsed = 0;
const rejectLog = [];

for (const d of drafts) {
  if (!LANGS.includes(d.lang) || !THEMES.includes(d.theme)) {
    console.log(`✗ ${d.name}: 알 수 없는 lang/theme — 스킵`);
    continue;
  }

  const raw = readFileSync(d.file, 'utf-8');
  let parsed;
  try {
    parsed = extractJsonArray(raw);
  } catch (e) {
    console.log(`✗ ${d.name}: JSON 파싱 실패 — ${e.message}`);
    if (STRICT) process.exit(1);
    continue;
  }
  if (!Array.isArray(parsed)) {
    console.log(`✗ ${d.name}: 배열이 아님`);
    if (STRICT) process.exit(1);
    continue;
  }
  totalParsed += parsed.length;

  let added = 0, rejected = 0;
  for (const q of parsed) {
    const reason = validateQuote(q, d.lang);
    if (reason) {
      rejected++;
      rejectLog.push(`  · ${d.name}: ${reason} — "${(q?.text ?? '').slice(0, 40)}..."`);
      continue;
    }
    const norm = normalize(q.text);
    if (seenTexts.has(norm)) {
      rejected++;
      continue; // 중복 — 조용히 스킵
    }
    seenTexts.add(norm);
    const id = nextId(d.lang, d.theme);
    existing.quotes.push({
      id,
      lang: d.lang,
      theme: d.theme,
      text: q.text.trim(),
      author: q.author.trim(),
      explanation: q.explanation.trim(),
    });
    added++;
  }
  bucketCounts.set(`${d.lang}-${d.theme}`, (bucketCounts.get(`${d.lang}-${d.theme}`) ?? 0) + added);
  totalAdded += added;
  totalRejected += rejected;
  console.log(`  ${d.name.padEnd(20)} +${String(added).padStart(3)}  (rejected ${rejected})`);
}

if (rejectLog.length > 0 && rejectLog.length <= 30) {
  console.log('\n검증 실패 항목:');
  for (const line of rejectLog) console.log(line);
} else if (rejectLog.length > 30) {
  console.log(`\n검증 실패 항목 ${rejectLog.length}개 (처음 30개만 표시):`);
  for (const line of rejectLog.slice(0, 30)) console.log(line);
}

existing.generatedAt = new Date().toISOString();

if (!DRY_RUN) {
  const dir = dirname(OUT_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(existing, null, 2), 'utf-8');
}

console.log(`\n┌─ 결과 ──────────────────────────────────────────────`);
console.log(`│ 파싱:     ${totalParsed}개`);
console.log(`│ 추가:     ${totalAdded}개`);
console.log(`│ 거부:     ${totalRejected}개 (검증 실패 또는 중복)`);
console.log(`│ 총 풀:    ${existing.quotes.length}개`);
console.log(`│ 저장:     ${DRY_RUN ? '(dry-run, 안 씀)' : OUT_PATH}`);
console.log('└──────────────────────────────────────────────────────');

printStatus(drafts, existing);
