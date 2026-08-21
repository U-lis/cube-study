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
import {
	trace,
	type EntryReading,
	type TraceOptions,
	type TraceVerdict,
	type TwistConvention
} from '../cube/trace.js';

export type { TwistConvention };

/**
 * 훈련 대상 (FR-TR-19).
 *
 * `both` 는 한 스크램블의 코너와 엣지를 **한 줄로 이어서 치고 한 번에 채점** 한다.
 * 코너를 먼저 제출·채점한 뒤 엣지를 따로 받는 반씩 채점은 없앴다 — 실전에서
 * 사람은 코너를 외운 뒤 채점을 기다리지 않고, 반씩 끊으면 한 판의 시간이 무엇을
 * 잰 값인지도 갈린다.
 */
export type TrainKind = 'corner' | 'edge' | 'both';

/**
 * 조각 종류 두 이름. **키에서 꺼낸다** — 문자열을 다시 적지 않으면 오타가 타입
 * 오류로 잡힌다. `satisfies` 가 두 키의 존재와 순서를 고정한다.
 */
const [CORNER, EDGE] = Object.keys({
	corner: 0,
	edge: 0
} satisfies Record<PieceKind, number>) as [PieceKind, PieceKind];

/**
 * 한 판이 다루는 조각 종류들. `both` 는 **순서가 뜻을 갖는다** — 구분자 앞이
 * 코너, 뒤가 엣지다.
 */
export function kindsOf(kind: TrainKind): PieceKind[] {
	return kind === 'both' ? [CORNER, EDGE] : [kind];
}

/** 결과 화면이 조각 종류를 부르는 이름. */
export const PART_LABELS = {
	corner: '코너',
	edge: '엣지'
} satisfies Record<PieceKind, string>;

/** 기록 한 줄의 조각 표기. `both` 는 한 판에 둘 다 들어 있다. */
export const RECORD_KIND_LABELS = {
	corner: PART_LABELS.corner,
	edge: PART_LABELS.edge,
	both: `${PART_LABELS.corner}+${PART_LABELS.edge}`
} satisfies Record<TrainKind, string>;

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
	/**
	 * 이 판의 훈련 대상. `both` 가 그대로 들어간다 — 한 판에 기록도 한 건이다.
	 *
	 * 반씩 채점하던 때는 `both` 한 판이 기록 두 건(코너 1, 엣지 1)이었고, 그러면
	 * "한 판에 얼마나 걸렸는가" 를 기록에서 되살릴 수 없다. 두 건을 짝지을 열쇠가
	 * 없기 때문이다.
	 */
	pieceKind: TrainKind;
	/**
	 * 이 판에 쓴 버퍼. `both` 는 둘이라 `BUFFER_JOIN` 으로 잇는다 (`joinBuffers`).
	 *
	 * 같은 스크램블도 버퍼가 다르면 정답이 다르므로 기록끼리 비교하려면 둘 다
	 * 남아야 한다. 필드를 둘로 쪼개는 대신 한 칸에 잇는 이유는 코너·엣지 전용
	 * 기록에서 빈 칸이 생기지 않게 하기 위해서다.
	 */
	buffer: Cubie;
	mode: TrainMode;
	/**
	 * 관례가 타깃 수를 평균 2.4개 바꾼다. 없으면 기록끼리 비교가 성립하지 않는다.
	 *
	 * 설정값이 아니라 **사용자가 실제로 친 방식** 이다 (요구 1) — `conventionOf` 가
	 * 판독 결과를 이 이름으로 옮긴다.
	 *
	 * `both` 는 판독이 둘인데 칸은 하나다. 한쪽이라도 따로 선언했으면 따로 처리로
	 * 적는다 (`conventionOf(parts.some(...))`) — 섞어 친 판을 "끊어서 처리" 로
	 * 적으면 타깃 수가 왜 그만큼인지 설명되지 않기 때문이다.
	 */
	twistConvention: TwistConvention;
	/**
	 * 이 스크램블이 정한 타깃 수. 사용자의 입력 길이가 아니라 문제의 난이도다.
	 *
	 * `both` 는 코너와 엣지의 **합** 이다. 한 판의 시간이 둘을 합친 시간이므로
	 * 나눠 적으면 시간과 개수의 단위가 어긋난다.
	 */
	targetCount: number;
	/** `both` 는 **양쪽 다** 맞아야 정답이다. 한쪽만 맞은 판은 오답으로 남는다. */
	correct: boolean;
}

