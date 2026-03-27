# SkillPack Handoff

> 최종 업데이트: 2026-03-28

---

## 현재 상태

**Phase 1b 진행 중** — 스킬 패키지화 완료, npm 배포 미착수

---

## 완료된 작업

- [x] 모노레포 초기화 (npm workspaces)
- [x] `@skillpack/cli` 구현 (install, list, update, uninstall, help)
- [x] `@skillpack/skill-review` 참조 패키지 생성
- [x] 나머지 4개 스킬 패키지화 (sdd, debug, handoff, refactor)
- [x] CLI 로컬 경로 설치 지원 (`./path`, `/abs`, `~` 접두사)
- [x] `list --all` — 전체 스킬 표시 ([managed]/[local] 구분)
- [x] README.md를 CLI 직접 복사 방식으로 전면 업데이트
- [x] 로컬 E2E 테스트 통과 (install → list → 충돌 감지 → uninstall)
- [x] ULW 멀티 모델 교차검증 완료 (Claude sonnet + Gemini 2.5-flash)

---

## 다음 단계

- [ ] npmjs.com `@skillpack` org 생성 + 배포
- [ ] 실 registry에서 `skillpack install review` 테스트
- [ ] CONTRIBUTING.md 작성 (스킬 패키지 작성 가이드)

---

## 핵심 설계 결정

### 1. postinstall → CLI 직접 복사 (확정)

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| 설치 방식 | `npm install -g` → postinstall.js 자동 복사 | `skillpack install review` → CLI가 tarball 다운로드 + 복사 |
| 변경 이유 | 보안 취약, --ignore-scripts 문제, 개발환경 혼동 | CLI가 설치 흐름 제어, manifest.json 관리 가능 |

### 2. 충돌 처리
- 기본: 이미 설치된 스킬이 있으면 **설치 거부** (비파괴적)
- `--force`: 기존 파일 덮어쓰기

### 3. 상태 추적
- `~/.skillpack/manifest.json` — `{ "review": { "version": "1.0.0", "installedAt": "..." } }`
- Claude `~/.claude/skills/`와 SkillPack 메타데이터 분리

### 4. CLI 구현
- `npm view`, `npm pack`을 subprocess로 호출 (npm 설치 전제)
- Private 패키지: `@`로 시작 → full name 그대로, 없으면 `@skillpack/skill-{name}`

### 5. 크로스 플랫폼
- `require('os').homedir()` 사용 (`process.env.HOME` 아님)

### 6. 배포 정책
- **수동 배포만** — PR 머지 후 maintainer가 직접 `npm publish`
- 스킬은 AI 행동을 직접 제어하므로 자동 배포는 프롬프트 인젝션 위험
- 자동 배포는 신뢰 기여자 풀이 형성된 후 검토

---

## 스킬 패키지 규칙

### 파일 복사 규칙

`skill.json`의 `files` 배열에 명시된 파일만 `~/.claude/skills/{name}/`에 복사된다.
`package.json`, `skill.json`, `README.md` 등 npm/skillpack 메타데이터는 복사되지 않는다.

```
packages/skill-sdd/              ~/.claude/skills/sdd/
├── package.json                 (복사 안 됨)
├── skill.json                   (복사 안 됨)
├── README.md                    (복사 안 됨)
├── SKILL.md               →    ├── SKILL.md
├── help.md                →    ├── help.md
└── templates/             →    └── templates/
    ├── plan.md                      ├── plan.md
    └── ...                          └── ...
```

### 새 스킬 패키지 작성 체크리스트

1. `packages/skill-{name}/` 디렉토리 생성
2. **SKILL.md** — 스킬 진입 파일 (진입 파일명은 항상 `SKILL.md`로 통일)
3. **skill.json** 작성:
   ```json
   {
     "name": "{name}",
     "command": "/{name}",
     "entry": "SKILL.md",
     "files": ["SKILL.md"]
   }
   ```
   - `name`: 스킬 이름 = 설치 디렉토리명 (`~/.claude/skills/{name}/`)
   - `command`: Claude Code 슬래시 명령어
   - `entry`: 진입 파일 (항상 SKILL.md)
   - `files`: 설치할 파일 목록. 디렉토리도 가능 (재귀 복사)
4. **package.json** 작성:
   ```json
   {
     "name": "@skillpack/skill-{name}",
     "version": "1.0.0",
     "description": "...",
     "keywords": ["claude-code", "skill", "skillpack"],
     "license": "MIT",
     "engines": { "node": ">=18" },
     "files": ["skill.json", "SKILL.md", ...]
   }
   ```
   - `files` 배열에 `skill.json` + `SKILL.md` + 보조 파일 모두 포함
   - `scripts.postinstall` 절대 사용하지 않는다
5. **README.md** (선택) — npmjs.com 표시용 설명
6. 로컬 테스트: `node packages/cli/bin/skillpack.js install ./packages/skill-{name}`
7. 구조 검증: `npm pack --dry-run -w packages/skill-{name}`

### 패키지명 규칙

| 유형 | npm 패키지명 | skillpack install 명령 |
|------|-------------|----------------------|
| 공식 | `@skillpack/skill-{name}` | `skillpack install {name}` |
| 개인/조직 | `@yourname/skill-{name}` | `skillpack install @yourname/skill-{name}` |

### 소스 원본과의 관계

```
ai-dev-playbook/skills/{name}/   ← 스킬 원본 (개발/편집)
        │ (수동 복사, prompt.md → SKILL.md 변경)
        ▼
skill-pack/packages/skill-{name}/  ← npm 패키지
        │ (npm publish — maintainer 수동)
        ▼
npmjs.com @skillpack/skill-{name}  ← 레지스트리
        │ (skillpack install)
        ▼
~/.claude/skills/{name}/           ← 실제 사용 위치
```

---

## 파일 구조

```
skill-pack/
├── package.json                          ← workspace 루트
├── README.md                             ← 프로젝트 소개 (최신)
├── CONTEXT.md                            ← 설계 배경
├── HANDOFF.md                            ← 상세 핸드오프 원본
├── .claude/handoff.md                    ← 세션 재개용 (이 파일)
├── packages/
│   ├── cli/                              ← @skillpack/cli
│   │   ├── bin/skillpack.js
│   │   └── lib/
│   │       ├── paths.js
│   │       ├── manifest.js
│   │       ├── registry.js
│   │       ├── installer.js
│   │       └── commands/
│   │           ├── install.js            ← 로컬 경로 + registry 지원
│   │           ├── list.js               ← --all 옵션 지원
│   │           ├── update.js
│   │           └── uninstall.js
│   ├── skill-review/                     ← 참조 패키지
│   ├── skill-sdd/                        ← templates/ 디렉토리 포함
│   ├── skill-debug/
│   ├── skill-handoff/
│   └── skill-refactor/
```

---

## 미해결 리스크

- [ ] tarball 다운로드 실패 시 에러 메시지
- [ ] manifest.json 파일 잠금 (동시 실행 방지)
- [ ] Node.js 18 미만 환경 에러 출력
- [ ] `npm view` 실패 분기 처리 (패키지 미존재, 네트워크 오류)

---

## 참고 문서

- `README.md` — 프로젝트 소개 + 빠른 시작 (최신)
- `CONTEXT.md` — 설계 배경/결정 과정
- `HANDOFF.md` — 초기 상세 핸드오프 원본
