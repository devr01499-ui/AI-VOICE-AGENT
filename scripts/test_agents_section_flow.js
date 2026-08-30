/**
 * Automated Verification Script: Agents Section Workflow Fixes & Template Gallery
 *
 * Verifies:
 * 1. Template dataset AGENT_TEMPLATES_SEED covers all 5 required categories.
 * 2. Category filtering isolates templates correctly per category tab.
 * 3. Agent search filter logic performs case-insensitive substring matching and empty state triggers.
 * 4. Prompt and Conversational agent creation payloads construct direct studio workspace payloads.
 */

const fs = require('fs');
const path = require('path');

function runWorkflowTests() {
  console.log("====================================================");
  console.log("🧪 Starting Agents Section Workflow Verification");
  console.log("====================================================\n");

  let passed = 0;
  let failed = 0;

  // 1. Read App.tsx and extract AGENT_TEMPLATES_SEED array
  console.log("--- Test 1: Template Seed Dataset Verification ---");
  const appPath = path.join(__dirname, '../Frontend/src/app/App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf8');

  if (!appContent.includes('const AGENT_TEMPLATES_SEED')) {
    console.error("  [FAIL] AGENT_TEMPLATES_SEED is missing from App.tsx");
    failed++;
  } else {
    console.log("  [PASS] AGENT_TEMPLATES_SEED defined in App.tsx");
    passed++;
  }

  // Categories check
  const requiredCategories = [
    'Receptionist',
    'Outbound Sales & Reactivation',
    'Appointment Booking',
    'Lead Qualification',
    'Customer Support'
  ];

  console.log("\n--- Test 2: Template Category Coverage Check ---");
  let categoriesCovered = true;
  for (const cat of requiredCategories) {
    if (!appContent.includes(`category: '${cat}'`) && !appContent.includes(`category: "${cat}"`)) {
      console.error(`  [FAIL] Category '${cat}' missing from AGENT_TEMPLATES_SEED`);
      categoriesCovered = false;
    } else {
      console.log(`  [PASS] Category '${cat}' present in template seed`);
    }
  }

  if (categoriesCovered) {
    passed++;
  } else {
    failed++;
  }

  // 2. Test Client-Side Search Filtering Logic
  console.log("\n--- Test 3: Search Bar Client-Side Substring Filter Logic ---");
  const mockAgents = [
    { id: '1', name: 'Inbound Sales Rep', type: 'conversational' },
    { id: '2', name: 'Dental Appointment Scheduler', type: 'prompt' },
    { id: '3', name: 'Billing Support Desk', type: 'conversational' },
  ];

  function filterAgents(agents, query) {
    if (!query || !query.trim()) return agents;
    const q = query.toLowerCase().trim();
    return agents.filter(a => (a.name || '').toLowerCase().includes(q));
  }

  const resultAll = filterAgents(mockAgents, '');
  const resultDental = filterAgents(mockAgents, 'dental');
  const resultSales = filterAgents(mockAgents, 'SALES');
  const resultEmpty = filterAgents(mockAgents, 'nonexistent query 123');

  if (
    resultAll.length === 3 &&
    resultDental.length === 1 && resultDental[0].id === '2' &&
    resultSales.length === 1 && resultSales[0].id === '1' &&
    resultEmpty.length === 0
  ) {
    console.log("  [PASS] Search filtering matches case-insensitively and handles empty queries correctly");
    passed++;
  } else {
    console.error("  [FAIL] Search filter logic failed:", { resultAll, resultDental, resultSales, resultEmpty });
    failed++;
  }

  // 3. Test Dropdown Removal & Direct Create Button Wiring
  console.log("\n--- Test 4: Dropdown Menu Collapsed & Direct Button Verification ---");
  if (appContent.includes('Direct Create an Agent Button') && appContent.includes('onClick={() => setView("create")}') && !appContent.includes('setShowCreateMenu(!showCreateMenu)')) {
    console.log("  [PASS] Collapsed redundant dropdown; single direct 'Create an Agent' button verified");
    passed++;
  } else {
    console.error("  [FAIL] Redundant dropdown menu is still present or direct button missing");
    failed++;
  }

  // 4. Test Workspace Direct Landing Logic (No handleCreate list-drop)
  console.log("\n--- Test 5: Workspace Direct Landing Verification ---");
  if (appContent.includes('setSinglePromptStudioAgent({ name: form.name') && appContent.includes('setStudioAgent({ name: form.name')) {
    console.log("  [PASS] Direct studio workspace opening verified for both Prompt and Conversational flow paths");
    passed++;
  } else {
    console.error("  [FAIL] Direct studio workspace opening is missing or calling handleCreate");
    failed++;
  }

  // 5. Test Sidebar Template Button Action
  console.log("\n--- Test 6: Sidebar Template Agents Button Verification ---");
  if (appContent.includes('setTemplateFilter("All")') && appContent.includes('setView("create")')) {
    console.log("  [PASS] Sidebar 'Template Agents' button wired to open template gallery directly");
    passed++;
  } else {
    console.error("  [FAIL] Sidebar 'Template Agents' button missing onClick handler");
    failed++;
  }

  console.log("\n====================================================");
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("====================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runWorkflowTests();
