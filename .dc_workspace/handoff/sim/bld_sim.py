"""
M2/OP 큐브 시뮬레이터
====================
초기 큐브 상태 + 메모 시퀀스를 입력하면, M2/OP 알고리즘들을 실제로 적용해서
최종 상태를 출력한다. LLM의 추론이 아니라 결정론적 실행.

사용법:
    python3 bld_sim.py

큐브 상태 입력 형식:
    각 면을 3x3 그리드로 입력. 행은 위에서 아래, 열은 왼쪽에서 오른쪽.
    면 표기 규칙:
      U: 위에서 봄. B가 위쪽 가장자리, F가 아래쪽 가장자리.
      L: 왼쪽 면을 정면으로 봄. U가 위쪽, F가 오른쪽 가장자리.
      F: 정면. U가 위쪽.
      R: 오른쪽 면을 정면으로 봄. U가 위쪽, F가 왼쪽 가장자리.
      B: 뒷면을 정면으로 봄. U가 위쪽, R이 왼쪽 가장자리.
      D: 아래에서 봄. F가 위쪽 가장자리, B가 아래쪽 가장자리.
    
    색상 기호: W(흰=U), Y(노=D), G(녹=F), B(파=B), R(빨=R), O(주=L)

메모 시퀀스 입력 형식:
    공백 또는 줄바꿈으로 구분된 letter들.
    M2 letters는 소문자 (a-x), OP corner letters는 대문자 (A-X).
    M2 corner 메모와 OP edge 메모는 지원 안함.

출력:
    매 letter 실행 후 큐브 상태 변화. 최종적으로 풀렸는지 검증.
"""

# ============================================================
# Speffz lettering tables
# ============================================================

# Corner stickers: position cubie name → [(speffz, face, row, col), ...]
CORNER_STICKERS = {
    'UBL': [('A','U',0,0), ('E','L',0,0), ('R','B',0,2)],
    'UBR': [('B','U',0,2), ('N','R',0,2), ('Q','B',0,0)],
    'UFR': [('C','U',2,2), ('M','R',0,0), ('J','F',0,2)],
    'UFL': [('D','U',2,0), ('F','L',0,2), ('I','F',0,0)],
    'DFL': [('U','D',0,0), ('G','L',2,2), ('L','F',2,0)],
    'DFR': [('V','D',0,2), ('P','R',2,0), ('K','F',2,2)],
    'DBR': [('W','D',2,2), ('O','R',2,2), ('T','B',2,0)],
    'DBL': [('X','D',2,0), ('H','L',2,0), ('S','B',2,2)],
}

# Edge stickers: position cubie name → [(speffz, face, row, col), ...]
EDGE_STICKERS = {
    'UB': [('a','U',0,1), ('q','B',0,1)],
    'UR': [('b','U',1,2), ('m','R',0,1)],
    'UF': [('c','U',2,1), ('i','F',0,1)],
    'UL': [('d','U',1,0), ('e','L',0,1)],
    'FL': [('f','L',1,2), ('l','F',1,0)],
    'DL': [('g','L',2,1), ('x','D',1,0)],
    'BL': [('h','L',1,0), ('r','B',1,2)],
    'FR': [('j','F',1,2), ('p','R',1,0)],
    'DF': [('k','F',2,1), ('u','D',0,1)],
    'BR': [('n','R',1,2), ('t','B',1,0)],
    'DR': [('o','R',2,1), ('v','D',1,2)],
    'DB': [('s','B',2,1), ('w','D',2,1)],
}

# Color to face
COLOR_TO_FACE = {'W':'U','Y':'D','G':'F','B':'B','R':'R','O':'L'}

# All letters (for permutation tracking)
CORNER_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWX"
EDGE_LETTERS = "abcdefghijklmnopqrstuvwx"

# Lookup tables: speffz_letter → position cubie name
CORNER_LETTER_TO_CUBIE = {}
EDGE_LETTER_TO_CUBIE = {}
for cubie, stickers in CORNER_STICKERS.items():
    for sp, _, _, _ in stickers:
        CORNER_LETTER_TO_CUBIE[sp] = cubie
for cubie, stickers in EDGE_STICKERS.items():
    for sp, _, _, _ in stickers:
        EDGE_LETTER_TO_CUBIE[sp] = cubie

