# SkillPack — Handoff (2026-03-27)

> 이 문서는 구현의 모든 결정사항과 컨텍스트를 담고 있다. **다음 세션의 기준 문서.**

---

## 현재 상태

- **Phase 1a 완료** (2026-03-27)
  - 모노레포 초기화 (npm workspaces)
  - `@skillpack/skill-review` 참조 패키지 생성 (ai-dev-playbook에서 복사)
  - `@skillpack/cli` 구현 (install, list, update, uninstall, help)
  - 로컬 E2E 테스트 통과 (install → list → uninstall → 충돌 감지)
- 설계 문서: README.md (원안, postinstall 방식은 구식), CONTEXT.md (배경)
- ULW 멀티 모델 교차검증 완료 (Claude sonnet + Gemini 2.5-flash)

### 다음 세션에서 할 일 (Phase 1b)

1. 나머지 4개 스킬 패키지화 (sdd, debug, handoff, refactor)
   - 소스: `~/Workspace/ai-dev-playbook/skills/` 에서 복사
   - prompt.md 패턴 스킬은 SKILL.md로 파일명 변경
2. npmjs.com `@skillpack` org 생성 + 배포
3. `npm install -g @skillpack/cli` 후 실제 registry에서 `skillpack install review` 테스트
4. README.md를 CLI 직접 복사 방식으로 업데이트 (현재 postinstall 방식은 구식)

---

## 핵심 설계 변경: postinstall → CLI 직접 복사

### 변경 전 (README.md 원안)
```
npm install -g @skillpack/skill-review
  → postinstall.js가 자동으로 ~/.claude/skills/review/에 복사
```

### 변경 후 (확정안)
```
skillpack install review
  → CLI가 npm registry에서 tarball 다운로드
  → 압축 해제 → skill.json 읽기
  → ~/.claude/skills/review/에 복사
  → ~/.skillpack/manifest.json에 기록
```

### 변경 이유
1. **보안**: postinstall이 HOME에 파일 쓰는 것은 공격 벡터
2. **--ignore-scripts 문제**: 일부 환경에서 postinstall이 비활성화되면 설치 실패
3. **개발환경 혼동**: npm workspaces에서 `npm install` 시 개발자 머신에도 스킬이 설치됨
4. **상태 추적**: CLI가 설치 흐름을 제어해야 manifest.json 관리가 가능

### 패키지 구조 변경
```
# Before (postinstall 방식)
packages/skill-review/
├── package.json       ← scripts.postinstall 포함
├── skill.json
├── SKILL.md
├── postinstall.js     ← 삭제
└── README.md

# After (CLI 직접 복사 방식)
packages/skill-review/
├── package.json       ← scripts.postinstall 없음 (순수 데이터 패키지)
├── skill.json         ← CLI가 이 파일을 읽어 설치 대상 결정
├── SKILL.md
└── README.md
```

**설치 경로는 반드시 `skillpack install`을 통해야 한다.** `npm install -g @skillpack/skill-review`만으로는 스킬이 배치되지 않음.

---

## 확정된 결정사항 (ULW 합의)

### 1. 충돌 처리 정책
- **기본 동작**: 이미 설치된 스킬이 있으면 **설치 거부** (비파괴적)
- `--force`: 기존 파일 덮어쓰기
- 이유: 사용자가 수동 수정한 스킬 파일 보호

### 2. 상태 추적 메커니즘
- **위치**: `~/.skillpack/manifest.json`
- **내용**: `{ "review": { "version": "1.0.0", "installedAt": "2026-03-27T..." } }`
- Claude의 `~/.claude/skills/`와 SkillPack 메타데이터를 분리
- `list`, `update`, `uninstall` 모두 이 파일 기반

### 3. CLI 구현 방식
- `npm view`, `npm pack` 등을 **subprocess로 호출** (npm이 이미 설치된 환경 전제)
- npm registry API 직접 호출하지 않음 (인증 처리 복잡성 회피)
- 배포는 여전히 `npm publish`로 npmjs.com에

### 4. Private 스킬 패키지명 규칙
- `@`로 시작 → full package name 그대로 사용 (`@mycompany/skill-xxx`)
- `@` 없음 → `@skillpack/skill-{name}`으로 변환 (`review` → `@skillpack/skill-review`)

### 5. @skillpack org
- npmjs.com에 `@skillpack` org 생성은 **배포 전**에만 해결하면 됨
- 구현/테스트는 org 없이 진행 가능
- 선점 시 대안: `@skill-pack`, `@skpk`

### 6. 크로스 플랫폼
- `process.env.HOME` 대신 `require('os').homedir()` 사용

---

## Phase 1 실행 계획

### Phase 1a — 참조 구현 (review 1개로 검증)

1. 모노레포 초기화 (npm workspaces)
2. `packages/skill-review/` 생성
   - package.json, skill.json, SKILL.md, README.md
   - postinstall.js 없음
3. `packages/cli/` 기본 구현
   - `skillpack install review` 동작 확인
   - `skillpack list` 동작 확인
4. 로컬에서 end-to-end 테스트
   - `npm publish --dry-run`으로 패키지 구조 검증
   - `skillpack install review` → `~/.claude/skills/review/SKILL.md` 존재 확인
   - `skillpack list` → review@1.0.0 표시 확인

### Phase 1b — 나머지 패키지 + 배포

