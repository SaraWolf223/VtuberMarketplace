/**
 * Seed realistic test listings near a US ZIP, complete with real category-matched
 * photos pulled from the internet — for local feed/filter/moderation testing.
 * Safe to run against a disposable/dev Supabase project; not meant for production.
 *
 * Requires in .env:
 *   EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   MAPBOX_ACCESS_TOKEN (optional; falls back to fixed coords, or a cached
 *   zip_centroids row for the target ZIP)
 *
 * Usage:
 *   node scripts/seed-listings.mjs
 *   node scripts/seed-listings.mjs 10001 50
 *   node scripts/seed-listings.mjs 10001 50 --no-images   (skip photo downloads, faster)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const path = resolve(root, '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const zip = (args[0] ?? '10001').replace(/\D/g, '').slice(0, 5);
const count = Math.min(150, Math.max(1, Number(args[1] ?? 60) || 60));
const withImages = !process.argv.includes('--no-images');

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const IMAGE_BUCKET = 'listing-images';
const IMAGE_W = 800;
const IMAGE_H = 600;

/**
 * Curated, realistic item catalog per category slug (matches the default
 * `listing_categories` seed — see 039_categories_radius_2mb.sql). Any custom
 * category an admin has added/renamed falls back to a generic entry built
 * from its label, so this never hard-fails on a customized store.
 */
