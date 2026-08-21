/**
 * 트레이싱 세션 도메인 — 채점 결과의 문구, 관례 비교, 기록 파싱·직렬화.
 *
 * ─── 이 파일이 하지 않는 것 ─────────────────────────────────
 * 채점을 다시 구현하지 않는다. 판정은 `cube/trace.ts` 의 실행 모델 하나뿐이고
 * 여기는 그 결과를 **표현** 으로 옮기는 층이다. 정답 문자열을 만들어 비교하는
 * 코드가 여기 생기면 "정답이 평균 11가지" 라는 전제가 조용히 깨진다 (AD-7).
 *
 * 화면 프레임워크·저장소 API 를 import 하지 않는다. `memorize.ts` 와 같은 규율이며,
 * 그래야 데이터가 바뀔 때의 회귀를 단위 테스트가 잡는다.
 * ────────────────────────────────────────────────────────────
 *
 * ─── 버퍼는 데이터에서만 온다 (FR-TR-7) ─────────────────────
 * `optionsFrom` 이 이 저장소에서 버퍼 정보가 코드로 넘어오는 **유일한 경계** 이고,
 * 그것도 리터럴이 아니라 `DatasetMeta` 의 필드다. 이 파일에 버퍼 문자를 적는 순간
 * "데이터만 갈아끼워 다른 버퍼를 지원한다" 가 끝난다.
 * ────────────────────────────────────────────────────────────
 */

import type { Cubie, DatasetMeta, Sticker } from './types.js';
import {
	cubieOf,
	lettersOf,
	rotationOf,
	CORNER_INDEX,
	EDGE_INDEX,
	type PieceKind
} from '../cube/speffz.js';
import type { CubeState } from '../cube/sim.js';
import type { Mark } from '../cube/cube3d-map.js';
import { trace, type TraceOptions, type TraceVerdict, type TwistConvention } from '../cube/trace.js';

export type { TwistConvention };

/** 훈련 대상 (FR-TR-19). `both` 는 한 스크램블에서 코너 뒤에 엣지를 이어서 한다. */
export type TrainKind = 'corner' | 'edge' | 'both';

/** 훈련 모드 (FR-TR-21). 차이는 입력 시점에 큐브를 보여주는지 여부뿐이다. */
export type TrainMode = 'follow' | 'memorize';

/**
 * 한 판의 기록. 필드가 8개이고 SPEC 이 이것을 고정했다 (제약, AD-13).
 *
 * `at` 은 표시용 시각이라 벽시계이고, `ms` 는 측정값이라 단조 시계다 (FR-TR-23).
 * 둘을 한 시계로 합치지 않는다 — 시스템 시계가 조정되면 측정이 음수가 된다.
 *
 * 솔브 레코드·약점 통계·추이 그래프는 이번 범위 밖이다(#23). 필드를 늘리고 싶어지면
 * 그것은 스키마 v2 마이그레이션이며, 여기서 슬쩍 늘리면 쌓인 기록이 위태로워진다.
 */
export interface TraceRecord {
	/** 벽시계 시각. 표시 전용 — 측정에 쓰지 않는다. */
	at: number;
	/** 소요 시간. 단조 시계의 차이다. */
	ms: number;
	pieceKind: PieceKind;
	/** `meta.buffer`. 같은 스크램블도 버퍼가 다르면 정답이 다르다. */
	buffer: Cubie;
	mode: TrainMode;
	/** 관례가 타깃 수를 평균 2.4개 바꾼다. 없으면 기록끼리 비교가 성립하지 않는다. */
	twistConvention: TwistConvention;
	targetCount: number;
	correct: boolean;
}

/** 저장 표현. */
export interface TraceRecordsStored {
	schemaVersion: number;
	records: TraceRecord[];
}

/**
 * 보관 상한. 기록이 무한히 쌓이면 저장소 한도(5MB)에 언젠가 닿고, 그 실패는
 * 저장하는 쪽이 아니라 **다음 저장 전체** 를 막는 형태로 나타난다.
 */
export const RECORD_LIMIT = 50;

/**
 * 기록 스키마 버전. 암기 체크(`memorize.ts`)의 것과 **독립** 이다.
 *
 * 그쪽 파서는 버전 불일치 시 저장물을 전부 버린다. 같은 키에 얹으면 트레이싱
 * 스키마를 올리는 순간 암기 진도가 통째로 날아간다 (AD-13). 두 상수와 두 키가
 * 서로를 모르는 것이 이 분리의 전부다.
 */
