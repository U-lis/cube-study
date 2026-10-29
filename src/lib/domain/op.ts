/**
 * OP 코너 (#18) — 순수부.
 *
 * 조회(`/3x3/bld/op/corner/lookup`)와 퀴즈(`/3x3/bld/op/corner/quiz`)가 쓰는 계산을 모은다.
 * Svelte 를 import 하지 않는다 (`m2.ts` 와 같은 규칙).
 *
 * ─── 데이터가 정하고 코드는 따라간다 ─────────────────────────
 * setup 은 데이터가 적는다 — 코드가 setup 을 만들거나 고치지 않는다
 * (SPEC FR-OP-D-2). 역 setup 은 `invertAlg` 로 계산한다 (GLOBAL AD-3).
 * `[Y]` 는 채점 시점에 `meta.yPerm` 으로 펼친다 (GLOBAL AD-1). 저장소에 Y-perm
 * 15수를 하드코딩하지 않는다.
 * ────────────────────────────────────────────────────────────
 */
import { faceletsOf } from '../cube/sim.js';
import { invertAlg } from '../cube/notation.js';
import { CORNER_CUBIE } from '../cube/speffz.js';
import type { AlgPart } from './format.js';
import type { Cubie, Sticker } from './types.js';

/** 데이터 파일의 한 행. Y 행만 `isYRow: true`. */
export interface OpRow {
	/** 줄 이름. 암기 체크의 키다. Y 행은 `'y'`. */
	id: string;
	/** 표시 문자 대문자 (예: `'B'`). Y 행은 `'Y'`. */
	letter: string;
	/** 데이터의 setup 문자열. P 행과 Y 행은 빈 문자열. */
	setup: string;
	/** Y-perm 자체를 공식으로 다루는 행. P 행과 다르다 (P 는 setup 이 비었을 뿐 공식은 `[Y]`). */
	isYRow?: boolean;
}

export interface OpDataSet {
	meta: {
		method: string;
		pieceType: 'corner';
		buffer: Cubie;
		bufferStickers: Sticker[];
		swapPiece: Cubie;
		swapSticker: Sticker;
		/** `[Y]` 를 펼칠 때 쓰는 15수 Y-perm 문자열. 코드가 하드코딩하지 않는다 (AD-1). */
		yPerm: string;
		source: string;
	};
	rows: OpRow[];
}

/**
 * 표와 퀴즈의 한 칸. Y 행도 하나의 항목이다 (SPEC D-3).
 *
 * `letter` 는 화면 표시용 대문자. `piece` 는 교환 자리 (`UBL↔{타깃 코너}`).
 * Y 행과 P 행은 piece 가 `UBL↔DFR` 로 같다 — P 는 이미 DFR 자리에 있는 코너라
 * `[Y]` 하나로 교환된다.
 * `alg` 는 완성된 공식 (`setup [Y] setup'`). 채점은 `expandY(alg)` 를 쓴다.
 */
export interface OpItem {
	id: string;
	letter: string;
	piece: string;
	setup: string;
	isYRow: boolean;
	alg: string;
}

export type OpVerdict =
	| { kind: 'correct' }
	| { kind: 'other'; label: string }
	| { kind: 'identity' }
	| { kind: 'wrong' }
	| { kind: 'invalid-move'; move: string };

/**
 * 알고리즘 안의 `[Y]` 토큰을 모두 `yPerm` 으로 치환한다 (AD-1).
 *
 * `[Y]` 는 자판의 단일 토큰이므로 — 채점 전까지 15수로 펼치지 않는다.
 * `[Y]` 가 없는 문자열은 그대로 반환한다.
 */
export function expandY(alg: string, yPerm: string): string {
	return alg.split('[Y]').join(yPerm);
}

/**
 * 데이터 순서 그대로. Y 행이 첫 행 (`isYRow: true`). 총 22개 (SPEC §2).
 *
 * `alg` 는 데이터의 setup 과 그 역을 조립한 문자열이다:
 *   - Y 행: `yPerm` 그대로 — `[Y]` 자체를 외우게 하는 줄 (SPEC D-3).
 *   - setup 이 빈 행 (P): `yPerm` 그대로 — 공식이 `[Y]` 단독.
 *   - 그 외: `${setup} [Y] ${invertAlg(setup)}`.
 */
