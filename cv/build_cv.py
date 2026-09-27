"""Build the ATS-friendly CV (HTML -> PDF via Chrome, and DOCX via python-docx).

Usage (from the repo root):
    uv run --with python-docx --with pypdf cv/build_cv.py
    CV_PHONE="+57 ..." uv run --with python-docx --with pypdf cv/build_cv.py   # private copy in cv/private/

The phone number is never stored in this file; the public build omits it.
"""

import html
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

ROOT = Path(__file__).resolve().parent
NAME = "Andrés David Rincón Salazar"
TITLE = "Full Stack Developer | Angular · NestJS · TypeScript"
LOCATION = "Colombia (UTC-5) · Open to remote contract, freelance or part-time work (20+ h/week)"
EMAIL = "andresdrincons2007@gmail.com"
LINKS = [
    ("linkedin.com/in/1594-adrs", "https://www.linkedin.com/in/1594-adrs/"),
    ("github.com/1594-adrs", "https://github.com/1594-adrs"),
    ("1594-adrs.github.io", "https://1594-adrs.github.io"),
]

SUMMARY = (
    "Junior full stack developer building Angular and NestJS applications in Scrum teams at "
    "Universidad Tecnológica de Pereira. Works with TypeScript, Oracle, "
    "PostgreSQL, Git and CI/CD. Interested in full stack roles and AI code evaluation."
)

# (title, organization line or None, dates, bullets)
EXPERIENCE = [
    (
        "Software Development & Support Monitor (part-time contract)",
        "Universidad Tecnológica de Pereira — Pereira, Colombia",
        "Feb 2026 – Present",
        [
            "Develop and maintain internal web applications with Angular and NestJS on Oracle and "
            "PostgreSQL, working in Scrum teams with Git workflows and CI/CD pipelines.",
            "Contributed to the UI refactor of UTP Móvil, the university's Flutter mobile app.",
        ],
    ),
    (
        "Freelance Web Developer — AF Autoservice",
        None,
        "2026",
        [
            "Designed, built and deployed the website of a mobile auto-repair business in Colombia's "
            "Coffee Region using Astro, with on-page SEO and Vercel hosting; client reported positive "
            "results. af-autoservice.vercel.app",
        ],
    ),
]

PROJECTS = [
    (
        "Graphing Calculator — Angular, TypeScript, Canvas, Three.js",
        "Built a browser graphing calculator with a recursive-descent expression parser, adaptive "
        "Gauss–Kronrod integration and 3D solids of revolution; math engine unit-tested.",
    ),
    (
        "Portfolio — Angular 21",
        "Built with standalone components, signals and lazy routes; prerendered and deployed to "
        "GitHub Pages through a GitHub Actions pipeline (typecheck, tests, build).",
    ),
    (
        "PrereqFlow — Python, Streamlit, PyVis",
        "Modeled a 64-course, 10-semester curriculum as a directed acyclic graph with interactive "
        "visualization, semester planning and what-if simulation; 50 unit tests with pytest.",
    ),
    (
        "CSV2Binary-DBMS — C11",
        "Implemented a file-based DBMS that converts CSV data to binary and runs file-based sorting, "
        "searching and reports without loading full datasets into memory.",
    ),
    (
        "RacketChess — Racket",
        "Implemented chess move validation and check/checkmate detection using pure recursion "
        "and immutable data.",
    ),
]

SKILLS = [
    ("Languages", "TypeScript, JavaScript, Python, C, SQL, Dart"),
    ("Frontend", "Angular (signals, standalone components), Flutter, Astro, HTML, CSS"),
    ("Backend", "NestJS, REST APIs, JWT, OAuth"),
    ("Databases", "PostgreSQL, Oracle"),
    (
        "Tools & practices",
        "Git, GitLab CI/CD, GitHub Actions, Scrum, unit and e2e testing, LLM tool-calling agents, "
        "MCP; basic Linux VPS/VM setup",
    ),
]

