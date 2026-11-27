CREATE TABLE tickets (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES events (id),
  participant_id text REFERENCES users (id),
  buyer_email text NOT NULL,
  code text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('pending', 'confirmed', 'declined', 'cancelled', 'refunded')),
  price_cents integer NOT NULL CHECK (price_cents > 0),
  checked_in boolean NOT NULL DEFAULT false,
  checked_in_at timestamptz,
  channel text NOT NULL CHECK (channel IN ('storefront', 'partner')),
  gateway_outcome text NOT NULL CHECK (gateway_outcome IN ('approved', 'declined')),
  gateway_due_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tickets_event_status_idx ON tickets (event_id, status);
CREATE INDEX tickets_participant_idx ON tickets (participant_id);
CREATE INDEX tickets_due_idx ON tickets (gateway_due_at) WHERE status = 'pending';
