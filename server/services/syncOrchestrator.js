import * as db from '../db.js';
import * as hubspot from './hubspotClient.js';
import * as amp from './ampClient.js';
import * as slack from './slackNotifier.js';
import { applyTransform } from './transformers.js';
import { logger } from '../logger.js';

export async function buildPayload(contact, deal) {
  const mappings = await db.listFieldMappings({ activeOnly: true });
  const payload = {};
  const props = contact?.properties || {};
  const dealProps = deal?.properties || {};

  for (const m of mappings) {
    if (m.hubspot_field === '__fixed__') {
      payload[m.amp_field] = m.default_value ?? '';
      continue;
    }

    const raw = props[m.hubspot_field] ?? dealProps[m.hubspot_field];
    let value;
    if (raw === undefined || raw === null || String(raw).trim() === '') {
      value = m.default_value ?? '';
    } else {
      value = applyTransform(m.transform, raw);
      if ((value === undefined || value === null || value === '') && m.default_value) {
        value = m.default_value;
      }
    }

    if (value !== undefined && value !== null && value !== '') {
      // Multiple hubspot fields can map to the same amp field (e.g. phone, mobilephone).
      // First non-empty wins; don't overwrite with later empties.
      if (payload[m.amp_field] === undefined || payload[m.amp_field] === '') {
        payload[m.amp_field] = value;
      }
    } else if (payload[m.amp_field] === undefined) {
      // Preserve key presence only if required so validation can flag it
      if (m.is_required) payload[m.amp_field] = '';
    }
  }

  return payload;
}

export async function validateRequired(payload) {
  const mappings = await db.listFieldMappings({ activeOnly: true });
  const required = mappings.filter((m) => m.is_required).map((m) => m.amp_field);
  const missing = [];
  for (const field of new Set(required)) {
    const v = payload[field];
    if (v === undefined || v === null || String(v).trim() === '') missing.push(field);
  }
  return missing;
}

async function markManualReview(enrollmentId, reason) {
  await db.updateEnrollment(enrollmentId, { status: 'manual_review', error_message: reason });
  await db.logAudit(enrollmentId, 'sync.manual_review', 'system', { reason });
}

export async function syncEnrollment(hubspotDealId, triggeredBy) {
  const existing = await db.getEnrollmentByDealId(hubspotDealId);
  if (existing?.status === 'success') {
    logger.info({ dealId: hubspotDealId }, 'Already synced, skipping');
    return { status: 'already_synced', enrollmentId: existing.id };
  }

  const enrollment = await db.upsertEnrollment({
    hubspotDealId,
    status: 'in_progress',
    triggeredBy,
    retryCount: existing?.retry_count || 0
  });

  try {
    const deal = await hubspot.getDeal(hubspotDealId);
    const contactId = deal.associations?.contacts?.results?.[0]?.id;
    if (!contactId) throw new Error('Deal has no associated contact');
    const contact = await hubspot.getContact(contactId);

    await db.updateEnrollment(enrollment.id, {
      hubspot_contact_id: contactId,
      student_email: contact.properties.email || '',
      student_name: `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim()
    });

    const programValue =
      deal.properties.program_interest ||
      deal.properties.program ||
      contact.properties.program_interest;

    if (!programValue) {
      await markManualReview(enrollment.id, 'No program value found on deal or contact');
      return { status: 'manual_review', enrollmentId: enrollment.id };
    }

    const match = await db.resolveProgramAlias(programValue);
    if (!match) {
      await markManualReview(enrollment.id, `No alias match for program: "${programValue}"`);
      await slack.alert(`Program alias missing for "${programValue}" — add via dashboard`);
      return { status: 'manual_review', enrollmentId: enrollment.id };
    }

    const provider = await db.getLeadProvider(match.program_code);
    if (!provider) {
      await markManualReview(enrollment.id, `No active provider for code ${match.program_code}`);
      return { status: 'manual_review', enrollmentId: enrollment.id };
    }

    await db.updateEnrollment(enrollment.id, {
      resolved_program_id: provider.amp_program_id,
      resolved_program_code: provider.program_code,
      program_name: provider.program_label,
      amp_provider_id: provider.amp_provider_id
    });

    const payload = await buildPayload(contact, deal);

    const missing = await validateRequired(payload);
    if (missing.length > 0) {
      await markManualReview(enrollment.id, `Missing required fields: ${missing.join(', ')}`);
      return { status: 'manual_review', enrollmentId: enrollment.id };
    }

    await db.updateEnrollment(enrollment.id, { payload_sent: payload });

    const result = await amp.postLead(provider.amp_provider_id, payload);

    await db.updateEnrollment(enrollment.id, {
      response_received: result.raw,
      amp_log: result.log
    });

    if (!result.success) {
      const errorMessages = (result.messages?.error || []).join('; ');
      const isDuplicate = /already exists|duplicate/i.test(errorMessages);
      const status = isDuplicate ? 'duplicate' : 'failed';

      await db.updateEnrollment(enrollment.id, {
        status,
        error_message: errorMessages || 'Unknown failure'
      });

      await hubspot.updateContact(contactId, {
        amp_sync_status: status,
        amp_sync_error: errorMessages,
        amp_sync_date: new Date().toISOString(),
        amp_program_routed: provider.program_code,
        amp_lead_provider_used: provider.amp_provider_id
      });

      await slack.alert(`Sync ${status} for ${payload.email}: ${errorMessages}`);
      await db.logAudit(enrollment.id, `sync.${status}`, triggeredBy, { errorMessages });
      return { status, enrollmentId: enrollment.id };
    }

    await hubspot.updateContact(contactId, {
      amp_prospect_id: String(result.studentID || ''),
      amp_student_id: result.studentAssignedID || '',
      amp_student_key: result.studentKey || '',
      amp_sync_status: 'success',
      amp_sync_date: new Date().toISOString(),
      amp_program_routed: provider.program_code,
      amp_lead_provider_used: provider.amp_provider_id,
      amp_sync_error: ''
    });

    await db.updateEnrollment(enrollment.id, {
      status: 'success',
      amp_prospect_id: String(result.studentID || ''),
      amp_student_id: result.studentAssignedID,
      amp_student_key: result.studentKey,
      completed_at: new Date()
    });

    await db.logAudit(enrollment.id, 'sync.success', triggeredBy, {
      studentAssignedID: result.studentAssignedID
    });

    return { status: 'success', enrollmentId: enrollment.id, studentAssignedID: result.studentAssignedID };
  } catch (err) {
    await db.updateEnrollment(enrollment.id, {
      status: 'failed',
      error_message: err.message,
      retry_count: (enrollment.retry_count || 0) + 1
    });
    await db.logAudit(enrollment.id, 'sync.exception', triggeredBy, { error: err.message });
    await slack.alert(`Sync exception for deal ${hubspotDealId}: ${err.message}`);
    throw err;
  }
}
