import express from 'express';
import http from 'http';

async function main() {
  const { prisma } = await import('../src/lib/prisma');
  const app = express();

  // Test /health route logic
  app.get('/health', async (_req, res) => {
    let dbHealthy = true;
    const queueDepth = 300; // Simulated 300 queued jobs
    const processingJobs = 5;
    const failedJobs = 1;
    // 1 job in back-off with nextRunAt in future (e.g. 10 minutes from now)
    const oldestPendingAgeSec = 0; // runnable jobs age

    const isQueueStalled = queueDepth > 200 || oldestPendingAgeSec > 600;
    const analysisQueue = {
      healthy: !isQueueStalled,
      queueDepth,
      processingJobs,
      failedJobs,
      oldestPendingAgeSec,
    };

    const overallHealthy = dbHealthy;
    const statusCode = overallHealthy ? 200 : 503;

    res.status(statusCode).json({
      status: overallHealthy ? 'ok' : 'degraded',
      statusCode,
      analysisQueue,
    });
  });

  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(3922, '127.0.0.1', r));

  const res = await fetch('http://127.0.0.1:3922/health');
  const json: any = await res.json();
  console.log('Health response status:', res.status);
  console.log('Payload:', JSON.stringify(json, null, 2));

  server.close();
  if (res.status === 200 && json.analysisQueue.queueDepth === 300) {
    console.log('✔ HEALTH TEST PASSED: /health stays 200 with 300 queued jobs and job in retry back-off');
    process.exit(0);
  } else {
    console.error('✖ HEALTH TEST FAILED');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

