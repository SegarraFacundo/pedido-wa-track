

## Plan: Translate vendor dashboard notifications to customer's language

### Problem
When vendors change order status from their dashboard, all WhatsApp notifications sent to customers are hardcoded in Spanish (e.g., "Tu pedido #... confirmado. El vendedor está preparando tu pedido."). The customer's language preference is stored in `user_sessions.last_bot_message` JSON (`language` field), but it's never read by the frontend notification code.

### Approach
Create a new edge function `translate-customer-notification` that:
1. Receives the customer phone, notification type, and dynamic data (order ID, status, reason, etc.)
2. Reads the customer's `language` from `user_sessions.last_bot_message`
3. Returns the translated message using a server-side translation dictionary

This avoids exposing `user_sessions` data to the frontend and centralizes all customer notification translations.

### Changes

**1. New edge function: `supabase/functions/translate-customer-notification/index.ts`**

- Accepts: `{ phoneNumber, notificationType, data }` where `notificationType` is one of: `status_confirmed`, `status_preparing`, `status_ready`, `status_ready_pickup`, `status_delivering`, `status_delivered`, `status_cancelled`, `payment_confirmed`, `payment_problem`, `cancellation`, `bot_active`, `bot_paused`, `vendor_message`, `delivered_rating`
- Looks up `user_sessions` by phone to get the customer's language
- Contains a translation dictionary for all notification messages in ES/EN/PT/JA
- Returns the formatted, translated message string
- The frontend calls this function before sending the WhatsApp notification

**2. Update `supabase/config.toml`** — add `[functions.translate-customer-notification]` with `verify_jwt = false`

**3. Update `src/hooks/useRealtimeOrders.ts`** (~lines 252-305)
- Before building `notificationMessage`, call `translate-customer-notification` with the customer phone and status type
- Use the returned translated message instead of the hardcoded Spanish strings
- Includes the delivered/rating prompt translation

**4. Update `src/components/OrderCard.tsx`** (~lines 137-178)
- Replace hardcoded Spanish payment confirmation and payment problem messages with calls to the translation function

**5. Update `src/components/OrderCancellationDialog.tsx`** (~line 72)
- Replace hardcoded cancellation message

**6. Update `src/hooks/useRealtimeMessages.ts`** (~lines 59, 197, 209)
- Replace bot active/paused and vendor message notifications

**7. Update `src/components/VendorDirectChat.tsx`** (~lines 313, 389, 451)
- Replace bot active and vendor message notifications

### Translation dictionary (all 4 languages)
Covers ~14 notification types with interpolation for order ID, vendor name, reason, etc.

### Scope
- 1 new edge function
- 5 existing files updated (frontend)
- 1 config file updated
- No database changes needed (language already stored in user_sessions)

