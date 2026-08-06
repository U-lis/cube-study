import { readFileSync } from 'fs';
import { CubeSim, invertAlg, cancelMoves, moveCount } from './cube-sim.js';
const perms = JSON.parse(readFileSync('./cube_perms.json','utf8'));
const data = JSON.parse(readFileSync('../3style_ubl_data.v2.json','utf8'));
const sim = new CubeSim(perms);
let pass=0, fail=0; const errs=[];
const chk=(cond,msg)=>{ if(cond) pass++; else { fail++; if(errs.length<8) errs.push(msg); } };

for (const [key,c] of Object.entries(data.cases)) {
  for (const mode of ['direct','setup']) {
    const S = c[mode].strict;
    // strict.alg 가 같은 케이스를 푸는가
    chk(sim.identifyCase(S.alg)===key, `${key}/${mode}.strict identify=${sim.identifyCase(S.alg)}`);
    // strict.alg 도 엣지 무영향인가
    chk(sim.isEdgeNeutral(S.alg), `${key}/${mode}.strict edge dirty`);
    // strict 를 상쇄하면 저장된 alg 인가
    chk(cancelMoves(S.alg)===c[mode].alg, `${key}/${mode}.strict cancel mismatch`);
    // moves/cancels 필드 정합
    chk(S.moves===moveCount(S.alg) && S.cancels===S.moves-c[mode].moves, `${key}/${mode}.strict moves/cancels`);
  }
  // 파생 플래그 검증
  chk(c.sameAlg===(c.direct.alg===c.setup.alg), `${key} sameAlg`);
  chk(c.direct.strict.aSelfInverse===(invertAlg(c.direct.A)===c.direct.A), `${key} aSelfInverse`);
  chk(c.direct.strict.bSelfInverse===(invertAlg(c.direct.B)===c.direct.B), `${key} bSelfInverse`);
  chk(c.inverseTrick.direct===(sim.identifyCase(cancelMoves(invertAlg(c.direct.alg)))===c.inverse), `${key} invTrick.direct`);
  const si=sim.identifyCase(cancelMoves(invertAlg(c.setup.alg)));
  chk(c.inverseTrick.setup===(invertAlg(c.setup.alg)===data.cases[c.inverse].setup.alg), `${key} invTrick.setup`);
  // setup 역트릭이 false여도 역케이스는 푸는가?
  chk(si===c.inverse, `${key} setup inverse solves ${si}`);
}
console.log(`v2 검증: 통과 ${pass} / 실패 ${fail}`);
if(errs.length) console.log('오류:', errs);
