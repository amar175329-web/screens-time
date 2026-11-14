#!/usr/bin/env python3
"""Build ONE self-contained HTML file from www/ (CSS, JS and the logo inlined).
Used to publish the demo as a single page. Usage: python3 tools/build_single.py [out.html]"""
import base64, io, pathlib, re, sys
root = pathlib.Path(__file__).resolve().parent.parent / 'www'
html = (root / 'index.html').read_text()
css = (root / 'css' / 'app.css').read_text()
body = re.search(r'<body>\s*(.*?)\s*<script src=', html, re.S).group(1)
body = body.replace('src="assets/logo.png"', 'src="" data-logo')
scripts = re.findall(r'<script src="(js/[^"]+)"></script>', html)
js = '\n'.join((root / p).read_text() for p in scripts).replace('</script', '<\\/script')
raw_logo = (root / 'assets' / 'logo.png').read_bytes()
try:                                    # inline a small copy (the full logo is ~200 KB); needs Pillow, else the full file is used
    from PIL import Image
    im = Image.open(io.BytesIO(raw_logo)).convert('RGBA'); im.thumbnail((256, 256))
    buf = io.BytesIO(); im.save(buf, 'PNG', optimize=True); raw_logo = buf.getvalue()
except Exception:
    pass
logo = base64.b64encode(raw_logo).decode()
out = f'''<meta name="claude:viewport-fit-sides" content="cover">
<title>Screens Time</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
<style>
{css}
</style>
{body}
<script>window.__LOGO="data:image/png;base64,{logo}";</script>
<script>
{js}
</script>
'''
dest = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parent.parent / 'dist' / 'screens-time.html'
dest.parent.mkdir(parents=True, exist_ok=True)
dest.write_text(out)
print('wrote', dest, len(out), 'bytes')
