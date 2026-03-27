# SkillPack

> AI 코딩 어시스턴트 스킬을 npm처럼 버전 관리하고 배포하는 패키지 레지스트리

---

## 한 줄 정의

Claude Code의 `~/.claude/skills/`를 시작으로, AI 코딩 툴(Cursor, Copilot 등)의 커스텀 설정을 **버전 관리된 패키지**로 배포·설치·동기화하는 시스템.

---

## 배경 및 문제 인식

### 현재 상황

- Claude Code는 `~/.claude/skills/`에 커스텀 스킬을 정의할 수 있다
- 여러 머신(맥북, 서버, 회사 PC)에서 동일한 스킬을 유지할 공식 방법이 없다
- 팀 단위로 스킬을 표준화하거나 새 팀원이 환경을 세팅하는 체계가 없다
- 커뮤니티에서는 chezmoi, dotfiles git repo 등으로 임시 해결 중

### 해결하려는 Pain

1. **멀티 머신 동기화** — 머신마다 스킬을 수동으로 복사해야 함
2. **버전 관리 부재** — 스킬이 변경돼도 어떤 버전인지 추적 불가
3. **팀 표준화 어려움** — 신규 팀원이 팀 스킬 세팅을 자동화할 방법 없음
4. **공개/비공개 혼재** — 범용 스킬은 공개, 내부 특화 스킬은 비공개로 관리하고 싶음

---

## 핵심 설계 원칙

1. **npm 패러다임 활용** — 이미 모든 개발자가 아는 인터페이스, 새로 배울 것 없음
2. **Public / Private 이중 구조** — 범용 스킬은 공개, 내부 특화 스킬은 org 단위로 접근 제한
3. **Claude Code 우선, 멀티 툴 확장** — 현재는 `~/.claude/skills/` 타겟, 이후 Cursor 등으로 확장 가능
4. **인증 마찰 최소화** — Public 스킬은 인증 없이 설치, Private만 PAT 등록

---

## 아키텍처

```
npmjs.com (public)
├── @skillpack/skill-sdd          ← 누구나 설치 가능
├── @skillpack/skill-review
├── @skillpack/skill-debug
├── @skillpack/skill-handoff
└── @skillpack/cli                ← 설치 CLI 자체

GitHub Packages (private, org별)
├── @naraspace/skill-internal-xxx ← NARASPACE 팀원만
└── @company-a/skill-xxx          ← 외부 회사는 자기 org로 독립 운영
```

### 설치 흐름

```
skillpack install review@2.1
        │
        ├── npmjs.com에서 @skillpack/skill-review@2.1 다운로드
        │
        └── ~/.claude/skills/review/SKILL.md 에 복사
```

### 오버라이드 우선순위 (Claude Code 기본 동작 활용)

```
프로젝트/.claude/skills/review/  ← 최우선 (로컬 오버라이드)
~/.claude/skills/review/          ← 글로벌 (설치된 버전)
```

---

## 패키지 경계 정책

**스킬 하나 = npm 패키지 하나** 를 원칙으로 한다.

- 사용자가 필요한 스킬만 선택 설치 가능
- SDD처럼 연관 스킬 묶음은 meta-package(`@skillpack/sdd-suite`)로 별도 제공 가능
- 카테고리 단위 패키지(예: `@skillpack/all`)는 Phase 2 이후 검토

## 스킬 파일 구조 (소스 기준)

ai-dev-playbook의 스킬은 두 가지 패턴이 존재한다:

| 패턴 | 진입 파일 | 해당 스킬 |
|------|----------|----------|
| 단일 파일 | `prompt.md` | architect, debug, deploy, refactor, review, test |
| 멀티 파일 | `SKILL.md` (+ 보조파일) | sdd, handoff, ulw, lol, omo 등 |

패키지 내에서는 **진입 파일을 항상 `SKILL.md`로 통일**한다.
`prompt.md` 스킬은 패키지화 시 파일명을 `SKILL.md`로 변경한다.

### skill.json — 패키지 매니페스트

각 스킬 패키지 루트에 `skill.json`을 둔다. `postinstall.js`가 이 파일을 읽어 설치 대상을 결정한다.

```json
// 단일 파일 스킬 예시 (review)
{
  "name": "review",
  "command": "/review",
  "entry": "SKILL.md",
  "files": ["SKILL.md"]
}

// 멀티 파일 스킬 예시 (sdd)
{
  "name": "sdd",
  "command": "/sdd",
  "entry": "SKILL.md",
  "files": ["SKILL.md", "help.md", "templates/"]
}
```

## 패키지 구조

각 스킬은 npm 패키지 하나:

```
packages/skill-review/
├── package.json       ← name, version, engines
├── skill.json         ← 매니페스트 (설치 대상 파일 정의)
├── SKILL.md           ← 실제 스킬 정의 (항상 이 이름으로 통일)
├── postinstall.js     ← skill.json 읽어서 ~/.claude/skills/review/에 복사
└── README.md          ← npmjs.com에 표시될 스킬 사용법
```