EDUCATION = [
    ("B.S. Systems and Computer Engineering — Universidad Tecnológica de Pereira",
     "Feb 2025 – Expected 2029", []),
    ("Systems Technician — SENA", "2023 – 2024",
     ['Winner, Tecnoferia 2024 ("S.O.S-Tenibilidad" project)']),
]

CERTIFICATIONS = "Python Developer · Generative AI Usage · Prompt Engineering · Data Analysis with AI"
LANGUAGES = "Spanish (native) · English (B2 reading and writing)"


def contact_line(phone: str | None) -> list[str]:
    return [EMAIL] + ([phone] if phone else []) + [label for label, _ in LINKS]


# ---------------------------------------------------------------- HTML / PDF

CSS = """
@page { size: Letter; margin: 0.45in 0.55in; }
* { margin: 0; padding: 0; }
body { font-family: Calibri, Arial, sans-serif; font-size: 10pt; line-height: 1.2; color: #000; }
h1 { font-size: 19pt; letter-spacing: 0.5pt; text-align: center; }
.title { text-align: center; font-size: 11pt; font-weight: bold; margin-top: 1pt; }
.contact { text-align: center; font-size: 9.5pt; margin-top: 1pt; }
a { color: #000; text-decoration: none; }
h2 { font-size: 11pt; text-transform: uppercase; letter-spacing: 0.6pt; border-bottom: 0.8pt solid #000;
     margin: 5pt 0 2pt; padding-bottom: 1pt; }
.row { display: flex; justify-content: space-between; gap: 12pt; margin-top: 2pt; }
.project { margin-top: 2pt; }
.row b { font-weight: bold; }
.org { font-style: italic; }
ul { margin: 1pt 0 0 14pt; }
li { margin-bottom: 1pt; }
p { margin-top: 1pt; }
"""


def e(text: str) -> str:
    return html.escape(text, quote=False)


def build_html(phone: str | None) -> str:
    contact = " · ".join(
        [f'<a href="mailto:{EMAIL}">{EMAIL}</a>']
        + ([e(phone)] if phone else [])
        + [f'<a href="{url}">{e(label)}</a>' for label, url in LINKS]
    )
    out = [
        "<!doctype html><html lang='en'><head><meta charset='utf-8'>",
        f"<title>{e(NAME)} — CV</title><style>{CSS}</style></head><body>",
        f"<h1>{e(NAME.upper())}</h1>",
        f"<div class='title'>{e(TITLE)}</div>",
        f"<div class='contact'>{e(LOCATION)}</div>",
        f"<div class='contact'>{contact}</div>",
        "<h2>Summary</h2>",
        f"<p>{e(SUMMARY)}</p>",
        "<h2>Experience</h2>",
    ]
    for title, org, dates, bullets in EXPERIENCE:
        out.append(f"<div class='row'><b>{e(title)}</b><span>{e(dates)}</span></div>")
        if org:
            out.append(f"<div class='org'>{e(org)}</div>")
        out.append("<ul>" + "".join(f"<li>{e(b)}</li>" for b in bullets) + "</ul>")
    out.append("<h2>Projects</h2>")
    for title, bullet in PROJECTS:
        out.append(f"<p class='project'><b>{e(title)}.</b> {e(bullet)}</p>")
    out.append("<h2>Skills</h2>")
    for label, value in SKILLS:
        out.append(f"<p><b>{e(label)}:</b> {e(value)}</p>")
    out.append("<h2>Education</h2>")
    for title, dates, bullets in EDUCATION:
        out.append(f"<div class='row'><b>{e(title)}</b><span>{e(dates)}</span></div>")
        if bullets:
            out.append("<ul>" + "".join(f"<li>{e(b)}</li>" for b in bullets) + "</ul>")
    out.append(f"<h2>Certifications</h2><p>{e(CERTIFICATIONS)}</p>")
    out.append(f"<h2>Languages</h2><p>{e(LANGUAGES)}</p>")
    out.append("</body></html>")
    return "\n".join(out)


