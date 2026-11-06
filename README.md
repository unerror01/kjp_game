<p align="center">
  <h1 align="center">Claude Code Game Studios</h1>
  <p align="center">
    Claude Code 세션 하나를 완전한 게임 개발 스튜디오로 바꿔 줍니다.
    <br />
    에이전트 49개. 스킬 74개. 손발이 맞는 AI 팀 하나.
  </p>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <a href=".claude/agents"><img src="https://img.shields.io/badge/agents-49-blueviolet" alt="49 Agents"></a>
  <a href=".claude/skills"><img src="https://img.shields.io/badge/skills-74-green" alt="74 Skills"></a>
  <a href=".claude/hooks"><img src="https://img.shields.io/badge/hooks-15-orange" alt="15 Hooks"></a>
  <a href=".claude/rules"><img src="https://img.shields.io/badge/rules-14-red" alt="14 Rules"></a>
  <a href="https://code.claude.com/docs"><img src="https://img.shields.io/badge/built%20for-Claude%20Code-f5f5f5?logo=anthropic" alt="Built for Claude Code"></a>
  <a href="https://www.buymeacoffee.com/donchitos3"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support%20this%20project-FFDD00?logo=buymeacoffee&logoColor=black" alt="Buy Me a Coffee"></a>
  <a href="https://github.com/sponsors/Donchitos"><img src="https://img.shields.io/badge/GitHub%20Sponsors-Support%20this%20project-ea4aaa?logo=githubsponsors&logoColor=white" alt="GitHub Sponsors"></a>
</p>

---

## 왜 만들었나

AI와 함께 혼자 게임을 만드는 일은 강력합니다. 하지만 채팅 세션 하나에는 구조가 없습니다. 매직 넘버를 코드에 박아 넣거나, 기획 문서를 건너뛰거나, 스파게티 코드를 짜도 아무도 말리지 않습니다. QA 단계도 없고, 디자인 리뷰도 없고, "이게 정말 이 게임의 비전에 맞나?"라고 묻는 사람도 없습니다.

**Claude Code Game Studios**는 AI 세션에 실제 스튜디오의 구조를 입혀서 이 문제를 해결합니다. 범용 어시스턴트 하나 대신, 스튜디오 직급 체계로 조직된 49개의 전문 에이전트를 얻게 됩니다. 비전을 지키는 디렉터, 각자의 분야를 책임지는 부서 리드, 실제 작업을 하는 전문가가 있습니다. 에이전트마다 정해진 책임, 상위 보고(에스컬레이션) 경로, 품질 관문이 있습니다.

결과적으로 모든 결정은 여전히 여러분이 내리지만, 이제는 올바른 질문을 던지고, 실수를 일찍 잡아내고, 첫 브레인스토밍부터 출시까지 프로젝트를 정리해 주는 팀이 생깁니다.

---

## 목차

