# The pickaxe's up and down swings, drawn from the axe's (the owner after 2.0: "the pickaxe
# animation the up and down one is botched"). PixelLab never managed a front or back pick swing (the
# raises came out as a halo, antlers or a crossed X), while every look's axe swing is clean, so the
# pick takes the axe's raise and strike frames with the axe head cleared and a pick head drawn across
# the handle's end, in that frame's own metal and outline colours.
#
# Each frame: `clear` boxes (inclusive, raw 48x48 px) made transparent, an optional `handle` drawn
# from (x0, y0) to (x1, y1), and the `head`: a curve from tip A to tip B bowed by `bow` px (positive
# bows to the left of A->B), two px thick. `behind`: the head only fills empty pixels (held behind the
# head). Writes art/player/<look>/pick/<dir>-axe/<n>.png and prints the cleanTool boxes to add to the
# look's recipe meta (the head becomes the metal part whatever colours it matched).
#
# Run: python art/player/pickfix.py [look ...]   then: node art/player/clean.mjs <recipes>
#      and node scripts/art-import.mjs <recipe> for each look
import json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))

def luma(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]

# look -> raw folder, recipe, then per direction the frames it replaces: (source tool, source frame)
# -> spec. `col` is the sheet column it becomes; `auto` finds the axe head itself (aim 'body': out
# from the body's middle, for raises; 'handle': along the handle, for strikes). Frames not listed keep
# the look's PixelLab pick frame (those that were fine: bun's, and most strikes).
RAISE, STRIKE = 'pickRaise', 'pickStrike'
BODY = {'auto': True, 'aim': 'body', 'col': RAISE}
HANDLE = {'auto': True, 'aim': 'handle', 'col': STRIKE}
FRAMES = {
    'player': {'dir': 'c32', 'recipe': 'recipe.json', 'north': {
        ('axe', 2): {'col': RAISE, 'clear': [(29, 11, 31, 16), (30, 18, 30, 18)], 'head': ((29, 10), (38, 17), 2), 'behind': True},
        ('axe', 4): {'col': STRIKE, 'clear': [(32, 26, 38, 36), (29, 32, 31, 36)], 'handle': ((30, 29), (34, 29)), 'head': ((34, 23), (35, 36), 2)},
    }, 'south': {
        ('axe', 2): {'col': RAISE, 'clear': [(10, 8, 20, 21)], 'handle': ((18, 22), (15, 13)), 'head': ((9, 15), (18, 9), 2)},
        ('axe', 4): {'col': STRIKE, 'clear': [(34, 26, 41, 40)], 'handle': ((32, 32), (37, 32)), 'head': ((37, 25), (38, 39), 2)},
    }},
    'bald': {'dir': 'bald', 'north': {('axe', 2): BODY, ('axe', 4): HANDLE}},
    'braids': {'dir': 'braids', 'north': {('axe', 2): BODY, ('axe', 4): HANDLE}},
    'cap': {'dir': 'cap', 'north': {
        ('axe', 2): BODY,
        ('axe', 4): {'col': STRIKE, 'clear': [(31, 24, 38, 35)], 'handle': ((30, 28), (34, 28)), 'head': ((34, 23), (35, 35), 2)},
    }},
    'curly': {'dir': 'curly', 'north': {('axe', 2): BODY, ('axe', 4): HANDLE}, 'south': {
        ('axe', 2): {'col': RAISE, 'clear': [(5, 10, 16, 17)], 'handle': ((15, 21), (11, 15)), 'head': ((6, 17), (14, 11), 2), 'behind': True},
        ('axe', 4): HANDLE,
    }},
    # hat's axe never rises facing away; its hoe does, over the right shoulder
    'hat': {'dir': 'hat', 'north': {
        ('hoe', 2): {'col': RAISE, 'clear': [(34, 9, 38, 14), (31, 9, 33, 10)], 'handle': ((31, 15), (34, 9)), 'head': ((30, 6), (39, 10), 2), 'behind': True},
    }, 'south': {('axe', 2): BODY, ('axe', 4): HANDLE}},
    'long': {'dir': 'long', 'north': {
        ('axe', 2): BODY,
        ('axe', 4): {'col': STRIKE, 'clear': [(30, 24, 39, 35)], 'handle': ((29, 29), (34, 29)), 'head': ((34, 23), (35, 36), 2)},
    }},
    'ponytail': {'dir': 'ponytail', 'north': {('axe', 2): BODY}},
}
# frames that only change which PixelLab take the look uses, with the pick head's pixels (which the
# generator lit in skin-like creams) tagged metal: the arc over the head, rows 8-15
def bun_head(x, y):
    return y <= 12 or (y <= 15 and (x <= 15 or x >= 31))
