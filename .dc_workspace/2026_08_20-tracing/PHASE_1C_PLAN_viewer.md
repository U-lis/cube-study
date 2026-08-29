# Phase 1C — 3D 큐브 뷰어 (viewer)

**담당**: FR-TR-14, 15, 16(그리기), 17, 22(회색 경로); NFR-TR-2, 6 / 이슈 #13
**병렬**: 1A(엔진)·1B(스크램블 워커)와 동시에 진행한다. 공유 파일이 없다 (GLOBAL §4.3).
**워크트리**: `../cube-study-feature-tracing-1C` / 브랜치 `feat/tracing-1C`

## 목표

이 페이즈가 끝나면:
- `three` 로 조립한 3x3 큐브가 캔버스에 그려지고 `OrbitControls` 로 돌아간다
- 54칸 색 배열과 강조 배열을 넣으면 그대로 칠해진다 (전 면 회색 포함)
- 24방향 중 하나로 초기 카메라를 놓을 수 있다
- `three` 는 초기 청크에 없다 — 이 화면에 들어갈 때만 받는다
- 트레이싱을 모른다. 버퍼도 타깃도 스크램블도 모른다

**이 페이즈가 임계 경로다.** 엔진과 워커는 화면 없이 검증되지만 뷰어는 눈으로 확인해야 하고, Phase 3~5 가
전부 이것 위에 올라간다. 1A/1B 보다 먼저 시작한다.

## 선행 조건

- `pnpm test` / `pnpm build` 통과 상태
- `pnpm add three` / `pnpm add -D @types/three` (이 페이즈에서 수행. `package.json`·`pnpm-lock.yaml` 을
  건드리는 유일한 갈래다 — GLOBAL §4.5)

## 대응 SPEC

| FR/NFR | 내용 |
|---|---|
| FR-TR-14 | 3D 로 보여준다. 전개도를 쓰지 않는다 |
| FR-TR-15 | 뒷면이 회전 없이 새어나가면 안 된다. 힌트·반투명·미니맵·전개도 보조 금지 |
| FR-TR-16 | 버퍼 / 현재 타깃 / 지나간 조각을 동시에 서로 다른 색으로. 색만으로 구분하지 않는다 |
| FR-TR-17 | 초기 카메라 각도를 24방향 중 하나로 |
| FR-TR-22 | 전 면 회색도 같은 색칠 경로로 |
| NFR-TR-2 | `three` 는 지연 로드 |
| NFR-TR-6 | 3D 캔버스는 `$state` 반응성의 예외 — `three` 가 자체 렌더 루프를 돈다 |

## 이슈 #13 의 결론 (그대로 따른다)

| 결정 | 내용 | 근거 |
|---|---|---|
| 라이브러리 | `three` 직접 조립 | `cubing.js` 는 면별 임의 색이 안 되어 탈락했다. 하이라이트가 이 기능의 핵심이다 |
| 지오메트리 | 큐비마다 `BoxGeometry`, material 6개 | 면별로 다른 색을 넣을 수 있는 최소 구조 |
| material 순서 | **`+X -X +Y -Y +Z -Z`** | `three` 의 `BoxGeometry` 규약. 순서를 틀리면 색이 옆면으로 간다 |
| material 캐시 | **mask 별 캐시 금지** | 큐비마다 색이 다르다. 공유하면 한 큐비를 칠할 때 다른 큐비가 같이 바뀐다 |
| 조작 | `OrbitControls` + damping | |

## 수정·생성할 파일

### `package.json` / `pnpm-lock.yaml` (수정)

`three` 와 `@types/three` 추가. **다른 의존성을 함께 넣지 않는다** — 1A·1B 와의 유일한 잠재 충돌 지점이다.

### `src/lib/cube/cube3d.ts` (신규)

`three` 를 쓰는 뷰어 본체. Svelte 를 import 하지 않는다. API 는 GLOBAL §3.3 그대로다.

```ts
export function createCubeView(canvas: HTMLCanvasElement): Promise<CubeView>;
```

구성:

| 요소 | 내용 |
|---|---|
| 씬 | 26개 큐비(중앙 제외). 각 큐비는 `BoxGeometry` + material 6개 **개별 인스턴스** |
| 색칠 | `setFacelets(colors: string[])` — 54칸을 큐비×면으로 매핑해 각 material 의 색을 갱신 |
| 강조 | `setHighlights(marks)` — 스티커 면 위에 `EdgesGeometry` 라인을 얹거나 제거 |
| 카메라 | `PerspectiveCamera` + `OrbitControls(damping)`. `setOrientation(0..23)` 이 위치·up 을 정한다 |
| 루프 | `requestAnimationFrame`. `dispose()` 에서 취소하고 geometry/material/renderer 를 전부 해제 |

**54칸 ↔ 큐비 면 매핑**은 이 페이즈의 유일한 좌표 작업이다. 면 순서는 `URFDLB`, 각 면은 좌상 → 우하
(`src/lib/cube/speffz.ts:5-7`). 이 규약을 파일 상단 주석에 적고, 매핑 함수를 **순수 함수로 분리** 해
단위 테스트한다(`three` 없이 돈다):

```ts
export function faceletToCubie(i: number): { cubie: [number,number,number]; face: 0|1|2|3|4|5 }
```

여기서 `face` 는 `+X -X +Y -Y +Z -Z` 순서의 material 인덱스다.

색 값은 인자로 받는다. 데이터셋 `meta.colorScheme`(`src/lib/domain/types.ts:150`)에서 화면이 읽어 넘긴다 —
색을 뷰어에 박지 않는다.

