# Lumina Daily — 개발/배포 지침

이 파일은 새 세션이 시행착오 없이 작업할 수 있도록 핵심 지식을 담은 가이드입니다.

---

## 프로젝트 구조

```
lumina-daily/
├── src/                  # React 웹앱 소스
├── dist/                 # Vite 빌드 출력 (gitignore) — APK에 번들됨
├── docs/                 # GitHub Pages 랜딩 페이지 (정적 HTML, git 추적)
├── android/              # Capacitor Android 네이티브 프로젝트
├── capacitor.config.ts   # Capacitor 설정
├── vite.config.ts        # Vite 설정
└── .github/workflows/deploy.yml  # CI/CD
```

### 핵심 역할 분리

| 대상 | 소스 | 배포 방법 |
|------|------|-----------|
| `jeiel85.github.io/lumina-daily/` | `docs/` (정적 HTML 랜딩 페이지) | GitHub Pages legacy 모드 — `main` 브랜치 `/docs` 폴더 직접 서빙 |
| Android APK | `dist/` (React 앱 번들) | Capacitor가 `dist/`를 android assets에 복사 |
| GitHub Release | `app-release.apk` + `dist.zip` | 태그 푸시(v*) 시 CI 자동 생성 |

### 🔒 LOCKED POLICY — GitHub Pages 용도 (절대 변경 금지)

**`https://jeiel85.github.io/lumina-daily/` 는 "앱 소개 브랜딩 랜딩 페이지" 전용이다. 앱의 웹앱(PWA) 버전이 아니다.**

이 정책은 사용자가 명시적으로 박제 요청한 항목이다. 빌드/배포 작업 중 자꾸 뒤집히는 일이 반복되어 못박는다.

- ❌ **금지**: React 앱 번들(Vite 빌드 산출물)을 `docs/`에 넣는 것
- ❌ **금지**: `npm run build -- --mode github-pages` 산출물을 `docs/`로 복사/배포하는 CI step
- ❌ **금지**: `docs/index.html`에 `<script type="module" src="/lumina-daily/assets/index-*.js">` 같은 Vite 번들 reference
- ❌ **금지**: `docs/`에 `assets/`, `manifest.webmanifest`, `sw.js`, `workbox-*.js`, `registerSW.js` 같은 PWA 산출물
- ✅ **허용**: 정적 HTML/CSS/이미지로 된 앱 소개 페이지 (스토어 링크, 기능 소개, 스크린샷, 개인정보처리방침 등)
- ✅ **원칙**: 실제 React 앱은 **오직 Android APK/AAB에 번들**된다. 웹에서 앱을 돌릴 일은 없다.

정책을 바꾸려면 사용자가 **명시적으로** "github.io에서 웹앱도 서빙하고 싶다"고 말한 경우에만 가능. 그 외엔 어떠한 사유(편의성/캐시 적중률/배포 단순화 등)로도 자동으로 뒤집지 말 것.

---

## 환경 변수

### GitHub Actions Secrets에 등록된 변수

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
VITE_FIREBASE_DATABASE_ID
GEMINI_API_KEY

# 릴리즈 APK 서명용
RELEASE_KEYSTORE_BASE64      # release.keystore 파일을 base64 인코딩한 값
RELEASE_STORE_PASSWORD
RELEASE_KEY_ALIAS            # lumina-daily-key
RELEASE_KEY_PASSWORD
```

### 로컬 개발

루트에 `.env` 파일 생성 (`.gitignore`에 포함됨):
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
(나머지 동일)
```

---

## CI/CD 워크플로우 (`.github/workflows/deploy.yml`)

### 트리거

- **`v*` 태그 푸시** → 빌드 + 릴리즈 생성
- **`workflow_dispatch`** → GitHub Actions UI에서 수동 실행
- 일반 `main` 브랜치 푸시는 빌드를 트리거하지 않음

### Job 구조

```
build ──┐
        ├── release  (v{version} 태그로 릴리즈 생성)
build-apk ┘
```

