-- Allow vendors to create support tickets
CREATE POLICY "Vendors can create support tickets"
ON support_tickets
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM vendors
    WHERE vendors.user_id = auth.uid()
    AND vendors.phone = support_tickets.customer_phone
  )
);

-- Allow vendors to view their own support tickets
CREATE POLICY "Vendors can view their own tickets"
ON support_tickets
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM vendors
    WHERE vendors.user_id = auth.uid()
    AND vendors.phone = support_tickets.customer_phone
  )
);

-- Allow vendors to insert their own support messages
CREATE POLICY "Vendors can create messages on their tickets"
ON support_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM support_tickets st
    JOIN vendors v ON v.phone = st.customer_phone
    WHERE st.id = support_messages.ticket_id
    AND v.user_id = auth.uid()
    AND support_messages.sender_type = 'customer'
  )
);

-- Allow vendors to view messages on their tickets
CREATE POLICY "Vendors can view their ticket messages"
ON support_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM support_tickets st
    JOIN vendors v ON v.phone = st.customer_phone
    WHERE st.id = support_messages.ticket_id
    AND v.user_id = auth.uid()
  )
);