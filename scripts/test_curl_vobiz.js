import '../server/scripts/lib/testDbGuard.cjs'; // MUST stay first: blocks any non-test database
import https from 'https';

const url = 'https://api.vobiz.ai/api/v1/Account/dummy_auth_id/inventory/numbers?page=1&per_page=25';

const req = https.get(url, {
  headers: {
    'X-Auth-ID': 'dummy_auth_id',
    'X-Auth-Token': 'dummy_token'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Body: ${data}`);
  });
});

req.on('error', e => console.error(e));
req.end();
