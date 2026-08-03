"""3style_ubl_data.json 에 strict(상쇄 전 구조형) 필드 추가.

기존 필드는 읽기만 하고 절대 수정하지 않는다.
strict.alg 를 상쇄하면 원본 alg 와 일치해야 한다 (378/378 assert).
"""
import json, sys

SRC = '/home/ulismoon/Downloads/3style_ubl_data.json'
DST = sys.argv[1]

AMT = {'': 1, "'": 3, '2': 2}
SUF = {1: '', 2: '2', 3: "'"}


def invert(alg):
    """순서 뒤집기 + 각 무브 토글. 2는 그대로."""
    out = []
    for m in reversed(alg.split()):
        if m.endswith("'"):
            out.append(m[:-1])
        elif m.endswith('2'):
            out.append(m)
        else:
            out.append(m + "'")
    return ' '.join(out)


def cancel(alg):
    """인접한 같은 면 무브를 mod 4 로 합산."""
    out = []
    for t in alg.split():
        if out and out[-1][0] == t[0]:
            prev = out.pop()
            n = (AMT[prev[1:]] + AMT[t[1:]]) % 4
            if n:
                out.append(prev[0] + SUF[n])
        else:
            out.append(t)
    return ' '.join(out)


def parts_to_alg(parts):
    return ' '.join(p['alg'] for p in parts if p['alg'])


d = json.load(open(SRC, encoding='utf-8'))
cases, anchors = d['cases'], d['anchors']

for code, c in cases.items():
    # --- direct: S · A · B · A' · B' · S' ---
    D = c['direct']
    A, B, S = D['A'], D['B'], D['S']
    parts = []
    if S:
        parts.append({'label': 'S', 'role': 'setup', 'alg': S})
    parts += [
        {'label': 'A',  'role': 'insert',      'alg': A},
        {'label': 'B',  'role': 'interchange', 'alg': B},
        {'label': "A'", 'role': 'insert',      'alg': invert(A)},
        {'label': "B'", 'role': 'interchange', 'alg': invert(B)},
    ]
    if S:
        parts.append({'label': "S'", 'role': 'setup', 'alg': invert(S)})

    strict_alg = parts_to_alg(parts)
    assert cancel(strict_alg) == D['alg'], f'direct mismatch: {code}'

    D['strict'] = {
        'alg': strict_alg,
        'moves': len(strict_alg.split()),
        'cancels': len(strict_alg.split()) - D['moves'],
        'aSelfInverse': invert(A) == A,
        'bSelfInverse': invert(B) == B,
    }

    # --- setup: S · 기준공식 · S' ---
    U = c['setup']
    anchor, Ss = U['anchor'], U['S']
    if anchor == '(직접)':
        sparts = [{'label': '(직접)', 'role': 'direct', 'alg': U['alg']}]
    else:
        sparts = []
        if Ss:
            sparts.append({'label': 'S', 'role': 'setup', 'alg': Ss})
        sparts.append({'label': anchor, 'role': 'anchor', 'alg': anchors[anchor]['alg']})
        if Ss:
            sparts.append({'label': "S'", 'role': 'setup', 'alg': invert(Ss)})

    sstrict = parts_to_alg(sparts)
    assert cancel(sstrict) == U['alg'], f'setup mismatch: {code}'

    U['strict'] = {
        'alg': sstrict,
        'moves': len(sstrict.split()),
        'cancels': len(sstrict.split()) - U['moves'],
    }

    # --- 두 모드가 동일한 케이스 플래그 (토글 무반응 대응) ---
    c['sameAlg'] = D['alg'] == U['alg']

    # --- 역트릭 적용 가능 여부 (direct 만 성립) ---
    inv = c['inverse']
    c['inverseTrick'] = {
        'direct': invert(D['alg']) == cases[inv]['direct']['alg'],
        'setup': invert(U['alg']) == cases[inv]['setup']['alg'],
    }

d['meta']['schemaVersion'] = 2
d['meta']['strictNote'] = (
    'strict.alg = 상쇄를 적용하지 않은 구조형(S A B A\' B\' S\'). '
    'alg = 상쇄를 적용한 실행형. cancel(strict.alg) == alg 가 378/378 성립.'
)

json.dump(d, open(DST, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'OK -> {DST}')
