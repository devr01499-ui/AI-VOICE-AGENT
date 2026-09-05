// Direct Vobiz inventory probe — run with node to see real API response
// Usage: node server/probe_vobiz.js

const VOBIZ_AUTH_ID = process.env.VOBIZ_AUTH_ID || 'MA_PLACEHOLDER';
const VOBIZ_AUTH_TOKEN = process.env.VOBIZ_AUTH_TOKEN || '';
const VOBIZ_API_URL = 'https://api.vobiz.ai';

async function probe() {
  const endpoint = `/api/v1/Account/${VOBIZ_AUTH_ID}/inventory/numbers?country=IN&number_type=local`;
  const url = `${VOBIZ_API_URL}${endpoint}`;

  console.log('\n=== Vobiz Inventory Probe ===');
  console.log('URL:', url);
  console.log('Auth-ID:', VOBIZ_AUTH_ID);
  console.log('');

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-ID': VOBIZ_AUTH_ID,
      'X-Auth-Token': VOBIZ_AUTH_TOKEN,
    },
  });

  const text = await res.text();
  console.log('HTTP Status:', res.status);
  console.log('Content-Type:', res.headers.get('content-type'));
  console.log('\nRaw Response Body:');
  console.log(text.slice(0, 2000)); // first 2000 chars

  let parsed;
  try { parsed = JSON.parse(text); } catch { console.log('\n(Not valid JSON)'); return; }
  console.log('\nParsed keys:', Object.keys(parsed));

  // Check all possible array fields
  for (const key of Object.keys(parsed)) {
    if (Array.isArray(parsed[key])) {
      console.log(`\nparsed.${key} is an array with ${parsed[key].length} items`);
      if (parsed[key].length > 0) {
        console.log('First item:', JSON.stringify(parsed[key][0], null, 2));
      }
    }
  }
}

probe().catch(e => { console.error('PROBE FAILED:', e.message); process.exit(1); });
