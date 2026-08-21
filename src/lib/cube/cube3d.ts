/**
 * 3D 큐브 뷰어 (FR-TR-14, 15, 16, 17, 22 / 이슈 #13).
 *
 * **이 파일은 저장소에서 `three` 를 정적으로 import 하는 유일한 곳이다.** 그리고 이
 * 파일 자체가 `Cube3D.svelte` 에서 `await import()` 로만 불린다 — 조회·퀴즈만 쓰는
 * 사용자가 그것을 받으면 안 된다 (NFR-TR-2).
 *
 * SPEC 은 gzip ~85KB 로 잡았지만 **실측은 gzip 132KB(raw 530KB)** 다. `WebGLRenderer`
 * 와 `OrbitControls` 를 쓰는 이상 three 코어가 통째로 따라온다 — 트리셰이킹으로 줄지
 * 않는다. 지연 로드의 근거가 오히려 커진 것이라 결정은 그대로 두고 숫자만 적어둔다.
 *
 * Svelte 를 import 하지 않는다 (AD-11). 렌더 루프는 `three` 가 돈다 — `$state`
 * 반응성의 예외다 (NFR-TR-6).
 *
 * **뷰어는 트레이싱을 모른다** (AD-12). "무슨 색을 어디에" 만 받는다. 전 면 회색
 * (FR-TR-22)도 같은 `setFacelets` 경로로 칠해진다. 어느 칸이 무슨 색인지는 화면이
 * 데이터셋 `meta.colorScheme` 에서 읽어 넘긴다 — 색을 여기 박지 않는다.
 *
 * 좌표 규약과 인자 검증은 `cube3d-map.ts` 에 있다 (`three` 없이 도는 순수부).
 *
 * ## 설계에서 조심한 것
 *
 * - **material 을 mask 별로 캐시하지 않는다.** 참고 구현들은 "겉면인가" 만 보고
 *   표준 6색 material 을 돌려쓰지만, 우리는 같은 겉면이라도 큐비마다 색이 다르다
 *   (버퍼·현재 타깃·지나간 조각). 공유하면 한 칸을 칠할 때 다른 칸이 같이 바뀐다.
 *   그래서 큐비 26개 × 면 6개 = 156개 material 을 **개별 인스턴스** 로 만든다.
 * - **반투명을 쓰지 않는다.** 뒷면이 회전 없이 새면 훈련하려는 기술이 사라진다
 *   (FR-TR-15). 힌트·미니맵·전개도 보조 표시도 없다.
 * - 무브 애니메이션이 없다. 상태만 그린다.
 */
import {
	BoxGeometry,
	Color,
	EdgesGeometry,
	Group,
	LineDashedMaterial,
	LineSegments,
	Mesh,
	MeshBasicMaterial,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	WebGLRenderer
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
	assertFacelets,
	assertMarks,
	CAMERA_DISTANCE,
	cubieCoords,
	cubieKey,
	faceletToCubie,
	orientationOf,
	type CubieCoord,
	type FaceIndex,
	type Mark
} from './cube3d-map.js';

export type { Mark } from './cube3d-map.js';

export interface CubeView {
	/** 54칸 색. 면 순서 `URFDLB`, 각 면은 좌상 → 우하. */
	setFacelets(colors: string[]): void;
	/** 54칸 강조. `null` 은 강조 없음. 채워지는 개수에 상한이 없다. */
	setHighlights(marks: (Mark | null)[]): void;
	/** 초기 카메라 각도 0..23. */
	setOrientation(index: number): void;
	resize(): void;
	dispose(): void;
}

/** 큐비 한 칸의 크기와 간격. 간격이 있어야 스티커 경계가 눈에 잡힌다. */
const CUBIE_SIZE = 0.94;
const CUBIE_STEP = 1;
/** 안 보이는 안쪽 면의 색. 스티커가 아니라 플라스틱이다. */
const PLASTIC = '#17171a';
/** 강조 테두리를 스티커 면에서 얼마나 띄울 것인가. z-fighting 만 피하면 된다. */
const OUTLINE_LIFT = 0.006;
/** 바깥 테두리 / 안쪽 테두리(`double`)의 크기 비율. */
const OUTLINE_SCALE = [0.86, 0.62];

/** `three` 의 `BoxGeometry` 면 순서에 대응하는 바깥 방향. 0:+X 1:-X 2:+Y 3:-Y 4:+Z 5:-Z */
const FACE_NORMAL: CubieCoord[] = [
	[1, 0, 0],
	[-1, 0, 0],
	[0, 1, 0],
	[0, -1, 0],
	[0, 0, 1],
	[0, 0, -1]
];
/** 그 면의 테두리 사각형을 눕히기 위한 회전 (라디안). */
const FACE_ROTATION: [number, number, number][] = [
	[0, Math.PI / 2, 0],
	[0, -Math.PI / 2, 0],
	[-Math.PI / 2, 0, 0],
	[Math.PI / 2, 0, 0],
	[0, 0, 0],
	[0, Math.PI, 0]
];

interface Sticker {
	material: MeshBasicMaterial;
	/** 바깥·안쪽 테두리 두 겹. `double` 일 때만 둘 다 보인다. */
	outlines: LineSegments<EdgesGeometry, LineDashedMaterial>[];
}

