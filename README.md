# InFocus Lead Bridge — Build Spec (FINAL)

**For: Claude Code on Replit**
**Owner: DJ Gupta, InFocus Film School**
**Last updated: 2026-04-21**
**Architecture validated via live API testing against `https://infocus.ampeducator.ca`**

---

## Mission (Option A — "Lead Bridge")

Build a production Node/Express + React app on Replit that receives HubSpot deal-stage-change webhooks (Closed Won), posts the contact data to the correct ampEducator Lead Provider HTTP endpoint with `autoEnroll=true`, captures the returned Student ID, and writes it back to HubSpot. Admissions staff then completes program/session/intake enrollment manually in amp's UI.

---

## Validated architecture (confirmed 2026-04-21)

- ✅ amp Lead Provider POST endpoints return JSON (not 302) when program-specific providers are used
- ✅ `autoEnroll=true` creates both a prospect record AND a student record with a sequential `studentAssignedID` (e.g., `000423`)
- ✅ All 11 program IDs mapped and confirmed
- ✅ Field mapping for all custom fields verified
- ⚠️ `expectedProgramID` is **accepted but ignored** by Lead Provider POST — field is not writable via this endpoint. Program enrollment is a downstream manual step in amp.
- ⚠️ `leadStage` stays as "Lead" after auto-enroll — prospect pipeline does not auto-advance
- ⚠️ Student IDs from API are sequential (`000423`) not program-prefixed (`FP20261941`) — acceptable for v1

---

## Tech stack

- **Backend:** Node.js 20, Express, node-pg
- **Frontend:** React 18 + Vite + Tailwind + React Router
- **Database:** Replit-managed PostgreSQL
- **Auth:** JWT + bcrypt
- **Scheduling:** node-cron
- **HTTP:** axios
- **Queue:** p-queue (in-process, concurrency 2)
- **Validation:** zod
- **Logging:** pino + pino-pretty (dev)

---

## Environment variables (Replit Secrets)

```bash
# ampEducator
AMP_BASE_URL=https://infocus.ampeducator.ca
AMP_LEAD_PROVIDER_PATH=/web/public/prospects/leads

# HubSpot
HUBSPOT_API_TOKEN=                    # Private app token
HUBSPOT_WEBHOOK_SECRET=               # For v3 signature validation
HUBSPOT_CLOSED_WON_STAGE_ID=          # Internal stage ID, not label
HUBSPOT_PORTAL_ID=

# App
DATABASE_URL=
JWT_SECRET=                           # 64+ char random string
NODE_ENV=production
PORT=3000
ADMIN_EMAIL=dj@mcgcollege.ca
SLACK_WEBHOOK_URL=
APP_BASE_URL=                         # Public Replit URL
```

**No amp API key needed.** Lead Provider endpoints are public, authenticated only by the unique providerId in the URL path. Security via IP whitelisting configured in amp's Lead Provider settings.

---

## Database schema

