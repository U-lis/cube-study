/**
 * M2 엣지 (#17) — 순수부.
 *
 * 조회(`/3x3/bld/m2/edge/lookup`)와 퀴즈(`/3x3/bld/m2/edge/quiz`)가 쓰는 계산을 모은다.
 * Svelte 를 import 하지 않는다 (`memorize.ts` 와 같은 규칙).
 *
 * ─── 데이터가 정하고 코드는 따라간다 ─────────────────────────
 * 홀짝(짝수 번째 C 는 W 의 공식)도 코드가 짝을 찾아 바꾸지 않는다. 데이터가 짝수 번째
 * 줄을 따로 적는다 (SPEC FR-M2-D-5). 코드는 줄을 읽어 보여주고 효과로 채점할 뿐이다.
 * ────────────────────────────────────────────────────────────
 */
import { faceletsOf } from '../cube/sim.js';
import type { AlgPart } from './format.js';
import type { Cubie, Face, Sticker } from './types.js';

/** 데이터 파일의 한 행. 짝수 번째 줄은 id 에 `2` 를 붙여 따로 들어 있다. */
export interface M2Row {
	/** 줄 이름. 암기 체크의 키다. 짝수 번째 줄은 `c2` 처럼 붙인다 */
	id: string;
	/** Speffz 엣지 문자 (소문자, `speffz.ts` 의 키) */
	letter: Sticker;
	piece: Cubie;
	face: Face;
	/** 짝이 버퍼인 A·Q 는 순번과 무관하므로 null. */
	order: 'odd' | 'even' | null;
	alg: string;
	/** 화면 표기. 반복을 `(U' M')×3` 으로 묶은 것. 없으면 `alg` 그대로 보인다. 펼치면 `alg` 와 같아야 한다 (테스트) */
	display?: string;
}

export interface M2DataSet {
	meta: {
		method: string;
		pieceType: 'edge';
		buffer: Cubie;
		bufferStickers: Sticker[];
		swapSticker: Sticker;
		parityNote: string;
		source: string;
	};
	rows: M2Row[];
	parity: { id: string; alg: string };
}

/**
 * 표와 퀴즈의 한 칸. 패리티도 하나의 항목이다 (SPEC D-3).
 *
 * `letter` 는 화면 표시용 대문자. 내부 식별은 `id` 를 쓴다 (`c` 와 `c2` 처럼 짝수 번째가 다르다).
 * `place` 는 셋업으로 가져올 스티커 (`${piece} 의 ${face} 면`, 패리티는 `UB↔UL 교환`).
 * `order` 는 데이터가 적은 그대로다 — 코드가 null 을 odd 로 바꾸지 않는다 (A·Q 처럼
 * 짝이 버퍼인 줄은 M 슬라이스 공식이 아니라 순번과 무관하다).
 */
export interface M2Item {
	id: string;
	letter: string;
	place: string;
	order: 'odd' | 'even' | 'parity' | null;
	alg: string;
	/** 화면 표기 (`M2Row.display`, 없으면 `alg`). 채점은 `alg` 로 한다 */
	display: string;
}

/** 패리티 자리 표시. 1506판 확인(SPEC FR-M2-D-6)에 따라 UB↔UL 교환만 남는다. */
const PARITY_PLACE = 'UB↔UL 교환';

/** 데이터 순서 그대로. 마지막에 패리티 하나. 총 27개 (SPEC §2). */
export function itemsOf(ds: M2DataSet): M2Item[] {
	const items: M2Item[] = ds.rows.map((row) => ({
		id: row.id,
		letter: row.letter.toUpperCase(),
		place: `${row.piece} 의 ${row.face} 면`,
		order: row.order,
		alg: row.alg,
		display: row.display ?? row.alg
	}));
	items.push({
		id: ds.parity.id,
		letter: '',
		place: PARITY_PLACE,
		order: 'parity',
		alg: ds.parity.alg,
		display: ds.parity.alg
	});
	return items;
}

/** `(무브열)×n` 한 덩어리, 또는 괄호 밖 무브열. */
const GROUP = /\(([^()]*)\)×(\d+)|[^()]+/g;

