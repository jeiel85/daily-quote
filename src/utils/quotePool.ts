/**
 * 로컬 + 원격 명언 풀에서 오늘의 명언을 뽑는다.
 *
 * 풀 소스:
 *   1) 번들된 src/data/quotes.json (오프라인 기본)
 *   2) JSDelivr CDN에서 24시간마다 1회 fetch — 최신 버전이면 localStorage 캐시
 *   3) localStorage 캐시(version > 번들) 우선 사용
 *
 * 정책:
 *   1) 하루에 한 번만 새 명언이 배달됨 — 같은 날 다시 호출하면 캐시된 명언 반환
 *   2) 사용자별 중복 방지 — 이미 본 ID 목록을 localStorage 에 누적
 *   3) 풀이 다 떨어지면 가장 오래된 본 명언부터 재활용
 *   4) 선호 테마(여러 개) + 언어 필터 적용. 'random' 포함 시 모든 테마 풀로 확장
 *
 * 상태는 localStorage 에만 저장 — Firestore 동기화는 호출자가 별도로 처리한다.
 */

import quotesData from '../data/quotes.json';
import type { Quote } from '../types';

interface RawQuote {
  id: string;
  lang: string;
  theme: string;
  text: string;
  author: string;
  explanation: string;
}

interface QuoteFile {
  version: number;
  generatedAt: string;
  quotes: RawQuote[];
}

const BUNDLED: QuoteFile = quotesData as QuoteFile;

// ─── 원격 호스팅 설정 ─────────────────────────────────────────────────────────

const REMOTE_URL = 'https://cdn.jsdelivr.net/gh/jeiel85/lumina-daily@main/src/data/quotes.json';
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24시간
const FETCH_TIMEOUT_MS = 10 * 1000;              // 10초

// ─── localStorage 키 ──────────────────────────────────────────────────────────

const LS_SEEN_IDS         = 'quote.seenIds';        // 본 명언 ID 배열 (오래된 → 최신)
const LS_LAST_DATE        = 'quote.lastDate';       // 마지막 배달 날짜 (사용자 로컬 YYYY-MM-DD)
const LS_TODAY_QUOTE_ID   = 'quote.todayId';        // 오늘 배달된 명언 ID
const LS_LAST_TIME_CHANGE = 'quote.lastTimeChange'; // 마지막 알림 시간 변경 날짜
const LS_REMOTE_POOL      = 'quote.remotePool';     // 원격에서 받은 풀 (QuoteFile JSON)
const LS_REMOTE_CHECKED   = 'quote.remoteChecked';  // 마지막 원격 체크 시각 (epoch ms)

const SEEN_CAP = 5000; // 메모리 폭주 방지 — 풀 크기보다 크게 잡되 상한 설정

// ─── 풀 결정 ──────────────────────────────────────────────────────────────────

let remotePoolCache: QuoteFile | null = null;
let remoteCacheRead = false;

