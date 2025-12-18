import fs from 'fs';

const STORE_FILE = './data/metal-store.json';
const API_URL = 'https://api.metals.dev/v1/latest?authority=mcx&currency=INR&unit=g';
const API_KEY = process.env.METALS_API_KEY;

function loadStore() {
  return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
}

function saveStore(store) {
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function currentSlot() {
  const now = new Date();
  const hours = now.getUTCHours() * 60 + now.getUTCMinutes(); // UTC minutes

  // IST slots (UTC converted)
  if (hours >= (4 * 60 + 31) && hours < (11 * 60 + 31)) return '10_01';
  return '17_01';
}

async function fetchMetalRates() {
  const res = await fetch(API_URL, {
    headers: { Authorization: `Bearer ${API_KEY}` }
  });

  if (!res.ok) throw new Error('API failed');
  return await res.json();
}

async function run() {
  const store = loadStore();
  const today = todayDate();
  const slot = currentSlot();

  // New day rollover
  if (store.today.date !== today) {
    store.yesterday = store.today;
    store.today = {
      date: today,
      rates: { '10_01': null, '17_01': null }
    };
  }

  // 🚫 Already have data → DO NOTHING
  if (store.today.rates[slot]) {
    console.log(`⏭ Data already exists for ${slot}, skipping API`);
    return;
  }

  try {
    console.log(`🌐 Fetching API for slot ${slot}`);
    const data = await fetchMetalRates();
    store.today.rates[slot] = data;
  } catch (err) {
    console.log(`❌ API failed, applying fallback`);

    if (slot === '10_01') {
      store.today.rates['10_01'] =
        store.yesterday?.rates?.['17_01'] ?? null;
    } else {
      store.today.rates['17_01'] =
        store.today?.rates?.['10_01'] ?? null;
    }
  }

  saveStore(store);
}

run();
