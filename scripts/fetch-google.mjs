// Récupère coordonnées + avis Google (Places API "New") au moment du build.
// Variables : GOOGLE_PLACES_API_KEY et GOOGLE_PLACE_ID (secrets GitHub Actions).
// Sans elles, écrit un fichier vide : le site s'affiche avec les données de business.json.
import { writeFileSync, mkdirSync } from 'node:fs';

const key = process.env.GOOGLE_PLACES_API_KEY;
const id = process.env.GOOGLE_PLACE_ID;
const out = new URL('../src/data/google.json', import.meta.url);
mkdirSync(new URL('../src/data/', import.meta.url), { recursive: true });

const empty = { fetched: false, rating: null, total: 0, reviews: [] };

if (!key || !id) {
  console.log('[google] clés absentes : avis non récupérés (mode démo).');
  writeFileSync(out, JSON.stringify(empty, null, 2));
  process.exit(0);
}

try {
  const fields = [
    'displayName', 'formattedAddress', 'nationalPhoneNumber', 'internationalPhoneNumber',
    'regularOpeningHours', 'googleMapsUri', 'rating', 'userRatingCount', 'reviews',
  ].join(',');
  const res = await fetch(`https://places.googleapis.com/v1/places/${id}?languageCode=fr`, {
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': fields },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
  const p = await res.json();
  const data = {
    fetched: true,
    fetchedAt: new Date().toISOString(),
    name: p.displayName?.text,
    address: p.formattedAddress,
    phone: p.nationalPhoneNumber,
    phoneIntl: p.internationalPhoneNumber,
    hours: p.regularOpeningHours?.weekdayDescriptions ?? [],
    mapsUrl: p.googleMapsUri,
    rating: p.rating ?? null,
    total: p.userRatingCount ?? 0,
    reviews: (p.reviews ?? []).map((r) => ({
      author: r.authorAttribution?.displayName,
      photo: r.authorAttribution?.photoUri,
      rating: r.rating,
      text: r.text?.text ?? r.originalText?.text ?? '',
      when: r.relativePublishTimeDescription,
    })),
  };
  writeFileSync(out, JSON.stringify(data, null, 2));
  console.log(`[google] OK : ${data.reviews.length} avis, note ${data.rating}`);
} catch (e) {
  console.warn('[google] échec, repli sur données vides :', e.message);
  writeFileSync(out, JSON.stringify(empty, null, 2));
}