export function itemsOf(ds: OpDataSet): OpItem[] {
	const { buffer, swapPiece, yPerm } = ds.meta;
	return ds.rows.map((row) => {
		const isYRow = row.isYRow === true;
		const targetCubie = isYRow ? swapPiece : CORNER_CUBIE[row.letter];
		const piece = `${buffer}↔${targetCubie}`;
		let alg: string;
		if (isYRow || row.setup === '') {
			alg = yPerm;
		} else {
			alg = `${row.setup} [Y] ${invertAlg(row.setup)}`;
		}
		return {
			id: row.id,
			letter: row.letter,
			piece,
			setup: row.setup,
			isYRow,
			alg
		};
	});
}

/**
 * 화면 표기의 파트. `[Y]` 는 anchor 역할(통째로 렌더), setup 과 역 setup 은 plain
 * (낱글자로 쪼갠다) 이다 (AD-2). setup 이 비었으면 `[Y]` 하나뿐이다.
 *
 * `yPerm` 은 `displayPartsOf` 의 서명 유지용이다 — anchor 는 통째로 렌더되므로
 * 15수를 여기서 펼치지 않는다. 서명을 두면 호출부가 yPerm 을 안 들고 있어도 되고,
 * 나중에 "펼친 모양을 함께 보이기" 같은 분기를 넣을 자리가 생긴다.
 */
export function displayPartsOf(
	item: OpItem,
	_yPerm: string
): AlgPart[] {
	if (item.setup === '') {
		return [{ text: '[Y]', role: 'anchor' }];
	}
	return [
		{ text: item.setup, role: 'plain' },
		{ text: '[Y]', role: 'anchor' },
		{ text: invertAlg(item.setup), role: 'plain' }
	];
}

const SOLVED = faceletsOf('');

/**
 * 채점. `expandY` 로 `[Y]` 를 펼친 뒤 54칸 상태를 비교한다 (SPEC FR-OP-Q-3, AD-5).
 *
 * 1. 미지 무브가 있으면 `invalid-move`.
 * 2. 타깃의 상태와 같으면 `correct` — 같은 효과의 다른 공식도 맞다.
 * 3. 바뀐 것이 없으면 `identity` (빈 문자열 포함).
 * 4. 다른 줄과 같으면 `other` — 처음 발견한 줄의 letter 를 돌려준다.
 * 5. 그 외는 `wrong`.
 */
export function gradeOp(
	entered: string,
	item: OpItem,
	allItems: readonly OpItem[],
	yPerm: string
): OpVerdict {
	let got: string;
	try {
		got = faceletsOf(expandY(entered, yPerm));
	} catch (e) {
		const m = /Unknown move: (\S+)/.exec((e as Error).message);
		return { kind: 'invalid-move', move: m ? m[1] : '?' };
	}
	const targetFacelets = faceletsOf(expandY(item.alg, yPerm));
	if (got === targetFacelets) return { kind: 'correct' };
	if (got === SOLVED) return { kind: 'identity' };
	for (const it of allItems) {
		if (faceletsOf(expandY(it.alg, yPerm)) === got) {
			return { kind: 'other', label: it.letter };
		}
	}
	return { kind: 'wrong' };
}

/** 판정 문구. 사실만 적는다 (NFR-9). M2 와 평행 (`m2VerdictText`). */
export function opVerdictText(v: OpVerdict): string {
	switch (v.kind) {
		case 'correct':
			return '정답';
		case 'other':
			return `${v.label} 의 공식입니다`;
		case 'identity':
			return '큐브가 바뀌지 않았습니다';
		case 'wrong':
			return '이 세트의 어느 공식과도 효과가 다릅니다';
		case 'invalid-move':
			return `알 수 없는 무브: ${v.move}`;
	}
}

/*
 * 암기 체크 저장 (SPEC FR-OP-L-4). 코너 3-style (`memorize.checked`) · M2
 * (`m2.checked`) 와 키가 다르다 (AD-7). 형태가 어긋나면 조용히 빈 상태다
 * — 이 함수가 던지면 화면이 안 뜬다 (`m2.ts` 와 같다).
 */
const SCHEMA_VERSION = 1;

export function parseOpChecked(raw: string | null): Set<string> {
	if (!raw) return new Set();
	try {
		const v = JSON.parse(raw) as { schemaVersion?: unknown; checked?: unknown };
		if (v?.schemaVersion !== SCHEMA_VERSION || !Array.isArray(v.checked)) return new Set();
		return new Set(v.checked.filter((x): x is string => typeof x === 'string'));
	} catch {
		return new Set();
	}
}

export function serializeOpChecked(checked: ReadonlySet<string>): string {
	return JSON.stringify({ schemaVersion: SCHEMA_VERSION, checked: [...checked].sort() });
}