# Lookup: (position_cubie, face) → speffz letter
# Useful for "which speffz letter belongs to the cubie at <pos> on <face>?"
POS_FACE_TO_CORNER_SPEFFZ = {}
POS_FACE_TO_EDGE_SPEFFZ = {}
for cubie, stickers in CORNER_STICKERS.items():
    for sp, face, _, _ in stickers:
        POS_FACE_TO_CORNER_SPEFFZ[(cubie, face)] = sp
for cubie, stickers in EDGE_STICKERS.items():
    for sp, face, _, _ in stickers:
        POS_FACE_TO_EDGE_SPEFFZ[(cubie, face)] = sp


# ============================================================
# 큐브 무브 정의 (스티커 레벨 permutation)
# ============================================================

def make_perm(domain, *cycles):
    p = {ch: ch for ch in domain}
    for cyc in cycles:
        for i, ch in enumerate(cyc):
            p[ch] = cyc[(i+1) % len(cyc)]
    return p

# 코너 스티커 무브
C_R = make_perm(CORNER_LETTERS, "BTVJ","CQWK","NOPM")
C_U = make_perm(CORNER_LETTERS, "ABCD","EQMI","RNJF")
C_F = make_perm(CORNER_LETTERS, "IJKL","DMVG","FCPU")
C_D = make_perm(CORNER_LETTERS, "UVWX","LPTH","GKOS")
C_B = make_perm(CORNER_LETTERS, "QRST","BEXO","NAHW")
C_L = make_perm(CORNER_LETTERS, "EHGF","ASUI","RXLD")

# 엣지 스티커 무브
E_R = make_perm(EDGE_LETTERS, "btvj","mnop")
E_U = make_perm(EDGE_LETTERS, "abcd","qmie")
E_F = make_perm(EDGE_LETTERS, "ijkl","cpuf")
E_D = make_perm(EDGE_LETTERS, "wxuv","sgko")
E_B = make_perm(EDGE_LETTERS, "qrst","ahwn")
E_L = make_perm(EDGE_LETTERS, "ehgf","drxl")
E_M = make_perm(EDGE_LETTERS, "cqwk","iasu")
E_E = make_perm(EDGE_LETTERS, "jfrn","plht")
E_S = make_perm(EDGE_LETTERS, "boxe","mvgd")

def inv(p):
    return {v:k for k,v in p.items()}

def compose(p, q):
    """Apply q first, then p. (p∘q)[x] = p[q[x]]"""
    return {x: p[q[x]] for x in p}

def square(p):
    return compose(p, p)

# 코너 무브 사전
CORNER_MOVES = {}
for name, p in [("R",C_R),("U",C_U),("F",C_F),("D",C_D),("B",C_B),("L",C_L)]:
    CORNER_MOVES[name] = p
    CORNER_MOVES[name+"'"] = inv(p)
    CORNER_MOVES[name+"2"] = square(p)

# 엣지 무브 사전
EDGE_MOVES = {}
for name, p in [("R",E_R),("U",E_U),("F",E_F),("D",E_D),("B",E_B),("L",E_L),
                ("M",E_M),("E",E_E),("S",E_S)]:
    EDGE_MOVES[name] = p
    EDGE_MOVES[name+"'"] = inv(p)
    EDGE_MOVES[name+"2"] = square(p)

# Wide moves (엣지)
EDGE_MOVES["u"] = compose(EDGE_MOVES["U"], EDGE_MOVES["E'"])
EDGE_MOVES["u'"] = compose(EDGE_MOVES["U'"], EDGE_MOVES["E"])
EDGE_MOVES["u2"] = square(EDGE_MOVES["u"])
EDGE_MOVES["d"] = compose(EDGE_MOVES["D"], EDGE_MOVES["E"])
EDGE_MOVES["d'"] = compose(EDGE_MOVES["D'"], EDGE_MOVES["E'"])
EDGE_MOVES["d2"] = square(EDGE_MOVES["d"])
EDGE_MOVES["l"] = compose(EDGE_MOVES["L"], EDGE_MOVES["M"])
EDGE_MOVES["l'"] = compose(EDGE_MOVES["L'"], EDGE_MOVES["M'"])
EDGE_MOVES["l2"] = square(EDGE_MOVES["l"])
EDGE_MOVES["r"] = compose(EDGE_MOVES["R"], EDGE_MOVES["M'"])
EDGE_MOVES["r'"] = compose(EDGE_MOVES["R'"], EDGE_MOVES["M"])
EDGE_MOVES["r2"] = square(EDGE_MOVES["r"])
EDGE_MOVES["f"] = compose(EDGE_MOVES["F"], EDGE_MOVES["S"])
EDGE_MOVES["f'"] = compose(EDGE_MOVES["F'"], EDGE_MOVES["S'"])
EDGE_MOVES["f2"] = square(EDGE_MOVES["f"])
EDGE_MOVES["b"] = compose(EDGE_MOVES["B"], EDGE_MOVES["S'"])
EDGE_MOVES["b'"] = compose(EDGE_MOVES["B'"], EDGE_MOVES["S"])
EDGE_MOVES["b2"] = square(EDGE_MOVES["b"])