Create `server/migrations/001_init.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE enrollments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hubspot_deal_id       TEXT UNIQUE NOT NULL,
  hubspot_contact_id    TEXT NOT NULL,
  amp_prospect_id       TEXT,                  -- prospect.studentID (int, stored as text)
  amp_student_id        TEXT,                  -- prospect.studentAssignedID (e.g., "000423")
  amp_student_key       TEXT,                  -- prospect.studentKey (UUID-like)
  amp_provider_id       TEXT,                  -- e.g., "Application_Film"
  resolved_program_id   INT,                   -- which program we intended (for future Option B)
  resolved_program_code TEXT,                  -- e.g., "FP", "VFX"
  status                TEXT NOT NULL CHECK (status IN
    ('pending','in_progress','success','failed','manual_review','skipped','duplicate')),
  student_email         TEXT NOT NULL,
  student_name          TEXT,
  program_name          TEXT,
  payload_sent          JSONB,
  response_received     JSONB,
  amp_log               TEXT,                  -- the verbose log from amp's response
  error_message         TEXT,
  retry_count           INT DEFAULT 0,
  triggered_by          TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  completed_at          TIMESTAMPTZ
);
CREATE INDEX idx_enrollments_status ON enrollments(status);
CREATE INDEX idx_enrollments_email ON enrollments(student_email);
CREATE INDEX idx_enrollments_created ON enrollments(created_at DESC);

-- Lead Provider routing
CREATE TABLE lead_providers (
  id                  SERIAL PRIMARY KEY,
  program_code        TEXT UNIQUE NOT NULL,
  program_label       TEXT NOT NULL,
  amp_provider_id     TEXT NOT NULL,           -- URL suffix
  amp_program_id      INT NOT NULL,            -- target program ID in amp
  credential          TEXT NOT NULL CHECK (credential IN ('Diploma','Certificate','Other')),
  active              BOOLEAN DEFAULT TRUE,
  notes               TEXT
);

-- HubSpot program value → program_code resolver
CREATE TABLE program_aliases (
  id              SERIAL PRIMARY KEY,
  hubspot_value   TEXT NOT NULL,
  program_code    TEXT NOT NULL REFERENCES lead_providers(program_code) ON UPDATE CASCADE,
  active          BOOLEAN DEFAULT TRUE,
  UNIQUE(lower(hubspot_value))
);

-- HubSpot → amp field mapping (editable via UI)
CREATE TABLE field_mappings (
  id              SERIAL PRIMARY KEY,
  hubspot_field   TEXT NOT NULL,
  amp_field       TEXT NOT NULL,
  transform       TEXT,                        -- trim|lowercase|uppercase|date_iso|phone_raw|country_iso2
  default_value   TEXT,                        -- used when hubspot field is empty
  is_required     BOOLEAN DEFAULT FALSE,
  active          BOOLEAN DEFAULT TRUE,
  notes           TEXT
);

-- Append-only audit trail
CREATE TABLE audit_log (
  id              BIGSERIAL PRIMARY KEY,
  enrollment_id   UUID REFERENCES enrollments(id) ON DELETE CASCADE,
  action          TEXT NOT NULL,
  actor           TEXT,
  details         JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_enrollment ON audit_log(enrollment_id);

-- Dashboard users
CREATE TABLE users (
  id              SERIAL PRIMARY KEY,
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  role            TEXT DEFAULT 'staff' CHECK (role IN ('admin','staff','viewer')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEED DATA (verified against InFocus amp instance 2026-04-21)
-- ============================================================

-- Lead Providers with confirmed program ID mappings
INSERT INTO lead_providers (program_code, program_label, amp_provider_id, amp_program_id, credential, notes) VALUES
  ('FP',       'Film Production',                             'Application_Film',         13, 'Diploma',    'v2 current; Legacy v1 = ID 7, not routed'),
  ('3DA',      '3D Animation',                                'Application_3D',            4, 'Diploma',    '48 weeks, 1100 hours'),
  ('DFP',      'Documentary Film',                            'Application_Documentary',   5, 'Diploma',    '33 weeks, 660 hours'),
  ('GM',       'Game Design',                                 'Application_Game',         11, 'Diploma',    '33 weeks, 633 hours'),
  ('GR',       'Graphic and Digital Design',                  'Application_Graphic',       9, 'Diploma',    '26 weeks, 520 hours'),
  ('COMP',     'Visual Effects Compositing Certificate',      'Application_COMP',          6, 'Certificate','24 weeks, 537 hours'),
  ('VFX',      'VFX Compositing Diploma',                     'Application_VFX',          12, 'Diploma',    'Provider created 2026-04-21'),
  ('WR',       'Writing for Film and Television',             'Application_Writing',       1, 'Diploma',    '30 weeks, 600 hours'),
  ('WR-CERT',  'Writing for Film and Television Certificate', 'Application_Writing',      14, 'Certificate','30 weeks, 627 hours; same provider as WR');

-- Program aliases (HubSpot value → program_code)
INSERT INTO program_aliases (hubspot_value, program_code) VALUES
  ('Film Production',                              'FP'),
  ('Film Production Diploma',                      'FP'),
  ('FP',                                           'FP'),
  ('Film',                                         'FP'),
  ('3D Animation',                                 '3DA'),
  ('3DA',                                          '3DA'),
  ('3D',                                           '3DA'),
  ('Documentary Film',                             'DFP'),
  ('DFP',                                          'DFP'),
  ('Documentary',                                  'DFP'),
  ('Game Design',                                  'GM'),
  ('GM',                                           'GM'),
  ('Graphic and Digital Design',                   'GR'),
  ('Graphic Design',                               'GR'),
  ('GR',                                           'GR'),
  ('Visual Effects Compositing Certificate',       'COMP'),
  ('COMP Certificate',                             'COMP'),
  ('Compositing Certificate',                      'COMP'),
  ('COMP',                                         'COMP'),
  ('VFX Compositing Diploma',                      'VFX'),
  ('VFX Diploma',                                  'VFX'),
  ('Compositing Diploma',                          'VFX'),
  ('VFX',                                          'VFX'),
  ('Writing for Film and Television',              'WR'),
  ('Writing Diploma',                              'WR'),
  ('WR Diploma',                                   'WR'),
  ('WR',                                           'WR'),
  ('Writing for Film and Television Certificate',  'WR-CERT'),
  ('Writing Certificate',                          'WR-CERT'),
  ('WR Certificate',                               'WR-CERT');

-- Field mappings — verified against amp's Field Mapping table
INSERT INTO field_mappings (hubspot_field, amp_field, transform, is_required, notes) VALUES
  ('firstname',        'firstName',         'trim',       TRUE,  'Required by amp'),
  ('lastname',         'lastName',          'trim',       TRUE,  'Required by amp'),
  ('email',            'email',             'lowercase',  TRUE,  'Required; must be valid format'),
  ('phone',            'mobilePhone',       'phone_raw',  FALSE, 'Digits only; amp formats internally'),
  ('mobilephone',      'mobilePhone',       'phone_raw',  FALSE, 'Fallback if phone empty'),
  ('address',          'addressOne',        'trim',       FALSE, NULL),
  ('city',             'city',              'trim',       FALSE, NULL),
  ('state',            'province',          'uppercase',  FALSE, NULL),
  ('zip',              'postalCode',        'trim',       FALSE, NULL),
  ('country',          'country',           'country_iso2', FALSE, 'Must be 2-letter ISO; defaults CA'),
  ('date_of_birth',    'dateofBirth',       'date_iso',   FALSE, 'yyyy-mm-dd format'),
  ('gender',           'gender',            'trim',       FALSE, NULL);

-- Required InFocus custom fields with safe defaults
INSERT INTO field_mappings (hubspot_field, amp_field, default_value, is_required, notes) VALUES
  ('scholarship_amount',   'customField9',   'N/A',   TRUE,  'Scholarship is required in amp'),
  ('citizenship',          'customField3',   'TBC',   TRUE,  'Citizenship is required in amp'),
  ('study_permit',         'customField2',   'TBC',   TRUE,  'Study Permit is required in amp');

-- Fixed values — these go on EVERY submission regardless of HubSpot data
INSERT INTO field_mappings (hubspot_field, amp_field, default_value, is_required, notes) VALUES
  ('__fixed__',            'autoEnroll',     'true',  FALSE, 'Always auto-enroll to student'),
  ('__fixed__',            'mobilePhoneCountry', 'CA',FALSE, 'Default to CA country code'),
  ('__fixed__',            'leadSourceCode', 'WEB',   FALSE, 'HubSpot funnel = website category');
```