/** 화면 표기를 Alg 파트로. 괄호와 `)×n` 은 punct, 무브는 plain. */
export function displayParts(display: string): AlgPart[] {
	const parts: AlgPart[] = [];
	for (const m of display.matchAll(GROUP)) {
		if (m[1] !== undefined) {
			parts.push({ text: '(', role: 'punct' }, { text: m[1].trim(), role: 'plain' }, { text: `)×${m[2]}`, role: 'punct' });
		} else if (m[0].trim()) {
			parts.push({ text: m[0].trim(), role: 'plain' });
		}
	}
	return parts;
}

/** 화면 표기의 반복을 펼친 무브열. 데이터 검사용 — 화면은 `alg` 를 쓴다. */
export function expandDisplay(display: string): string {
	const out: string[] = [];
	for (const m of display.matchAll(GROUP)) {
		const moves = (m[1] ?? m[0]).trim().split(/\s+/).filter(Boolean);
		const n = m[1] !== undefined ? Number(m[2]) : 1;
		for (let i = 0; i < n; i++) out.push(...moves);
	}
	return out.join(' ');
}

export type M2Verdict =
	| { kind: 'correct' }
	| { kind: 'other'; label: string }
	| { kind: 'identity' }
	| { kind: 'wrong' }
	| { kind: 'invalid-move'; move: string };

const SOLVED = faceletsOf('');

/**
 * 판정 문구에 쓰는 짧은 이름. `C (홀수 번째)`, `C (짝수 번째)`, `패리티`,
 * 그 외는 그냥 문자 (`A`).
 *
 * `other` 라벨에 쓴다 — 같은 효과의 공식이라면 어느 줄인지 알려준다.
 */
export function labelOf(item: M2Item): string {
	if (item.order === 'parity') return '패리티';
	if (item.order === 'even') return `${item.letter} (짝수 번째)`;
	if (item.order === 'odd') return `${item.letter} (홀수 번째)`;
	return item.letter;
}

/**
 * 채점. 54칸 상태가 데이터의 공식과 같으면 정답이다 (SPEC FR-M2-Q-3, AD-2).
 *
 * 1. 미지 무브가 있으면 `invalid-move`.
 * 2. 타깃의 상태와 같으면 `correct` — 같은 효과의 다른 공식도 맞다.
 * 3. 바뀐 것이 없으면 `identity` (빈 문자열 포함).
 * 4. 다른 줄과 같으면 `other` — 처음 발견한 줄의 라벨을 돌려준다.
 * 5. 그 외는 `wrong`.
 */
export function gradeM2(
	enteredAlg: string,
	targetAlg: string,
	allItems: readonly M2Item[]
): M2Verdict {
	let got: string;
	try {
		got = faceletsOf(enteredAlg);
	} catch (e) {
		const m = /Unknown move: (\S+)/.exec((e as Error).message);
		return { kind: 'invalid-move', move: m ? m[1] : '?' };
	}
	if (got === faceletsOf(targetAlg)) return { kind: 'correct' };
	if (got === SOLVED) return { kind: 'identity' };
	for (const it of allItems) {
		if (faceletsOf(it.alg) === got) return { kind: 'other', label: labelOf(it) };
	}
	return { kind: 'wrong' };
}

/** 판정 문구. 사실만 적는다 (NFR-9). */
export function m2VerdictText(v: M2Verdict): string {
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
 * 암기 체크 저장 (SPEC FR-M2-L-3). 코너의 `memorize.checked` 와 키가 다르다.
 * 형태가 어긋나면 조용히 빈 상태다 — 이 함수가 던지면 화면이 안 뜬다 (`memorize.ts` 와 같다).
 */
const SCHEMA_VERSION = 1;

export function parseM2Checked(raw: string | null): Set<string> {
	if (!raw) return new Set();
	try {
		const v = JSON.parse(raw) as { schemaVersion?: unknown; checked?: unknown };
		if (v?.schemaVersion !== SCHEMA_VERSION || !Array.isArray(v.checked)) return new Set();
		return new Set(v.checked.filter((x): x is string => typeof x === 'string'));
	} catch {
		return new Set();
	}
}

export function serializeM2Checked(checked: ReadonlySet<string>): string {
	return JSON.stringify({ schemaVersion: SCHEMA_VERSION, checked: [...checked].sort() });
}
