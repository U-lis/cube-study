// 규칙 목록 — 여기 한 곳에 모은다 (SPEC FR-CR-4).
//
// ## 조건 알림을 더하는 법
//
// 조건 규칙은 아직 없다. 사용자가 "이때 푸시 보내" 로 정하면 하나씩 생긴다. 한 규칙은
// 파일 하나와 아래 목록의 한 줄이다:
//
//   1. `cron/rules/<id>.ts` 에 `Rule` 을 만든다. `kind: 'condition'`.
//      조건이 기기 사정이면 `sub.meta.facts` 를 읽는다. 없는 사실이면 앱이 먼저 실어야
//      한다 — `src/lib/push/meta.ts` 의 `PushFacts` 와 `cron/meta.ts` 의 `Facts` 에 같은
//      칸을 더하고, 앱이 그 값을 채우게 한다 (`src/lib/ui/push.svelte.ts`).
//   2. dedupKey 는 "그 알림 한 번" 을 가리킨다. 예: 안 푼 지 3일이면
//      `idle3:<lastQuiz>` — 다시 풀어 lastQuiz 가 바뀌기 전에는 한 번만 간다.
//   3. 아래 `RULES` 에 넣는다. 매 tick 평가되므로 조건이 맞는 그 분에 나간다.
//   4. `tests/unit/cron/rules.test.ts` 에 그 규칙의 맞음·안 맞음·한 번만을 적는다.
//
// 예 (넣지 않았다):
//
//   export const idle3: Rule = {
//     id: 'idle3', kind: 'condition',
//     evaluate(sub, ctx) {
//       const last = sub.meta.facts.lastQuiz;
//       if (!last || daysBetween(last, localDate(ctx.now, sub.meta.tz)) < 3) return null;
//       return { dedupKey: `idle3:${last}`, notification: { title: '…', url: '/…' } };
//     }
//   };

import { daily } from './daily.ts';
import type { Rule } from './types.ts';

export const RULES: readonly Rule[] = [daily];