PICKED = {'bun': {('south', RAISE): ('bun/pick/south/1.png', bun_head)}}

def tag_metal(path, inside):
    """cleanTool boxes (by rows) for the light pixels of a take's pick head"""
    im = Image.open(os.path.join(HERE, path)).convert('RGBA')
    rows = {}
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            c = im.getpixel((x, y))
            if c[3] and inside(x, y) and cls(c) in 'MsT':
                rows.setdefault(y, []).append(x)
    boxes = []
    for y, xs in sorted(rows.items()):
        start = prev = xs[0]
        for x in xs[1:] + [None]:
            if x is not None and x == prev + 1:
                prev = x
                continue
            boxes.append([start, y, prev, y, 'metal', 'all'])
            if x is not None:
                start = prev = x
    return boxes

def sample(im, boxes):
    """the axe head's colours (light to dark) from inside the clear boxes, and the frame's outline"""
    px = im.load()
    w, h = im.size
    metal, dark = {}, {}
    for (x0, y0, x1, y1) in boxes:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if 0 <= x < w and 0 <= y < h and px[x, y][3]:
                    c = px[x, y][:3]
                    if luma(c) > 120 and max(c) - min(c) < 70:
                        metal[c] = metal.get(c, 0) + 1
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and luma(px[x, y][:3]) < 40:
                dark[px[x, y][:3]] = dark.get(px[x, y][:3], 0) + 1
    outline = max(dark, key=dark.get)
    tones = sorted(metal, key=luma, reverse=True)
    if len(tones) < 3:
        tones = [(199, 220, 208), (155, 171, 178), (127, 112, 138)]
    light, mid, shade = tones[0], tones[len(tones) // 2], tones[-1]
    return outline, light, mid, shade

def handle_colour(im):
    """the handle's wood: the commonest mid-dark warm brown in the frame (not hair: hair is in the head's blob,
    clean.mjs sorts that out by position)"""
    px = im.load()
    seen = {}
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b, a = px[x, y]
            if a and r > g > b and 50 < luma((r, g, b)) < 110:
                seen[(r, g, b)] = seen.get((r, g, b), 0) + 1
    return max(seen, key=seen.get) if seen else (110, 60, 40)

def line(a, b):
    (x0, y0), (x1, y1) = a, b
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    return [(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)) for i in range(n + 1)]

def curve(a, b, bow):
    (ax, ay), (bx, by) = a, b
    mx, my = (ax + bx) / 2, (ay + by) / 2
    dx, dy = bx - ax, by - ay
    L = max((dx * dx + dy * dy) ** 0.5, 1)
    nx, ny = dy / L, -dx / L  # left of A->B in screen coords (y down)
    cx, cy = mx + nx * bow, my + ny * bow
    pts, steps = [], int(L * 3) + 2
    for i in range(steps + 1):
        t = i / steps
        x = (1 - t) ** 2 * ax + 2 * (1 - t) * t * cx + t * t * bx
        y = (1 - t) ** 2 * ay + 2 * (1 - t) * t * cy + t * t * by
        p = (round(x), round(y))
        if not pts or pts[-1] != p:
            pts.append(p)
    return pts, (nx, ny)

def cls(c):
    """o outline, M light metal, m mid metal, T orange tool, w handle brown, s anything else"""
    r, g, b, a = c
    if not a:
        return '.'
    l = luma((r, g, b))
    sat = max(r, g, b) - min(r, g, b)
    if l < 40:
        return 'o'
    if l > 110 and sat < 60:
        return 'M'
    if r > 180 and g > 90 and b < 90 and sat > 90:
        return 'T'
    if r > g > b and l < 110:
        return 'w'
    return 's'

