// 코너 케이스 목록 — 매일 퀴즈의 문제를 고른다 (SPEC FR-CR-1, FR-CR-7).
//
// 데이터 파일을 읽는다. 코드(`src/`)는 import 하지 않는다 — 사본을 두면 둘이 어긋난다.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export interface CaseInfo {
  case: string;
  target1: { sticker: string; cubie: string; face: string };
  target2: { sticker: string; cubie: string; face: string };
}

const DATA = fileURLToPath(new URL('../src/lib/data/corner-UBL.json', import.meta.url));

export function loadCases(path = DATA): CaseInfo[] {
  const ds = JSON.parse(readFileSync(path, 'utf8')) as { cases: Record<string, CaseInfo> };
  // 키 순서는 파일이 정한다. 정렬해 두면 파일의 키 순서가 바뀌어도 고르는 결과가 같다.
  return Object.keys(ds.cases)
    .sort()
    .map((k) => ds.cases[k]);
}

/**
 * (구독, 날짜) 로 결정되는 문제. 창 안에서 매분 다시 계산해도 같은 문제다 —
 * 재시도가 다른 문제를 들고 가지 않는다.
 */
export function pickCase(cases: readonly CaseInfo[], subscriptionId: string, date: string): CaseInfo {
  const h = createHash('sha256').update(`${subscriptionId}|${date}`).digest();
  return cases[h.readUInt32BE(0) % cases.length];
}

/** 퀴즈 화면의 표기와 같다 (`src/lib/domain/validate.ts` 의 `targetText`). */
export const targetText = (t: CaseInfo['target1']): string => `${t.cubie}의 ${t.face}면`;
