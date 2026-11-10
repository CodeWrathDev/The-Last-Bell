"""Headless check of the perspective renderer on the real maps. Usage: python3 tools/view3d/shots.py [outdir]
Starts a static server on :5199, renders each map, walks the rig around, reports timings + console errors."""
import sys, os, subprocess, time, json
from playwright.sync_api import sync_playwright
root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shots3d'; os.makedirs(out, exist_ok=True)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '5199', '--bind', '127.0.0.1'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
errs = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-sandbox'])
        pg = b.new_page(viewport={'width': 960, 'height': 540})
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
        pg.goto('http://127.0.0.1:5199/tools/view3d/harness.html'); pg.wait_for_function('window.READY === true', timeout=20000)
        def shot(name, **kw):
            ms = pg.evaluate('(kw) => H.frame(kw)', kw); pg.locator('#c').screenshot(path=f'{out}/{name}.png'); return round(ms, 1)
        steps = json.loads(os.environ.get('STEPS', '[]'))
        for (name, mp, spawn, kw) in [('hall', 'hall', 'fromClassroomA', {}), ('hall_flash', 'hall', 'start', {'flash': True}), ('class', 'classroomA', 'fromHall', {}), ('library', 'library', 'fromHall', {'flash': True}), ('campus', 'campus', 'start', {})]:
            pg.evaluate('([a,b]) => H.enter(a,b)', [mp, spawn])
            for _ in range(30): pg.evaluate('H.frame({})')
            print(name, 'render ms', shot(name, **kw))
        print('errors:', errs[:10] or 'none')
        b.close()
finally:
    srv.terminate()
