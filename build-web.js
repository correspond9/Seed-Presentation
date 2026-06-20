const fs = require('fs');
const path = require('path');

const dir = __dirname;
const sourcePath = path.join(dir, 'presentation-view.html');
const outPath = path.join(dir, 'index.html');

// presentation-view.html is the master view-only source
if (!fs.existsSync(sourcePath)) {
  fs.copyFileSync(outPath, sourcePath);
  console.log('Created presentation-view.html from index.html');
}

let html = fs.readFileSync(sourcePath, 'utf8');

html = html.replace(/<aside class="notes">[\s\S]*?<\/aside>/g, '');

if (!html.includes('editor.css')) {
  html = html.replace(
    '<link rel="stylesheet" href="styles.css">',
    '<link rel="stylesheet" href="styles.css">\n  <link rel="stylesheet" href="editor.css">'
  );
}

const previewPanel = `<div id="editorLayout" class="editor-layout">
<aside id="slidePreviewPanel" class="slide-preview-panel">
  <div class="preview-header">
    <span class="preview-title">Slides</span>
    <button type="button" id="togglePreviewBtn" class="preview-toggle-btn" title="Hide slide list">&lsaquo;</button>
  </div>
  <div id="slidePreviewList" class="preview-list"></div>
</aside>
<div class="editor-stage">`;

const editorBar = `<div id="editorBar">
  <div class="editor-controls">
    <button type="button" id="prevBtn">&larr; Previous</button>
    <span id="slideCounter">Slide 1</span>
    <button type="button" id="nextBtn">Next &rarr;</button>
    <label class="jump-wrap">Go to <input type="number" id="jumpToSlide" min="1" placeholder="#" title="Slide number"> <button type="button" id="jumpBtn">Go</button></label>
    <button type="button" id="zoomOutBtn" title="Zoom out">&minus;</button>
    <span id="zoomLevel">85%</span>
    <button type="button" id="zoomInBtn" title="Zoom in">+</button>
    <button type="button" id="dragModeBtn">MOVE TEXT: OFF</button>
    <button type="button" id="refreshBtn">REFRESH LATEST</button>
    <button type="button" id="downloadPptBtn">DOWNLOAD PPT</button>
    <span id="lastSaved"></span>
    <button type="button" id="saveBtn">SAVE CHANGES</button>
  </div>
  <div id="formatToolbar">
    <button type="button" data-cmd="bold" title="Bold"><b>B</b></button>
    <button type="button" data-cmd="italic" title="Italic"><i>I</i></button>
    <button type="button" data-cmd="underline" title="Underline"><u>U</u></button>
    <span class="fmt-sep"></span>
    <button type="button" data-cmd="fontSizeDown" title="Smaller text">A&minus;</button>
    <button type="button" data-cmd="fontSizeUp" title="Larger text">A+</button>
    <span class="fmt-sep"></span>
    <button type="button" data-cmd="alignLeft" title="Align left">Left</button>
    <button type="button" data-cmd="alignCenter" title="Align center">Center</button>
    <button type="button" data-cmd="alignRight" title="Align right">Right</button>
    <span class="fmt-sep"></span>
    <button type="button" id="insertTextBoxBtn" title="Add a new text box to this slide">+ TEXT BOX</button>
    <button type="button" id="insertImageBtn" title="Add image or GIF from your computer">+ IMAGE/GIF</button>
    <input type="file" id="insertImageInput" accept="image/*,.gif" hidden>
    <span class="fmt-sep"></span>
    <button type="button" id="uploadToLibraryBtn" title="Upload image to library for reuse">+ LIBRARY</button>
    <input type="file" id="uploadToLibraryInput" accept="image/*,.gif" hidden>
    <button type="button" id="toggleMediaBarBtn" class="media-toggle-btn" title="Show or hide saved media">Hide Media</button>
  </div>
  <div id="mediaLibraryBar" class="media-library-bar">
    <div id="mediaLibraryList" class="media-library-list"></div>
  </div>
</div>
<div class="save-toast" id="saveToast">Saved!</div>
<div class="scroll-hint">Scroll inside the slide area if content goes below the screen</div>`;

// Strip any previous editor injection before re-adding
html = html.replace(/<body[^>]*>[\s\S]*?<div class="reveal">/, '<body class="edit-mode">\n' + editorBar + '\n' + previewPanel + '\n  <div class="reveal">');
html = html.replace(
  /    <\/div>\n  <\/div>\n\n  <script src="https:\/\/cdn\.jsdelivr\.net\/npm\/reveal\.js/,
  '    </div>\n  </div>\n</div>\n</div>\n\n  <script src="https://cdn.jsdelivr.net/npm/reveal.js'
);
html = html.replace(/<script src="media-library\.js"><\/script>\s*/g, '');
html = html.replace(/<script src="editor\.js"><\/script>\s*/g, '');
html = html.replace('</body>', '  <script src="media-library.js"></script>\n  <script src="editor.js"></script>\n</body>');

fs.writeFileSync(outPath, html, 'utf8');
console.log(`Built ${outPath} for web deployment`);
