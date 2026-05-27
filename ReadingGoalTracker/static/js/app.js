// ==========================================================================
// Antigravity PDF Tracking Agent Frontend Application
// ==========================================================================

// Global state variables
let pdfDoc = null;
let pageNum = 1;
let pageRendering = false;
let pageNumPending = null;
let scale = 1.0;
let defaultScale = 1.0;
let loadedFileName = "";

// Goal Tracking State
const goalState = {
    active: false,
    pages: 100,
    start: 201,
    end: 301,
    completed: false
};

// Canvas references
const canvas = document.getElementById('pdf-render-canvas');
const ctx = canvas.getContext('2d');

// Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// Synthesize audio signals natively using Web Audio API (extremely robust & offline-first!)
const AudioSynthesizer = {
    audioCtx: null,

    init() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },

    // A subtle, satisfying high-pitched "tick" or "ping" when a page is successfully turned
    playPageTurn() {
        try {
            this.init();
            const now = this.audioCtx.currentTime;
            
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
            
            gain.gain.setValueAtTime(0.04, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
            
            osc.start(now);
            osc.stop(now + 0.09);
        } catch (e) {
            console.log("Audio play deferred or blocked by browser policy:", e);
        }
    },

    // A beautiful major chord arpeggio chime when the goal is achieved!
    playGoalAccomplished() {
        try {
            this.init();
            const now = this.audioCtx.currentTime;
            
            // Major pentatonic notes: C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
            const notes = [523.25, 659.25, 783.99, 1046.50];
            
            notes.forEach((freq, idx) => {
                const noteTime = now + (idx * 0.12);
                
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                
                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, noteTime);
                
                gain.gain.setValueAtTime(0.0, noteTime);
                gain.gain.linearRampToValueAtTime(0.12, noteTime + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.8);
                
                osc.start(noteTime);
                osc.stop(noteTime + 0.9);
            });
        } catch (e) {
            console.log("Audio play blocked:", e);
        }
    }
};

// ==========================================================================
// Initialization & Backend Check
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
    // Check if a PDF was preloaded on the backend
    checkPreloadedStatus();
    
    // Bind Goal Inputs
    setupGoalInputListeners();
    
    // Bind UI controls
    bindUiControls();
    
    // Keyboard Navigation
    bindKeyboardNavigation();
    
    // Wheel scroll pagination
    setupWheelNavigation();
    
    // Drag-and-Drop file uploads
    setupDragAndDrop();
});

// Check status API of Flask server
function checkPreloadedStatus() {
    showLoading(true);
    fetch('/api/status')
        .then(res => res.json())
        .then(data => {
            if (data.preloaded && data.filename) {
                console.log("Detected backend preloaded PDF:", data.filename);
                loadPdf('/api/pdf', data.filename);
            } else {
                showLoading(false);
                // Keep file upload dashboard visible
            }
        })
        .catch(err => {
            console.error("Could not communicate with Flask backend API status:", err);
            showLoading(false);
        });
}

// ==========================================================================
// PDF Document Loader
// ==========================================================================
function loadPdf(pdfSource, filename) {
    showLoading(true);
    loadedFileName = filename || "Uploaded Document";
    
    // Reset page index
    pageNum = 1;
    
    // Load the PDF via PDF.js API
    pdfjsLib.getDocument(pdfSource).promise.then(pdf => {
        pdfDoc = pdf;
        
        // Update UI info
        document.getElementById('total-pages-num').textContent = pdfDoc.numPages;
        document.getElementById('file-name-text').textContent = loadedFileName;
        document.getElementById('pdf-status').classList.add('active');
        document.getElementById('pdf-status').querySelector('.status-text').textContent = "Active";
        
        // Hide upload panel, show viewport
        document.getElementById('upload-area-el').classList.add('hidden');
        document.getElementById('pdf-viewport-el').classList.remove('hidden');
        
        // Automatically default inputs based on PDF dimensions & pages
        document.getElementById('goal-start').max = pdfDoc.numPages;
        
        // Initial page render
        renderPage(pageNum);
        showLoading(false);
        
        // If a goal is already active, re-sync pages
        if (goalState.active) {
            updateProgress();
        }
    }).catch(err => {
        console.error("PDF loading error:", err);
        alert("Failed to load PDF: " + err.message);
        showLoading(false);
    });
}

