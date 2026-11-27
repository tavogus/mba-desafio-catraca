CREATE TABLE users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('organizer', 'participant')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_lower CHECK (email = lower(email))
);

CREATE TABLE sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE partner_keys (
  id text PRIMARY KEY,
  name text NOT NULL,
  api_key text NOT NULL UNIQUE
);
