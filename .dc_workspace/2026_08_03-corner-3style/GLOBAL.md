<!-- dotclaude-config
working_directory: .dc_workspace
doc_dir: 2026_08_03-corner-3style
base_branch: main
language: ko_KR
worktree_path: ../cube-study-feature-corner-3style
-->

# 코너 3-Style UBL 조회 + 퀴즈 - 아키텍처 및 전역 설계

SPEC.md의 FR-1~22 / NFR-1~9를 구현하기 위한 아키텍처 결정과 페이즈 분해.

## 1. 기술 스택

| 영역 | 선택 | 근거 |
|---|---|---|
| 프레임워크 | SvelteKit 2 + Svelte 5 (runes) | 런타임 번들이 작아 NFR-2(콜드스타트 1초) 달성이 쉽다 |
| 언어 | TypeScript (strict) | 데이터 스키마가 복잡해 타입이 실질적 방어가 된다 |
| 빌드/배포 | `adapter-static`, 전 라우트 prerender | 서버 런타임 불필요. nginx `root` 하나로 배포 |
| PWA | `@vite-pwa/sveltekit` (Workbox) | 전 자산 프리캐시로 NFR-8(오프라인) 충족 |
| 단위 테스트 | Vitest | Vite 기반이라 별도 설정이 거의 없다 |
| E2E 테스트 | Playwright | 조회 즉각성·sticky·IME 플래시 등 실제 브라우저 거동 검증 필요 |
| 상태 관리 | Svelte 5 runes (`$state`, `$derived`) | SPEC 제약대로 무거운 상태 라이브러리를 쓰지 않는다 |

**의존성 최소 원칙**: 위 목록 외 런타임 의존성을 추가하지 않는다. 시뮬레이터·데이터·표기 유틸이 모두 자체 코드다.

## 2. 디렉토리 구조

```
src/
├── lib/
│   ├── data/
│   │   ├── corner-UBL.json          # handoff v2 데이터 (그대로 복사)
│   │   └── loader.ts                # FR-1 {pieceType, buffer} 로더
│   ├── cube/
│   │   ├── perms.json               # handoff sim/cube_perms.json
│   │   ├── sim.ts                   # cube-sim.js 를 TS 로 이식 (FR-13,14)
│   │   └── notation.ts              # invertAlg / cancelMoves / moveCount
│   ├── domain/
│   │   ├── types.ts                 # FR-2 데이터 스키마 타입
│   │   ├── validate.ts              # FR-5 무효 입력 판별 + 사유
│   │   └── format.ts                # FR-10 strict/compact 표기 생성
│   ├── ui/
│   │   ├── settings.svelte.ts       # mode/notation/theme 전역 설정
│   │   ├── Alg.svelte               # 알고리즘 렌더 (NFR-4,5 담당)
│   │   ├── CaseView.svelte          # FR-6~10 결과 표시
│   │   ├── CaseInput.svelte         # FR-3 입력
│   │   └── MoveKeypad.svelte        # FR-17 무브 버튼 18개
│   └── styles/
│       └── app.css                  # 테마 토큰, 고정폭 스택
├── routes/
│   ├── +layout.svelte               # 테마·네비게이션
│   ├── +page.svelte                 # 조회 (F1)
│   ├── anchors/+page.svelte         # 기준공식 브라우저 (F2)
│   └── quiz/+page.svelte            # 퀴즈 (F3)
└── app.html
tests/
├── unit/                            # Vitest
└── e2e/                             # Playwright
```

## 3. 핵심 설계 결정

### D-1. 시뮬레이터는 이식이지 재작성이 아니다

`handoff/sim/cube-sim.js`는 1134/1134 검증을 통과한 참조 구현이다. `sim.ts`는 **타입만 입히고 로직을 그대로 옮긴다.**

- 상태 모델: `Record<Sticker, Sticker>` — `{위치: 그_위치에_있는_원래_스티커}`
- 무브 적용: `next[pos] = st[table[pos]]` (테이블에 역치환이 이미 적용됨)
- `bld_sim.py`는 반대 규약이므로 참고 대상이 아니다

**검증 방법**: 이식 후 `handoff/sim/test_sim.mjs`·`test_v2.mjs`와 동일한 검사를 Vitest로 재현해 1134건·5292건이 동일하게 통과하는지 확인한다. 이식 중 규약을 틀리면 여기서 잡힌다.

### D-2. 표기 생성은 `format.ts`에 집중한다

FR-10의 strict/compact 표기 규칙이 모드·type·셋업 유무에 따라 5가지로 갈린다. UI 컴포넌트에 흩으면 일관성이 깨지므로 순수 함수 하나로 모은다.

```ts
type AlgPart = { text: string; role: 'insert' | 'interchange' | 'setup' | 'anchor' | 'plain' | 'punct' };
function formatAlg(entry, mode: 'direct'|'setup', notation: 'strict'|'compact'): AlgPart[]
```

UI는 `AlgPart[]`를 받아 `role`에 따라 색만 입힌다. 괄호·쉼표도 `punct` role의 파트로 나오므로 컴포넌트가 문자열을 조립하지 않는다.

### D-3. 알고리즘 렌더는 `Alg.svelte` 한 곳에서만

NFR-4(ASCII 프라임)와 NFR-5(무브 단위 줄바꿈)를 지키는 유일한 지점으로 삼는다.

- `{@html}` 금지. 텍스트 보간만 사용
- 무브 토큰 단위로 `<span class="mv">` 분할, 컨테이너는 `flex-wrap`
- `.mv { white-space: nowrap }`, 컨테이너에 `font-variant-ligatures: none`
- 알고리즘을 표시하는 모든 화면이 이 컴포넌트를 거친다