### `build` job
- Node.js **22** 사용 (Capacitor CLI가 Node 22+ 필수)
- lint → test → `npm run build` (base 플래그 없음) → dist.zip 생성
- 버전은 `package.json`의 `version` 필드에서 읽어 `$GITHUB_OUTPUT`에 `version=1.0.4` 형태로 출력

### `build-apk` job
- Node.js 22, Java 21 (Temurin), Android SDK 사용
- `npm run build` → `npx cap sync android` → `./gradlew assembleRelease`
- CI에서 `RELEASE_KEYSTORE_BASE64` 시크릿을 base64 디코딩해 `android/app/release.keystore`로 복원 후 서명
- `gradlew` 실행 전 `chmod +x gradlew` 필수 (CI 환경에서 실행 권한 없음)
- Gradle이 Maven Central에서 의존성 받다가 일시적 403 오류가 날 수 있음 → `gh run rerun <id> --failed`로 재실행하면 대부분 해결됨

### `release` job
- `build`와 `build-apk` 완료 후 실행
- 태그: `v{version}` (예: `v1.0.4`) — `v` 접두사 한 번만 붙음
  - **주의:** version output은 숫자만(`1.0.4`), 릴리즈 step에서 `v${{ version }}` 형태로 `v`를 붙임. 둘 다 `v`를 붙이면 `vv1.0.4` 태그가 생성되는 버그 발생

### GitHub Pages 설정 — 절대 바꾸지 말 것

- Pages 모드: **legacy**, source: `main` 브랜치 `/docs` 폴더
- `actions/configure-pages`나 `actions/deploy-pages`를 workflow에 추가하면 Pages가 Actions 모드로 전환되어 랜딩 페이지 대신 React 앱이 서빙됨 → 추가하지 말 것
- Pages 모드 확인: `gh api repos/jeiel85/lumina-daily/pages | grep build_type`
- legacy 모드 복원: `gh api repos/jeiel85/lumina-daily/pages --method PUT -f build_type=legacy -f 'source[branch]=main' -f 'source[path]=/docs'`
- Vite 빌드에 `--base /lumina-daily/` 플래그를 붙이지 말 것 — APK 내부에서 경로가 깨짐

---

## Android 빌드

### Capacitor 설정 (`capacitor.config.ts`)

```ts
webDir: 'dist'   // React 빌드 결과물 — 절대 'docs'로 바꾸지 말 것
                 // 'docs'로 설정하면 APK에서 랜딩 페이지가 열림
server: {
  hostname: 'lumina-762f8.firebaseapp.com',  // Google OAuth 허용 도메인
  androidScheme: 'https'
}
```

### 서명 (`android/app/build.gradle`)

- **debug 빌드**: `android/app/debug.keystore` 고정 사용
  - SHA-1: `97:25:5E:13:C9:F6:4D:F7:23:5B:39:88:E7:CA:33:9F:09:1B:1D:92`
- **release 빌드**: 환경변수(`RELEASE_STORE_FILE` 등)에서 읽음
  - 키스토어 파일: `android/app/release.keystore` (gitignore됨, CI에서 Secret으로 복원)
  - SHA-1: `76:D1:EF:4A:8D:99:78:32:7C:F5:2A:6E:DE:F4:B7:A9:26:73:79:E4`
  - 릴리즈 키스토어 원본은 로컬 PC 및 안전한 곳에 백업 필수 — 분실 시 앱 재등록 필요

### 버전 올릴 때 수정할 파일 두 곳

1. `package.json` → `"version": "x.x.x"`
2. `android/app/build.gradle` → `versionCode N` (정수, 1씩 증가), `versionName "x.x.x"`

**현재 버전**: `package.json` = `1.4.1`, `versionCode` = `32`, `versionName` = `1.4.1`

---

### ⚠️ 태그 푸시 전 필수 체크리스트 (절대 생략 금지)