- [포함된 구성](#포함된-구성)
- [스튜디오 조직도](#스튜디오-조직도)
- [슬래시 명령어](#슬래시-명령어)
- [게임을 만드나요, 문서를 만드나요?](#게임을-만드나요-문서를-만드나요)
- [시작하기](#시작하기)
- [설정](#설정)
- [업그레이드](#업그레이드)
- [프로젝트 구조](#프로젝트-구조)
- [작동 방식](#작동-방식)
- [설계 철학](#설계-철학)
- [커스터마이징](#커스터마이징)
- [지원 플랫폼](#지원-플랫폼)
- [커뮤니티](#커뮤니티)
- [프로젝트 후원하기](#프로젝트-후원하기)
- [라이선스](#라이선스)

---

## 포함된 구성

| 분류 | 개수 | 설명 |
|----------|-------|-------------|
| **에이전트** | 49 | 기획, 프로그래밍, 아트, 오디오, 내러티브, QA, 프로덕션 분야의 전문 서브에이전트 |
| **스킬** | 74 | 작업 단계마다 쓰는 슬래시 명령어 (`/start`, `/design-system`, `/create-epics`, `/create-stories`, `/dev-story`, `/story-done` 등) |
| **훅** | 15 | 커밋, 푸시, 에셋 변경, 기획 문서 읽기, 쓰기와 레지스트리, 세션 시작·종료, 에이전트 감사 기록, 누락 감지 시 자동으로 실행되는 검증 |
| **규칙** | 14 | 게임플레이, 엔진, AI, UI, 네트워크 코드, 씬·에셋 파일 등을 수정할 때 적용되는 경로별 코딩 표준 |
| **템플릿** | 62 | GDD, UX 명세, ADR, 스프린트 계획, HUD 디자인, 접근성 등의 문서 템플릿 |

## 스튜디오 조직도

에이전트는 실제 스튜디오처럼 세 단계로 조직되어 있습니다.

```
Tier 1 — Directors
  creative-director    technical-director    producer

Tier 2 — Department Leads
  game-designer        lead-programmer       art-director
  audio-director       narrative-director    qa-lead
  release-manager      localization-lead

Tier 3 — Specialists
  gameplay-programmer  engine-programmer     ai-programmer
  network-programmer   tools-programmer      ui-programmer
  systems-designer     level-designer        economy-designer
  technical-artist     sound-designer        writer
  world-builder        ux-designer           prototyper
  performance-analyst  devops-engineer       analytics-engineer
  security-engineer    qa-tester             accessibility-specialist
  live-ops-designer    community-manager
```

(1단계: 디렉터, 2단계: 부서 리드, 3단계: 전문가)

각 에이전트는 파일 앞부분(frontmatter)에 사용할 모델을 적어 둡니다. 디렉터 세 명은 Opus를 요청하고, `lead-programmer`와 전문가 15명은 Sonnet을 지정하며, 나머지 30명은 **현재 세션의 모델을 그대로 이어받습니다**. 단계는 요금제가 아니라 역할의 직급으로 보면 됩니다. 스튜디오 대부분은 지금 쓰고 있는 모델로 돌아갑니다.

### 엔진 전문가

이 템플릿에는 3대 주요 엔진별 에이전트 묶음이 모두 들어 있습니다. 프로젝트에 맞는 묶음을 사용하세요.

| 엔진 | 리드 에이전트 | 세부 전문가 |
|--------|-----------|-----------------|
| **Godot 4** | `godot-specialist` | GDScript, 셰이더, GDExtension |
| **Unity** | `unity-specialist` | DOTS/ECS, 셰이더/VFX, Addressables, UI Toolkit |
| **Unreal Engine 5** | `unreal-specialist` | GAS, 블루프린트, 리플리케이션, UMG/CommonUI |

## 슬래시 명령어

Claude Code에서 `/`를 입력하면 74개 스킬을 모두 쓸 수 있습니다.

**시작 안내 & 탐색**
`/start` `/help` `/project-stage-detect` `/setup-engine` `/adopt` `/settings`

**게임 기획**
`/brainstorm` `/map-systems` `/design-system` `/quick-design` `/review-all-gdds` `/propagate-design-change`

**아트 & 에셋**
`/art-bible` `/asset-spec` `/asset-audit`

**UX & 인터페이스 디자인**
`/ux-design` `/ux-review`

**아키텍처**
`/create-architecture` `/architecture-decision` `/architecture-review` `/create-control-manifest`

**스토리 & 스프린트**
`/create-epics` `/create-stories` `/dev-story` `/sprint-plan` `/sprint-status` `/story-readiness` `/story-done` `/estimate`

**리뷰 & 분석**
`/design-review` `/code-review` `/balance-check` `/content-audit` `/scope-check` `/perf-profile` `/tech-debt` `/gate-check` `/consistency-check` `/security-audit`

**QA & 테스트**
`/qa-plan` `/smoke-check` `/soak-test` `/regression-suite` `/test-setup` `/test-helpers` `/test-evidence-review` `/test-flakiness` `/skill-test` `/skill-improve`

**프로덕션**
`/milestone-review` `/retrospective` `/bug-report` `/bug-triage` `/reverse-document` `/playtest-report`

**출시**
`/release-checklist` `/launch-checklist` `/changelog` `/patch-notes` `/hotfix` `/day-one-patch`

**창작 & 콘텐츠**
`/prototype` `/vertical-slice` `/onboard` `/localize`

**팀 단위 진행** (하나의 기능에 여러 에이전트를 함께 투입)
`/team-combat` `/team-narrative` `/team-ui` `/team-release` `/team-polish` `/team-audio` `/team-level` `/team-live-ops` `/team-qa`

## 게임을 만드나요, 문서를 만드나요?

타당한 질문입니다. 답은 샘플 프로젝트가 아니라 측정 결과로 드리겠습니다.
같은 기획 개요 하나로 `modes.rigor` 수준을 달리해 게임 네 개를 만들고, 각각이 **게임 코드 첫 줄을 쓰기 전까지** 작성한 문서 수를 셌습니다.

| `modes.rigor` | 게임 코드 첫 줄 전까지 쓴 문서 수 | 소요 시간 |
|---|---:|---:|
| `minimal` | **1** (한 페이지짜리 개요) | 0분 |
| `standard` | 30 | 58분 |

모두 실제로 실행되고 테스트까지 통과한 게임을 만들어 냈습니다. 그런데 블라인드 리뷰어 두 명과 사람이 직접 한 플레이테스트에서는 `standard` 빌드가 **꼴찌**였습니다. 추가로 쓴 문서 29개는 추적 가능성을 얻었을 뿐, 더 좋은 게임을 만들지는 못했습니다.

### 게임을 실제로 실행하고 확인한다

위 측정은 비용에 대한 이야기입니다. 나머지 절반은 그게 실제로 작동하느냐이고, 게임에서는 누군가 직접 *봐야* 한다는 뜻입니다. 테스트가 통과해도 메뉴가 화면 밖에 그려지는 문제는 알 수 없기 때문입니다. 그래서 플레이어가 보는 화면을 바꾸는 스토리는 게임을 실행해서 눈으로 확인하고, 스크린샷을 `production/qa/evidence/`에 남기기 전까지 완료 처리되지 않습니다. 문법 검사는 실행이 아닙니다. 이 원칙은 모든 rigor 수준에 적용됩니다. 자동 테스트가 면제되는 `minimal`에서도 직접 확인하는 것은 면제되지 않습니다.

그 게임들은 일부러 **여기에 포함하지 않았습니다**. 이 저장소는 자기 프로젝트를 시작하려고 복제하는 템플릿이고, 남의 게임이 저장소에 들어 있으면 증거가 아니라 잡동사니일 뿐이기 때문입니다.

## 시작하기

### 사전 준비

- [Git](https://git-scm.com/)
- [Claude Code](https://code.claude.com/docs/en/setup) — 네이티브 설치 프로그램을 권장합니다 (Node.js 22 이상에서는 `npm install -g @anthropic-ai/claude-code`도 됩니다)
- [Python 3](https://www.python.org/) — 모든 스킬과 훅이 `project.yaml`을 읽을 때 사용합니다. 없으면 모든 설정이 아무 경고 없이 기본값으로 돌아갑니다
- Bash — 모든 훅을 실행합니다. macOS와 Linux에는 기본으로 있고, Windows에서는 [Git for Windows](https://git-scm.com/downloads/win)에 함께 들어 있습니다
- **권장**: [jq](https://jqlang.github.io/jq/) (훅 검증용)

선택 도구가 없어도 훅은 문제없이 넘어갑니다. 검증 기능만 빠질 뿐입니다. 단, 의도적인 예외가 하나 있습니다. 데이터 JSON을 스테이징한 커밋은 그것을 검증할 Python이 없으면 막힙니다.

### 설치

1. **복제하거나 템플릿으로 사용하기**:
   ```bash
   git clone https://github.com/Donchitos/Claude-Code-Game-Studios.git my-game
   cd my-game
   ```

2. **프로젝트 최상위 폴더**(`CLAUDE.md`와 `project.yaml`이 있는 폴더)에서 Claude Code를 열고 세션을 시작합니다:
   ```bash
   claude
   ```
   `src/` 같은 하위 폴더에서 시작하면 프로젝트의 훅, 금지 규칙, 먼저 묻기 권한 모드가 적용되지 않습니다.

3. **`/start` 실행** — 지금 어느 단계인지(아이디어 없음, 막연한 콘셉트, 명확한 기획, 진행 중인 작업)를 묻고 알맞은 작업 흐름으로 안내합니다. 아무것도 미리 가정하지 않습니다.

   필요한 게 무엇인지 이미 알고 있다면 특정 스킬로 바로 시작해도 됩니다:
   - `/brainstorm` — 처음부터 게임 아이디어 탐색
   - `/setup-engine godot 4.7` — 엔진이 정해져 있다면 설정
   - `/project-stage-detect` — 기존 프로젝트 분석

## 설정

저장소 최상위의 `project.yaml`은 이 스튜디오가 여러분의 프로젝트에서 어떻게 동작할지 정하는 유일한 기준입니다. 엔진, 이름 규칙, 그리고 각 스킬이 얼마나 많은 절차를 요구할지 정하는 `modes` 항목이 들어 있습니다. `/start`가 대신 작성해 주므로 직접 고칠 일은 거의 없습니다.

가장 중요한 질문은 **`modes.rigor`**(엄격도) 하나입니다. `minimal`, `standard`, `full` 중에서 고릅니다. 이것은 여섯 개의 개별 설정을 한 번에 정하는 입구입니다. 여섯 개는 `workflow`(GDD에서 필수인 섹션), `docs.density`(문서 밀도), `qa.level`(QA 수준), `story_granularity`(스토리 세분화), `review_mode`(작업을 검토하는 디렉터 에이전트 수), `team.size`(팀 규모)이고, 그래서 `/start`는 여섯 번 대신 한 번만 묻습니다.

- **`minimal`** (기본값) — 게임잼 속도. GDD 필수 없음, 간결한 문서, 최소한의 QA 증거, 혼자 검토. `/start` → `/setup-engine` → `/brainstorm`(한 페이지 개요) → `/create-stories` → `/dev-story` ↔ `/story-done`.
- **`standard`** — GDD 필수 섹션 5개, 적당한 문서 깊이, 표준 QA 증거, 가벼운 검토.
- **`full`** — GDD 8개 섹션 전부, 상세한 문서, 모든 스토리 유형에 완전한 QA 증거, 디렉터 전원 검토.

`minimal`이 기본값인 이유는, 더 무거운 단계일수록 작동하는 코드에 도달하기까지 비용이 더 들면서도 결과물이 더 좋아지지 않았고, 새로운 사람이 프로젝트를 이어받을 때도 별 도움이 되지 않았기 때문입니다. 프로젝트가 커지면 `/settings` 한 번으로 올리면 됩니다. 그런 신호가 보이면 `/help`와 `/gate-check`가 먼저 권해 줍니다.

설정 하나가 너무 뭉툭한 도구가 되지 않도록 빠져나갈 구멍이 두 개 있습니다.
**`system_overrides`**는 특정 시스템 하나만 프로젝트의 나머지보다 높은 기준으로 다룹니다. 예를 들어 전투 시스템만 `full` 수준으로 관리하고 나머지는 가볍게 둘 수 있습니다. **`testing.strict`**는 테스트 유형별(로직, 통합, 시각, UI, 설정)로 증거가 없을 때 스토리를 막을지, 경고만 할지 정합니다.

밑에 있는 여섯 개 설정은 원하면 하나씩 따로 정할 수도 있습니다 (예: `workflow: full`에 `docs.density: terse` — 빠짐없지만 간결하게). 그중 `review_mode`(`full` / `lean` / `solo`)와 `team.size`는 **개인 설정**이기도 합니다. rigor가 팀 전체 기본값을 정하지만, 공유 설정을 건드리지 않고 git에 올라가지 않는 `project.local.yaml`에서 개발자별로 바꿀 수 있습니다. `modes.automation`(AI가 행동하기 전에 얼마나 자주 멈춰서 묻는지)은 rigor와 별개이며, 마찬가지로 개인별로 바꿀 수 있습니다.

`/settings` 스킬로 모든 설정을 보거나 바꿀 수 있습니다:

```
/settings                              # view effective config
/settings modes.review_mode            # view one setting
/settings modes.rigor=full             # write to project.yaml (team-wide)
/settings --local modes.review_mode=solo   # write to project.local.yaml (just you)
```

(위에서부터: 적용 중인 설정 보기, 설정 하나 보기, `project.yaml`에 쓰기(팀 전체), `project.local.yaml`에 쓰기(나만))

전체 스키마와 설정별 동작: `.claude/docs/effects-map.md`.

## 업그레이드

이 템플릿의 예전 버전을 쓰고 있다면 [UPGRADING.md](UPGRADING.md)를 보세요. 단계별 이전 방법, 버전 사이에 바뀐 점, 그리고 그대로 덮어써도 되는 파일과 직접 합쳐야 하는 파일이 정리되어 있습니다.

## 프로젝트 구조

```
CLAUDE.md                           # 전체 설정
.claude/
  settings.json                     # 훅, 권한, 안전 규칙
  agents/                           # 에이전트 정의 49개 (마크다운 + YAML frontmatter)
  skills/                           # 슬래시 명령어 74개 (스킬마다 하위 폴더)
  hooks/                            # 스크립트 18개 (bash) — 이벤트 훅 15개, 훅이 불러 쓰는
                                    #   보조 스크립트 2개(yaml-helper.sh, update-check.sh),
                                    #   직접 연결해서 쓰는 선택형 진단 스크립트 1개
  rules/                            # 경로별 코딩 표준 14개
  statusline.sh                     # 상태 표시줄 스크립트 (컨텍스트 %, 모델, 단계, 에픽 경로)
  docs/
    workflow-catalog.yaml           # 7단계 파이프라인 정의 (/help가 읽음)
    templates/                      # 문서 템플릿 62개 (+ 섹션별 작성 가이드)
src/                                # 게임 소스 코드 (Godot). 코드 최상위 폴더는
                                    #   엔진마다 다름: Unity는 Assets/만 컴파일하고,
                                    #   Unreal은 Source/<Module>/에서 빌드
assets/                             # 아트, 오디오, VFX, 셰이더, 데이터 파일
design/                             # GDD, 내러티브 문서, 레벨 디자인
docs/                               # 기술 문서와 ADR
tests/                              # 테스트 모음 (단위, 통합, 성능, 플레이테스트)
tools/                              # 빌드·파이프라인 도구
prototypes/                         # 버려도 되는 프로토타입 (src/와 분리)
production/                         # 스프린트 계획, 마일스톤, 출시 관리
studio-tests/                       # 스킬과 에이전트 자체를 위한 QA — 아래 참고
```

### 커스터마이징한 내용 테스트하기

CCGS는 고쳐 쓰라고 만든 템플릿입니다. `studio-tests/`는 수정했거나 새로 만든 스킬이 여전히 제대로 동작하는지 확인하는 곳입니다. 74개 스킬과 49개 에이전트 전체 목록, 분류별 품질 기준표, 동작 명세, 직접 명세를 쓸 때 쓰는 템플릿이 들어 있습니다.

```
/skill-test static [name]     # structural linter — 7 compliance checks
/skill-test category [name]   # category-specific quality rubric
/skill-test spec [name]       # behavioral spec assertions
/skill-test audit             # coverage report across skills and agents
/skill-improve [name]         # test-fix-retest loop; keeps or reverts on score change
```

(위에서부터: 구조 검사 — 7가지 준수 항목, 분류별 품질 기준표, 동작 명세 검증, 스킬·에이전트 전체 커버리지 보고서, 테스트 → 수정 → 재테스트 반복 — 점수가 오르면 유지하고 아니면 되돌림)

이것은 여러분의 게임이 아니라 *프레임워크*를 테스트합니다. 게임 테스트는 `tests/`에 있습니다.

## 작동 방식

### 에이전트 협업 방식

에이전트는 정해진 위임 모델을 따릅니다.

1. **수직 위임** — 디렉터는 리드에게, 리드는 전문가에게 일을 맡깁니다
2. **수평 협의** — 같은 단계의 에이전트끼리는 서로 의견을 구할 수 있지만, 다른 분야에 대해 구속력 있는 결정을 내릴 수는 없습니다
3. **갈등 해결** — 의견이 맞지 않으면 공통 상위자에게 올라갑니다 (기획은 `creative-director`, 기술은 `technical-director`)
4. **변경 전파** — 여러 부서에 걸친 변경은 `producer`가 조율합니다
5. **분야 경계** — 명시적으로 위임받지 않으면 자기 분야 밖의 파일은 수정하지 않습니다

### 자율이 아니라 협업

이것은 자동 조종 시스템이 **아닙니다**. 모든 에이전트는 엄격한 협업 절차를 따릅니다.

1. **질문** — 해결책을 내기 전에 먼저 묻습니다
2. **선택지 제시** — 장단점과 함께 2~4개의 선택지를 보여줍니다
3. **사용자 결정** — 결정은 항상 사용자가 내립니다
4. **초안** — 확정하기 전에 작업물을 먼저 보여줍니다
5. **승인** — 사용자가 승인하지 않으면 아무것도 저장되지 않습니다

통제권은 계속 여러분에게 있습니다. 에이전트는 자율성이 아니라 구조와 전문성을 제공합니다.

프로젝트 최상위에서 터미널 세션을 시작했을 때 기본적으로 이렇게 동작합니다. `guided`와 `autonomous` 자동화 설정, 그리고 Claude Code 자체의 자동 모드는 이런 확인 단계 일부를 줄이는 대신 속도를 얻습니다. 자동 모드로 들어가는 방법은 [setup-requirements.md](.claude/docs/setup-requirements.md)를 보세요.

### 자동 안전장치

**훅**은 모든 세션에서 자동으로 실행됩니다.

| 훅 | 실행 시점 | 하는 일 |
|------|---------|--------------|
| `validate-commit.sh` | 도구 실행 전 (Bash, PowerShell) | 하드코딩된 값, TODO 형식, JSON 유효성, 기획 문서 섹션을 검사합니다. 명령이 `git commit`이 아니면 바로 종료합니다 |
| `validate-push.sh` | 도구 실행 전 (Bash, PowerShell) | 보호된 브랜치로의 푸시와 `git tag`, `git merge`, `gh release`, `butler push`, `steamcmd +run_app_build`에 경고합니다. 다른 명령이면 바로 종료합니다 |
| `validate-read.sh` | 도구 실행 전 (Read) | 40KB가 넘는 기획 문서를 통째로 읽으려 하면 거부하고 목차(제목)를 돌려줘서, 다시 시도할 때 한 섹션만 읽게 합니다 (`features.read_guard`) |
| `validate-write.sh` | 도구 실행 전 (Write/Edit) | 스킬이 정한 규칙을 깨는 쓰기에 경고만 하고 막지는 않습니다: 절대 덮어쓰지 않는 파일, 설정 보호, 프로토타입 경계, 현지화 동결 |
| `validate-registry.sh` | 도구 실행 전 (Write/Edit) | 엔티티 또는 TR-ID 레지스트리에 쓸 때 항목을 지우거나 번호를 바꾸거나, 머리말에 없는 상태값을 넣으면 경고합니다 |
| `validate-assets.sh` | 도구 실행 후 (Write/Edit) | `assets/`, `Assets/`, `Content/` 아래 데이터 JSON과, Godot의 `assets/` 안에서만 에셋 이름 규칙을 검사합니다. 해당 폴더가 아니면 바로 종료합니다 |
| `session-start.sh` | 세션 시작 | 현재 브랜치와 최근 커밋을 보여줘 상황 파악을 돕습니다 |
| `detect-gaps.sh` | 세션 시작 | 새 프로젝트를 감지하면 `/start`를 권하고, 코드나 프로토타입은 있는데 기획 문서가 없으면 알려줍니다 |
| `pre-compact.sh` | 컨텍스트 압축 전 | 압축을 기록합니다 (출력이 Claude에게 전달되지는 않으며, 이후 `session-start.sh`가 맥락을 복원합니다) |
| `notify.sh` | 권한 요청 시, 또는 약 1분간 대기 시 | PowerShell로 Windows 알림을 띄웁니다 |
| `session-stop.sh` | 응답이 끝날 때마다, 백그라운드에서 | `active.md`를 세션 로그에 보관하고 git 작업 내역을 기록합니다 |
| `log-agent.sh` | 에이전트 생성 시 | 감사 기록 시작 — 서브에이전트 호출을 기록합니다 |
| `log-agent-stop.sh` | 에이전트 종료 시 | 감사 기록 종료 — 서브에이전트 기록을 마무리합니다 |
| `validate-agent-artifact.sh` | 에이전트 종료 시 | 서브에이전트가 지시받은 파일을 쓰지 않고 끝나면 경고합니다 |
| `validate-skill-change.sh` | 도구 실행 후 (Write/Edit) | `.claude/skills/`를 수정하면 `/skill-test`를 실행하라고 안내합니다 |

> **참고**: `validate-commit.sh`, `validate-push.sh`, `validate-read.sh`, `validate-write.sh`, `validate-registry.sh`, `validate-assets.sh`, `validate-skill-change.sh`는 Bash, PowerShell, Read, Write, Edit 도구를 쓸 때마다 실행되지만, 명령이나 파일 경로가 해당되지 않으면 즉시 종료합니다(exit 0). 정상적인 훅 동작이며 성능 문제가 아닙니다.

`settings.json`의 **권한 규칙**은 테스트 실행은 자동으로 허용하고, 위험한 작업(강제 푸시, `rm -rf`, `.env` 파일 읽기)은 Bash와 PowerShell 도구 모두에서 막습니다. `git status`, `git log`, `ls` 같은 읽기 전용 명령은 규칙이 필요 없습니다. Claude Code가 묻지 않고 실행합니다. `git` 규칙은 `git` 뒤 어디에서든 일치하는지 보기 때문에, 명령 텍스트에 `push` 뒤로 ` +`나 ` -f`, `clean` 뒤로 ` -f`, `reset` 뒤로 `--hard`가 나오면 막힙니다. `git commit -m "push + pull"` 같은 커밋 메시지도 마찬가지이니 메시지를 바꿔 쓰세요.

### 경로별 규칙

코딩 표준은 파일 위치에 따라 자동으로 적용됩니다. 아래 경로는 Godot 기준입니다. 각 규칙은 Unity와 Unreal 폴더 구조에도 맞춰져 있습니다. 코드 규칙은 `Assets/**/Gameplay/` 아래 C#과 `Source/**/Gameplay/` 아래 C++에 적용되고(`Core`, `AI`, `Networking`, `UI`도 마찬가지), 데이터 규칙은 `Assets/**/Data/`와 `Content/**/Data/` 아래 JSON에, 셰이더 규칙은 파일 형식으로, 테스트 규칙은 `Assets/Tests/` 아래 C#과 `Source/**/Tests/` 아래 C++에 적용됩니다.

| 경로 | 적용 내용 |
|------|----------|
| `src/gameplay/**` | 데이터 기반 수치, 델타 타임 사용, UI 참조 금지 |
| `src/core/**` | 핫 패스에서 메모리 할당 0, 스레드 안전성, API 안정성 |
| `src/ai/**` | 성능 예산, 디버깅 용이성, 데이터 기반 파라미터 |
| `src/networking/**` | 서버 권한 방식, 버전이 붙은 메시지, 보안 |
| `src/ui/**` | 게임 상태를 소유하지 않음, 현지화 대비, 접근성 |
| `design/gdd/**` | `modes.workflow`에 따른 필수 섹션, 수식 형식, 예외 상황 |
| `design/narrative/**` | 설정 일관성, 캐릭터 말투, 정사(캐논) 단계 |
| `assets/data/**/*.json` | JSON 유효성, 이름 규칙, 스키마 규칙 |
| `assets/shaders/**` | 이름 규칙, 성능 목표, 크로스 플랫폼 규칙 |
| `**/*.tscn`, `**/*.tres` | 씬·리소스 파일은 가능하면 에디터에서 수정, 직접 수정할 때의 안전 규칙 |
| `tests/**` | 테스트 이름 규칙, 커버리지 요구사항, 픽스처 패턴 |
| `prototypes/**` | 완화된 기준, README 필수, 검증할 가설 기록 |

## 설계 철학

이 템플릿은 전문 게임 개발 방식에 기반합니다.

- **MDA 프레임워크** — 게임 기획을 메커닉(Mechanics), 다이내믹(Dynamics), 미학(Aesthetics)으로 분석
- **자기결정성 이론** — 플레이어 동기를 자율성, 유능감, 관계성으로 설명
- **몰입(Flow) 설계** — 도전과 실력의 균형으로 몰입 유도
- **바틀의 플레이어 유형** — 목표 사용자층 설정과 검증
- **검증 주도 개발** — 테스트를 먼저, 구현은 그다음

## 커스터마이징

이것은 고정된 프레임워크가 아니라 **템플릿**입니다. 모든 것을 바꿔 쓸 수 있습니다.

- **에이전트 추가/삭제** — 필요 없는 에이전트 파일은 지우고, 필요한 분야의 에이전트를 새로 추가합니다
- **에이전트 프롬프트 수정** — 에이전트의 동작을 조정하고 프로젝트 고유 지식을 넣습니다
- **스킬 수정** — 팀의 작업 절차에 맞게 작업 흐름을 바꿉니다
- **규칙 추가** — 프로젝트 폴더 구조에 맞는 경로별 규칙을 새로 만듭니다
- **훅 조정** — 검증 강도를 조절하고 새 검사를 추가합니다
- **엔진 선택** — Godot, Unity, Unreal 에이전트 묶음 중 하나를 쓰거나 아무것도 쓰지 않습니다
- **절차 무게 조절** — `project.yaml`의 `modes.rigor`와 그 하위 설정 ([설정](#설정) 참고). 아무 스킬에나 `--review solo`를 붙이면 그 실행에서만 바꿀 수 있습니다.

## 지원 플랫폼

주 개발 환경은 Git Bash를 쓰는 **Windows 10**입니다. 훅과 스크립트는 **macOS**(기본 bash 3.2와 BSD 도구, `jq` 있을 때와 없을 때 모두)와 **Linux**에서도 테스트했습니다. 모든 훅은 POSIX 호환 방식(`grep -P`가 아니라 `grep -E`)을 쓰고, 도구가 없을 때의 대체 동작이 들어 있습니다. `notify.sh` 훅은 Windows 알림에 PowerShell을 쓰며 다른 OS에서는 아무 일도 하지 않습니다. macOS/Linux 데스크톱 알림은 아직 연결되어 있지 않습니다. 플랫폼별 문제가 있으면 이슈로 알려 주세요.

## 커뮤니티

- **토론** — 질문, 아이디어, 만든 작품 자랑은 [GitHub Discussions](https://github.com/Donchitos/Claude-Code-Game-Studios/discussions)에서
- **이슈** — [버그 제보와 기능 요청](https://github.com/Donchitos/Claude-Code-Game-Studios/issues)

---

## 프로젝트 후원하기

Claude Code Game Studios는 무료 오픈소스입니다. 시간을 아껴 줬거나 게임 출시에 도움이 됐다면 꾸준한 개발을 위해 후원을 고려해 주세요.

<p>
  <a href="https://www.buymeacoffee.com/donchitos3"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me a Coffee"></a>
  &nbsp;
  <a href="https://github.com/sponsors/Donchitos"><img src="https://img.shields.io/badge/GitHub%20Sponsors-ea4aaa?style=for-the-badge&logo=githubsponsors&logoColor=white" alt="GitHub Sponsors"></a>
</p>

- **[Buy Me a Coffee](https://www.buymeacoffee.com/donchitos3)** — 일회성 후원
- **[GitHub Sponsors](https://github.com/sponsors/Donchitos)** — GitHub를 통한 정기 후원

후원금은 스킬 유지보수, 새 에이전트 추가, Claude Code와 엔진 API 변경 대응, 커뮤니티 이슈 응답에 드는 시간에 쓰입니다.

---

*Claude Code를 위해 만들었습니다. 계속 관리·확장되고 있으며, [GitHub Discussions](https://github.com/Donchitos/Claude-Code-Game-Studios/discussions)를 통한 기여를 환영합니다.*

## 라이선스

MIT 라이선스. 자세한 내용은 [LICENSE](LICENSE)를 보세요.
