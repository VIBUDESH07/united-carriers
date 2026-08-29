import { PRODUCTS, WHY_US, PROCESS, BUYERS, MARKET_CATEGORIES, CONTACT, BRAND } from '../brand.js';

/**
 * Data-driven page content.
 *
 * The product range, buyer types, process steps and market categories are
 * rendered from `brand.js` rather than typed into seven HTML files. That keeps
 * them consistent, and — more importantly — means the claims policy is enforced
 * in one place: if a specification is not in the data, it cannot appear on a
 * page by accident.
 */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function productCard(p) {
  return `
  <article class="pcard" style="--pc:${p.accent}" data-tilt>
    <a class="pcard__hit" href="${p.file}" aria-label="${esc(p.name)}"></a>
    <div class="pcard__media" data-uncover>
      <img src="assets/photo/${p.slug}.webp" width="900" height="900"
           alt="${esc(p.name)}" loading="lazy" decoding="async" />
      ${p.primary ? '<span class="pcard__flag mono">Primary focus</span>' : ''}
    </div>
    <div class="pcard__body">
      <span class="mono pcard__latin">${esc(p.latin)}</span>
      <h3 class="h3">${esc(p.name)}</h3>
      <p class="body">${esc(p.lede)}</p>
      <ul class="pcard__forms">
        ${p.forms.map((f) => `<li class="mono">${esc(f)}</li>`).join('')}
      </ul>
      <span class="service__link mono">View product <span class="arrow" aria-hidden="true">→</span></span>
    </div>
  </article>`;
}

function fill(sel, html) {
  document.querySelectorAll(sel).forEach((el) => { el.innerHTML = html; });
}

export function initContent() {
  // Home + products: the range as cards.
  fill('[data-product-cards]', PRODUCTS.map(productCard).join(''));

  // Home: why us.
  fill('[data-why-list]', WHY_US.map(([title, body], i) => `
    <div class="why__item">
      <span class="why__num mono">${String(i + 1).padStart(2, '0')}</span>
      <div><h3 class="h3">${esc(title)}</h3><p class="body">${esc(body)}</p></div>
    </div>`).join(''));

  // Home + quality: the six-step process.
  fill('[data-process]', PROCESS.map(([title, body], i) => `
    <li class="step" data-tilt>
      <span class="step__num mono">${String(i + 1).padStart(2, '0')}</span>
      <h3 class="h4">${esc(title)}</h3>
      <p class="body">${esc(body)}</p>
    </li>`).join(''));

  // Home + markets: who buys.
  fill('[data-buyers]', BUYERS.map(([title, body], i) => `
    <article class="ind" data-tilt>
      <span class="ind__num mono">${String(i + 1).padStart(2, '0')}</span>
      <h3 class="h3">${esc(title)}</h3>
      <p class="body">${esc(body)}</p>
    </article>`).join(''));

  // Departure act: market *categories*, staged across the pull-back.
  fill('[data-market-quad]', MARKET_CATEGORIES.slice(0, 4).map((m, i) => `
    <div class="act__q" data-stage="${(0.20 + i * 0.04).toFixed(2)},0.54">
      <h3 class="h4">${esc(m)}</h3>
      <p class="body">Enquiries reviewed against the product, destination and applicable requirements.</p>
    </div>`).join(''));

  // Markets page: the full category list.
  fill('[data-market-list]', MARKET_CATEGORIES.map((m, i) => `
    <article class="ind" data-tilt>
      <span class="ind__num mono">${String(i + 1).padStart(2, '0')}</span>
      <h3 class="h3">${esc(m)}</h3>
      <p class="body">Destination, regulatory and documentation requirements vary by market, so each enquiry is reviewed on its own terms.</p>
    </article>`).join(''));

  // Products page: full-width rows.
  fill('[data-product-rows]', PRODUCTS.map((p) => `
    <article class="prod" style="--pc:${p.accent}" data-reveal>
      <div class="prod__media" data-uncover>
        <img src="assets/photo/${p.slug}-wide.webp" width="1400" height="933"
             alt="${esc(p.name)}" loading="lazy" decoding="async" />
      </div>
      <div class="prod__body">
        <span class="mono pcard__latin">${esc(p.latin)}</span>
        <h2 class="h2">${p.headline.map(esc).join('<br />')}</h2>
        <p class="lead">${esc(p.lede)}</p>
        <div class="prod__cols">
          <div>
            <h4 class="mono prod__label">Forms</h4>
            <ul class="ticks">${p.forms.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
          </div>
          <div>
            <h4 class="mono prod__label">Applications</h4>
            <ul class="ticks">${p.applications.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
          </div>
        </div>
        <a href="${p.file}" class="btn btn--outline">View ${esc(p.name.toLowerCase())} <span class="arrow" aria-hidden="true">→</span></a>
      </div>
    </article>`).join(''));

  // Product detail pages fill themselves from their slug.
  document.querySelectorAll('[data-product-detail]').forEach((el) => {
    const p = PRODUCTS.find((x) => x.slug === el.dataset.productDetail);
    if (!p) return;
    el.innerHTML = `
      <div class="pdetail__cols">
        <div>
          <h3 class="mono prod__label">Available forms</h3>
          <ul class="ticks">${p.forms.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        </div>
        <div>
          <h3 class="mono prod__label">Applications</h3>
          <ul class="ticks">${p.applications.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
        </div>
        <div>
          <h3 class="mono prod__label">Quality characteristics discussed</h3>
          <ul class="ticks">${p.considers.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
        </div>
      </div>`;
  });

  // Product pages pull their own headline, lede and overview from the data.
  document.querySelectorAll('[data-product-headline]').forEach((el) => {
    const p = PRODUCTS.find((x) => x.slug === el.dataset.productHeadline);
    if (p) el.innerHTML = p.headline.map((l) => `<span class="line">${esc(l)}</span>`).join('');
  });
  document.querySelectorAll('[data-product-lede]').forEach((el) => {
    const p = PRODUCTS.find((x) => x.slug === el.dataset.productLede);
    if (p) el.textContent = p.lede;
  });
  document.querySelectorAll('[data-product-overview]').forEach((el) => {
    const p = PRODUCTS.find((x) => x.slug === el.dataset.productOverview);
    if (!p) return;
    el.textContent = p.primary
      ? 'Turmeric is our primary product focus. We aim to connect quality Indian turmeric with international buyers across food, spice and processing markets. Product specifications are confirmed according to the buyer\'s application, destination and required standards.'
      : `${p.lede} Product specifications are confirmed according to your application, destination and required standards.`;
  });

  // Contact details, so an address change is one edit in brand.js.
  fill('[data-contact-block]', `
    ${esc(BRAND.name)}<br />
    ${CONTACT.addressLines.map(esc).join('<br />')}<br /><br />
    <a href="${CONTACT.phoneHref}">${esc(CONTACT.phone)}</a><br />
    <a href="mailto:${CONTACT.email}">${esc(CONTACT.email)}</a><br /><br />
    ${esc(CONTACT.hours)}`);

  // "Other products" strip at the foot of each product page.
  document.querySelectorAll('[data-other-products]').forEach((el) => {
    const here = el.dataset.otherProducts;
    el.innerHTML = PRODUCTS.filter((p) => p.slug !== here).map((p) => `
      <a class="othercard" href="${p.file}" style="--pc:${p.accent}" data-tilt>
        <img src="assets/photo/${p.slug}.webp" width="900" height="900"
             alt="${esc(p.name)}" loading="lazy" decoding="async" />
        <span class="othercard__name h4">${esc(p.name)}</span>
      </a>`).join('');
  });
}