태그를 푸시하기 전에 아래 세 값이 **모두 일치**하는지 반드시 확인한다.
불일치 시 태그 이름과 APK 내부 버전이 달라지는 버그가 발생한다 (실제 발생 사례: v1.1.2 태그인데 APK 안은 1.0.9였음).

```bash
# 세 값이 모두 같아야 태그 푸시 가능
node -p "require('./package.json').version"
grep -E "versionName" android/app/build.gradle
grep -E "versionCode" android/app/build.gradle
```

| 파일 | 확인할 값 | 예시 |
|------|-----------|------|
| `package.json` | `"version"` | `"1.3.10"` |
| `android/app/build.gradle` | `versionName` | `"1.3.10"` |
| `android/app/build.gradle` | `versionCode` | `30` (1씩 단조 증가) |

**체크 통과 후에만 태그 생성:**

```bash
git tag v1.2.7
git push origin v1.2.7
```

> **스크립트 활용:** `scripts/release.mjs`를 사용하면 버전 확인 + 태그 푸시를 자동으로 처리한다.

---

## 릴리즈 관리

### 버전 올리는 순서

1. `package.json`과 `android/app/build.gradle` 버전 수정
2. 커밋 & `main` 푸시 (빌드 없음)
3. **태그 푸시 전 반드시 버전 일치 확인** (이 단계를 건너뛰지 말 것):

```bash
node -p "require('./package.json').version"
grep -E "versionCode|versionName" android/app/build.gradle
```

4. 두 파일 버전이 일치하면 태그 생성 & 푸시

```bash
git tag v1.0.5
git push origin v1.0.5
```

> **주의:** 태그는 반드시 버전 업 커밋 이후에 붙여야 한다. 태그가 버전 업 커밋 이전을 가리키면 릴리즈 이름이 이전 버전으로 생성된다.

4. `gh release edit vX.X.X --notes "..."` 로 릴리즈 노트 직접 작성

### Play Store 출시 관련

- 현재 릴리즈 APK(`assembleRelease`)로 빌드 중 — Play Store 제출 가능
- Play Store는 APK 대신 **AAB(Android App Bundle)** 권장 → 필요 시 `bundleRelease`로 전환
- Play App Signing 활성화 시: 지금 키스토어는 "업로드 키" 역할, 실제 배포는 구글 서버 키로 재서명됨

### 릴리즈 노트 작성 기준

자동 생성된 PR 목록 대신 아래 형식으로 직접 작성:
- 변경 내용을 카테고리별로 (기능/수정/보안/CI 등)
- 설치 방법 포함 (APK 다운로드 → 알 수 없는 앱 허용 → 설치)
- 웹앱 URL 포함

---

## 자주 쓰는 명령어

```bash
# 로컬 개발
npm run dev

# 빌드 및 테스트
npm run build
npm test
npm run lint

# 릴리즈 배포
git tag v1.0.5
git push origin v1.0.5

# CI 확인
gh run list --limit 5 --repo jeiel85/lumina-daily
gh run view <run_id> --log-failed --repo jeiel85/lumina-daily
gh run rerun <run_id> --failed --repo jeiel85/lumina-daily

# 릴리즈
gh release list --repo jeiel85/lumina-daily
gh release edit v1.0.5 --repo jeiel85/lumina-daily --notes "..."

# GitHub Pages 설정 확인
gh api repos/jeiel85/lumina-daily/pages
```

---

## 공통 작업 규칙 (Generic Rules)

이 섹션은 AI 코딩 에이전트가 이 저장소에서 작업할 때 따라야 하는 공통 작업 규칙입니다.

### 1. Automation First Principle

이 프로젝트의 에이전트는 가능한 한 작업을 끝까지 자동으로 수행합니다. 일반적인 개발 작업에서는 사용자에게 중간 확인을 요구하지 않습니다. 명시된 작업 범위 안에서는 에이전트가 직접 분석, 구현, 문서 갱신, 검증, 커밋, 푸시, CI 확인까지 진행합니다.

