(function () {
  const editableSelectors =
    'h1,h2,h3,h4,p,li,td,th,.eyebrow,.value,.label,.title,.desc,.phase,.subtitle,.contact,.flow-node,.stat-card strong,.inserted-textbox';

  let isEditable = false;
  let isDirty = false;
  let dragMode = false;
  let dragging = null;
  let dragOffset = { x: 0, y: 0 };
  let slideZoom = 0.85;

  function setDirty(val) {
    isDirty = !!val;
  }

  function exposeEditorApi() {
    window.__editorApi = {
      setDirty,
      getCurrentSlideCanvas,
      createInsertedWrapper,
      setupDraggable,
      buildSlidePreviews,
      showToast,
      layoutForEditor,
    };
    if (window.__editorMediaInit) window.__editorMediaInit(window.__editorApi);
  }

  function showToast(message, isError) {
    const toast = document.getElementById('saveToast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle('error', !!isError);
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
  }

  function formatSavedTime(iso) {
    if (!iso) return '';
    return 'Last saved: ' + new Date(iso).toLocaleString();
  }

  function updateLastSaved(iso) {
    const el = document.getElementById('lastSaved');
    if (el) el.textContent = formatSavedTime(iso);
  }

  function getSlideCount() {
    return document.querySelectorAll('.reveal .slides > section').length;
  }

  function getSlideTitle(section) {
    const h = section.querySelector('h1,h2,h3,.chapter-number');
    if (h) return (h.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const p = section.querySelector('p');
    if (p) return (p.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return 'Slide';
  }

  function buildSlidePreviews() {
    const list = document.getElementById('slidePreviewList');
    if (!list) return;
    list.innerHTML = '';

    const sections = document.querySelectorAll('.reveal .slides > section');
    sections.forEach((section, i) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'preview-item';
      item.dataset.index = String(i);
      item.title = 'Slide ' + (i + 1) + ': ' + getSlideTitle(section);

      const num = document.createElement('span');
      num.className = 'preview-num';
      num.textContent = String(i + 1);

      const thumb = document.createElement('div');
      thumb.className = 'preview-thumb';

      const inner = document.createElement('div');
      inner.className = 'preview-thumb-inner';

      const zoomWrap = section.querySelector(':scope > .slide-zoom-wrap');
      const source = zoomWrap ? zoomWrap.cloneNode(true) : section.cloneNode(true);
      source.querySelectorAll('video, canvas, script').forEach((el) => el.remove());
      inner.appendChild(source);
      thumb.appendChild(inner);

      item.appendChild(num);
      item.appendChild(thumb);
      item.addEventListener('click', () => {
        if (typeof Reveal === 'undefined') return;
        Reveal.slide(i);
        updateSlideCounter();
        updatePreviewSelection();
        disableRevealScaling();
      });

      list.appendChild(item);
    });

    updatePreviewSelection();
  }

  function updatePreviewSelection() {
    if (typeof Reveal === 'undefined') return;
    const idx = Reveal.getIndices().h;
    document.querySelectorAll('.preview-item').forEach((item, i) => {
      const active = i === idx;
      item.classList.toggle('active', active);
      if (active) item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  function togglePreviewPanel() {
    document.body.classList.toggle('preview-collapsed');
    const btn = document.getElementById('togglePreviewBtn');
    const collapsed = document.body.classList.contains('preview-collapsed');
    if (btn) {
      btn.textContent = collapsed ? '\u203A' : '\u2039';
      btn.title = collapsed ? 'Show slide list' : 'Hide slide list';
    }
    layoutForEditor();
  }

  function layoutForEditor() {
    const bar = document.getElementById('editorBar');
    if (!bar) return;
    document.documentElement.style.setProperty('--editor-total-height', bar.offsetHeight + 'px');
    applySlideZoom();
    if (typeof Reveal !== 'undefined') {
      Reveal.configure({ margin: 0, width: 1280, height: 720 });
      Reveal.layout();
      disableRevealScaling();
    }
  }

  function disableRevealScaling() {
    const slides = document.querySelector('.reveal .slides');
    if (slides) {
      slides.style.transform = 'none';
      slides.style.width = '100%';
      slides.style.height = '100%';
      slides.style.top = '0';
      slides.style.left = '0';
    }
  }

  function wrapSlideContent() {
    document.querySelectorAll('.reveal .slides > section').forEach((section) => {
      if (section.querySelector(':scope > .slide-zoom-wrap')) return;
      const wrap = document.createElement('div');
      wrap.className = 'slide-zoom-wrap';
      while (section.firstChild) wrap.appendChild(section.firstChild);
      section.appendChild(wrap);
    });
    applySlideZoom();
  }

  function applySlideZoom() {
    document.querySelectorAll('.slide-zoom-wrap').forEach((wrap) => {
      wrap.style.transform = 'scale(' + slideZoom + ')';
      wrap.style.width = (100 / slideZoom) + '%';
    });
    const label = document.getElementById('zoomLevel');
    if (label) label.textContent = Math.round(slideZoom * 100) + '%';
  }

  function changeZoom(delta) {
    slideZoom = Math.max(0.5, Math.min(1.2, Math.round((slideZoom + delta) * 100) / 100));
    applySlideZoom();
    isDirty = true;
  }

  function getActiveEditable() {
    const active = document.activeElement;
    if (active && active.getAttribute('contenteditable') === 'true') return active;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    let node = sel.anchorNode;
    if (node && node.nodeType === 3) node = node.parentElement;
    return node && node.closest ? node.closest('[contenteditable="true"]') : null;
  }

  function execFormat(command, value) {
    const el = getActiveEditable();
    if (!el) {
      showToast('Click on text first, then use the formatting buttons.', true);
      return;
    }
    el.focus();
    document.execCommand(command, false, value || null);
    isDirty = true;
  }

  function changeFontSize(delta) {
    const el = getActiveEditable();
    if (!el) {
      showToast('Click on text first, then use A+ or A-.', true);
      return;
    }
    const current = parseFloat(window.getComputedStyle(el).fontSize) || 16;
    el.style.fontSize = Math.max(10, Math.min(52, current + delta)) + 'px';
    isDirty = true;
  }

  function setAlignment(align) {
    const el = getActiveEditable();
    if (!el) {
      showToast('Click on text first, then choose alignment.', true);
      return;
    }
    el.style.textAlign = align;
    isDirty = true;
  }

  function jumpToSlide() {
    const input = document.getElementById('jumpToSlide');
    if (!input || typeof Reveal === 'undefined') return;
    const total = getSlideCount();
    const num = parseInt(input.value, 10);
    if (isNaN(num) || num < 1 || num > total) {
      showToast('Enter a slide number between 1 and ' + total, true);
      return;
    }
    Reveal.slide(num - 1);
    updateSlideCounter();
    updatePreviewSelection();
    disableRevealScaling();
    showToast('Jumped to slide ' + num);
  }

  async function downloadPptx() {
    const btn = document.getElementById('downloadPptBtn');
    const slides = document.querySelector('.slides');
    if (!slides) return;

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Creating PPT...';
    }

    try {
      const res = await fetch('/api/export-pptx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: slides.innerHTML }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Download failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'XchangeByte-Investor-Pitch.pptx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('PowerPoint file downloaded to your PC!');
    } catch (err) {
      showToast(err.message || 'Could not create PowerPoint file', true);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'DOWNLOAD PPT';
      }
    }
  }

  function getCurrentSlideCanvas() {
    const section = document.querySelector('.reveal .slides > section.present');
    if (!section) {
      showToast('No slide selected.', true);
      return null;
    }
    let wrap = section.querySelector(':scope > .slide-zoom-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'slide-zoom-wrap';
      while (section.firstChild) wrap.appendChild(section.firstChild);
      section.appendChild(wrap);
      applySlideZoom();
    }
    wrap.style.position = 'relative';
    return wrap;
  }

  function bindRemoveButton(btn, wrapper) {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      wrapper.remove();
      isDirty = true;
      buildSlidePreviews();
      showToast('Removed.');
    });
  }

  function setupDraggable(el) {
    if (el.dataset.dragBound) return;
    el.dataset.dragBound = '1';
    el.addEventListener('mousedown', onDragStart);
  }

  function setupInsertedTextbox(box) {
    box.setAttribute('contenteditable', 'true');
    box.setAttribute('spellcheck', 'true');
    if (!box.dataset.inputBound) {
      box.dataset.inputBound = '1';
      box.addEventListener('input', () => { isDirty = true; });
      box.addEventListener('focus', () => {
        if (box.textContent.trim() === 'Type your text here...') box.textContent = '';
      });
    }
  }

  function createInsertedWrapper(type, child) {
    const wrap = document.createElement('div');
    wrap.className = 'inserted-wrap inserted-wrap-' + type + ' is-positioned';
    wrap.setAttribute('data-inserted', type);
    wrap.style.position = 'absolute';
    wrap.style.zIndex = '20';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-inserted-btn';
    removeBtn.textContent = '\u00d7';
    removeBtn.title = type === 'image' ? 'Remove image' : 'Remove text box';

    wrap.appendChild(child);
    wrap.appendChild(removeBtn);
    bindRemoveButton(removeBtn, wrap);
    setupDraggable(wrap);
    return wrap;
  }

  function setupInsertedImage(wrapper) {
    setupDraggable(wrapper);
    const removeBtn = wrapper.querySelector('.remove-inserted-btn');
    if (removeBtn) bindRemoveButton(removeBtn, wrapper);
  }

  function enableInsertedElements() {
    document.querySelectorAll('.inserted-wrap-textbox .inserted-textbox').forEach(setupInsertedTextbox);
    document.querySelectorAll('.inserted-wrap-textbox, .inserted-wrap-image, .inserted-image').forEach((wrap) => {
      if (wrap.classList.contains('inserted-textbox')) return;
      setupDraggable(wrap);
      const removeBtn = wrap.querySelector('.remove-inserted-btn');
      if (removeBtn) bindRemoveButton(removeBtn, wrap);
    });
    // Legacy items saved before wrapper structure
    document.querySelectorAll('.inserted-textbox:not(.inserted-wrap .inserted-textbox)').forEach((box) => {
      setupInsertedTextbox(box);
      setupDraggable(box);
    });
  }

  function insertTextBox() {
    const canvas = getCurrentSlideCanvas();
    if (!canvas) return;

    const count = canvas.querySelectorAll('.inserted-wrap-textbox, .inserted-textbox').length;
    const box = document.createElement('div');
    box.className = 'inserted-textbox';
    box.style.width = '340px';
    box.textContent = 'Type your text here...';
    setupInsertedTextbox(box);

    const wrap = createInsertedWrapper('textbox', box);
    wrap.style.left = (60 + count * 24) + 'px';
    wrap.style.top = (100 + count * 24) + 'px';

    canvas.appendChild(wrap);
    box.focus();
    isDirty = true;
    buildSlidePreviews();
    showToast('Text box added! Click inside to type. Use MOVE TEXT to drag it.');
  }

  function insertImageFromFile(file) {
    if (!file) return;
    if (window.__editorMedia && window.__editorMedia.addFileToLibrary) {
      window.__editorMedia.addFileToLibrary(file, true);
      return;
    }
    // fallback if media-library.js not loaded
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image or GIF file.', true);
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      showToast('File is too large. Please use an image under 3 MB.', true);
      return;
    }

    const canvas = getCurrentSlideCanvas();
    if (!canvas) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const count = canvas.querySelectorAll('.inserted-wrap-image, .inserted-image').length;

      const img = document.createElement('img');
      img.src = e.target.result;
      img.alt = file.name.replace(/\.[^.]+$/, '');
      img.draggable = false;

      const wrap = createInsertedWrapper('image', img);
      wrap.style.left = (80 + count * 20) + 'px';
      wrap.style.top = (160 + count * 20) + 'px';

      canvas.appendChild(wrap);

      isDirty = true;
      buildSlidePreviews();
      showToast('Image added! Use MOVE TEXT to drag it, then SAVE CHANGES.');
    };
    reader.onerror = () => showToast('Could not read that image file.', true);
    reader.readAsDataURL(file);
  }

  function toggleDragMode() {
    dragMode = !dragMode;
    document.body.classList.toggle('drag-mode', dragMode);
    const btn = document.getElementById('dragModeBtn');
    if (btn) {
      btn.classList.toggle('active', dragMode);
      btn.textContent = dragMode ? 'MOVE TEXT: ON' : 'MOVE TEXT: OFF';
    }
    showToast(
      dragMode
        ? 'Move mode ON — drag any text box freely. Turn off to edit words.'
        : 'Move mode OFF — click text to edit words.'
    );
  }

  function getPositionParent(el) {
    const wrap = el.closest('.slide-zoom-wrap');
    return wrap || el.closest('section');
  }

  function onDragStart(e) {
    if (!dragMode) return;
    if (e.target.closest('.remove-inserted-btn')) return;
    e.preventDefault();
    e.stopPropagation();

    const el = e.currentTarget;
    const parent = getPositionParent(el);
    if (!parent) return;

    parent.style.position = 'relative';

    const parentRect = parent.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const zoom = slideZoom;

    if (getComputedStyle(el).position !== 'absolute') {
      el.style.position = 'absolute';
      el.style.left = ((elRect.left - parentRect.left) / zoom) + 'px';
      el.style.top = ((elRect.top - parentRect.top) / zoom) + 'px';
      el.style.width = (elRect.width / zoom) + 'px';
      el.style.margin = '0';
      el.classList.add('is-positioned');
    }

    dragging = el;
    dragging.classList.add('is-dragging');
    dragOffset.x = e.clientX - elRect.left;
    dragOffset.y = e.clientY - elRect.top;
  }

  function onDragMove(e) {
    if (!dragging) return;
    e.preventDefault();
    const parent = getPositionParent(dragging);
    const parentRect = parent.getBoundingClientRect();
    const zoom = slideZoom;

    dragging.style.left = ((e.clientX - parentRect.left - dragOffset.x) / zoom) + 'px';
    dragging.style.top = ((e.clientY - parentRect.top - dragOffset.y) / zoom) + 'px';
    isDirty = true;
  }

  function onDragEnd() {
    if (!dragging) return;
    const section = dragging.closest('section');
    if (window.__editorMedia && window.__editorMedia.onLogoDragEnd) {
      window.__editorMedia.onLogoDragEnd(dragging, section);
    }
    dragging.classList.remove('is-dragging');
    dragging = null;
  }

  function bindFormatToolbar() {
    const toolbar = document.getElementById('formatToolbar');
    if (!toolbar) return;

    toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-cmd]');
      if (!btn) return;
      const cmd = btn.dataset.cmd;

      switch (cmd) {
        case 'bold': execFormat('bold'); break;
        case 'italic': execFormat('italic'); break;
        case 'underline': execFormat('underline'); break;
        case 'fontSizeUp': changeFontSize(2); break;
        case 'fontSizeDown': changeFontSize(-2); break;
        case 'alignLeft': setAlignment('left'); break;
        case 'alignCenter': setAlignment('center'); break;
        case 'alignRight': setAlignment('right'); break;
        default: break;
      }
    });
  }

  function enableEditing() {
    document.querySelectorAll(editableSelectors).forEach((el) => {
      if (el.closest('#editorBar') || el.closest('script') || el.closest('canvas')) return;
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'true');
      if (!el.dataset.inputBound) {
        el.dataset.inputBound = '1';
        el.addEventListener('input', () => { isDirty = true; });
      }
      setupDraggable(el);
    });
    document.querySelectorAll('.fund-legend > div').forEach((el) => {
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'true');
      if (!el.dataset.inputBound) {
        el.dataset.inputBound = '1';
        el.addEventListener('input', () => { isDirty = true; });
      }
      setupDraggable(el);
    });
    enableInsertedElements();
  }

  function disableEditing() {
    document.querySelectorAll('[contenteditable="true"]').forEach((el) => {
      el.removeAttribute('contenteditable');
      el.removeAttribute('spellcheck');
    });
  }

  function updateSlideCounter() {
    const counter = document.getElementById('slideCounter');
    if (!counter || typeof Reveal === 'undefined') return;
    counter.textContent = 'Slide ' + (Reveal.getIndices().h + 1) + ' of ' + getSlideCount();
  }

  function bindNavigation() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    if (prevBtn) prevBtn.addEventListener('click', () => Reveal.prev());
    if (nextBtn) nextBtn.addEventListener('click', () => Reveal.next());
    Reveal.on('slidechanged', () => {
      updateSlideCounter();
      updatePreviewSelection();
      disableRevealScaling();
      if (window.__editorMedia && window.__editorMedia.applyGlobalLogo) {
        window.__editorMedia.applyGlobalLogo();
      }
    });
    Reveal.on('ready', () => {
      updateSlideCounter();
      layoutForEditor();
      wrapSlideContent();
      buildSlidePreviews();
      disableRevealScaling();
    });
    setTimeout(updateSlideCounter, 200);
  }

  async function loadSavedContent() {
    const res = await fetch('/api/content');
    const data = await res.json();
    if (data.html) {
      const slides = document.querySelector('.slides');
      if (slides) {
        slides.innerHTML = data.html;
        if (typeof Reveal !== 'undefined') {
          Reveal.sync();
          Reveal.layout();
        }
        wrapSlideContent();
        buildSlidePreviews();
        if (data.zoom) {
          slideZoom = data.zoom;
          applySlideZoom();
        }
        if (window.__editorMedia) {
          window.__editorMedia.loadSaveData(data);
          window.__editorMedia.scanHtmlForMedia && window.__editorMedia.scanHtmlForMedia(data.html);
        }
      }
    }
    if (data.updatedAt) updateLastSaved(data.updatedAt);
    return data;
  }

  async function saveContent() {
    const saveBtn = document.getElementById('saveBtn');
    if (document.activeElement) document.activeElement.blur();

    const slides = document.querySelector('.slides');
    if (!slides) return;

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }

    try {
      const mediaData = window.__editorMedia ? window.__editorMedia.getSaveData() : {};
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: slides.innerHTML,
          zoom: slideZoom,
          mediaLibrary: mediaData.mediaLibrary || [],
          globalLogo: mediaData.globalLogo || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Save failed');
      isDirty = false;
      updateLastSaved(data.updatedAt);
      showToast('Saved! Everyone will see this when they refresh the page.');
    } catch (err) {
      showToast(err.message || 'Could not save changes', true);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'SAVE CHANGES';
      }
    }
  }

  async function refreshContent() {
    if (isDirty && !confirm('You have unsaved changes. Refresh anyway and lose them?')) return;
    await loadSavedContent();
    if (isEditable) enableEditing();
    wrapSlideContent();
    if (window.__editorMedia && window.__editorMedia.applyGlobalLogo) {
      window.__editorMedia.applyGlobalLogo();
    }
    buildSlidePreviews();
    isDirty = false;
    layoutForEditor();
    showToast('Loaded the latest saved version.');
  }

  async function initEditor() {
    let config = { editable: true };
    try {
      const res = await fetch('/api/config');
      config = await res.json();
    } catch (err) {
      console.warn('Config load failed, defaulting to editable');
    }

    isEditable = config.editable;
    document.body.classList.add(isEditable ? 'edit-mode' : 'view-mode');

    const editorBar = document.getElementById('editorBar');
    if (editorBar) editorBar.style.display = isEditable ? 'block' : 'none';

    exposeEditorApi();
    await loadSavedContent();

    if (isEditable) {
      wrapSlideContent();
      if (window.__editorMedia && window.__editorMedia.applyGlobalLogo) {
        window.__editorMedia.applyGlobalLogo();
      }
      buildSlidePreviews();
      enableEditing();
      bindNavigation();
      bindFormatToolbar();
      layoutForEditor();

      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('mouseup', onDragEnd);

      const saveBtn = document.getElementById('saveBtn');
      if (saveBtn) saveBtn.addEventListener('click', saveContent);

      const refreshBtn = document.getElementById('refreshBtn');
      if (refreshBtn) refreshBtn.addEventListener('click', refreshContent);

      const dragBtn = document.getElementById('dragModeBtn');
      if (dragBtn) dragBtn.addEventListener('click', toggleDragMode);

      const jumpBtn = document.getElementById('jumpBtn');
      const jumpInput = document.getElementById('jumpToSlide');
      if (jumpBtn) jumpBtn.addEventListener('click', jumpToSlide);
      if (jumpInput) {
        jumpInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') jumpToSlide();
        });
      }

      const downloadPptBtn = document.getElementById('downloadPptBtn');
      if (downloadPptBtn) downloadPptBtn.addEventListener('click', downloadPptx);

      const togglePreviewBtn = document.getElementById('togglePreviewBtn');
      if (togglePreviewBtn) togglePreviewBtn.addEventListener('click', togglePreviewPanel);

      const insertTextBoxBtn = document.getElementById('insertTextBoxBtn');
      if (insertTextBoxBtn) insertTextBoxBtn.addEventListener('click', insertTextBox);

      const insertImageBtn = document.getElementById('insertImageBtn');
      const insertImageInput = document.getElementById('insertImageInput');
      if (insertImageBtn && insertImageInput) {
        insertImageBtn.addEventListener('click', () => insertImageInput.click());
        insertImageInput.addEventListener('change', () => {
          if (insertImageInput.files && insertImageInput.files[0]) {
            insertImageFromFile(insertImageInput.files[0]);
          }
          insertImageInput.value = '';
        });
      }

      const zoomInBtn = document.getElementById('zoomInBtn');
      const zoomOutBtn = document.getElementById('zoomOutBtn');
      if (zoomInBtn) zoomInBtn.addEventListener('click', () => changeZoom(0.05));
      if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => changeZoom(-0.05));

      window.addEventListener('resize', layoutForEditor);

      document.addEventListener('keydown', (e) => {
        const active = document.activeElement;
        if (active && active.getAttribute('contenteditable') === 'true') {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.stopPropagation();
        }
      }, true);

      window.addEventListener('beforeunload', (e) => {
        if (isDirty) { e.preventDefault(); e.returnValue = ''; }
      });
    } else {
      disableEditing();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initEditor, 300));
  } else {
    setTimeout(initEditor, 300);
  }
})();