export const RECORDS_SCHEMA_VERSION = 1;

/** 기록 저장 키. 암기 체크의 키와 다르다 — 위 주석 참조. */
export const RECORDS_KEY = 'trace.records';

/**
 * 값의 집합을 **객체의 키** 로 둔다.
 *
 * 유효값 검사와 화면의 라벨이 한 표에서 나온다. 두 곳에 나눠 적으면 값을 늘릴 때
 * 한쪽만 고치게 되고, 그 사고는 "저장된 설정이 조용히 기본값으로 되돌아간다" 는
 * 형태로 나타나 눈에 잘 안 띈다.
 *
 * 키로 두는 데는 이유가 하나 더 있다 — 관례 이름 `A` 를 따옴표로 적으면 버퍼
 * 스티커 리터럴 금지(FR-TR-7)의 정적 검사에 걸린다. 관례 이름이지 스티커가
 * 아니지만, 검사를 사람의 판단으로 무르지 않는 편이 낫다.
 */
export const CONVENTIONS = {
	A: '비틀림도 끊어 들어가 타깃 열에 넣습니다',
	B: '비틀림을 타깃 열에서 빼고 따로 적습니다'
} satisfies Record<TwistConvention, string>;

export const TRAIN_KINDS = {
	corner: '코너만',
	edge: '엣지만',
	both: '코너 → 엣지'
} satisfies Record<TrainKind, string>;

export const TRAIN_MODES = {
	follow: '큐브를 보면서 하나씩 입력합니다',
	memorize: '다 외운 뒤 큐브 없이 입력합니다'
} satisfies Record<TrainMode, string>;

/** 저장된 값이 지금 코드가 아는 값인가. 낡은 저장물이 화면까지 흘러가는 것을 막는다. */
export const isTwistConvention = (v: unknown): v is TwistConvention =>
	typeof v === 'string' && v in CONVENTIONS;

export const isTrainKind = (v: unknown): v is TrainKind =>
	typeof v === 'string' && v in TRAIN_KINDS;

export const isTrainMode = (v: unknown): v is TrainMode =>
	typeof v === 'string' && v in TRAIN_MODES;

/**
 * 엔진이 버퍼에 대해 알아야 하는 전부.
 *
 * `DatasetMeta` 를 통째로 받지 않는 이유는 엣지다 — 엣지 데이터셋(#16)이 아직
 * 없어서 `meta` 가 없고, 그때 화면이 넘기는 것은 이 두 필드뿐이다. 좁게 받으면
 * 데이터가 생겼을 때 호출부만 바뀐다.
 */
export type BufferMeta = Pick<DatasetMeta, 'bufferStickers' | 'primarySticker'>;

/**
 * 데이터셋 `meta` 에서 엔진 옵션을 만든다 (FR-TR-7).
 *
 * 엔진은 버퍼를 모르고, 이 함수는 버퍼를 만들어내지 않는다. 데이터가 정하고
 * 코드는 나른다.
 */
export function optionsFrom(
	meta: BufferMeta,
	pieceKind: PieceKind,
	twistConvention: TwistConvention
): TraceOptions {
	return {
		pieceKind,
		bufferStickers: meta.bufferStickers,
		primarySticker: meta.primarySticker,
		twistConvention
	};
}

/**
 * 같은 상태를 두 관례로 트레이싱한 타깃 수 (FR-TR-24).
 *
 * 결과 화면이 "지금 관례로는 N개, 다른 관례로는 M개" 를 함께 보여준다. 3-style 로
 * 넘어갈 때의 이득이 숫자로 보이는 자리다.
 *
 * 관례 A 쪽은 옵션을 `undefined` 로 지운다. 엔진의 기본이 A 이므로 결과가 같고,
 * 이 파일에 스티커로 읽힐 수 있는 따옴표 문자를 남기지 않는다 (FR-TR-7 정적 검사).
 */
export function conventionCompare(
	state: CubeState,
	opts: TraceOptions
): { a: number; b: number } {
	return {
		a: trace(state, { ...opts, twistConvention: undefined }).targets.length,
		b: trace(state, { ...opts, twistConvention: 'B' }).targets.length
	};
}