/** `both` 기록의 두 버퍼를 잇는 문자. 큐비 이름에 안 쓰이는 글자여야 한다. */
export const BUFFER_JOIN = '+';

/** 이 판에 쓴 버퍼들을 기록 한 칸으로 잇는다. 하나면 그대로다. */
export const joinBuffers = (buffers: readonly Cubie[]): Cubie => buffers.join(BUFFER_JOIN);

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
 *
 * v2 — `pieceKind` 에 `both` 가 들어가고, `buffer` 가 여러 버퍼를 이은 칸이 되며,
 * `targetCount` 가 한 판의 합계가 됐다. 필드 이름과 개수는 그대로지만 **뜻이**
 * 바뀌었으므로 v1 기록은 버린다. 마이그레이션은 두지 않는다 — 배포 전이다.
 */
export const RECORDS_SCHEMA_VERSION = 2;

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
	A: '끊어서 처리',
	B: '따로 처리'
} satisfies Record<TwistConvention, string>;

/**
 * 관례 토글이 **무엇에 영향을 주는가** (요구 2).
 *
 * 입력을 가르지 않는다 — 어느 쪽으로 쳐도 정답은 정답이고, 판정은 `readEntry` 가
 * 입력만 보고 한다. 이 설정이 정하는 것은 결과 화면이 정답 예시와 타깃 수를
 * 어느 관례로 보여줄지 하나뿐이다. 그 사실을 적지 않으면 사용자는 이 토글이
 * 채점 기준을 바꾼다고 읽는다.
 */
export const CONVENTION_HINTS = {
	A: '정답 예시에 비틀림까지 끊어 넣어 보여줍니다',
	B: '정답 예시에서 비틀림을 빼고 따로 보여줍니다'
} satisfies Record<TwistConvention, string>;

/** 관례 토글의 머리말. 라벨만으로는 무엇을 고르는지 알 수 없다. */
export const CONVENTION_HEADING = '제자리 비틀림 처리';

/**
 * 관례 이름 둘. **키에서 꺼낸다** — 따옴표로 적으면 버퍼 리터럴 정적 검사에
 * 걸리기 때문이다(위 `CONVENTIONS` 주석 참조). `satisfies` 가 두 키의 존재와
 * 순서를 타입으로 고정한다.
 */
const [ABSORBED, SEPARATED] = Object.keys(CONVENTIONS) as [TwistConvention, TwistConvention];

/**
 * 판독 결과를 관례 이름으로 옮긴다.
 *
 * 기록의 `twistConvention` 은 세션 설정이 아니라 **사용자가 실제로 친 방식** 이다.
 * 설정을 적으면 "따로 처리로 두고 끊어서 친" 판이 남의 이름으로 저장된다.
 */
export const conventionOf = (separated: boolean): TwistConvention =>
	separated ? SEPARATED : ABSORBED;

export const TRAIN_KINDS = {
	corner: '코너만',
	edge: '엣지만',
	both: RECORD_KIND_LABELS.both
} satisfies Record<TrainKind, string>;

export const TRAIN_KIND_HEADING = '훈련 대상';
export const TRAIN_MODE_HEADING = '훈련 모드';

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

/**
 * 이 판정이 "풀린다" 쪽인가. 불필요한 끊기는 오답이 아니다 (FR-TR-12).
 *
 * 판정 종류를 세는 자리를 여기 하나로 모은다. 화면에서 `kind === 'correct' ||
 * kind === 'correct-extra'` 를 세 군데 적으면 종류가 늘 때 한 곳이 빠진다.
 */
export const isPass = (v: TraceVerdict): boolean =>
	v.kind === 'correct' || v.kind === 'correct-extra';

