# 📖 Reading Goal Tracker

A local, browser-based PDF reading dashboard that lets you set a daily page goal and track your progress in real time — complete with confetti, audio feedback, and a sleek glassmorphic UI.

---

## Features

- **PDF Viewer** — Renders PDF files directly in the browser using PDF.js with high-DPI canvas output.
- **Daily Reading Goals** — Set a target page count and starting page; the app calculates your end page and tracks progress as you read.
- **Smart Goal Entry** — Enter your goal naturally (e.g. `100 from 201-300`) or use the inline number inputs.
- **Live Progress Dashboard** — A progress bar, percentage, pages-remaining counter, and current/target page stats update with every page turn.
- **Celebration Modal** — On goal completion, a confetti animation fires and a major-chord arpeggio plays via the Web Audio API.
- **Audio Feedback** — A subtle synthesized "ping" plays on each page turn; no external audio files required.
- **Multiple Navigation Methods** — Arrow keys, Space bar, Prev/Next buttons, and scroll-to-edge wheel paging.
- **Zoom Controls** — Zoom in/out and fit-to-width button in the toolbar.
- **Drag-and-Drop Upload** — Drop a PDF onto the upload area or use the file picker.
- **CLI Preloading** — Pass a PDF path as a command-line argument to have it load automatically on launch.
- **Dark Glassmorphic UI** — Premium dark theme with glowing background blobs, Inter/Outfit typography, and Font Awesome icons.

---

## Project Structure

```
├── main.py              # Flask backend server
├── requirements.txt     # Python dependencies
└── templates/
│   └── index.html       # Main HTML UI
└── static/
    ├── css/
    │   └── style.css    # Glassmorphic dark theme stylesheet
    └── js/
        └── app.js       # Frontend PDF viewer & goal tracking logic
```

> **Note:** Flask's template and static file conventions require `index.html` to be inside a `templates/` folder, and `style.css` / `app.js` inside `static/css/` and `static/js/` respectively.

---

## Requirements

- Python 3.7+
- Flask 2.0+
- A modern web browser (Chrome, Firefox, Edge, Safari)

---

## Installation

1. **Clone or download** this repository.

2. **Install dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

3. **Arrange files** according to the project structure above (move `index.html` into `templates/`, and `style.css`/`app.js` into the appropriate `static/` subdirectories).

---

## Usage

### Standard Mode (upload via UI)

```bash
python main.py
```

The Flask server starts on port 5000 and opens your browser automatically. Drag and drop a PDF onto the upload area, or click **Choose File** to browse.

### Preload a PDF via CLI

```bash
python main.py /path/to/your/book.pdf
```

The specified PDF is served directly to the browser on launch — no manual upload needed.

### Custom Port

```bash
python main.py /path/to/book.pdf --port 8080
```

---

## Setting a Reading Goal

1. In the sidebar, enter the number of pages you want to read today and the page you're starting from. The ending page is calculated automatically.
2. Alternatively, type your goal in the **Smart Goal Entry** field (e.g. `50 from 120-170`).
3. Click **Start Tracking**.

The sidebar switches to the live progress dashboard. Navigate through the PDF and watch your progress update in real time.

To change your goal mid-session, click **Change Goal**.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `→` / `Space` | Next page |
| `←` | Previous page |
| Scroll to bottom | Advance to next page |
| Scroll to top | Go back to previous page |

---

## External Dependencies (CDN)

| Library | Purpose |
|---|---|
| [PDF.js 2.16.105](https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js) | PDF rendering engine |
| [canvas-confetti 1.6.0](https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js) | Goal completion celebration animation |
| [Font Awesome 6.4.0](https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css) | UI icons |
| [Google Fonts — Inter & Outfit](https://fonts.googleapis.com) | Typography |

All audio is synthesized locally using the browser's **Web Audio API** — no internet connection is required for sound.

---

## How It Works

- The Flask backend (`main.py`) serves the HTML template and, when a PDF is preloaded via CLI, exposes it at `/api/pdf`. A `/api/status` endpoint tells the frontend whether a file is ready to stream.
- The frontend (`app.js`) checks `/api/status` on load. If a preloaded file exists, it fetches and renders it immediately; otherwise the upload UI is shown.
- PDF rendering is handled entirely in the browser by PDF.js, drawing each page onto an HTML `<canvas>` element with device-pixel-ratio scaling for sharp output on retina displays.
- Goal progress is computed by comparing the current page number against the configured start/end range and displayed as a percentage, fraction, and pages-remaining count.

---

## License

MIT — free to use, modify, and distribute.
