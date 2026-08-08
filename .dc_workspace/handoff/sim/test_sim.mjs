import { readFileSync } from 'fs';
import { CubeSim, invertAlg, cancelMoves } from './cube-sim.js';

const perms = JSON.parse(readFileSync('./cube_perms.json', 'utf8'));
const data = JSON.parse(readFileSync('../3style_ubl_data.orig.json', 'utf8'));
const sim = new CubeSim(perms);

let pass = 0, fail = 0;
const errs = [];

for (const [key, c] of Object.entries(data.cases)) {
  for (const mode of ['direct', 'setup']) {
    const alg = c[mode].alg;
    if (!alg) continue;

    // 1) 케이스 식별이 맞는가
    const id = sim.identifyCase(alg);
    if (id !== key) { fail++; errs.push(`${key}/${mode}: identify=${id}`); continue; }

    // 2) 엣지 무영향인가
    if (!sim.isEdgeNeutral(alg)) { fail++; errs.push(`${key}/${mode}: edge dirty`); continue; }

    // 3) 무브 수가 데이터와 일치하는가
    if (alg.trim().split(/\s+/).length !== c[mode].moves) {
      fail++; errs.push(`${key}/${mode}: moves mismatch`); continue;
    }
    pass++;
  }

  // 4) 역트릭: XY 뒤집으면 YX
  const inv = cancelMoves(invertAlg(c.direct.alg));
  const invId = sim.identifyCase(inv);
  if (invId !== c.inverse) { fail++; errs.push(`${key}: inverse=${invId} expected ${c.inverse}`); }
  else pass++;
}

console.log(`통과 ${pass} / 실패 ${fail}`);
if (errs.length) console.log('오류 샘플:', errs.slice(0, 5));

// self-inverse 확인
console.log("\ninvertAlg(\"B' D2 B\") =", JSON.stringify(invertAlg("B' D2 B")));
console.log("invertAlg(\"R U R' U'\") =", JSON.stringify(invertAlg("R U R' U'")));
console.log("cancelMoves(\"R R' U\") =", JSON.stringify(cancelMoves("R R' U")));
