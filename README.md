# Lumina Daily

> 매일 한 줄, 당신의 하루를 밝히는 지혜 루틴

Lumina Daily는 Android 전용 명언 · 성찰 앱입니다. v1.4.0부터 매번 AI를 호출하는 방식 대신, 앱에 번들된 1,800개 명언 풀과 JSDelivr 원격 캐시를 함께 사용해 매일 한 번 새로운 명언과 해설을 배달합니다. 오프라인에서도 작동하고, 명언 데이터는 앱 재배포 없이 원격으로 확장할 수 있습니다.

- Android 패키지명: `com.jeiel85.luminadaily`
- 소개 페이지: [https://jeiel85.github.io/lumina-daily-android/](https://jeiel85.github.io/lumina-daily-android/) — 정적 랜딩 페이지, 웹앱 아님
- 현재 버전: **v1.4.1** (Android `versionCode` 32)
- 개인정보처리방침: [https://jeiel85.github.io/lumina-daily-android/privacy-policy.html](https://jeiel85.github.io/lumina-daily-android/privacy-policy.html)

> GitHub Pages는 앱 소개용 랜딩 페이지입니다. 실제 앱은 Android APK/AAB에 번들된 Capacitor 앱으로 동작합니다.

---

## 주요 기능

### 매일 한 번 배달되는 오늘의 명언
- 번들 명언 풀 1,800개: 9개 테마 x 4개 언어 x 50개
- 같은 날 다시 열어도 같은 명언 유지
- 이미 본 명언은 풀이 한 바퀴 돌기 전까지 중복 방지
- JSDelivr 원격 캐시로 새 명언 풀 자동 갱신

### 공유하기 좋은 명언 카드
- 명언과 해설을 감성적인 이미지 카드로 생성
- 저장, 공유, 기록 조회 지원
- 인앱 리뷰 트리거와 자연스럽게 연결되는 저장/공유 흐름

### 알림과 기록
- 사용자가 정한 시간에 매일 알림 수신
- 알림 시간 변경은 하루 1회로 제한
- Google 로그인 시 명언 기록과 설정을 Firebase에 저장

### 4개 언어와 9개 테마
- 언어: 한국어, English, 日本語, 中文
- 테마: motivation, comfort, humor, success, business, love, philosophy, wisdom, life

### Android 네이티브 연동
- React + Vite + Capacitor 기반
- Google 로그인, FCM 푸시, 로컬 알림, 햅틱, 파일 저장, 공유, 인앱 리뷰 연동
- Light / Dark / System / Material You 테마

---

## 기술 스택

### Frontend & Mobile
![React](https://img.shields.io/badge/react-19-%2320232a?logo=react)
![TypeScript](https://img.shields.io/badge/typescript-5.8-%23007ACC)
![Vite](https://img.shields.io/badge/vite-6-%23646CFF)
![Capacitor](https://img.shields.io/badge/capacitor-8-%23119EFF)
![Tailwind CSS](https://img.shields.io/badge/tailwindcss-4-%2338B2AC)
![Motion](https://img.shields.io/badge/motion-12-%23000000)

### Backend & Data
![Firebase](https://img.shields.io/badge/firebase-12-%23FFCA2D?logo=firebase)
![Firestore](https://img.shields.io/badge/Firestore-rules-%23FFA000)
![FCM](https://img.shields.io/badge/FCM-Messaging-%23FF6F00)
![JSDelivr](https://img.shields.io/badge/JSDelivr-quote_pool-orange)

### Testing
![Vitest](https://img.shields.io/badge/vitest-4-%236E9F18)
![Playwright](https://img.shields.io/badge/playwright-1-%232EAD33)

---

## 시작하기

### 설치 및 개발 서버
```bash
npm install
npm run dev
```

### 환경 변수
`.env.example`을 복사해 `.env`를 작성합니다.

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=lumina-762f8
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_DATABASE_ID=lumina-daily
```

### 웹 자산 빌드
```bash
npm run build
```

`dist/`는 APK/AAB에 번들될 앱 자산입니다. GitHub Pages에는 배포하지 않습니다.

### Android 빌드
```bat
.\build-and-install.bat
```

주요 산출물:
- Debug APK: `android\app\build\outputs\apk\debug\app-debug.apk`
- Release APK: `android\app\build\outputs\apk\release\app-release.apk`
- Release AAB: `android\app\build\outputs\bundle\release\app-release.aab`

---

## 명언 데이터

명언 풀은 [src/data/quotes.json](./src/data/quotes.json)에서 관리합니다.

```json
{
  "version": 1,
  "quotes": [
    {
      "id": "ko-motivation-0001",
      "lang": "ko",
      "theme": "motivation",
      "text": "...",
      "author": "...",
      "explanation": "..."
    }
  ]
}
```

원격 데이터 URL:

[https://cdn.jsdelivr.net/gh/jeiel85/lumina-daily@main/src/data/quotes.json](https://cdn.jsdelivr.net/gh/jeiel85/lumina-daily@main/src/data/quotes.json)

데이터를 변경할 때는 `version`을 올려야 사용자 앱이 새 풀을 받아옵니다. 클라이언트는 24시간에 한 번 원격 풀을 확인하고, 실패하면 번들된 사본으로 계속 동작합니다.

---

## 테스트

```bash
npm run lint
npm test
npx playwright test
npm run build
```

---

## 프로젝트 구조

```text
lumina-daily/
├── src/
│   ├── App.tsx
│   ├── data/quotes.json
│   ├── utils/quotePool.ts
│   ├── components/
│   ├── constants/
│   ├── i18n/
│   └── e2e/
├── docs/                      # GitHub Pages 정적 랜딩 페이지
├── android/                   # Capacitor Android 프로젝트
├── public/                    # 앱 빌드용 정적 자산
├── scripts/                   # 명언 생성/가져오기/릴리즈 보조 스크립트
├── capacitor.config.ts        # webDir: dist
├── vite.config.ts
├── firestore.rules
└── build-and-install.bat
```

---

## 버전 하이라이트

| 버전 | 주요 변경 |
|---|---|
| **1.4.1** | Play Store 프로덕션 출시용 버전 업데이트 |
| **1.4.0** | Gemini 실시간 생성 제거, 1,800개 명언 풀 기반 1일 1배달, JSDelivr 원격 캐시 추가 |
| 1.3.10 | i18n 누락 키 보강 + referral_count 인터폴레이션 버그 수정 |
| 1.3.9 | Cloud Functions Gemini 프록시 + GitHub Pages 정적 랜딩 전환 |
| 1.3.8 | 햅틱 피드백 ON/OFF 설정 |
| 1.3.0 | 인앱 리뷰, 로컬 알림, 리퍼럴, ASO 다국어 |
| 1.2.0 | 초기 릴리즈 — Google 로그인, Firebase 연동 |

자세한 내역은 [CHANGELOG.md](./CHANGELOG.md)를 참고하세요.

---

## 공개 자료

- GitHub Pages 랜딩: [docs/index.html](./docs/index.html)
- 개인정보처리방침: [docs/privacy-policy.html](./docs/privacy-policy.html)
- Play Store 설명 초안: [docs/app-store-descriptions.md](./docs/app-store-descriptions.md)
- Play Store 스크린샷/그래픽: [store-screenshots/](./store-screenshots/)

---

## 개발 지침

- [AGENTS.md](./AGENTS.md) — 에이전트 작업 규칙과 배포 정책
- [CLAUDE.md](./CLAUDE.md) — GitHub Pages 잠금 정책
- [MOBILE_GUIDELINES.md](./MOBILE_GUIDELINES.md) — 모바일 빌드/디버깅 가이드
- [SIGNING_HANDOFF.md](./SIGNING_HANDOFF.md) — Play Store 서명키 핸드오프
- [ROADMAP.md](./ROADMAP.md) — 제품 로드맵
- [HISTORY.md](./HISTORY.md) — 이슈 기반 마일스톤 트래커

---

## 라이선스

Copyright 2026 Lumina Project. All rights reserved.
