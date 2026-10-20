/* Shared photo/video viewer for the research page and the lab collection. */
(() => {
  'use strict';
  const dialog = document.querySelector('#render-dialog');
  const player = document.querySelector('#render-player');
  const image = document.querySelector('#detail-image');
  let trigger = null;

  document.querySelectorAll('[data-render], [data-media]').forEach(button => {
    button.addEventListener('click', () => {
      const selected = window.SRL_MEDIA[button.dataset.media || 'render-' + button.dataset.render];
      if (!selected) return;
      const photo = selected.type === 'image';
      trigger = button;
      document.querySelector('#render-title').textContent = selected.title;
      const description = document.querySelector('#render-description');
      description.textContent = selected.capability_description || '';
      description.hidden = !selected.capability_description;
      if (selected.capability_description) dialog.setAttribute('aria-describedby', description.id);
      else dialog.removeAttribute('aria-describedby');
      const link = document.querySelector('#render-download');
      link.hidden = !photo;
      if (photo) link.href = selected.src;
      else link.removeAttribute('href');
      document.querySelector('#media-context').textContent = selected.description || '';
      document.querySelector('#media-footer').hidden = selected.kind === 'Rendered illustration';
      player.hidden = photo;
      image.hidden = !photo;
      if (photo) {
        image.src = selected.src;
        image.alt = selected.description;
      } else {
        player.src = selected.src;
        player.poster = selected.poster;
        player.setAttribute('aria-label', selected.title);
      }
      dialog.showModal();
      dialog.dispatchEvent(new Event('mediaopen'));
      if (!photo) player.play()?.catch(() => {});
    });
  });
  document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    player.pause(); player.removeAttribute('src'); player.load();
    image.removeAttribute('src');
    trigger?.focus({preventScroll: true});
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) player.pause(); });
})();
