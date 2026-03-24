

# Plan: Fix product index mismatch between menu and cart

## Problem

The menu (`ver_menu_negocio`, line 919) fetches products **without** sorting, so items display in default DB insertion order. But the shopping interceptor (line 240) fetches products with `.order("name")` (alphabetical). When the user types "4" to select item 4 from the menu, the interceptor resolves it against the alphabetically-sorted list — returning a different product.

In the screenshot: menu shows item 4 = "Sundae Especial", but the bot added "Helado de Vainilla" (which is likely #4 alphabetically).

## Fix

One line change — remove `.order("name")` from the shopping interceptor (line 240) so both queries use the same default DB order. This ensures index 4 in the interceptor matches index 4 in the displayed menu.

| File | Line | Change |
|------|------|--------|
| `vendor-bot.ts` | 240 | Remove `.order("name")` |

## Result

When the user types "4", they get item 4 as shown in the menu.

