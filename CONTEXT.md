# SkillPack — 프로젝트 컨텍스트 (인수인계용)

> 이 문서는 다른 머신/세션에서 작업을 이어받는 사람(또는 AI)을 위한 배경 설명이다.
> README.md가 "무엇을 만드는가"라면, 이 문서는 "왜 이런 결론에 도달했는가"다.

---

## 어떤 대화에서 나왔는가

NARASPACE에서 ai-dev-playbook(Claude Code 스킬/설정 모음 레포)을 운영 중인데,
여러 머신에서 Claude Code를 쓸 때 `~/.claude/` 설정이 자동으로 동기화되지 않는 문제를 인식했다.

"다들 어떻게 하고 있나?"를 조사하면서 자연스럽게 아이디어가 발전했다.

---

## 조사 결과 요약

### 커뮤니티는 이렇게 하고 있다

| 방법 | 특징 |
|------|------|
| chezmoi + Age 암호화 + GitHub | 가장 많이 채택, 암호화 내장 |
| dotfiles git repo + symlink | 단순, 진입장벽 낮음 |
| claude-sync CLI | Claude Code 전용 push/pull |

### 핵심 발견

- **Anthropic 공식 동기화 없음** — 커뮤니티가 각자 해결 중
- chezmoi 등 기존 dotfiles 툴은 "파일 동기화"는 해결하지만 **버전 단위 관리, 팀 배포, 레지스트리** 개념이 없음
- Cursor는 VSCode Settings Sync로 이미 해결됨. Claude Code만 공백 상태

### 실제로 해결 안 된 세 가지

1. **팀 단위 스킬 배포** — 새 팀원이 `skillpack install` 한 줄로 팀 환경 구성
2. **버전 관리된 스킬 레지스트리** — `npm install review@2.1` 같은 게 없음
3. **머신별 오버라이드** — "이 스킬은 이 프로젝트에서만 다르게" 체계 없음

---

## 왜 npm 패러다임인가

처음엔 chezmoi, yadm, Stow 등 dotfiles 툴을 검토했다.
결론적으로 이 툴들은 "내 설정을 내 여러 머신에 동기화"하는 개인 도구고,
SkillPack이 하려는 "팀/커뮤니티가 스킬을 배포하고 설치"하는 레지스트리 개념이 없다.

npm을 쓰기로 한 이유:
- 모든 개발자가 이미 알고 있는 인터페이스 (학습 비용 0)
- 버전 관리, 의존성, 레지스트리를 공짜로 얻음
- public/private 분리가 이미 구현되어 있음 (org 기반)
- 추가 인프라 없이 시작 가능

스킬은 JS 코드가 아니지만, npm은 파일만 배포하는 데도 완벽하게 동작한다.
`postinstall.js` 50줄로 원하는 설치 동작을 전부 구현 가능.

---

## Public / Private 구조 결정 과정

**처음 질문:** "외부 인원도 쓸 수 있게 되는 건가?"

**결론:**
- 대부분의 스킬(`sdd`, `review`, `debug`, `handoff`)은 내부 비밀이 없고 공개해도 무방
- 오히려 공개하면 커뮤니티 기여/피드백을 받을 수 있음
- 내부 특화 스킬(특정 내부 시스템 참조, 테스트 환경 설정 등)만 private

**Private 접근 제어 방식:**
- GitHub org 멤버십 + PAT
- PAT은 `gh auth token`으로 gh CLI 토큰 재활용 가능 (별도 발급 생략)
- 퇴사자 → org 제거 → PAT 있어도 자동 차단
- 외부 회사가 자기 private 스킬 원하면 자기 org 만들면 됨 (완전 독립)

**PAT 발급 위치:** `https://github.com/settings/tokens/new`
- 일반 팀원: `read:packages` 만
- 배포 담당자: `write:packages` 추가

---

## 명칭 선정 과정

후보: SkillPack, SkillHub, OpenSkills, SkillReg, aipkg

**SkillPack 선정 이유:**
- "skill + pack(age)" — npm 패러다임을 직관적으로 전달
- Claude Code에 종속적이지 않아 멀티 AI 툴 확장 시에도 자연스러움
- 충돌하는 유명 오픈소스 프로젝트 없음

---

## 설계 의도: Claude Code 우선, 멀티 툴 확장 가능

현재 타겟은 `~/.claude/skills/`이지만,
Cursor의 `.cursorrules`, GitHub Copilot Instructions도 비슷한 방향으로 수렴 중.

Phase 3에서 멀티 툴 지원을 검토하되, 지금은 과도한 추상화 금지.
Claude Code에서 잘 동작하는 걸 먼저 만들고, 확장은 실제 수요가 생길 때.

---

## 현재 상태 (이 문서 작성 시점)

