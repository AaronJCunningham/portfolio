"""Local-only capture helper. Run, then open http://127.0.0.1:4174/.

The browser asks the operator to share the Six seas tab. Only that selected tab
is recorded. Raw captures are saved under .cache/six-seas for export.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public/experiments/ocean-cube'
OUTPUT = ROOT / '.cache/six-seas'
OUTPUT.mkdir(parents=True, exist_ok=True)

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SOURCE), **kwargs)

    def do_GET(self):
        if self.path in ('/', '/index.html'):
            data = (SOURCE / 'index.html').read_text().replace('</body>', '<script src="/__capture.js"></script></body>').encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        elif self.path == '/__capture.js':
            data = (ROOT / 'scripts/ocean-cube-capture.js').read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'application/javascript')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        else:
            super().do_GET()

    def do_POST(self):
        files = {'/__capture.mp4': 'page-capture.mp4', '/__capture.webm': 'page-capture.webm', '/__poster.jpg': 'page-capture.jpg'}
        if self.path not in files or self.headers.get('Origin') != 'http://127.0.0.1:4174':
            self.send_error(403)
            return
        length = int(self.headers.get('Content-Length', '0'))
        if not 0 < length <= 150_000_000:
            self.send_error(413)
            return
        data = self.rfile.read(length)
        if len(data) != length:
            self.send_error(400)
            return
        (OUTPUT / files[self.path]).write_bytes(data)
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'saved': files[self.path], 'bytes': len(data)}).encode())

print('Capture ready: http://127.0.0.1:4174/', flush=True)
ThreadingHTTPServer(('127.0.0.1', 4174), Handler).serve_forever()
