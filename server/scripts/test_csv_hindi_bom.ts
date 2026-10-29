import http from 'http';
import express from 'express';

async function main() {
  const { prisma } = await import('../src/lib/prisma');
  const reportsRouter = (await import('../src/routes/reports')).default;
  const { errorHandler } = await import('../src/utils/errorHandler');

  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.userId = '1e69187e-82d5-4166-929f-4bbba90e5304';
    req.effectiveWorkspaceId = '1e69187e-82d5-4166-929f-4bbba90e5304';
    req.workspaceRole = 'admin';
    next();
  });
  app.use('/api/v2/reports', reportsRouter);
  app.use(errorHandler);

  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(3923, '127.0.0.1', r));

  // Seed sample call and result with Hindi text & formula injection
  const callId = `csv-hindi-test-${Date.now()}`;
  await prisma.call.create({
    data: {
      id: callId,
      userId: '1e69187e-82d5-4166-929f-4bbba90e5304',
      agentId: '03dc2b81-e0f5-478e-b977-8ddf7dcb98f2',
      status: 'completed',
      callDirection: 'inbound',
      fromPhoneNumber: '+919876543210',
      recipientPhoneNumber: '+918000123456',
      durationSeconds: 154,
      startTime: new Date(),
      endTime: new Date(),
      telemetryId: `u-${callId}`,
      endReason: 'completed',
    },
  });

  await prisma.callResult.create({
    data: {
      callId,
      workspaceId: '1e69187e-82d5-4166-929f-4bbba90e5304',
      blueprintVersion: 'tpl-12',
      resultLabel: 'Interview Scheduled',
      status: 'completed',
      score: 85,
      confidence: 0.95,
      summary: '=HYPERLINK("https://malicious.site","कॉल विवरण: उम्मीदवार १५ दिन के नोटिस पीरियड पर उपलब्ध है")',
      fields: {
        yearsExperience: 5,
        currentCtcLakhs: 1800000,
        noticePeriodDays: 15,
      },
      evidence: {
        yearsExperience: { quote: '५ साल का अनुभव', segmentIndex: 1 },
      },
    },
  });

  const res = await fetch('http://127.0.0.1:3923/api/v2/reports/export/csv');
  const buf = Buffer.from(await res.arrayBuffer());
  const text = buf.toString('utf-8');

  // 1. Verify 3-byte UTF-8 BOM
  const hasBom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  console.log('UTF-8 BOM bytes:', buf[0].toString(16), buf[1].toString(16), buf[2].toString(16), '->', hasBom ? 'VALID' : 'MISSING');

  // 2. Verify formula neutralisation (starts with single quote)
  const isFormulaNeutralized = text.includes("'\=HYPERLINK");
  console.log('Formula neutralization check:', isFormulaNeutralized ? 'PASSED' : 'FAILED');

  // 3. Verify Hindi Devanagari text preserved
  const hasHindiText = text.includes('उम्मीदवार १५ दिन के नोटिस पीरियड पर उपलब्ध है');
  console.log('Hindi Devanagari text preservation:', hasHindiText ? 'PASSED' : 'FAILED');

  // 4. Verify Direction, Contact, Business number columns
  const hasDirectionColumns = text.includes('"inbound"') && text.includes("'+919876543210") && text.includes("'+918000123456");
  console.log('Direction and DID mapping:', hasDirectionColumns ? 'PASSED' : 'FAILED');

  // Cleanup
  await prisma.callResult.deleteMany({ where: { callId } });
  await prisma.call.deleteMany({ where: { id: callId } });
  server.close();

  if (hasBom && isFormulaNeutralized && hasHindiText && hasDirectionColumns) {
    console.log('\n✔ ALL CSV VALIDATIONS PASSED: UTF-8 BOM, Hindi Text in Excel, and Formula Sanitization verified.');
    process.exit(0);
  } else {
    console.error('\n✖ CSV VALIDATION FAILED');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
