/**
 * Brand and business content — the single place to edit it.
 *
 * CLAIMS POLICY (blueprint §13). This is a new business. Nothing here may
 * assert years of experience, shipment volumes, countries actually served,
 * certifications held, laboratory testing, verified product specifications,
 * direct farmer relationships, or facilities and staff. Future intent is
 * phrased as intent ("our aim", "we are building", "we focus on"). Add hard
 * numbers, specs, certificates and destination lists ONLY once verified.
 */

const env = (key, fallback) => {
  const v = import.meta.env?.[key];
  return v === undefined || v === '' ? fallback : v;
};

export const BRAND = {
  name: env('VITE_COMPANY_NAME', 'Madhusree Private Limited'),
  short: env('VITE_COMPANY_SHORT', 'Madhusree'),
  mark: env('VITE_COMPANY_MARK', 'M'),
  wordmark: env('VITE_COMPANY_WORDMARK', 'MADHUSREE'),
  positioning: ['Rooted in India.', 'Ready for the world.'],
  tagline: 'Indian spices. Global possibilities.',
};

/** TODO: replace with verified details before launch. */
export const CONTACT = {
  addressLines: ['Chennai', 'Tamil Nadu, India'],
  phone: env('VITE_CONTACT_PHONE', '+91 00000 00000'),
  phoneHref: 'tel:' + env('VITE_CONTACT_PHONE', '+910000000000').replace(/[^\d+]/g, ''),
  email: env('VITE_CONTACT_EMAIL', 'enquiries@madhusree.co.in'),
  hours: 'Monday to Saturday, Indian Standard Time',
};

export const CONFIG = {
  formEndpoint: env('VITE_FORM_ENDPOINT', ''),
  siteUrl: env('VITE_SITE_URL', ''),
};

/** Market *categories*, not a destination list. */
export const MARKET_CATEGORIES = [
  'Middle East',
  'Asia',
  'Europe',
  'North America',
  'Other international markets',
];

export const BUYERS = [
  ['Importers', 'Businesses seeking Indian spice supply.'],
  ['Wholesalers & distributors', 'Partners requiring bulk product for regional markets.'],
  ['Food manufacturers', 'Ingredient buyers working to an agreed specification.'],
  ['Spice processors', 'Buyers using whole spices for grinding, blending or processing.'],
  ['Retail & private label', 'Businesses developing packaged spice products.'],
  ['Foodservice', 'Commercial kitchens, hospitality and institutional buyers.'],
];

/**
 * The range. `forms` lists only what is genuinely offered; there are
 * deliberately no grades, percentages, colour values or heat units here.
 */
export const PRODUCTS = [
  {
    slug: 'turmeric', name: 'Turmeric', file: 'turmeric.html', primary: true,
    headline: ["India's golden spice."], latin: 'Curcuma longa', accent: '#f0a81e',
    lede: 'Our primary product focus. Indian turmeric selected with attention to colour, aroma, cleanliness, consistency and agreed buyer specifications.',
    forms: ['Whole turmeric fingers', 'Turmeric powder'],
    applications: ['Culinary products', 'Spice blends', 'Food processing'],
    considers: ['Colour and appearance', 'Aroma', 'Cleanliness', 'Moisture', 'Foreign matter', 'Size and form'],
  },
  {
    slug: 'cumin', name: 'Cumin Seeds', file: 'cumin.html',
    headline: ['Distinctive aroma.', 'Authentic flavour.'], latin: 'Cuminum cyminum', accent: '#a9773f',
    lede: 'Indian cumin seeds selected for characteristic aroma, flavour, appearance and overall condition according to agreed requirements.',
    forms: ['Whole cumin seeds'],
    applications: ['Seasonings', 'Spice blends', 'Food manufacturing', 'Culinary applications'],
    considers: ['Aroma', 'Flavour', 'Appearance', 'Overall condition'],
  },
  {
    slug: 'coriander', name: 'Coriander Seeds', file: 'coriander.html',
    headline: ['Aromatic.', 'Versatile. Essential.'], latin: 'Coriandrum sativum', accent: '#cbb47e',
    lede: 'Indian coriander seeds sourced for characteristic aroma, flavour and visual quality for food and spice applications.',
    forms: ['Whole coriander seeds'],
    applications: ['Spice processing', 'Blends', 'Food manufacturing', 'Culinary applications'],
    considers: ['Aroma', 'Flavour', 'Visual quality'],
  },
  {
    slug: 'chilli', name: 'Red Chilli', file: 'chilli.html',
    headline: ['Bold colour.', 'Distinctive heat.'], latin: 'Capsicum annuum', accent: '#c62c1c',
    lede: 'Selected Indian red chillies for buyers seeking the desired combination of colour, heat, flavour and product condition.',
    forms: ['Whole dried red chilli'],
    applications: ['Seasonings', 'Sauces', 'Spice blends', 'Food processing'],
    considers: ['Colour', 'Heat', 'Flavour', 'Product condition'],
  },
  {
    slug: 'pepper', name: 'Black Pepper', file: 'pepper.html',
    headline: ['Bold by nature.'], latin: 'Piper nigrum', accent: '#8a6f5e',
    lede: 'Indian black pepper selected for appearance, aroma, pungency and consistency according to the agreed requirement.',
    forms: ['Whole black pepper'],
    applications: ['Seasonings', 'Spice blends', 'Food manufacturing', 'Culinary applications'],
    considers: ['Appearance', 'Aroma', 'Pungency', 'Consistency'],
  },
];

/** The six-step export process (blueprint §2.8). */
export const PROCESS = [
  ['Discuss', 'Share product, quantity, destination and specifications.'],
  ['Source', 'Identify suitable supply based on the agreed requirement.'],
  ['Review', 'Confirm product characteristics, quantity and packaging.'],
  ['Prepare', 'Coordinate packing and shipment preparation.'],
  ['Document', 'Coordinate required trade and shipment documentation.'],
  ['Ship', 'Dispatch through the agreed logistics route and keep you informed.'],
];

export const WHY_US = [
  ['India-sourced products', 'A focused range of Indian spices.'],
  ['Quality-focused sourcing', 'Selection aligned with agreed requirements.'],
  ['Clear communication', 'Straightforward discussions on specifications, quantities, packaging and shipment expectations.'],
  ['Buyer-focused approach', 'Requirements reviewed case by case.'],
  ['Long-term relationships', 'Building repeat business through trust, consistency and service.'],
];
