const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\Rohit Kumar Sha\\.gemini\\antigravity-ide\\brain\\84e9950b-bb7f-4621-84b5-5cf36acbe033\\.system_generated\\steps\\435\\content.md', 'utf8');
const matches = content.match(/href="([^"]+)"/g) || [];
const links = matches.map(m => m.replace(/href="|"/g, ''));
console.log(links.filter(link => link.startsWith('/docs')).join('\n'));
