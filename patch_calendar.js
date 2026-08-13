const fs = require('fs');
const path = 'Frontend/src/app/components/calendar/CalendarOverview.tsx';
let text = fs.readFileSync(path, 'utf8');

text = text.replace(/'Figtree',sans-serif/g, "'Outfit', sans-serif");
text = text.replace(/'DM Mono',monospace/g, "'Outfit', sans-serif");

fs.writeFileSync(path, text, 'utf8');
console.log('CalendarOverview.tsx fonts patched successfully');