# Wide moves (코너 - M/E/S는 코너를 안 건드림)
# Slice moves themselves also don't touch corners
_identity_corner = {ch: ch for ch in CORNER_LETTERS}
for sl in ["M", "E", "S"]:
    CORNER_MOVES[sl] = dict(_identity_corner)
    CORNER_MOVES[sl+"'"] = dict(_identity_corner)
    CORNER_MOVES[sl+"2"] = dict(_identity_corner)

CORNER_MOVES["u"] = CORNER_MOVES["U"]
CORNER_MOVES["u'"] = CORNER_MOVES["U'"]
CORNER_MOVES["u2"] = CORNER_MOVES["U2"]
CORNER_MOVES["d"] = CORNER_MOVES["D"]
CORNER_MOVES["d'"] = CORNER_MOVES["D'"]
CORNER_MOVES["d2"] = CORNER_MOVES["D2"]
CORNER_MOVES["l"] = CORNER_MOVES["L"]
CORNER_MOVES["l'"] = CORNER_MOVES["L'"]
CORNER_MOVES["l2"] = CORNER_MOVES["L2"]
CORNER_MOVES["r"] = CORNER_MOVES["R"]
CORNER_MOVES["r'"] = CORNER_MOVES["R'"]
CORNER_MOVES["r2"] = CORNER_MOVES["R2"]
CORNER_MOVES["f"] = CORNER_MOVES["F"]
CORNER_MOVES["f'"] = CORNER_MOVES["F'"]
CORNER_MOVES["f2"] = CORNER_MOVES["F2"]
CORNER_MOVES["b"] = CORNER_MOVES["B"]
CORNER_MOVES["b'"] = CORNER_MOVES["B'"]
CORNER_MOVES["b2"] = CORNER_MOVES["B2"]

# Cube rotations (양쪽에 적용)
def add_rotation(name, c_def, e_def):
    CORNER_MOVES[name] = c_def
    EDGE_MOVES[name] = e_def
    CORNER_MOVES[name+"'"] = inv(c_def)
    EDGE_MOVES[name+"'"] = inv(e_def)
    CORNER_MOVES[name+"2"] = square(c_def)
    EDGE_MOVES[name+"2"] = square(e_def)

# x = R + L'  (M-slice도 R 방향 → 코너에는 영향 없음, 엣지 M' 추가)
add_rotation("x",
    compose(CORNER_MOVES["R"], CORNER_MOVES["L'"]),
    compose(compose(EDGE_MOVES["R"], EDGE_MOVES["L'"]), EDGE_MOVES["M'"]))
add_rotation("y",
    compose(CORNER_MOVES["U"], CORNER_MOVES["D'"]),
    compose(compose(EDGE_MOVES["U"], EDGE_MOVES["D'"]), EDGE_MOVES["E'"]))
add_rotation("z",
    compose(CORNER_MOVES["F"], CORNER_MOVES["B'"]),
    compose(compose(EDGE_MOVES["F"], EDGE_MOVES["B'"]), EDGE_MOVES["S"]))


# ============================================================
# M2 / OP 알고리즘 사전
# ============================================================

