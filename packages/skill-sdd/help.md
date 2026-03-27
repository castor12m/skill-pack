# SDD (Specification-Driven Development) 사용 가이드

코드 작성 전에 명세를 먼저 정의하고, AI가 명세를 기반으로 일관성 있게 구현하는 워크플로우.

---

## 스킬 목록

| 명령 | 역할 |
|------|------|
| `/sdd help` | 이 가이드 표시 |
| `/sdd init` | SDD 프로젝트 초기화 (.sdd/ + docs/sdd/) |
| `/sdd status` | 현재 진행 상황 요약 |
| `/sdd reset [단계]` | 특정 단계를 draft로 되돌림 |
| `/sdd-specify [설명]` | 요구사항 정의 → docs/sdd/spec.md |
| `/sdd-plan` | 기술 설계 → docs/sdd/plan.md |
| `/sdd-tasks` | 작업 분해 → docs/sdd/tasks.md |
| `/sdd-implement [task-id]` | 태스크 단위 구현 |

---

## 시나리오별 사용법

### A. 새 프로젝트 (풀 모드)

```
/sdd init
/sdd-specify 사용자 인증이 있는 할일 관리 앱
  → AI와 대화하며 요구사항 확정 → spec.md 생성
/sdd-plan
  → 기술 스택, 도메인 모델, API 계약 확정 → plan.md 생성
/sdd-tasks
  → Phase별 작업 체크리스트 → tasks.md 생성
/sdd-implement
  → 다음 미완료 작업을 구현 (반복)
```

### B. 기존 프로젝트에 기능 추가 (작은 범위)

```
/sdd-specify 검색 결과에 날짜 필터 추가
  → AI가 기존 코드를 분석하고 수정 범위 판단
  → 파일 3개 이하면 "경량 모드"로 spec.md만 생성
  → "바로 구현 가능합니다" 안내
/sdd-implement
```

### C. 중간 규모 기능 (plan 생략)

```
/sdd-specify 다국어 지원 (i18n) 추가
  → 수정 파일 4~8개면 spec + tasks 모드
/sdd-tasks
/sdd-implement T1.1
```

### D. plan에서 spec으로 되돌아가기

```
/sdd-plan
  → "⚠️ spec §6.2의 알림 전달 방식이 미정의입니다"
  → "/sdd-specify로 돌아가세요" 안내
/sdd-specify
  → 해당 부분만 보완 → spec.md v2
/sdd-plan
  → 통과 → plan.md 생성
```

---

## 경량/풀 모드 자동 판단 기준

| 예상 수정 파일 | 모드 | 생성 문서 |
|---------------|------|-----------|
| 1~3개 | 경량 | spec.md만 |
| 4~8개 | 중간 | spec + tasks |
| 9개+ 또는 새 모듈 | 풀 | spec + plan + tasks |

사용자가 모드를 선택하지 않아도 됩니다. `/sdd-specify`가 자동으로 판단합니다.

---

## Deep Interview (명확화 질문)

`/sdd-specify`는 소크라테스식 질문으로 숨겨진 가정을 드러냅니다:

1. **1라운드**: 핵심 질문 2~3개 ("가장 중요한 성공 기준 하나는?")
2. **2라운드**: 모호한 답변을 파고들기 ("A인가요 B인가요?")
3. **명확도 자가 진단**: 5개 차원(사용자, 기능 경계, 성공 기준, 기술 제약, 데이터 모델) 평가
4. 부족한 차원만 추가 질문 (최대 3라운드)
5. 3라운드 후에도 불명확하면 "Open Questions"에 기록하고 진행

---

## 문서 구조

```
docs/sdd/
├── spec.md       요구사항 (PRD 역할)     ← /sdd-specify
├── plan.md       기술 설계 (Tech Spec)   ← /sdd-plan
└── tasks.md      작업 분해 (Dev Plan)    ← /sdd-tasks

.sdd/
└── state.json    워크플로우 상태 추적     ← 자동 관리
```

---

## 기존 스킬과의 관계

```
┌───────────────────────────────────────────┐
│  SDD 워크플로우 (문서 관리)                  │
│                                           │
│  /sdd init → /sdd-specify → /sdd-plan     │
│                  ↑   ↓          ↓         │
│                  └───┘     /sdd-tasks     │
│               (피드백루프)       ↓         │
│                          /sdd-implement   │
│  /sdd status (진행률 확인)                 │
├───────────────────────────────────────────┤
│  세션 관리 (기존 그대로)                    │
│  /handoff → 다음 세션 → /resume            │
├───────────────────────────────────────────┤
│  단발성 도구 (SDD와 독립)                   │
│  /architect  설계 상담 (문서 안 남겨도 됨)   │
│  /review /test /debug /deploy /refactor   │
└───────────────────────────────────────────┘
```

- **SDD 스킬**: 문서를 관리 (spec, plan, tasks)
- **기존 스킬**: 코드를 관리 (구현, 리뷰, 테스트)
- **세션 관리**: 대화 컨텍스트 관리 (handoff/resume)
- 세션 종료 시 `/handoff` + `/sdd status` 병용 권장

---

## 핵심 원칙

1. **설계는 사람이 한다** — AI는 질문하고, 문서를 정리하고, 구현한다. 결정은 사용자의 몫.
2. **직접 수정 안 함** — plan에서 spec의 문제 발견 시 자동 수정하지 않고 사용자에게 안내.
3. **문서 크기 상한** — spec 200줄, plan 300줄, tasks 150줄. 넘으면 범위를 쪼개라.
4. **강제하지 않음** — SDD 문서 없이 `/sdd-implement`도 가능 (경고만 표시).
