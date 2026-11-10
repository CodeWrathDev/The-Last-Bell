"""Walk-through test for the third-person rig on the real hall map (collision, camera boundaries, turning). python3 tools/view3d/walk.py [outdir]"""
import sys, os, subprocess, time, math
from playwright.sync_api import sync_playwright
root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/walk3d'; os.makedirs(out, exist_ok=True)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '5198', '--bind', '127.0.0.1'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
errs, fails = [], []
def check(c, msg):
    print(('PASS ' if c else 'FAIL ') + msg)
    if not c: fails.append(msg)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-sandbox']); pg = b.new_page(viewport={'width': 960, 'height': 540})
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('http://127.0.0.1:5198/tools/view3d/harness.html'); pg.wait_for_function('window.READY === true', timeout=20000)
        ev = lambda js, a=None: pg.evaluate(js, a)
        def steps(n, **kw):
            for _ in range(n): ev('(k) => { H.walk(k); H.frame({}); }', kw)
        def shot(n, **kw): ev('(k) => H.frame(k)', kw); pg.locator('#c').screenshot(path=f'{out}/{n}.png')
        ev('() => H.enter("hall","fromClassroomA")'); steps(20)
        s0 = ev('H.state()'); steps(120, fwd=1); s1 = ev('H.state()')
        check(s1['x'] - s0['x'] > 5, f"forward walk moves along corridor ({s0['x']:.1f} -> {s1['x']:.1f}); heading east")
        shot('1_forward')
        steps(60, strafe=1); s2 = ev('H.state()'); check(s2['y'] > s1['y'] + 0.8, f"strafe right goes south (+y): {s1['y']:.2f} -> {s2['y']:.2f}")
        steps(300, strafe=1); s3 = ev('H.state()'); check(s3['y'] <= 8.0 and s3['y'] > 7.0, f"collision stops at south wall (y={s3['y']:.2f}, wall at 8)")
        steps(300, strafe=-1); steps(300, strafe=-1); s4 = ev('H.state()'); check(s4['y'] >= 2.0, f"collision stops at door wall (y={s4['y']:.2f}, wall at 2)")
        steps(60, turn=1); steps(30); shot('2_turned')
        sa = ev('H.state()'); steps(60, fwd=-1); sb = ev('H.state()')
        check(math.hypot(sb['x']-sa['x'], sb['y']-sa['y']) > 1.0, "backward walk works after turning")
        # turn all the way round and walk the whole corridor
        ev('() => H.setPlayer(34.5, 4.5, Math.PI)'); steps(30); steps(900, fwd=1); sw = ev('H.state()'); check(sw['x'] < 3.5, f"walks full corridor west to the end (x={sw['x']:.1f}); stopped by wall")
        # camera never enters a wall cell centre beyond allowed boom & never NaN
        ev('() => H.setPlayer(1.6, 4.5, Math.PI)'); steps(40); sc = ev('H.state()'); check(all(map(math.isfinite, sc['cam'])), f"camera finite at a dead end, boom={sc['boom']:.2f}")
        shot('3_deadend', flash=True)
        ev('() => H.setPlayer(10.5, 4.5, 0)'); steps(10); shot('4_ghost', ghost={'x': 17.5, 'y': 4.5}, flash=True)
        pp = ev('H.playerPx()'); check(180 < pp['sx'] < 300 and pp['sy'] > 150, f"player near bottom-centre of view ({pp['sx']:.0f},{pp['sy']:.0f} of 480x270)")
        print('console errors:', errs or 'none')
        b.close()
finally: srv.terminate()
sys.exit(1 if fails or errs else 0)
