
# Reemplazar confirm() nativos por AlertDialog

## Archivos a modificar

### 1. `src/components/VendorOffersManager.tsx`
- Agregar import de `AlertDialog` y sus subcomponentes
- Agregar estados `deleteDialogOpen` y `offerToDelete`
- Reemplazar el `confirm()` en `handleDeleteOffer` por un flujo de dialog: una funcion `requestDelete` que abre el dialog, y `confirmDelete` que ejecuta la eliminacion
- Agregar el componente `AlertDialog` al final del JSX con mensaje "Esta accion no se puede deshacer"

### 2. `src/components/VendorProductManager.tsx`
- Mismo patron: import de `AlertDialog`, estados `deleteDialogOpen` y `productToDelete`
- Reemplazar el `confirm()` en `handleDeleteProduct` por `requestDeleteProduct` + `confirmDeleteProduct`
- Agregar el `AlertDialog` al final del JSX

## Patron a seguir

Exactamente el mismo que ya se implemento en `VendorDirectChat.tsx`:

```
const [dialogOpen, setDialogOpen] = useState(false);
const [itemToDelete, setItemToDelete] = useState<string | null>(null);

const requestDelete = (id: string) => {
  setItemToDelete(id);
  setDialogOpen(true);
};

const confirmDelete = async () => {
  if (!itemToDelete) return;
  setDialogOpen(false);
  // ...logica de eliminacion existente...
  setItemToDelete(null);
};
```

Con estos 2 archivos se eliminan todos los `confirm()` nativos restantes del proyecto.
