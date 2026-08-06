/**
 * cube-sim.js — 3x3 큐브 스티커 시뮬레이터 (참조 구현)
 *
 * Python 원본(bld_sim.py)을 JS로 이식한 것. 앱의 필수 요소는 아니지만,
 * 데이터 무결성 테스트나 향후 기능(퀴즈 정답 검증, 스크램블 적용, 3D 애니메이션)에 유용.
 *
 * 사용 데이터: cube_perms.json
 *
 * ─── 핵심 규약 ───────────────────────────────────────────────
 * state 는 { 위치: 그_위치에_있는_원래_스티커 } 형태의 객체.
 * 풀린 상태 = { A:'A', B:'B', ... } (모든 위치가 자기 스티커를 가짐)
 *
 * 무브 적용: newState[pos] = oldState[table[pos]]
 * (cube_perms.json 의 테이블은 이미 역치환이 적용되어 있어 단순 조회로 동작)
 * ────────────────────────────────────────────────────────────
 */

export class CubeSim {
  /** @param {object} perms cube_perms.json 을 파싱한 객체 */
  constructor(perms) {
    this.perms = perms;
    this.cornerLetters = perms.cornerLetters.split('');
    this.edgeLetters = perms.edgeLetters.split('');
  }

  /** 풀린 코너 상태 */
  solvedCorners() {
    return Object.fromEntries(this.cornerLetters.map(p => [p, p]));
  }

  /** 풀린 엣지 상태 */
  solvedEdges() {
    return Object.fromEntries(this.edgeLetters.map(p => [p, p]));
  }

  /**
   * 알고리즘을 상태에 적용
   * @param {object} state
   * @param {string} alg  예: "R U R' U'"
   * @param {'corner'|'edge'} kind
   */
  apply(state, alg, kind = 'corner') {
    const moves = kind === 'corner' ? this.perms.cornerMoves : this.perms.edgeMoves;
    let st = { ...state };
    for (const tok of alg.trim().split(/\s+/)) {
      if (!tok) continue;
      const table = moves[tok];
      if (!table) throw new Error(`Unknown move: ${tok}`);
      const next = {};
      for (const pos in st) next[pos] = st[table[pos]];
      st = next;
    }
    return st;
  }

  applyToCorners(state, alg) { return this.apply(state, alg, 'corner'); }
  applyToEdges(state, alg) { return this.apply(state, alg, 'edge'); }

  /** 상태가 풀린 상태인지 */
  isSolved(state) {
    return Object.entries(state).every(([pos, sticker]) => pos === sticker);
  }

  /** 움직인 스티커 목록 */
  movedStickers(state) {
    return Object.entries(state).filter(([pos, s]) => pos !== s);
  }

  /** 영향받은 큐비 집합 */
  affectedCubies(state, kind = 'corner') {
    const map = kind === 'corner'
      ? this.perms.cornerLetterToCubie
      : this.perms.edgeLetterToCubie;
    const set = new Set();
    for (const [pos, s] of Object.entries(state)) {
      if (pos !== s) set.add(map[pos]);
    }
    return [...set].sort();
  }

  /** 알고리즘이 엣지를 전혀 안 건드리는지 (3-style 코너 알고리즘의 필수 조건) */
  isEdgeNeutral(alg) {
    return this.isSolved(this.applyToEdges(this.solvedEdges(), alg));
  }

  /**
   * 알고리즘이 어떤 3-style 케이스를 푸는지 식별 (UBL 버퍼 기준)
   * @returns {string|null} 예: "LB", 3-cycle 이 아니면 null
   */
  identifyCase(alg, opts = {}) {
    const buffer = new Set(opts.bufferStickers ?? ['A', 'E', 'R']);
    const primary = opts.primarySticker ?? 'A';
    const bufferCubie = opts.bufferCubie ?? 'UBL';

    const st = this.applyToCorners(this.solvedCorners(), alg);
    const moved = this.movedStickers(st);
    if (moved.length !== 9) return null;

    const cubies = this.affectedCubies(st, 'corner');
    if (cubies.length !== 3 || !cubies.includes(bufferCubie)) return null;

    // X = 버퍼의 primary 스티커가 도착한 위치
    let X = null;
    for (const [pos, s] of Object.entries(st)) {
      if (s === primary) { X = pos; break; }
    }
    if (!X || buffer.has(X)) return null;

    const Y = st[primary];
    if (buffer.has(Y) || st[Y] !== X) return null;

    return X + Y;
  }
}

/* ─── 표기 유틸 (시뮬레이터 없이도 쓸 수 있음) ────────────── */

/**
 * 알고리즘 뒤집기 = 순서 거꾸로 + 각 무브 토글
 * 주의: 둘 다 해야 함. `2` 가 붙은 무브는 토글해도 그대로.
 *   invertAlg("R U R' U'")  === "U R U' R'"
 *   invertAlg("B' D2 B")    === "B' D2 B"   ← self-inverse (버그 아님)
 */
export function invertAlg(alg) {
  return alg.trim().split(/\s+/).reverse().map(t => {
    if (t.endsWith("'")) return t.slice(0, -1);
    if (t.endsWith('2')) return t;
    return t + "'";
  }).join(' ');
}

/** 인접한 같은 면 무브 상쇄 (예: "R R' U" → "U", "F' F' U" → "F2 U") */
export function cancelMoves(alg) {
  const amt = t => t.endsWith("'") ? 3 : t.endsWith('2') ? 2 : 1;
  const tok = (f, a) => {
    a = ((a % 4) + 4) % 4;
    return a === 0 ? null : a === 1 ? f : a === 2 ? f + '2' : f + "'";
  };
  let toks = alg.trim().split(/\s+/).filter(Boolean);
  let changed = true;
  while (changed) {
    changed = false;
    const out = [];
    for (let i = 0; i < toks.length; i++) {
      if (i + 1 < toks.length && toks[i][0] === toks[i + 1][0]) {
        const merged = tok(toks[i][0], amt(toks[i]) + amt(toks[i + 1]));
        if (merged) out.push(merged);
        i++;
        changed = true;
      } else {
        out.push(toks[i]);
      }
    }
    toks = out;
  }
  return toks.join(' ');
}

/** 무브 수 */
export function moveCount(alg) {
  return alg.trim() ? alg.trim().split(/\s+/).length : 0;
}