# M2 알고리즘 (소문자 키 = M2 target letter, 즉 엣지 Speffz)
M2_ALGS = {
    'a': "M2",
    'b': "R' U R U' M2 U R' U' R",
    'c': "U2 M' U2 M'",
    'd': "L U' L' U M2 U' L U L'",
    'e': "x' U L' U' M2 U L U' x",
    'f': "x' U L2 U' M2 U L2 U' x",
    'g': "x' U L U' M2 U L' U' x",
    'h': "u' L u",  # special - need to verify with simulator
    'i': "D M' U R2 U' M U R2 U' D' M2",
    'j': "U R U' M2 U R' U'",
    'l': "U' L' U M2 U' L U",
    'm': "x' U' R U M2 U' R' U x",
    'n': "u R u'",  # special
    'o': "x' U' R' U M2 U' R U x",
    'p': "x' U' R2 U M2 U' R2 U x",
    'q': "B' R B U R2 U' M2 U R2 U' B' R' B",
    'r': "U' L U M2 U' L' U",
    's': "M2 D U R2 U' M' U R2 U' M D'",
    't': "U R' U' M2 U R U'",
    'v': "U R2 U' M2 U R2 U'",
    'w': "M U2 M U2",
    'x': "U' L2 U M2 U' L2 U",
}

# OP 코너 알고리즘 (이전 PDF에서 BFS로 생성한 setup + Y-perm + setup' 형태)
OP_SWAP = "R U' R' U' R U R' F' R U R' U' R' F R"
OP_SETUPS = {
    'B': "R D'", 'C': "F", 'D': "F R'", 'F': "F2", 'G': "D2 R",
    'H': "D2", 'I': "F' D", 'J': "F2 D", 'K': "D R", 'L': "D",
    'M': "R'", 'N': "R2", 'O': "R", 'P': "",
    'Q': "R' F", 'S': "D' R", 'T': "D'", 'U': "F'",
    'V': "D' F'", 'W': "D2 F'", 'X': "D F'",
}

def invert_alg(alg):
    """알고리즘을 역으로."""
    tokens = alg.split()
    inv_tokens = []
    for tok in reversed(tokens):
        if tok.endswith("'"):
            inv_tokens.append(tok[:-1])
        elif tok.endswith("2"):
            inv_tokens.append(tok)
        else:
            inv_tokens.append(tok + "'")
    return " ".join(inv_tokens)

def op_alg_for(letter):
    """OP 알고리즘 = setup + Y-perm + setup'"""
    if letter in {'A','E','R'}:
        raise ValueError(f"{letter}는 buffer sticker임")
    setup = OP_SETUPS[letter]
    if setup:
        return f"{setup} {OP_SWAP} {invert_alg(setup)}"
    else:
        return OP_SWAP


# ============================================================
# 알고리즘 적용 함수
# ============================================================

def apply_alg_to_corners(state, alg):
    """코너 state에 알고리즘 적용. state는 {pos: original_sticker} dict.
    
    무브 M을 적용하면: 무브 정의 M[X] = Y는 'X 스티커가 Y 위치로 이동'을 의미.
    따라서 새 state는: new_state[Y] = old_state[X] where Y = M[X].
    동등하게: new_state[pos] = old_state[M^{-1}(pos)].
    """
    for tok in alg.split():
        tok = tok.strip("()[]")
        if not tok:
            continue
        if tok not in CORNER_MOVES:
            raise ValueError(f"Unknown move: {tok}")
        move = CORNER_MOVES[tok]
        move_inv = {move[k]: k for k in move}
        state = {pos: state[move_inv[pos]] for pos in state}
    return state

def apply_alg_to_edges(state, alg):
    for tok in alg.split():
        tok = tok.strip("()[]")
        if not tok:
            continue
        if tok not in EDGE_MOVES:
            raise ValueError(f"Unknown move: {tok}")
        move = EDGE_MOVES[tok]
        move_inv = {move[k]: k for k in move}
        state = {pos: state[move_inv[pos]] for pos in state}
    return state


# ============================================================
# 큐브 상태 파싱 (색 그리드 → 스티커 permutation)
# ============================================================

