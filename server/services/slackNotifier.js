import axios from 'axios';
import { logger } from '../logger.js';

export async function alert(message, extra) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    logger.warn({ message }, 'SLACK_WEBHOOK_URL not set; skipping alert');
    return;
  }
  try {
    await axios.post(
      url,
      { text: message, ...(extra ? { attachments: [{ text: JSON.stringify(extra, null, 2) }] } : {}) },
      { timeout: 5000 }
    );
  } catch (err) {
    logger.error({ err: err.message }, 'slack alert failed');
  }
}

export default { alert };