---

## The amp client (`server/services/ampClient.js`)

Single responsibility — fire one POST, parse the response.

```js
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

      // Non-2xx = retry
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
        await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
      }
    }
  }

  throw lastError;
}
```

---

## HubSpot client (`server/services/hubspotClient.js`)

```js
getDeal(dealId)                    // GET /crm/v3/objects/deals/{id}?associations=contacts
getContact(contactId)              // GET /crm/v3/objects/contacts/{id}
updateContact(contactId, props)    // PATCH /crm/v3/objects/contacts/{id}
searchContactByEmail(email)        // POST /crm/v3/objects/contacts/search
listClosedWonDeals(since)          // POST /crm/v3/objects/deals/search
```

### Custom HubSpot contact properties to create (manual, one-time)

Before go-live, create these in HubSpot → Settings → Properties → Contact properties:

- `amp_prospect_id` (single-line text) — amp internal numeric ID
- `amp_student_id` (single-line text) — Student Assigned ID (e.g., "000423")
- `amp_student_key` (single-line text) — unique key for URL construction
- `amp_sync_status` (dropdown: `pending`, `success`, `failed`, `duplicate`, `manual_review`)
- `amp_sync_date` (datetime)
- `amp_program_routed` (single-line text) — which program code we routed to
- `amp_lead_provider_used` (single-line text) — which Lead Provider we hit
- `amp_sync_error` (multi-line text) — populated on failure

