# Phase 3 — 진도 표시 (progress)

**담당**: FR-MC-10, 11, 12; NFR-MC-5

## 목표

이 페이즈가 끝나면:
- 기준 상세 화면(`anchors/[code]/+page.svelte`)의 케이스 수 표시가 `{setup 체크}/{전체}` 형식으로 바뀐다
- 기준공식 목록 화면(`anchors/+page.svelte`)의 각 기준 카드에 `{setup 체크}/{전체}` 진도가 추가된다
- SSR 산출물에서 진도 숫자가 `0/{전체}`로 렌더되며, CSR 하이드레이션 후 레이아웃이 밀리지 않는다

## 선행 조건

- Phase 1 완료 (`memorize.svelte.ts` 및 `anchorProgress` 함수 사용 가능)
- Phase 2 완료 (기준 상세 화면에 체크박스가 이미 존재해, 진도 숫자와 연동 테스트 가능)

## 대응 SPEC

| FR/NFR | 내용 |
|--------|------|
| FR-MC-10 | `anchors/[code]/+page.svelte` — `{체크}/{전체}` 형식으로 변경 |
| FR-MC-11 | `anchors/+page.svelte` — 각 카드에 `{체크}/{전체}` 추가 |
| FR-MC-12 | 집계는 런타임에 `Dataset.cases` 순회 (`anchorProgress` 함수) |
| NFR-MC-5 | 진도바·퍼센트·축하 문구 금지 |

## 수정·생성할 파일

### `src/routes/anchors/[code]/+page.svelte` (수정)

변경 위치: `anchors/[code]/+page.svelte:30` — 현재 `{data.cases.length}개 케이스`.

구현 내용:
- `memorize`를 import
- 이 화면은 `+page.ts`가 `data` 를 통해 해당 기준의 케이스 목록을 이미 제공하므로 별도 `loadDataset` 호출 없이 `data.cases`를 사용할 수 있는지 확인한다. `data.cases`가 `CaseEntry[]` 배열이라면 여기서 setup 체크 케이스 수를 직접 계산한다:
  ```
  let checkedCount = $derived(
    data.cases.filter(c => memorize.isChecked('setup', c.case)).length
  )
  ```
- 표시 변경: `{data.cases.length}개 케이스` → `{checkedCount}/{data.cases.length}`
- CSS: 숫자 영역에 `font-variant-numeric: tabular-nums` + 최소 너비 예약 + 우측 정렬 (AD-4)
- SSR에서 `memorize.setupChecked`가 빈 Set이므로 `checkedCount`는 항상 `0`으로 렌더됨 → 초기 HTML에 `0/{전체}`가 그대로 박힌다
- 진도바·퍼센트 표시 추가하지 않음 (NFR-MC-5)

### `src/routes/anchors/+page.svelte` (수정)

변경 위치: `anchors/+page.svelte:28` — 현재 `r.count`.

이 화면은 `+page.ts`가 각 기준(`r`)에 대해 `r.count`를 제공한다. 체크 집계를 구하려면 `Dataset.cases`가 필요하다.

`loader.ts`의 캐시 덕분에 `loadDataset()`을 재호출해도 파싱 비용이 없다. `+page.ts` 반환값을 키워 프리렌더 산출물을 늘리지 않는다.

구현 내용:
- `onMount` 또는 `$effect.root()`에서 `loadDataset(key)` 호출 후 `ds` 상태 설정
  - 또는: `memorize.svelte.ts`의 `anchorProgress`를 사용하는 방법 — `memorize` 스토어가 로드된 후 `anchorProgress(ds, memorize.setupChecked)`를 호출
- `let progressMap = $derived(ds ? anchorProgress(ds, memorize.setupChecked) : new Map())` 형태로 `$derived` 사용
- 각 기준 카드에서 `r.name`(또는 기준 키)으로 `progressMap.get(key)` 조회해 `{체크}/{r.count}` 표시
- SSR에서 `ds`가 `undefined` → `progressMap`이 빈 Map → `0/{r.count}` 렌더
- 기준 카드 구조 (`anchors/+page.svelte:17-51`)를 확인하고 `r.count` 위치 옆에 체크 숫자 추가. 기존 레이아웃을 최소한으로 수정한다
- 진도바·퍼센트 표시 추가하지 않음 (NFR-MC-5)
- 체크가 0개이면 `0/{r.count}` — 항목 숨기거나 분류하지 않음 (FR-MC-11)

### `tests/e2e/memorize-progress.spec.ts` (신규)

## 구현 순서

1. `src/routes/anchors/[code]/+page.svelte` — `checkedCount` `$derived` 추가, 표시 변경, CSS 조정
2. `pnpm build`로 SSR 산출물 확인 — `0/{전체}` 형식 확인
3. `src/routes/anchors/+page.svelte` — `loadDataset` 재호출, `progressMap` `$derived`, 카드 표시 변경
4. `pnpm build` 재확인
5. `tests/e2e/memorize-progress.spec.ts` 작성 및 통과 확인

## 완료 체크리스트

- [ ] `anchors/[code]/+page.svelte`에서 체크박스를 체크하면 같은 페이지의 진도 숫자 좌측 값이 즉시 증가한다 (E2E로 검증)
- [ ] `anchors/+page.svelte` 기준 카드에 `{체크}/{전체}` 형식 숫자가 표시된다 (E2E로 검증)
- [ ] direct 체크는 setup 진도 숫자에 영향을 주지 않는다 (E2E로 검증)
- [ ] 체크 후 새로고침해도 진도 숫자가 유지된다 (E2E로 검증)
- [ ] `pnpm build` 산출물의 `anchors/[code]/` HTML에 `0/{숫자}` 패턴이 존재한다
- [ ] `pnpm build` 산출물의 `/anchors` HTML에 각 기준의 `0/{숫자}` 패턴이 존재한다
- [ ] 진도 숫자 변경 시 좌측 값의 자릿수 변화로 인한 레이아웃 이동이 없다 (`tabular-nums` + `min-width`)
- [ ] 진도바, 퍼센트, 축하 문구가 어느 화면에도 없다
- [ ] `pnpm test:e2e tests/e2e/memorize-progress.spec.ts` 전체 통과

## 이 페이즈에서 조심할 것

| 위험 | 대응 |
|------|------|
| 하이드레이션 후 숫자 폭 변화로 카드가 밀림 | SSR `0/{total}` → CSR 갱신 시 자릿수 폭이 바뀌지 않도록 `min-width`로 자리를 예약한다. `font-variant-numeric: tabular-nums`로 자릿수 고정 |
| `anchors/+page.svelte`에서 `loadDataset` 재호출 시 프리렌더 오류 | `onMount` 또는 `{#if browser}` 안에서만 호출. `loader.ts`의 캐시로 비용 없음 |
| `anchorProgress` Map의 키가 `anchors/+page.svelte`의 기준 키와 불일치 | 데이터 구조(`Dataset.anchors` 키)를 확인 후 동일한 키를 사용해 조회 |
| 기준 이름 하드코딩 | `progressMap.get(anchorKey)`에서 `anchorKey`를 루프 변수로 받는다. 상수 선언 없음 |
