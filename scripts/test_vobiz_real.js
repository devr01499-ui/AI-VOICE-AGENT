require('dotenv').config();
const https = require('https');

const baseUrl = process.env.VOBIZ_API_URL || 'https://api.vobiz.ai';
const authId = process.env.VOBIZ_AUTH_ID;
const authToken = process.env.VOBIZ_AUTH_TOKEN;

function fetchPath(path) {
  return new Promise((resolve) => {
    const url = `${baseUrl}${path}`;
    console.log(`\nTesting: ${url}`);
    
    const req = https.get(url, {
      headers: {
        'X-Auth-ID': authId,
        'X-Auth-Token': authToken
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode} ${res.statusMessage}`);
        try {
          const json = JSON.parse(data);
          console.log(`Response:`, JSON.stringify(json, null, 2).substring(0, 500));
        } catch (e) {
          console.log(`Response Text:`, data.substring(0, 500));
        }
        resolve(res.statusCode);
      });
    });

    req.on('error', e => {
      console.error(`Error fetching ${url}:`, e.message);
      resolve(0);
    });
    req.end();
  });
}

async function runTests() {
  if (!authId || !authToken) {
    console.error('Missing VOBIZ_AUTH_ID or VOBIZ_AUTH_TOKEN in .env');
    return;
  }
  
  console.log('Testing with real credentials...\n');
  
  await fetchPath(`/api/v1/Account/${authId}/inventory/numbers`);
  await fetchPath('/api/v1/phone_numbers/inventory');
  await fetchPath(`/api/v1/Account/${authId}/phone_numbers/inventory`);
  await fetchPath('/api/v1/phone_numbers');
  await fetchPath(`/api/v1/Account/${authId}/phone_numbers`);
}

runTests();