---

## Sync orchestrator logic (`server/services/syncOrchestrator.js`)

```
async function syncEnrollment(hubspotDealId, triggeredBy) {
  // 1. Idempotency — skip if already succeeded
  const existing = await db.getEnrollmentByDealId(hubspotDealId);
  if (existing?.status === 'success') {
    logger.info({ dealId: hubspotDealId }, 'Already synced, skipping');
    return { status: 'already_synced', enrollmentId: existing.id };
  }

  // 2. Upsert row as in_progress
  const enrollment = await db.upsertEnrollment({
    hubspotDealId,
    status: 'in_progress',
    triggeredBy,
    retryCount: (existing?.retry_count || 0)
  });

  try {
    // 3. Fetch from HubSpot
    const deal = await hubspot.getDeal(hubspotDealId);
    const contactId = deal.associations?.contacts?.results?.[0]?.id;
    if (!contactId) throw new Error('Deal has no associated contact');
    const contact = await hubspot.getContact(contactId);

    await db.updateEnrollment(enrollment.id, {
      hubspot_contact_id: contactId,
      student_email: contact.properties.email,
      student_name: `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim()
    });

    // 4. Resolve program from HubSpot property
    const programValue = deal.properties.program_interest ||
                         deal.properties.program ||
                         contact.properties.program_interest;
    if (!programValue) {
      await markManualReview(enrollment.id, 'No program value found on deal or contact');
      return;
    }

    const match = await db.resolveProgramAlias(programValue);
    if (!match) {
      await markManualReview(enrollment.id, `No alias match for program: "${programValue}"`);
      await slack.alert(`Program alias missing for "${programValue}" — add via dashboard`);
      return;
    }

    const provider = await db.getLeadProvider(match.program_code);

    await db.updateEnrollment(enrollment.id, {
      resolved_program_id: provider.amp_program_id,
      resolved_program_code: provider.program_code,
      program_name: provider.program_label,
      amp_provider_id: provider.amp_provider_id
    });

    // 5. Build payload
    const payload = await buildPayload(contact, deal);

    // 6. Validate required fields
    const missing = await validateRequired(payload);
    if (missing.length > 0) {
      await markManualReview(enrollment.id, `Missing required fields: ${missing.join(', ')}`);
      return;
    }

    await db.updateEnrollment(enrollment.id, { payload_sent: payload });

    // 7. POST to amp Lead Provider
    const result = await amp.postLead(provider.amp_provider_id, payload);

    await db.updateEnrollment(enrollment.id, {
      response_received: result.raw,
      amp_log: result.log
    });

    // 8. Handle failure
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
      return;
    }

    // 9. Success — write back to HubSpot
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

    // 10. Finalize
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

  } catch (err) {
    await db.updateEnrollment(enrollment.id, {
      status: 'failed',
      error_message: err.message,
      retry_count: (enrollment.retry_count || 0) + 1
    });
    await slack.alert(`Sync exception for deal ${hubspotDealId}: ${err.message}`);
    throw err;
  }
}
```

---

## Webhook handler (`server/routes/webhooks.js`)

### `POST /webhooks/hubspot`

```
1. Validate X-HubSpot-Signature-v3 header against HUBSPOT_WEBHOOK_SECRET
2. For each event in payload:
   - If propertyName === 'dealstage' AND propertyValue === HUBSPOT_CLOSED_WON_STAGE_ID:
     - Enqueue syncEnrollment(event.objectId, 'hubspot_webhook')