const CATALOG = {
  electronics: [
    { title: 'iPhone 12, 64GB, unlocked', price: 260, keyword: 'iphone', desc: 'Works great, minor scratches on the back. Comes with charging cable. Battery health 87%.' },
    { title: 'Samsung 24" monitor', price: 75, keyword: 'monitor', desc: 'Great for a home office setup. No dead pixels, includes HDMI cable.' },
    { title: 'Sony WH-1000XM4 headphones', price: 140, keyword: 'headphones', desc: 'Noise cancelling headphones, barely used, comes with the original case.' },
    { title: 'Bluetooth speaker, JBL Flip 5', price: 35, keyword: 'speaker', desc: 'Waterproof, great sound, minor wear on the fabric.' },
    { title: 'Dell laptop, i5, 8GB RAM', price: 220, keyword: 'laptop', desc: 'Good for schoolwork and browsing. Battery lasts about 4 hours. Charger included.' },
    { title: 'Apple Watch Series 6', price: 150, keyword: 'smartwatch', desc: '40mm, GPS only. Screen protector already on it. Comes with two extra bands.' },
  ],
  gaming: [
    { title: 'PS5 console, disc edition', price: 380, keyword: 'playstation', desc: 'Barely used, comes with one controller and all original cables.' },
    { title: 'Xbox controller, black', price: 30, keyword: 'controller', desc: 'Works perfectly, no stick drift. Smoke-free home.' },
    { title: 'Nintendo Switch + 3 games', price: 190, keyword: 'nintendo', desc: 'Includes Mario Kart, Zelda, and Smash Bros. Dock and cables included.' },
    { title: 'Gaming headset with mic', price: 25, keyword: 'gaming headset', desc: 'Great mic clarity, used for about 6 months, no issues.' },
    { title: 'Mechanical gaming keyboard', price: 45, keyword: 'mechanical keyboard', desc: 'RGB backlit, blue switches, very clicky and satisfying.' },
  ],
  furniture: [
    { title: 'Grey sectional sofa', price: 350, keyword: 'sofa', desc: 'Comfortable L-shaped sectional, some normal wear. Must pick up, does not fit through small doors easily.' },
    { title: 'IKEA desk, white', price: 55, keyword: 'desk', desc: 'Sturdy and simple, a few scuffs on one corner. Legs included.' },
    { title: 'Queen bed frame with headboard', price: 120, keyword: 'bed frame', desc: 'Solid wood frame, disassembles easily for transport. No mattress included.' },
    { title: '6-drawer dresser', price: 90, keyword: 'dresser', desc: 'Great storage, drawers slide smoothly. One handle is loose but easy fix.' },
    { title: 'Bookshelf, 5 tier', price: 40, keyword: 'bookshelf', desc: 'Holds a lot of books, lightweight and easy to move.' },
  ],
  womens_clothing: [
    { title: 'Women\u2019s denim jacket, size M', price: 20, keyword: 'denim jacket', desc: 'Classic fit, light wash, worn a handful of times.' },
    { title: 'Lululemon leggings, size 6', price: 25, keyword: 'leggings', desc: 'No rips or fading, from a smoke-free home.' },
    { title: 'Winter coat, size L', price: 35, keyword: 'winter coat', desc: 'Warm and puffy, great for cold commutes. Machine washable.' },
    { title: 'Bundle of summer dresses (3)', price: 30, keyword: 'summer dress', desc: 'Sizes S-M, mix of casual and going-out styles.' },
  ],
  mens_clothing: [
    { title: 'Men\u2019s leather jacket, size L', price: 60, keyword: 'leather jacket', desc: 'Genuine leather, broken in nicely, no tears.' },
    { title: 'Nike hoodie, size M', price: 18, keyword: 'hoodie', desc: 'Soft and warm, washed a few times, still holds shape.' },
    { title: 'Dress shirts bundle (4)', price: 25, keyword: 'dress shirt', desc: 'Mixed sizes M-L, good for interviews or the office.' },
    { title: 'Timberland boots, size 10', price: 45, keyword: 'boots', desc: 'Some wear on the soles but plenty of life left.' },
  ],
  home: [
    { title: 'Stand mixer, red', price: 85, keyword: 'stand mixer', desc: 'Works perfectly, comes with whisk and dough hook attachments.' },
    { title: 'Air fryer, 6qt', price: 40, keyword: 'air fryer', desc: 'Used a handful of times, basically like new.' },
    { title: 'Set of kitchen knives', price: 22, keyword: 'kitchen knives', desc: 'Sharp and well cared for, includes wooden block.' },
    { title: 'Vacuum cleaner, upright', price: 50, keyword: 'vacuum cleaner', desc: 'Strong suction, bag included, works great on carpet.' },
    { title: 'Table lamp, ceramic base', price: 15, keyword: 'table lamp', desc: 'Warm light, great for a bedside table.' },
  ],
  collectibles: [
    { title: 'Vintage vinyl records (10)', price: 45, keyword: 'vinyl records', desc: 'Mix of rock and jazz from the 70s-80s, good condition sleeves.' },
    { title: 'Baseball card collection', price: 60, keyword: 'baseball cards', desc: 'Mostly 90s cards, kept in sleeves and binders.' },
    { title: 'Funko Pop bundle (6)', price: 30, keyword: 'funko pop', desc: 'All in original boxes, minor shelf wear.' },
    { title: 'Antique pocket watch', price: 75, keyword: 'pocket watch', desc: 'Still keeps time, beautiful engraved case.' },
  ],
  toys: [
    { title: 'LEGO city set, complete', price: 35, keyword: 'lego', desc: 'All pieces accounted for, instructions included.' },
    { title: 'Board games bundle (5)', price: 25, keyword: 'board games', desc: 'Includes Catan, Monopoly, and 3 others. All pieces present.' },
    { title: 'Stuffed animal collection', price: 15, keyword: 'stuffed animals', desc: 'Clean, from a smoke-free pet-free home.' },
    { title: 'RC car, works great', price: 28, keyword: 'rc car', desc: 'Fast and fun, includes charger. Minor scuffs.' },
  ],
  automotive: [
    { title: 'All-season tires, set of 4', price: 180, keyword: 'car tires', desc: 'About 60% tread left, no patches or plugs.' },
    { title: 'Car roof rack, universal', price: 65, keyword: 'roof rack', desc: 'Fits most sedans and SUVs, easy install.' },
    { title: 'Dash cam, 1080p', price: 30, keyword: 'dash cam', desc: 'Works great, includes SD card and mount.' },
    { title: 'Car seat covers, set', price: 20, keyword: 'car seat cover', desc: 'Universal fit, water resistant, easy to install.' },
  ],
  sports_outdoors: [
    { title: 'Mountain bike helmet', price: 20, keyword: 'bike helmet', desc: 'Adjustable fit, no cracks, barely used.' },
    { title: 'Camping tent, 4-person', price: 55, keyword: 'camping tent', desc: 'Waterproof, easy setup, used twice.' },
    { title: 'Yoga mat + blocks set', price: 15, keyword: 'yoga mat', desc: 'Non-slip, lightly used, great grip.' },
    { title: 'Fishing rod and reel combo', price: 35, keyword: 'fishing rod', desc: 'Smooth reel action, good for lakes and rivers.' },
    { title: 'Kayak, single person', price: 220, keyword: 'kayak', desc: 'Stable and lightweight, minor scuffs on the hull.' },
  ],
  college_school: [
    { title: 'Graphing calculator, TI-84', price: 45, keyword: 'graphing calculator', desc: 'Works perfectly, great for math and science classes.' },
    { title: 'Dorm mini fridge', price: 40, keyword: 'mini fridge', desc: 'Quiet and compact, great for a dorm room.' },
    { title: 'Backpack, laptop compartment', price: 18, keyword: 'backpack', desc: 'Fits a 15" laptop, lots of pockets, durable straps.' },
    { title: 'Desk lamp with USB port', price: 12, keyword: 'desk lamp', desc: 'Adjustable brightness, great for late-night studying.' },
  ],
  books: [
    { title: 'Textbook bundle, intro science', price: 25, keyword: 'textbooks', desc: 'Covers biology and chemistry basics, some highlighting inside.' },
    { title: 'Fiction novels bundle (8)', price: 15, keyword: 'novels', desc: 'Mix of mystery and fantasy, good condition.' },
    { title: 'Cookbook collection (3)', price: 12, keyword: 'cookbooks', desc: 'Great recipes, pages are clean and unmarked.' },
  ],
  bikes: [
    { title: 'Trek mountain bike, 21-speed', price: 220, keyword: 'mountain bike', desc: 'Well maintained, new tires last season, smooth gear shifting.' },
    { title: 'Kids bike, 20 inch wheels', price: 60, keyword: 'kids bike', desc: 'Great starter bike, training wheels included.' },
    { title: 'Electric bike, 40 mile range', price: 450, keyword: 'electric bike', desc: 'Barely used, charger and lock included.' },
    { title: 'Road bike, aluminum frame', price: 180, keyword: 'road bike', desc: 'Lightweight and fast, recently tuned up.' },
  ],
  decorations: [
    { title: 'String lights, 30ft', price: 12, keyword: 'string lights', desc: 'Warm white, great for a patio or bedroom.' },
    { title: 'Wall art set, canvas prints (3)', price: 20, keyword: 'wall art', desc: 'Modern abstract style, ready to hang.' },
    { title: 'Area rug, 5x7', price: 45, keyword: 'area rug', desc: 'Soft and clean, neutral color goes with anything.' },
    { title: 'Decorative mirror, round', price: 25, keyword: 'wall mirror', desc: 'Gold frame, adds great light to any room.' },
  ],
  food_beverage: [
    { title: 'Unopened coffee beans, 2lb bag', price: 10, keyword: 'coffee beans', desc: 'Bought too much, still sealed, medium roast.' },
    { title: 'Home-canned jam, assorted (4 jars)', price: 12, keyword: 'jam jars', desc: 'Made this season, strawberry and blueberry.' },
    { title: 'Unopened protein powder tub', price: 20, keyword: 'protein powder', desc: 'Vanilla flavor, sealed, bought the wrong kind.' },
  ],
  carpool: [
    { title: 'Daily carpool, downtown commute', price: 5, keyword: 'carpool commute', desc: 'Looking to split gas for a regular weekday commute downtown.' },
    { title: 'Ride share to campus, weekdays', price: 5, keyword: 'car interior', desc: 'Splitting gas for the drive to campus, flexible timing.' },
  ],
  hobby: [
    { title: 'Acrylic paint set + canvases', price: 22, keyword: 'acrylic paint', desc: 'Barely used, great starter set for painting.' },
    { title: 'Knitting supplies bundle', price: 18, keyword: 'knitting yarn', desc: 'Yarn, needles, and patterns, great for beginners.' },
    { title: 'Model train set, starter kit', price: 55, keyword: 'model train', desc: 'Track, engine, and cars included, works great.' },
    { title: 'Guitar, acoustic, with case', price: 90, keyword: 'acoustic guitar', desc: 'Great tone, comes with a gig bag and extra strings.' },
  ],
  delivery: [
    { title: 'Local delivery help, same day', price: 15, keyword: 'delivery van', desc: 'Have a truck, happy to help move or deliver items locally.' },
  ],
  miscellaneous: [
    { title: 'Moving boxes, bundle of 15', price: 15, keyword: 'moving boxes', desc: 'Various sizes, used once, still sturdy.' },
    { title: 'Tool box with basic tools', price: 35, keyword: 'tool box', desc: 'Hammer, screwdrivers, wrench set included.' },
    { title: 'Storage bins, set of 6', price: 20, keyword: 'storage bins', desc: 'Stackable, clear plastic, great for a closet.' },
    { title: 'Plant pots, ceramic (5)', price: 15, keyword: 'plant pots', desc: 'Assorted sizes, no chips or cracks.' },
  ],
};