def auto(im, aim='handle'):
    """find the axe head (the biggest metal cluster away from the body), the handle's end where it
    meets it, and the way it points (from the body's middle out to the head); returns a frame spec"""
    px = im.load()
    W, H = im.size
    C = {(x, y): cls(px[x, y]) for y in range(H) for x in range(W)}
    def grey(q):
        r, g, b, a = px[q]
        return a and max(r, g, b) - min(r, g, b) < 45 and luma((r, g, b)) > 70
    metal = {p for p, c in C.items() if c in 'MT' or (c != '.' and grey(p))}
    seen, comps = set(), []
    for p in metal:
        if p in seen:
            continue
        comp, stack = set(), [p]
        while stack:
            q = stack.pop()
            if q in seen or q not in metal:
                continue
            seen.add(q)
            comp.add(q)
            x, y = q
            stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
        if len(comp) >= 6:
            comps.append(comp)
    body = [p for p, c in C.items() if c != '.']
    bx = sum(x for x, _ in body) / len(body)
    by = sum(y for _, y in body) / len(body)
    far = lambda comp: max(((x - bx) ** 2 + (y - by) ** 2) for x, y in comp) + len(comp)
    head = max(comps, key=far)
    # the blade's other pieces (split by a shading line) and its darker greys
    for comp in comps:
        if comp is not head and any(max(abs(x - u), abs(y - v)) <= 2 for x, y in comp for u, v in head):
            head = head | comp
    grow = True
    while grow:
        grow = False
        for (x, y) in list(head):
            for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if q not in head and 0 <= q[0] < W and 0 <= q[1] < H and px[q][3] and grey(q) is not False and C[q] not in 'os' and grey(q):
                    head.add(q)
                    grow = True
    hx = sum(x for x, _ in head) / len(head)
    hy = sum(y for _, y in head) / len(head)
    # clear the head and the outline only it had
    clear = set(head)
    for (x, y) in head:
        for ox in (-1, 0, 1):
            for oy in (-1, 0, 1):
                q = (x + ox, y + oy)
                if C.get(q) == 'o':
                    nb = [C.get((q[0] + a, q[1] + b), '.') for a in (-1, 0, 1) for b in (-1, 0, 1) if (a or b)]
                    others = [(q[0] + a, q[1] + b) for a in (-1, 0, 1) for b in (-1, 0, 1) if (a or b) and C.get((q[0] + a, q[1] + b), '.') not in '.o' and (q[0] + a, q[1] + b) not in head]
                    if not others:
                        clear.add(q)
    # the handle's end: wood (or hand) pixels touching the head, nearest the body
    touch = [(x + a, y + b) for (x, y) in head for a in (-1, 0, 1) for b in (-1, 0, 1)
             if C.get((x + a, y + b), '.') in 'ws' and (x + a, y + b) not in head]
    if touch:
        tx, ty = min(touch, key=lambda p: (p[0] - bx) ** 2 + (p[1] - by) ** 2)
    else:
        tx, ty = min(head, key=lambda p: (p[0] - bx) ** 2 + (p[1] - by) ** 2)
    # which way the handle runs: from the wood near its end to the end; else from the body's middle
    wood = [p for p, c in C.items() if c in 'wT' and p not in head and (p[0] - tx) ** 2 + (p[1] - ty) ** 2 <= 49]
    if aim == 'handle' and len(wood) >= 3:
        dx, dy = tx - sum(x for x, _ in wood) / len(wood), ty - sum(y for _, y in wood) / len(wood)
    else:
        dx, dy = hx - bx, hy - by
    if dx * (hx - tx) + dy * (hy - ty) < 0:
        dx, dy = -dx, -dy
    L = max((dx * dx + dy * dy) ** 0.5, 1)
    dx, dy = dx / L, dy / L
    cx, cy = tx + dx * 2, ty + dy * 2
    px_, py_ = -dy, dx
    a = (round(cx - px_ * 5), round(cy - py_ * 5))
    b = (round(cx + px_ * 5), round(cy + py_ * 5))
    ax_, ay_ = b[0] - a[0], b[1] - a[1]
    LL = max((ax_ * ax_ + ay_ * ay_) ** 0.5, 1)
    n = (ay_ / LL, -ax_ / LL)
    bow = 2 if n[0] * dx + n[1] * dy > 0 else -2
    return {'clearpx': clear, 'handle': ((tx, ty), (round(cx), round(cy))), 'head': (a, b, bow), 'behind': True}

