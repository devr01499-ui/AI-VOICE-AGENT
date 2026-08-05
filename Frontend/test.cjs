const puppeteer = require('puppeteer');

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  page.on('dialog', async dialog => {
    console.log('BROWSER ALERT:', dialog.message());
    await dialog.accept();
  });

  try {
    console.log("Navigating to dashboard...");
    await page.goto('http://localhost:5173/dashboard');
    
    // Wait a bit for auth to redirect or load
    await new Promise(r => setTimeout(r, 2000));
    
    console.log("Current URL:", page.url());
    
    // If it redirected to login, try to sign in
    if (!page.url().includes('dashboard')) {
      console.log("Trying to bypass auth by going to home and triggering login");
      await page.goto('http://localhost:5173');
      await new Promise(r => setTimeout(r, 2000));
    }
    
    // We are simulating the button click. But actually we can just call the apiFetch directly in the browser context to see if it fails
    const result = await page.evaluate(async () => {
      try {
        const payload = {
          name: "Companion - Test",
          description: "B2C AI Companion Avatar",
          agentType: "conversational",
          voiceName: "Aoede",
          systemVoice: "Aoede",
          languageMode: "auto",
          temperature: 0.8,
          systemPrompt: "Test prompt"
        };
        
        // Grab token
        let token = null;
        const storageKey = Object.keys(localStorage).find(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
        if (storageKey) {
          const sessionData = localStorage.getItem(storageKey);
          if (sessionData) {
            token = JSON.parse(sessionData)?.access_token;
          }
        }
        if (!token) token = localStorage.getItem('sb-access-token');

        const res = await fetch('https://ai-voice-agent-backend-mv32.onrender.com/api/v2/agents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        
        const text = await res.text();
        return { status: res.status, text };
      } catch (e) {
        return { error: e.message };
      }
    });
    
    console.log("API CALL RESULT:", result);
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await browser.close();
  }
})();