function genericCatalogEntry(label) {
  return [{ title: `${label} item`, price: 20, keyword: label, desc: `Gently used ${label.toLowerCase()} item, good condition.` }];
}

const FIRST_NAMES = ['Sarah', 'Mike', 'Priya', 'Jordan', 'Alex', 'Emily', 'Carlos', 'Nina', 'Derek', 'Maya', 'Tom', 'Aisha'];
const LAST_INITIALS = ['M.', 'R.', 'P.', 'L.', 'T.', 'D.', 'S.', 'K.', 'W.', 'B.'];

/** NYC (10001) area fallback */
const FALLBACK = { lat: 40.7506, lng: -73.9972 };

async function resolveCenter(targetZip) {
  const { data: cached } = await supabase
    .from('zip_centroids')
    .select('lat, lng')
    .eq('zip_code', targetZip)
    .maybeSingle();
  if (cached) return { lat: cached.lat, lng: cached.lng };

  const token = process.env.MAPBOX_ACCESS_TOKEN ?? process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    console.warn(`No cached centroid and no Mapbox token for ${targetZip} — using NYC fallback coordinates.`);
    return FALLBACK;
  }
  const q = encodeURIComponent(targetZip);
  const res = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?country=US&types=postcode&limit=1&access_token=${token}`
  );
  if (!res.ok) throw new Error(`Mapbox geocode failed: ${res.status}`);
  const json = await res.json();
  const center = json.features?.[0]?.center;
  if (!center || center.length < 2) {
    console.warn('ZIP not found in Mapbox — using fallback');
    return FALLBACK;
  }
  const lng = center[0];
  const lat = center[1];
  await supabase.from('zip_centroids').upsert({ zip_code: targetZip, lat, lng, updated_at: new Date().toISOString() });
  return { lat, lng };
}

function randomOffsetMiles(maxMiles, centerLat) {
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * maxMiles;
  const latMiles = 69;
  const lngMiles = 69 * Math.cos((centerLat * Math.PI) / 180);
  return {
    dLat: (dist * Math.cos(angle)) / latMiles,
    dLng: (dist * Math.sin(angle)) / lngMiles,
  };
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function jitterPrice(base) {
  const factor = 0.85 + Math.random() * 0.3; // +/- 15%
  return Math.max(1, Math.round(base * factor));
}

async function fetchCategoryPhoto(keyword, attempt = 0) {
  const url = `https://loremflickr.com/${IMAGE_W}/${IMAGE_H}/${encodeURIComponent(keyword.replace(/\s+/g, ','))}?lock=${Math.floor(Math.random() * 100000)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length < 100 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) {
      throw new Error('Not a valid JPEG');
    }
    if (buf.length > 2 * 1024 * 1024) throw new Error('Image too large');
    return buf;
  } catch (e) {
    if (attempt < 2) return fetchCategoryPhoto(keyword, attempt + 1);
    console.warn(`  (photo fetch failed for "${keyword}": ${e.message} — listing will have no image)`);
    return null;
  }
}

