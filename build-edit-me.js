const fs = require('fs');
const path = require('path');

const dir = __dirname;
let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'styles.css'), 'utf8');

html = html.replace(/<aside class="notes">[\s\S]*?<\/aside>/g, '');
html = html.replace(/<div class="autoplay-badge"[\s\S]*?<\/div>\s*/g, '');
html = html.replace(/<div class="logo-mark">[\s\S]*?<\/div>\s*/g, '');

html = html.replace(
  '<title>XchangeByte — Investor Presentation</title>',
  '<title>XchangeByte — EDIT ME (Investor Presentation)</title>'
);

const editorCss = `
/* === EDITOR MODE === */
body.edit-mode { padding-top: 88px; }
body.edit-mode .fragment.fade-up { opacity: 1 !important; transform: none !important; }

#editorBar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border-bottom: 2px solid #22d3ee;
  padding: 10px 20px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.5);
  font-family: Inter, sans-serif;
}
.editor-instructions {
  font-size: 13px; color: #cbd5e1; margin-bottom: 8px; line-height: 1.4;
}
.editor-instructions strong { color: #fbbf24; }
.editor-controls {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
}
.editor-controls button {
  padding: 8px 18px; border: none; border-radius: 8px;
  font-size: 14px; font-weight: 600; cursor: pointer;
  font-family: Inter, sans-serif;
}
#prevBtn, #nextBtn { background: #334155; color: #f8fafc; }
#prevBtn:hover, #nextBtn:hover { background: #475569; }
#saveBtn {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white; margin-left: auto; font-size: 15px;
  padding: 10px 24px; box-shadow: 0 4px 14px rgba(16,185,129,0.4);
}
#saveBtn:hover { filter: brightness(1.1); }
#slideCounter { color: #22d3ee; font-weight: 600; font-size: 14px; min-width: 140px; text-align: center; }

[contenteditable="true"] {
  outline: none; border-radius: 4px;
  transition: background 0.2s, box-shadow 0.2s;
}
[contenteditable="true"]:hover {
  background: rgba(34, 211, 238, 0.08);
  box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.25);
}
[contenteditable="true"]:focus {
  background: rgba(34, 211, 238, 0.12);
  box-shadow: 0 0 0 2px #22d3ee;
}

.save-toast {
  position: fixed; bottom: 24px; right: 24px; z-index: 10000;
  background: #10b981; color: white; padding: 14px 24px;
  border-radius: 12px; font-weight: 600; font-size: 14px;
  box-shadow: 0 8px 32px rgba(16,185,129,0.4);
  opacity: 0; transform: translateY(20px); transition: all 0.3s;
  pointer-events: none;
}
.save-toast.show { opacity: 1; transform: translateY(0); }

.reveal { height: calc(100vh - 88px) !important; }
`;

html = html.replace(
  '<link rel="stylesheet" href="styles.css">',
  `<style>\n${css}\n${editorCss}\n</style>`
);

const editorBar = `<div id="editorBar">
  <div class="editor-instructions">
    <strong>How to edit this presentation:</strong>
    Click any text on the slide to change it &nbsp;|&nbsp;
    Use the buttons or arrow keys on your keyboard to move between slides &nbsp;|&nbsp;
    When finished, click <strong>SAVE MY CHANGES</strong> and send the downloaded file back
  </div>
  <div class="editor-controls">
    <button type="button" id="prevBtn">&larr; Previous Slide</button>
    <span id="slideCounter">Slide 1</span>
    <button type="button" id="nextBtn">Next Slide &rarr;</button>
    <button type="button" id="saveBtn">SAVE MY CHANGES</button>
  </div>
</div>
<div class="save-toast" id="saveToast">Saved! Send this file back to Sufyan.</div>`;

html = html.replace('<body>', `<body class="edit-mode">\n${editorBar}`);

html = html.replace(
  /\/\/ Auto-play toggle with 'A' key[\s\S]*?document\.getElementById\('autoplayBadge'\)\.classList\.toggle\('active', autoPlayOn\);\s*\}\s*\}\);/,
  ''
);

const editorScript = `
<script>
  const editableSelectors = 'h1,h2,h3,h4,p,li,td,th,.eyebrow,.value,.label,.title,.desc,.phase,.subtitle,.contact,.flow-node,.stat-card strong';
  document.querySelectorAll(editableSelectors).forEach(el => {
    if (el.closest('#editorBar') || el.closest('script') || el.closest('canvas')) return;
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'true');
  });
  document.querySelectorAll('.fund-legend > div').forEach(el => {
    el.setAttribute('contenteditable', 'true');
  });

  function updateSlideCounter() {
    const idx = Reveal.getIndices().h + 1;
    const total = Reveal.getTotalSlides();
    document.getElementById('slideCounter').textContent = 'Slide ' + idx + ' of ' + total;
  }

  document.getElementById('prevBtn').addEventListener('click', () => Reveal.prev());
  document.getElementById('nextBtn').addEventListener('click', () => Reveal.next());
  Reveal.on('slidechanged', updateSlideCounter);
  Reveal.on('ready', updateSlideCounter);

  document.getElementById('saveBtn').addEventListener('click', () => {
    if (document.activeElement) document.activeElement.blur();
    const content = '<!DOCTYPE html>\\n' + document.documentElement.outerHTML;
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'EDIT-ME-saved.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    const toast = document.getElementById('saveToast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
  });

  document.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    if (active && active.getAttribute('contenteditable') === 'true') {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.stopPropagation();
      }
    }
  }, true);
</script>`;

html = html.replace('</body>', `${editorScript}\n</body>`);

const outPath = path.join(dir, 'EDIT-ME.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log(`Created ${outPath} (${Math.round(fs.statSync(outPath).size / 1024)} KB)`);