/** 한 판의 한 갈래. `both` 는 이것이 둘이고 코너·엣지가 각각 판정된다. */
export interface VerdictPart {
	kind: PieceKind;
	verdict: TraceVerdict;
}

/**
 * 여러 갈래의 판정을 한 줄로 합친다 (요구 2).
 *
 * **처음 틀린 갈래를 그대로 낸다.** 새 판정 종류를 만들어 덮지 않는 이유는
 * 하나다 — 사용자가 봐야 하는 것은 "어디서 어긋났는가" 이고, 합친 이름은 그
 * 정보를 지운다. 둘 다 풀리면 불필요한 끊기가 있었는지만 남긴다.
 */
export function combineVerdicts(parts: readonly VerdictPart[]): TraceVerdict {
	const failed = parts.find((p) => !isPass(p.verdict));
	if (failed) return failed.verdict;
	const extra = parts.reduce(
		(n, p) => n + (p.verdict.kind === 'correct-extra' ? p.verdict.extra : 0),
		0
	);
	return extra > 0 ? { kind: 'correct-extra', extra } : { kind: 'correct' };
}

/**
 * 갈래별 판정 문구. 갈래가 하나면 이름을 붙이지 않는다 — 코너만 하는 판에서
 * "코너 정답" 은 같은 말을 두 번 하는 것이다.
 */
export function partsVerdictText(parts: readonly VerdictPart[]): string {
	if (parts.length === 0) return '';
	if (parts.length === 1) return verdictText(parts[0].verdict);
	return parts.map((p) => `${PART_LABELS[p.kind]} ${verdictText(p.verdict)}`).join(' · ');
}

/**
 * 입력을 어떻게 갈랐는지 알린다 (요구 1).
 *
 * 판독이 조용하면 사용자는 자기가 친 단독 문자가 비틀림 선언으로 읽혔다는 것을
 * 알 수 없고, 정답이 나와도 왜 정답인지 모른다. 채점 결과와 **같은 무게로**
 * 사실만 적는다.
 */
export function readingText(r: EntryReading): string {
	if (r.twists.length === 0) return '전부 타깃으로 읽었습니다';
	return `${r.twists.join(' ')} — 비틀림 선언으로 읽었습니다`;
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
		isTrainKind(r.pieceKind) &&
		typeof r.buffer === 'string' &&
		r.buffer !== '' &&
		isTrainMode(r.mode) &&
		isTwistConvention(r.twistConvention) &&
		typeof r.targetCount === 'number' &&
		typeof r.correct === 'boolean'
	);
}

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
 * - **버퍼 문자도 그대로 받는다.** 입력이 한 줄로 합쳐진 뒤로는 "타깃 자리에서는
 *   잠기고 비틀림 자리에서는 열린다" 가 문맥에 따라 갈리는 규칙이 되어, 사용자가
 *   예측할 수 없다. 잠글 바에는 다 여는 편이 낫고, 버퍼를 타깃으로 쓴 것은 채점이
 *   `buffer-sticker` 로 짚어 준다.
 * - `max` 를 넘으면 자른다. 붙여넣기 한 번으로 화면이 굳는 것을 막는다.
 *
 * 조각 종류를 **배열로** 받는다. `both` 한 판은 코너 열과 엣지 열이 구분자 하나로
 * 이어진 한 줄이고, 어느 쪽 규칙으로 맞출지는 구분자를 몇 개 지났는지가 정한다.
 */
export function sanitizeEntry(
	text: string,
	kinds: readonly PieceKind[],
	options: { max: number }
): Sticker[] {
	const allowed = kinds.map((k) => new Set(lettersOf(k)));
	const out: Sticker[] = [];
	let seg = 0;
	let letters = 0;
	for (const ch of text) {
		if (ch === ENTRY_SEPARATOR) {
			// 구분자는 갈래 사이에만 선다. 갈래가 하나인 판에는 설 자리가 없고,
			// 두 번째부터는 앞선 하나가 이미 같은 자리를 가리킨다.
			if (seg >= kinds.length - 1) continue;
			seg++;
			out.push(ENTRY_SEPARATOR);
			continue;
		}
		// 상한에 닿아도 멈추지 않는다 — 뒤에 오는 구분자는 여전히 받아야 패드가
		// 엣지로 넘어간 상태를 잃지 않는다. 상한이 세는 것은 글자뿐이다.
		if (letters >= options.max) continue;
		const c = kinds[seg] === EDGE ? ch.toLowerCase() : ch.toUpperCase();
		if (!allowed[seg].has(c)) continue;
		out.push(c);
		letters++;
	}
	return out;
}

