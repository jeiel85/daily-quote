# CHANGELOG

## v1.4.0 - 2026-05-21
### 🚀 주요 변경 (Major Change)
- **AI 명언 생성 제거** — 매번 Gemini 호출하던 구조 폐기. 앱에 번들된 명언 풀(1,800개 = 9테마 × 4언어 × 50개)에서 매일 1회 자동 배달
- 같은 날 다시 열어도 같은 명언 (1일 1배달), 다음 날 자동으로 새 명언
- 사용자별 중복 방지 — 이미 본 명언은 풀이 한 바퀴 돌기 전까지 다시 안 나옴
- 알림 시간 변경도 하루 1회만 가능 (실수 방지)

### 🆕 추가 (Added)
- JSDelivr CDN 원격 명언 호스팅 — 새 명언 추가하면 앱이 24시간 안에 자동 다운로드 (앱 재배포 없이 풀 업데이트)
- 번들된 사본 + 원격 캐시 하이브리드 — 오프라인에서도 정상 작동

### 🗑️ 제거 (Removed)
- Gemini API 호출 / Cloud Functions 의존성 완전 제거 (서버 비용 0원)
- 커스텀 키워드 설정 (AI 없이는 무의미)
- "새로고침" / "첫 명언 생성하기" 버튼 (1일 1배달 정책으로 불필요)

### 🎨 카피 톤 정리 (Changed)
- 4개 언어(ko/en/ja/zh) i18n에서 "AI가 생성" 표현 모두 "엄선" / "배달" 톤으로 변경
- 온보딩 / 구독 안내 / 빈 상태 메시지 / 해설 라벨("AI 해설" → "해설")

### 🐛 수정 (Fix)
- 구독 시점에 LocalNotifications 자동 스케줄 — 이전엔 알림 시간을 직접 한 번 바꿔야 알림 등록되던 문제

### 📦 설정
- 버전 범프: 1.3.10 → 1.4.0
- Android versionCode: 30 → 31

## v1.3.10 - 2026-05-12
### 🐛 버그 수정 (Fix)
- [#267](https://github.com/jeiel85/lumina-daily/issues/267) 다국어(i18n) 누락 키 보강 — 일부 화면에서 키가 그대로 노출되던 문제 수정
- [#260](https://github.com/jeiel85/lumina-daily/issues/260) `referral_count`에 `{{count}}` 인터폴레이션 적용 (친구 초대 카운트 표시 정상화)

### 📦 설정
- 버전 범프: 1.3.9 → 1.3.10
- Android versionCode: 29 → 30
- Play Store 업데이트용 통합 빌드 (1.3.0 이후 누적 변경 포함)

## v1.3.3 - 2026-05-06
### 🎨 개선 (Improvement)
- 앱 로딩 화면 텍스트 가운데 정렬 적용 (왼쪽 치우침 수정)
- 다크 테마 로딩 화면 텍스트 대비 개선 (가독성 향상)
  - [#246](https://github.com/jeiel85/lumina-daily/issues/246) 에러 바운더리 관련 UI 일관성

### 📦 설정
- 버전 범프: 1.3.2 → 1.3.3
- Android versionCode: 22 → 23

## v1.3.2 - 2026-05-06
### 📦 설정
- 버전 범프: 1.3.1 → 1.3.2
- Android versionCode: 21 → 22

## v1.3.1 - 2026-05-06
### 📦 설정
- 버전 범프: 1.3.0 → 1.3.1
- Android versionCode: 20 → 21

## v1.3.0 - 2026-05-06
### 🎨 개선 (Improvement)
- 다크모드 배경색 밝게 조정 (neutral-950→900, 900→800)
- 다크모드 텍스트 대비 개선 (neutral-400→300, 300→200)
- QuoteCard, Header, HistoryItem 컴포넌트 다크모드 색상 수정

### ✨ 신규 기능 (Features)
- **인앱 리뷰(#70)**: 3회 이상 명언 저장/공유 시 리뷰 유도 (@capacitor-community/in-app-review)
- **로컬 알림(#58)**: 설정한 시간에 매일 알림 발송 (@capacitor/local-notifications)
- **초대/공유 리워드(#71)**: 사용자별 리퍼럴 코드 생성 및 표시 UI 추가

### 🌐 웹 최적화 (ASO)
- 앱 스토어 다국어 설명 추가 (docs/app-store-descriptions.md)
- 메타 태그 및 키워드 최적화 (docs/index.html)
- robots.txt 및 sitemap.xml 추가

### 🔧 리팩토링
- TypeScript 린트 에러 수정 (THEME_SEED_TOOLS 오타, LocalNotifications API)

### 📦 설정
- 버전 범프: 1.2.9 → 1.3.0
- Android versionCode: 19 → 20

## v1.2.9 - 2026-05-04
### Changed
- version bump
- AAB build support for Play Store

## v1.2.7 - 2026-05-04
### Changed
- version bump
- AAB build support for Play Store

## v1.2.6 - 2026-05-04
### Added
- daily API usage limit added

## v1.2.5 - 2026-05-04
### Changed
- AAB build configuration for Play Store

## v1.2.4 - 2026-05-03
### Fixed
- Android Google 로그인 실패 수정
- Firebase 환경 변수가 placeholder 값일 때 잘못된 Auth 설정으로 빌드되는 문제 방지
- APK 내부 WebView에서 Firebase Web Messaging SDK 초기화하지 않도록 조정 (unsupported-browser 오류 제거)
- Firebase Android 앱에 debug SHA-256 추가 및 Google Cloud Android API key 생성 시 debug/release SHA-1 추가

## v1.2.3 - 2026-04-25
### Fixed
- credential manager fix for Google Sign-In

## v1.2.2 - 2026-04-25
### Changed
- version bump

## v1.2.1 - 2026-04-25
### Changed
- version bump

## v1.2.0 - 2026-04-24
### Added
- initial release with Google login, Firebase integration
