(function () {
  const editableSelectors =
    'h1,h2,h3,h4,p,li,td,th,.eyebrow,.value,.label,.title,.desc,.phase,.subtitle,.contact,.flow-node,.stat-card strong';

  let isEditable = false;
  let isDirty = false;
  let dragMode = false;
  let dragging = null;
  let dragOffset = { x: 0, y: 0 };
  let slideZoom = 0.85;

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
      el.addEventListener('input', () => { isDirty = true; });
      el.addEventListener('mousedown', onDragStart);
    });
    document.querySelectorAll('.fund-legend > div').forEach((el) => {
      el.setAttribute('contenteditable', 'true');
      el.addEventListener('input', () => { isDirty = true; });
      el.addEventListener('mousedown', onDragStart);
    });
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
      disableRevealScaling();
    });
    Reveal.on('ready', () => {
      updateSlideCounter();
      layoutForEditor();
      wrapSlideContent();
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
        if (data.zoom) {
          slideZoom = data.zoom;
          applySlideZoom();
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
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: slides.innerHTML, zoom: slideZoom }),
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

    await loadSavedContent();

    if (isEditable) {
      wrapSlideContent();
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
