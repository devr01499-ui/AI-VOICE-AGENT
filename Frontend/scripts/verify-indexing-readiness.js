import https from 'https';

const coreUrls = [
  'https://www.claritiy.com/',
  'https://www.claritiy.com/pricing',
  'https://www.claritiy.com/how-it-works',
  'https://www.claritiy.com/use-cases',
  'https://www.claritiy.com/solutions',
  'https://www.claritiy.com/voices',
  'https://www.claritiy.com/docs',
  'https://www.claritiy.com/blog',
  'https://www.claritiy.com/blog/how-to-reduce-cod-rto',
  'https://www.claritiy.com/blog/healthcare-ai-calling',
  'https://www.claritiy.com/blog/fintech-collections-ai',
  'https://www.claritiy.com/privacy',
  'https://www.claritiy.com/terms',
  'https://www.claritiy.com/security',
  'https://www.claritiy.com/faq',
  'https://www.claritiy.com/contact',
  'https://www.claritiy.com/voice-ai-index',
  'https://www.claritiy.com/ai-voice-agent-software',
  // Sample programmatic URLs from GSC report
  'https://www.claritiy.com/voice-ai-index/agent-workflow-engine',
  'https://www.claritiy.com/voice-ai-index/agents-appointment-booking',
  'https://www.claritiy.com/voice-ai-index/agents-banking-finance',
  'https://www.claritiy.com/voice-ai-index/agents-collections',
  'https://www.claritiy.com/voice-ai-index/agents-ecommerce'
];

function checkUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const statusCode = res.statusCode;
        const hasCanonical = data.includes(`<link rel="canonical" href="${url}"`);
        const hasRobots = data.includes('name="robots"') && data.includes('index, follow');
        const hasTitle = /<title>[^<]+<\/title>/.test(data);
        const contentLength = data.length;
        resolve({
          url,
          statusCode,
          hasCanonical,
          hasRobots,
          hasTitle,
          contentLength,
          ok: statusCode === 200 && hasCanonical && hasRobots && hasTitle && contentLength > 1000
        });
      });
    }).on('error', (err) => {
      resolve({ url, error: err.message, ok: false });
    });
  });
}

async function run() {
  console.log(`Auditing ${coreUrls.length} key URLs on live https://www.claritiy.com for Google Indexing readiness...\n`);
  let passCount = 0;
  for (const url of coreUrls) {
    const res = await checkUrl(url);
    if (res.ok) {
      passCount++;
      console.log(`✅ [200 OK] Canonical & Meta OK (${res.contentLength} bytes) -> ${url}`);
    } else {
      console.error(`❌ FAILED: ${url}`, res);
    }
  }
  console.log(`\nAudit Complete: ${passCount}/${coreUrls.length} URLs passed all Google Indexing prerequisites!`);
}

run();
