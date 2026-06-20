/* Media library + global logo — extends editor.js */
(function () {
  if (window.__editorMedia) return;

  let mediaLibrary = [];
  let globalLogo = null;

  const CORNERS = {
    'top-left': { top: '16px', left: '16px', right: 'auto', bottom: 'auto' },
    'top-right': { top: '16px', right: '16px', left: 'auto', bottom: 'auto' },
    'bottom-left': { bottom: '16px', left: '16px', right: 'auto', top: 'auto' },
    'bottom-right': { bottom: '16px', right: '16px', left: 'auto', top: 'auto' },
  };

  function generateId() {
    return 'med_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function getEditorApi() {
    return window.__editorApi || {};
  }

  function markDirty() {
    const api = getEditorApi();
    if (api.setDirty) api.setDirty(true);
  }

  function getMediaById(id) {
    return mediaLibrary.find((m) => m.id === id) || null;
  }

  function addToMediaLibrary(name, dataUrl) {
    const existing = mediaLibrary.find((m) => m.dataUrl === dataUrl);
    if (existing) return existing;

    const item = {
      id: generateId(),
      name: name || 'Image',
      dataUrl,
      createdAt: new Date().toISOString(),
    };
    mediaLibrary.push(item);
    renderMediaLibrary();
    markDirty();
    return item;
  }

  function createImageElement(media, opts) {
    const img = document.createElement('img');
    img.src = media.dataUrl;
    img.alt = media.name;
    img.draggable = false;
    img.dataset.mediaId = media.id;
    if (opts && opts.maxWidth) img.style.maxWidth = opts.maxWidth + 'px';
    return img;
  }

  function insertMediaOnCanvas(canvas, media, offsetIndex) {
    const api = getEditorApi();
    const img = createImageElement(media, { maxWidth: 360 });
    const wrap = api.createInsertedWrapper('image', img);
    wrap.dataset.mediaId = media.id;
    wrap.dataset.fromLibrary = 'true';
    const n = offsetIndex || canvas.querySelectorAll('.inserted-wrap-image[data-from-library]').length;
    wrap.style.left = (80 + n * 24) + 'px';
    wrap.style.top = (140 + n * 24) + 'px';
    canvas.appendChild(wrap);
    return wrap;
  }

  function insertMediaOnCurrentSlide(mediaId) {
    const api = getEditorApi();
    const media = getMediaById(mediaId);
    const canvas = api.getCurrentSlideCanvas && api.getCurrentSlideCanvas();
    if (!media || !canvas) return;
    insertMediaOnCanvas(canvas, media);
    api.buildSlidePreviews && api.buildSlidePreviews();
    api.showToast && api.showToast('Image added to this slide from your media library.');
    markDirty();
  }

  function insertMediaOnAllSlides(mediaId) {
    const api = getEditorApi();
    const media = getMediaById(mediaId);
    if (!media) return;

    document.querySelectorAll('.reveal .slides > section').forEach((section) => {
      let canvas = section.querySelector(':scope > .slide-zoom-wrap');
      if (!canvas) return;
      const count = canvas.querySelectorAll('[data-media-id="' + mediaId + '"]').length;
      if (count > 0) return;
      insertMediaOnCanvas(canvas, media, 0);
    });

    api.buildSlidePreviews && api.buildSlidePreviews();
    api.showToast && api.showToast('Image added to all slides that did not already have it.');
    markDirty();
  }

  function positionLogoAtCorner(wrap, corner, width) {
    const pos = CORNERS[corner] || CORNERS['top-right'];
    wrap.style.position = 'absolute';
    wrap.style.top = pos.top;
    wrap.style.left = pos.left;
    wrap.style.right = pos.right;
    wrap.style.bottom = pos.bottom;
    wrap.style.width = (width || 100) + 'px';
    wrap.style.zIndex = '30';
    const img = wrap.querySelector('img');
    if (img) {
      img.style.width = '100%';
      img.style.height = 'auto';
      img.style.maxWidth = (width || 100) + 'px';
    }
  }

  function createLogoElement(media, config) {
    const wrap = document.createElement('div');
    wrap.className = 'global-slide-logo is-positioned';
    wrap.dataset.mediaId = media.id;
    wrap.dataset.logoCorner = config.corner;

    const img = createImageElement(media, {});
    img.className = 'logo-img';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-logo-btn';
    removeBtn.textContent = '\u00d7';
    removeBtn.title = 'Remove logo from this slide only';

    wrap.appendChild(img);
    wrap.appendChild(removeBtn);
    positionLogoAtCorner(wrap, config.corner, config.width || 100);
    return wrap;
  }

  function setupLogoOnSlide(logoWrap, section) {
    const api = getEditorApi();
    const removeBtn = logoWrap.querySelector('.remove-logo-btn');
    if (removeBtn && !removeBtn.dataset.bound) {
      removeBtn.dataset.bound = '1';
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        logoWrap.remove();
        section.dataset.logoExempt = 'true';
        section.dataset.logoCustom = 'false';
        api.buildSlidePreviews && api.buildSlidePreviews();
        markDirty();
        api.showToast && api.showToast('Logo removed from this slide only.');
      });
    }
    if (api.setupDraggable) api.setupDraggable(logoWrap);
  }

  function applyGlobalLogo() {
    if (!globalLogo || !globalLogo.mediaId) return;
    const media = getMediaById(globalLogo.mediaId);
    if (!media) return;

    document.querySelectorAll('.reveal .slides > section').forEach((section) => {
      if (section.dataset.logoExempt === 'true') return;

      let canvas = section.querySelector(':scope > .slide-zoom-wrap');
      if (!canvas) return;

      let logoWrap = canvas.querySelector(':scope > .global-slide-logo');

      if (!logoWrap) {
        logoWrap = createLogoElement(media, globalLogo);
        canvas.appendChild(logoWrap);
      } else if (section.dataset.logoCustom !== 'true') {
        logoWrap.dataset.mediaId = media.id;
        logoWrap.dataset.logoCorner = globalLogo.corner;
        const img = logoWrap.querySelector('img');
        if (img) img.src = media.dataUrl;
        positionLogoAtCorner(logoWrap, globalLogo.corner, globalLogo.width || 100);
      }

      setupLogoOnSlide(logoWrap, section);
    });
  }

  function setGlobalLogo(mediaId, corner) {
    const media = getMediaById(mediaId);
    if (!media) return;

    globalLogo = {
      mediaId,
      corner,
      width: 100,
    };

    applyGlobalLogo();
    renderMediaLibrary();
    markDirty();
    const api = getEditorApi();
    api.showToast && api.showToast('Logo set on all slides (' + corner.replace('-', ' ') + '). Remove or drag on any slide to customize.');
  }

  function clearGlobalLogo() {
    globalLogo = null;
    document.querySelectorAll('.global-slide-logo').forEach((el) => el.remove());
    document.querySelectorAll('.reveal .slides > section').forEach((s) => {
      delete s.dataset.logoExempt;
      delete s.dataset.logoCustom;
    });
    renderMediaLibrary();
    markDirty();
    const api = getEditorApi();
    api.showToast && api.showToast('Logo removed from all slides.');
  }

  function onLogoDragEnd(dragging, section) {
    if (!dragging || !dragging.classList.contains('global-slide-logo')) return;
    if (section) {
      section.dataset.logoCustom = 'true';
      markDirty();
    }
  }

  function updateMediaBarVisibility() {
    const bar = document.getElementById('mediaLibraryBar');
    if (!bar) return;
    const collapsed = document.body.classList.contains('media-bar-collapsed');
    bar.style.display = mediaLibrary.length && !collapsed ? '' : 'none';
  }

  function renderMediaLibrary() {
    const list = document.getElementById('mediaLibraryList');
    if (!list) return;

    if (!mediaLibrary.length) {
      list.innerHTML = '';
      updateMediaBarVisibility();
      return;
    }

    list.innerHTML = '';
    mediaLibrary.forEach((media) => {
      const card = document.createElement('div');
      card.className = 'media-card';
      if (globalLogo && globalLogo.mediaId === media.id) card.classList.add('is-logo');

      const thumb = document.createElement('img');
      thumb.className = 'media-thumb';
      thumb.src = media.dataUrl;
      thumb.alt = media.name;

      const meta = document.createElement('div');
      meta.className = 'media-meta';
      meta.innerHTML = '<strong>' + media.name + '</strong>';

      const actions = document.createElement('div');
      actions.className = 'media-actions';

      const btnThis = document.createElement('button');
      btnThis.type = 'button';
      btnThis.textContent = 'This slide';
      btnThis.title = 'Add to current slide';
      btnThis.addEventListener('click', () => insertMediaOnCurrentSlide(media.id));

      const btnAll = document.createElement('button');
      btnAll.type = 'button';
      btnAll.textContent = 'All slides';
      btnAll.title = 'Add to every slide';
      btnAll.addEventListener('click', () => insertMediaOnAllSlides(media.id));

      actions.appendChild(btnThis);
      actions.appendChild(btnAll);

      const logoRow = document.createElement('div');
      logoRow.className = 'media-logo-row';
      logoRow.innerHTML = '<span>Logo corner:</span>';

      ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach((corner) => {
        const lb = document.createElement('button');
        lb.type = 'button';
        lb.className = 'logo-corner-btn';
        lb.textContent = corner === 'top-left' ? '\u2196' : corner === 'top-right' ? '\u2197' : corner === 'bottom-left' ? '\u2199' : '\u2198';
        lb.title = 'Use as logo — ' + corner.replace('-', ' ');
        if (globalLogo && globalLogo.mediaId === media.id && globalLogo.corner === corner) {
          lb.classList.add('active');
        }
        lb.addEventListener('click', () => setGlobalLogo(media.id, corner));
        logoRow.appendChild(lb);
      });

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'media-clear-logo';
      clearBtn.textContent = 'Remove logo everywhere';
      clearBtn.addEventListener('click', clearGlobalLogo);
      if (globalLogo && globalLogo.mediaId === media.id) logoRow.appendChild(clearBtn);

      card.appendChild(thumb);
      card.appendChild(meta);
      card.appendChild(actions);
      card.appendChild(logoRow);
      list.appendChild(card);
    });
    updateMediaBarVisibility();
  }

  function toggleMediaLibraryBar() {
    document.body.classList.toggle('media-bar-collapsed');
    const btn = document.getElementById('toggleMediaBarBtn');
    if (btn) {
      const collapsed = document.body.classList.contains('media-bar-collapsed');
      btn.textContent = collapsed ? 'Show Media' : 'Hide Media';
    }
    updateMediaBarVisibility();
    const api = getEditorApi();
    if (api.layoutForEditor) api.layoutForEditor();
  }

  function addFileToLibrary(file, alsoInsertCurrent) {
    const api = getEditorApi();
    if (!file.type.startsWith('image/')) {
      api.showToast && api.showToast('Please choose an image or GIF file.', true);
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      api.showToast && api.showToast('File is too large. Please use an image under 3 MB.', true);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const media = addToMediaLibrary(file.name.replace(/\.[^.]+$/, ''), e.target.result);
      if (alsoInsertCurrent) insertMediaOnCurrentSlide(media.id);
      api.showToast && api.showToast('Saved to Media Library' + (alsoInsertCurrent ? ' and added to this slide.' : '.'));
    };
    reader.onerror = () => api.showToast && api.showToast('Could not read that image file.', true);
    reader.readAsDataURL(file);
  }

  function getSaveData() {
    return {
      mediaLibrary,
      globalLogo,
    };
  }

  function loadSaveData(data) {
    mediaLibrary = Array.isArray(data.mediaLibrary) ? data.mediaLibrary : [];
    globalLogo = data.globalLogo || null;
    renderMediaLibrary();
  }

  function scanHtmlForMedia(html) {
    const re = /data-media-id="([^"]+)"|src="(data:image[^"]+)"/g;
    let m;
    const urls = new Set();
    while ((m = re.exec(html)) !== null) {
      if (m[2]) urls.add(m[2]);
    }
    urls.forEach((url) => {
      if (!mediaLibrary.some((x) => x.dataUrl === url)) {
        addToMediaLibrary('Imported image', url);
      }
    });
  }

  function bindMediaLibraryUi() {
    const toggleBtn = document.getElementById('toggleMediaBarBtn');
    if (toggleBtn) toggleBtn.addEventListener('click', toggleMediaLibraryBar);

    const uploadBtn = document.getElementById('uploadToLibraryBtn');
    const uploadInput = document.getElementById('uploadToLibraryInput');
    if (uploadBtn && uploadInput) {
      uploadBtn.addEventListener('click', () => uploadInput.click());
      uploadInput.addEventListener('change', () => {
        if (uploadInput.files && uploadInput.files[0]) {
          addFileToLibrary(uploadInput.files[0], true);
        }
        uploadInput.value = '';
      });
    }

    renderMediaLibrary();
  }

  window.__editorMediaInit = function (api) {
    window.__editorApi = api;
    bindMediaLibraryUi();
  };

  window.__editorMedia = {
    addFileToLibrary,
    loadSaveData,
    getSaveData,
    scanHtmlForMedia,
    applyGlobalLogo,
    onLogoDragEnd,
    insertMediaOnCurrentSlide,
  };
})();
