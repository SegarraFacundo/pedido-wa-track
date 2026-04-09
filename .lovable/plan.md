

# Plan: When user says "ver menú" after a search with 1 result, show that vendor's menu

## Problem
After searching "helado" and getting 1 result (Heladería Italiana), the user says "Quiero ver todo el menú". The `wantsVendorList` regex on line 4551 catches `ver.*menú` and triggers `ver_locales_abiertos`, ignoring that there's a single vendor in the search results.

## Fix

In `vendor-bot.ts` line ~4553, before calling `ver_locales_abiertos`, check if `available_vendors_map` has exactly 1 vendor. If so, show that vendor's menu instead of the full vendor list.

```
if (wantsVendorList) {
  // If there's exactly 1 vendor from a recent search, show its menu
  if (context.available_vendors_map?.length === 1) {
    const singleVendor = context.available_vendors_map[0];
    const result = await ejecutarHerramienta("ver_menu_negocio", {
      vendor_id: String(singleVendor.index),
    }, context, supabase);
    ...
    return result;
  }
  // Otherwise show all vendors
  const result = await ejecutarHerramienta("ver_locales_abiertos", ...);
  ...
}
```

## File

| File | Line | Change |
|------|------|--------|
| `vendor-bot.ts` | ~4553 | Add single-vendor shortcut before `ver_locales_abiertos` call |

## Result
"Quiero ver todo el menú" after a single-result search will show that vendor's full menu instead of the vendor list.

