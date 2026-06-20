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

const editorBar = `<div id="editorBar">
  <div class="editor-instructions">
    <strong>Editing mode:</strong>
    Click any text to edit &nbsp;|&nbsp;
    Use formatting buttons below &nbsp;|&nbsp;
    <strong>SAVE CHANGES</strong> when done &nbsp;|&nbsp;
    <strong>REFRESH LATEST</strong> to see others' edits
  </div>
  <div class="editor-controls">
    <button type="button" id="prevBtn">&larr; Previous</button>
    <span id="slideCounter">Slide 1</span>
    <button type="button" id="nextBtn">Next &rarr;</button>
    <button type="button" id="refreshBtn">REFRESH LATEST</button>
    <span id="lastSaved"></span>
    <button type="button" id="saveBtn">SAVE CHANGES</button>
  </div>
  <div id="formatToolbar">
    <span class="fmt-label">Format selected text:</span>
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
  </div>
</div>
<div class="save-toast" id="saveToast">Saved!</div>`;

// Strip any previous editor injection before re-adding
html = html.replace(/<body[^>]*>[\s\S]*?<div class="reveal">/, '<body class="edit-mode">\n' + editorBar + '\n  <div class="reveal">');
html = html.replace(/<script src="editor\.js"><\/script>\s*/g, '');
html = html.replace('</body>', '  <script src="editor.js"></script>\n</body>');

fs.writeFileSync(outPath, html, 'utf8');
console.log(`Built ${outPath} for web deployment`);
