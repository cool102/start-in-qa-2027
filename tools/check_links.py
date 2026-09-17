"""Проверка ссылок во всех data/*.csv и content/*.md.
Запуск: python tools/check_links.py        (нужен Python 3.9+, без внешних библиотек)
Выводит ссылки с ошибками. Некоторые сайты (hh.ru, t.me) могут отвечать 403 роботам —
такие ссылки откройте руками в браузере, прежде чем помечать как битые.
"""
import csv, re, pathlib, urllib.request, urllib.error, ssl, concurrent.futures as cf

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = re.compile(r"https?://[^\s;,)«»\"'<>\]]+")
urls = {}
for p in list((ROOT / "data").glob("*.csv")) + list((ROOT / "content").glob("*.md")):
    for u in URL.findall(p.read_text(encoding="utf-8")):
        urls.setdefault(u.rstrip(".|"), set()).add(p.name)

ctx = ssl.create_default_context()
def check(u):
    req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 (link-check; start-in-qa-2027)"})
    try:
        with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
            return u, r.status
    except urllib.error.HTTPError as e:
        return u, e.code
    except Exception as e:
        return u, type(e).__name__

with cf.ThreadPoolExecutor(8) as ex:
    results = list(ex.map(check, sorted(urls)))
bad = [(u, s) for u, s in results if not (isinstance(s, int) and s < 400)]
print(f"Проверено ссылок: {len(results)}; с ошибкой: {len(bad)}")
for u, s in bad:
    print(f"{s}\t{u}\t← {', '.join(sorted(urls[u]))}")
