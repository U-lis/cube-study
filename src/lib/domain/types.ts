/**
 * 3-style 데이터 스키마 (schemaVersion 3).
 *
 * 이 타입은 데이터를 서술할 뿐이며, 데이터를 생성하거나 변형하지 않는다.
 *
 * 코드는 기준공식의 개수·이름·목록을 절대 하드코딩하지 않는다. 전부 데이터에서
 * 읽는다 (domain/anchor.ts). v2→v3 에서 기준이 10개→6개, (직접) 6케이스→0개로
 * 바뀌었고 같은 일이 또 일어날 수 있다.
 *
 * v3 에서 늘어난 것은 meta 의 선택 필드와 setup.usesInverse 뿐이라, v2 형태의
 * 파일도 그대로 로드된다.
 */

export type Face = 'U' | 'D' | 'F' | 'B' | 'R' | 'L';

/** Speffz 코너 스티커 'A'~'X' */
export type Sticker = string;
/** 'UBL', 'DFR' 등 */
export type Cubie = string;
/** 케이스 코드 2글자 (예: 'LB') */
export type CaseCode = string;
/** 기준공식 이름. '(직접)' 이면 기준 없이 전용 알고리즘 */
export type AnchorName = string;

export type AlgType = 'pure' | 'conj';

/**
 * 어느 기준에도 닿지 않는 케이스의 anchor 값.
 * v2 에는 6건(CU CW UC UW WC WU) 있었고 v3 에는 0건이다. 데이터가 다시 이런
 * 케이스를 담을 수 있으므로 분기는 남겨둔다 — 해당 케이스가 없으면 자동으로 죽는다.
 */
export const ANCHOR_DIRECT = '(직접)';

export interface Target {
	sticker: Sticker;
	cubie: Cubie;
	face: Face;
}

/** 상쇄를 적용하지 않은 구조형. cancelMoves(alg) === 상위의 alg 가 성립한다. */
export interface StrictInfo {
	alg: string;
	moves: number;
	/**
	 * 완전히 소멸한 무브 쌍의 수 (v3 정의). `R R'` 처럼 둘이 통째로 사라진 횟수만
	 * 센다. `U U → U2` 같은 합쳐짐은 무브가 하나 줄지만 여기 잡히지 않으므로
	 * `cancels` 는 `strict.moves - moves` 와 다를 수 있다 (v2 에서는 같았다).
	 */
	cancels: number;
}

export interface DirectStrict extends StrictInfo {
	/** A' 가 A 와 같은 문자열인가. 378건 중 다수가 true 다. */
	aSelfInverse: boolean;
	bSelfInverse: boolean;
}

export interface DirectAlg {
	/** 상쇄를 적용한 실행형 */
	alg: string;
	moves: number;
	type: AlgType;
	/** 인서트 파트 */
	A: string;
	/** 교환 파트 */
	B: string;
	/** conj 일 때의 셋업. pure 면 빈 문자열 */
	S: string;
	strict: DirectStrict;
}

export interface SetupAlg {
	alg: string;
	moves: number;
	anchor: AnchorName;
	/** 셋업 무브. 없으면 빈 문자열 */
	S: string;
	/**
	 * 기준공식을 거꾸로 돌리는가 (v3, 378 중 188건). true 면 실제 구조는
	 * `[S: anchor⁻¹]` 다. alg 에는 이미 반영되어 있고, 기준 무브열을 직접
	 * 보여주거나 조립할 때만 뒤집어야 한다 — domain/anchor.ts 가 담당한다.
	 * v2 데이터에는 없는 필드라 optional 이다 (없으면 정방향).
	 */
	usesInverse?: boolean;
	strict: StrictInfo;
}

export interface CaseEntry {
	case: CaseCode;
	target1: Target;
	target2: Target;
	direct: DirectAlg;
	setup: SetupAlg;
	inverse: CaseCode;
	/** direct.alg 와 setup.alg 의 최종 무브 열이 같은가 (29건) */
	sameAlg: boolean;
	/** 뒤집은 알고리즘이 저장된 역케이스 알고리즘과 문자열로 일치하는가 */
	inverseTrick: { direct: boolean; setup: boolean };
}

export interface Anchor {
	alg: string;
	moves: number;
	/** 이 기준이 담당하는 케이스 수 */
	count: number;
	entry1: Target;
	entry2: Target;
}

export interface DatasetMeta {
	buffer: Cubie;
	bufferStickers: Sticker[];
	primarySticker: Sticker;
	scheme: string;
	totalCases: number;
	schemaVersion: number;
	colorScheme: Record<Face, string>;
	notation: string;
	verification: string;
	strictNote: string;
	/** v3+. 기준을 배우는 순서(담당 케이스 많은 순). 없으면 anchors 의 키 순서를 쓴다. */
	anchorLearnOrder?: AnchorName[];
	anchorCount?: number;
	anchorNote?: string;
	avgMoves?: { direct: number; setup: number };
}

export interface Dataset {
	meta: DatasetMeta;
	stickers: Record<Sticker, { cubie: Cubie; face: Face }>;
	anchors: Record<AnchorName, Anchor>;
	cases: Record<CaseCode, CaseEntry>;
}
