const fs = require('fs');
let text = fs.readFileSync('Frontend/src/app/App.tsx', 'utf8');

text = text.replace(/'Figtree',sans-serif/g, "'Outfit', sans-serif");
text = text.replace(/'DM Mono',monospace/g, "'Outfit', sans-serif");

fs.writeFileSync('Frontend/src/app/App.tsx', text, 'utf8');
console.log('App.tsx fonts patched successfully');
