import fs from 'fs';

const STORE_FILE = './data/metal-store.json';
const API_URL =
  'https://api.metals.dev/v1/latest?authority=mcx&currency=INR&unit=g';

const RAW_SLOT = process.env.SLOT;   // TEST_13_20, 10_01, 17_01
const API_KEY = process.env.METALS_API_KEY;

/**
 * Map test slot to real slot
 */
const SLOT_MAP = {
  TEST_13_20: '10_01',
  TEST_17_20: '17_01'
};

const SLOT = SLOT_MAP[RAW_SLOT] || RAW_SLOT;

console.log('Running slot:', SLOT);

function loadStore() {
  return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
}

function saveStore(store) {
  console.log(STORE_FILE, SON.stringify(store, null, 2));
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

function rolloverIfNewDay(store) {
  const today = new Date().toISOString().slice(0, 10);

  if (store.today.date !== today) {
    store.yesterday = store.today;
    store.today = {
      date: today,
      rates: { '10_01': null, '17_01': null }
    };
  }
}

async function fetchMetalRates() {
  const res = await fetch(API_URL, {
    headers: { Authorization: `Bearer ${API_KEY}` }
  });

  if (!res.ok) {
    throw new Error(`API failed: ${res.status}`);
  }

  return res.json();
}

async function run() {
  const store = loadStore();
  rolloverIfNewDay(store);

  /** ✅ Only call API if slot is empty */
  if (store.today.rates[SLOT] !== null) {
    console.log(`⏭ Slot ${SLOT} already populated. Skipping API.`);
    return;
  }

  try {
    const data = await fetchMetalRates();
    store.today.rates[SLOT] = data;
    console.log(`✅ Rates stored for ${SLOT}`);
  } catch (err) {
    console.error(`❌ API failed for ${SLOT}`, err.message);

    if (SLOT === '10_01') {
      store.today.rates['10_01'] =
        store.yesterday?.rates?.['17_01'] || null;
    }

    if (SLOT === '17_01') {
      store.today.rates['17_01'] =
        store.today?.rates?.['10_01'] || null;
    }
  }

  saveStore(store);
}

run();