def find_chrome() -> str:
    for candidate in (
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        shutil.which("chrome") or "",
        shutil.which("google-chrome") or "",
    ):
        if candidate and Path(candidate).exists():
            return candidate
    sys.exit("Chrome not found")


def html_to_pdf(html_path: Path, pdf_path: Path) -> None:
    pdf_path.unlink(missing_ok=True)
    # A throwaway profile keeps headless Chrome from attaching to a running browser.
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as profile:
        subprocess.run(
            [
                find_chrome(), "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                f"--user-data-dir={profile}", f"--print-to-pdf={pdf_path}", html_path.as_uri(),
            ],
            check=True, capture_output=True, timeout=120,
        )
        # On Windows the launcher can exit before the PDF is flushed; wait for a stable file.
        deadline, last_size = time.monotonic() + 60, -1
        while time.monotonic() < deadline:
            size = pdf_path.stat().st_size if pdf_path.exists() else -1
            if size > 0 and size == last_size:
                return
            last_size = size
            time.sleep(0.5)
        sys.exit(f"Chrome did not write {pdf_path}")


# ---------------------------------------------------------------- DOCX

def set_bottom_border(paragraph) -> None:
    p_pr = paragraph._p.get_or_add_pPr()
    borders = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    for key, val in (("val", "single"), ("sz", "6"), ("space", "1"), ("color", "000000")):
        bottom.set(qn(f"w:{key}"), val)
    borders.append(bottom)
    p_pr.append(borders)


def build_docx(phone: str | None, path: Path) -> None:
    doc = Document()
    section = doc.sections[0]
    section.page_width, section.page_height = Inches(8.5), Inches(11)
    section.top_margin = section.bottom_margin = Inches(0.45)
    section.left_margin = section.right_margin = Inches(0.55)
    right_tab = section.page_width - section.left_margin - section.right_margin

    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(10)
    normal.paragraph_format.space_after = Pt(0)
    normal.paragraph_format.space_before = Pt(0)
    normal.paragraph_format.line_spacing = 1.0

    for style_name, size in (("Title", 19), ("Heading 1", 11)):
        style = doc.styles[style_name]
        style.font.name = "Calibri"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor(0, 0, 0)
        # python-docx needs the east-asian/theme font overridden too
        r_fonts = style.element.get_or_add_rPr().get_or_add_rFonts()
        for attr in ("w:ascii", "w:hAnsi", "w:cs"):
            r_fonts.set(qn(attr), "Calibri")
        for attr in ("w:asciiTheme", "w:hAnsiTheme", "w:cstheme"):
            r_fonts.attrib.pop(qn(attr), None)

    bullet = doc.styles["List Bullet"]
    bullet.font.size = Pt(10)
    bullet.paragraph_format.space_after = Pt(0)
    bullet.paragraph_format.left_indent = Inches(0.2)

    def para(text="", style=None, align=None, size=None, bold=False, italic=False):
        p = doc.add_paragraph(style=style)
        if text:
            run = p.add_run(text)
            run.bold, run.italic = bold, italic
            if size:
                run.font.size = Pt(size)
        if align is not None:
            p.alignment = align
        return p

    title = doc.add_paragraph(NAME.upper(), style="Title")
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.paragraph_format.space_after = Pt(0)
    title.paragraph_format.space_before = Pt(0)
    # The default template's Title style draws its own border; disable it.
    p_pr = title._p.get_or_add_pPr()
    for existing in p_pr.findall(qn("w:pBdr")):
        p_pr.remove(existing)
    none_border = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "nil")
    none_border.append(bottom)
    p_pr.append(none_border)

    para(TITLE, align=WD_ALIGN_PARAGRAPH.CENTER, size=11, bold=True)
    para(LOCATION, align=WD_ALIGN_PARAGRAPH.CENTER, size=9.5)
    para(" · ".join(contact_line(phone)), align=WD_ALIGN_PARAGRAPH.CENTER, size=9.5)

    def heading(text):
        h = doc.add_paragraph(text.upper(), style="Heading 1")
        h.paragraph_format.space_before = Pt(5)
        h.paragraph_format.space_after = Pt(1)
        set_bottom_border(h)

    def row(left, right=""):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.tab_stops.add_tab_stop(right_tab, WD_TAB_ALIGNMENT.RIGHT)
        p.add_run(left).bold = True
        if right:
            p.add_run("\t" + right)

    def bullets(items):
        for item in items:
            doc.add_paragraph(item, style="List Bullet")

    heading("Summary")
    para(SUMMARY)
    heading("Experience")
    for t, org, dates, items in EXPERIENCE:
        row(t, dates)
        if org:
            para(org, italic=True)
        bullets(items)
    heading("Projects")
    for t, item in PROJECTS:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(2)
        p.add_run(f"{t}. ").bold = True
        p.add_run(item)
    heading("Skills")
    for label, value in SKILLS:
        p = doc.add_paragraph()
        p.add_run(f"{label}: ").bold = True
        p.add_run(value)
    heading("Education")
    for t, dates, items in EDUCATION:
        row(t, dates)
        bullets(items)
    heading("Certifications")
    para(CERTIFICATIONS)
    heading("Languages")
    para(LANGUAGES)

    doc.core_properties.author = NAME
    doc.core_properties.title = f"{NAME} — CV"
    doc.save(path)


