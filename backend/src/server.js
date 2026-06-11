import { createApp } from './app.js';
import { env } from './config/env.js';
import { initializeDatabase } from './db/init.js';

initializeDatabase();

const app = createApp();

app.listen(env.apiPort, () => {
  console.log(`API is running on http://localhost:${env.apiPort}`);
});