### D-4. 고정폭 폰트는 시스템 스택을 쓴다

NFR-3은 "번들에 포함, CDN 금지"를 요구한다. **시스템 폰트 스택으로 이를 만족시킨다.**

```css
--mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
        "Liberation Mono", "DejaVu Sans Mono", monospace;
```

- 네트워크 요청이 없으므로 오프라인 요구를 확실히 만족한다 (웹폰트는 프리캐시 누락 시 조용히 폴백된다)
- 번들 15~20KB 절약 → NFR-2 콜드스타트에 유리
- `R`과 `R'` 구분은 어떤 고정폭 글꼴에서도 성립한다

웹폰트 번들은 기기 간 렌더 통일이 필요해질 때 재검토한다.

### D-5. UI 설정은 localStorage에 저장한다

SPEC의 "학습 상태 저장 없음"은 **케이스별 학습 진도**를 뜻한다. 아래 3개는 학습 데이터가 아니라 표시 설정이므로 저장한다. 매번 초기화되면 조회할 때마다 토글을 다시 눌러야 한다.

| 키 | 값 | 기본값 |
|---|---|---|
| `ui.mode` | `direct` \| `setup` | `setup` (SPEC: 학습 초기 단계) |
| `ui.notation` | `strict` \| `compact` | `strict` |
| `ui.theme` | `system` \| `light` \| `dark` | `system` |

퀴즈 출제 이력·정답률은 저장하지 않는다.

### D-6. 라우팅과 딥링크

전 라우트 prerender. 케이스 딥링크는 쿼리 파라미터로 처리한다.

| 경로 | 화면 |
|---|---|
| `/` | 조회. `/?c=LB` 로 특정 케이스 진입 |
| `/anchors` | 기준공식 10개 목록 |
| `/anchors/[code]` | 해당 기준의 케이스 목록 (10개 prerender) |
| `/quiz` | 퀴즈 |

쿼리는 클라이언트에서 읽으므로 prerender와 충돌하지 않는다. 역 케이스 링크와 퀴즈 → 조회 이동이 이 경로를 쓴다.

### D-7. 데이터는 정적 import 한다

FR-1은 `{pieceType, buffer}` 로더 분리를 요구하지만, 0.1.0은 데이터셋이 하나다.

```ts
export async function loadDataset(key: DatasetKey): Promise<Dataset> {
  const mod = await import(`./corner-UBL.json`);  // 0.1.0: 단일 데이터셋
  return mod.default as Dataset;
}
```

시그니처를 지금 확정해두면 UFR·엣지 추가 시 `loader.ts` 내부만 바뀐다. 호출부는 손대지 않는다.

## 4. 페이즈 분해

병렬 페이즈를 두지 않는다. 1인 프로젝트이고 Phase 2~4가 Phase 1의 산출물에 직렬로 의존하며, worktree 병렬의 관리 비용이 이득보다 크다.

| Phase | 범위 | 담당 FR/NFR | 산출 |
|---|---|---|---|
| **1** | 기반 — 스캐폴딩, 데이터 레이어, 시뮬레이터 이식, 테스트 하네스 | FR-1, 2, 13, 14, 15 | 앱은 아직 화면이 없고 테스트만 돈다 |
| **2** | 조회 + 기준공식 브라우저 | FR-3~12, NFR-1, 4, 5, 9 | 앱의 1차 목적이 동작 |
| **3** | 퀴즈 | FR-16~19 | 2차 목적이 동작 |
| **4** | 마감 — PWA, 테마, 반응형, E2E | FR-20~22, NFR-2, 3, 6, 7, 8 | 0.1.0 완성 |

Phase 1을 먼저 세우는 이유는 **시뮬레이터 검증이 여기서 끝나기** 때문이다. 데이터와 시뮬레이터가 옳다는 것이 확정된 뒤에야 UI 작업의 실패 원인이 UI로 좁혀진다.

## 5. 테스트 전략

| 층 | 도구 | 대상 |
|---|---|---|
| 단위 | Vitest | 시뮬레이터(1134+5292건), 입력 검증, 표기 생성, 로더 |
| 컴포넌트 | Vitest + Testing Library | `Alg.svelte`의 ASCII 프라임·nowrap 보장 |
| E2E | Playwright | 조회 흐름, sticky 거동, 무효 입력 플래시, 토글, 퀴즈 판정, 오프라인, 다크모드 |

**E2E는 여건이 되는 만큼 진행한다.** Playwright 브라우저 바이너리 다운로드가 막히면 단위·컴포넌트 테스트로 대체하고 수동 확인 절차를 문서화한다.

### 데이터 회귀 테스트 (필수)

`npm test`에 아래를 포함한다. 데이터나 시뮬레이터를 건드린 변경은 여기서 걸린다.

- 378케이스 direct/setup `identifyCase` 일치 + 엣지 무영향 + `moves` 정합 → 1134건
- v2 파생 필드(`strict`, `sameAlg`, `inverseTrick`, self-inverse 플래그) → 5292건

## 6. 공통 규약

- **데이터 불변**: `corner-UBL.json`을 코드에서 수정하지 않는다. 파생이 필요하면 `$derived`로 계산하되 알고리즘 문자열은 생성하지 않는다.
- **UI 문구**: NFR-9에 따라 사실만 적는다. 백분율·격려·게이미피케이션 금지.
- **한국어 UI, 영문 표기**: 큐브 표기와 케이스 코드는 영문 그대로.
- **접근성 최소선**: 무효 입력을 색(빨강 플래시)으로만 알리므로, 입력 필드에 `aria-invalid`를 함께 토글한다.
- **커밋**: 페이즈 단위로 커밋하고 푸시하지 않는다 (사용자 지시).
