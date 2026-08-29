import { BRAND, CONTACT, PRODUCTS } from '../brand.js';

/**
 * Shared page chrome — header, products submenu, mobile drawer and footer.
 * Rendered here rather than duplicated across thirteen HTML files.
 */

const NAV = [
  ['Home', 'index.html'],
  ['About Us', 'about.html'],
  ['Products', 'products.html', true],
  ['Quality & Sourcing', 'quality.html'],
  ['Export Markets', 'markets.html'],
  ['Insights', 'insights.html'],
  ['Contact', 'contact.html'],
];

const PRODUCT_FILES = PRODUCTS.map((p) => p.file);

function currentPage() {
  const f = location.pathname.split('/').pop();
  return !f || f === '' ? 'index.html' : f;
}

function submenuHTML() {
  return `<div class="subnav" role="menu">${
    PRODUCTS.map((p) => `
      <a class="subnav__item" role="menuitem" href="${p.file}">
        <span class="subnav__dot" style="--pc:${p.accent}"></span>
        <span>${p.name}</span>
        ${p.primary ? '<em class="subnav__tag">Primary focus</em>' : ''}
      </a>`).join('')
  }</div>`;
}

function headerHTML(here) {
  const links = NAV.map(([label, href, hasSub]) => {
    // Product detail pages keep the Products tab lit.
    const active = href === here || (hasSub && PRODUCT_FILES.includes(here));
    if (!hasSub) {
      return `<a class="nav__link${active ? ' is-current' : ''}" href="${href}">${label}</a>`;
    }
    return `<span class="nav__group" data-subnav>
      <a class="nav__link${active ? ' is-current' : ''}" href="${href}">${label}<i class="nav__caret" aria-hidden="true"></i></a>
      ${submenuHTML()}
    </span>`;
  }).join('');

  return `
  <div class="header__inner">
    <a href="index.html" class="logo">
      <span class="logo__mark">${BRAND.mark}</span><span>${BRAND.name}</span>
    </a>
    <nav class="nav">${links}</nav>
    <a href="contact.html" class="btn header__cta">Send an enquiry <span class="arrow" aria-hidden="true">→</span></a>
    <button class="burger" data-burger aria-label="Menu" aria-expanded="false"><span></span><span></span></button>
  </div>`;
}

function drawerHTML(here) {
  const main = NAV.map(([label, href]) =>
    `<a class="drawer__link${href === here ? ' is-current' : ''}" href="${href}">${label}</a>`).join('');
  const products = PRODUCTS.map((p) =>
    `<a class="drawer__sub${p.file === here ? ' is-current' : ''}" href="${p.file}">${p.name}</a>`).join('');
  return `${main}<div class="drawer__group"><span class="mono drawer__label">Products</span>${products}</div>`;
}

function footerHTML() {
  const products = PRODUCTS.map((p) => `<li><a href="${p.file}">${p.name}</a></li>`).join('');
  const nav = NAV.map(([label, href]) => `<li><a href="${href}">${label}</a></li>`).join('');

  return `
  <div class="wrap">
    <div class="footer__logo" data-gl="logo" aria-hidden="true"></div>
    <p class="footer__claim h3">Indian spices.<br />Global markets.</p>

    <div class="footer__cols">
      <div class="footer__col">
        <h4>Contact</h4>
        <address class="footer__addr">
          ${BRAND.name}<br />
          ${CONTACT.addressLines.join('<br />')}<br /><br />
          <a href="${CONTACT.phoneHref}">${CONTACT.phone}</a><br />
          <a href="mailto:${CONTACT.email}">${CONTACT.email}</a><br /><br />
          ${CONTACT.hours}
        </address>
      </div>
      <div class="footer__col"><h4>Products</h4><ul>${products}</ul></div>
      <div class="footer__col"><h4>Navigate</h4><ul>${nav}</ul></div>
      <div class="footer__col">
        <h4>Enquiries</h4>
        <p class="body" style="color:#ffffffb0">
          Share your product, quantity, packaging and destination and we will
          review the requirement and reply.
        </p>
        <a href="contact.html" class="btn btn--ghost" style="margin-top:1rem">Send an enquiry <span class="arrow" aria-hidden="true">→</span></a>
      </div>
    </div>

    <div class="footer__bottom mono">
      <span>© 2026 ${BRAND.name}</span><span class="spacer"></span>
      <span>${BRAND.tagline}</span>
    </div>
  </div>`;
}

/** Keyboard and touch support for the products submenu. */
function wireSubnav() {
  document.querySelectorAll('[data-subnav]').forEach((group) => {
    const trigger = group.querySelector('.nav__link');
    if (!trigger) return;
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        group.querySelector('.subnav__item')?.focus();
      }
    });
    // On touch the first tap opens the menu rather than navigating.
    trigger.addEventListener('click', (e) => {
      if (!window.matchMedia('(hover: none)').matches) return;
      if (!group.classList.contains('is-open')) {
        e.preventDefault();
        group.classList.add('is-open');
      }
    });
  });
  document.addEventListener('click', (e) => {
    document.querySelectorAll('[data-subnav].is-open').forEach((g) => {
      if (!g.contains(e.target)) g.classList.remove('is-open');
    });
  });
}

export function initChrome() {
  const here = currentPage();

  const header = document.querySelector('[data-chrome="header"]');
  if (header) {
    header.className = 'header';
    header.setAttribute('data-header', '');
    header.innerHTML = headerHTML(here);
  }

  const drawer = document.querySelector('[data-chrome="drawer"]');
  if (drawer) {
    drawer.className = 'drawer';
    drawer.setAttribute('data-drawer', '');
    drawer.innerHTML = drawerHTML(here);
  }

  const footer = document.querySelector('[data-chrome="footer"]');
  if (footer) {
    footer.className = 'footer dark';
    footer.innerHTML = footerHTML();
  }

  const word = document.querySelector('.loader__word');
  if (word) word.textContent = BRAND.name;

  wireSubnav();
}
