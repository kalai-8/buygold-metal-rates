import fs from 'fs';

const STORE_FILE = './data/metal-store.json';
const API_KEY = process.env.METALS_API_KEY;
const API_URL =
  'https://api.metals.dev/v1/latest?authority=mcx&currency=INR&unit=g';

const IST_TODAY = new Date().toLocaleDateString('en-CA', {
  timeZone: 'Asia/Kolkata'
});

// Decide slot automatically
function getSlot() {
  const now = new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit'
  });

  if (now >= '10:01' && now < '17:01') return '10_01';
  return '17_01';
}

function loadStore() {
  return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
}

function saveStore(store) {
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

async function fetchRates() {
   const url =
    'https://api.metals.dev/v1/metal/authority' +
    `?api_key=${API_KEY}` +
    '&authority=mcx' +
    '&currency=INR' +
    '&unit=g';

  const res = await fetch(url, { method: 'GET' });

  if (!res.ok) {
    throw new Error(`API failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  // 🔽 reduce payload (ONLY what Angular needs)
  return {
    gold: data?.rates?.mcx_gold ?? null,
    silver: data?.rates?.mcx_silver ?? null,
    updatedAt: new Date().toISOString()
  };

}

async function run() {
  console.log('🚀 Script started');

  const store = loadStore();
  const SLOT = getSlot();

  // rollover day (IST safe)
  if (store.today.date !== IST_TODAY) {
    store.yesterday = store.today;
    store.today = {
      date: IST_TODAY,
      rates: { '10_01': null, '17_01': null }
    };
  }

  // slot already filled → exit
  if (store.today.rates[SLOT]) {
    console.log(`⏭ Slot ${SLOT} already exists, skipping`);
    return;
  }

  try {
    console.log(`🌐 Calling API for slot ${SLOT}`);
    store.today.rates[SLOT] = await fetchRates();
    console.log(`✅ Updated ${SLOT}`);
  } catch (e) {
    console.log(`❌ API failed for ${SLOT}`);

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