- [x] 개념 설계 완료
- [x] README.md 작성 완료 (`/root/workspace/skill-sync/README.md`)
- [ ] 실제 구현 시작 전 (다른 머신에서 진행 예정)

---

## 추가 설계 결정 (ULW 검토 후 확정)

### 패키지 경계

"스킬 하나 = npm 패키지 하나"로 확정.
이유: 사용자가 필요한 스킬만 선택 설치 가능. SDD 워크플로우(sdd, sdd-specify, sdd-plan, sdd-tasks, sdd-implement)는 개별 설치 + meta-package 옵션 병행.

### 진입 파일 통일

소스에 `prompt.md`/`SKILL.md` 혼용 → 패키지에서는 **항상 `SKILL.md`로 통일**.
패키지화 시 `prompt.md` → `SKILL.md` 로 파일명 변경.

### skill.json 매니페스트

`postinstall.js`가 하드코딩 없이 모든 스킬을 처리할 수 있도록
각 패키지에 `skill.json`을 도입. `name`, `command`, `entry`, `files` 필드.
README.md에 전체 스펙 및 예시 기재됨.

---

## 다음 작업자를 위한 Phase 1 가이드

### 목표
ai-dev-playbook의 핵심 스킬 5개를 npm 패키지로 만들고 npmjs.com에 배포.

### 작업 순서

**1. 모노레포 초기화**
```bash
cd /root/workspace/skill-sync
npm init -y
# package.json에 "workspaces": ["packages/*"] 추가
npm init -w packages/cli \
         -w packages/skill-sdd \
         -w packages/skill-review \
         -w packages/skill-debug \
         -w packages/skill-handoff \
         -w packages/skill-refactor
```

**2. 스킬 소스 → 패키지 매핑표**

| 패키지명 | 소스 경로 | 진입 파일 처리 |
|---------|----------|--------------|
| `@skillpack/skill-sdd` | `skills/sdd/` | SKILL.md 그대로 + help.md, templates/ |
| `@skillpack/skill-review` | `skills/review/` | prompt.md → **SKILL.md** 로 변경 |
| `@skillpack/skill-debug` | `skills/debug/` | prompt.md → **SKILL.md** 로 변경 |
| `@skillpack/skill-handoff` | `skills/handoff/` | SKILL.md 그대로 |
| `@skillpack/skill-refactor` | `skills/refactor/` | prompt.md → **SKILL.md** 로 변경 |

소스 위치: `/root/workspace/ai-dev-playbook/skills/`

**3. 각 패키지 구조**
```
packages/skill-review/
├── package.json      ← name, version, engines(node>=18)
├── skill.json        ← 매니페스트
├── SKILL.md          ← 스킬 정의
├── postinstall.js    ← skill.json 기반 설치 스크립트 (README.md 참고)
└── README.md         ← npmjs.com 표시용
```

`skill.json` 예시:
```json
{ "name": "review", "command": "/review", "entry": "SKILL.md", "files": ["SKILL.md"] }
```

**4. postinstall.js** — README.md의 공통 템플릿 사용 (skill.json 읽어서 복사, 하드코딩 없음)

**5. npmjs.com 배포**
```bash
npm login  # npmjs.com 계정 필요 (skillpack org 사전 생성)
npm publish --access public -w packages/skill-review
```

**6. CLI 구현 (`packages/cli/`)**
우선순위: `install` → `list` → `update` → `override`

```
packages/cli/
├── package.json    ← bin: { "skillpack": "./bin/skillpack.js" }, engines: node>=18
└── bin/
    └── skillpack.js  ← npm install -g @skillpack/skill-xxx 래퍼
```

```js
// bin/skillpack.js 핵심 로직
const { execSync } = require('child_process');
function install(skillName, version = 'latest') {
  execSync(`npm install -g @skillpack/skill-${skillName}@${version}`, { stdio: 'inherit' });
}
```

### npmjs.com 계정
배포 전에 `npmjs.com`에 `@skillpack` org 계정 생성 필요.

---

## 참고: ai-dev-playbook과의 관계

```
ai-dev-playbook/skills/    ← 스킬 원본 (개발/편집 여기서)
        │
        │ (패키지화)
        ▼
skill-sync/packages/skill-xxx/   ← npm 패키지
        │
        │ (배포)
        ▼
npmjs.com @skillpack/skill-xxx   ← 레지스트리
        │
        │ (설치)
        ▼
~/.claude/skills/xxx/            ← 실제 사용 위치
```

ai-dev-playbook은 스킬 원본 편집 공간이고,
skill-sync는 그것을 배포 가능한 패키지로 만드는 파이프라인이다.
장기적으로는 ai-dev-playbook의 `skills/` 변경이 skill-sync 패키지 버전 업으로
자동 연결되는 CI 파이프라인 구성을 검토한다.