function readRemoteFromLS(): QuoteFile | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LS_REMOTE_POOL);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuoteFile;
    if (typeof parsed?.version === 'number' && Array.isArray(parsed?.quotes)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/** 현재 사용해야 할 풀(파일). version이 큰 쪽 우선. */
function activePool(): QuoteFile {
  if (!remoteCacheRead) {
    remotePoolCache = readRemoteFromLS();
    remoteCacheRead = true;
  }
  if (remotePoolCache && remotePoolCache.version > BUNDLED.version) {
    return remotePoolCache;
  }
  return BUNDLED;
}

function POOL(): RawQuote[] {
  return activePool().quotes ?? [];
}

// ─── 유틸 ──────────────────────────────────────────────────────────────────────

/** 사용자 로컬 타임존 기준 YYYY-MM-DD */
export function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(LS_SEEN_IDS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeSeen(ids: string[]) {
  try {
    const capped = ids.slice(-SEEN_CAP);
    localStorage.setItem(LS_SEEN_IDS, JSON.stringify(capped));
  } catch (e) {
    console.warn('[quotePool] seenIds save failed:', e);
  }
}

function findById(id: string | null): RawQuote | null {
  if (!id) return null;
  return POOL().find((q) => q.id === id) ?? null;
}

function toQuote(raw: RawQuote): Quote {
  return {
    id: raw.id,
    text: raw.text,
    author: raw.author,
    explanation: raw.explanation,
    theme: raw.theme,
    createdAt: new Date(),
  };
}

// ─── 풀 통계 ───────────────────────────────────────────────────────────────────

export function poolSize(): number {
  return POOL().length;
}

export function poolStats() {
  const pool = POOL();
  const byLang: Record<string, number> = {};
  const byTheme: Record<string, number> = {};
  for (const q of pool) {
    byLang[q.lang] = (byLang[q.lang] ?? 0) + 1;
    byTheme[q.theme] = (byTheme[q.theme] ?? 0) + 1;
  }
  return { total: pool.length, byLang, byTheme, version: activePool().version, source: remotePoolCache && remotePoolCache.version > BUNDLED.version ? 'remote' : 'bundled' as 'remote' | 'bundled' };
}

// ─── 원격 갱신 ─────────────────────────────────────────────────────────────────

/**
 * JSDelivr에서 최신 명언 JSON을 가져와 캐시한다.
 * 24시간 안에 이미 시도했으면 no-op. 실패해도 조용히 넘어감 (앱 영향 0).
 * App 마운트 후 fire-and-forget으로 호출하면 된다.
 */
export async function maybeRefreshRemoteQuotes(): Promise<{ status: 'skipped' | 'unchanged' | 'updated' | 'failed'; version?: number }> {
  if (typeof localStorage === 'undefined' || typeof fetch === 'undefined') {
    return { status: 'skipped' };
  }
  try {
    const lastChecked = parseInt(localStorage.getItem(LS_REMOTE_CHECKED) || '0', 10);
    if (Date.now() - lastChecked < REFRESH_INTERVAL_MS) {
      return { status: 'skipped' };
    }
  } catch {
    /* localStorage 접근 실패 — 무시하고 진행 */
  }

  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    controller = new AbortController();
    timer = setTimeout(() => controller?.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(REMOTE_URL, {
      method: 'GET',
      cache: 'no-cache',
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn('[quotePool] remote fetch HTTP', res.status);
      return { status: 'failed' };
    }
    const data = (await res.json()) as QuoteFile;

    if (typeof data?.version !== 'number' || !Array.isArray(data?.quotes) || data.quotes.length === 0) {
      console.warn('[quotePool] remote JSON malformed — skip');
      return { status: 'failed' };
    }

    // 체크 시각은 항상 기록 (성공/동일 모두)
    try { localStorage.setItem(LS_REMOTE_CHECKED, String(Date.now())); } catch { /* ignore */ }

    const currentVersion = activePool().version;
    if (data.version <= currentVersion) {
      return { status: 'unchanged', version: data.version };
    }

    // 새 버전이면 캐시 저장 + 메모리 캐시 갱신
    try {
      localStorage.setItem(LS_REMOTE_POOL, JSON.stringify(data));
    } catch (e) {
      console.warn('[quotePool] remote cache write failed:', e);
      return { status: 'failed' };
    }
    remotePoolCache = data;
    console.log(`[quotePool] updated v${currentVersion} → v${data.version} (${data.quotes.length} quotes)`);
    return { status: 'updated', version: data.version };
  } catch (e) {
    if (timer) clearTimeout(timer);
    console.warn('[quotePool] remote fetch failed:', e);
    return { status: 'failed' };
  }
}

// ─── 메인: 오늘의 명언 ────────────────────────────────────────────────────────

export interface PickOptions {
  /** 사용자 선호 테마 (여러 개). 'random' 포함 시 전체 테마. */
  preferredThemes: string[];
  /** 언어 코드 ('ko'|'en'|'ja'|'zh') */
  language: string;
  /** true 면 오늘 캐시 무시하고 새로 뽑는다 (개발/디버그용). 기본 false. */
  force?: boolean;
}

export interface PickResult {
  quote: Quote;
  /** 오늘 처음 배달된 명언이면 true, 같은 날 이전에 뽑힌 캐시면 false */
  isFresh: boolean;
}

/**
 * 오늘의 명언을 가져온다.
 * - 같은 날 이미 뽑힌 명언이 있으면 그것을 반환 (isFresh=false)
 * - 없으면 풀에서 필터 후 미본 명언 중 랜덤 선택, 본 목록에 추가 (isFresh=true)
 * - 본 명언이 풀을 다 덮으면 가장 오래된 본 명언부터 재활용
 */
export function pickTodayQuote(opts: PickOptions): PickResult | null {
  const today = todayKey();
  const lastDate = localStorage.getItem(LS_LAST_DATE);
  const cachedId = localStorage.getItem(LS_TODAY_QUOTE_ID);

  // 같은 날 이미 배달됨 → 캐시 반환
  if (!opts.force && lastDate === today && cachedId) {
    const cached = findById(cachedId);
    if (cached) return { quote: toQuote(cached), isFresh: false };
  }

  const pool = POOL();

  // 필터링
  const themePool = opts.preferredThemes.includes('random') || opts.preferredThemes.length === 0
    ? null // 전체
    : new Set(opts.preferredThemes);

  let candidates = pool.filter((q) => q.lang === opts.language);
  if (themePool) candidates = candidates.filter((q) => themePool.has(q.theme));

  // 풀에 해당 언어/테마 명언이 하나도 없으면 — 같은 언어 전체로 폴백, 그래도 없으면 전체로 폴백
  if (candidates.length === 0) candidates = pool.filter((q) => q.lang === opts.language);
  if (candidates.length === 0) candidates = pool;
  if (candidates.length === 0) {
    console.warn('[quotePool] 풀이 비어 있다');
    return null;
  }

  // 본 ID 제외
  const seen = readSeen();
  const seenSet = new Set(seen);
  const unseen = candidates.filter((q) => !seenSet.has(q.id));

  let picked: RawQuote;
  if (unseen.length > 0) {
    picked = unseen[Math.floor(Math.random() * unseen.length)];
  } else {
    // 모두 본 상태 — 가장 오래된 본 명언 중에서 후보에 들어오는 것 선택
    const oldestFirst = seen.filter((id) => candidates.some((c) => c.id === id));
    if (oldestFirst.length > 0) {
      const oldId = oldestFirst[0];
      picked = candidates.find((c) => c.id === oldId)!;
    } else {
      picked = candidates[Math.floor(Math.random() * candidates.length)];
    }
  }

  // seen 갱신: 이미 있으면 빼고 맨 뒤(최신)에 추가
  const updated = seen.filter((id) => id !== picked.id);
  updated.push(picked.id);
  writeSeen(updated);

  // 오늘 캐시 저장
  try {
    localStorage.setItem(LS_LAST_DATE, today);
    localStorage.setItem(LS_TODAY_QUOTE_ID, picked.id);
  } catch (e) {
    console.warn('[quotePool] today cache save failed:', e);
  }

  return { quote: toQuote(picked), isFresh: true };
}

// ─── 알림 시간 변경 1일 1회 ───────────────────────────────────────────────────

export function canChangeTimeToday(): boolean {
  return localStorage.getItem(LS_LAST_TIME_CHANGE) !== todayKey();
}

export function markTimeChanged() {
  try {
    localStorage.setItem(LS_LAST_TIME_CHANGE, todayKey());
  } catch (e) {
    console.warn('[quotePool] lastTimeChange save failed:', e);
  }
}

// ─── 디버그/관리 ───────────────────────────────────────────────────────────────

/** 본 명언 기록 초기화 (테스트/디버그용) */
export function resetSeenHistory() {
  localStorage.removeItem(LS_SEEN_IDS);
  localStorage.removeItem(LS_TODAY_QUOTE_ID);
  localStorage.removeItem(LS_LAST_DATE);
}

/** 원격 캐시 초기화 (다음 호출 시 강제 재검사) */
export function resetRemoteCache() {
  localStorage.removeItem(LS_REMOTE_POOL);
  localStorage.removeItem(LS_REMOTE_CHECKED);
  remotePoolCache = null;
  remoteCacheRead = false;
}
