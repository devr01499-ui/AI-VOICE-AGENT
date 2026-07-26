const fs = require('fs');

try {
  const content = fs.readFileSync('Frontend/src/app/pages/Home.tsx', 'utf8');

  const tHero = '      {/* ── HERO ── */}';
  const tMetrics = '      {/* ── METRICS BAND ── */}';
  const tAbout = '      {/* ── ABOUT / ARCHITECTURE ── */}';
  const tHow = '      {/* ── HOW IT WORKS (Grid Steps) ── */}';
  const tSplit = '      {/* ── INBOUND + OUTBOUND SPLIT ── */}';
  const tBento = '      {/* ── BENTO CAPABILITIES ── */}';
  const tUseCases = '      {/* ── USE CASES ── */}';
  const tShowroom = '      {/* ── INDUSTRY SHOWROOM ── */}';
  const tComparison = '      {/* ── COMPARISON ── */}';
  const tCompliance = '      {/* ── COMPLIANCE BADGE PANEL ── */}';
  const tFinal = '      {/* ── FINAL CTA ── */}';

  function getBlock(start, end) {
    let s = content.indexOf(start);
    let e = content.indexOf(end);
    if (s === -1 || e === -1) {
      console.error("Failed to find", start, "or", end);
      process.exit(1);
    }
    return content.substring(s, e);
  }

  const bHero = getBlock(tHero, tMetrics);
  const bMetrics = getBlock(tMetrics, tAbout);
  const bAbout = getBlock(tAbout, tHow);
  const bHow = getBlock(tHow, tSplit);
  const bSplit = getBlock(tSplit, tBento);
  const bBento = getBlock(tBento, tUseCases);
  const bUseCases = getBlock(tUseCases, tShowroom);
  const bShowroom = getBlock(tShowroom, tComparison);
  const bComparison = getBlock(tComparison, tCompliance);
  const bCompliance = getBlock(tCompliance, tFinal);

  // New sequence
  const newBody = 
    bHero +
    bMetrics +
    bHow +
    bBento +
    bShowroom +
    bSplit +
    bUseCases +
    bAbout +
    bComparison +
    bCompliance;

  const before = content.substring(0, content.indexOf(tHero));
  const after = content.substring(content.indexOf(tFinal));

  const newContent = before + newBody + after;
  fs.writeFileSync('Frontend/src/app/pages/Home.tsx', newContent);
  console.log('Successfully reordered Home.tsx!');
} catch (e) {
  console.error(e);
}