/**
 * 판정 문구. **사실만 적는다** (NFR-TR-5, 기존 NFR-9).
 *
 * 축하·연속 정답·배지·점수 표현을 쓰지 않는다. 틀린 이유를 짚는 것이 이 화면의
 * 일이고, 기분을 만드는 것은 아니다.
 *
 * 인덱스는 **1부터** 센다. 엔진은 0부터 세지만 사용자는 "세 번째 타깃" 이라고
 * 말한다. 변환은 이 함수 한 곳에서만 일어난다.
 */
export function verdictText(v: TraceVerdict): string {
	switch (v.kind) {
		case 'correct':
			return '정답';
		case 'correct-extra':
			return `풀립니다. 불필요한 끊기가 ${v.extra}회 있습니다`;
		case 'wrong-at':
			return `${v.index + 1}번째 타깃 — ${WRONG_REASON[v.reason]}`;
		case 'incomplete':
			return `아직 ${v.remaining.length}개 조각이 남았습니다`;
		case 'twist-mismatch':
			return `비틀림 선언이 다릅니다 — 빠짐 ${listText(v.missing)}, 없는 것 ${listText(v.unexpected)}`;
		case 'invalid-letter':
			return `${v.index + 1}번째 문자가 이 세션의 조각 종류가 아닙니다: ${v.letter}`;
	}
	/*
	 * 여기 닿으면 Verdict 종류가 늘었는데 문구를 안 적은 것이다. 값이 `never` 라
	 * 새 종류를 추가하는 순간 **컴파일이** 막힌다 — 실행 시점의 빈 문자열로
	 * 밀려나지 않는다.
	 */
	const missed: never = v;
	throw new Error(`문구가 없는 판정: ${JSON.stringify(missed)}`);
}

const WRONG_REASON = {
	'wrong-orientation': '조각은 맞지만 방향이 다릅니다',
	'wrong-piece': '다른 조각입니다',
	'already-solved': '이미 해결된 조각으로 끊었습니다',
	'buffer-sticker': '버퍼 스티커는 타깃이 될 수 없습니다'
} as const;

/** 빈 목록을 빈 칸으로 두면 문장이 끊긴다. */
const listText = (xs: Sticker[]): string => (xs.length === 0 ? '없음' : xs.join(' '));

/**
 * 저장 원문을 안전하게 읽는다.
 *
 * 깨진 JSON·스키마 불일치·형태 이상을 전부 빈 배열로 되돌린다. 이 함수가 던지면
 * 화면이 아니라 **앱 기동** 이 막힌다 (`memorize.ts` 의 `parseStored` 와 같은 이유).
 *
 * 항목 단위로 버린다. 한 항목이 상한 밖 필드를 잃었다고 나머지 49건을 같이 버릴
 * 이유가 없다 — 사용자가 잃는 것이 더 크다.
 */
export function parseRecords(raw: string | null): TraceRecord[] {
	if (raw == null || raw === '') return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return [];
	}
	if (typeof parsed !== 'object' || parsed === null) return [];
	const o = parsed as Record<string, unknown>;
	if (o.schemaVersion !== RECORDS_SCHEMA_VERSION) return [];
	if (!Array.isArray(o.records)) return [];
	return o.records.filter(isRecord).slice(0, RECORD_LIMIT);
}

/**
 * 기록 한 건의 형태 판정. 8개 필드를 전부 본다.
 *
 * `pieceKind` / `mode` / `twistConvention` 은 값의 집합까지 확인한다. 문자열이기만
 * 하면 통과시키면, 낡은 저장물의 모르는 값이 화면까지 흘러가 필터·집계에서
 * 조용히 빠진다.
 */
function isRecord(v: unknown): v is TraceRecord {
	if (typeof v !== 'object' || v === null) return false;
	const r = v as Record<string, unknown>;
	return (
		typeof r.at === 'number' &&
		typeof r.ms === 'number' &&
		isPieceKind(r.pieceKind) &&
		typeof r.buffer === 'string' &&
		r.buffer !== '' &&
		isTrainMode(r.mode) &&
		isTwistConvention(r.twistConvention) &&
		typeof r.targetCount === 'number' &&
		typeof r.correct === 'boolean'
	);
}

/** 조각 종류. `TrainKind` 의 `both` 는 기록 단위가 아니다 — 기록은 종류별로 남는다. */
const isPieceKind = (v: unknown): v is PieceKind => v === 'corner' || v === 'edge';