// ==========================================================================
// Rendering Engine (PDF.js Canvas Drawer)
// ==========================================================================
function renderPage(num) {
    pageRendering = true;
    showLoading(true);
    
    // Fetch page object
    pdfDoc.getPage(num).then(page => {
        const viewport = page.getViewport({ scale: scale });
        
        // Set canvas dimensions appropriately considering device DPI for crisp lines
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = Math.floor(viewport.width) + "px";
        canvas.style.height = Math.floor(viewport.height) + "px";
        
        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
        
        const renderContext = {
            canvasContext: ctx,
            transform: transform,
            viewport: viewport
        };
        
        const renderTask = page.render(renderContext);
        
        // Wait for rendering to complete
        renderTask.promise.then(() => {
            pageRendering = false;
            showLoading(false);
            
            // Update Page numbers in UI
            document.getElementById('current-page-num').textContent = num;
            if (goalState.active) {
                document.getElementById('stat-current-page').textContent = num;
            }
            
            // Check if there's a pending page render
            if (pageNumPending !== null) {
                renderPage(pageNumPending);
                pageNumPending = null;
            }
            
            // Core Page Count & Goal Progression trigger
            if (goalState.active) {
                updateProgress();
            }
        });
    }).catch(err => {
        pageRendering = false;
        showLoading(false);
        console.error("Page render error:", err);
    });
}

