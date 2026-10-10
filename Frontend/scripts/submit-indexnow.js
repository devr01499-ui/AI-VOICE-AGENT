import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sitemapPath = path.resolve(__dirname, '../public/sitemap.xml');
const sitemapContent = fs.readFileSync(sitemapPath, 'utf-8');

const matches = [...sitemapContent.matchAll(/<loc>([^<]+)<\/loc>/g)];
const urls = matches.map(m => m[1]);

console.log(`Found ${urls.length} URLs in sitemap to submit to IndexNow protocol...`);

const payload = JSON.stringify({
  host: "www.claritiy.com",
  key: "7c839cea80714776a484813612fc91ae",
  keyLocation: "https://www.claritiy.com/7c839cea80714776a484813612fc91ae.txt",
  urlList: urls
});

const options = {
  hostname: 'api.indexnow.org',
  port: 443,
  path: '/indexnow',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = https.request(options, (res) => {
  console.log(`IndexNow Response Status: ${res.statusCode} ${res.statusMessage}`);
  let responseData = '';
  res.on('data', chunk => responseData += chunk);
  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 202) {
      console.log(`🎉 Successfully submitted ${urls.length} URLs for instant push-indexing!`);
    } else {
      console.log(`Response body: ${responseData}`);
    }
  });
});

req.on('error', (e) => {
  console.error(`IndexNow submission error: ${e.message}`);
});

req.write(payload);
req.end();
