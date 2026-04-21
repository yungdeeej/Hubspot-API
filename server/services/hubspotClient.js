import axios from 'axios';
import { logger } from '../logger.js';

const BASE_URL = 'https://api.hubapi.com';

function client() {
  const token = process.env.HUBSPOT_API_TOKEN;
  if (!token) throw new Error('HUBSPOT_API_TOKEN is not set');
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    timeout: 20000
  });
}

async function withRetry(fn, label) {
  const maxAttempts = 3;
  let lastErr;
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      const retryable = status === 429 || (status >= 500 && status < 600) || !status;
      if (!retryable || i === maxAttempts) throw err;
      const delay = Math.pow(2, i - 1) * 1000;
      logger.warn({ label, attempt: i, status, err: err.message }, 'hubspot retry');
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export async function getDeal(dealId) {
  return withRetry(async () => {
    const res = await client().get(`/crm/v3/objects/deals/${dealId}`, {
      params: {
        associations: 'contacts',
        properties: 'dealname,dealstage,pipeline,program_interest,program,amount,closedate'
      }
    });
    return res.data;
  }, 'getDeal');
}

export async function getContact(contactId) {
  return withRetry(async () => {
    const res = await client().get(`/crm/v3/objects/contacts/${contactId}`, {
      params: {
        properties: [
          'email', 'firstname', 'lastname', 'phone', 'mobilephone',
          'address', 'city', 'state', 'zip', 'country',
          'date_of_birth', 'gender',
          'program_interest', 'program',
          'scholarship_amount', 'citizenship', 'study_permit',
          'amp_prospect_id', 'amp_student_id', 'amp_student_key',
          'amp_sync_status', 'amp_sync_date',
          'amp_program_routed', 'amp_lead_provider_used', 'amp_sync_error'
        ].join(',')
      }
    });
    return res.data;
  }, 'getContact');
}

export async function updateContact(contactId, properties) {
  return withRetry(async () => {
    const res = await client().patch(`/crm/v3/objects/contacts/${contactId}`, { properties });
    return res.data;
  }, 'updateContact');
}

export async function searchContactByEmail(email) {
  return withRetry(async () => {
    const res = await client().post('/crm/v3/objects/contacts/search', {
      filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
      properties: ['email', 'firstname', 'lastname', 'amp_student_id', 'amp_sync_status'],
      limit: 5
    });
    return res.data.results || [];
  }, 'searchContactByEmail');
}

export async function listClosedWonDeals(since) {
  const stageId = process.env.HUBSPOT_CLOSED_WON_STAGE_ID;
  if (!stageId) throw new Error('HUBSPOT_CLOSED_WON_STAGE_ID is not set');
  const filters = [{ propertyName: 'dealstage', operator: 'EQ', value: stageId }];
  if (since) {
    filters.push({ propertyName: 'closedate', operator: 'GTE', value: new Date(since).getTime() });
  }
  return withRetry(async () => {
    const res = await client().post('/crm/v3/objects/deals/search', {
      filterGroups: [{ filters }],
      sorts: [{ propertyName: 'closedate', direction: 'DESCENDING' }],
      properties: ['dealname', 'dealstage', 'closedate', 'program_interest', 'program'],
      limit: 100
    });
    return res.data.results || [];
  }, 'listClosedWonDeals');
}