def parse_cube_faces(faces_dict):
    """6개 면의 색 그리드 → corner_state, edge_state.
    
    faces_dict: {'U': [[..],[..],[..]], 'L': ..., ...}
    각 면은 3x3 색 문자 그리드.
    
    Returns:
      corner_state: {pos_speffz: original_speffz}
      edge_state: {pos_speffz: original_speffz}
    """
    # 검증: 6개 면, 각 면 3x3, 색 9개씩
    expected_centers = {'U':'W','D':'Y','F':'G','B':'B','R':'R','L':'O'}
    for face, expected_center in expected_centers.items():
        if face not in faces_dict:
            raise ValueError(f"면 {face} 누락")
        grid = faces_dict[face]
        if len(grid) != 3 or any(len(row) != 3 for row in grid):
            raise ValueError(f"면 {face}: 3x3 그리드 필요")
        if grid[1][1] != expected_center:
            raise ValueError(f"면 {face}의 중심이 {grid[1][1]} (예상: {expected_center})")
    
    # 각 코너 슬롯의 색 읽고 원래 스티커 식별
    corner_state = {}
    for pos_cubie, stickers in CORNER_STICKERS.items():
        # 현재 슬롯의 3개 색 읽기
        colors_at_slot = []
        for sp, face, r, c in stickers:
            colors_at_slot.append((sp, face, faces_dict[face][r][c]))
        # 큐비의 정체 = 3개 색의 set
        orig_faces = frozenset(COLOR_TO_FACE[col] for _, _, col in colors_at_slot)
        # 각 스티커 위치별로 원래 어느 큐비의 어느 면이었는지
        for sp, face, color in colors_at_slot:
            orig_face = COLOR_TO_FACE[color]
            # 원래 큐비 이름 = orig_faces를 정렬해서 만든 큐비명 찾기
            # CORNER_STICKERS에서 frozenset(cubie_name) == orig_faces 인 큐비 찾기
            orig_cubie = None
            for cb in CORNER_STICKERS:
                if frozenset(cb) == orig_faces:
                    orig_cubie = cb
                    break
            if orig_cubie is None:
                raise ValueError(f"색 조합 {orig_faces}에 해당하는 코너 없음")
            orig_sp = POS_FACE_TO_CORNER_SPEFFZ[(orig_cubie, orig_face)]
            corner_state[sp] = orig_sp
    
    # 엣지도 동일하게
    edge_state = {}
    for pos_cubie, stickers in EDGE_STICKERS.items():
        colors_at_slot = []
        for sp, face, r, c in stickers:
            colors_at_slot.append((sp, face, faces_dict[face][r][c]))
        orig_faces = frozenset(COLOR_TO_FACE[col] for _, _, col in colors_at_slot)
        for sp, face, color in colors_at_slot:
            orig_face = COLOR_TO_FACE[color]
            orig_cubie = None
            for cb in EDGE_STICKERS:
                if frozenset(cb) == orig_faces:
                    orig_cubie = cb
                    break
            if orig_cubie is None:
                raise ValueError(f"색 조합 {orig_faces}에 해당하는 엣지 없음")
            orig_sp = POS_FACE_TO_EDGE_SPEFFZ[(orig_cubie, orig_face)]
            edge_state[sp] = orig_sp
    
    return corner_state, edge_state


# ============================================================
# 메모 시퀀스 실행기
# ============================================================

def execute_memo(corner_state, edge_state, memo_sequence, verbose=True):
    """메모 시퀀스 (대문자 = OP corner, 소문자 = M2 edge) 실행.
    
    memo_sequence: 문자열, 공백으로 letter 구분. 예: "c s d b o r L Q F"
    
    Returns: (final_corner_state, final_edge_state, log)
    """
    log = []
    for letter in memo_sequence.split():
        letter = letter.strip()
        if not letter:
            continue
        if len(letter) != 1:
            log.append(f"SKIP '{letter}' (한 글자 letter만 처리)")
            continue
        
        if letter.isupper():
            # OP 코너
            if letter in {'A','E','R'}:
                log.append(f"  [{letter}] = OP 버퍼 스티커 (실행 안 함)")
                continue
            if letter not in OP_SETUPS:
                log.append(f"  [{letter}] OP unknown")
                continue
            alg = op_alg_for(letter)
            corner_state = apply_alg_to_corners(corner_state, alg)
            # OP는 엣지에도 영향 줌 (Y-perm 변형)
            edge_state = apply_alg_to_edges(edge_state, alg)
        elif letter.islower():
            # M2 엣지
            if letter in {'k','u'}:
                log.append(f"  [{letter}] = M2 버퍼 스티커 (실행 안 함)")
                continue
            if letter not in M2_ALGS:
                log.append(f"  [{letter}] M2 unknown")
                continue
            alg = M2_ALGS[letter]
            edge_state = apply_alg_to_edges(edge_state, alg)
            corner_state = apply_alg_to_corners(corner_state, alg)
        
        # 상태 요약
        c_unsolved = sum(1 for p in corner_state if corner_state[p] != p)
        e_unsolved = sum(1 for p in edge_state if edge_state[p] != p)
        log.append(f"  [{letter}] → corners 미해결 스티커 {c_unsolved}, edges 미해결 스티커 {e_unsolved}")
    
    return corner_state, edge_state, log


