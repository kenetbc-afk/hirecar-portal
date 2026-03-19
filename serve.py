#!/usr/bin/env python3
"""Simple HTTP server for the HIRECAR member portal."""
import http.server
import socketserver
import sys
import os

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8090
directory = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", port), Handler) as httpd:
    print(f"Serving {directory} on http://localhost:{port}")
    httpd.serve_forever()
