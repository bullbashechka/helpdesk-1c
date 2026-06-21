import { config } from './config.js';

const STATUS_URL = `${config.backendUrl}/api/whatsapp/status`;

export function createStatusReporter() {
  let currentState = 'disconnected';
  let currentQr = null;
  let interval = null;
  let regenerateHandler = null;
  let regenerating = false;

  async function send() {
    try {
      const res = await fetch(STATUS_URL, {
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
      if (res.ok && regenerateHandler && !regenerating) {
        const body = await res.json().catch(() => null);
        if (body?.regenerate_requested === true) {
          regenerating = true;
          regenerateHandler().finally(() => { regenerating = false; });
        }
      }
    } catch (err) {
      console.warn(`[status] heartbeat failed: ${err.message}`);
    }
  }

  function setState(state, qrDataUrl = null) {
    currentState = state;
    currentQr = qrDataUrl;
    send(); // immediate on state change
  }

  function onRegenerate(fn) {
    regenerateHandler = fn;
  }

  function start() {
    interval = setInterval(send, config.heartbeatIntervalMs);
  }

  function stop() {
    if (interval) clearInterval(interval);
  }

  return { setState, onRegenerate, start, stop };
}
