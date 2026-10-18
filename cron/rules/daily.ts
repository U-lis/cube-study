// 매일 퀴즈 — 주기 규칙 (SPEC FR-CR-4, FR-CR-6, #33).
//
// `[daily, daily + 30분)` 안이면 보낸다. 창이 30분인 것은 타이머가 몇 분 놓쳐도
// (재부팅·릴레이 재시작) 그날 알림이 사라지지 않게 하려는 것이다. 창 안에서는 매분
// 다시 맞지만 dedupKey 가 날짜라 하루 한 번만 나간다. 창은 현지 자정에서 자른다 —
// 23:50 이면 23:59 까지. 다음 날로 넘기면 dedupKey 날짜가 바뀌어 두 번 간다.

import { pickCase, targetText } from '../cases.ts';
import { hhmmToMinute, localDate, localMinute } from '../time.ts';
import type { Rule } from './types.ts';

export const WINDOW_MIN = 30;

export const daily: Rule = {
  id: 'daily',
  kind: 'periodic',
  evaluate(sub, ctx) {
    const { daily: at, tz } = sub.meta;
    if (at === null) return null;
    const start = hhmmToMinute(at);
    const end = Math.min(start + WINDOW_MIN, 24 * 60);
    const now = localMinute(ctx.now, tz);
    if (now < start || now >= end) return null;

    const date = localDate(ctx.now, tz);
    const c = pickCase(ctx.cases, sub.id, date);
    return {
      dedupKey: `daily:${date}`,
      notification: {
        // 문구는 사실만 (UI 문구 규약을 알림에도 적용 — 사용자 결정 2026-10-18)
        title: '코너 3-style 퀴즈',
        body: `${c.case} · ${targetText(c.target1)} → ${targetText(c.target2)}`,
        url: `/3x3/bld/3style/corner/quiz?c=${c.case}`,
        tag: 'daily'
      }
    };
  }
};
