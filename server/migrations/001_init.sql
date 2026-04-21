CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS enrollments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hubspot_deal_id       TEXT UNIQUE NOT NULL,
  hubspot_contact_id    TEXT NOT NULL,
  amp_prospect_id       TEXT,
  amp_student_id        TEXT,
  amp_student_key       TEXT,
  amp_provider_id       TEXT,
  resolved_program_id   INT,
  resolved_program_code TEXT,
  status                TEXT NOT NULL CHECK (status IN
    ('pending','in_progress','success','failed','manual_review','skipped','duplicate')),
  student_email         TEXT NOT NULL,
  student_name          TEXT,
  program_name          TEXT,
  payload_sent          JSONB,
  response_received     JSONB,
  amp_log               TEXT,
  error_message         TEXT,
  retry_count           INT DEFAULT 0,
  triggered_by          TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  completed_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_email ON enrollments(student_email);
CREATE INDEX IF NOT EXISTS idx_enrollments_created ON enrollments(created_at DESC);

CREATE TABLE IF NOT EXISTS lead_providers (
  id                  SERIAL PRIMARY KEY,
  program_code        TEXT UNIQUE NOT NULL,
  program_label       TEXT NOT NULL,
  amp_provider_id     TEXT NOT NULL,
  amp_program_id      INT NOT NULL,
  credential          TEXT NOT NULL CHECK (credential IN ('Diploma','Certificate','Other')),
  active              BOOLEAN DEFAULT TRUE,
  notes               TEXT
);

CREATE TABLE IF NOT EXISTS program_aliases (
  id              SERIAL PRIMARY KEY,
  hubspot_value   TEXT NOT NULL,
  program_code    TEXT NOT NULL REFERENCES lead_providers(program_code) ON UPDATE CASCADE,
  active          BOOLEAN DEFAULT TRUE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_program_aliases_value_lower
  ON program_aliases (lower(hubspot_value));

CREATE TABLE IF NOT EXISTS field_mappings (
  id              SERIAL PRIMARY KEY,
  hubspot_field   TEXT NOT NULL,
  amp_field       TEXT NOT NULL,
  transform       TEXT,
  default_value   TEXT,
  is_required     BOOLEAN DEFAULT FALSE,
  active          BOOLEAN DEFAULT TRUE,
  notes           TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id              BIGSERIAL PRIMARY KEY,
  enrollment_id   UUID REFERENCES enrollments(id) ON DELETE CASCADE,
  action          TEXT NOT NULL,
  actor           TEXT,
  details         JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_enrollment ON audit_log(enrollment_id);

CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  role            TEXT DEFAULT 'staff' CHECK (role IN ('admin','staff','viewer')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEED DATA (verified against InFocus amp instance 2026-04-21)
-- ============================================================

INSERT INTO lead_providers (program_code, program_label, amp_provider_id, amp_program_id, credential, notes) VALUES
  ('FP',       'Film Production',                             'Application_Film',         13, 'Diploma',    'v2 current; Legacy v1 = ID 7, not routed'),
  ('3DA',      '3D Animation',                                'Application_3D',            4, 'Diploma',    '48 weeks, 1100 hours'),
  ('DFP',      'Documentary Film',                            'Application_Documentary',   5, 'Diploma',    '33 weeks, 660 hours'),
  ('GM',       'Game Design',                                 'Application_Game',         11, 'Diploma',    '33 weeks, 633 hours'),
  ('GR',       'Graphic and Digital Design',                  'Application_Graphic',       9, 'Diploma',    '26 weeks, 520 hours'),
  ('COMP',     'Visual Effects Compositing Certificate',      'Application_COMP',          6, 'Certificate','24 weeks, 537 hours'),
  ('VFX',      'VFX Compositing Diploma',                     'Application_VFX',          12, 'Diploma',    'Provider created 2026-04-21'),
  ('WR',       'Writing for Film and Television',             'Application_Writing',       1, 'Diploma',    '30 weeks, 600 hours'),
  ('WR-CERT',  'Writing for Film and Television Certificate', 'Application_Writing',      14, 'Certificate','30 weeks, 627 hours; same provider as WR')
ON CONFLICT (program_code) DO NOTHING;

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
  ('WR Certificate',                               'WR-CERT')
ON CONFLICT DO NOTHING;

INSERT INTO field_mappings (hubspot_field, amp_field, transform, is_required, notes) VALUES
  ('firstname',        'firstName',         'trim',         TRUE,  'Required by amp'),
  ('lastname',         'lastName',          'trim',         TRUE,  'Required by amp'),
  ('email',            'email',             'lowercase',    TRUE,  'Required; must be valid format'),
  ('phone',            'mobilePhone',       'phone_raw',    FALSE, 'Digits only; amp formats internally'),
  ('mobilephone',      'mobilePhone',       'phone_raw',    FALSE, 'Fallback if phone empty'),
  ('address',          'addressOne',        'trim',         FALSE, NULL),
  ('city',             'city',              'trim',         FALSE, NULL),
  ('state',            'province',          'uppercase',    FALSE, NULL),
  ('zip',              'postalCode',        'trim',         FALSE, NULL),
  ('country',          'country',           'country_iso2', FALSE, 'Must be 2-letter ISO; defaults CA'),
  ('date_of_birth',    'dateofBirth',       'date_iso',     FALSE, 'yyyy-mm-dd format'),
  ('gender',           'gender',            'trim',         FALSE, NULL);

INSERT INTO field_mappings (hubspot_field, amp_field, default_value, is_required, notes) VALUES
  ('scholarship_amount',   'customField9',   'N/A',   TRUE,  'Scholarship is required in amp'),
  ('citizenship',          'customField3',   'TBC',   TRUE,  'Citizenship is required in amp'),
  ('study_permit',         'customField2',   'TBC',   TRUE,  'Study Permit is required in amp');

INSERT INTO field_mappings (hubspot_field, amp_field, default_value, is_required, notes) VALUES
  ('__fixed__',            'autoEnroll',          'true', FALSE, 'Always auto-enroll to student'),
  ('__fixed__',            'mobilePhoneCountry',  'CA',   FALSE, 'Default to CA country code'),
  ('__fixed__',            'leadSourceCode',      'WEB',  FALSE, 'HubSpot funnel = website category');
