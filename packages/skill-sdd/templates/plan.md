---
sdd_stage: plan
sdd_version: "0.1"
status: draft
created: YYYY-MM-DD
updated: YYYY-MM-DD
author: ""
locked_sections: []
---

# [프로젝트명] — 기술 계획 (Plan)

> **목적**: 어떻게 만드는가, 아키텍처, 데이터 모델, API 계약
> **의존**: [spec.md](./spec.md) (approved 필요)

---

## 1. Architecture Overview

### 1.1 설계 원칙

- **[원칙명]**: [설명]

### 1.2 시스템 구성도

```
[ASCII 다이어그램]
```

### 1.3 기술 스택

| 레이어 | 기술 | 선택 이유 | 검토한 대안 |
|--------|------|-----------|-------------|
| Frontend | | | |
| Backend | | | |
| Database | | | |

---

## 2. Domain Model

<!-- SDD:LOCK — 도메인 모델 확정 후 변경 시 §4 데이터 스키마와 동기화 필수 -->

### 2.1 핵심 엔터티

#### [엔터티명]

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | string (UUID) | Y | PK |
| | | | |

**상태 머신** (상태가 있는 엔터티만):

```
[상태1] → [상태2] → [상태3]
```

### 2.2 엔터티 관계

```
[엔터티A] 1 ──── N [엔터티B]
```

---

## 3. Module Architecture

<!-- 매핑: spec.md §6 기능 요구사항 → 여기서 모듈로 분해 -->

| 모듈명 | 담당 기능 | 의존 모듈 | spec 참조 |
|--------|-----------|-----------|-----------|
| | | | F01, F02 |

### 3.1 모듈 인터페이스

```typescript
// [모듈명] 인터페이스
interface [ModuleName] {
  input: { /* ... */ };
  output: { /* ... */ };
}
```

---

## 4. Data Architecture

### 4.1 데이터 스키마

<!-- SDD:LOCK — §2 도메인 모델에서 파생. 두 섹션이 일치해야 한다 -->

```sql
CREATE TABLE [table_name] (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 4.2 API 계약

<!-- SDD:LOCK — API 계약 확정 후 양쪽 승인 없이 변경 불가 -->

```yaml
endpoint: POST /api/v1/[resource]
auth: required

request:
  body:
    field: type

response:
  200:
    field: type
  400:
    error: string
```

---

## 5. UI/UX Architecture

### 5.1 역할별 뷰

| 페르소나 | 주요 화면 | 핵심 인터랙션 |
|----------|-----------|---------------|
| | | |

### 5.2 상태 관리 전략

| 상태 종류 | 관리 위치 | 기술 |
|-----------|-----------|------|
| 서버 상태 | | |
| 전역 클라이언트 상태 | | |
| URL 상태 | | |

---

## 6. Validation Strategy

### 6.1 E2E 검증 시나리오

| # | 시나리오 | 예상 결과 | 성능 기준 |
|---|----------|-----------|-----------|
| V1 | | | |

### 6.2 테스트 전략

| 레이어 | 도구 | 커버리지 목표 |
|--------|------|---------------|
| 단위 | | |
| 통합 | | |
| E2E | | |

---

## 7. Security & Access Control

### 7.1 인증/인가

- **인증 방식**:
- **토큰 갱신**:

### 7.2 역할 기반 접근 제어

| 역할 | 읽기 | 쓰기 | 관리 |
|------|------|------|------|
| | | | |
