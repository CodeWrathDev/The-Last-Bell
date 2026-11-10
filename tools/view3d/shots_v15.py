"""Extra viewpoints for the v15 art pass. Usage: python3 tools/view3d/shots_v15.py [outdir]
Each view = (name, map, [tileX, tileY], headingRadians, opts). North is -pi/2."""
import sys, os, subprocess, time, json, math
from playwright.sync_api import sync_playwright
root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shots_v15'; os.makedirs(out, exist_ok=True)
N = -math.pi / 2
VIEWS = json.loads(os.environ['VIEWS']) if os.environ.get('VIEWS') else [
    ('gate_view', 'campus', [19.5, 21.5], N, {}),
    ('mid_view', 'campus', [19.5, 15.5], N, {}),
    ('porch_view', 'campus', [19.5, 9.5], N, {}),
    ('west_view', 'campus', [12.5, 17.5], math.pi, {}),
    ('east_view', 'campus', [24.5, 12.5], 0, {}),
    ('guard_view', 'campus', [9.5, 19.5], math.pi, {}),
]
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '5199', '--bind', '127.0.0.1'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); errs = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-sandbox'])
        pg = b.new_page(viewport={'width': 960, 'height': 540})
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
        pg.goto('http://127.0.0.1:5199/tools/view3d/harness.html'); pg.wait_for_function('window.READY === true', timeout=20000)
        for (name, mp, tile, hd, kw) in VIEWS:
            pg.evaluate('([a, pos, hd]) => H.enter(a, "start", { x: pos[0] * 32, y: pos[1] * 32 }, hd)', [mp, tile, hd])
            for _ in range(30): pg.evaluate('(kw) => H.frame(kw)', kw)
            pg.locator('#c').screenshot(path=f'{out}/{name}.png')
        print('errors:', errs[:10] or 'none')
        b.close()
finally:
    srv.terminate()
