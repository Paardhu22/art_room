(() => {
  'use strict';
  const works = window.ARTWORKS || [];
  const grid = document.querySelector('#artwork-grid');
  const search = document.querySelector('#art-search');
  const sort = document.querySelector('#art-sort');
  const filters = [...document.querySelectorAll('[data-filter]')];
  const viewer = document.querySelector('#art-viewer');
  const image = document.querySelector('#viewer-image');
  const imageWrap = document.querySelector('#viewer-image-wrap');
  const zoom = document.querySelector('#viewer-zoom');
  let category = 'all';
  let visibleWorks = works;
  let selectedId = null;
  let opener = null;

  const count = value => String(value).padStart(2, '0');
  const readPreference = key => { try { return localStorage.getItem(`art-room:${key}`); } catch { return null; } };
  const savePreference = (key, value) => { try { localStorage.setItem(`art-room:${key}`, value); } catch { /* The gallery also works with storage disabled. */ } };

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function artworkLink(art, className) {
    const link = element('a', className);
    link.href = art.original;
    link.dataset.artwork = art.id;
    return link;
  }

  function card(art, index) {
    const article = element('article', 'art-card');
    const preview = artworkLink(art, 'art-image-link');
    preview.setAttribute('aria-label', `View ${art.title}`);
    preview.setAttribute('aria-haspopup', 'dialog');
    preview.setAttribute('aria-controls', 'art-viewer');
    const thumbnail = element('img');
    thumbnail.src = art.image;
    if (art.srcset) thumbnail.srcset = art.srcset;
    thumbnail.sizes = '(max-width: 580px) calc(100vw - 72px), (max-width: 800px) calc((100vw - 114px) / 2), (max-width: 1432px) calc((100vw - 228px) / 3), 390px';
    thumbnail.width = 1200; thumbnail.height = 1200;
    thumbnail.alt = art.alt;
    thumbnail.loading = index === 0 ? 'eager' : 'lazy';
    thumbnail.decoding = 'async';
    if (index === 0) thumbnail.fetchPriority = 'high';
    const hint = element('span', 'art-open-hint', 'Take a closer look ↗');
    hint.setAttribute('aria-hidden', 'true');
    preview.append(thumbnail, hint);
    const caption = element('div', 'art-caption');
    const top = element('div', 'art-caption-top');
    const palette = element('span', 'palette');
    palette.setAttribute('aria-hidden', 'true');
    for (const colour of art.palette || []) {
      const dot = element('span'); dot.style.backgroundColor = colour; palette.append(dot);
    }
    top.append(element('span', 'art-category', art.label), palette);
    const title = element('h3', 'art-title');
    const titleLink = artworkLink(art);
    titleLink.textContent = art.title;
    titleLink.setAttribute('aria-haspopup', 'dialog');
    title.append(titleLink);
    const note = element('p', 'art-note');
    const dash = element('span', '', '—'); dash.setAttribute('aria-hidden', 'true');
    note.append(dash, document.createTextNode(art.note));
    caption.append(top, title, element('p', 'art-medium', art.medium), note);
    article.append(preview, caption, element('span', 'art-index', count(index + 1)));
    return article;
  }

  function render() {
    const query = search.value.trim().toLocaleLowerCase();
    visibleWorks = works.filter(art => (category === 'all' || category === art.category) &&
      [art.title, art.label, art.medium, art.description, art.note].join(' ').toLocaleLowerCase().includes(query));
    if (sort.value === 'title') visibleWorks = [...visibleWorks].sort((a, b) => a.title.localeCompare(b.title));
    grid.replaceChildren(...visibleWorks.map(card));
    grid.hidden = visibleWorks.length === 0;
    document.querySelector('#empty-state').hidden = visibleWorks.length !== 0;
    const total = visibleWorks.length;
    document.querySelector('#results-count').textContent = `${count(total)} ${total === 1 ? 'work' : 'works'} to explore`;
    filters.forEach(button => {
      const active = button.dataset.filter === category;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function setLayout(layout) {
    grid.classList.toggle('is-list', layout === 'list');
    for (const type of ['grid', 'list']) {
      const button = document.querySelector(`#${type}-view`);
      button.classList.toggle('is-active', type === layout);
      button.setAttribute('aria-pressed', String(type === layout));
    }
    savePreference('layout', layout);
  }

  function resetZoom() {
    imageWrap.classList.remove('is-zoomed');
    imageWrap.scrollTop = 0; imageWrap.scrollLeft = 0;
    zoom.setAttribute('aria-pressed', 'false');
    zoom.textContent = 'Zoom in';
  }

  function showArtwork(id, trigger) {
    const art = works.find(work => work.id === id);
    if (!art) return;
    selectedId = id;
    if (trigger) opener = trigger;
    image.src = art.original;
    image.alt = art.alt;
    document.querySelector('#viewer-title').textContent = art.title;
    document.querySelector('#viewer-description').textContent = art.description;
    document.querySelector('#viewer-category').textContent = `${art.label} · ${art.medium}`;
    document.querySelector('#viewer-original').href = art.original;
    const sketchLink = document.querySelector('#viewer-sketch');
    sketchLink.hidden = !art.sketch;
    if (art.sketch) sketchLink.href = art.sketch; else sketchLink.removeAttribute('href');
    const index = visibleWorks.findIndex(work => work.id === id);
    document.querySelector('#viewer-position').textContent = `${count(index + 1)} / ${count(visibleWorks.length)}`;
    document.querySelector('#viewer-previous').disabled = visibleWorks.length < 2;
    document.querySelector('#viewer-next').disabled = visibleWorks.length < 2;
    resetZoom();
    if (!viewer.open) {
      document.body.classList.add('viewer-open');
      viewer.showModal();
      document.querySelector('#viewer-close').focus();
    }
  }

  function finishClose() {
    // A queued close event from a previous visit must not reset a reopened viewer.
    if (viewer.open) return;
    document.body.classList.remove('viewer-open');
    resetZoom(); selectedId = null;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    opener = null;
  }

  function closeViewer() {
    if (viewer.open) viewer.close();
    finishClose();
  }

  function moveArtwork(direction) {
    if (visibleWorks.length < 2) return;
    const index = visibleWorks.findIndex(art => art.id === selectedId);
    showArtwork(visibleWorks[(index + direction + visibleWorks.length) % visibleWorks.length].id);
  }

  filters.forEach(button => button.addEventListener('click', () => { category = button.dataset.filter; render(); }));
  search.addEventListener('input', render);
  sort.addEventListener('change', render);
  document.querySelector('#reset-filters').addEventListener('click', () => { category = 'all'; search.value = ''; render(); search.focus(); });
  document.querySelector('#grid-view').addEventListener('click', () => setLayout('grid'));
  document.querySelector('#list-view').addEventListener('click', () => setLayout('list'));
  grid.addEventListener('click', event => {
    const trigger = event.target.closest('a[data-artwork]');
    if (!trigger || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); showArtwork(trigger.dataset.artwork, trigger);
  });
  document.querySelector('#viewer-close').addEventListener('click', closeViewer);
  viewer.addEventListener('cancel', event => { event.preventDefault(); closeViewer(); });
  viewer.addEventListener('close', finishClose);
  // Checking pointer-down as well avoids closing after a drag that starts on the image.
  let backdropStart = false;
  viewer.addEventListener('pointerdown', event => { backdropStart = event.target === viewer; });
  viewer.addEventListener('click', event => { if (event.target === viewer && backdropStart) closeViewer(); });
  document.querySelector('#viewer-previous').addEventListener('click', () => moveArtwork(-1));
  document.querySelector('#viewer-next').addEventListener('click', () => moveArtwork(1));
  viewer.addEventListener('keydown', event => {
    if (event.altKey || event.metaKey || event.ctrlKey || imageWrap.classList.contains('is-zoomed')) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); moveArtwork(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  zoom.addEventListener('click', () => {
    if (imageWrap.classList.contains('is-zoomed')) { resetZoom(); return; }
    imageWrap.classList.add('is-zoomed');
    zoom.setAttribute('aria-pressed', 'true'); zoom.textContent = 'Fit to view';
    requestAnimationFrame(() => {
      imageWrap.scrollLeft = Math.max(0, (imageWrap.scrollWidth - imageWrap.clientWidth) / 2);
      imageWrap.scrollTop = Math.max(0, (imageWrap.scrollHeight - imageWrap.clientHeight) / 2);
    });
  });
  document.documentElement.removeAttribute('data-theme');
  setLayout(readPreference('layout') === 'list' ? 'list' : 'grid');
  document.querySelector('#collection-total').textContent = count(works.length);
  render();
})();
