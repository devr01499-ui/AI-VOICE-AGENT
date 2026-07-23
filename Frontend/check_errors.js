import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('response', response => console.log('RESPONSE:', response.status(), response.url()));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.failure().errorText, request.url()));
  
  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    console.log('Page loaded');
    const rootHtml = await page.evaluate(() => document.getElementById('root').innerHTML);
    console.log('Root HTML length:', rootHtml.length);
  } catch (err) {
    console.error('Error navigating:', err);
  }
  
  await browser.close();
})();
