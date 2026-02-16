
# Corregir ofertas que no se muestran al cliente

## Problema encontrado

En los logs se ve claramente el error:

```
[TOOL CALL] ver_ofertas { "vendor_id": "Tienda 24hs" }
```

La IA del bot esta pasando el **nombre** del negocio ("Tienda 24hs") en vez del **UUID** (`06edca8b-648b-43dc-946e-ec61bef5575a`). Luego el codigo filtra `vendor_id = 'Tienda 24hs'` en la base de datos, que obviamente no encuentra nada.

## Solucion

Modificar `ver_ofertas` en `vendor-bot.ts` para que:

1. **Priorice el `context.selected_vendor_id`** (que siempre tiene el UUID correcto) sobre `args.vendor_id`
2. **Si `args.vendor_id` no es un UUID valido**, intente buscar el vendor por nombre para obtener su UUID real

### Cambios en `supabase/functions/evolution-webhook/vendor-bot.ts` (lineas 1626-1627)

Antes:
```typescript
const targetVendorId = args.vendor_id || context.selected_vendor_id;
```

Despues:
```typescript
let targetVendorId = context.selected_vendor_id;

// Si la IA paso un vendor_id, verificar si es UUID valido o nombre
if (args.vendor_id && !context.selected_vendor_id) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(args.vendor_id)) {
    targetVendorId = args.vendor_id;
  } else {
    // Buscar por nombre
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id")
      .ilike("name", args.vendor_id)
      .maybeSingle();
    if (vendor) targetVendorId = vendor.id;
  }
}
```

### Tambien mejorar la descripcion del tool en `tools-definitions.ts` (linea 295)

Cambiar la descripcion del parametro para guiar mejor a la IA:

```
description: "UUID del negocio (opcional). Debe ser un UUID, no el nombre. Si no se especifica, usa el negocio del contexto actual."
```

### Despliegue
- Redesplegar la edge function `evolution-webhook`
