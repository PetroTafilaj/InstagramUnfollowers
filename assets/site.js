'use strict';
(async () => {
  const copy = document.getElementById('copy');
  const label = document.getElementById('copy-label');
  const select = document.getElementById('select');
  const source = document.getElementById('source');
  const status = document.getElementById('copy-status');
  const details = document.getElementById('source-details');
  const dialog = document.getElementById('copy-dialog');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let code = '', closeTimer, resetTimer, copying = false;

  const selectCode = () => { details.open = true; source.focus(); source.select(); };
  const closeDialog = () => {
    if (!dialog.open || dialog.classList.contains('closing')) return;
    dialog.classList.add('closing');
    closeTimer = setTimeout(() => {
      dialog.close();
      dialog.classList.remove('closing');
      copy.focus();
    }, reducedMotion ? 0 : 180);
  };
  const showCopied = () => {
    clearTimeout(closeTimer);
    dialog.classList.remove('closing');
    if (!dialog.open) dialog.showModal();
  };
  document.getElementById('close-dialog').addEventListener('click', closeDialog);
  document.getElementById('dialog-done').addEventListener('click', closeDialog);
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog();
  });
  try {
    const response = await fetch('assets/scanner.js', { method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load the script.');
    code = await response.text();
    source.value = code;
    document.getElementById('code-size').textContent = `${(new TextEncoder().encode(code).length / 1024).toFixed(1)} KB`;
    copy.disabled = false; select.disabled = false;
    label.textContent = 'Copy code';
    status.textContent = 'Paste once. The scan starts automatically.';
  } catch {
    label.textContent = 'Code unavailable';
    status.textContent = 'Could not load the script. Refresh this page.';
  }
  select.addEventListener('click', selectCode);
  copy.addEventListener('click', async () => {
    if (copying || !code) return;
    copying = true;
    clearTimeout(resetTimer);
    copy.classList.remove('is-copied');
    copy.classList.add('is-copying');
    label.textContent = 'Copying…';
    try {
      await navigator.clipboard.writeText(code);
      copy.classList.add('is-copied');
      label.textContent = 'Copied';
      status.textContent = 'Copied. Paste into the console on www.instagram.com.';
      showCopied();
      resetTimer = setTimeout(() => { copy.classList.remove('is-copied'); label.textContent = 'Copy code'; }, 4000);
    } catch {
      label.textContent = 'Copy code';
      selectCode();
      status.textContent = 'Clipboard access is unavailable. The code is selected below; press Ctrl+C or Command+C.';
    } finally {
      copying = false;
      copy.classList.remove('is-copying');
    }
  });
})();
