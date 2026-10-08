/* WDTPRS Ordo: reader-local "today" on cached pages, the date picker, and the bare-page forward.
   No requests to the server; everything comes from data already in the page. */
(() => {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // /ordo/ → /ordo/<reader's today>/
  const fwd = document.querySelector('.wdtprs-ordo-forward');
  if (fwd) location.replace(`${fwd.dataset.base}${today}/`);

  document.querySelectorAll('.wdtprs-ordo-jump').forEach((el) => el.addEventListener('change', () => {
    if (el.value) location.href = `${el.dataset.base}${el.value}/`;
  }));

  document.querySelector(`.wdtprs-ordo-cell[data-date="${today}"]`)?.classList.add('is-today');

  // Today widget: switch to the reader's date if the cached page was built for another day.
  document.querySelectorAll('.wdtprs-ordo-today').forEach((box) => {
    if (box.dataset.today === today) return;
    let win;
    try { win = JSON.parse(box.querySelector('.wdtprs-ordo-window').textContent); } catch { return; }
    const day = win[today];
    if (!day) return; // outside the ±7-day window: keep the server's day and link
    const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    box.querySelector('[data-slot="date"]').textContent = fmt.format(d);
    for (const f of ['vo', 'no']) {
      const row = box.querySelector(`[data-slot="${f}"]`);
      if (!row || !day[f]) continue;
      row.style.setProperty('--lit', `var(--ordo-${day[f].c || 'none'})`);
      row.querySelector('.wdtprs-ordo-today-name').textContent = day[f].n;
      row.querySelector('.wdtprs-ordo-today-has').hidden = !day[f].h;
    }
    box.querySelector('[data-slot="link"]').href = `${box.dataset.base}${today}/`;
  });
})();
