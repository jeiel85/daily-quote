# Lumina Mobile Development Guidelines

이 문서는 Lumina 프로젝트의 모바일 애플리케이션 개발 철학 및 누락 없는 연속성을 위한 엄격한 지침을 정의합니다.

## 🚨 [CRITICAL] 기능 누락 방지 수칙 (Feature Integrity)
- **기능 보존 원칙**: 모든 코드 수정 및 리팩토링 시, 기존에 구현된 핵심 기능(카테고리, 다국어, 인증 등)이 목록에서 삭제되거나 누락되지 않도록 **철저히 검증**해야 합니다.
- **필수 기능 체크리스트**:
  1. 명언 카테고리 (8종: Motivation, Comfort, Humor, Success, Love, Calm, Growth, Leadership)
  2. 다국어 지원 (4종: ko, en, ja, zh)
  3. 구글 로그인 및 기록 동기화
  4. 앱 테마 시스템 (White, Dark, System, Material You)
  5. 지혜 배달(알림) 시간 설정

## 1. 디자인 및 가독성 지침
- **고대비(High Contrast) 보장**: 모든 테마(특히 Dark/Material)에서 버튼 배경과 글자색이 겹쳐 보이지 않도록 대비가 확실한 색상 조합을 사용합니다. (`subText`, `accent` 등의 명시적 구분)
- **UI 일관성**: 헤더, 카드, 버튼 등의 레이아웃은 프로젝트 초기 브랜딩을 계승하며, 사용자 요청이 없는 한 임의로 대폭 변경하지 않습니다.

## 2. UI/UX 레이아웃 지침
- **상단 SafeArea**: 상태바와 겹치지 않도록 안드로이드 기준 `paddingTop: 40` 이상의 SafeArea 처리를 항상 적용합니다.
- **카드 캡처**: 공유 이미지 생성 시 배경 잔상이 남지 않도록 라운딩을 제거한 캡처 모드를 지원합니다.

## 3. 다국어 및 기술 스택
- **i18n**: `TRANSLATIONS` 객체에서 누락된 언어가 발생하지 않도록 정기적으로 점검합니다.
- **Build System**: 아래 빌드 워크플로우를 참고합니다.

## 4. 빌드 워크플로우

### 개발 모드 (권장 - Fast Refresh)
```
# 최초 1회: 네이티브 빌드 + 설치
dev_setup.bat

# 이후 매일: Metro 서버만 실행
dev_start.bat
```
- 코드 수정 후 저장하면 앱에 즉시 반영 (재빌드 불필요)
- `google-services.json`, `app.json`, 네이티브 패키지 변경 시에만 `dev_setup.bat` 재실행

### 프로덕션 빌드
```
build_and_install.bat
```
- `lumina-debug.keystore` 사용 (SHA1: `97:25:5E:13:...` Firebase 등록 완료)
- prebuild → JS Bundle → `gradlew installDebug` 순서로 실행

## 5. Firebase 설정 (lumina-762f8)

| 항목 | 값 |
|------|-----|
| Project ID | `lumina-762f8` |
| Android Package | `com.jeiel85.luminadaily` |
| Keystore (dev) | `lumina-debug.keystore` |
| SHA1 (dev) | `97:25:5E:13:C9:F6:4D:F7:23:5B:39:88:E7:CA:33:9F:09:1B:1D:92` |
| SHA1 (default debug) | `9E:09:3F:5C:04:3C:65:E3:9E:A7:AF:4A:99:27:E8:F7:2D:79:15:77` |

- Firestore 보안 규칙: 로그인 사용자는 자신의 `users/{uid}/history` 경로만 읽기/쓰기 허용
- Google Sign-in: Firebase Console → Authentication → Sign-in method → Google 활성화 필요

## 6. Google Sign-in 트러블슈팅

| 에러 코드 | 원인 | 해결 |
|-----------|------|------|
| `[10] DEVELOPER_ERROR` | APK 서명 SHA1이 Firebase에 미등록 | Firebase Console에 SHA1 추가 후 google-services.json 재다운로드 |
| `[7]` | 네트워크 오류 | 인터넷 연결 확인 |
| `[12500]` | Play Services 버전 낮음 | Play Services 업데이트 |

- `@react-native-google-signin/google-signin` **v16** 기준: `signIn()` 취소 시 throw 대신 `{ type: 'cancelled' }` 반환
- `webClientId`: `136746254242-rqqaqpdltemsm1i1orrnp66oholf6qqe.apps.googleusercontent.com` (type 3, Web)

---
*Last Updated: 2026-04-04 | Ver 1.3*