3. Return 200 OK immediately (within 5s)
```

No amp webhook receiver in v1 — Lead Provider POST is synchronous, response captured directly.

---

## Transformers (`server/services/transformers.js`)

```js
trim(v)           → String(v ?? '').trim()
lowercase(v)      → trim(v).toLowerCase()
uppercase(v)      → trim(v).toUpperCase()
date_iso(v)       → new Date(v).toISOString().split('T')[0]
phone_raw(v)      → String(v).replace(/\D/g, '')   // digits only
country_iso2(v)   → "Canada" → "CA"; if already 2 chars, uppercase and return
```

---

## API routes (for dashboard)

```
POST   /api/auth/login
POST   /api/auth/register                 (admin only)
GET    /api/auth/me

GET    /api/enrollments                   ?status=&email=&limit=&offset=
GET    /api/enrollments/:id
POST   /api/enrollments/:id/retry
PATCH  /api/enrollments/:id               (edit payload_sent, re-run)
POST   /api/enrollments/:id/skip

GET    /api/mappings
POST   /api/mappings
PATCH  /api/mappings/:id
DELETE /api/mappings/:id

GET    /api/providers
PATCH  /api/providers/:id

GET    /api/aliases
POST   /api/aliases
DELETE /api/aliases/:id

POST   /api/manual-enroll/search          { email }  → HubSpot contact + deals
POST   /api/manual-enroll/sync            { hubspotDealId }

GET    /api/audit-log                     filterable
GET    /api/audit-log/export.csv

GET    /api/metrics                       dashboard counts
```

---

## Dashboard pages

1. **Login** — email + password, JWT in httpOnly cookie
2. **Dashboard** — 5 metric cards (Today, Pending, Success, Failed, Manual Review) + recent 50 enrollments table with filter bar
3. **Enrollment Detail** — tabs (Overview | Payload Sent | Response Received | amp Log | Audit Log); action buttons (Retry, Edit, Skip)
4. **Mappings** — editable `field_mappings` table; inline edit; test button
5. **Providers** — view/edit `lead_providers` (program ID, credential, active toggle)
6. **Aliases** — CRUD on `program_aliases`; critical for new HubSpot values appearing
7. **Manual Enroll** — email search → HubSpot match → preview payload → push
8. **Audit Log** — filter by enrollment, actor, action, date; CSV export

---

## Cron jobs

### `jobs/retryFailed.js` — hourly

Find enrollments where:
- `status = 'failed'`
- `retry_count < 5`
- `updated_at < now() - 15 minutes`
- `error_message` does NOT contain known-permanent phrases ("invalid email", "already exists")

Call `syncEnrollment(dealId, 'retry')` for each.

### `jobs/dailyDigest.js` — daily 8am PT

Slack message to `#infocus-amp-alerts`:
> Last 24h: X synced · Y failed · Z in manual review · W duplicates

---

## File structure

