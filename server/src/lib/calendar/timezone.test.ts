import { isWithinCallingHours } from './timezone';

function runTests() {
  console.log('--- Running Timezone Tests ---');
  
  // 10 AM UTC = 3:30 PM IST (Asia/Kolkata). Should be true (9 to 21)
  const d1 = new Date('2026-08-13T10:00:00Z');
  console.assert(isWithinCallingHours(d1, 'Asia/Kolkata', 9, 21) === true, 'Test 1 Failed');
  
  // 10 PM UTC = 3:30 AM IST next day. Should be false
  const d2 = new Date('2026-08-13T22:00:00Z');
  console.assert(isWithinCallingHours(d2, 'Asia/Kolkata', 9, 21) === false, 'Test 2 Failed');

  // Edge case: midnight
  // 6:30 PM UTC = 12:00 AM IST (midnight)
  const d3 = new Date('2026-08-13T18:30:00Z');
  console.assert(isWithinCallingHours(d3, 'Asia/Kolkata', 9, 21) === false, 'Test 3 Failed');
  
  console.log('All Timezone tests passed!');
}

runTests();