```json
// packages/skill-review/package.json
{
  "name": "@skillpack/skill-review",
  "version": "1.0.0",
  "description": "코드 리뷰 스킬 for Claude Code",
  "engines": { "node": ">=18" },
  "scripts": {
    "postinstall": "node postinstall.js"
  },
  "keywords": ["claude-code", "skill", "skillpack", "code-review"]
}
```

```json
// packages/cli/package.json
{
  "name": "@skillpack/cli",
  "version": "0.1.0",
  "description": "SkillPack CLI — AI 코딩 툴 스킬 패키지 매니저",
  "bin": {
    "skillpack": "./bin/skillpack.js"
  },
  "engines": { "node": ">=18" },
  "dependencies": {}
}
```

```js
// postinstall.js (공통 패턴 — skill.json 기반)
const fs = require('fs');
const path = require('path');

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'skill.json'), 'utf8'));
const target = path.join(process.env.HOME, '.claude', 'skills', manifest.name);
fs.mkdirSync(target, { recursive: true });

for (const file of manifest.files) {
  const src = path.join(__dirname, file);
  const dest = path.join(target, file);
  if (file.endsWith('/')) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(f =>
      fs.copyFileSync(path.join(src, f), path.join(dest, f))
    );
  } else {
    fs.copyFileSync(src, dest);
  }
}
console.log(`✅ ${manifest.name} → ~/.claude/skills/${manifest.name}/`);
```

---

## CLI (`@skillpack/cli`)

```bash
# 설치
npm install -g @skillpack/cli

# 사용
skillpack install review              # 최신 버전
skillpack install review@2.1.0       # 버전 고정
skillpack install sdd review debug   # 여러 개 한 번에
skillpack list                        # 설치된 스킬 목록
skillpack update                      # 전체 업데이트
skillpack update review               # 개별 업데이트
skillpack override review             # 현재 프로젝트에 로컬 오버라이드 생성
skillpack uninstall review            # 제거
```

### Private 스킬 추가 설정 (최초 1회)

```bash
# gh CLI가 이미 로그인되어 있으면
npm config set @naraspace:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken $(gh auth token)

# 이후 동일하게 사용
skillpack install @naraspace/skill-internal-xxx
```

---

## 접근 제어

| 대상 | Public 스킬 | NARASPACE Private | 자체 Private |
|------|------------|-------------------|-------------|
| NARASPACE 팀원 | ✅ 인증 없음 | ✅ org 멤버 + PAT | 자체 org 생성 |
| 외부 개발자 | ✅ 인증 없음 | ❌ 차단 | 자체 org 생성 |

- GitHub org 멤버십이 열쇠: 퇴사자는 org 제거 → PAT 있어도 자동 차단
- PAT은 `gh auth token` 으로 gh CLI 토큰 재활용 가능 (별도 발급 생략)

---

## 레포 구조 (모노레포)

```
skillpack/
├── packages/
│   ├── cli/                  ← @skillpack/cli
│   │   ├── package.json
│   │   └── src/
│   │       └── index.js
│   ├── skill-sdd/            ← @skillpack/skill-sdd
│   │   ├── package.json
│   │   ├── SKILL.md
│   │   └── postinstall.js
│   ├── skill-review/
│   ├── skill-debug/
│   ├── skill-handoff/
│   └── skill-refactor/
├── package.json              ← workspace 루트 (npm workspaces)
└── README.md
```

---

## 로드맵

### Phase 1 — MVP (Claude Code 전용)
- [ ] `postinstall.js` 패턴으로 스킬 패키지 구조 확립
- [ ] ai-dev-playbook의 핵심 스킬 5개 패키지화 (sdd, review, debug, handoff, refactor)
- [ ] npmjs.com 배포
- [ ] `@skillpack/cli` 기본 구현 (install, list, update)

### Phase 2 — 팀 운영
- [ ] NARASPACE private 스킬 GitHub Packages 배포
- [ ] `skillpack override` 명령 구현
- [ ] 팀 온보딩 스크립트 (`setup.sh`)

### Phase 3 — 멀티 AI 툴 확장
- [ ] Cursor `.cursorrules` 타겟 지원
- [ ] 툴별 설치 경로 설정 (`skillpack install review --target cursor`)
- [ ] 스킬 포맷 변환 레이어 검토

---

## 경쟁/대안 분석

| 방법 | 한계 |
|------|------|
| chezmoi + GitHub | 버전 단위 관리 안 됨, 스킬 특화 아님 |
| dotfiles git repo | 팀 배포 체계 없음 |
| claude-sync | Claude Code 전용, 스킬 레지스트리 아님 |
| Saddle.sh | 실재 여부 불확실, 검증 안 됨 |

**SkillPack의 차별점:** npm 인프라를 그대로 활용하여 버전 관리 + 레지스트리 + 팀 접근 제어를 추가 인프라 없이 해결.

---

## 관련 레포

- [ai-dev-playbook](../ai-dev-playbook) — 스킬 원본 소스, SkillPack으로 배포 예정
