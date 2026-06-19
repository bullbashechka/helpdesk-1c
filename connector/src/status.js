import { config } from './config.js';

const STATUS_URL = `${config.backendUrl}/api/whatsapp/status`;

export function createStatusReporter() {
  let currentState = 'disconnected';
  let currentQr = null;
  let interval = null;

  async function send() {
    try {
      await fetch(STATUS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Connector-Token': config.connectorToken,
        },
        body: JSON.stringify({
          receiver_id: config.receiverId,
          state: currentState,
          qr_data_url: currentState === 'qr_required' ? currentQr : null,
          last_heartbeat_at: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.warn(`[status] heartbeat failed: ${err.message}`);
    }
  }

  function setState(state, qrDataUrl = null) {
    currentState = state;
    currentQr = qrDataUrl;
    send(); // immediate on state change
  }

  function start() {
    interval = setInterval(send, config.heartbeatIntervalMs);
  }

  function stop() {
    if (interval) clearInterval(interval);
  }

  return { setState, start, stop };
}
