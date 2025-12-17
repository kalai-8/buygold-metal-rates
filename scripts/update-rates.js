import fs from 'fs';
import fetch from 'node-fetch';

const STORE_FILE = './data/metal-store.json';
const API_URL = 'https://api.metals.dev/v1/latest?&authority=mcx&currency=INR&unit=g';

const SLOT = process.env.SLOT; // "10_30" or "17_00"
const API_KEY = process.env.METALS_API_KEY;

function loadStore() {
  return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
}

function saveStore(store) {
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

function rolloverIfNewDay(store) {
  const today = new Date().toISOString().slice(0, 10);
  if (store.today.date !== today) {
    store.yesterday = store.today;
    store.today = {
      date: today,
      rates: { "10_30": null, "17_00": null }
    };
  }
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
  rolloverIfNewDay(store);

  try {
    const data = await fetchMetalRates();
    store.today.rates[SLOT] = data;
    console.log(`✅ Updated ${SLOT}`);
  } catch {
    console.log(`❌ API failed at ${SLOT}`);

    if (SLOT === '10_30') {
      store.today.rates['10_30'] =
        store.yesterday?.rates?.['17_00'] || null;
    }

    if (SLOT === '17_00') {
      store.today.rates['17_00'] =
        store.today?.rates?.['10_30'] || null;
    }
  }

  saveStore(store);
}

run();