# ---------------------------------------------------------------- main

def write_web_copy(html_path: Path, dest_dir: Path) -> Path:
    """Publish the (phone-free) CV HTML at /cv/, with SEO tags and a back link."""
    content = html_path.read_text(encoding="utf-8")
    head_extra = (
        "<link rel='canonical' href='https://1594-adrs.github.io/cv/'>"
        "<meta name='description' content=\"CV of Andrés Rincón, junior full stack developer "
        "(Angular, NestJS, TypeScript) and Systems and Computer Engineering student at "
        "Universidad Tecnológica de Pereira.\">"
        "<link rel='alternate' type='application/pdf' "
        "href='https://1594-adrs.github.io/Andres_Rincon_CV.pdf'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'>"
        "<style>@media screen{body{max-width:8.5in;margin:24px auto;padding:0 16px}}</style>"
    )
    content = content.replace("</head>", head_extra + "</head>")
    content = content.replace(
        "<body>",
        "<body><p style='margin:0 0 6pt;font-size:9pt'>"
        "<a href='https://1594-adrs.github.io/'>&larr; Portfolio</a></p>",
    )
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / "index.html"
    dest_path.write_text(content, encoding="utf-8")
    return dest_path


def build(out_dir: Path, phone: str | None) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    html_path = out_dir / "Andres_Rincon_CV.html"
    pdf_path = out_dir / "Andres_Rincon_CV.pdf"
    html_path.write_text(build_html(phone), encoding="utf-8")
    html_to_pdf(html_path, pdf_path)
    build_docx(phone, out_dir / "Andres_Rincon_CV.docx")

    from pypdf import PdfReader

    pages = len(PdfReader(pdf_path).pages)
    print(f"{pdf_path}: {pages} page(s)")
    if pages != 1:
        sys.exit("CV must fit on one page")
    return pdf_path


if __name__ == "__main__":
    public_pdf = build(ROOT, None)
    shutil.copyfile(public_pdf, ROOT.parent / "portfolio" / "public" / "Andres_Rincon_CV.pdf")
    write_web_copy(
        ROOT / "Andres_Rincon_CV.html", ROOT.parent / "portfolio" / "public" / "cv"
    )
    phone = os.environ.get("CV_PHONE")
    if phone:
        build(ROOT / "private", phone)
