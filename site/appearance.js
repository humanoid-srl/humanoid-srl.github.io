/* Apply the saved reader theme before paint; keep media materials unchanged. */
(() => {
  'use strict';
  const root = document.documentElement;
  const storageKey = 'humanoid-srl.appearance.v1';
  let saved;
  try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch (_) {}
  // Migrate previous defaults once; retain other reader adjustments.
  const previousDefault = (saved?.backgroundVersion !== 4 && saved?.blur === 5)
    || (![3, 4].includes(saved?.backgroundVersion) && [6, 12].includes(saved?.blur));
  const storedBlur = previousDefault ? 10 : saved?.blur;
  const settings = {
    backgroundVersion: 4,
    theme: saved?.theme === 'dark' ? 'dark' : 'light',
    blur: typeof storedBlur === 'number' && Number.isFinite(storedBlur)
      ? Math.max(0, Math.min(10, Math.round(storedBlur))) : 10
  };
  function apply() {
    root.dataset.theme = settings.theme;
    root.style.setProperty('--background-blur', settings.blur + 'px');
    root.style.setProperty('--background-overscan', settings.blur * 3 + 'px');
    // At zero, retain source color and detail instead of a fixed opaque wash.
    const softness = Math.min(1, settings.blur / 5);
    root.style.setProperty('--background-saturation', 1 - .3 * softness);
    root.style.setProperty('--wash-light-edge', .48 + .14 * softness);
    root.style.setProperty('--wash-light-center', .68 + .10 * softness);
    root.style.setProperty('--wash-dark-edge', .48 + .17 * softness);
    root.style.setProperty('--wash-dark-center', .72 + .08 * softness);
  }
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch (_) {}
  }
  apply();
  persist();
  document.addEventListener('DOMContentLoaded', () => {
    const panel = document.querySelector('#appearance-tuner');
    const themes = [...panel.querySelectorAll('[data-theme-choice]')];
    const input = document.querySelector('#background-blur');
    const output = document.querySelector('#background-blur-value');
    function update() {
      apply();
      themes.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === settings.theme)));
      if (input) {
        input.value = settings.blur;
        output.textContent = settings.blur;
        input.setAttribute('aria-valuetext', settings.blur + ' out of 10');
      }
      document.querySelector('meta[name="theme-color"]').content = settings.theme === 'dark' ? '#172328' : '#f7f9f7';
    }
    themes.forEach(button => button.addEventListener('click', () => {
      settings.theme = button.dataset.themeChoice;
      update(); persist();
    }));
    input?.addEventListener('input', () => { settings.blur = Number(input.value); update(); });
    input?.addEventListener('change', persist);
    panel.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault(); panel.open = false;
        panel.querySelector('summary').focus();
      }
    });
    document.addEventListener('click', event => {
      if (panel.open && !panel.contains(event.target)) panel.open = false;
    });
    update(); panel.hidden = false;
  });
})();