/** 상한을 적용해 직렬화한다. 자르는 지점을 저장 경로 하나로 모은다. */
export function serializeRecords(rs: TraceRecord[]): string {
	const stored: TraceRecordsStored = {
		schemaVersion: RECORDS_SCHEMA_VERSION,
		records: rs.slice(0, RECORD_LIMIT)
	};
	return JSON.stringify(stored);
}

/**
 * 최근 것이 앞. 상한을 넘으면 **오래된 것부터** 버린다.
 *
 * 새 배열을 낸다 — 제자리에서 밀어넣으면 반응성 저장소가 변화를 못 본다.
 */
export function pushRecord(rs: TraceRecord[], r: TraceRecord): TraceRecord[] {
	return [r, ...rs].slice(0, RECORD_LIMIT);
}

/**
 * 소요 시간 표기. `84210 → "1:24.21"`.
 *
 * 1분 미만이면 분을 적지 않는다. 대부분의 판이 거기 들어가는데 `0:42.10` 은
 * 읽는 자리를 하나 늘릴 뿐이다. 1분을 넘기면 초를 두 자리로 채워 자릿수가 흔들리지
 * 않게 한다 — 표에서 숫자가 좌우로 뛰면 비교가 안 된다.
 */
export function formatMs(ms: number): string {
	const total = Math.max(0, Math.floor(ms));
	const cs = Math.floor((total % 1000) / 10);
	const sec = Math.floor(total / 1000) % 60;
	const min = Math.floor(total / 60000);
	const frac = `${String(cs).padStart(2, '0')}`;
	if (min === 0) return `${sec}.${frac}`;
	return `${min}:${String(sec).padStart(2, '0')}.${frac}`;
}

/* ═══════════════════════════════════════════════════════════
 * Phase 4 — 입력 정리
 * ═══════════════════════════════════════════════════════════ */

/**
 * 입력 문자열을 이 세션의 타깃 열로 정리한다 (FR-TR-18).
 *
 * 온스크린 패드와 하드웨어 키보드가 **같은 규칙** 을 지나야 한다. 두 경로가
 * 각자 정리하면 "패드로는 막히는데 키보드로는 들어가는" 문자가 생기고, 그 차이는
 * 채점 결과로만 드러나 원인을 찾기 어렵다. 그래서 규칙을 여기 하나로 모은다.
 *
 * - 코너는 대문자, 엣지는 소문자로 맞춘다. 대소문자를 틀린 것은 다른 조각을
 *   지목한 것이 아니다 — 이번 판의 조각 종류가 이미 정해져 있다.
 * - 알파벳이 아닌 문자(공백·쉼표·줄바꿈)는 구분자로 보고 버린다.
 * - `blocked` 문자는 받지 않는다. 타깃 구획의 버퍼 스티커가 이 경우다.
 *   비틀림 구획에는 걸지 않는다 — 버퍼가 비틀린 채 남는 경우가 코너 80.9% 라
 *   막으면 관례 B 훈련이 성립하지 않는다 (FR-TR-24).
 * - `max` 를 넘으면 자른다. 붙여넣기 한 번으로 화면이 굳는 것을 막는다.
 */
export function sanitizeEntry(
	text: string,
	kind: PieceKind,
	options: { blocked?: readonly Sticker[]; max: number }
): Sticker[] {
	const blocked = new Set(options.blocked ?? []);
	const cased = kind === 'edge' ? text.toLowerCase() : text.toUpperCase();
	const allowed = new Set(lettersOf(kind));
	const out: Sticker[] = [];
	for (const ch of cased) {
		if (out.length >= options.max) break;
		if (!allowed.has(ch) || blocked.has(ch)) continue;
		out.push(ch);
	}
	return out;
}

/**
 * 비틀림 목록에 버퍼가 섞였는지 표시한다 (FR-TR-24, AD-8).
 *
 * "왜 이게 목록에 있는가" 는 관례 B 를 처음 보면 반드시 나오는 질문이다. 방향
 * 합이 보존되므로 다른 조각의 비틀림을 남기면 버퍼가 그 보정을 떠안는다 —
 * 그 사실이 학습에 직결되므로 결과 화면이 버퍼임을 따로 밝힌다.
 */
export function twistEntries(
	twists: readonly Sticker[],
	kind: PieceKind,
	buffer: Cubie
): { letter: Sticker; isBuffer: boolean }[] {
	const cubie = cubieOf(kind);
	return twists.map((letter) => ({ letter, isBuffer: cubie[letter] === buffer }));
}

