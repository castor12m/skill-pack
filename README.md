# SkillPack

> AI 코딩 어시스턴트 스킬을 npm처럼 설치·관리·배포하는 패키지 매니저

---

## 왜 SkillPack인가?

Claude Code는 `~/.claude/skills/`에 커스텀 스킬을 정의할 수 있다. 하지만:

- 여러 머신에서 동일한 스킬을 유지할 공식 방법이 없다
- 버전 관리가 안 되어 어떤 스킬이 최신인지 알 수 없다
- 팀 단위로 스킬을 표준화하거나 온보딩할 체계가 없다

**SkillPack은 npm 인프라를 그대로 활용하여** 버전 관리 + 레지스트리 + 팀 접근 제어를 추가 인프라 없이 해결한다.

---

## 빠른 시작

```bash
# CLI 설치
npm install -g @skillpack/cli

# 스킬 설치
skillpack install review
skillpack install sdd debug handoff refactor

# 설치된 스킬 확인
skillpack list

# 전체 업데이트
skillpack update
```

설치된 스킬은 `~/.claude/skills/`에 배치되어 Claude Code에서 바로 사용 가능하다.

---

## CLI 명령어

```
skillpack install <name[@version]> [...]   스킬 설치 (기본: 최신)
skillpack install ./path/to/skill          로컬 경로에서 설치
  --force                                  기존 파일 덮어쓰기
skillpack list                             설치된 스킬 목록
skillpack list --all                       전체 스킬 목록 (managed/local 구분)
skillpack update [name]                    전체 또는 개별 업데이트
skillpack uninstall <name>                 스킬 제거
skillpack help                             도움말
```

### 설치 흐름

```
skillpack install review
  → npm registry에서 @skillpack/skill-review 다운로드
  → skill.json 읽어서 설치 대상 파일 결정
  → ~/.claude/skills/review/에 복사
  → ~/.skillpack/manifest.json에 버전 기록
```

### Private 스킬

`@`로 시작하는 패키지명은 그대로 사용된다:

```bash
# org 스코프 스킬 설치
skillpack install @mycompany/skill-internal

# npm registry 인증 (최초 1회)
npm config set @mycompany:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken $(gh auth token)
```

---

## 사용 가능한 스킬

| 스킬 | 설명 | 명령어 |
|------|------|--------|
| `review` | Pre-landing PR 코드 리뷰 | `/review` |
| `sdd` | Specification-Driven Development | `/sdd` |
| `debug` | 체계적 디버깅 (원인 분석 우선) | `/debug` |
| `handoff` | 세션 인수인계 | `/handoff` |
| `refactor` | 코드 리팩토링 | `/refactor` |

---

## 스킬 만들기

누구나 자신만의 스킬을 만들어 npm에 배포할 수 있다.

### 패키지 구조

```
packages/skill-myskill/
├── package.json       ← npm 패키지 메타데이터
├── skill.json         ← SkillPack 매니페스트
├── SKILL.md           ← 스킬 진입 파일
└── README.md          ← npmjs.com 표시용
```

### skill.json

```json
{
  "name": "myskill",
  "command": "/myskill",
  "entry": "SKILL.md",
  "files": ["SKILL.md"]
}
```

- `name` — 스킬 이름 (`~/.claude/skills/{name}/`에 설치됨)
- `command` — Claude Code에서 사용할 슬래시 명령어
- `entry` — 진입 파일
- `files` — 설치할 파일 목록 (디렉토리 포함 가능)

### package.json

```json
{
  "name": "@skillpack/skill-myskill",
  "version": "1.0.0",
  "description": "My awesome skill for Claude Code",
  "keywords": ["claude-code", "skill", "skillpack"],
  "license": "MIT",
  "engines": { "node": ">=18" },
  "files": ["skill.json", "SKILL.md"]
}
```

### 배포

```bash
npm publish --access public
```

배포 후 누구나 `skillpack install @yourname/skill-myskill`로 설치 가능.

---

## 설계 원칙

1. **CLI 직접 복사** — `skillpack install`이 tarball을 다운로드하고 파일을 배치한다. postinstall 스크립트를 사용하지 않는다 (보안, --ignore-scripts 문제 회피).
2. **비파괴적 기본값** — 이미 설치된 스킬이 있으면 설치를 거부한다. `--force`로 덮어쓰기.
3. **상태 분리** — `~/.skillpack/manifest.json`에 설치 정보를 기록하고, `~/.claude/skills/`에는 순수 스킬 파일만 둔다.
4. **npm 패러다임** — `npm view`, `npm pack`을 subprocess로 호출. 별도 레지스트리 없이 npmjs.com을 그대로 사용.

---

## 레포 구조

```
skill-pack/
├── packages/
│   ├── cli/                  ← @skillpack/cli
│   │   ├── bin/skillpack.js
│   │   └── lib/
│   │       ├── paths.js
│   │       ├── manifest.js
│   │       ├── registry.js
│   │       ├── installer.js
│   │       └── commands/
│   ├── skill-review/         ← @skillpack/skill-review
│   ├── skill-sdd/            ← @skillpack/skill-sdd
│   ├── skill-debug/          ← @skillpack/skill-debug
│   ├── skill-handoff/        ← @skillpack/skill-handoff
│   └── skill-refactor/       ← @skillpack/skill-refactor
├── package.json              ← workspace 루트
└── README.md
```

---

## 기여하기

1. 이 레포를 fork
2. `packages/skill-xxx/` 아래에 스킬 패키지 추가 또는 수정
3. PR 제출

또는 자기 npm 계정으로 `@yourname/skill-xxx`를 독립 배포하면 생태계에 바로 참여할 수 있다.

---

## 로드맵

### Phase 1 — MVP ✅
- [x] CLI 구현 (install, list, update, uninstall)
- [x] 핵심 스킬 5개 패키지화 (review, sdd, debug, handoff, refactor)
- [x] 로컬 경로 설치 지원
- [ ] npmjs.com 배포

### Phase 2 — 팀 운영
- [ ] Private 스킬 GitHub Packages 배포
- [ ] `skillpack override` — 프로젝트 로컬 오버라이드
- [ ] `skillpack init` — 새 스킬 스캐폴딩
- [ ] CI 자동 배포 (머지 → npm publish)

### Phase 3 — 확장
- [ ] `skillpack search` — 레지스트리 검색
- [ ] Cursor `.cursorrules` 타겟 지원
- [ ] 멀티 AI 툴 설치 경로 설정

---

## 라이선스

MIT
