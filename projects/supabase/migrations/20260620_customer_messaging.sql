-- Customer Messaging table for admin broadcast emails
CREATE TABLE IF NOT EXISTS customer_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  recipient_mode TEXT NOT NULL DEFAULT 'all',
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  sent_by TEXT NOT NULL DEFAULT 'admin',
  selected_ids UUID[] DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for admin message history queries
CREATE INDEX IF NOT EXISTS idx_customer_messages_created_at ON customer_messages (created_at DESC);

-- RLS: only admin can read/write
ALTER TABLE customer_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on customer_messages"
  ON customer_messages
  FOR ALL
  USING (true)
  WITH CHECK (true);