/* ═══════════════════════════════════════════════════════════
 * Phase 5 — 하이라이트
 * ═══════════════════════════════════════════════════════════ */

/**
 * 세 갈래 강조의 색·테두리 (FR-TR-16).
 *
 * 팔레트를 **화면이 아니라 여기** 에 둔다. 뷰어는 "무슨 색을 어디에" 만 받고
 * (AD-12), 무엇을 칠할지는 이 층이 정하기 때문이다.
 */
export interface MarkPalette {
	buffer: Mark;
	current: Mark;
	visited: Mark;
}

/**
 * 기본 팔레트.
 *
 * 색은 스티커 6색(`meta.colorScheme` 이 지목하는 흰·노랑·초록·파랑·빨강·주황)과
 * **겹치지 않는** 값이어야 한다. 스티커 색과 비슷하면 강조가 색칠로 읽힌다.
 * 그래서 큐브에 없는 계열 — 청록·자홍·연보라 — 을 쓴다.
 *
 * 색만으로 나누지 않는다. 테두리가 실선 / 이중선 / 파선으로 함께 갈린다
 * (색각 이상 대비, FR-TR-16). 셋 중 하나만 보고도 구분이 된다.
 */
export const MARK_PALETTE: MarkPalette = {
	buffer: { color: '#19e0d8', outline: 'solid' },
	current: { color: '#ff45c8', outline: 'double' },
	visited: { color: '#a08cff', outline: 'dashed' }
};

/** 조각 종류별 문자 → facelet 인덱스. */
const indexOf = (kind: PieceKind): Record<Sticker, number> =>
	kind === 'edge' ? EDGE_INDEX : CORNER_INDEX;

/**
 * 54칸 강조 배열을 만든다 (FR-TR-16).
 *
 * **순수 함수다.** 화면에서 배열을 조립하면 단위 테스트가 안 되고, 이 배열이
 * 틀리면 사용자는 엉뚱한 조각을 훈련하게 된다 — 눈으로는 잘 안 잡히는 종류의
 * 오류다.
 *
 * 규칙:
 * 1. 버퍼 조각을 먼저 칠한다. 버퍼는 `meta.bufferStickers` 에서 온다 —
 *    이 함수에 버퍼 문자 리터럴이 없다 (FR-TR-7).
 * 2. 입력한 문자를 순서대로 칠한다. **마지막 하나가 "현재 타깃"** 이고 나머지는
 *    "지나간 조각" 이다. 뒤에 칠한 것이 앞을 덮으므로 같은 큐비가 두 번 나와도
 *    결과가 결정적이다.
 * 3. **조각 하나를 칠하면 그 조각의 스티커를 전부 칠한다** — 코너 3칸, 엣지 2칸.
 *    한 칸만 칠하면 큐브를 돌렸을 때 그 조각을 놓친다.
 *
 * 개수 상한을 두지 않는다. 지나간 조각은 코너 평균 8 + 엣지 평균 12 이고 끊기가
 * 늘면 더 는다.
 *
 * 정답 경로는 여기에 들어오지 않는다. 이 함수가 받는 것은 **사용자가 입력한
 * 문자열뿐** 이고, 그것이 힌트 금지(FR-TR-15)를 구조로 지키는 방식이다.
 */
export function buildMarks(
	kind: PieceKind,
	meta: BufferMeta,
	entered: readonly Sticker[],
	palette: MarkPalette = MARK_PALETTE
): (Mark | null)[] {
	const marks: (Mark | null)[] = Array.from({ length: 54 }, () => null);
	const index = indexOf(kind);
	const rotation = rotationOf(kind);
	const cubie = cubieOf(kind);

	const paint = (letter: Sticker, mark: Mark): void => {
		const home = cubie[letter];
		if (!home) return;
		for (const s of rotation[home]) marks[index[s]] = mark;
	};

	// 버퍼가 먼저. 입력이 버퍼 조각에 닿으면 그 위를 덮는다 — 지금 손에 든 것이
	// 무엇인지가 버퍼 표시보다 먼저 보여야 한다.
	for (const s of meta.bufferStickers) paint(s, palette.buffer);

	for (let i = 0; i < entered.length; i++)
		paint(entered[i], i === entered.length - 1 ? palette.current : palette.visited);

	return marks;
}
