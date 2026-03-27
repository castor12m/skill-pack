# SDD — Specification-Driven Development 오케스트레이터

SDD 워크플로우의 진입점. 상태 확인, 초기화, 다음 단계 안내를 담당한다.

## 서브커맨드

`$ARGUMENTS`에 따라 분기한다:

- **help**: 사용 가이드 표시
- **init**: SDD 프로젝트 초기화
- **status**: 현재 진행 상황 요약
- **reset [단계]**: 특정 단계를 draft로 되돌림
- **(인자 없음)**: status와 동일

---

## 실행 절차

### help

`${CLAUDE_SKILL_DIR}/help.md` 파일을 Read 도구로 읽어서 사용자에게 그대로 보여준다. 추가 설명 없이 파일 내용만 출력한다.

### init

1. 프로젝트 루트에 `.sdd/` 디렉토리 생성
2. `.sdd/state.json`을 `${CLAUDE_SKILL_DIR}/templates/state.json` 템플릿으로 초기화
3. `docs/sdd/` 디렉토리 생성
4. `.gitignore`에 `.sdd/` 추가 여부를 사용자에게 확인
   - state.json은 로컬 상태라 gitignore 권장
   - docs/sdd/*.md는 버전 관리 대상이므로 포함
5. 사용자에게 안내: "초기화 완료. `/sdd-specify [기능 설명]`으로 시작하세요."

### status

1. `.sdd/state.json`을 읽는다. 없으면 "SDD가 초기화되지 않았습니다. `/sdd init`을 실행하세요." 안내.
2. 각 문서의 상태를 표로 출력:
   ```
   문서         상태       버전  경로
   spec.md     approved   v2   docs/sdd/spec.md
   plan.md     locked     v1   docs/sdd/plan.md
   tasks.md    active     v1   docs/sdd/tasks.md (6/12 완료, 50%)
   ```
3. `feedbackLog`에 미해결 항목이 있으면 경고 표시.
4. 다음 추천 액션 안내: "다음: `/sdd-implement`로 T1.3.1을 구현하세요."

### reset

1. `$ARGUMENTS[1]`로 대상 단계를 받는다 (spec, plan, tasks).
2. 해당 문서의 frontmatter `status`를 `draft`로 변경.
3. state.json 업데이트.
4. 후속 문서 상태도 무효화:
   - spec reset → plan, tasks도 draft로
   - plan reset → tasks도 draft로
5. 사용자에게 영향 범위를 알리고 확인 후 실행.

---

## 일관성 검증 (단계 전환 시 자동 수행)

`/sdd-plan`, `/sdd-tasks`, `/sdd-implement` 호출 시 오케스트레이터가 아닌 각 스킬이 자체적으로 전제조건을 검증한다. 그러나 `/sdd status` 호출 시에는 다음 3가지 교차 참조를 확인한다:

1. **spec 기능 ID → tasks 작업 ID**: 모든 기능이 태스크에 매핑됐는가
2. **plan 모듈명 → tasks 작업 그룹**: 모든 모듈이 태스크에 반영됐는가
3. **tasks 완료 → spec 기능 완료**: 완료된 태스크가 기능 완료로 이어지는가

불일치 발견 시 경고로 표시하고 해결 방법을 안내한다.

## 원칙

- 이 스킬은 SDD 문서(spec.md, plan.md, tasks.md)와 상태(state.json)만 관리한다.
- CLAUDE.md, guides/, 프로젝트 코드를 수정하지 않는다.
- 설계 결정을 내리지 않는다. 상태를 보고하고 다음 단계를 안내할 뿐이다.
