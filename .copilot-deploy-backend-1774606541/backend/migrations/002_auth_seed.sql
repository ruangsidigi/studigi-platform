-- 002_auth_seed.sql
BEGIN;

INSERT INTO roles (id, name, description)
VALUES
  (uuid_generate_v4(), 'admin', 'Administrator with full access'),
  (uuid_generate_v4(), 'participant', 'End user participant')
ON CONFLICT (name) DO NOTHING;

COMMIT;