**뷰어는 트레이싱을 모른다.** `buffer`·`target`·`speffz` 같은 단어가 이 파일에 등장하면 설계 위반이다.
"무슨 색을 어디에" 만 받는다 (GLOBAL AD-12).

### `src/lib/ui/Cube3D.svelte` (신규)

캔버스 하나와 `onMount`/`onDestroy` 만 있는 얇은 래퍼.

```svelte
onMount(async () => {
  const { createCubeView } = await import('$lib/cube/cube3d.js');   // ← 지연 로드 지점
  view = await createCubeView(canvas);
  ...
});
onDestroy(() => view?.dispose());
```

- `three` 정적 import 는 이 저장소 어디에도 없어야 한다 (NFR-TR-2)
- props: `facelets: string[]`, `marks: (Mark|null)[]`, `orientation: number`. `$effect` 로 변화를 뷰어에 전달
- 캔버스 자리는 SSR 에서도 **같은 크기** 로 존재한다 (GLOBAL AD-14). 하이드레이션 후 캔버스가 생기며
  레이아웃이 밀리면 안 된다
- `ResizeObserver` 로 `resize()` 호출. 모바일 회전 대응

**이 컴포넌트에 힌트·반투명·미니맵·전개도를 만들지 않는다 (FR-TR-15).** 뒷면은 사용자가 돌려야 보인다.

### `tests/unit/cube3d.test.ts`, `tests/unit/bundle-three.test.ts` (신규)

PHASE_1C_TEST.md 참조. 빌드 산출물 검사는 1B 와 **다른 파일** 에 둔다 (GLOBAL §4.5).

## 구현 순서

1. `pnpm add three @types/three`
2. `faceletToCubie` 매핑 순수 함수 + 단위 테스트 — `three` 없이 먼저 맞춘다
3. `createCubeView` 골격 (씬·큐비 26개·카메라·컨트롤)
4. `setFacelets` — 풀린 큐브를 그려 눈으로 확인 (U 흰색이 위, F 초록이 앞 등 색 배치가 실물과 맞는가)
5. `setOrientation(0..23)`
6. `setHighlights` — 색 + 테두리 이중 부호화
7. `dispose()` 누수 확인
8. `Cube3D.svelte` 래퍼 + 동적 import
9. `bundle-three.test.ts`

## 완료 체크리스트

- [ ] `pnpm test` / `pnpm check` / `pnpm build` 통과
- [ ] `grep -rn "from 'three'" src/ --include=*.svelte --include=*.ts` 가 `cube3d.ts` 한 곳 (정적 import 없음)
- [ ] `grep -rn "cube3d" src/ ` 의 import 가 전부 `await import(` 형태
- [ ] 빌드 산출물의 **초기 청크에 `three` 가 없다**
- [ ] 풀린 큐브를 그리면 6면의 색이 실물과 같다 (U 위, D 아래, F 앞, B 뒤, R 오른쪽, L 왼쪽)
- [ ] 임의 facelet 문자열을 넣으면 54칸이 전부 정확히 칠해진다 (한 칸이라도 어긋나면 매핑 오류)
- [ ] 한 큐비의 색을 바꿔도 다른 큐비가 바뀌지 않는다 (material 캐시 금지 확인)
- [ ] 전 면 회색 배열을 넣으면 전부 회색이 된다 (FR-TR-22)
- [ ] 회색 상태에서도 드래그 회전이 된다 (FR-TR-22)
- [ ] `setHighlights` 로 3종 이상을 동시에 표시할 수 있고, 개수 상한이 없다 (FR-TR-16)
- [ ] 하이라이트가 색과 **테두리** 로 이중 부호화된다 (FR-TR-16)
- [ ] `setOrientation` 24개가 전부 서로 다른 시점을 만든다 (FR-TR-17)
- [ ] 뷰어 파일에 `buffer`·`target`·`speffz`·`trace` 문자열이 0건
- [ ] 반투명(`transparent`, `opacity < 1`)·힌트·미니맵·전개도 코드가 0건 (FR-TR-15)
- [ ] `dispose()` 후 geometry/material/renderer 가 전부 해제되고 rAF 가 취소된다
- [ ] 캔버스가 SSR 자리와 같은 크기로 붙는다 (레이아웃 점프 없음)

## 이 페이즈에서 조심할 것

| 위험 | 대응 |
|---|---|
| material 을 mask 별로 캐시 | 큐비마다 색이 다르다. 한 큐비를 칠할 때 다른 큐비가 같이 바뀐다. #13 이 명시한 금지사항 |
| `BoxGeometry` 면 순서 착각 | `+X -X +Y -Y +Z -Z`. 순서를 틀리면 색이 옆면으로 가는데, 큐브는 대칭이라 눈으로 잘 안 잡힌다. 매핑을 순수 함수로 빼서 54칸 전수 테스트한다 |
| `three` 정적 import 유입 | 타입만 쓰는 곳도 `import type` 으로. 빌드 산출물 검사로 못을 박는다 |
| 반투명으로 뒷면을 보여주고 싶어짐 | FR-TR-15 정면 위반. 훈련하려는 기술이 사라진다 |
| `dispose()` 누락 | 화면 재진입 때마다 GPU 메모리가 쌓인다. 체크리스트 항목 |
| Svelte 상태로 렌더 루프를 돌림 | NFR-TR-6 이 캔버스를 예외로 둔 이유다. `$state` 로 프레임을 돌리지 않는다 |
| 큐비 27개 중 중앙을 그림 | 안 보이지만 드로우콜을 낭비한다. 26개면 된다 (선택 사항 — 27개여도 무방하나 결정을 주석에 남긴다) |
| 색을 코드에 박음 | `meta.colorScheme` 에서 화면이 읽어 넘긴다. 데이터가 색을 정한다 |
