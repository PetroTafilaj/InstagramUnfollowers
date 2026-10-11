'use strict';
(async () => {
  const copy = document.getElementById('copy');
  const select = document.getElementById('select');
  const source = document.getElementById('source');
  const status = document.getElementById('copy-status');
  const details = document.getElementById('source-details');
  let code = '';
  const selectCode = () => {
    details.open = true;
    source.focus();
    source.select();
  };
  try {
    // Fetch text, never evaluate or inject the Instagram scanner into this page.
    const response = await fetch('assets/scanner.js', { method: 'GET', credentials: 'omit', redirect: 'error' });
    if (!response.ok) throw new Error('Could not load the script.');
    code = await response.text();
    source.value = code;
    document.getElementById('code-size').textContent = `${Math.round(new TextEncoder().encode(code).length / 1024)} KB`;
    copy.disabled = false;
    select.disabled = false;
    copy.textContent = 'Copy code ↗';
    status.textContent = 'Runs in your Instagram tab. No download needed.';
  } catch (error) {
    copy.textContent = 'Code unavailable';
    status.textContent = 'Could not load the script. Refresh this page, or check that assets/scanner.js was uploaded.';
  }
  select.addEventListener('click', selectCode);
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code);
      copy.textContent = 'Copied ✓';
      status.textContent = 'Code copied. Open the console on www.instagram.com to run it.';
    } catch {
      selectCode();
      status.textContent = 'Clipboard access is unavailable. The code is selected below; press Ctrl+C or Command+C.';
    }
  });
})();
