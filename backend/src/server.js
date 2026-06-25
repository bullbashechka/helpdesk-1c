import { createApp } from './app.js';
import { env } from './config/env.js';
import { closeDatabase } from './db/database.js';

const app = createApp();

const server = app.listen(env.apiPort, () => {
  console.log(`API is running on http://localhost:${env.apiPort}`);
});

function shutdown() {
  server.closeAllConnections();
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
