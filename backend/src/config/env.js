import dotenv from 'dotenv';

dotenv.config();

export const env = {
  apiPort: Number(process.env.API_PORT || 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  sqliteDbPath: process.env.SQLITE_DB_PATH || './data/helpdesk.sqlite',
  whatsappConnectorToken: process.env.WHATSAPP_CONNECTOR_TOKEN || 'dev-connector-token',
};
