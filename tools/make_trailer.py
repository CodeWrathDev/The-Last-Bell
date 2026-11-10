"""Capture a short release trailer from the real game build.

Usage: python3 tools/make_trailer.py [url]
The script uses Chromium + Playwright for the gameplay capture, then ffmpeg
adds title cards, a restrained drone, and the project's own door/monster hits.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# The container ships Playwright's Python bindings separately from the Node
# driver used by the desktop browser tools. Point the bindings at that bundled
# driver so the capture script works without installing anything globally.
import playwright._impl._transport as _pw_transport
_pw_transport.compute_driver_executable = lambda: (
    os.environ.get("PLAYWRIGHT_NODEJS_PATH", "/usr/bin/node"),
    "/usr/lib/chatgpt/resources/cua_node/lib/node_modules/playwright/cli.js",
)
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "trailer.mp4"
URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5174/"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def capture(raw_dir: Path) -> Path:
    raw_dir.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/usr/bin/google-chrome",
            args=["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
        )
        context = browser.new_context(viewport={"width": 960, "height": 540})
        page = context.new_page()
        page.goto(URL)
        page.wait_for_function("window.__game && window.__game.scene", timeout=20000)

        frame = 0
        def shoot() -> None:
            nonlocal frame
            page.screenshot(path=str(raw_dir / f"{frame:06d}.png"))
            frame += 1

        def hold(seconds: float) -> None:
            # Screenshot capture avoids a dependency on Playwright's optional
            # bundled ffmpeg. The final ffmpeg pass converts the frame stream.
            for _ in range(max(1, round(seconds * 10))):
                page.wait_for_timeout(100)
                shoot()

        # Let the title breathe, then use the real Phaser scene and map logic
        # to frame the most readable moments of the game for a deterministic
        # capture. This does not add any trailer-only art to the project.
        hold(3.2)
        page.evaluate("localStorage.clear(); window.__game.scene.start('Game', {mode:'new'});")
        hold(2.2)

        def ev(script: str) -> None:
            page.evaluate("(s) => { const g = window.__game.scene.getScene('Game'); const u = window.__game.scene.getScene('UI'); s(g, u); }", script)

        # The callback is constructed inside the page so the game is the only
        # source of visuals; each scene is a real map from the shipped build.
        def set_state(js: str) -> None:
            page.evaluate(f"""() => {{
              const g = window.__game.scene.getScene('Game');
              const u = window.__game.scene.getScene('UI');
              {js}
              g.ui?.refreshObjective?.(); g.placeCamera(0, true);
            }}""")

        set_state("g.state.introDone=true; g.story.chapter='ch1'; g.story.flags=new Set(); g.loadMap('campus','start');")
        hold(3.8)
        page.keyboard.down("w")
        hold(1.8)
        page.keyboard.up("w")
        hold(0.9)

        # The hallway is shown after the chapter transition so the title card
        # and objective naturally read as the first playable night.
        set_state("g.story.chapter='ch2'; g.story.flags=new Set(['transformed']); g.loadMap('hall','start'); g.player.flashOn=true;")
        hold(1.2)
        page.keyboard.down("w")
        hold(2.5)
        page.keyboard.up("w")
        hold(1.0)

        set_state("g.story.chapter='ch2'; g.story.flags=new Set(['transformed']); g.loadMap('classroomA','fromHall'); g.player.flashOn=true;")
        hold(3.6)

        # A real Chapter 3 monster encounter: the ghost is spawned by the
        # normal GameScene timer and is attracted by an actual running sound.
        set_state("g.story.chapter='ch3'; g.story.flags=new Set(['transformed','power_on']); g.loadMap('hall','start'); g.ghostT=0; g.player.flashOn=false;")
        hold(2.2)
        page.keyboard.down("Shift")
        page.keyboard.down("w")
        hold(3.2)
        page.keyboard.up("w")
        page.keyboard.up("Shift")
        hold(3.2)

        # The final visual hook: the same gate route, but with the girl's form
        # already revealed. It gives the trailer a clear horror payoff.
        set_state("g.story.chapter='final'; g.story.girlForm='crawler'; g.loadMap('campus','atGate'); g.ghostT=0; g.player.flashOn=true;")
        hold(5.2)

        context.close()
        browser.close()
        return raw_dir


def make_cards(tmp: Path) -> tuple[Path, Path]:
    title = tmp / "title.mp4"
    end = tmp / "end.mp4"
    common = ["-f", "lavfi", "-r", "30", "-t"]
    run(["ffmpeg", "-y", *common, "3", "-i", "color=c=0x05070f:s=1920x1080", "-vf", f"drawtext=fontfile={FONT}:text='THE LAST BELL':fontcolor=white:fontsize=92:x=(w-text_w)/2:y=430,drawtext=fontfile={FONT}:text='A haunted school story':fontcolor=0xb8434a:fontsize=34:x=(w-text_w)/2:y=560", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(title)])
    run(["ffmpeg", "-y", *common, "4", "-i", "color=c=0x05070f:s=1920x1080", "-vf", f"drawtext=fontfile={FONT}:text='THE LAST BELL':fontcolor=white:fontsize=76:x=(w-text_w)/2:y=390,drawtext=fontfile={FONT}:text='Some friendships never end.':fontcolor=0xcfd8ff:fontsize=34:x=(w-text_w)/2:y=510,drawtext=fontfile={FONT}:text='Wishlist / play now':fontcolor=0xe8c46a:fontsize=28:x=(w-text_w)/2:y=590", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(end)])
    return title, end


def build_video(raw: Path, title: Path, end: Path, tmp: Path) -> None:
    gameplay = tmp / "gameplay.mp4"
    joined = tmp / "joined.mp4"
    audio = tmp / "trailer_audio.m4a"
    run(["ffmpeg", "-y", "-framerate", "10", "-i", str(raw / "%06d.png"), "-vf", "scale=1920:1080:flags=neighbor,format=yuv420p", "-an", "-c:v", "libx264", "-preset", "fast", str(gameplay)])
    concat = tmp / "concat.txt"
    concat.write_text(f"file '{title}'\nfile '{gameplay}'\nfile '{end}'\n")
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-c", "copy", str(joined)])

    roar = ROOT / "public/assets/audio/monster/roar_long.mp3"
    slam = ROOT / "public/assets/audio/doors/door_slam.mp3"
    knock = ROOT / "public/assets/audio/monster/glass_knock.mp3"
    run([
        "ffmpeg", "-y", "-f", "lavfi", "-i", "sine=frequency=74:sample_rate=48000:duration=55",
        "-i", str(slam), "-i", str(knock), "-i", str(roar),
        "-filter_complex", "[0:a]volume=0.055[drone];[1:a]adelay=9000|9000,volume=0.55[slam];[2:a]adelay=24000|24000,volume=0.38[knock];[3:a]adelay=33000|33000,volume=0.50[roar];[drone][slam][knock][roar]amix=inputs=4:duration=longest:normalize=0[a]",
        "-map", "[a]", "-c:a", "aac", "-b:a", "160k", str(audio),
    ])
    run(["ffmpeg", "-y", "-i", str(joined), "-i", str(audio), "-map", "0:v", "-map", "1:a", "-shortest", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", str(OUT)])


def main() -> None:
    if not shutil.which("ffmpeg"):
        raise SystemExit("ffmpeg is required to build the trailer")
    with tempfile.TemporaryDirectory(prefix="last-bell-trailer-") as d:
        tmp = Path(d)
        raw = capture(tmp / "raw")
        title, end = make_cards(tmp)
        build_video(raw, title, end, tmp)
    print(OUT)


if __name__ == "__main__":
    main()
