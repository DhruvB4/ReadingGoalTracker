import os
import sys
import argparse
import webbrowser
from threading import Timer
from flask import Flask, render_template, send_file, jsonify

# Setup CLI Argument Parser
parser = argparse.ArgumentParser(description="PDF Page Tracking Agent")
parser.add_argument("pdf_path", nargs="?", default=None, help="Optional path to a PDF file to preload")
parser.add_argument("--port", type=int, default=5000, help="Port to run the Flask server on (default: 5000)")
args = parser.parse_args()

app = Flask(__name__)

# Track preloaded PDF info
PRELOADED_PDF = None
PRELOADED_FILENAME = None

if args.pdf_path:
    resolved_path = os.path.abspath(args.pdf_path)
    if os.path.exists(resolved_path) and resolved_path.lower().endswith('.pdf'):
        PRELOADED_PDF = resolved_path
        PRELOADED_FILENAME = os.path.basename(resolved_path)
        print(f"\n[AGENT] Successfully preloaded: {PRELOADED_FILENAME}")
        print(f"[AGENT] Full Path: {PRELOADED_PDF}\n")
    else:
        print(f"\n[WARNING] Could not find a valid PDF file at '{args.pdf_path}'. Starting in standard mode (upload via UI).\n", file=sys.stderr)

@app.route('/')
def index():
    """Render the dashboard UI."""
    return render_template('index.html')

@app.route('/api/status')
def status():
    """API endpoint to check if a PDF has been preloaded via CLI."""
    return jsonify({
        "preloaded": PRELOADED_PDF is not None,
        "filename": PRELOADED_FILENAME
    })

@app.route('/api/pdf')
def get_pdf():
    """Stream the preloaded PDF file to the client."""
    if PRELOADED_PDF and os.path.exists(PRELOADED_PDF):
        return send_file(PRELOADED_PDF, mimetype='application/pdf')
    return jsonify({"error": "No PDF preloaded or file not found"}), 404

def open_browser():
    """Open the browser to the local server URL."""
    url = f"http://127.0.0.1:{args.port}"
    print(f"[AGENT] Opening browser to {url}...")
    webbrowser.open(url)

if __name__ == '__main__':
    # Start thread to open browser shortly after Flask begins hosting
    Timer(1.5, open_browser).start()
    
    print(f"[AGENT] Starting local server on port {args.port}...")
    # Run server without reloader to prevent the browser opening twice
    app.run(host="127.0.0.1", port=args.port, debug=False)