**사용자 확인 없이 자동 진행하는 항목:**
- 최신 소스 동기화, 작업 범위 분석, 관련 이슈 확인
- 코드 수정 및 관련 문서(`CHANGELOG.md`, `HISTORY.md` 등) 갱신
- 로컬 검증, 커밋 생성, 원격 저장소 푸시, CI 상태 확인

**중단 후 보고가 필요한 항목:**
- `git reset --hard`, `git push --force`, 브랜치/태그 삭제
- 사용자 데이터 삭제 가능성, 롤백이 어려운 마이그레이션
- 시크릿, API 키, 릴리즈 키 관련 변경
- 유료 서비스 추가, 보안 위험, 정책 충돌 가능성이 있는 경우

### 2. 기본 커뮤니케이션 규칙

- 사용자에게 하는 설명, 작업 요약, 커밋 메시지, 이슈 코멘트는 기본적으로 **한국어**로 작성합니다.
- 기술 용어는 필요하면 원어를 병기하되, 설명의 중심 언어는 한국어로 유지합니다.
- 불확실한 부분은 추측으로 단정하지 않고 근거, 제약, 확인 결과를 명시합니다.
- 사용자가 요청하지 않은 대규모 리팩터링, 디자인 전면 수정, 기능 확장은 하지 않습니다.

### 3. 작업 시작 전 필수 절차

작업을 시작하기 전에 반드시 최신 소스를 기준으로 상태를 확인합니다.
```bash
git fetch origin
git pull origin main
git status
```
그 다음 `AGENTS.md`, `README.md`, `CHANGELOG.md`, `HISTORY.md` 등을 순서대로 확인하여 프로젝트의 현재 상태와 규칙을 파악합니다.

### 4. Scope Control Rules

작업 범위는 요청된 이슈 또는 task에 한정합니다. 관련 없는 리팩터링, 전체 포맷팅, 디자인 전면 수정, 임의의 기능 추가 등은 하지 않습니다. 필요해 보이는 개선 사항은 후속 작업으로 기록합니다.

### 5. 금지 및 사전 승인 필요 항목

아래 작업은 사용자가 명시적으로 승인하지 않으면 진행하지 않습니다.
- 네트워크 권한 추가, 신규 API 연동, 로그인/인증 기능 추가
- 분석/광고 SDK 추가, 민감 정보 수집 또는 외부 전송
- 릴리즈 키, API 키 등 비밀정보를 저장소에 커밋
- 사용자가 요청하지 않은 대규모 기술 스택 변경

### 6. 데이터 및 보안 원칙

- 사용자 데이터는 로컬 우선으로 다루며, 외부 전송 시 목적과 범위를 명확히 합니다.
- 환경 변수와 시크릿은 `.env` 또는 CI Secrets를 사용하고 Git에 포함하지 않습니다.
- 로그에 토큰, 개인정보 등이 남지 않도록 주의합니다.

### 7. 테스트 및 품질 확인

변경 후 가능한 범위에서 아래 순서로 검증합니다.
1. 정적 검사 또는 린트 (`npm run lint`)
2. 타입 체크
3. 단위 테스트 (`npm test`)
4. 통합/E2E 테스트 (`npx playwright test`)
5. 빌드 (`npm run build`)

### 8. CHANGELOG 작성 규칙

`CHANGELOG.md`는 사용자가 이해할 수 있는 변경 요약으로 작성합니다.
- 최신 버전이 상단에 오도록 역순으로 작성하며, 날짜와 버전을 명시합니다.
- **Added, Changed, Fixed, Removed, Security, Performance** 등의 섹션을 활용합니다.
- 실제 실행하지 않은 테스트나 빌드 성공을 기록하지 않습니다.

### 9. 커밋 및 푸시 규칙

소스 코드 수정 후 검증이 끝나면 즉시 커밋하고 푸시합니다.
- **형식:** `<type>: <변경 요약>` (예: `feat: 새 기능 추가`, `fix: 오류 수정`)
- 커밋 메시지는 한국어를 기본으로 하며, 변경 내용을 명확히 기술합니다.

