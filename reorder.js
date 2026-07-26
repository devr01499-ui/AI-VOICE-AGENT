const fs = require('fs');

try {
  const content = fs.readFileSync('Frontend/src/app/pages/Home.tsx', 'utf8');

  const startToken = '      <ScrollProgress />\n';
  const endToken = '\n      {/* ── FINAL CTA ── */}';

  const startIndex = content.indexOf(startToken) + startToken.length;
  const endIndex = content.indexOf(endToken);

  if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find start or end tokens.');
    process.exit(1);
  }

  const body = content.substring(startIndex, endIndex);

  // Split the body into sections. We use a regex lookahead to split right before each section comment.
  const parts = body.split(/(?=\n      \{\/\* ── )/);

  let hero = '', metrics = '', about = '', grid = '', split = '', bento = '', usecases = '', showroom = '', comparison = '', compliance = '';

  parts.forEach(part => {
    if (part.includes('── HERO ──')) hero = part;
    else if (part.includes('── METRICS BAND ──')) metrics = part;
    else if (part.includes('── ABOUT / ARCHITECTURE ──')) about = part;
    else if (part.includes('── HOW IT WORKS')) grid = part;
    else if (part.includes('── INBOUND + OUTBOUND SPLIT ──')) split = part;
    else if (part.includes('── BENTO CAPABILITIES ──')) bento = part;
    else if (part.includes('── USE CASES ──')) usecases = part;
    else if (part.includes('── INDUSTRY SHOWROOM ──')) showroom = part;
    else if (part.includes('── COMPARISON ──')) comparison = part;
    else if (part.includes('── COMPLIANCE BADGE PANEL ──')) compliance = part;
    else console.warn('Unknown part:', part.substring(0, 50));
  });

  const newBody = [
    hero,
    metrics,
    grid,
    bento,
    showroom,
    split,
    usecases,
    about,
    comparison,
    compliance
  ].join('');

  const newContent = content.substring(0, startIndex) + newBody + content.substring(endIndex);
  fs.writeFileSync('Frontend/src/app/pages/Home.tsx', newContent);
  console.log('Successfully reordered Home.tsx');
} catch (e) {
  console.error(e);
}
