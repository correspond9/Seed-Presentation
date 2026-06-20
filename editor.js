(function () {
  const editableSelectors =
    'h1,h2,h3,h4,p,li,td,th,.eyebrow,.value,.label,.title,.desc,.phase,.subtitle,.contact,.flow-node,.stat-card strong';

  let isEditable = false;
  let isDirty = false;
  let lastKnownUpdate = null;

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
    const d = new Date(iso);
    return 'Last saved: ' + d.toLocaleString();
  }

  function updateLastSaved(iso) {
    const el = document.getElementById('lastSaved');
    if (el) el.textContent = formatSavedTime(iso);
    lastKnownUpdate = iso;
  }

  function enableEditing() {
    document.querySelectorAll(editableSelectors).forEach((el) => {
      if (el.closest('#editorBar') || el.closest('script') || el.closest('canvas')) return;
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'true');
      el.addEventListener('input', () => {
        isDirty = true;
      });
    });
    document.querySelectorAll('.fund-legend > div').forEach((el) => {
      el.setAttribute('contenteditable', 'true');
      el.addEventListener('input', () => {
        isDirty = true;
      });
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
    const idx = Reveal.getIndices().h + 1;
    const total = Reveal.getTotalSlides();
    counter.textContent = 'Slide ' + idx + ' of ' + total;
  }

  function bindNavigation() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    if (prevBtn) prevBtn.addEventListener('click', () => Reveal.prev());
    if (nextBtn) nextBtn.addEventListener('click', () => Reveal.next());
    Reveal.on('slidechanged', updateSlideCounter);
    Reveal.on('ready', updateSlideCounter);
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
        body: JSON.stringify({ html: slides.innerHTML }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Save failed');
      }
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
    if (isDirty && !confirm('You have unsaved changes. Refresh anyway and lose them?')) {
      return;
    }
    await loadSavedContent();
    if (isEditable) enableEditing();
    isDirty = false;
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
    if (editorBar) {
      editorBar.style.display = isEditable ? 'block' : 'none';
    }

    await loadSavedContent();

    if (isEditable) {
      enableEditing();
      bindNavigation();

      const saveBtn = document.getElementById('saveBtn');
      if (saveBtn) saveBtn.addEventListener('click', saveContent);

      const refreshBtn = document.getElementById('refreshBtn');
      if (refreshBtn) refreshBtn.addEventListener('click', refreshContent);

      document.addEventListener(
        'keydown',
        (e) => {
          const active = document.activeElement;
          if (active && active.getAttribute('contenteditable') === 'true') {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.stopPropagation();
            }
          }
        },
        true
      );

      window.addEventListener('beforeunload', (e) => {
        if (isDirty) {
          e.preventDefault();
          e.returnValue = '';
        }
      });
    } else {
      disableEditing();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initEditor, 300);
    });
  } else {
    setTimeout(initEditor, 300);
  }
})();
