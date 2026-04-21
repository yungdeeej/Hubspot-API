import crypto from 'crypto';

/**
 * HubSpot v3 signature validation.
 * https://developers.hubspot.com/docs/api/webhooks/validating-requests
 */
export function validateHubspotSignature(req) {
  const secret = process.env.HUBSPOT_WEBHOOK_SECRET;
  if (!secret) return false;

  const signature = req.get('X-HubSpot-Signature-v3');
  const timestamp = req.get('X-HubSpot-Request-Timestamp');
  if (!signature || !timestamp) return false;

  const skewMs = 5 * 60 * 1000;
  if (Math.abs(Date.now() - Number(timestamp)) > skewMs) return false;

  const method = req.method.toUpperCase();
  const host = req.get('host');
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
  const uri = `${proto}://${host}${req.originalUrl}`;
  const rawBody = req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

  const base = `${method}${uri}${rawBody}${timestamp}`;
  const computed = crypto.createHmac('sha256', secret).update(base, 'utf8').digest('base64');

  try {
    const a = Buffer.from(computed);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
