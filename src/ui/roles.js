/** Careers listing: filter chips plus expandable role rows. */
export function initRoles() {
  const board = document.querySelector('[data-roles]');
  if (!board) return;

  const rows = [...board.querySelectorAll('[data-role]')];
  const chips = [...document.querySelectorAll('[data-role-filter]')];
  const count = document.querySelector('[data-role-count]');

  const apply = (team) => {
    let shown = 0;
    rows.forEach((r) => {
      const match = team === 'all' || r.dataset.team === team;
      r.hidden = !match;
      if (match) shown++;
    });
    if (count) count.textContent = shown;
    chips.forEach((c) => c.classList.toggle('is-active', c.dataset.roleFilter === team));
  };

  chips.forEach((c) => c.addEventListener('click', () => apply(c.dataset.roleFilter)));

  rows.forEach((r) => {
    const btn = r.querySelector('[data-role-toggle]');
    const panel = r.querySelector('[data-role-panel]');
    if (!btn || !panel) return;
    btn.addEventListener('click', () => {
      const open = r.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
      panel.style.height = open ? panel.scrollHeight + 'px' : '0px';
    });
  });

  apply('all');
}