5. 나머지 4개 스킬 패키지화 (sdd, debug, handoff, refactor)
   - ai-dev-playbook에서 스킬 파일을 skill-pack 레포 내로 직접 복사
   - prompt.md → SKILL.md 파일명 변경
6. `skillpack update`, `skillpack uninstall` 구현
7. npmjs.com `@skillpack` org 생성
8. 전체 배포 + 실 설치 테스트

---

## CLI 명령어 설계

### Phase 1 명령어

```
skillpack install <name>[@version]   설치 (기본: 최신, 충돌 시 거부)
  --force                            기존 파일 덮어쓰기
skillpack install <name1> <name2>    여러 개 동시 설치
skillpack list                       설치된 스킬 목록 + 버전 + 경로
skillpack update [name]              전체 또는 개별 업데이트
skillpack uninstall <name>           제거
skillpack help                       도움말
```

### 향후 확장 가능 명령어 (참고용)

```
skillpack search <keyword>           레지스트리 검색
skillpack info <name>                스킬 상세 정보
skillpack override <name>            프로젝트 로컬 오버라이드 생성
skillpack init                       새 스킬 패키지 스캐폴딩
skillpack publish                    스킬 배포 래퍼
skillpack doctor                     환경 진단
```

help 명령에 각 커맨드의 설명을 상세히 기재하여 AI 어시스턴트가 활용할 수 있게 한다.

---

## 사용자 흐름 (완성 시)

```
사용자                          skillpack CLI                    npm registry
  │                                │                                │
  ├─ skillpack install review ────→│                                │
  │                                ├─ npm view @skillpack/skill-review ─→│
  │                                │←── tarball URL ────────────────│
  │                                ├─ tarball 다운로드 + 압축 해제  │
  │                                ├─ skill.json 읽기               │
  │                                ├─ ~/.claude/skills/review/ 에 복사
  │                                ├─ ~/.skillpack/manifest.json 업데이트
  │←── ✅ review@1.0.0 설치 완료 ──│                                │
  │                                                                 │
  ├─ Claude Code에서 /review 사용 (자동 인식)                       │
```

---

## npm 배포 참고

- Public 패키지: **완전 무료**, 무제한
- 일반 사용자도 자기 npm 계정으로 `@본인이름/skill-xxx` 배포 가능
- `skillpack install @whoever/skill-xxx`로 설치 가능 (생태계 개방)

---

## 소스 관계 (확정)

```
ai-dev-playbook/skills/    ← 스킬 원본 (개발/편집)
        │
        │ (수동 복사 → Phase 1)
        │ (CI 자동화 → 향후)
        ▼
skill-pack/packages/skill-xxx/   ← npm 패키지 (SKILL.md + skill.json)
        │
        │ (npm publish)
        ▼
npmjs.com @skillpack/skill-xxx   ← 레지스트리
        │
        │ (skillpack install)
        ▼
~/.claude/skills/xxx/            ← 실제 사용 위치
```

---

## 리스크 체크리스트 (구현 중 주의)

- [x] `skill.json`의 `files`에 디렉토리가 포함될 때 재귀 복사 처리 → `fs.cpSync` 사용
- [x] 설치 실패 시 롤백 → 임시 디렉토리에 먼저 복사 후 rename
- [x] 충돌 감지 → 기본 거부 + `--force` 옵션
- [ ] tarball 다운로드 실패 시 깔끔한 에러 메시지
- [ ] manifest.json 파일 잠금 (동시 실행 방지)
- [ ] Node.js 18 미만 환경에서 명확한 에러 출력
- [ ] `npm view` 실패 시 (패키지 미존재, 네트워크 오류) 분기 처리

---

## 현재 파일 구조

```
skill-pack/
├── .gitignore
├── package.json                          ← workspace 루트
├── package-lock.json
├── README.md                             ← 원본 설계 (postinstall 방식, 구식)
├── CONTEXT.md                            ← 설계 배경/결정 과정
├── HANDOFF.md                            ← 구현 기준 문서 (최신, 이 파일)
├── packages/
│   ├── cli/                              ← @skillpack/cli
│   │   ├── package.json
│   │   ├── bin/skillpack.js              ← CLI 진입점 + help
│   │   └── lib/
│   │       ├── paths.js                  ← 경로 상수 (os.homedir 사용)
│   │       ├── manifest.js               ← ~/.skillpack/manifest.json CRUD
│   │       ├── registry.js               ← npm pack/view subprocess 호출
│   │       ├── installer.js              ← 파일 복사 + 충돌 감지 + 롤백
│   │       └── commands/
│   │           ├── install.js            ← skillpack install
│   │           ├── list.js               ← skillpack list
│   │           ├── update.js             ← skillpack update
│   │           └── uninstall.js          ← skillpack uninstall
│   └── skill-review/                     ← @skillpack/skill-review (참조 패키지)
│       ├── package.json
│       ├── skill.json                    ← 매니페스트
│       ├── SKILL.md                      ← 스킬 진입 파일
│       ├── checklist.md
│       ├── design-checklist.md
│       ├── TODOS-format.md
│       ├── greptile-triage.md
│       └── README.md                     ← npmjs.com 표시용
```

---

## 참고 문서

- `README.md` — 원본 설계 (postinstall 방식은 구식, 이 handoff가 최신)
- `CONTEXT.md` — 왜 npm 패러다임인지, 왜 이 구조인지의 배경
- 이 문서가 **구현 착수의 기준 문서**
