# Phase 2 — 뷰어 확장

GLOBAL AD-LT-8, 9, 14. SPEC FR-LT-9, 10.

## `src/lib/cube/cube3d-map.ts`

- `labelUp(i): CubieCoord` — facelet i 가 앉은 면에서 글자 위쪽 방향. `PLACE[face](0,1) − PLACE[face](1,1)`
- `assertLabels(labels)` — 54칸, 각 칸 `string` (1글자) 또는 `null`

## `src/lib/cube/cube3d.ts`

- `CubeView.setLabels(labels)` 추가. 스티커마다 투명 평면(`PlaneGeometry` 공유, `MeshBasicMaterial({ map, transparent:true, depthWrite:false })` 칸별)
  - 글자 텍스처는 글자별 캐시(`Map<string, CanvasTexture>`). `dispose` 에서 전부 해제
  - 평면 방향: 법선 = 면 바깥, 위쪽 = `labelUp(i)`. `lookAt` 대신 기저 행렬로 놓는다(법선 × 위쪽)
  - 그리기: 128px 캔버스, `bold 84px sans-serif`, `strokeStyle '#fff'`, `lineWidth 16`, `lineJoin round`, `strokeText` 후 `fillStyle '#111'` `fillText`
- `setOrientation(index)` 가 관성을 끊는다. TrackballControls 소스(`three/examples/jsm/controls/TrackballControls.js`)에서
  감쇠가 쓰는 상태(`_moveCurr`/`_movePrev` 류)를 확인하고, 공개 API 로 끊을 수 있으면 그것을, 없으면
  `controls.reset()` 후 카메라를 놓는 방법을 쓴다. 근거를 주석에 적는다

## `src/lib/ui/Cube3D.svelte`

- prop `labels?: (string|null)[]` (기본 54칸 null 상수) → `$effect` 로 `setLabels`
- `export function resetView(index: number)` → `view?.setOrientation(index)`
- 캔버스 속성 `data-labels` · `data-marked` · `data-colored` (AD-LT-14). `data-colored` 는 `GRAY` 가 아닌 칸 수
- 기존 소비자(트레이싱)는 바뀌지 않는다
