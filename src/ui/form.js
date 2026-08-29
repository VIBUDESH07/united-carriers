/**
 * Contact form. There is no backend here, so submission is validated and
 * acknowledged client-side rather than pretending to send anything.
 */
export function initForm() {
  const form = document.querySelector('[data-form]');
  if (!form) return;

  const status = form.querySelector('[data-form-status]');

  const setError = (field, msg) => {
    const wrap = field.closest('.field');
    if (!wrap) return;
    wrap.classList.toggle('has-error', !!msg);
    const note = wrap.querySelector('.field__error');
    if (note) note.textContent = msg || '';
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;

    form.querySelectorAll('[required]').forEach((f) => {
      const v = f.value.trim();
      let msg = '';
      if (!v) msg = 'This field is required.';
      else if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) msg = 'Enter a valid email address.';
      if (msg) ok = false;
      setError(f, msg);
    });

    if (!ok) {
      if (status) {
        status.textContent = 'Please check the highlighted fields.';
        status.className = 'form__status is-error';
      }
      return;
    }

    if (status) {
      status.textContent = 'Thanks — this demo build has no backend, so nothing was sent. Wire the form action to your endpoint to go live.';
      status.className = 'form__status is-ok';
    }
    form.reset();
  });

  // Clear an error as soon as the field is touched again.
  form.querySelectorAll('input, textarea, select').forEach((f) => {
    f.addEventListener('input', () => setError(f, ''));
  });
}
