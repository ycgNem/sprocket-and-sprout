# The Harvest Crane's facings (the owner after 2.0: the crane couldn't be rotated). Facing 0 is the
# original PixelLab art (boom to the right); 2 is its mirror; 1 (boom toward you) and 3 (boom away)
# are hand-pixeled here from the same colours and parts. Each facing has the claw at three heights
# (frames 0, 1, 2; frame 3 reuses 1; the idle frame is frame 0), like the original's bob.
# Run: python art/factory/crane/build.py  -> art/factory/crane/r<facing>-f<frame>.png (17x30)
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PAL = {'a': '#2e222f', 'b': '#f57d4a', 'c': '#e6904e', 'd': '#cd683d', 'e': '#45293f', 'f': '#9e4539',
       'g': '#fbb954', 'h': '#6e2727', 'i': '#f9c22b', 'j': '#ea4f36', 'k': '#91db69', 'l': '#239063', 'm': '#1ebc73'}
W, H = 17, 30

CLAW = ['.aca.', '.agaa', 'acada', 'ahkfa', '.alm.']
BASE = ['.aadea.', 'afadefa', 'affhhfa', 'accccda', 'afffffa', 'aaaeeea']

def put(g, x, y, rows):
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch != '.' and 0 <= x + dx < W and 0 <= y + dy < H:
                g[y + dy][x + dx] = ch

def blank():
    return [['.'] * W for _ in range(H)]

def post(g, x, top, bottom):
    """a 3-wide post from row top to bottom (inclusive): outline, wood, the red band"""
    for y in range(top, bottom + 1):
        mid = 'j' if y == 19 else 'h' if y in (top + 1, 17) else 'f' if y == 18 else 'd'
        put(g, x, y, ['a' + mid + 'a'])
    put(g, x, top - 1, ['aba'])

# facing 1: the boom swung toward you (down-right), the counterweight and lamp behind (up-left)
def facing1(drop):
    g = blank()
    post(g, 7, 12, 23)
    put(g, 5, 24, BASE)
    put(g, 3, 7, [
        '.aa......',
        'aiha.....',
        'ahfaa....',
        '.aadaa...',
        '...aada..',
    ])
    # the boom: thick (nearer), its lit top edge facing up, reaching out to the bottom-right
    put(g, 7, 10, [
        'aaaa.....',
        'adgga....',
        'adfggaa..',
        '.ahfggaa.',
        '..aahfgca',
        '....aahda',
        '......aea',
    ])
    for y in range(17, 18 + drop):
        put(g, 14, y, ['a'])
    put(g, 12, 18 + drop, CLAW)
    return g

# facing 3: the boom swung away (up-right), the counterweight and lamp toward you (down-left)
def facing3(drop):
    g = blank()
    post(g, 7, 12, 23)
    put(g, 5, 24, BASE)
    # the boom rising away, thinner (further), up to the top-right
    put(g, 7, 3, [
        '......aa.',
        '.....agca',
        '....agfa.',
        '...agfa..',
        '..agfa...',
        '.agfa....',
        'agfa.....',
        'afa......',
    ])
    # rope from the tip, the claw hanging beside the post
    for y in range(6, 10 + drop):
        put(g, 14, y, ['a'])
    put(g, 12, 10 + drop, CLAW)
    # counterweight toward you, its lamp lit
    put(g, 2, 12, [
        '....aa',
        '...ada',
        'aaahfa',
        'aihaa.',
        'ahfa..',
        '.aa...',
    ])
    return g

def save(g, name):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for y in range(H):
        for x in range(W):
            ch = g[y][x]
            if ch != '.':
                h = PAL[ch]
                im.putpixel((x, y), (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255))
    im.save(os.path.join(HERE, name))
    return im

if __name__ == '__main__':
    for f, drop in ((0, 0), (1, 1), (2, 2)):
        save(facing1(drop), f'r1-f{f}.png')
        save(facing3(drop), f'r3-f{f}.png')
