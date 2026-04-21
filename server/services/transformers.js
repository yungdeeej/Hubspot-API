const COUNTRY_MAP = {
  'canada': 'CA',
  'united states': 'US',
  'united states of america': 'US',
  'usa': 'US',
  'u.s.a.': 'US',
  'u.s.': 'US',
  'mexico': 'MX',
  'united kingdom': 'GB',
  'uk': 'GB',
  'great britain': 'GB',
  'india': 'IN',
  'china': 'CN',
  'australia': 'AU',
  'germany': 'DE',
  'france': 'FR',
  'japan': 'JP',
  'brazil': 'BR',
  'italy': 'IT',
  'spain': 'ES',
  'netherlands': 'NL',
  'ireland': 'IE',
  'south korea': 'KR',
  'korea': 'KR',
  'new zealand': 'NZ',
  'philippines': 'PH',
  'nigeria': 'NG',
  'pakistan': 'PK'
};

export function trim(v) {
  return String(v ?? '').trim();
}

export function lowercase(v) {
  return trim(v).toLowerCase();
}

export function uppercase(v) {
  return trim(v).toUpperCase();
}

export function date_iso(v) {
  if (!v) return '';
  const s = trim(v);
  if (!s) return '';
  // Accept epoch millis (HubSpot dates) or ISO / parseable strings
  const maybeNum = Number(s);
  const d = Number.isFinite(maybeNum) && /^\d+$/.test(s) ? new Date(maybeNum) : new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

export function phone_raw(v) {
  return String(v ?? '').replace(/\D/g, '');
}

export function country_iso2(v) {
  const s = trim(v);
  if (!s) return 'CA';
  if (s.length === 2) return s.toUpperCase();
  const mapped = COUNTRY_MAP[s.toLowerCase()];
  return mapped || 'CA';
}

export const TRANSFORMERS = {
  trim,
  lowercase,
  uppercase,
  date_iso,
  phone_raw,
  country_iso2
};

export function applyTransform(name, value) {
  if (!name) return trim(value);
  const fn = TRANSFORMERS[name];
  if (!fn) return trim(value);
  return fn(value);
}