### 10. 중단 조건

아래 상황에서는 임의로 진행하지 말고 중단 후 보고합니다.
- 프로젝트 명세와 작업 요청이 충돌하는 경우
- 보안, 개인정보, 라이선스 위반 가능성이 있는 경우
- 필요한 권한/시크릿이 없어 검증할 수 없는 경우
- 기존 사용자 데이터 손실 가능성이 있는 경우
- 파괴적 Git 명령이 필요한 경우

---

## 명언 데이터 관리

명언 풀은 `src/data/quotes.json` 한 곳에서 관리하고, 앱은 **번들된 사본 + JSDelivr CDN 원격 캐시** 하이브리드로 로드한다.

### 데이터 구조

```json
{
  "version": 1,                         // 변경할 때마다 +1
  "generatedAt": "2026-05-21T...",
  "quotes": [
    {
      "id": "ko-motivation-0001",       // {lang}-{theme}-{4자리} 고유 ID
      "lang": "ko",                     // ko | en | ja | zh
      "theme": "motivation",            // 9개 테마 중 하나
      "text": "...",
      "author": "...",                  // 실존 인물 OR "작자 미상" / "Unknown" / "詠み人知らず" / "佚名"
      "explanation": "..."              // 2-3문장 해설
    }
  ]
}
```

테마: `motivation, comfort, humor, success, business, love, philosophy, wisdom, life`

### 명언 추가 흐름

1. **편집**
   - 직접 추가: `src/data/quotes.json`의 `quotes` 배열에 객체 추가. ID는 같은 (lang, theme) 안에서 최대 번호 + 1
   - Gemini로 대량 추가: `GEMINI_API_KEY=... node scripts/generate-quotes.mjs --resume --per-bucket=60` (현재 50 → 60처럼 늘림)
   - ChatGPT 수동: `scripts/QUOTE_PROMPT.md` 가이드 따라 `scripts/quote-drafts/{lang}-{theme}.json` 저장 후 `node scripts/import-quotes.mjs`

2. **version 올리기** — `src/data/quotes.json`의 `"version"` 필드를 +1. **이걸 잊으면 사용자 앱이 새 데이터를 받지 않는다.**

3. **commit + push**
   ```
   git add src/data/quotes.json
   git commit -m "data: 명언 풀 vN+1 (총 X개)"
   git push origin main
   ```

4. **반영 대기** — JSDelivr CDN 캐시(약 5~10분) 후 사용자 앱이 24시간마다 1회 체크할 때 자동 다운로드. 즉시 반영은 안 됨.

### 원격 호스팅 동작

- URL: `https://cdn.jsdelivr.net/gh/jeiel85/lumina-daily@main/src/data/quotes.json`
- 클라이언트: 앱 마운트 시 `maybeRefreshRemoteQuotes()` 호출 (`src/utils/quotePool.ts`)
- 24시간 안에 다시 부르면 no-op. fetch 실패해도 번들된 사본으로 작동
- 새 버전 받으면 `localStorage['quote.remotePool']` 에 저장 → 다음부터 우선 사용

### 강제 새로고침 (테스트용)

브라우저 콘솔에서:
```js
import('./src/utils/quotePool').then(m => m.resetRemoteCache());
location.reload();
```

### 주의

- **`version` 누락/감소** → 클라이언트가 무시함 (안전장치)
- **JSON 깨짐** → 원격 fetch 실패로 처리, 번들 사용 (앱 영향 0)
- **APK 재배포 vs 원격 갱신** — 원격은 데이터만 갱신. UI/로직 변경 필요하면 APK 새로 배포
- **JSDelivr 5분 캐시** — push 직후 안 보일 수 있음. 급할 때는 `https://purge.jsdelivr.net/gh/jeiel85/lumina-daily@main/src/data/quotes.json` 로 purge 가능

