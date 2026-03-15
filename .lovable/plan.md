

## Plan: Replace remaining inline ternary translations with `t()` calls

### Problem
While i18n coverage is already extensive (~150+ keys), there are ~15 inline `lang === 'es' ? ... : lang === 'en' ? ...` ternary patterns scattered across `tool-handlers.ts` and `vendor-bot.ts`. These are verbose, inconsistent, and sometimes miss languages (e.g., using `'Holder'` for both EN and PT).

### Changes

**1. `i18n.ts` — Add ~12 new label keys**

New keys for frequently repeated inline labels:
- `label.order` → "Pedido" / "Order" / "Pedido" / "注文"
- `label.payment` → "Pago" / "Payment" / "Pagamento" / "支払い"
- `label.payment_method` → "Método de pago" / "Payment method" / "Método de pagamento" / "支払い方法"
- `label.delivery_label` → "Entrega" / "Delivery" / "Entrega" / "配送"
- `label.address` → "Dirección" / "Address" / "Endereço" / "住所"
- `label.store` → "Negocio" / "Store" / "Loja" / "店舗"
- `label.status` → "Estado" / "Status" / "Status" / "状態"
- `label.your_rating` → "Tu calificación" / "Your rating" / "Sua avaliação" / "あなたの評価"
- `label.account_holder` → "Titular" / "Account holder" / "Titular" / "名義人"
- `label.amount` → "Monto" / "Amount" / "Valor" / "金額"
- `label.bank_transfer` → "Transferencia bancaria" / "Bank transfer" / "Transferência bancária" / "銀行振込"
- `label.cash` → "Efectivo" / "Cash" / "Dinheiro" / "現金"

**2. `tool-handlers.ts` — Replace all inline ternaries with `t()`**

Affected lines (approximately):
- L594-595: `ver_carrito` delivery/payment labels
- L673: `mostrar_resumen_pedido` payment method label
- L1032: `crear_pedido` order number label
- L1041, L1047: payment/address labels
- L1071: account holder label
- L1097-1099: MP fallback transfer/cash labels
- L1159-1161: `ver_estado_pedido` order/store/status labels
- L1216: `ver_ofertas` store ID label
- L1324, L1329, L1333: `ver_metodos_pago` cash/transfer/holder labels
- L1396: `seleccionar_metodo_pago` payment method label
- L1509: `calificar_plataforma` rating label

**3. `vendor-bot.ts` — Replace inline ternaries with `t()`**

Affected lines:
- L409-411: MP fallback transfer/cash labels (same pattern as tool-handlers)

### Scope
- 3 files modified: `i18n.ts`, `tool-handlers.ts`, `vendor-bot.ts`
- ~12 new i18n keys (small labels)
- ~15 inline replacements
- No logic changes, no new features
- Edge function redeploy after changes