export async function createCubeView(canvas: HTMLCanvasElement): Promise<CubeView> {
	const scene = new Scene();
	const camera = new PerspectiveCamera(40, 1, 0.1, 100);
	const renderer = new WebGLRenderer({ canvas, antialias: true });
	renderer.setClearColor(new Color('#0d0d0f'), 1);

	const controls = new OrbitControls(camera, canvas);
	controls.enableDamping = true;
	controls.dampingFactor = 0.08;
	controls.enablePan = false;
	controls.enableZoom = false;
	controls.rotateSpeed = 0.9;

	/** 해제할 geometry 를 한곳에 모은다. `dispose()` 에서 빠뜨리면 재진입마다 쌓인다. */
	const geometries: { dispose(): void }[] = [];
	const boxGeometry = new BoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE);
	geometries.push(boxGeometry);
	/** 테두리 geometry 는 크기별로 두 개면 된다 — 공유가 금지된 것은 material 이다. */
	const outlineGeometries = OUTLINE_SCALE.map((s) => {
		const plane = new PlaneGeometry(CUBIE_SIZE * s, CUBIE_SIZE * s);
		const edges = new EdgesGeometry(plane);
		plane.dispose();
		geometries.push(edges);
		return edges;
	});

	/** 큐비 좌표 → 면별 material 6개. 큐비마다 **새로** 만든다 (캐시 금지). */
	const cubies = new Map<string, MeshBasicMaterial[]>();
	const cubieGroups = new Map<string, Group>();
	for (const coord of cubieCoords()) {
		const materials = FACE_NORMAL.map(() => new MeshBasicMaterial({ color: PLASTIC }));
		const mesh = new Mesh(boxGeometry, materials);
		const group = new Group();
		group.position.set(coord[0] * CUBIE_STEP, coord[1] * CUBIE_STEP, coord[2] * CUBIE_STEP);
		group.add(mesh);
		scene.add(group);
		cubies.set(cubieKey(coord), materials);
		cubieGroups.set(cubieKey(coord), group);
	}

	/** facelet 인덱스 → 그 칸의 material 과 테두리. 54칸 전부 미리 만들어둔다. */
	const stickers: Sticker[] = [];
	for (let i = 0; i < 54; i++) {
		const { cubie, face } = faceletToCubie(i);
		const key = cubieKey(cubie);
		const materials = cubies.get(key)!;
		const group = cubieGroups.get(key)!;
		const normal = FACE_NORMAL[face as FaceIndex];
		const lift = CUBIE_SIZE / 2 + OUTLINE_LIFT;
		const outlines = outlineGeometries.map((geometry) => {
			const line = new LineSegments(geometry, new LineDashedMaterial({ color: 0xffffff }));
			line.position.set(normal[0] * lift, normal[1] * lift, normal[2] * lift);
			line.rotation.set(...FACE_ROTATION[face]);
			line.computeLineDistances();
			line.visible = false;
			group.add(line);
			return line;
		});
		stickers.push({ material: materials[face], outlines });
	}

	function setFacelets(colors: string[]): void {
		assertFacelets(colors);
		for (let i = 0; i < 54; i++) stickers[i].material.color.set(colors[i]);
	}

	/**
	 * 색과 **테두리** 로 이중 부호화한다 (FR-TR-16). 테두리 굵기는 WebGL 에서
	 * 1px 로 고정이라 굵기로는 못 나눈다 — 그래서 실선 / 파선 / 이중선으로 나눈다.
	 */
	function setHighlights(marks: (Mark | null)[]): void {
		assertMarks(marks);
		for (let i = 0; i < 54; i++) {
			const mark = marks[i];
			const [outer, inner] = stickers[i].outlines;
			if (!mark) {
				outer.visible = false;
				inner.visible = false;
				continue;
			}
			for (const line of [outer, inner]) line.material.color.set(mark.color);
			// gapSize 0 이면 파선 셰이더가 아무것도 버리지 않아 실선이 된다.
			outer.material.gapSize = mark.outline === 'dashed' ? 0.06 : 0;
			outer.material.dashSize = 0.09;
			outer.visible = true;
			inner.visible = mark.outline === 'double';
			inner.material.gapSize = 0;
			inner.material.dashSize = 0.09;
		}
	}

	function setOrientation(index: number): void {
		const { position, up } = orientationOf(index);
		const norm = Math.sqrt(3);
		camera.up.set(up[0], up[1], up[2]);
		camera.position.set(
			(position[0] / norm) * CAMERA_DISTANCE,
			(position[1] / norm) * CAMERA_DISTANCE,
			(position[2] / norm) * CAMERA_DISTANCE
		);
		controls.update();
	}

	function resize(): void {
		const w = canvas.clientWidth || 1;
		const h = canvas.clientHeight || 1;
		renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2));
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
	}

	let frame = 0;
	const loop = () => {
		frame = requestAnimationFrame(loop);
		controls.update();
		renderer.render(scene, camera);
	};

	function dispose(): void {
		cancelAnimationFrame(frame);
		frame = 0;
		controls.dispose();
		for (const materials of cubies.values()) for (const m of materials) m.dispose();
		for (const sticker of stickers) for (const line of sticker.outlines) line.material.dispose();
		for (const g of geometries) g.dispose();
		scene.clear();
		renderer.dispose();
	}

	setOrientation(0);
	resize();
	loop();
	return { setFacelets, setHighlights, setOrientation, resize, dispose };
}
