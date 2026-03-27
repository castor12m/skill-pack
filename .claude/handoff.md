# SkillPack Handoff

> 최종 업데이트: 2026-03-27

---

## 현재 상태

**Phase 1a 완료** | Phase 1b 미착수

---

## 완료된 작업

- [x] 모노레포 초기화 (npm workspaces)
- [x] `@skillpack/skill-review` 참조 패키지 생성 (ai-dev-playbook에서 복사)
- [x] `@skillpack/cli` 구현 (install, list, update, uninstall, help)
- [x] 로컬 E2E 테스트 통과 (install → list → uninstall → 충돌 감지)
- [x] ULW 멀티 모델 교차검증 완료 (Claude sonnet + Gemini 2.5-flash)

---

## 다음 단계 (Phase 1b)

- [x] 나머지 4개 스킬 패키지화 (sdd, debug, handoff, refactor)
  - 소스: `~/Workspace/ai-dev-playbook/skills/`
  - prompt.md → SKILL.md 파일명 변경
- [ ] npmjs.com `@skillpack` org 생성 + 배포
- [ ] 실 registry에서 `skillpack install review` 테스트
- [ ] README.md를 CLI 직접 복사 방식으로 업데이트

---

## 핵심 설계 결정

### postinstall → CLI 직접 복사로 변경 (확정)

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| 설치 방식 | `npm install -g` → postinstall.js 자동 복사 | `skillpack install review` → CLI가 tarball 다운로드 + 복사 |
| 변경 이유 | 보안 취약, --ignore-scripts 문제, 개발환경 혼동 | CLI가 설치 흐름 제어, manifest.json 관리 가능 |

### 충돌 처리
- 기본: 이미 설치된 스킬이 있으면 **설치 거부** (비파괴적)
- `--force`: 기존 파일 덮어쓰기

### 상태 추적
- `~/.skillpack/manifest.json` — `{ "review": { "version": "1.0.0", "installedAt": "..." } }`
- Claude `~/.claude/skills/`와 SkillPack 메타데이터 분리

### CLI 구현
- `npm view`, `npm pack`을 subprocess로 호출 (npm 설치 전제)
- Private 패키지: `@`로 시작 → full name 그대로, 없으면 `@skillpack/skill-{name}`

### 크로스 플랫폼
- `require('os').homedir()` 사용 (`process.env.HOME` 아님)

---

## 소스 관계

```
ai-dev-playbook/skills/    ← 스킬 원본 (개발/편집)
        │ (수동 복사 → Phase 1)
        ▼
skill-pack/packages/skill-xxx/   ← npm 패키지 (SKILL.md + skill.json)
        │ (npm publish)
        ▼
npmjs.com @skillpack/skill-xxx   ← 레지스트리
        │ (skillpack install)
        ▼
~/.claude/skills/xxx/            ← 실제 사용 위치
```

---

## 파일 구조

```
skill-pack/
├── package.json                          ← workspace 루트
├── packages/
│   ├── cli/                              ← @skillpack/cli
│   │   ├── bin/skillpack.js              ← CLI 진입점 + help
│   │   └── lib/
│   │       ├── paths.js                  ← 경로 상수
│   │       ├── manifest.js               ← manifest.json CRUD
│   │       ├── registry.js               ← npm subprocess 호출
│   │       ├── installer.js              ← 파일 복사 + 충돌 감지 + 롤백
│   │       └── commands/
│   │           ├── install.js
│   │           ├── list.js
│   │           ├── update.js
│   │           └── uninstall.js
│   └── skill-review/                     ← 참조 패키지
│       ├── package.json
│       ├── skill.json
│       ├── SKILL.md
│       └── (checklist.md, design-checklist.md, ...)
```

---

## 미해결 리스크

- [ ] tarball 다운로드 실패 시 에러 메시지
- [ ] manifest.json 파일 잠금 (동시 실행 방지)
- [ ] Node.js 18 미만 환경 에러 출력
- [ ] `npm view` 실패 분기 처리 (패키지 미존재, 네트워크 오류)

---

## 참고 문서

- `README.md` — 원본 설계 (postinstall 방식, **구식**)
- `CONTEXT.md` — 설계 배경/결정 과정
- `HANDOFF.md` — 상세 핸드오프 (루트, 이 파일의 원본)
