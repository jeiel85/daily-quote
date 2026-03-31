# ✨ AI Daily Quote Notifier (PWA)

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![React](https://img.shields.io/badge/React-19.0-blue.svg)](https://reactjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-11.0-orange.svg)](https://firebase.google.com/)
[![Gemini AI](https://img.shields.io/badge/Gemini_AI-3.1_Pro-purple.svg)](https://ai.google.dev/)

AI 기반의 맞춤형 데일리 명언 알림 웹앱입니다. 매일 아침, 당신만을 위한 AI의 특별한 명언과 따뜻한 해설로 하루를 시작해보세요.

## 🚀 주요 기능

- **🤖 AI 맞춤형 명언 생성**: Google Gemini AI를 활용하여 사용자가 선택한 테마에 맞춰 명언과 해설을 생성합니다.
- **🌐 다국어 지원**: 한국어, English, 日本語, 中文(简体) 4개 국어를 지원합니다.
- **🔔 스마트 푸시 알림**: 사용자가 설정한 시간에 맞춰 매일 새로운 명언을 브라우저 푸시 알림으로 전달합니다.
- **📱 PWA (Progressive Web App)**: 모바일 기기에서 홈 화면에 추가하여 네이티브 앱처럼 사용할 수 있습니다.
- **📜 히스토리 관리**: 과거에 수신했던 명언들을 언제든지 다시 확인할 수 있습니다.
- **🎨 4가지 테마**: 동기부여, 위로, 유머, 성공 중 원하는 분위기를 선택할 수 있습니다.

## 🛠 기술 스택

- **Frontend**: React 19, Tailwind CSS, Framer Motion, Lucide React
- **Backend/DB**: Firebase (Firestore, Authentication, Cloud Messaging)
- **AI**: Google Gemini API (Google AI SDK)
- **Internationalization**: i18next
- **Build Tool**: Vite

## 📦 설치 및 실행 방법

### 1. 저장소 복제
```bash
git clone https://github.com/your-username/ai-quote-notifier.git
cd ai-quote-notifier
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
`.env.example` 파일을 복사하여 `.env` 파일을 만들고 필요한 API 키를 입력하세요.
```env
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### 4. Firebase 설정
`firebase-applet-config.json` 파일에 본인의 Firebase 프로젝트 설정을 입력하세요.

### 5. 개발 서버 실행
```bash
npm run dev
```

## 🌐 GitHub Pages 배포 (github.io)

이 프로젝트는 Vite를 사용하므로 GitHub Pages에 배포하려면 다음 단계를 따르세요:

1. `vite.config.ts`에서 `base` 경로를 설정합니다 (예: `/ai-quote-notifier/`).
2. `npm run build`를 실행하여 `dist` 폴더를 생성합니다.
3. GitHub 저장소 설정에서 `Settings > Pages`로 이동하여 배포 소스를 `gh-pages` 브랜치나 `docs` 폴더로 설정합니다.

## 📄 라이선스

이 프로젝트는 Apache-2.0 라이선스에 따라 배포됩니다.

---
Developed with ❤️ by [jeiel85](https://github.com/jeiel85)
