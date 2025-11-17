import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import type { ConversationContext } from "./types.ts";
import { getContext, saveContext } from "./context.ts";

// Mock Supabase client for testing
const createMockSupabase = () => {
  let storage: Map<string, any> = new Map();
  
  return {
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: any) => ({
          maybeSingle: async () => {
            const data = storage.get(value);
            return { data: data || null, error: null };
          },
        }),
      }),
      upsert: async (data: any) => {
        storage.set(data.phone, data);
        return { data, error: null };
      },
    }),
    // Helper to inspect storage
    _getStorage: () => storage,
  };
};

Deno.test("INTEGRATION: Complete conversation flow - Add to cart and verify persistence", async () => {
  const mockSupabase = createMockSupabase();
  const testPhone = "5493464448309";

  console.log("\n🧪 TEST: Complete conversation flow");

  // Step 1: User starts conversation
  console.log("\n📍 Step 1: Initialize conversation");
  let context = await getContext(testPhone, mockSupabase);
  assertEquals(context.phone, testPhone);
  assertEquals(context.cart, []);
  console.log("✅ Context initialized");

  // Step 2: Simulate selecting a vendor (ver_menu_negocio)
  console.log("\n📍 Step 2: Select vendor and view menu");
  context.selected_vendor_id = "vendor-123";
  context.selected_vendor_name = "Heladería Italiana";
  context.conversation_history.push(
    { role: "user", content: "quiero helados" },
    { role: "assistant", content: "Te muestro las heladerías disponibles..." }
  );
  await saveContext(context, mockSupabase);
  console.log("✅ Vendor selected and saved");

  // Step 3: Reload context to simulate new request
  console.log("\n📍 Step 3: Reload context (simulate new request)");
  context = await getContext(testPhone, mockSupabase);
  assertEquals(context.selected_vendor_id, "vendor-123");
  assertEquals(context.selected_vendor_name, "Heladería Italiana");
  console.log("✅ Context persisted correctly");

  // Step 4: Add items to cart
  console.log("\n📍 Step 4: Add items to cart");
  context.cart.push(
    {
      product_id: "prod-1",
      product_name: "Helado de Chocolate",
      quantity: 1,
      price: 8000,
    },
    {
      product_id: "prod-2",
      product_name: "Helado de Frutilla",
      quantity: 2,
      price: 8000,
    }
  );
  context.conversation_history.push(
    { role: "user", content: "uno de chocolate y dos de frutilla" },
    { role: "assistant", content: "Agregué los productos al carrito" }
  );
  await saveContext(context, mockSupabase);
  console.log("✅ Cart items added and saved");

  // Step 5: Reload context again to verify cart persistence
  console.log("\n📍 Step 5: Reload context to verify cart");
  context = await getContext(testPhone, mockSupabase);
  assertEquals(context.cart.length, 2);
  assertEquals(context.cart[0].product_name, "Helado de Chocolate");
  assertEquals(context.cart[1].product_name, "Helado de Frutilla");
  assertEquals(context.cart[1].quantity, 2);
  assertEquals(context.selected_vendor_id, "vendor-123");
  console.log("✅ Cart persisted correctly");

  // Step 6: Confirm order
  console.log("\n📍 Step 6: User confirms order");
  context.conversation_history.push(
    { role: "user", content: "sí, confirmo" },
    { role: "assistant", content: "¿Cuál es tu dirección?" }
  );
  await saveContext(context, mockSupabase);

  // Step 7: Final verification
  console.log("\n📍 Step 7: Final verification");
  context = await getContext(testPhone, mockSupabase);
  assertEquals(context.cart.length, 2, "Cart should still have 2 items");
  assertEquals(context.selected_vendor_id, "vendor-123", "Vendor ID should be preserved");
  assertExists(context.cart[0].product_id, "Product ID should exist");
  console.log("✅ Full conversation flow completed successfully");
  
  console.log("\n✅ TEST PASSED: Cart and vendor context persist across multiple requests");
});

Deno.test("INTEGRATION: Context should survive multiple save/load cycles", async () => {
  const mockSupabase = createMockSupabase();
  const testPhone = "5493464123456";

  console.log("\n🧪 TEST: Multiple save/load cycles");

  // Initial setup
  let context = await getContext(testPhone, mockSupabase);
  context.selected_vendor_id = "vendor-456";
  context.selected_vendor_name = "Pizzería Test";
  context.cart.push({
    product_id: "pizza-1",
    product_name: "Pizza Napolitana",
    quantity: 1,
    price: 15000,
  });

  // Cycle 1: Save and load
  await saveContext(context, mockSupabase);
  context = await getContext(testPhone, mockSupabase);
  assertEquals(context.cart.length, 1);
  assertEquals(context.selected_vendor_id, "vendor-456");

  // Cycle 2: Add more items, save and load
  context.cart.push({
    product_id: "pizza-2",
    product_name: "Pizza Mozzarella",
    quantity: 2,
    price: 12000,
  });
  await saveContext(context, mockSupabase);
  context = await getContext(testPhone, mockSupabase);
  assertEquals(context.cart.length, 2);
  assertEquals(context.selected_vendor_id, "vendor-456");

  // Cycle 3: Add delivery address, save and load
  context.delivery_address = "Calle Falsa 123";
  context.user_latitude = -33.0325308;
  context.user_longitude = -61.1750395;
  await saveContext(context, mockSupabase);
  context = await getContext(testPhone, mockSupabase);
  assertEquals(context.cart.length, 2);
  assertEquals(context.delivery_address, "Calle Falsa 123");
  assertEquals(context.selected_vendor_id, "vendor-456");

  console.log("✅ TEST PASSED: Context survives multiple save/load cycles");
});

Deno.test("INTEGRATION: Empty cart should be detected correctly", async () => {
  const mockSupabase = createMockSupabase();
  const testPhone = "5493464789012";

  console.log("\n🧪 TEST: Empty cart detection");

  let context = await getContext(testPhone, mockSupabase);
  assertEquals(context.cart.length, 0);
  
  // Add vendor but no items
  context.selected_vendor_id = "vendor-789";
  context.selected_vendor_name = "Empanadas Test";
  await saveContext(context, mockSupabase);
  
  // Reload and verify cart is still empty
  context = await getContext(testPhone, mockSupabase);
  assertEquals(context.cart.length, 0);
  assertEquals(context.selected_vendor_id, "vendor-789");
  
  console.log("✅ TEST PASSED: Empty cart detected correctly");
});

Deno.test("INTEGRATION: Cart should clear when starting new order", async () => {
  const mockSupabase = createMockSupabase();
  const testPhone = "5493464555666";

  console.log("\n🧪 TEST: Cart clearing for new order");

  // First order
  let context = await getContext(testPhone, mockSupabase);
  context.selected_vendor_id = "vendor-1";
  context.cart.push({
    product_id: "prod-1",
    product_name: "Product 1",
    quantity: 1,
    price: 5000,
  });
  await saveContext(context, mockSupabase);

  // Start new order (clear cart manually as the bot would do)
  context = await getContext(testPhone, mockSupabase);
  context.cart = [];
  context.selected_vendor_id = undefined;
  context.selected_vendor_name = undefined;
  await saveContext(context, mockSupabase);

  // Verify cart is cleared
  context = await getContext(testPhone, mockSupabase);
  assertEquals(context.cart.length, 0);
  assertEquals(context.selected_vendor_id, undefined);

  console.log("✅ TEST PASSED: Cart cleared successfully for new order");
});
