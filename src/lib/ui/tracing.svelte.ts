/**
 * 트레이싱 세션 설정과 기록 싱글턴.
 *
 * `settings.svelte.ts:33-43` 의 `$effect.root()` + `$effect()` 자동 저장 패턴을 따른다.
 *
 * ─── 왜 암기 체크 싱글턴에 얹지 않는가 (AD-13) ──────────────
 * 암기 체크의 저장 파서는 `schemaVersion` 불일치 시 저장물을 전부 버린다.
 * 같은 키에 얹으면 트레이싱 스키마를 올리는 순간 암기 진도가 통째로 날아간다.
 * 그래서 키도 스키마 버전도 파서도 따로다 — 이 파일은 암기 체크 쪽 모듈을
 * import 하지 않는다.
 * ────────────────────────────────────────────────────────────
 *
 * `localStorage` 접근은 전부 `browser` 가드나 `$effect()` 안이다. 프리렌더는
 * SSR 이라 `localStorage` 가 없고, 밖에서 만지면 `vite build` 가 죽는다
 * (`settings.svelte.ts:16`).
 */
import { browser } from '$app/environment';
import {
	isTrainMode,
	isTrainTarget,
	isTwistConvention,
	migrateTarget,
	parseRecords,
	pushRecord,
	serializeRecords,
	RECORDS_KEY,
	type TraceRecord,
	type TrainMode,
	type TrainTarget,
	type TwistConvention
} from '$lib/domain/tracing.js';

const KEY_TARGET = 'trace.target';
const KEY_MODE = 'trace.mode';
const KEY_CONVENTION = 'trace.convention';

/**
 * 0.5.0 이 쓰던 두 칸. 읽고 나면 지운다 (`readTarget`).
 *
 * 남겨두면 다음에 이 파일을 고치는 사람이 저장소에서 세 칸을 보고 어느 것이
 * 정본인지 알 수 없다.
 */
const KEY_LEGACY_KIND = 'trace.pieceKind';
const KEY_LEGACY_ENTRY_FIRST = 'trace.entryFirst';

/**
 * 저장된 설정 읽기. 판정 함수를 도메인에서 받아 쓴다 — 유효값 목록이 두 곳에
 * 있으면 값을 늘릴 때 한쪽만 고치게 되고, 그 사고는 "설정이 조용히 기본값으로
 * 되돌아간다" 는 형태로 나타난다.
 */
function read<T>(key: string, guard: (v: unknown) => v is T, fallback: T): T {
	if (!browser) return fallback;
	const v = localStorage.getItem(key);
	return guard(v) ? v : fallback;
}

/**
 * 훈련 대상을 읽는다. 새 칸이 없으면 **0.5.0 의 칸에서 옮긴다** (FR-TR-19).
 *
 * 옮기지 않으면 `both` 로 훈련하던 사용자가 갱신 직후 조용히 코너 전용으로
 * 되돌아간다. 설정이 사라진 것은 눈에 띄지만 기본값으로 되돌아간 것은 눈에 띄지
 * 않는다 — 한 판을 다 치고 나서야 안다.
 */
function readTarget(): TrainTarget {
	if (!browser) return 'corner';
	const own = localStorage.getItem(KEY_TARGET);
	if (isTrainTarget(own)) return own;
	const moved = migrateTarget(localStorage.getItem(KEY_LEGACY_KIND));
	localStorage.removeItem(KEY_LEGACY_KIND);
	localStorage.removeItem(KEY_LEGACY_ENTRY_FIRST);
	return moved ?? 'corner';
}

function loadRecords(): TraceRecord[] {
	if (!browser) return [];
	return parseRecords(localStorage.getItem(RECORDS_KEY));
}

class Tracing {
	/**
	 * 훈련 대상 (FR-TR-19). 코너부터 배우므로 기본이 코너다.
	 *
	 * 값이 외우는 순서까지 담는다 — 치는 순서는 이 값과 모드에서 파생되고 따로
	 * 저장하지 않는다 (`entryKindsOf`).
	 */
	target = $state<TrainTarget>(readTarget());
	/** 훈련 모드 (FR-TR-21). 규칙을 익히는 단계가 먼저라 기본이 follow 다. */
	mode = $state<TrainMode>(read(KEY_MODE, isTrainMode, 'follow'));
	/** 비틀림 관례 (FR-TR-24). 기본은 입문의 방식이자 엔진의 기본값이다. */
	convention = $state<TwistConvention>(read(KEY_CONVENTION, isTwistConvention, 'A'));
	/** 최근 것이 앞. 상한은 도메인의 `RECORD_LIMIT` 이 정한다. */
	records = $state<TraceRecord[]>(loadRecords());

	constructor() {
		if (browser) {
			$effect.root(() => {
				$effect(() => localStorage.setItem(KEY_TARGET, this.target));
				$effect(() => localStorage.setItem(KEY_MODE, this.mode));
				$effect(() => localStorage.setItem(KEY_CONVENTION, this.convention));
				$effect(() => localStorage.setItem(RECORDS_KEY, serializeRecords(this.records)));
			});
		}
	}

	/** 배열을 **재할당** 한다. `unshift` 는 `$state` 를 깨우지 않는다. */
	add(r: TraceRecord): void {
		this.records = pushRecord(this.records, r);
	}

	/** 결과 화면이 보여주는 직전 기록들 (FR-TR-23). */
	recent(n: number): TraceRecord[] {
		return this.records.slice(0, n);
	}

	clear(): void {
		this.records = [];
	}
}

export const tracing = new Tracing();
