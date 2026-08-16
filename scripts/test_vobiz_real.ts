import { env } from '../server/src/config/env';
import fetch from 'node-fetch'; // Or native fetch if Node 18+

const baseUrl = env.VOBIZ_API_URL || 'https://api.vobiz.ai';
const authId = env.VOBIZ_AUTH_ID;
const authToken = env.VOBIZ_AUTH_TOKEN;

async function testPath(path: string) {
  const url = `${baseUrl}${path}`;
  console.log(`\nTesting: ${url}`);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Auth-ID': authId,
        'X-Auth-Token': authToken
      }
    });
    
    console.log(`Status: ${res.status} ${res.statusText}`);
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      console.log(`Response:`, JSON.stringify(json, null, 2).substring(0, 500) + (text.length > 500 ? '...' : ''));
    } catch (e) {
      console.log(`Response Text:`, text.substring(0, 500));
    }
    return res.status;
  } catch (err: any) {
    console.error(`Error fetching ${url}:`, err.message);
    return 0;
  }
}

async function runTests() {
  if (!authId || !authToken) {
    console.error('Missing VOBIZ_AUTH_ID or VOBIZ_AUTH_TOKEN in .env');
    return;
  }
  
  console.log('Testing with real credentials...\n');
  
  // 1. The literal documented path
  await testPath(`/api/v1/Account/${authId}/inventory/numbers`);
  
  // 2. The suspected correct path based on Plivo migration guide
  await testPath('/api/v1/phone_numbers/inventory');
  await testPath(`/api/v1/Account/${authId}/phone_numbers/inventory`);
  
  // 3. Just the base phone_numbers path
  await testPath('/api/v1/phone_numbers');
  await testPath(`/api/v1/Account/${authId}/phone_numbers`);
}

runTests();
