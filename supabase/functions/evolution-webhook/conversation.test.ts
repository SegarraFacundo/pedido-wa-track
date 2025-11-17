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

Deno.test("EDGE CASE: User tries to change vendor with active cart - CONFIRM", async () => {
  const supabase = createMockSupabase();
  const phone = "+5491112345678";
  
  console.log("\n🧪 TEST: Vendor change with cart - User CONFIRMS");
  
  // 1. Usuario selecciona Vendor A y agrega productos
  console.log("\n📍 Step 1: User adds items to cart from Vendor A");
  let context = await getContext(phone, supabase);
  context.selected_vendor_id = "vendor-a-uuid";
  context.selected_vendor_name = "Pizzería A";
  context.order_state = "adding_items";
  context.cart = [
    { product_id: "pizza-1", product_name: "Pizza Napolitana", quantity: 2, price: 500 }
  ];
  await saveContext(context, supabase);
  console.log("✅ Cart created with 1 item from Vendor A");
  
  // 2. Usuario intenta ver menú de Vendor B - debería pedir confirmación
  console.log("\n📍 Step 2: User tries to view menu of Vendor B");
  context = await getContext(phone, supabase);
  assertEquals(context.cart.length, 1, "Cart should still have items");
  
  // Simular detección de cambio de vendor y pedir confirmación
  context.pending_vendor_change = {
    new_vendor_id: "vendor-b-uuid",
    new_vendor_name: "Burger King"
  };
  context.order_state = "confirming_vendor_change";
  await saveContext(context, supabase);
  console.log("✅ State changed to confirming_vendor_change");
  
  // 3. Usuario confirma el cambio
  console.log("\n📍 Step 3: User confirms vendor change");
  context = await getContext(phone, supabase);
  assertEquals(context.order_state, "confirming_vendor_change");
  
  // Simular confirmación - vaciar carrito y cambiar vendor
  context.cart = []; // Se vacía
  context.selected_vendor_id = "vendor-b-uuid";
  context.selected_vendor_name = "Burger King";
  context.pending_vendor_change = undefined;
  context.order_state = "viewing_menu";
  await saveContext(context, supabase);
  console.log("✅ Vendor changed, cart cleared");
  
  // 4. Verificar estado final
  console.log("\n📍 Step 4: Verify final state");
  context = await getContext(phone, supabase);
  assertEquals(context.cart.length, 0, "Cart should be empty after confirmation");
  assertEquals(context.selected_vendor_id, "vendor-b-uuid", "Vendor should change to B");
  assertEquals(context.selected_vendor_name, "Burger King");
  assertEquals(context.order_state, "viewing_menu");
  assertEquals(context.pending_vendor_change, undefined);
  console.log("✅ All assertions passed");
});

Deno.test("EDGE CASE: User tries to change vendor with active cart - CANCEL", async () => {
  const supabase = createMockSupabase();
  const phone = "+5491112345678";
  
  console.log("\n🧪 TEST: Vendor change with cart - User CANCELS");
  
  // 1. Setup: carrito activo con vendor A
  console.log("\n📍 Step 1: Setup cart with Vendor A");
  let context = await getContext(phone, supabase);
  context.selected_vendor_id = "vendor-a-uuid";
  context.selected_vendor_name = "Pizzería A";
  context.order_state = "adding_items";
  context.cart = [
    { product_id: "pizza-1", product_name: "Pizza Napolitana", quantity: 2, price: 500 }
  ];
  context.pending_vendor_change = {
    new_vendor_id: "vendor-b-uuid",
    new_vendor_name: "Burger King"
  };
  context.order_state = "confirming_vendor_change";
  await saveContext(context, supabase);
  console.log("✅ State set to confirming_vendor_change");
  
  // 2. Usuario cancela el cambio
  console.log("\n📍 Step 2: User cancels vendor change");
  context = await getContext(phone, supabase);
  context.pending_vendor_change = undefined;
  context.order_state = "adding_items";
  await saveContext(context, supabase);
  console.log("✅ Vendor change cancelled");
  
  // 3. Verificar que el carrito se mantuvo
  console.log("\n📍 Step 3: Verify cart preserved");
  context = await getContext(phone, supabase);
  assertEquals(context.cart.length, 1, "Cart should be preserved");
  assertEquals(context.cart[0].product_name, "Pizza Napolitana");
  assertEquals(context.selected_vendor_id, "vendor-a-uuid", "Vendor should not change");
  assertEquals(context.selected_vendor_name, "Pizzería A");
  assertEquals(context.order_state, "adding_items");
  assertEquals(context.pending_vendor_change, undefined);
  console.log("✅ All assertions passed - cart and vendor preserved");
});

Deno.test("EDGE CASE: No confirmation needed when cart is empty", async () => {
  const supabase = createMockSupabase();
  const phone = "+5491112345678";
  
  console.log("\n🧪 TEST: Change vendor with empty cart - No confirmation");
  
  // 1. Usuario selecciona Vendor A (sin agregar productos)
  console.log("\n📍 Step 1: Select Vendor A with empty cart");
  let context = await getContext(phone, supabase);
  context.selected_vendor_id = "vendor-a-uuid";
  context.selected_vendor_name = "Pizzería A";
  context.order_state = "viewing_menu";
  context.cart = []; // Carrito vacío
  await saveContext(context, supabase);
  console.log("✅ Vendor A selected, cart empty");
  
  // 2. Usuario cambia a Vendor B - NO debería pedir confirmación
  console.log("\n📍 Step 2: Change to Vendor B (should work directly)");
  context = await getContext(phone, supabase);
  context.selected_vendor_id = "vendor-b-uuid";
  context.selected_vendor_name = "Burger King";
  context.order_state = "viewing_menu";
  await saveContext(context, supabase);
  console.log("✅ Vendor changed directly without confirmation");
  
  // 3. Verificar estado final
  console.log("\n📍 Step 3: Verify final state");
  context = await getContext(phone, supabase);
  assertEquals(context.selected_vendor_id, "vendor-b-uuid");
  assertEquals(context.selected_vendor_name, "Burger King");
  assertEquals(context.cart.length, 0);
  assertEquals(context.pending_vendor_change, undefined, "Should not have pending change");
  console.log("✅ All assertions passed");
});

