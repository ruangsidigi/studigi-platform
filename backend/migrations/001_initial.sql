-- 001_initial.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create user_roles using same type as users.id to avoid FK type mismatch
DO $$
DECLARE uid_type TEXT;
BEGIN
  -- use udt_name to get the underlying type (uuid, int8, etc.)
  SELECT udt_name INTO uid_type FROM information_schema.columns
    WHERE table_name='users' AND column_name='id' LIMIT 1;
  IF uid_type IS NULL THEN
    uid_type := 'uuid';
  ELSIF uid_type = 'int8' THEN
    uid_type := 'bigint';
  ELSIF uid_type = 'int4' THEN
    uid_type := 'integer';
  ELSIF uid_type = 'varchar' THEN
    uid_type := 'text';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='user_roles') THEN
    EXECUTE format(
      'CREATE TABLE user_roles (user_id %s REFERENCES users(id) ON DELETE CASCADE, role_id UUID REFERENCES roles(id) ON DELETE CASCADE, PRIMARY KEY (user_id, role_id))',
      uid_type
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'IDR',
  type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS bundles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'IDR',
  published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create bundle_packages using underlying types of bundles.id and packages.id
DO $$
DECLARE b_type TEXT; p_type TEXT; b_sql TEXT;
BEGIN
  SELECT udt_name INTO b_type FROM information_schema.columns WHERE table_name='bundles' AND column_name='id' LIMIT 1;
  SELECT udt_name INTO p_type FROM information_schema.columns WHERE table_name='packages' AND column_name='id' LIMIT 1;
  IF b_type IS NULL THEN b_type := 'uuid'; ELSIF b_type='int8' THEN b_type:='bigint'; ELSIF b_type='int4' THEN b_type:='integer'; ELSIF b_type='varchar' THEN b_type:='text'; END IF;
  IF p_type IS NULL THEN p_type := 'uuid'; ELSIF p_type='int8' THEN p_type:='bigint'; ELSIF p_type='int4' THEN p_type:='integer'; ELSIF p_type='varchar' THEN p_type:='text'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='bundle_packages') THEN
    b_sql := format('CREATE TABLE bundle_packages (bundle_id %s REFERENCES bundles(id) ON DELETE CASCADE, package_id %s REFERENCES packages(id) ON DELETE CASCADE, PRIMARY KEY (bundle_id, package_id))', b_type, p_type);
    EXECUTE b_sql;
  END IF;
END$$;

-- Create materials; ensure created_by column matches users.id type
DO $$
DECLARE uid_type TEXT;
BEGIN
  SELECT udt_name INTO uid_type FROM information_schema.columns
    WHERE table_name='users' AND column_name='id' LIMIT 1;
  IF uid_type IS NULL THEN
    uid_type := 'uuid';
  ELSIF uid_type = 'int8' THEN
    uid_type := 'bigint';
  ELSIF uid_type = 'int4' THEN
    uid_type := 'integer';
  ELSIF uid_type = 'varchar' THEN
    uid_type := 'text';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='materials') THEN
    EXECUTE format(
      'CREATE TABLE materials (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), title TEXT NOT NULL, storage_key TEXT NOT NULL, storage_bucket TEXT, mime_type TEXT, size_bytes BIGINT, published BOOLEAN DEFAULT FALSE, created_by %s REFERENCES users(id), created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), deleted_at TIMESTAMP WITH TIME ZONE, metadata JSONB)',
      uid_type
    );
  END IF;
END$$;

-- Create bundle_materials using underlying types of bundles.id and materials.id
DO $$
DECLARE b_type TEXT; m_type TEXT; bm_sql TEXT;
BEGIN
  SELECT udt_name INTO b_type FROM information_schema.columns WHERE table_name='bundles' AND column_name='id' LIMIT 1;
  SELECT udt_name INTO m_type FROM information_schema.columns WHERE table_name='materials' AND column_name='id' LIMIT 1;
  IF b_type IS NULL THEN b_type := 'uuid'; ELSIF b_type='int8' THEN b_type:='bigint'; ELSIF b_type='int4' THEN b_type:='integer'; ELSIF b_type='varchar' THEN b_type:='text'; END IF;
  IF m_type IS NULL THEN m_type := 'uuid'; ELSIF m_type='int8' THEN m_type:='bigint'; ELSIF m_type='int4' THEN m_type:='integer'; ELSIF m_type='varchar' THEN m_type:='text'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='bundle_materials') THEN
    bm_sql := format('CREATE TABLE bundle_materials (bundle_id %s REFERENCES bundles(id) ON DELETE CASCADE, material_id %s REFERENCES materials(id) ON DELETE CASCADE, PRIMARY KEY (bundle_id, material_id))', b_type, m_type);
    EXECUTE bm_sql;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content JSONB,
  targeting JSONB,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS branding_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  logo_key TEXT,
  header_color TEXT DEFAULT '#0b5fff',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create purchases; ensure user_id matches users.id type
DO $$
DECLARE uid_type TEXT;
BEGIN
  SELECT udt_name INTO uid_type FROM information_schema.columns
    WHERE table_name='users' AND column_name='id' LIMIT 1;
  IF uid_type IS NULL THEN
    uid_type := 'uuid';
  ELSIF uid_type = 'int8' THEN
    uid_type := 'bigint';
  ELSIF uid_type = 'int4' THEN
    uid_type := 'integer';
  ELSIF uid_type = 'varchar' THEN
    uid_type := 'text';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='purchases') THEN
    EXECUTE format(
      'CREATE TABLE purchases (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), user_id %s REFERENCES users(id), bundle_id UUID REFERENCES bundles(id), price_cents INTEGER, currency TEXT, status TEXT, payment_ref TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT now())',
      uid_type
    );
  END IF;
END$$;

-- Create audit_logs; actor_id should match users.id type when possible
DO $$
DECLARE uid_type TEXT;
BEGIN
  SELECT udt_name INTO uid_type FROM information_schema.columns
    WHERE table_name='users' AND column_name='id' LIMIT 1;
  IF uid_type IS NULL THEN
    uid_type := 'uuid';
  ELSIF uid_type = 'int8' THEN
    uid_type := 'bigint';
  ELSIF uid_type = 'int4' THEN
    uid_type := 'integer';
  ELSIF uid_type = 'varchar' THEN
    uid_type := 'text';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='audit_logs') THEN
    EXECUTE format(
      'CREATE TABLE audit_logs (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), actor_id %s, action TEXT NOT NULL, resource_type TEXT, resource_id UUID, before JSONB, after JSONB, created_at TIMESTAMP WITH TIME ZONE DEFAULT now())',
      uid_type
    );
  END IF;
END$$;

COMMIT;
