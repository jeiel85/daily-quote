# HISTORY — 개발 마일스톤

> 각 항목은 GitHub 이슈와 연계되어 있다.  
> 현재 이슈 30개 기준 로드맵은 [ROADMAP.md](ROADMAP.md) 참고.

---

## ✅ Phase 0 — 기초 작업 (완료, 이슈 #50~#77)

### 보안 (Security)
| 이슈 | 내용 |
|------|------|
| [#67](https://github.com/jeiel85/lumina-daily/issues/67) | 로컬 저장소 암호화 |
| [#66](https://github.com/jeiel85/lumina-daily/issues/66) | 무차별 대입 방어 |
| [#65](https://github.com/jeiel85/lumina-daily/issues/65) | 민감 정보 최소화 |
| [#64](https://github.com/jeiel85/lumina-daily/issues/64) | Firestore 보안 규칙 |
| [#63](https://github.com/jeiel85/lumina-daily/issues/63) | API 키 프록시화 → Cloud Functions로 해결 |

### 기능 (Feature)
| 이슈 | 내용 |
|------|------|
| [#62](https://github.com/jeiel85/lumina-daily/issues/62) | 데이터 백업 및 복원 기초 |
| [#61](https://github.com/jeiel85/lumina-daily/issues/61) | AI 기반 명언 해설 심화 |
| [#60](https://github.com/jeiel85/lumina-daily/issues/60) | 명언 챌린지 기능 |
| [#59](https://github.com/jeiel85/lumina-daily/issues/59) | 소셜 로그인 확장 (Google +) |
| [#58](https://github.com/jeiel85/lumina-daily/issues/58) | 푸시 알림 고도화 |
| [#57](https://github.com/jeiel85/lumina-daily/issues/57) | 사용자 창작 명언 등록 |
| [#56](https://github.com/jeiel85/lumina-daily/issues/56) | 명언 캘린더 공유 |
| [#55](https://github.com/jeiel85/lumina-daily/issues/55) | 연속 출석(Streak) 게이미피케이션 |
| [#54](https://github.com/jeiel85/lumina-daily/issues/54) | 명언 카테고리/태그 필터 |
| [#53](https://github.com/jeiel85/lumina-daily/issues/53) | 기분(Mood) 기반 명언 생성 |

### 성능 (Performance)
| 이슈 | 내용 |
|------|------|
| [#52](https://github.com/jeiel85/lumina-daily/issues/52) | 에러 모니터링 (Sentry 대체 → Crashlytics) |
| [#51](https://github.com/jeiel85/lumina-daily/issues/51) | 초기 로딩 시간(TTI) 단축 |
| [#50](https://github.com/jeiel85/lumina-daily/issues/50) | 애니메이션 프레임 최적화 |
| [#49](https://github.com/jeiel85/lumina-daily/issues/49) | 메모리 누수(Memory Leak) 점검 |

### ASO / 마케팅
| 이슈 | 내용 |
|------|------|
| [#77](https://github.com/jeiel85/lumina-daily/issues/77) | A/B 테스트 계획 수립 |
| [#76](https://github.com/jeiel85/lumina-daily/issues/76) | 커뮤니티(소셜) 기능 카드 |
| [#75](https://github.com/jeiel85/lumina-daily/issues/75) | 프로모션 비디오 제작 |
| [#74](https://github.com/jeiel85/lumina-daily/issues/74) | 네이티브(Native) 광고 삽입 |
| [#73](https://github.com/jeiel85/lumina-daily/issues/73) | 프리미엄 구독(Pro) 모델 |
| [#72](https://github.com/jeiel85/lumina-daily/issues/72) | 다국어 설명 번역 |
| [#71](https://github.com/jeiel85/lumina-daily/issues/71) | 초대/공유 리워드 (바이럴 루프) |
| [#70](https://github.com/jeiel85/lumina-daily/issues/70) | 인앱 리뷰 로직 |
| [#69](https://github.com/jeiel85/lumina-daily/issues/69) | 키워드 최적화 (ASO) |
| [#68](https://github.com/jeiel85/lumina-daily/issues/68) | 스토어 스크린샷 디자인 |

### Closed — 마케팅/ASO 아이디어 스크랩 (#194~#235)
> 42개 마케팅/ASO 아이디어 이슈가 있었으나, 1인 무예산 환경에서 비현실적이라고 판단해 폐기.  
> 핵심은 현 30개 이슈에 집중.

---

## 🚧 현재 — Phase 1 진행 중 (이슈 #242~#247)

1인 무예산 제약에 맞춘 [현실 로드맵](ROADMAP.md) 수립. 총 30개 이슈, 4개 Phase.

| Phase | 이슈 범위 | 기간 | 핵심 목표 |
|-------|----------|------|----------|
| **Phase 1** | [#242~#247](https://github.com/jeiel85/lumina-daily/issues?q=is%3Aissue+is%3Aopen+label%3Aphase-1) | 3주 | 안정화 + AI 비용 통제 |
| **Phase 2** | [#248~#255](https://github.com/jeiel85/lumina-daily/issues?q=is%3Aissue+is%3Aopen+label%3Aphase-2) | 5주 | 리텐션 코어 |
| **Phase 3** | [#256~#264](https://github.com/jeiel85/lumina-daily/issues?q=is%3Aissue+is%3Aopen+label%3Aphase-3) | 5주 | 바이럴 (무예산 유일 유입) |
| **Phase 4** | [#265~#270](https://github.com/jeiel85/lumina-daily/issues?q=is%3Aissue+is%3Aopen+label%3Aphase-4) | 지속 | ASO & 무예산 홍보 |

---

## 📋 릴리즈 이력

상세는 [CHANGELOG.md](CHANGELOG.md) 참고.

| 버전 | 날짜 | 주요 변경 |
|------|------|----------|
| v1.4.1 | 2026-05-27 | Play Store 프로덕션 출시용 버전 업데이트 |
| v1.4.0 | 2026-05-21 | Gemini 실시간 생성 제거 + 1,800개 명언 풀 기반 1일 1배달 + JSDelivr 원격 캐시 |
| v1.3.10 | 2026-05-12 | i18n 누락 보강 + referral_count 수정 |
| v1.3.9 | 2026-05-11 | Cloud Functions Gemini 프록시 + GitHub Pages 정적 전환 |
| v1.3.8 | 2026-05-10 | 햅틱 피드백 ON/OFF |
| v1.3.3 | 2026-05-06 | 로딩 화면 정렬/가독성 개선 |
| v1.3.0 | 2026-05-06 | 인앱 리뷰(#70), 로컬 알림(#58), 리퍼럴(#71) |
| v1.2.0 | 2026-04-24 | 초기 릴리즈 — Google 로그인, Firebase |
