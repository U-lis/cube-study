/**
 * 스티커 문자 훈련(#19)의 화면 설정 싱글턴 (GLOBAL AD-LT-11).
 *
 * `tracing.svelte.ts` 의 `$effect.root()` + `$effect()` 자동 저장 패턴을 따른다.
 * 키는 `letters.*` 로 따로 둔다 — 암기 진도의 파서는 `schemaVersion` 이 안 맞으면
 * 저장물을 통째로 버리므로 같은 키에 얹지 않는다 (`tracing.svelte.ts` 머리 주석과 같다).
 *
 * 저장소 접근은 `try/catch` 로 감싼다 (SPEC FR-LT-23). 비공개 창처럼 막혀 있으면
 * 기본값으로 돌고, 바꾼 값은 이번 방문 동안만 산다.
 */
import { browser } from '$app/environment';
import { isLetterKind, isOthers, isQuizStage, type Others, type QuizStage } from '$lib/domain/letters.js';
import type { PieceKind } from '$lib/cube/speffz.js';

const KEY = {
	lookupKind: 'letters.lookup.kind',
	lookupOthers: 'letters.lookup.others',
	quizKind: 'letters.quiz.kind',
	quizStage: 'letters.quiz.stage',
	quizOthers: 'letters.quiz.others'
} as const;

function read<T>(key: string, guard: (v: unknown) => v is T, fallback: T): T {
	if (!browser) return fallback;
	try {
		const v = localStorage.getItem(key);
		return guard(v) ? v : fallback;
	} catch {
		return fallback;
	}
}

function write(key: string, value: string): void {
	try {
		localStorage.setItem(key, value);
	} catch {
		// 저장소가 막혀 있다. 이번 방문 동안은 메모리의 값으로 돈다.
	}
}

class Letters {
	/** 외우기 — 글자를 찍을 종류. 코너부터 배우므로 기본이 코너다. */
	lookupKind = $state<PieceKind>(read(KEY.lookupKind, isLetterKind, 'corner'));
	/** 외우기 — 다른 종류의 조각을 가릴지 (FR-LT-7a). */
	lookupOthers = $state<Others>(read(KEY.lookupOthers, isOthers, 'gray'));
	/** 퀴즈 — 문제 종류. */
	quizKind = $state<PieceKind>(read(KEY.quizKind, isLetterKind, 'corner'));
	/** 퀴즈 — 단계 (FR-LT-13). 앞 단계가 기본이다. */
	quizStage = $state<QuizStage>(read(KEY.quizStage, isQuizStage, 'solved'));
	/** 퀴즈 — 문제 아닌 큐비를 가릴지 (FR-LT-12a). */
	quizOthers = $state<Others>(read(KEY.quizOthers, isOthers, 'gray'));

	constructor() {
		if (browser) {
			$effect.root(() => {
				$effect(() => write(KEY.lookupKind, this.lookupKind));
				$effect(() => write(KEY.lookupOthers, this.lookupOthers));
				$effect(() => write(KEY.quizKind, this.quizKind));
				$effect(() => write(KEY.quizStage, this.quizStage));
				$effect(() => write(KEY.quizOthers, this.quizOthers));
			});
		}
	}
}

export const letters = new Letters();
