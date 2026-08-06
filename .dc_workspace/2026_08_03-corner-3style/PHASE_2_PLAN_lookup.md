# Phase 2 — 조회 · 기준공식 브라우저

**담당**: FR-3 ~ FR-12, NFR-1, NFR-4, NFR-5, NFR-7, NFR-9
**완료 기준**: 앱의 1차 목적(스티커 2글자 → 기준공식 + 공식)이 동작한다.

## 2-1. 입력 검증 (FR-5)

`src/lib/domain/validate.ts` — 순수 함수. 데이터셋을 인자로 받는다.

```ts
export type InvalidReason =
  | { kind: 'buffer';    sticker: Sticker; cubie: Cubie }
  | { kind: 'same-letter'; sticker: Sticker }
  | { kind: 'same-cubie'; a: Sticker; b: Sticker; cubie: Cubie };

export type LookupResult =
  | { status: 'empty' }
  | { status: 'partial'; letter: Sticker; candidates: CaseCode[] }  // 항상 18개
  | { status: 'valid'; entry: CaseEntry }
  | { status: 'invalid'; reason: InvalidReason };

export function lookup(ds: Dataset, input: string): LookupResult
```

판정 순서: 버퍼 스티커 → 같은 글자 → 같은 큐비. 버퍼를 먼저 보는 이유는 `AA` 같은 입력에서 "버퍼"가 더 근본적인 사유이기 때문이다.

문구는 `reason`을 UI에서 문장으로 만든다. `validate.ts`는 문자열을 만들지 않는다.

| kind | 문구 |
|---|---|
| `buffer` | `A는 버퍼(UBL) 스티커라 케이스에 등장하지 않습니다` |
| `same-letter` | `같은 스티커 두 개는 3-cycle이 아닙니다` |
| `same-cubie` | `B와 N은 같은 큐비(UBR)라 3-cycle이 아닙니다` |

## 2-2. 입력 컴포넌트 (FR-3)

`src/lib/ui/CaseInput.svelte`

- `<input>` 하나. 온스크린 스티커 패드를 만들지 않는다
- 속성: `autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" inputmode="latin" maxlength="2"`
- **A~X 밖 문자는 값에 반영하지 않는다.** `oninput`에서 `/[^A-Xa-x]/` 를 필터링하고, 걸러진 입력이 있으면 플래시를 트리거한다
  - 한글 IME 자음·숫자·기호가 이 규칙 하나로 처리된다. composition 이벤트를 다루지 않는다
- 플래시: `flash = true` → CSS 트랜지션으로 배경 빨강 → 300ms 후 해제. `aria-invalid`도 함께 토글한다 (GLOBAL 접근성 규약)
- 대소문자 무시: 내부적으로 `toUpperCase()`
- 3글자 이상은 `maxlength`로 차단되지만, 붙여넣기 대비로 `slice(0, 2)`도 적용한다
- 입력 필드는 화면 상단 고정 (`position: sticky; top: 0`)

## 2-3. sticky 결과 (FR-4)

`+page.svelte`의 상태 구조:

```ts
let raw = $state('');                        // 현재 입력
let result = $derived(lookup(ds, raw));      // 현재 입력의 판정
let shown = $state<CaseEntry | null>(null);  // 화면에 표시 중인 케이스
$effect(() => { if (result.status === 'valid') shown = result.entry; });
let stale = $derived(shown !== null && result.status !== 'valid');
```

- `shown`은 **한 번 세팅되면 지워지지 않는다.** 새 유효 케이스가 나올 때만 교체
- `stale`이 참이면 결과 블록에 `.stale` 클래스를 붙여 회색 처리
- 후보 목록(`partial`)과 무효 사유(`invalid`)는 결과 블록 **위쪽 별도 영역**에 렌더한다. 결과 블록의 DOM 위치가 바뀌지 않아 레이아웃 점프가 없다
- 레이아웃: 상단 입력 → 보조 영역(후보/사유) → 결과 블록. 보조 영역은 내용이 없으면 높이 0

## 2-4. 표기 생성 (FR-10)

`src/lib/domain/format.ts` — GLOBAL D-2의 `formatAlg`를 구현한다.

| mode | notation | 조건 | 출력 |
|---|---|---|---|
| direct | strict | `pure` | `[` `A` `,` `B` `]` |
| direct | strict | `conj` | `[` `S` `:` `[` `A` `,` `B` `]` `]` |
| direct | compact | — | `alg` 평문 |
| setup | strict | 셋업 있음 | `[` `S` `:` `anchorName` `]` |
| setup | strict | 셋업 없음 (4건) | `anchorName` |
| setup | strict | `(직접)` (6건) | 알고리즘 평문 (괄호 없음) |
| setup | compact | — | `alg` 평문 |

