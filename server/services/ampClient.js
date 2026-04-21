import axios from 'axios';
import { logger } from '../logger.js';

const BASE = process.env.AMP_BASE_URL;
const PATH = process.env.AMP_LEAD_PROVIDER_PATH;

export class AmpApiError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'AmpApiError';
    this.details = details;
  }
}

export async function postLead(providerId, payload) {
  const url = `${BASE}${PATH}/${providerId}`;
  const body = new URLSearchParams(payload).toString();

  const maxAttempts = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.post(url, body, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        timeout: 30000,
        validateStatus: () => true
      });

      if (response.status >= 500) {
        throw new AmpApiError(`amp returned ${response.status}`, { status: response.status });
      }

      const data = response.data || {};
      return {
        httpStatus: response.status,
        success: data.success === true,
        prospect: data.prospect || null,
        studentAssignedID: data.prospect?.studentAssignedID || null,
        studentID: data.prospect?.studentID || null,
        studentKey: data.prospect?.studentKey || null,
        messages: data.messages || {},
        log: data.log || '',
        raw: data
      };
    } catch (err) {
      lastError = err;
      logger.warn({ attempt, err: err.message }, 'amp postLead failed, retrying');
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
      }
    }
  }

  throw lastError;
}