/**
 * 갈래 사이의 구분자 (요구 2).
 *
 * 24글자 어느 쪽에도 없는 문자여야 한다. 대소문자로도 코너·엣지가 갈리지만
 * **정본은 이 문자다** — 대소문자는 사람이 흘리기 쉽고(모바일 자동 대문자),
 * 그것을 기준으로 삼으면 한 글자가 갈래를 통째로 옮겨버린다.
 */
export const ENTRY_SEPARATOR = '/';

/** 구분자를 넣는 버튼의 라벨. 무엇이 시작되는지를 적는다. */
export const SEPARATOR_LABEL = `${PART_LABELS.edge} 시작`;

/** 이 입력이 이미 갈렸는가. 패드가 어느 글자를 보여줄지의 근거다. */
export const hasSeparator = (entry: readonly string[]): boolean =>
	entry.includes(ENTRY_SEPARATOR);

/** 지금 입력 중인 갈래의 번호. 구분자를 지난 횟수이고, 갈래 수를 넘지 않는다. */
export function segmentIndex(entry: readonly string[], kinds: readonly PieceKind[]): number {
	const passed = entry.filter((c) => c === ENTRY_SEPARATOR).length;
	return Math.min(passed, kinds.length - 1);
}

/** 한 줄 입력을 갈래별로 가른 결과. 구분자가 없으면 뒤 갈래는 빈 열이다. */
export interface EntrySegment {
	kind: PieceKind;
	letters: Sticker[];
}

/**
 * 한 줄 입력을 갈래별로 가른다 (요구 2).
 *
 * 대소문자를 보지 않는다 — 구분자가 정본이고, 대소문자는 `sanitizeEntry` 가 이미
 * 구분자에 맞춰 고쳐 둔다. 여기서 다시 대소문자로 가르면 두 규칙이 생기고, 둘이
 * 어긋나는 날 사용자는 맞게 친 답을 오답으로 돌려받는다.
 */
export function entrySegments(
	entry: readonly Sticker[],
	kinds: readonly PieceKind[]
): EntrySegment[] {
	const segs: EntrySegment[] = kinds.map((kind) => ({ kind, letters: [] }));
	let i = 0;
	for (const ch of entry) {
		if (ch === ENTRY_SEPARATOR) {
			if (i < segs.length - 1) i++;
			continue;
		}
		segs[i].letters.push(ch);
	}
	return segs;
}

/**
 * 구분자와 어긋나게 친 글자 수 — **교차 검증** 이다 (요구 2).
 *
 * 대소문자는 판정에 쓰지 않지만 버리기도 아깝다. 구분자 앞에 소문자를 쳤다면
 * 구분자를 넣는 것을 잊었을 가능성이 높고, 그 사실을 한 줄로 알려주면 사용자가
 * 스스로 확인한다. 갈래가 하나인 판에서는 셀 것이 없다 — 대소문자를 틀린 것은
 * 다른 조각을 지목한 것이 아니기 때문이다.
 */
export function caseConflicts(text: string, kinds: readonly PieceKind[]): number {
	if (kinds.length < 2) return 0;
	const allowed = kinds.map((k) => new Set(lettersOf(k)));
	let seg = 0;
	let n = 0;
	for (const ch of text) {
		if (ch === ENTRY_SEPARATOR) {
			if (seg < kinds.length - 1) seg++;
			continue;
		}
		const c = kinds[seg] === EDGE ? ch.toLowerCase() : ch.toUpperCase();
		if (allowed[seg].has(c) && ch !== c) n++;
	}
	return n;
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
