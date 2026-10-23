// 코너 케이스 목록 — 규칙이 `ctx.cases` 로 받는다 (SPEC FR-CR-1).
//
// 매일 퀴즈는 0.7.0 개발 중 문제를 고르지 않게 됐다 (FR-DQ-7). 지금 이 목록을 읽는 규칙은
// 없지만, 케이스를 알림에 싣는 조건 규칙이 쓸 자리로 남겨 둔다.
//
// 데이터 파일을 읽는다. 코드(`src/`)는 import 하지 않는다 — 사본을 두면 둘이 어긋난다.

import { readFileSync } from 'node:fs';
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
