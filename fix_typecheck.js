const fs = require('fs');

function replaceInFile(filePath, replacements) {
    let content = fs.readFileSync(filePath, 'utf8');
    for (const [search, replace] of replacements) {
        content = content.split(search).join(replace);
    }
    fs.writeFileSync(filePath, content, 'utf8');
}

replaceInFile('app/api/calendar/bookings/route.ts', [
    ["from '../../../../../server/src/lib/prisma'", "from '../../../../server/src/lib/prisma'"],
    ["from '../../../../../server/src/lib/calendar/scheduler'", "from '../../../../server/src/lib/calendar/scheduler'"],
    ["session.user?.id", "(session as any).user?.id"],
    ["a => a.id", "(a: any) => a.id"]
]);

replaceInFile('app/api/calendar/bookings/[id]/route.ts', [
    ["from '../../../../../../server/src/lib/prisma'", "from '../../../../../server/src/lib/prisma'"],
    ["from '../../../../../../server/src/lib/calendar/scheduler'", "from '../../../../../server/src/lib/calendar/scheduler'"]
]);

replaceInFile('app/api/calendar/batches/route.ts', [
    ["from '../../../../../server/src/lib/prisma'", "from '../../../../server/src/lib/prisma'"],
    ["session.user?.id", "(session as any).user?.id"],
    ["a => a.id", "(a: any) => a.id"]
]);

replaceInFile('app/api/calendar/batches/[id]/route.ts', [
    ["from '../../../../../../server/src/lib/prisma'", "from '../../../../../server/src/lib/prisma'"]
]);

console.log('Fixed Next.js typecheck issues.');