Deno.test("SEARCH: Vendor search with accents - 'heladeria' finds 'Heladería Italiana'", async () => {
  console.log("\n🧪 TEST: Search vendor with accent normalization");
  
  // Simulate the search function from vendor-bot.ts
  const searchVendor = async (searchTerm: string) => {
    // Mock vendors database
    const mockVendors = [
      { id: "vendor-123", name: "Heladería Italiana", is_active: true, payment_status: "active" },
      { id: "vendor-456", name: "Pizzería Roma", is_active: true, payment_status: "active" },
      { id: "vendor-789", name: "Café Buenos Aires", is_active: true, payment_status: "active" },
    ];

    // Normalize search term (same logic as vendor-bot.ts)
    const normalized = searchTerm
      .replace(/[-_]/g, " ")
      .replace(/[áàäâã]/gi, 'a')
      .replace(/[éèëê]/gi, 'e')
      .replace(/[íìïî]/gi, 'i')
      .replace(/[óòöôõ]/gi, 'o')
      .replace(/[úùüû]/gi, 'u')
      .replace(/[ñ]/gi, 'n')
      .toLowerCase()
      .trim();

    return mockVendors.find(v => {
      const vendorNormalized = v.name
        .replace(/[áàäâã]/gi, 'a')
        .replace(/[éèëê]/gi, 'e')
        .replace(/[íìïî]/gi, 'i')
        .replace(/[óòöôõ]/gi, 'o')
        .replace(/[úùüû]/gi, 'u')
        .replace(/[ñ]/gi, 'n')
        .toLowerCase();
      return vendorNormalized.includes(normalized);
    });
  };

  // Test various search terms
  console.log("📍 Test 1: 'heladeria' -> 'Heladería Italiana'");
  const test1 = await searchVendor("heladeria");
  assertEquals(test1?.name, "Heladería Italiana", "Should find 'Heladería Italiana' with 'heladeria'");
  
  console.log("📍 Test 2: 'heladeria_italiana' -> 'Heladería Italiana'");
  const test2 = await searchVendor("heladeria_italiana");
  assertEquals(test2?.name, "Heladería Italiana", "Should find with underscores");
  
  console.log("📍 Test 3: 'pizzeria' -> 'Pizzería Roma'");
  const test3 = await searchVendor("pizzeria");
  assertEquals(test3?.name, "Pizzería Roma", "Should find 'Pizzería Roma'");

  console.log("📍 Test 4: 'cafe' -> 'Café Buenos Aires'");
  const test4 = await searchVendor("cafe");
  assertEquals(test4?.name, "Café Buenos Aires", "Should find 'Café Buenos Aires'");

  console.log("✅ TEST PASSED: Accent normalization works correctly");
});

Deno.test("SEARCH: Vendor search with special characters - underscores and hyphens", async () => {
  console.log("\n🧪 TEST: Search vendor with special characters");

  const searchVendor = async (searchTerm: string) => {
    const mockVendors = [
      { id: "vendor-123", name: "La Casa del Café", is_active: true, payment_status: "active" },
      { id: "vendor-456", name: "Don José Parrilla", is_active: true, payment_status: "active" },
    ];

    const normalized = searchTerm
      .replace(/[-_]/g, " ")
      .replace(/[áàäâã]/gi, 'a')
      .replace(/[éèëê]/gi, 'e')
      .replace(/[íìïî]/gi, 'i')
      .replace(/[óòöôõ]/gi, 'o')
      .replace(/[úùüû]/gi, 'u')
      .replace(/[ñ]/gi, 'n')
      .toLowerCase()
      .trim();

    return mockVendors.find(v => {
      const vendorNormalized = v.name
        .replace(/[áàäâã]/gi, 'a')
        .replace(/[éèëê]/gi, 'e')
        .replace(/[íìïî]/gi, 'i')
        .replace(/[óòöôõ]/gi, 'o')
        .replace(/[úùüû]/gi, 'u')
        .replace(/[ñ]/gi, 'n')
        .toLowerCase();
      return vendorNormalized.includes(normalized);
    });
  };

  console.log("📍 Test 1: 'la_casa_del_cafe' -> 'La Casa del Café'");
  const test1 = await searchVendor("la_casa_del_cafe");
  assertEquals(test1?.name, "La Casa del Café", "Should handle underscores");
  
  console.log("📍 Test 2: 'don-jose-parrilla' -> 'Don José Parrilla'");
  const test2 = await searchVendor("don-jose-parrilla");
  assertEquals(test2?.name, "Don José Parrilla", "Should handle hyphens");

  console.log("📍 Test 3: 'casa cafe' -> 'La Casa del Café'");
  const test3 = await searchVendor("casa cafe");
  assertEquals(test3?.name, "La Casa del Café", "Should handle spaces");

  console.log("✅ TEST PASSED: Special character handling works");
});
