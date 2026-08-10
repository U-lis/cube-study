/**
 * 3-style 데이터 스키마 (schemaVersion 3).
 *
 * 이 타입은 데이터를 서술할 뿐이며, 데이터를 생성하거나 변형하지 않는다.
 *
 * 코드는 기준공식의 개수·이름·목록을 절대 하드코딩하지 않는다. 전부 데이터에서
 * 읽는다 (domain/anchor.ts). 기준은 v2 10개 → v3 6개 → v5 5개로 두 번 바뀌었고,
 * (직접) 케이스도 6개 → 0개가 됐다. 같은 일이 또 일어난다고 보는 편이 맞다.
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
	 * 상쇄로 줄어든 무브 수. `strict.moves - moves` 와 항상 같다.
	 *
	 * v3~v5 는 이 값을 `(strict.moves - moves) / 2` 로 계산했는데, 상쇄가 늘 무브
	 * 둘을 지운다고 가정한 것이라 틀렸다 (`R R → R2` 는 하나만 준다). 378×2 중
	 * 470건이 어긋나 있었고 v6 이 고쳤다.
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
	 * 기준공식을 거꾸로 돌리는가. true 면 실제 구조는 `[S: anchor⁻¹]` 다.
	 * alg 에는 이미 반영되어 있고, 기준 무브열을 직접 보여주거나 조립할 때만
	 * 뒤집어야 한다 — domain/anchor.ts 가 담당한다.
	 * v2 데이터에는 없는 필드라 optional 이다 (없으면 정방향).
	 */
	usesInverse?: boolean;
	/** v6+. 셋업 무브 수. `S` 의 토큰 수와 같다. */
	setupMoves?: number;
	/**
	 * v6+. 최종 무브 수가 나온 과정. 예: `"3+8+3=14 → 상쇄 6 → 8"`.
	 *
	 * 셋업 길이와 최종 무브 수가 안 맞아 보이는 것을 설명하려고 데이터가 들고 있다.
	 * 화면에서 둘을 나란히 보여주면 반드시 이 질문이 나온다.
	 */
	breakdown?: string;
	/**
	 * v5+. 셋업 없이 기준공식을 그대로 쓰는 케이스인가. 기준마다 자기 이름의
	 * 케이스 쌍(XY / YX)을 직접 담당하도록 데이터가 보장한다.
	 * 표시에 쓰지 않아도 무방하다 — S 가 비었는지로도 같은 판단이 된다.
	 */
	isAnchorCase?: boolean;
	/**
	 * v7+. 이 케이스의 셋업이 F/B 무브를 쓰는가. 378 중 104건.
	 *
	 * v7 은 기준공식 후보를 F/B 미사용으로 제한해 셋업의 F/B 까지 줄였다
	 * (v6 162건 → 104건). 핑거링으로 케이스를 걸러 보고 싶을 때 쓸 수 있다 —
	 * 앱은 아직 화면에 쓰지 않는다.
	 */
	setupUsesFB?: boolean;
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
	/** v5+. 이 기준이 셋업 없이 직접 담당하는 케이스 쌍 (예: ['GC', 'CG']) */
	ownCases?: CaseCode[];
	/** v5+. 이 기준 하나만으로 도달 가능한 케이스 수 (셋업 0~3수 허용) */
	soloReach?: number;
	/** v5+. 이 기준 하나만 쓸 때의 평균 무브 수 */
	soloAvgMoves?: number;
	/** v7+. 이 기준공식이 F/B 무브를 쓰는가. v7 은 전부 false 다. */
	usesFB?: boolean;
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
	/**
	 * v5+. 기준을 하나씩 늘릴 때의 평균 무브 수 변화.
	 *
	 * 기준을 늘리는 목적이 커버리지가 아니라 단축이라는 것이 여기서 드러난다 —
	 * 하나만 알아도 거의 다 도달하고, 추가는 평균을 줄인다.
	 */
	learningCurve?: { anchors: AnchorName[]; avgMoves: number; unreachable: number }[];
	/** v5+. 커버리지가 제약이 아니라는 설명 */
	coverageNote?: string;
	/** v5+. 케이스를 어느 기준에 배정하는지의 규칙 */
	assignmentRule?: string;
	/** v5+. 배정이 만족하는 성질 (상호배타·완결·역쌍 동일·자기 케이스 소유) */
	partitionNote?: string;
	/** v7+. 기준공식 선정에 건 제약 (F/B 미사용) */
	anchorConstraint?: string;
	/** v7+. 셋업 길이 분포. 키가 길이, 값이 케이스 수 */
	setupLengthDist?: Record<string, number>;
	/** v7+. 셋업에 F/B 가 들어간 케이스 수 */
	setupFBCount?: number;
}

export interface Dataset {
	meta: DatasetMeta;
	stickers: Record<Sticker, { cubie: Cubie; face: Face }>;
	anchors: Record<AnchorName, Anchor>;
	cases: Record<CaseCode, CaseEntry>;
}
