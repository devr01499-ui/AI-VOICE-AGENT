async function test() {
  const url1 = 'https://api.vobiz.ai/api/v1/Account/12345/inventory/numbers';
  const url2 = 'https://api.vobiz.ai/api/v1/account/12345/inventory/numbers';
  const url3 = 'https://api.vobiz.ai/api/v1/inventory/numbers';
  
  for (const url of [url1, url2, url3]) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      console.log(`URL: ${url} -> Status: ${res.status}, Body: ${text.substring(0, 100)}`);
    } catch (e) {
      console.log(`URL: ${url} -> Error: ${e.message}`);
    }
  }
}

test();