```
/
├── server/
│   ├── index.js
│   ├── db.js
│   ├── logger.js
│   ├── queue.js
│   ├── auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── webhooks.js
│   │   ├── enrollments.js
│   │   ├── mappings.js
│   │   ├── providers.js
│   │   ├── aliases.js
│   │   ├── manualEnroll.js
│   │   └── auditLog.js
│   ├── services/
│   │   ├── ampClient.js
│   │   ├── hubspotClient.js
│   │   ├── syncOrchestrator.js
│   │   ├── webhookValidator.js
│   │   ├── transformers.js
│   │   └── slackNotifier.js
│   ├── jobs/
│   │   ├── retryFailed.js
│   │   └── dailyDigest.js
│   └── migrations/001_init.sql
├── client/
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── lib/api.js
│       ├── components/
│       │   ├── Layout.jsx
│       │   ├── Nav.jsx
│       │   ├── StatusBadge.jsx
│       │   ├── PayloadViewer.jsx
│       │   └── RetryButton.jsx
│       └── pages/
│           ├── Login.jsx
│           ├── Dashboard.jsx
│           ├── EnrollmentDetail.jsx
│           ├── Mappings.jsx
│           ├── Providers.jsx
│           ├── Aliases.jsx
│           ├── ManualEnroll.jsx
│           └── AuditLog.jsx
├── scripts/
│   ├── migrate.js
│   ├── seedAdmin.js
│   └── backfillHistorical.js
├── .env.example
├── .replit
├── package.json
└── README.md
```

---

## Security

- HubSpot webhook v3 signature validated on every request
- amp Lead Provider URLs: set `Restrict to IPs` in each provider's config to Replit's outbound IP (get from Replit docs; we observed `35.224.157.0` during testing)
- JWT expires in 12h
- bcrypt cost factor 12
- Helmet + rate limiting (`/webhooks/*`: 100/min; `/api/*`: 1000/min)
- CORS locked to APP_BASE_URL in production
- PII stays in Replit Postgres (Canadian region for PIPEDA)
- Never log full PII payloads in production — only IDs and statuses

---

## First-run checklist

1. `npm install` (root + /client)
2. Set all env vars in Replit Secrets
3. `npm run migrate`
4. `npm run seed:admin` — creates first admin user from ADMIN_EMAIL
5. **In HubSpot:** create the 8 `amp_*` custom contact properties (see above)
6. **In HubSpot:** build workflow "Deal → stage change to Closed Won" → action "Webhook → POST to `{APP_BASE_URL}/webhooks/hubspot`"
7. **In amp:** for each Lead Provider, add Replit outbound IP to `Restrict to IPs`
8. **Test with Film Production:**
   - Create a test HubSpot deal with a test contact
   - Flip deal stage to Closed Won
   - Verify dashboard shows success + Student ID appears on HubSpot contact
9. Monitor for 48h, tune field mappings via UI
10. Enable for all 7 programs once comfortable

---

## Roadmap

### v1 (this build) — Lead Bridge
- HubSpot Closed Won → amp prospect + student created with `autoEnroll=true`
- Student ID written back to HubSpot
- Staff manually completes program enrollment in amp

### v2 — Enrollment Bridge (future)
- Add amp REST API client (`/api/student/program/add`)
- Second API call after Lead Provider POST to fully enroll in program/session/intake
- Requires amp API key + session/intake lookup tables
- Requires validation that `/api/student/program/add` works (never tested)

### v3 — Bi-directional sync (future)
- amp → HubSpot webhooks for student updates (grade, attendance, etc.)
- Lifecycle stage updates in HubSpot based on amp events

---

## Known constraints / accepted compromises (v1)

- **Student IDs are sequential** (`000423`) not program-prefixed (`FP20261941`). Acceptable.
- **Prospect lead stage stays as "Lead"** after auto-enroll. Staff manually advances.
- **No program/session/intake auto-assignment.** Staff handles in amp UI.
- **`interested` field may trigger "not configured" warnings.** Harmless; amp still processes.
- **Two Film Production programs exist** (ID 7 Legacy, ID 13 current). All HubSpot values route to ID 13 only.
- **No reverse sync from amp.** If an admissions staff member manually rejects a student, HubSpot won't know. Out of scope for v1.

---

**End of spec. This reflects the fully validated architecture as of 2026-04-21.**
