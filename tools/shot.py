"""Screenshot harness: python3 tools/shot.py <prefix>  (needs `npm run dev` on :5173, playwright + chromium)."""
import sys, os
from playwright.sync_api import sync_playwright
name = sys.argv[1] if len(sys.argv) > 1 else 'shot'
out = os.environ.get('SHOTS', '/home/claude/shots'); os.makedirs(out, exist_ok=True)
JS = lambda s: f"(() => {{ const g = window.__game.scene.getScene('Game'); {s} }})()"
with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 960, "height": 540})
    errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append("PAGEERR " + str(e)))
    pg.goto("http://127.0.0.1:5173/"); pg.wait_for_timeout(3500)
    pg.screenshot(path=f"{out}/{name}_menu.png")
    pg.mouse.click(170, 308); pg.wait_for_timeout(5500)
    pg.evaluate(JS("g.ui.closeDialogue(); g.state.introDone = true;")); pg.wait_for_timeout(600)
    pg.screenshot(path=f"{out}/{name}_campus.png")
    pg.evaluate(JS("g.player.setFeet(640, 400); g.player.dir='right'; g.player.flashOn=true; g.placeCamera(0,true);")); pg.wait_for_timeout(1200)
    pg.screenshot(path=f"{out}/{name}_campus_flash.png")
    pg.evaluate(JS("g.player.setFeet(640, 250); g.player.flashOn=false; g.placeCamera(0,true);")); pg.wait_for_timeout(1500)
    pg.screenshot(path=f"{out}/{name}_banyan.png")
    pg.evaluate(JS("g.loadMap('hall','start'); g.player.flashOn=true; g.placeCamera(0,true);")); pg.wait_for_timeout(1800)
    pg.screenshot(path=f"{out}/{name}_hall.png")
    pg.evaluate(JS("g.loadMap('classroomA','start'); g.player.flashOn=true; g.placeCamera(0,true);")); pg.wait_for_timeout(1800)
    pg.screenshot(path=f"{out}/{name}_class.png")
    pg.evaluate(JS("g.ghostT = 0;")); pg.wait_for_timeout(2500)
    pg.screenshot(path=f"{out}/{name}_crawler.png")
    print("\n".join(errs[:15]) or "no console errors")
    b.close()
