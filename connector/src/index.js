import { config } from './config.js';
import { createQueue } from './queue.js';
import { createSender } from './sender.js';
import { createStatusReporter } from './status.js';
import { createWaClient } from './wa-client.js';

const queue = createQueue(config.queueDir);
const statusReporter = createStatusReporter();
const sender = createSender(queue);

// Flush queue on start (pick up any messages buffered from previous run).
await sender.flush();

// Flush again every retryBaseMs to catch new enqueued items.
setInterval(() => sender.flush(), config.retryBaseMs);

// Start heartbeat.
statusReporter.start();

const waClient = createWaClient({ queue, statusReporter });

process.on('SIGINT', async () => {
  console.log('\n[connector] shutting down…');
  statusReporter.stop();
  await waClient.destroy();
  process.exit(0);
});

await waClient.init();