// Thread-safe queue manager for page changes
function queueRenderPage(num) {
    if (pageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

// Loading Spinner manager
function showLoading(visible) {
    const loader = document.getElementById('loading-overlay-el');
    if (visible) {
        loader.classList.remove('hidden');
    } else {
        loader.classList.add('hidden');
    }
}

// ==========================================================================
// Smart Goal Input Listener & Syncer
// ==========================================================================
function setupGoalInputListeners() {
    const goalPages = document.getElementById('goal-pages');
    const goalStart = document.getElementById('goal-start');
    const goalEndPreview = document.getElementById('goal-end-preview');
    const goalTextInput = document.getElementById('goal-text-input');
    
    // Natural calculation: End Page = Start Page + Goal Pages
    function syncInputs() {
        const pages = parseInt(goalPages.value) || 1;
        const start = parseInt(goalStart.value) || 1;
        const end = start + pages; // e.g. 201 to 301 is 100 pages, EndPage is exactly 301.
        goalEndPreview.textContent = end;
        
        // Update natural language text input placeholder to match sync
        goalTextInput.placeholder = `${pages} from ${start}-${end}`;
    }
    
    goalPages.addEventListener('input', syncInputs);
    goalStart.addEventListener('input', syncInputs);
    
    // Smart Natural Language text parser!
    goalTextInput.addEventListener('input', () => {
        const val = goalTextInput.value.trim();
        if (!val) return;
        
        // 1. Match format: "100 from 201-301" or "100 pages from 201 to 301"
        const fullRangeMatch = val.match(/(\d+)\s+(?:pages\s+)?from\s+(\d+)[\s-–—to]+(\d+)/i);
        if (fullRangeMatch) {
            const pages = parseInt(fullRangeMatch[1]);
            const start = parseInt(fullRangeMatch[2]);
            const end = parseInt(fullRangeMatch[3]);
            
            goalPages.value = pages;
            goalStart.value = start;
            goalEndPreview.textContent = end;
            return;
        }
        
        // 2. Match format: "201-301" or "from 201 to 301"
        const rangeOnlyMatch = val.match(/(?:from\s+)?(\d+)[\s-–—to]+(\d+)/i);
        if (rangeOnlyMatch) {
            const start = parseInt(rangeOnlyMatch[1]);
            const end = parseInt(rangeOnlyMatch[2]);
            const pages = end - start;
            
            if (pages > 0) {
                goalPages.value = pages;
                goalStart.value = start;
                goalEndPreview.textContent = end;
            }
            return;
        }
        
        // 3. Match format: "100 pages starting from 201"
        const countStartMatch = val.match(/(\d+)\s+(?:pages\s+)?(?:start|starting\s+)?(?:from\s+)?(\d+)/i);
        if (countStartMatch) {
            const pages = parseInt(countStartMatch[1]);
            const start = parseInt(countStartMatch[2]);
            
            goalPages.value = pages;
            goalStart.value = start;
            goalEndPreview.textContent = start + pages;
            return;
        }
        
        // 4. Default: If they just type a number, treat it as the Goal Page count
        const singleNumMatch = val.match(/^(\d+)$/);
        if (singleNumMatch) {
            const pages = parseInt(singleNumMatch[1]);
            goalPages.value = pages;
            syncInputs();
        }
    });
    
    // Initial sync run
    syncInputs();
}

// ==========================================================================
// Tracking Logic & Page Calculation
// ==========================================================================
function activateGoal() {
    if (!pdfDoc) {
        alert("Please open a PDF document first before activating your goal!");
        return;
    }
    
    const pages = parseInt(document.getElementById('goal-pages').value) || 1;
    const start = parseInt(document.getElementById('goal-start').value) || 1;
    const end = start + pages; // e.g. 201 to 301
    
    // Validate inputs relative to PDF page constraints
    if (start < 1 || start > pdfDoc.numPages) {
        alert(`Starting page (${start}) must be between 1 and ${pdfDoc.numPages}!`);
        return;
    }
    
    if (end <= start) {
        alert("End page must be strictly greater than start page!");
        return;
    }
    
    if (end > pdfDoc.numPages) {
        alert(`Your goal target goes up to page ${end}, but this PDF only has ${pdfDoc.numPages} pages! Adjusting end page to fit PDF...`);
        // Adjust values
        const adjustedEnd = pdfDoc.numPages;
        const adjustedPages = adjustedEnd - start;
        if (adjustedPages <= 0) {
            alert("Unable to set goal starting at this page with this PDF size.");
            return;
        }
        document.getElementById('goal-pages').value = adjustedPages;
        document.getElementById('goal-end-preview').textContent = adjustedEnd;
        goalState.pages = adjustedPages;
        goalState.start = start;
        goalState.end = adjustedEnd;
    } else {
        goalState.pages = pages;
        goalState.start = start;
        goalState.end = end;
    }
    
    goalState.active = true;
    goalState.completed = false;
    
    // UI Panels Shift
    document.getElementById('goal-setup-section').classList.add('hidden');
    
    const activeDashboard = document.getElementById('active-dashboard-section');
    activeDashboard.classList.remove('hidden');
    
    // Update Stats Display
    document.getElementById('stat-target-page').textContent = goalState.end;
    document.getElementById('stat-current-page').textContent = pageNum;
    
    // If current page is outside start-end range, jump straight to the start page of the goal
    if (pageNum < goalState.start || pageNum > goalState.end) {
        pageNum = goalState.start;
        queueRenderPage(pageNum);
    } else {
        updateProgress();
    }
}

// Compute statistics and update remaining bars
function updateProgress() {
    if (!goalState.active) return;
    
    // Formula remaining = EndPage - CurrentPage
    let remaining = goalState.end - pageNum;
    
    // Bounds control
    if (remaining < 0) remaining = 0;
    
    const remainingEl = document.getElementById('remaining-count');
    remainingEl.textContent = remaining;
    
    // If progress advances, play page tick sound!
    // But avoid playing sound if it's the very first render or we are jumping backwards
    const prevText = remainingEl.dataset.prevCount;
    if (prevText !== undefined) {
        const prevCount = parseInt(prevText);
        if (remaining < prevCount) {
            AudioSynthesizer.playPageTurn();
        }
    }
    remainingEl.dataset.prevCount = remaining;
    
    // Calculate pages completed in this goal
    let readCount = pageNum - goalState.start;
    if (readCount < 0) readCount = 0;
    if (readCount > goalState.pages) readCount = goalState.pages;
    
    // Calculate percentage completion
    const percent = Math.floor((readCount / goalState.pages) * 100);
    
    // Render visual elements
    const progressBar = document.getElementById('progress-bar');
    progressBar.style.width = `${percent}%`;
    document.getElementById('progress-percent').textContent = `${percent}%`;
    document.getElementById('progress-fraction').textContent = `${readCount} / ${goalState.pages} pages`;
    
    // GOAL ACCOMPLISHED STAGE!
    if (pageNum >= goalState.end && !goalState.completed) {
        goalState.completed = true;
        triggerGoalCompletion();
    }
}

// Action upon winning/completing the reading goal
function triggerGoalCompletion() {
    // Add success glow styles to progress UI elements
    document.getElementById('progress-bar').classList.add('completed');
    document.getElementById('remaining-count').classList.add('pulse-green');
    
    // Trigger canvas confetti explosion
    fireConfetti();
    
    // Play celebratory synthetic chime
    AudioSynthesizer.playGoalAccomplished();
    
    // Show celebratory glass modal
    document.getElementById('cel-total-pages').textContent = goalState.pages;
    document.getElementById('cel-ending-page').textContent = goalState.end;
    
    setTimeout(() => {
        document.getElementById('celebration-overlay-el').classList.add('active');
    }, 800);
}

// Confetti burst logic
function fireConfetti() {
    const duration = 4 * 1000;
    const end = Date.now() + duration;

    (function frame() {
        // Left side blast
        confetti({
            particleCount: 3,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#6366f1', '#8b5cf6', '#10b981']
        });
        
        // Right side blast
        confetti({
            particleCount: 3,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#6366f1', '#8b5cf6', '#10b981']
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
}

// De-activate and reset dashboard
function resetGoal() {
    goalState.active = false;
    goalState.completed = false;
    
    // Remove success glow styles
    document.getElementById('progress-bar').classList.remove('completed');
    document.getElementById('remaining-count').classList.remove('pulse-green');
    
    // UI Panel Shift back
    document.getElementById('active-dashboard-section').classList.add('hidden');
    document.getElementById('goal-setup-section').classList.remove('hidden');
    
    // Clear dataset count cache
    delete document.getElementById('remaining-count').dataset.prevCount;
}

// ==========================================================================
// Control Operations & Handlers
// ==========================================================================
function bindUiControls() {
    // Goal setup button
    document.getElementById('activate-goal-btn').addEventListener('click', activateGoal);
    
    // Reset Goal
    document.getElementById('reset-goal-btn').addEventListener('click', resetGoal);
    
    // Next/Prev Sidebar Actions
    document.getElementById('prev-page-btn-sidebar').addEventListener('click', onPrevPage);
    document.getElementById('next-page-btn-sidebar').addEventListener('click', onNextPage);
    
    // Toolbar zooms
    document.getElementById('zoom-in-btn').addEventListener('click', () => {
        if (!pdfDoc) return;
        scale += 0.2;
        updateZoomText();
        queueRenderPage(pageNum);
    });
    
    document.getElementById('zoom-out-btn').addEventListener('click', () => {
        if (!pdfDoc) return;
        if (scale <= 0.4) return;
        scale -= 0.2;
        updateZoomText();
        queueRenderPage(pageNum);
    });
    
    document.getElementById('fit-width-btn').addEventListener('click', () => {
        if (!pdfDoc) return;
        fitToWidth();
    });
    
    // Dismiss Celebration Modal
    document.getElementById('dismiss-celebration-btn').addEventListener('click', () => {
        document.getElementById('celebration-overlay-el').classList.remove('active');
    });

    // Toolbar Open/Change PDF binding
    const toolbarOpenBtn = document.getElementById('toolbar-open-pdf-btn');
    const toolbarFileInput = document.getElementById('toolbar-file-input');
    
    if (toolbarOpenBtn && toolbarFileInput) {
        toolbarOpenBtn.addEventListener('click', () => {
            toolbarFileInput.click();
        });
        
        toolbarFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type === 'application/pdf') {
                processUploadedFile(file);
                resetGoal();
            }
        });
    }
}

function updateZoomText() {
    document.getElementById('zoom-factor').textContent = `${Math.round(scale * 100)}%`;
}

function fitToWidth() {
    pdfDoc.getPage(pageNum).then(page => {
        const viewportContainer = document.getElementById('pdf-viewport-el');
        const containerWidth = viewportContainer.clientWidth - 60; // 30px padding on each side
        const pageViewport = page.getViewport({ scale: 1.0 });
        
        scale = containerWidth / pageViewport.width;
        updateZoomText();
        queueRenderPage(pageNum);
    });
}

// Page Turn Event Handlers
function onPrevPage() {
    if (!pdfDoc) return;
    if (pageNum <= 1) return;
    pageNum--;
    queueRenderPage(pageNum);
}

function onNextPage() {
    if (!pdfDoc) return;
    if (pageNum >= pdfDoc.numPages) return;
    pageNum++;
    queueRenderPage(pageNum);
}

// Keyboard arrow and space shortcuts
function bindKeyboardNavigation() {
    window.addEventListener('keydown', (e) => {
        // Don't trigger if inside active text input elements
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
            return;
        }
        
        if (e.key === 'ArrowRight') {
            onNextPage();
            e.preventDefault();
        } else if (e.key === 'ArrowLeft') {
            onPrevPage();
            e.preventDefault();
        } else if (e.key === ' ' || e.code === 'Space') {
            // Space advances page
            onNextPage();
            e.preventDefault();
        }
    });
}

// Wheel Scroll paging logic
function setupWheelNavigation() {
    const viewport = document.getElementById('pdf-viewport-el');
    let lastScrollTime = 0;
    const scrollCooldown = 800; // ms between wheel page changes to prevent high-speed flipping
    
    viewport.addEventListener('wheel', (e) => {
        if (!pdfDoc) return;
        
        const now = Date.now();
        if (now - lastScrollTime < scrollCooldown) return;
        
        const isScrollDown = e.deltaY > 0;
        const scrollTop = viewport.scrollTop;
        const scrollHeight = viewport.scrollHeight;
        const clientHeight = viewport.clientHeight;
        
        // If scrolled to bottom and attempts to scroll down -> Next page
        if (isScrollDown && (scrollTop + clientHeight >= scrollHeight - 5)) {
            onNextPage();
            lastScrollTime = now;
            viewport.scrollTop = 0; // Scroll back to top of new page
            e.preventDefault();
        }
        // If scrolled to top and attempts to scroll up -> Prev page
        else if (!isScrollDown && scrollTop <= 5) {
            onPrevPage();
            lastScrollTime = now;
            viewport.scrollTop = 0; // Scroll to top
            e.preventDefault();
        }
    }, { passive: false });
}

// ==========================================================================
// File Drag-and-Drop Loader
// ==========================================================================
function setupDragAndDrop() {
    const uploadArea = document.getElementById('upload-area-el');
    const fileInput = document.getElementById('file-input');
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type === 'application/pdf') {
            processUploadedFile(file);
        }
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        }, false);
    });
    
    uploadArea.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            processUploadedFile(file);
        } else {
            alert("Only PDF files are supported!");
        }
    }, false);
}

// Read local file as ArrayBuffer and pass directly into PDF.js
function processUploadedFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const arrayBuffer = e.target.result;
        loadPdf({ data: arrayBuffer }, file.name);
    };
    reader.readAsArrayBuffer(file);
}