async function ensureSeedSellers(n) {
  const sellers = [];
  for (let i = 0; i < n; i += 1) {
    const suffix = `${Date.now()}_${i}`;
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastInitial = LAST_INITIALS[i % LAST_INITIALS.length];
    const fullName = `${firstName} ${lastInitial}`;
    const email = `seed.${suffix}@localmarketplace.test`;
    const password = `Seed!${suffix}Aa1`;

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createErr) throw new Error(`createUser failed: ${createErr.message}`);
    const id = created.user.id;

    // Real onboarding path: signs in, then calls the same RPC the app uses,
    // so the profile row (username/display_name/etc.) is created exactly
    // the way it would be for a genuine new user. Uses a throwaway client
    // (never the shared service-role `supabase` client) — signing in on a
    // client mutates its in-memory session, which would otherwise silently
    // downgrade every later "admin" storage/DB call from service_role to
    // this seller's own JWT and trip RLS.
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? serviceKey;
    const signInClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: signIn, error: signInErr } = await signInClient.auth.signInWithPassword({ email, password });
    if (signInErr || !signIn.session) throw new Error(`sign-in failed for seed seller: ${signInErr?.message}`);

    const userClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
    });
    const center = await resolveCenter(zip);
    const { error: locErr } = await userClient.rpc('upsert_user_prefs_location', {
      p_home_zip: zip,
      p_lng: center.lng,
      p_lat: center.lat,
      p_radius_miles: 10,
      p_state: null,
      p_city: null,
    });
    if (locErr) throw new Error(`onboarding RPC failed: ${locErr.message}`);

    await supabase.from('profiles').update({ phone_verified_at: new Date().toISOString() }).eq('id', id);

    sellers.push({ id, name: fullName });
  }
  return sellers;
}

