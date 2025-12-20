import fs from 'fs';

const STORE_FILE = './data/currency-store.json';
const API_URL = 'https://api.metals.dev/v1/latest';
const API_KEY = getActiveApiKey();
/* ---------- helpers ---------- */

function todayIST() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 330); // +5:30 IST
  return now.toISOString().split('T')[0];
}

async function fetchApi() {

  const url =
    'https://api.metals.dev/v1/latest/' +
    `?api_key=${API_KEY}` +
    '&currency=INR' +
    '&unit=g';
  
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`API failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data;
}

function getActiveApiKey() {
  const today = new Date().getDate(); // 1–31

  if (today <= 15) {
    return process.env.CUR_API_KEY;
  }

  return process.env.METALS_API_KEY;
}
/* ---------- main ---------- */
function loadStore() {
  return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
}
function saveStore(store) {
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}
async function run() {
  const todayDate = todayIST();

  let store = loadStore();

  if (fs.existsSync(STORE_FILE)) {
    store = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  }

  // ✅ Already updated today → skip API
  if (store.today?.date === todayDate && store.today?.data) {
    console.log('✔ Already updated for today. Skipping API call.');
    return;
  }

  try {
    const apiData = await fetchApi();
    console.log('apiData', apiData);
    console.log('!apiData?.metals', !apiData?.metals);
    console.log('!apiData?.currencies', !apiData?.currencies);
    if (!apiData?.metals || !apiData?.currencies) {
      console.log('⚠ API returned invalid data. Keeping existing values.');
      return;
    }

    // 🔁 Move today → yesterday (only if today exists)
    if (store.today?.date && store.today?.data) {
      store.yesterday = { ...store.today };
    }

    // ✅ Save new today
    store.today = {
      date: todayDate,
      data: {
        metals: apiData.metals,
        currencies: apiData.currencies,
        timestamps: apiData.timestamps
      }
    };

    saveStore(store);
    console.log('✅ Updated today & yesterday successfully');
  } catch (err) {
    console.error('❌ API error. Using existing data.', err);
  }
}

run();
