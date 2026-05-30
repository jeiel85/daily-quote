# Lumina Daily Signing Handoff

마지막 업데이트: 2026-05-09 (KST)

## 목적
- 다른 세션/에이전트가 바로 이어서 작업할 수 있도록 서명 상태를 빠르게 공유한다.
- 로컬 빌드와 GitHub CI 빌드가 같은 업로드 키로 서명되는지 기준을 명시한다.
- 키스토어 변경 시 SHA-1을 등록해야 하는 모든 위치를 한곳에 모은다.

## 현재 업로드 키 지문 (기준값)
- Alias: `lumina-upload`
- SHA-1: `39:64:39:BF:65:1D:ED:F4:CC:4C:B9:82:58:1A:29:52:CC:AF:1D:9F`
- SHA-256: `94:69:60:11:A3:72:2A:1D:12:A7:5F:2E:C9:FA:C7:AD:94:F5:53:26:3D:18:81:71:B6:98:6E:0E:57:E8:40:C4`
- 만료: 2053-09-22

## 검증 결과
- 로컬 빌드 산출물
  - `android/app/build/outputs/apk/release/app-release.apk`
  - `android/app/build/outputs/bundle/release/app-release.aab`
  - 위 두 파일의 서명 지문이 기준값과 일치함.
- GitHub Actions
  - run id: `25539949160` (v1.3.6) 성공
  - `build-apk` 성공 및 산출물 생성
  - 산출물 APK 서명 지문이 기준값과 일치함.
- Google 로그인 end-to-end (sideload, 2026-05-09)
  - 계정 선택 시트 → idToken 획득 → Firebase 로그인 → 메인 화면 진입 정상 확인.

## 로컬 설정 상태
- 로컬 keystore 파일 위치: `.keystore/lumina-release.jks` (2026-05-27 이전: 루트의 `lumina-release.jks`)
- 백업 위치: `.keystore/lumina-upload-key.jks.bak` (SHA-256 동일, 이전 `.temp/lumina-upload-key.jks`에서 이동) + `.temp/lumina_uploadkey_20260507_103408/`(base64/cert 자료)
- 두 폴더 모두 `.gitignore` 대상
- `android/local.properties`에서 release 서명 경로:
  - `RELEASE_STORE_FILE=../../.keystore/lumina-release.jks`
  - `RELEASE_KEY_ALIAS=lumina-upload`
- 주의: `android/local.properties`는 민감정보 포함 가능성이 있어 Git 커밋 금지.

## GitHub Secrets (개념)
- 아래 4개가 반드시 같은 키 세트를 가리켜야 함:
  - `RELEASE_KEYSTORE_BASE64`
  - `RELEASE_STORE_PASSWORD`
  - `RELEASE_KEY_ALIAS`
  - `RELEASE_KEY_PASSWORD`
- 비밀번호/alias 불일치 시 `Cannot recover key` 또는 `Keystore was tampered` 오류 발생.

## ⚠️ 키스토어 변경 시 SHA-1 등록 체크리스트 (3군데)

키스토어를 새로 발급받으면 **세 군데 모두**에 새 SHA-1을 등록해야 한다.
하나라도 누락되면 sideload된 APK에서 Google 로그인이 깨진다.

### 1. Firebase Console — OAuth client (idToken 획득용)
- 위치: https://console.firebase.google.com/ → 프로젝트 `lumina-762f8` → ⚙️ 프로젝트 설정 → 일반 → 내 앱 → Android 앱 (`com.jeiel85.luminadaily`) → SHA 인증서 지문
- 등록값: SHA-1 + SHA-256 둘 다
- 누락 시 logcat 신호:
  ```
  W Auth: [GetTokenResponseHandler] Server returned error:
     This android application is not registered to use OAuth2.0,
     please confirm the package name and SHA-1 certificate fingerprint
     match what you registered in Google Developer Console.
  W CredentialManager: Get credential errorMsg=[28444] Developer console is not set up correctly.
  ```
- 사용자 화면: 계정 선택 시트가 안 뜸 (즉시 실패).

### 2. `android/app/google-services.json` 갱신
- 위치: Firebase Console에서 1번 작업 후 같은 페이지 하단의 "google-services.json 다운로드"
- 적용: 다운로드한 파일을 `android/app/google-services.json`에 덮어쓰기
- 검증:
  ```bash
  grep certificate_hash android/app/google-services.json
  # 새 SHA-1 (39:64:39... 의 lowercase hex 396439bf651dedf4cc4cb982581a2952ccaf1d9f) 가 포함되어야 함
  ```
- 빠뜨려도 서버사이드 검증은 통과되지만 클라이언트 측 oauth_client 매칭 정합성 차원에서 권장.

### 3. Google Cloud Console — API 키 Android 앱 제한 (Identity Toolkit API용)
- 위치: https://console.cloud.google.com/apis/credentials?project=lumina-762f8 → API 키 → "Android key (auto created by Google Service)" → 애플리케이션 제한사항 → Android 앱
- 등록값: 패키지 이름 `com.jeiel85.luminadaily` + 새 SHA-1
- 누락 시 사용자 화면 (계정 선택 후):
  ```
  로그인 중 오류가 발생했습니다:
  An internal error has occurred.
  [ Requests from this Android client application com.jeiel85.luminadaily are blocked. ]
  ```
- 이 단계는 Firebase Console에서 자동 동기화되지 않으므로 별도 작업이 필요하다 (가장 빠뜨리기 쉬운 곳).

### 등록 후
- 5분 정도 propagation 대기.
- 옛 SHA-1 항목은 즉시 삭제하지 말고, 이전 키로 서명된 APK가 더 이상 유통되지 않음을 확인한 후 정리.

## Play Console 체크포인트
- App Integrity > Upload key certificate SHA-1 이 아래 값과 같아야 함:
  - `39:64:39:BF:65:1D:ED:F4:CC:4C:B9:82:58:1A:29:52:CC:AF:1D:9F`
- 이 값이 맞으면 로컬/CI 어디서 빌드해도 업데이트 업로드 가능.

## 재검증 명령어
```bash
# 로컬 keystore 지문 확인
keytool -list -v -keystore lumina-release.jks -storepass <password>

# 로컬 APK 지문 확인
apksigner verify --print-certs android/app/build/outputs/apk/release/app-release.apk

# 로컬 AAB 지문 확인
keytool -printcert -jarfile android/app/build/outputs/bundle/release/app-release.aab

# google-services.json 의 등록된 SHA-1 확인
grep -E '"certificate_hash"' android/app/google-services.json
```

## Capacitor 앱 로딩 정책 (참고)
- 2026-05-09 부로 `capacitor.config.ts` 의 `server.hostname` 설정을 제거했다.
- 이전엔 앱이 Firebase Hosting의 빌드를 매번 다운로드 → hosting deploy 누락 시
  옛 코드/빈 env 가 떠서 `signInWithGoogle()` 즉시 reject되는 패턴이 반복됐다.
- 현재는 APK 내장 dist를 직접 로드하므로 hosting 동기화에 영향받지 않는다.
- 이 결정을 되돌리지 말 것 — 되돌리면 같은 회귀를 반복한다.