async function uploadListingImage(sellerId, listingId, sortOrder, bytes) {
  const path = `${sellerId}/${listingId}/${sortOrder}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) throw new Error(`storage upload failed: ${uploadError.message}`);

  const { error: rowError } = await supabase.from('listing_images').insert({
    listing_id: listingId,
    storage_path: path,
    thumb_path: path,
    sort_order: sortOrder,
    byte_size: bytes.length,
    width: IMAGE_W,
    height: IMAGE_H,
  });
  if (rowError) throw new Error(`listing_images insert failed: ${rowError.message}`);
}

async function insertActiveListing(seller, item, center) {
  const { dLat, dLng } = randomOffsetMiles(8, center.lat);
  const lat = center.lat + dLat;
  const lng = center.lng + dLng;

  const { data: listingId, error: rpcErr } = await supabase.rpc('insert_draft_listing', {
    p_seller_id: seller.id,
    p_title: item.title.slice(0, 80),
    p_description: item.desc,
    p_price: jitterPrice(item.price),
    p_category: item.categorySlug,
    p_zip_code: zip,
    p_lng: lng,
    p_lat: lat,
  });
  if (rpcErr) throw new Error(`insert_draft_listing: ${rpcErr.message}`);

  let imageCount = 0;
  if (withImages) {
    const photoCount = Math.random() < 0.25 ? 2 : 1;
    for (let i = 0; i < photoCount; i += 1) {
      const bytes = await fetchCategoryPhoto(item.keyword);
      if (!bytes) break;
      await uploadListingImage(seller.id, listingId, i, bytes);
      imageCount += 1;
    }
  }

  const publishedAt = new Date(Date.now() - Math.floor(Math.random() * 10 * 24 * 60 * 60 * 1000));
  const expiresAt = new Date(publishedAt.getTime() + 21 * 24 * 60 * 60 * 1000);
  const purgeAt = new Date(publishedAt.getTime() + 28 * 24 * 60 * 60 * 1000);

  const { error: updErr } = await supabase
    .from('listings')
    .update({
      status: 'active',
      image_count: imageCount,
      published_at: publishedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      purge_at: purgeAt.toISOString(),
    })
    .eq('id', listingId);
  if (updErr) throw new Error(`activate listing: ${updErr.message}`);
  return listingId;
}

async function loadCategories() {
  const { data, error } = await supabase
    .from('listing_categories')
    .select('slug, label')
    .eq('is_active', true);
  if (error || !data?.length) {
    console.warn('Could not load listing_categories — falling back to a built-in default set.');
    return Object.keys(CATALOG).map((slug) => ({ slug, label: slug }));
  }
  return data;
}

async function main() {
  console.log(`Seeding ${count} realistic active listings near ZIP ${zip} (images: ${withImages ? 'on' : 'off'})...`);

  const center = await resolveCenter(zip);
  console.log(`Center: ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`);

  const categories = await loadCategories();
  console.log(`Using ${categories.length} categories from the store's current config.`);

  const sellerCount = Math.min(8, Math.max(3, Math.ceil(count / 8)));
  const sellers = await ensureSeedSellers(sellerCount);
  console.log(`Created ${sellers.length} seed seller account(s): ${sellers.map((s) => s.name).join(', ')}`);

  let created = 0;
  for (let i = 0; i < count; i += 1) {
    const category = categories[i % categories.length];
    const items = CATALOG[category.slug] ?? genericCatalogEntry(category.label);
    const item = { ...pick(items), categorySlug: category.slug };
    const seller = sellers[i % sellers.length];

    try {
      await insertActiveListing(seller, item, center);
      created += 1;
    } catch (e) {
      console.warn(`  listing #${i + 1} (${item.title}) failed: ${e.message}`);
    }
    if (created % 10 === 0 && created > 0) console.log(`  ...${created}/${count}`);
  }

  console.log(`Done. Inserted ${created} active listings in ZIP ${zip}.`);
  console.log(`In the app: set home ZIP to ${zip} and radius 10 mi to see them.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
