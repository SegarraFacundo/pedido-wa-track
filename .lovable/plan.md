

# Plan: Fix QA Test Runner - "(sin respuesta)" Bug

## Root Cause

All 24 tests fail with "(sin respuesta)" due to **two bugs in the QA test runner**, not in the bot itself. The edge function logs confirm the bot IS processing messages and generating responses correctly.

### Bug 1: Phone normalization mismatch
The QA tester sends messages with `remoteJid: "qa_test_1774113038309"`, but `normalizeArgentinePhone()` strips the `qa_test_` prefix, storing the session under phone `"1774113038309"`. The tester then queries `user_sessions` with `phone = "qa_test_1774113038309"` -- which doesn't match.

### Bug 2: RLS blocks admin reads
The `user_sessions` table only allows reads by `service_role` or vendors with active orders. The admin's authenticated client can't read the bot's response from this table.

## Fix

Modify `BotQATester.tsx` `runTest()` to:

1. **Extract the normalized phone** by applying the same normalization logic (strip `qa_test_` prefix, keep only digits) so the session lookup matches
2. **Use `bot_interaction_logs` instead of `user_sessions`** to read bot responses -- this table has admin SELECT RLS already enabled, and stores `response_preview` for every bot interaction
3. **Increase wait time** from 2s to 4s to account for debounce (2s) + AI processing time
4. **Fix cleanup** to use the normalized phone for deletion

## Files to modify

| File | Change |
|------|--------|
| `src/components/admin/BotQATester.tsx` | Fix `runTest()` response retrieval logic |

## Technical Detail

Replace the `user_sessions` lookup with a query to `bot_interaction_logs`:

```typescript
// After sending message, wait longer for debounce + processing
await new Promise(r => setTimeout(r, 5000));

// Read response from bot_interaction_logs (admin has RLS access)
const { data: logData } = await supabase
  .from("bot_interaction_logs")
  .select("response_preview, intent_detected, confidence, error")
  .eq("phone", normalizedPhone)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (logData?.response_preview) {
  botResponse = logData.response_preview;
}
```

The normalized phone is derived by stripping the `qa_test_` prefix:
```typescript
const normalizedPhone = testPhone.replace(/^qa_test_/, "");
```

Cleanup also uses the normalized phone for both tables.

