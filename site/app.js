/* Research-page interactions; full films remain clean, with separate opening artwork. */
(() => {
  'use strict';
  const matrixVideos = [...document.querySelectorAll('[data-matrix]')];
  const hardwareVideos = [...document.querySelectorAll('[data-hardware], [data-embodiment]')];
  const motion = document.querySelector('#motion-toggle');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const reducedTransparency = matchMedia('(prefers-reduced-transparency: reduce)');
  const backgroundVideo = document.querySelector('#reading-background-video');
  const dialog = document.querySelector('#render-dialog');
  const renderPlayer = document.querySelector('#render-player');
  let matrixVisible = false;
  let matrixPaused = reduced.matches;
  let readingActive = false;
  const visible = new Set();
  const userPaused = new Set();
  const managedPauses = new WeakSet();

  // Keep a short excerpt visible; without JavaScript the full abstract remains readable.
  const abstractToggle = document.querySelector('#abstract-toggle');
  const abstractMore = document.querySelector('#abstract-more');
  if (abstractToggle && abstractMore) {
    abstractMore.hidden = true;
    abstractToggle.hidden = false;
    abstractToggle.addEventListener('click', () => {
      const expanded = abstractToggle.getAttribute('aria-expanded') !== 'true';
      abstractMore.hidden = !expanded;
      abstractToggle.setAttribute('aria-expanded', String(expanded));
      abstractToggle.lastElementChild.textContent = expanded ? 'Show less' : 'Read full abstract';
    });
  }

  function play(video) {
    const attempt = video.play();
    if (attempt) attempt.catch(() => {}); // Native controls remain available if autoplay is blocked.
  }
  function pause(video) {
    if (!video.paused) {
      managedPauses.add(video);
      video.pause();
    }
  }
  function syncMatrix() {
    const running = matrixVisible && !matrixPaused && !document.hidden && !dialog.open;
    for (const video of matrixVideos) {
      if (running) {
        if (!video.getAttribute('src')) video.src = video.dataset.src;
        play(video);
      } else video.pause();
    }
    motion.setAttribute('aria-pressed', String(matrixPaused));
    motion.setAttribute('aria-label', matrixPaused ? 'Play opening videos' : 'Pause opening videos');
  }
  function syncHardware() {
    for (const video of hardwareVideos) {
      if (!document.hidden && !dialog.open && !video.closest('[hidden]') && visible.has(video)) {
        if (!reduced.matches && !userPaused.has(video)) play(video);
      } else pause(video);
    }
  }
  function syncBackground() {
    const staticBackground = reduced.matches || reducedTransparency.matches || navigator.connection?.saveData;
    const running = readingActive && !staticBackground && !document.hidden && !dialog.open;
    if (running) {
      if (!backgroundVideo.getAttribute('src')) backgroundVideo.src = backgroundVideo.dataset.src;
      if (backgroundVideo.paused) play(backgroundVideo);
    } else if (!backgroundVideo.paused) backgroundVideo.pause();
  }
  reducedTransparency.addEventListener('change', syncBackground);
  navigator.connection?.addEventListener('change', syncBackground);
  new IntersectionObserver(entries => {
    matrixVisible = entries[0].isIntersecting;
    syncMatrix();
  }, {threshold: 0}).observe(document.querySelector('.opening'));
  const hardwareObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting && entry.intersectionRatio >= .3) visible.add(entry.target);
      else visible.delete(entry.target);
    }
    syncHardware();
  }, {threshold: [0, .3]});
  hardwareVideos.forEach(video => {
    hardwareObserver.observe(video);
    video.addEventListener('pause', () => {
      if (managedPauses.has(video)) managedPauses.delete(video);
      else if (visible.has(video) && !video.ended && !dialog.open) userPaused.add(video);
    });
    video.addEventListener('play', () => userPaused.delete(video));
    video.addEventListener('volumechange', () => {
      if (!video.muted && video.volume > 0) {
        hardwareVideos.filter(other => other !== video).forEach(pause);
      }
    });
  });
  motion.addEventListener('click', () => { matrixPaused = !matrixPaused; syncMatrix(); });
  reduced.addEventListener('change', () => {
    matrixPaused = reduced.matches;
    if (reduced.matches) hardwareVideos.forEach(pause);
    syncMatrix();
    syncHardware();
    syncBackground();
  });
  document.addEventListener('visibilitychange', () => {
    syncMatrix(); syncHardware(); syncBackground();
    if (document.hidden) renderPlayer.pause();
  });

  // Each group owns its panels; hardware tabs must not switch the render tabs.
  document.querySelectorAll('[role="tablist"]').forEach(tablist => {
    const tabs = [...tablist.querySelectorAll('[data-tab]')];
    function activateTab(tab, focus = false) {
      tabs.forEach(button => {
        const selected = button === tab;
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
        const panel = document.getElementById(button.getAttribute('aria-controls'));
        panel.hidden = !selected;
        if (!selected) panel.querySelectorAll('video').forEach(video => { visible.delete(video); pause(video); });
      });
      if (focus) tab.focus();
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activateTab(tab));
      tab.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next !== undefined) { event.preventDefault(); activateTab(tabs[next], true); }
      });
    });
  });

  const contents = document.querySelector('#page-contents');
  const compact = matchMedia('(max-width: 850px)');
  function outlineLayout() { contents.open = !compact.matches; }
  compact.addEventListener('change', outlineLayout); outlineLayout();
  const outlineLinks = [...document.querySelectorAll('.section-nav a')];
  const outlineSections = outlineLinks.map(link => document.querySelector(link.getAttribute('href')));
  let scrollQueued = false;
  function updateOutline() {
    const openingBottom = document.querySelector('.opening').getBoundingClientRect().bottom;
    readingActive = openingBottom < 80;
    document.body.classList.toggle('reading-active', readingActive);
    const reveal = Math.min(1, Math.max(0, (innerHeight - openingBottom) / (innerHeight * .6)));
    document.documentElement.style.setProperty('--backdrop-reveal', reveal.toFixed(3));
    syncBackground();
    let active = 0;
    outlineSections.forEach((section, index) => { if (section.getBoundingClientRect().top < 180) active = index; });
    outlineLinks.forEach((link, index) => {
      if (index === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    scrollQueued = false;
  }
  document.addEventListener('scroll', () => {
    if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateOutline); }
  }, {passive: true});
  window.addEventListener('resize', () => {
    if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateOutline); }
  }, {passive: true});
  outlineLinks.forEach(link => link.addEventListener('click', () => { if (compact.matches) contents.open = false; }));
  updateOutline();

  // The shared viewer handles media; this page controls its background players.
  dialog.addEventListener('mediaopen', () => {
    syncMatrix(); syncHardware(); syncBackground();
  });
  dialog.addEventListener('close', () => {
    syncMatrix(); syncHardware(); syncBackground();
  });

  document.querySelector('#copy-citation').addEventListener('click', async () => {
    const button = document.querySelector('#copy-citation');
    const status = document.querySelector('#copy-status');
    try {
      await navigator.clipboard.writeText(document.querySelector('#bibtex').textContent);
      button.textContent = 'Copied'; status.textContent = 'Citation copied.';
      setTimeout(() => { button.textContent = 'Copy'; }, 2000);
    } catch (_) { status.textContent = 'Select the citation text to copy it.'; }
  });
})();