def print_state(corner_state, edge_state, header=""):
    """현재 큐브 상태 요약 출력."""
    if header:
        print(f"\n=== {header} ===")
    
    # 코너: 큐비 단위로 정리
    print("\n[코너]")
    cubie_state = {}
    for sp in CORNER_LETTERS:
        cb = CORNER_LETTER_TO_CUBIE[sp]
        cubie_state.setdefault(cb, []).append((sp, corner_state[sp]))
    
    unsolved_corners = []
    for cb, sps in cubie_state.items():
        unsolved = [(sp, orig) for sp, orig in sps if sp != orig]
        if unsolved:
            details = "  ".join(f"{sp}←{orig}" for sp, orig in sps)
            unsolved_corners.append(f"  {cb}: {details}")
    if unsolved_corners:
        for line in unsolved_corners:
            print(line)
    else:
        print("  ALL SOLVED ✓")
    
    # 엣지
    print("\n[엣지]")
    cubie_state = {}
    for sp in EDGE_LETTERS:
        cb = EDGE_LETTER_TO_CUBIE[sp]
        cubie_state.setdefault(cb, []).append((sp, edge_state[sp]))
    
    unsolved_edges = []
    for cb, sps in cubie_state.items():
        unsolved = [(sp, orig) for sp, orig in sps if sp != orig]
        if unsolved:
            details = "  ".join(f"{sp}←{orig}" for sp, orig in sps)
            unsolved_edges.append(f"  {cb}: {details}")
    if unsolved_edges:
        for line in unsolved_edges:
            print(line)
    else:
        print("  ALL SOLVED ✓")


# ============================================================
# 사용 예시
# ============================================================

if __name__ == "__main__":
    # 사용자가 준 큐브 상태
    faces = {
        'U': [['R','O','R'],
              ['W','W','R'],
              ['O','B','R']],
        'L': [['W','R','W'],
              ['G','O','W'],
              ['O','Y','B']],
        'F': [['B','Y','W'],
              ['B','G','R'],
              ['Y','G','G']],
        'R': [['G','Y','G'],
              ['B','R','R'],
              ['Y','B','O']],
        'B': [['Y','G','B'],
              ['G','B','Y'],
              ['Y','W','G']],
        'D': [['R','W','O'],
              ['O','Y','O'],
              ['W','O','B']],
    }
    
    corner_state, edge_state = parse_cube_faces(faces)
    print_state(corner_state, edge_state, "초기 스크램블 상태")
    
    # 시험할 메모 시퀀스를 여기 적기. 
    # 소문자 = M2 엣지 letter, 대문자 = OP 코너 letter.
    # OP는 엣지에도 영향 주므로, M2 먼저 → OP 나중 순서로 적는 게 표준.
    memo = "c s d b o r l q f   N K L W S I M J"
    
    print(f"\n실행할 메모: {memo}")
    print("(소문자 = M2 엣지, 대문자 = OP 코너)")
    
    c_final, e_final, log = execute_memo(corner_state, edge_state, memo)
    print("\n--- 실행 로그 ---")
    for line in log:
        print(line)
    
    print_state(c_final, e_final, "실행 후 최종 상태")
    
    c_solved = all(c_final[p] == p for p in CORNER_LETTERS)
    e_solved = all(e_final[p] == p for p in EDGE_LETTERS)
    print(f"\n최종 판정: 코너 {'✓ 해결' if c_solved else '✗ 미해결'}, 엣지 {'✓ 해결' if e_solved else '✗ 미해결'}")
    
    if c_solved and e_solved:
        print("⇒ 큐브 완전 해결!")
    else:
        print("⇒ 메모가 부족하거나 잘못됨. letter 추가/수정 필요.")