def build(look, d, src, spec, raw):
    tool, n = src
    im = Image.open(os.path.join(HERE, raw, tool, d, f'{n}.png')).convert('RGBA')
    if spec.get('auto'):
        spec = {**auto(im, spec.get('aim', 'handle')), **{k: v for k, v in spec.items() if k not in ('auto', 'aim')}}
    # the axe head's colours come from what gets cleared
    where = list(spec.get('clear', []))
    if spec.get('clearpx'):
        xs = [x for x, _ in spec['clearpx']]
        ys = [y for _, y in spec['clearpx']]
        where.append((min(xs), min(ys), max(xs), max(ys)))
    outline, light, mid, shade = sample(im, where)
    wood = handle_colour(im)
    px = im.load()
    W, H = im.size
    for (x0, y0, x1, y1) in spec.get('clear', []):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if 0 <= x < W and 0 <= y < H:
                    px[x, y] = (0, 0, 0, 0)
    for (x, y) in spec.get('clearpx', ()):
        px[x, y] = (0, 0, 0, 0)
    drawn = {}
    if 'handle' in spec:
        for p in line(*spec['handle']):
            drawn[p] = wood
    a, b, bow = spec['head']
    pts, (nx, ny) = curve(a, b, bow)
    # two px thick: the bowed (outer) edge lit, the inner edge in the mid tone, the tips shaded
    inner = (-1 if bow >= 0 else 1)
    for i, p in enumerate(pts):
        tip = i < 2 or i >= len(pts) - 2
        drawn[p] = shade if tip else light
        q = (round(p[0] + nx * inner), round(p[1] + ny * inner))
        if q not in drawn and not tip:
            drawn[q] = mid
    behind = spec.get('behind', False)
    for (x, y), c in drawn.items():
        if 0 <= x < W and 0 <= y < H and (not behind or px[x, y][3] == 0):
            px[x, y] = c + (255,)
    # outline: empty pixels touching the new pixels
    for (x, y) in list(drawn):
        if not (0 <= x < W and 0 <= y < H) or px[x, y][:3] not in (light, mid, shade, wood):
            continue
        for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            u, v = x + ox, y + oy
            if 0 <= u < W and 0 <= v < H and px[u, v][3] == 0:
                px[u, v] = outline + (255,)
    out = os.path.join(HERE, raw, 'pick', f'{d}-{tool}', f'{n}.png')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.save(out)
    # clean.mjs finds the hair in the animation's frame 0 (standing): the source swing's
    Image.open(os.path.join(HERE, raw, tool, d, '0.png')).save(os.path.join(os.path.dirname(out), '0.png'))
    # cleanTool boxes: exactly the pixels drawn here, by rows, metal for the head and wood for the handle
    boxes = []
    for part, cols in (('metal', (light, mid, shade)), ('wood', (wood,))):
        rows = {}
        for (x, y), c in drawn.items():
            if c in cols and 0 <= x < W and 0 <= y < H and px[x, y][:3] == c:
                rows.setdefault(y, []).append(x)
        for y, xs in sorted(rows.items()):
            xs.sort()
            start = prev = xs[0]
            for x in xs[1:] + [None]:
                if x is not None and x == prev + 1:
                    prev = x
                    continue
                boxes.append([start, y, prev, y, part, 'all'])
                if x is not None:
                    start = prev = x
    return f'{raw}/pick/{d}-{tool}/{n}.png', boxes

def recipe_path(look):
    return os.path.join(HERE, FRAMES.get(look, {}).get('recipe') or f'{look}.recipe.json')

if __name__ == '__main__':
    looks = sys.argv[1:] or sorted(set(FRAMES) | set(PICKED))
    ROW = {'north': 'up', 'south': 'down'}
    for look in looks:
        f = recipe_path(look)
        R = json.load(open(f, encoding='utf-8'))
        tools = R['meta'].setdefault('cleanTool', {})
        L = FRAMES.get(look)
        for d in ('north', 'south'):
            for src, spec in (L or {}).get(d, {}).items():
                path, boxes = build(look, d, src, spec, L['dir'])
                R['input'][ROW[d]][R['cols'].index(spec['col'])] = 'clean/' + path
                tools[path] = boxes
        for (d, col), (path, inside) in PICKED.get(look, {}).items():
            R['input'][ROW[d]][R['cols'].index(col)] = 'clean/' + path
            tools[path] = tag_metal(path, inside)
        with open(f, 'w', encoding='utf-8', newline='') as fh:
            json.dump(R, fh, indent=2, ensure_ascii=False)
            fh.write('\n')
        print(look, os.path.relpath(f, HERE))
