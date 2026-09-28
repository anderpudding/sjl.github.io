"""
Generates the redirect pages served by GitHub Pages at the old address
(https://anderpudding.github.io/sjl.github.io/), sending every old link to the
same page on the new site.

To change the destination (e.g. after adding a custom domain), edit NEW_SITE
and run:  python3 generate.py
"""
from pathlib import Path

NEW_SITE = 'https://sungjun.sungjun-dev.workers.dev'

# Old page → new path.
PAGES = {
    'index.html': '/',
    'about.html': '/about',
    'project.html': '/projects',
    'courses.html': '/courses',
    'learning.html': '/learning',
    'book_reviews.html': '/books',
    'thoughts.html': '/thoughts',
    'bucketlist.html': '/bucketlist',
    'lol.html': '/lol',
    'contact.html': '/contact',
}

# Old in-page anchors that now have their own pages.
ANCHORS = {
    'project.html': ['algoquant', 'blackjack', 'teamtracker', 'dateplanner', 'weathersmart'],
}

STYLE = 'background:#1a1b26;color:#c0caf5;font-family:Consolas,Monaco,monospace;padding:2rem;line-height:1.6'
LINK = 'color:#9ece6a'


def page(target: str, script: str) -> str:
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Moved — Sungjun Lee</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="{target}">
<meta http-equiv="refresh" content="0; url={target}">
<script>{script}</script>
</head>
<body style="{STYLE}">
<p>guest@ubc ~ → cd <a style="{LINK}" href="{target}">{target}</a></p>
<p>This site has moved. If you are not redirected, follow the link above.</p>
</body>
</html>
'''


def main() -> None:
    root = Path(__file__).parent
    for old, new in PAGES.items():
        target = NEW_SITE + new
        anchors = ANCHORS.get(old, [])
        # Keep the query and hash; a known anchor becomes its own page.
        script = (
            f"var h=location.hash.slice(1),a={anchors!r};"
            f"location.replace(a.indexOf(h)>=0?'{target}/'+h:'{target}'+location.search+location.hash);"
        )
        (root / old).write_text(page(target, script))

    # Anything else (PDFs, typos, deep paths) lands on GitHub's 404 page: forward it by path.
    fallback = (
        "var p=location.pathname.replace(/^\\/sjl\\.github\\.io/,'')||'/';"
        "if(decodeURIComponent(p)==='/pdf/CV 2.pdf')p='/pdf/cv.pdf';"
        f"location.replace('{NEW_SITE}'+p+location.search+location.hash);"
    )
    (root / '404.html').write_text(page(NEW_SITE, fallback))
    (root / '.nojekyll').write_text('')


if __name__ == '__main__':
    main()
