const fs = require('fs');

function replaceInFile(filePath, replacements) {
    let content = fs.readFileSync(filePath, 'utf8');
    for (const [search, replace] of replacements) {
        content = content.split(search).join(replace);
    }
    fs.writeFileSync(filePath, content, 'utf8');
}

replaceInFile('server/src/core/orchestrator/CallOrchestrator.ts', [
    ["from '../../../../lib/calendar/bookingTool'", "from '../../lib/calendar/bookingTool'"]
]);

replaceInFile('server/src/lib/calendar/availability.ts', [
    ["from '../../server/src/lib/prisma'", "from '../prisma'"]
]);

replaceInFile('server/src/lib/calendar/scheduler.ts', [
    ["from '../../server/src/lib/prisma'", "from '../prisma'"]
]);

replaceInFile('server/src/lib/calendar/batchRunner.ts', [
    ["from '../../server/src/lib/prisma'", "from '../prisma'"]
]);

replaceInFile('server/scripts/calendar/execute-scheduled-calls.ts', [
    ["from '../../server/src/lib/prisma'", "from '../../src/lib/prisma'"],
    ["from '../../server/src/services/CallService'", "from '../../src/services/CallService'"],
    ["from '../../lib/calendar/availability'", "from '../../src/lib/calendar/availability'"],
    ["from '../../lib/calendar/retryPolicy'", "from '../../src/lib/calendar/retryPolicy'"]
]);

replaceInFile('server/scripts/calendar/process-batch-queue.ts', [
    ["from '../../server/src/lib/prisma'", "from '../../src/lib/prisma'"],
    ["from '../../lib/calendar/batchRunner'", "from '../../src/lib/calendar/batchRunner'"]
]);

replaceInFile('app/api/calendar/bookings/route.ts', [
    ["from '../../../../../lib/calendar/scheduler'", "from '../../../../../server/src/lib/calendar/scheduler'"]
]);

replaceInFile('app/api/calendar/bookings/[id]/route.ts', [
    ["from '../../../../../../lib/calendar/scheduler'", "from '../../../../../../server/src/lib/calendar/scheduler'"]
]);

// Add executionType and config to bookingTool.ts
let bookingToolContent = fs.readFileSync('server/src/lib/calendar/bookingTool.ts', 'utf8');
bookingToolContent = bookingToolContent.replace(
    "name: 'book_follow_up_call',",
    "name: 'book_follow_up_call',\n  executionType: 'builtin' as const,\n  config: {},\n"
);
fs.writeFileSync('server/src/lib/calendar/bookingTool.ts', bookingToolContent, 'utf8');

console.log('Imports and ToolDefinition fixed.');