- 괄호·쉼표·콜론은 `role: 'punct'` 파트로 나온다
- `A`는 `role:'insert'`, `B`는 `role:'interchange'`, `S`는 `role:'setup'`, anchor 이름은 `role:'anchor'`
- 색은 insert·interchange 두 가지만. setup은 기본 텍스트 색 (SPEC FR-10)

## 2-5. 알고리즘 렌더 (NFR-4, NFR-5)

`src/lib/ui/Alg.svelte`

```svelte
<script lang="ts">
  let { parts, size = 'md' }: { parts: AlgPart[]; size?: 'sm'|'md'|'lg' } = $props();
</script>

<span class="alg {size}">
  {#each parts as p}
    {#if p.role === 'punct'}<span class="punct">{p.text}</span>
    {:else}{#each p.text.split(' ') as mv}<span class="mv {p.role}">{mv}</span>{/each}{/if}
  {/each}
</span>
```

- `{@html}` 사용 금지
- `.alg { display:flex; flex-wrap:wrap; gap:.35em; font-family:var(--mono); font-variant-ligatures:none; }`
- **`--mono` 토큰을 이 페이즈에서 `app.css`에 정의한다** (GLOBAL D-4의 시스템 폰트 스택). Phase 4는 테마 색 토큰만 추가하며 `--mono`를 다시 정의하지 않는다
- `.mv { white-space: nowrap }`
- **왼쪽 정렬** (SPEC FR-6: 가운데 정렬 금지)

## 2-6. 결과 표시 (FR-6~9)

`src/lib/ui/CaseView.svelte`

공통 영역:
- 케이스 코드 (크게, 가운데 정렬)
- 타깃 2개: `L = DFL의 F면` 형식
- 역 케이스 링크 → `/?c={inverse}`

setup 모드 (기본):
- **기준공식 이름을 가장 크게** (FR-7)
- 셋업 `S`, 기준공식 알고리즘, 입구 2자리, 최종 알고리즘
- `(직접)` 6건은 배지 표시

direct 모드:
- 알고리즘, 무브 수, `[A, B]` 또는 `[S: [A, B]]` 구조
- `A` = "인서트", `B` = "교환" 라벨

토글 (FR-9, FR-10):
- direct ↔ setup, strict ↔ compact 각각 토글
- `sameAlg` 배지는 **compact 모드일 때만** 표시. 문구: `최종 무브 열이 같습니다`

## 2-6b. UI 설정 스토어 (부분 구현)

`src/lib/ui/settings.svelte.ts` — GLOBAL D-5의 3개 키 중 **이 페이즈에서는 `ui.mode`와 `ui.notation`만 구현한다.** `ui.theme`는 Phase 4에서 추가한다.

```ts
class Settings {
  mode = $state<'direct'|'setup'>('setup');
  notation = $state<'strict'|'compact'>('strict');
  // theme 은 Phase 4
}
```

localStorage 접근은 `$effect` 안에서 `browser` 가드와 함께 처리한다. prerender 중 접근하면 빌드가 깨진다.

## 2-7. 기준공식 브라우저 (FR-11, FR-12)

`/anchors` — 10개를 `count` 내림차순으로. 각 항목에 알고리즘·무브 수·입구 2자리·담당 케이스 수(숫자만).
**백분율·누적 커버리지·우선순위 문구 금지** (NFR-9).

`/anchors/[code]` — 해당 기준의 케이스 목록. `setup.S` 무브 수 오름차순 정렬(쉬운 것 먼저). `(직접)` 6건은 `/anchors/direct`에 별도 그룹.

## 산출물

```
src/lib/domain/{validate.ts, format.ts}
src/lib/ui/{CaseInput.svelte, CaseView.svelte, Alg.svelte}
src/lib/ui/settings.svelte.ts
src/routes/{+layout.svelte, +page.svelte}
src/routes/anchors/{+page.svelte, [code]/+page.svelte}
src/lib/styles/app.css
```

## 위험 요소

| 위험 | 대응 |
|---|---|
| sticky 결과와 후보 목록이 서로 밀어냄 | 보조 영역을 결과 블록 위 고정 슬롯으로. E2E에서 결과 블록 `boundingBox().y` 불변 확인 |
| 프라임이 타이포그래피 따옴표로 변환됨 | `Alg.svelte`만 렌더 경로로 두고, 단위 테스트에서 `’` 부재 확인 |
| 무효 입력 플래시가 매 키 입력마다 튐 | 걸러진 문자가 실제로 있을 때만 트리거 |
