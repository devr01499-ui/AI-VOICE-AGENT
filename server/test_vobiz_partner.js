async function test() {
  const url = 'https://api.vobiz.ai/partner/accounts';
  
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log(`URL: ${url} -> Status: ${res.status}, Body: ${text.substring(0, 100)}`);
  } catch (e) {
    console.log(`URL: ${url} -> Error: ${e.message}`);
  }
}

test();
