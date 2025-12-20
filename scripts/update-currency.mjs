import fs from 'fs';

const STORE_FILE = './data/currency-store.json';
const API_URL = 'https://api.metals.dev/v1/latest';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

const API_KEY = process.env.CUR_API_KEY;

/** YYYY-MM-DD in IST */
function todayIST(): string {
  const now = new Date();
  now.setHours(now.getHours() + 5, now.getMinutes() + 30);
  return now.toISOString().split('T')[0];
}

async function fetchApi() {
  const res = await fetch(
    `${API_URL}?api_key=${API_KEY}&currency=INR&unit=g`
  );
  if (!res.ok) throw new Error('API failed');
  return res.json();
}

type Store = {
  today: { date: string | null; data: any | null };
  yesterday: { date: string | null; data: any | null };
};

async function run() {
  const todayDate = todayIST();

  let store: Store = {
    today: { date: null, data: null },
    yesterday: { date: null, data: null }
  };

  if (fs.existsSync(STORE_FILE)) {
    store = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  }

  // ✅ Already updated today
  if (store.today.date === todayDate && store.today.data) {
    console.log('Already updated for today. Skipping API call.');
    return;
  }

  try {
    const apiData = await fetchApi();

    if (!apiData?.metals || !apiData?.currencies) {
      console.log('API returned invalid data. Keeping old values.');
      return;
    }

    // 🔁 Move today → yesterday (only if today exists)
    if (store.today.date && store.today.data) {
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

    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
    console.log('Updated today & yesterday successfully');

  } catch (err) {
    console.error('API error. Using existing data.', err);
  }
}

run();

