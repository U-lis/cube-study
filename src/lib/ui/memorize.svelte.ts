/**
 * 암기 체크 상태 싱글턴.
 *
 * settings.svelte.ts 의 $effect.root() + $effect() 자동 저장 패턴을 그대로 따른다.
 * 학습 진도(memorize)와 표시 취향(settings)의 라이프사이클이 달라 파일을 나눈다
 * (GLOBAL AD-1).
 *
 * NFR-MC-1: localStorage 접근은 browser 가드 안에서만 한다. SSR 프리렌더에서
 * localStorage 를 만지면 vite build 가 죽는다. settings.svelte.ts:5,15,33 참조.
 *
 * NFR-MC-4: 반응성은 $state 로만. 수동 재렌더/DOM 조작 없음.
 */
import { browser } from '$app/environment';
import type { CaseCode } from '$lib/domain/types.js';
import type { Mode } from '$lib/domain/format.js';
import {
	parseStored,
	serialize,
	type MemorizeChecked
} from '$lib/domain/memorize.js';

const KEY_CHECKED = 'memorize.checked';
const KEY_HIDE_MEMORIZED = 'anchor.hideMemorized';
const KEY_MEMORIZED_ONLY = 'quiz.memorizedOnly';

/**
 * SSR 에서는 빈 상태로 시작한다. 하이드레이션 후 브라우저에서만 실제 값이 들어온다.
 * parseStored 는 정의상 안전(어떤 입력도 던지지 않음)하지만, browser 가드 밖에서
 * localStorage 를 건드리는 순간 프리렌더가 깨지므로 호출 자체를 이 함수 안으로 접는다.
 */
function loadChecked(): MemorizeChecked {
	if (!browser) return { setup: new Set(), direct: new Set() };
	return parseStored(localStorage.getItem(KEY_CHECKED));
}

/** boolean 키 방어 읽기. 'true' 문자열만 true 로 취급하고 그 외는 fallback. */
function loadBool(key: string, fallback: boolean): boolean {
	if (!browser) return fallback;
	const v = localStorage.getItem(key);
	if (v === 'true') return true;
	if (v === 'false') return false;
	return fallback;
}

class Memorize {
	// 초기 로드는 생성자보다 필드 이니셜라이저가 낫다 — $state 로 감싼 값이
	// 클래스 필드로 정의되어야 인스턴스 참조 시점에 반응 컨텍스트가 붙는다.
	setupChecked = $state<Set<CaseCode>>(loadChecked().setup);
	directChecked = $state<Set<CaseCode>>(loadChecked().direct);

	/** "외운거 안보기" 토글 (기준 상세 화면). 기본값은 전부 보임. */
	hideMemorized = $state<boolean>(loadBool(KEY_HIDE_MEMORIZED, false));
	/** "암기한 것만 출제" 토글 (퀴즈 화면). 기본값은 전체에서 출제. */
	memorizedOnly = $state<boolean>(loadBool(KEY_MEMORIZED_ONLY, false));

	constructor() {
		if (browser) {
			// settings.svelte.ts:33-43 과 동일한 자동 저장 구조.
			// $effect() 는 $effect.root() 안에서만 동기적으로 등록할 수 있다.
			$effect.root(() => {
				// setup/direct 두 Set 은 하나의 localStorage 항목에 함께 저장된다.
				// 어느 쪽이 바뀌든 전체를 다시 직렬화한다 — serialize 가 정렬을 보장하므로
				// 실제 저장 문자열이 바뀌지 않으면 브라우저가 write 를 no-op 로 처리한다.
				$effect(() => {
					localStorage.setItem(
						KEY_CHECKED,
						serialize({ setup: this.setupChecked, direct: this.directChecked })
					);
				});
				$effect(() => localStorage.setItem(KEY_HIDE_MEMORIZED, String(this.hideMemorized)));
				$effect(() => localStorage.setItem(KEY_MEMORIZED_ONLY, String(this.memorizedOnly)));
			});
		}
	}

	/**
	 * 지정 표기의 체크 상태를 토글한다. Set 을 그대로 mutate 하지 않고 새 Set 을
	 * 대입해야 Svelte 5 의 $state 가 변화를 감지한다 — Set 의 identity 가 바뀌지
	 * 않으면 $effect 가 재실행되지 않아 localStorage 저장이 멈춘다.
	 */
	toggle(mode: Mode, code: CaseCode): void {
		const current = mode === 'setup' ? this.setupChecked : this.directChecked;
		const next = new Set(current);
		if (next.has(code)) next.delete(code);
		else next.add(code);
		if (mode === 'setup') this.setupChecked = next;
		else this.directChecked = next;
	}

	isChecked(mode: Mode, code: CaseCode): boolean {
		return (mode === 'setup' ? this.setupChecked : this.directChecked).has(code);
	}

	/** UI 렌더에서 현재 표기의 Set 을 통째로 참조할 때. $derived 로 감싸 소비한다. */
	checkedFor(mode: Mode): Set<CaseCode> {
		return mode === 'setup' ? this.setupChecked : this.directChecked;
	}

	/**
	 * setup·direct 두 표기의 체크를 모두 비운다. About 의 "전체 해제" 진입점.
	 * 파괴적 동작이므로 UI 는 반드시 확인 절차를 거친 뒤에만 호출한다 (FR-MC-22).
	 * 새 빈 Set 을 대입해야 $state 가 변화를 감지한다 (toggle 과 같은 이유).
	 */
	clearAll(): void {
		this.setupChecked = new Set();
		this.directChecked = new Set();
	}
}

export const memorize = new Memorize();
