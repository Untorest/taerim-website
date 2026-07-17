#!/usr/bin/env python3
"""빌드 스크립트 — 사례·공지 데이터를 정적 HTML로 렌더 + 폰트 재서브셋 (ADR 0002).

사용법:
    python3 build.py            # cases/notices 렌더 + 폰트 서브셋
    python3 build.py --no-fonts # 렌더만

사례 추가 = data/cases.json에 항목 추가 후 이 스크립트 실행이 전부다.
"""
import json, html, re, sys, subprocess, shutil, string
from pathlib import Path

ROOT = Path(__file__).parent
FONT_VENV = Path("/tmp/claude-0/-root/c97de24e-42a6-49ba-bd1c-29b22a9213f9/scratchpad/fonts/venv/bin/pyftsubset")


def esc(s):
    return html.escape(s, quote=False) if s else ""


def kdate(iso):  # "2026-07-01" → "2026년 7월"
    y, m, _ = iso.split("-")
    return f"{y}년 {int(m)}월"


def render_case(c):
    photo = (
        f'<img src="{esc(c["photos"][0])}" alt="{esc(c["title"])}" loading="lazy">'
        if c.get("photos") else "사례 사진 자리"
    )
    body = [
        f'<p class="meta">{kdate(c["date"])} · 사진 기록</p>',
        f'<h3>{esc(c["title"])}</h3>',
    ]
    if c.get("story"):
        author = f'<cite>{esc(c.get("story_author") or "")}</cite>' if c.get("story_author") else ""
        body.append(f'<blockquote class="story">“{esc(c["story"])}”{author}</blockquote>')
    elif c.get("caption"):
        body.append(f'<p class="cap">{esc(c["caption"])}</p>')
    return (
        '      <article class="case-card">\n'
        f'        <div class="photo-slot">{photo}</div>\n'
        '        <div class="case-body">\n          ' + "\n          ".join(body) + "\n"
        "        </div>\n      </article>"
    )


def render_branch(b):
    facts = []
    if b.get("director"):
        facts.append(f'<li><span class="k">원장</span>{esc(b["director"])}</li>')
    if b.get("address"):
        facts.append(f'<li><span class="k">주소</span>{esc(b["address"])}</li>')
    note = f'<p class="b-note">{esc(b["note"])}</p>' if b.get("note") else ""
    tel = (f'<a class="b-tel" href="tel:{esc(b["phone"])}">{esc(b["phone"])}</a>'
           if b.get("phone") else "")
    return (
        '      <article class="branch-card">\n'
        f'        <span class="region">{esc(b["region"])}</span>\n'
        f'        <h3>{esc(b["name"])}</h3>\n'
        f'        {note}\n'
        f'        <ul class="b-facts">{"".join(facts)}</ul>\n'
        f'        {tel}\n'
        '      </article>'
    )


def render_notice(n):
    return (
        f'      <li><span class="date">{kdate(n["date"])}</span>'
        f'<span><span class="title">{esc(n["title"])}</span>'
        f'<span class="body" style="display:block">{esc(n["body"])}</span></span></li>'
    )


def splice(path, start, end, content):
    t = path.read_text(encoding="utf-8")
    pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    if not pattern.search(t):
        sys.exit(f"ERROR: {path.name}에 {start} 마커가 없습니다")
    path.write_text(pattern.sub(start + "\n" + content + "\n      " + end, t), encoding="utf-8")
    print(f"  {path.name} 갱신")


def subset_fonts():
    pyft = None
    if FONT_VENV.exists():
        pyft = str(FONT_VENV)
    elif shutil.which("pyftsubset"):
        pyft = "pyftsubset"
    if not pyft:
        print("  ! pyftsubset 없음 — 폰트 서브셋 건너뜀 (pip install fonttools brotli)")
        return
    chars = set(string.printable) | set("“”‘’·…→−○✓✦℃%()[]{}")
    for f in list(ROOT.glob("*.html")) + list((ROOT / "data").glob("*.json")):
        chars |= set(f.read_text(encoding="utf-8"))
    glyphs = ROOT / "fonts" / "glyphs.txt"
    glyphs.write_text("".join(sorted(c for c in chars if not c.isspace() or c == " ")), encoding="utf-8")
    jobs = [
        ("src/PretendardVariable.woff2", "pretendard-sub.woff2"),
        ("src/NotoSerifKR.ttf", "serif-sub.woff2"),
    ]
    for src, out in jobs:
        subprocess.run(
            [pyft, str(ROOT / "fonts" / src), f"--text-file={glyphs}",
             "--flavor=woff2", "--layout-features=*",
             f"--output-file={ROOT / 'fonts' / out}"],
            check=True,
        )
        size = (ROOT / "fonts" / out).stat().st_size // 1024
        print(f"  fonts/{out} ({size}KB)")


def main():
    cases = sorted(json.loads((ROOT / "data" / "cases.json").read_text(encoding="utf-8")),
                   key=lambda c: c["date"], reverse=True)
    notices = sorted(json.loads((ROOT / "data" / "notices.json").read_text(encoding="utf-8")),
                     key=lambda n: n["date"], reverse=True)

    print("사례 렌더:")
    splice(ROOT / "index.html", "<!-- CASES:START -->", "<!-- CASES:END -->",
           "\n".join(render_case(c) for c in cases[:3]))
    splice(ROOT / "cases.html", "<!-- CASES:START -->", "<!-- CASES:END -->",
           "\n".join(render_case(c) for c in cases))
    print("공지 렌더:")
    splice(ROOT / "index.html", "<!-- NOTICES:START -->", "<!-- NOTICES:END -->",
           "\n".join(render_notice(n) for n in notices))

    branches_file = ROOT / "data" / "branches.json"
    if branches_file.exists():
        branches = json.loads(branches_file.read_text(encoding="utf-8"))
        print("분가 연수원 렌더:")
        splice(ROOT / "branches.html", "<!-- BRANCHES:START -->", "<!-- BRANCHES:END -->",
               "\n".join(render_branch(b) for b in branches))

    if "--no-fonts" not in sys.argv:
        print("폰트 서브셋:")
        subset_fonts()
    print(f"완료 — 사례 {len(cases)}건, 공지 {len(notices)}건")


if __name__ == "__main__":
    main()
