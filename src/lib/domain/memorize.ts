/**
 * 암기 체크 도메인 로직 — 순수 함수.
 *
 * Svelte/SvelteKit 을 import 하지 않는다 (runes, browser, $app/environment 전부 금지).
 * Vitest 에서 별도 초기화 없이 그대로 검증할 수 있어야 하고, 이 파일이 UI 상태와
 * 결합되면 데이터가 바뀔 때(v2→v3 처럼) 유닛 테스트로 잡을 수 있는 회귀를
 * 통합 테스트로 밀어내게 된다.
 *
 * 기준공식의 이름·개수·순서를 이 파일 어디에도 쓰지 않는다. anchorProgress 는
 * Dataset.anchors 의 키를 그대로 Map 키로 쓰고, 케이스는 c.setup.anchor 로만
 * 분류한다. 데이터가 정하고 코드는 따라간다 (types.ts:1-11 근거).
 */

import type { CaseCode, Dataset, AnchorName } from './types.js';
import type { Mode } from './format.js';

/** localStorage 저장 표현 (FR-MC-6). 배열은 정렬 저장하므로 diff 가 예측 가능하다. */
export interface MemorizeStored {
	schemaVersion: number;
	checked: { setup: string[]; direct: string[] };
}

/** 런타임 표현. has() O(1) 이 렌더 성능의 하한선을 정한다 (GLOBAL AD-2). */
export type MemorizeChecked = { setup: Set<CaseCode>; direct: Set<CaseCode> };

/** 현재 스키마 버전. 이 값과 다르면 파싱 결과를 버리고 빈 상태로 시작한다. */
const SCHEMA_VERSION = 1;

/** 빈 상태의 새 인스턴스. 매번 새 Set 을 만들어야 참조 공유 사고를 막는다. */
function emptyChecked(): MemorizeChecked {
	return { setup: new Set(), direct: new Set() };
}

/**
 * localStorage 원문을 안전하게 파싱한다. 파싱 실패·스키마 불일치·형태 이상은
 * 전부 조용히 빈 상태로 되돌린다 — 이 함수가 던지면 앱 기동이 막힌다 (FR-MC-7).
 *
 * schemaVersion 이 없거나 다르면 필드 값이 유효해 보여도 무시한다. 스키마가 바뀐
 * 뒤 낡은 데이터를 새 코드로 해석하는 사고를 방지하려는 것이지, 흠 없는 데이터를
 * 버리려는 것이 아니다.
 */
export function parseStored(raw: string | null): MemorizeChecked {
	if (raw == null || raw === '') return emptyChecked();
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return emptyChecked();
	}
	if (!isStoredShape(parsed)) return emptyChecked();
	if (parsed.schemaVersion !== SCHEMA_VERSION) return emptyChecked();
	return {
		setup: new Set(parsed.checked.setup),
		direct: new Set(parsed.checked.direct)
	};
}

/**
 * MemorizeStored 형태 판정. schemaVersion 이 number 이고 checked.setup·direct 가
 * string 배열이어야 통과한다. Set 원소가 문자열이라는 전제를 여기서 지킨다.
 */
function isStoredShape(v: unknown): v is MemorizeStored {
	if (typeof v !== 'object' || v === null) return false;
	const o = v as Record<string, unknown>;
	if (typeof o.schemaVersion !== 'number') return false;
	const c = o.checked;
	if (typeof c !== 'object' || c === null) return false;
	const co = c as Record<string, unknown>;
	if (!Array.isArray(co.setup) || !Array.isArray(co.direct)) return false;
	if (!co.setup.every((x) => typeof x === 'string')) return false;
	if (!co.direct.every((x) => typeof x === 'string')) return false;
	return true;
}

/**
 * MemorizeChecked → JSON 문자열. 배열은 삽입 순서와 무관하게 사전순으로 저장한다.
 * localStorage 값이 삽입 순서에 흔들리면 테스트가 삽입 순서를 검증하게 되고
 * (구현 세부에 결합), diff 검사도 무의미해진다.
 */
export function serialize(checked: MemorizeChecked): string {
	const stored: MemorizeStored = {
		schemaVersion: SCHEMA_VERSION,
		checked: {
			setup: [...checked.setup].sort(),
			direct: [...checked.direct].sort()
		}
	};
	return JSON.stringify(stored);
}

/**
 * 기준별 setup 체크 케이스 수. Dataset.anchors 의 모든 키를 0 으로 초기화한 뒤
 * 체크된 케이스만 순회해 해당 anchor 카운트를 올린다.
 *
 * 초기화가 중요하다. 체크가 0 인 기준을 빠뜨리면 UI 에서 "0/N" 표시가 사라져
 * 그 기준만 화면에서 증발한다. anchors 의 모든 키가 반환 Map 에도 존재한다.
 *
 * 체크됐지만 데이터에 없는 케이스 코드는 무시한다. 데이터 교체 후 저장소에
 * 남아있는 과거 코드를 건드리지 않고 넘어가는 편이 오류를 내는 것보다 안전하다.
 * 데이터 밖 anchor 이름도 마찬가지 — anchors 에 없는 이름이면 Map 에 없다.
 */
export function anchorProgress(
	ds: Dataset,
	setupChecked: Set<CaseCode>
): Map<AnchorName, number> {
	const result = new Map<AnchorName, number>();
	for (const name of Object.keys(ds.anchors)) result.set(name, 0);
	for (const code of setupChecked) {
		const entry = ds.cases[code];
		if (!entry) continue;
		const anchor = entry.setup.anchor;
		if (!result.has(anchor)) continue;
		result.set(anchor, result.get(anchor)! + 1);
	}
	return result;
}

/**
 * 퀴즈 출제 풀. 현재 입력 방식(mode) 에 대응하는 Set 만 배열로 낸다.
 * setup·direct 두 표기가 독립 저장되므로 (FR-MC-1) mode 에 맞는 쪽을 골라야
 * "암기한 것만" 필터의 의미가 산다.
 */
export function poolFor(checked: MemorizeChecked, mode: Mode): CaseCode[] {
	return [...(mode === 'setup' ? checked.setup : checked.direct)];
}
