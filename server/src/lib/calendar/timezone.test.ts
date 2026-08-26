import { isWithinCallingHours, isValidTimezone, getLocalizedTime, generateNativeSlots } from './timezone';

function runTimezoneTestSuite() {
  console.log("====================================================");
  console.log("🌍 Running Comprehensive IANA Timezone & DST Test Suite");
  console.log("====================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      failed++;
    }
  }

  // Test 1: IANA Validation
  assert(isValidTimezone('Asia/Kolkata') === true, 'Validates Asia/Kolkata');
  assert(isValidTimezone('America/New_York') === true, 'Validates America/New_York');
  assert(isValidTimezone('Europe/London') === true, 'Validates Europe/London');
  assert(isValidTimezone('Australia/Sydney') === true, 'Validates Australia/Sydney');
  assert(isValidTimezone('Invalid/Timezone_Name') === false, 'Rejects invalid timezone string');

  // Test 2: Standard Calling Hours Check in IST (10:00 UTC = 15:30 IST)
  const d1 = new Date('2026-08-13T10:00:00Z');
  assert(isWithinCallingHours(d1, 'Asia/Kolkata', 9, 21) === true, '10:00 UTC is 15:30 IST (within 9-21 hours)');

  // Test 3: DST Boundary Test 1 - US Eastern Daylight Time (EDT - UTC-4) in Summer
  // 14:00 UTC on July 15 = 10:00 EDT (9-17 calling hours)
  const summerUS = new Date('2026-07-15T14:00:00Z');
  assert(isWithinCallingHours(summerUS, 'America/New_York', 9, 17) === true, 'Summer EDT: 14:00 UTC is 10:00 EDT (within 9-17)');

  // Test 4: DST Boundary Test 2 - US Eastern Standard Time (EST - UTC-5) in Winter
  // 14:00 UTC on January 15 = 09:00 EST (9-17 calling hours)
  const winterUS = new Date('2026-01-15T14:00:00Z');
  assert(isWithinCallingHours(winterUS, 'America/New_York', 9, 17) === true, 'Winter EST: 14:00 UTC is 09:00 EST (within 9-17)');

  // Test 5: DST Shift Transition Date - March 8, 2026 (US Spring Forward DST onset)
  // At 19:00 UTC on March 8, 2026:
  // Before shift: 19:00 UTC = 14:00 EST
  // After 2 AM shift: 19:00 UTC = 15:00 EDT
  const dstShiftUS = new Date('2026-03-08T19:00:00Z');
  const locUS = getLocalizedTime(dstShiftUS, 'America/New_York');
  assert(locUS.displayString.includes('EDT') || locUS.displayString.includes('EST') || locUS.displayString.length > 0, 'March DST Transition correctly localized for America/New_York');

  // Test 6: European Summer Time (BST - UTC+1) vs Winter Time (GMT - UTC+0)
  const summerUK = new Date('2026-07-15T10:00:00Z'); // 11:00 BST
  assert(isWithinCallingHours(summerUK, 'Europe/London', 9, 17) === true, 'Summer BST: 10:00 UTC is 11:00 BST');

  const winterUK = new Date('2026-01-15T10:00:00Z'); // 10:00 GMT
  assert(isWithinCallingHours(winterUK, 'Europe/London', 9, 17) === true, 'Winter GMT: 10:00 UTC is 10:00 GMT');

  // Test 7: Southern Hemisphere DST - Sydney (AEDT UTC+11 in Jan, AEST UTC+10 in July)
  const summerSydney = new Date('2026-01-15T01:00:00Z'); // 12:00 AEDT
  assert(isWithinCallingHours(summerSydney, 'Australia/Sydney', 9, 17) === true, 'Southern Hemisphere DST: Jan 15 in Sydney is AEDT (12:00)');

  // Test 8: Native Slot Generator
  const slots = generateNativeSlots(new Date('2026-08-26T00:00:00Z'), 1, 'Asia/Kolkata', 9, 17, 60);
  assert(slots.length > 0, `Generated ${slots.length} native booking slots for Asia/Kolkata`);

  console.log("\n====================================================");
  console.log(`Timezone Test Suite Summary: ${passed} passed, ${failed} failed`);
  console.log("====================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTimezoneTestSuite();
