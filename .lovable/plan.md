

# Fix: Cancellation flow blocked by keyword filter

## Problem

The "new order keywords" validation (line 2885) runs BEFORE the `pending_cancellation` handler (line 2983). So when the user writes "Quiero pedir otra cosa" as a cancellation reason, it matches "quiero pedir" and gets blocked with "Ya tenes un pedido activo" before the cancellation handler ever sees it.

## Solution

Add a simple bypass: skip the `newOrderKeywords` block when `context.pending_cancellation` is active.

## Technical change

### File: `supabase/functions/evolution-webhook/vendor-bot.ts` (~line 2893)

Change the condition from:

```
if (wantsNewOrder) {
```

To:

```
if (wantsNewOrder && !context.pending_cancellation) {
```

This way, when the user is in the cancellation flow, the keyword filter is skipped and the message reaches the `pending_cancellation` handler at line 2983.

### Deployment

Redeploy `evolution-webhook`.

