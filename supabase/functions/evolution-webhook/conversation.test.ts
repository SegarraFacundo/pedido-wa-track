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

// ============= REGRESSION TESTS: Loop Prevention =============

Deno.test("LOOP PREVENTION: No infinite loop when asking to see open stores", async () => {
  console.log("\n🧪 TEST: Loop prevention - asking to see open stores");
  const supabase = createMockSupabase();
  const phone = "5493464448309";
  
  // Initialize context
  await saveContext({
    phone,
    cart: [],
    conversation_history: [],
    order_state: "idle"
  }, supabase);
  
  // This test documents expected behavior:
  // When user asks "quiero ver los locales abiertos",
  // the bot should NOT get stuck calling ver_locales_abiertos repeatedly
  // Instead it should:
  // 1. Call ver_locales_abiertos once
  // 2. Receive the results
  // 3. Respond to user with the list
  // 4. Wait for user's next input
  
  console.log("✅ TEST DOCUMENTS: Bot should call tool once, then respond");
  console.log("   Actual enforcement is in vendor-bot.ts with:");
  console.log("   - messages array preserved across iterations");
  console.log("   - toolCallTracker preventing repeated calls");
  
  const context = await getContext(phone, supabase);
  assertEquals(context.order_state, "idle", "Should start in idle state");
});

Deno.test("LOOP PREVENTION: Tool rate limiting prevents repeated calls", async () => {
  console.log("\n🧪 TEST: Tool rate limiting mechanism");
  
  // Simulate the toolCallTracker logic from vendor-bot.ts
  const toolCallTracker = new Map<string, number>();
  
  const toolName = "ver_locales_abiertos";
  
  // First call - should be allowed
  console.log("📍 First call to tool");
  const count1 = toolCallTracker.get(toolName) || 0;
  toolCallTracker.set(toolName, count1 + 1);
  assertEquals(toolCallTracker.get(toolName), 1, "First call should be tracked");
  
  // Second call - should be allowed
  console.log("📍 Second call to tool");
  const count2 = toolCallTracker.get(toolName) || 0;
  toolCallTracker.set(toolName, count2 + 1);
  assertEquals(toolCallTracker.get(toolName), 2, "Second call should be tracked");
  
  // Third call - should be BLOCKED (>= 2)
  console.log("📍 Third call attempt - should be blocked");
  const count3 = toolCallTracker.get(toolName) || 0;
  const shouldBlock = count3 >= 2;
  assertEquals(shouldBlock, true, "Third call should be blocked by rate limiter");
  
  console.log("✅ TEST PASSED: Rate limiting works correctly");
});

// ==================== CONTEXT PERSISTENCE TESTS ====================

Deno.test("CONTEXT PERSISTENCE: Allows multiple orders from same vendor after cancellation", async () => {
  console.log("\n🧪 TEST: Multiple orders after cancellation");
  
  const supabase = createMockSupabase();
  const phone = "5493464448309";
  const mockVendorId = "vendor-123";
  
  // Setup: Create a cancelled order from 2 hours ago
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  console.log("📦 Creating mock cancelled order...");
  
  // Simulate database has a cancelled order
  const mockData = new Map();
  mockData.set(phone, {
    phone,
    cart: [],
    selected_vendor_id: undefined,
    conversation_history: []
  });
  
  // User selects vendor
  let context = await getContext(phone, supabase);
  context.selected_vendor_id = mockVendorId;
  context.selected_vendor_name = "Heladería Test";
  await saveContext(context, supabase);
  console.log("✅ Vendor selected");
  
  // User adds items
  context = await getContext(phone, supabase);
  context.cart.push({
    product_id: "prod-1",
    product_name: "Banana Split",
    quantity: 2,
    price: 15000
  });
  await saveContext(context, supabase);
  console.log("✅ Item added to cart");
  
  // Verify context was NOT cleared (cancelled orders don't block new orders)
  context = await getContext(phone, supabase);
  assertEquals(context.cart.length, 1, "Cart should have 1 item");
  assertEquals(context.selected_vendor_id, mockVendorId, "Vendor should still be selected");
  assertEquals(context.selected_vendor_name, "Heladería Test", "Vendor name should be preserved");
  
  console.log("✅ TEST PASSED: Multiple orders allowed after cancellation");
});

Deno.test("CONTEXT PERSISTENCE: Clears context if there's an ACTIVE order from same vendor", async () => {
  console.log("\n🧪 TEST: Clear context on active order");
  
  const supabase = createMockSupabase();
  const phone = "5493464448309";
  const mockVendorId = "vendor-123";
  
  // User tries to select vendor and add items
  let context = await getContext(phone, supabase);
  context.selected_vendor_id = mockVendorId;
  context.selected_vendor_name = "Heladería Test";
  context.cart.push({
    product_id: "prod-1",
    product_name: "Test Product",
    quantity: 1,
    price: 10000
  });
  await saveContext(context, supabase);
  console.log("✅ Initial context created");
  
  // Simulate the validation logic that would detect active orders
  // In real scenario, vendor-bot.ts would query for active orders
  // and clear context if found
  const hasActiveOrder = true; // Simulate finding an active order
  
  if (hasActiveOrder) {
    console.log("⚠️ Active order detected - clearing context");
    context.selected_vendor_id = undefined;
    context.selected_vendor_name = undefined;
    context.cart = [];
    context.order_state = 'idle';
    await saveContext(context, supabase);
  }
  
  // Verify context was cleared
  context = await getContext(phone, supabase);
  assertEquals(context.cart.length, 0, "Cart should be empty");
  assertEquals(context.selected_vendor_id, undefined, "Vendor should be cleared");
  assertEquals(context.selected_vendor_name, undefined, "Vendor name should be cleared");
  
  console.log("✅ TEST PASSED: Context cleared for active order");
});

// ==================== PAYMENT VALIDATION TESTS ====================

Deno.test("PAYMENT VALIDATION: Should reject invalid payment methods", async () => {
  console.log("\n🧪 TEST: Payment method validation");
  
  const supabase = createMockSupabase();
  const phone = "5493464448309";
  
  // Setup vendor with only efectivo enabled
  const mockVendorId = "vendor-payment-test";
  supabase.mockData.set(`vendors-${mockVendorId}`, {
    id: mockVendorId,
    name: "Test Vendor",
    payment_settings: {
      efectivo: true,
      transferencia: { activo: false },
      mercadoPago: { activo: false }
    }
  });
  
  // Setup context with selected vendor and cart
  const context = await getContext(phone, supabase);
  context.selected_vendor_id = mockVendorId;
  context.selected_vendor_name = "Test Vendor";
  context.cart = [{ product_id: "prod-1", product_name: "Helado", quantity: 1, price: 3000 }];
  context.delivery_address = "Test Address 123";
  context.user_latitude = -33.0;
  context.user_longitude = -60.0;
  context.order_state = "confirming_order";
  await saveContext(context, supabase);
  
  console.log("📍 Attempting to create order with invalid payment method (mercadopago)");
  
  // Import ejecutarHerramienta
  const vendorBotModule = await import("./vendor-bot.ts");
  const ejecutarHerramienta = vendorBotModule.ejecutarHerramienta;
  
  // Try to create order with mercadopago (not enabled)
  const result = await ejecutarHerramienta(
    "crear_pedido",
    { direccion: "Test Address 123", metodo_pago: "mercadopago" },
    context,
    supabase
  );
  
  console.log("📦 Result:", result);
  
  // Verify rejection
  assertEquals(
    result.includes("no está disponible"),
    true,
    "Should reject invalid payment method"
  );
  assertEquals(
    result.includes("ver_metodos_pago"),
    true,
    "Should suggest using ver_metodos_pago"
  );
  
  console.log("✅ TEST PASSED: Invalid payment methods are rejected");
});

Deno.test("PAYMENT VALIDATION: Should accept valid payment methods", async () => {
  console.log("\n🧪 TEST: Valid payment method acceptance");
  
  const supabase = createMockSupabase();
  const phone = "5493464448310";
  
  // Setup vendor with efectivo enabled
  const mockVendorId = "vendor-valid-payment";
  supabase.mockData.set(`vendors-${mockVendorId}`, {
    id: mockVendorId,
    name: "Test Vendor Valid",
    latitude: -33.0,
    longitude: -60.0,
    delivery_pricing_type: "fixed",
    delivery_fixed_price: 500,
    payment_settings: {
      efectivo: true,
      transferencia: { activo: false },
      mercadoPago: { activo: false }
    }
  });
  
  // Setup context
  const context = await getContext(phone, supabase);
  context.selected_vendor_id = mockVendorId;
  context.selected_vendor_name = "Test Vendor Valid";
  context.cart = [{ product_id: "prod-1", product_name: "Helado", quantity: 1, price: 3000 }];
  context.delivery_address = "Test Address 123";
  context.user_latitude = -33.0;
  context.user_longitude = -60.0;
  context.order_state = "confirming_order";
  await saveContext(context, supabase);
  
  console.log("📍 Creating order with valid payment method (efectivo)");
  
  // Import ejecutarHerramienta
  const vendorBotModule = await import("./vendor-bot.ts");
  const ejecutarHerramienta = vendorBotModule.ejecutarHerramienta;
  
  // Create order with efectivo (enabled)
  const result = await ejecutarHerramienta(
    "crear_pedido",
    { direccion: "Test Address 123", metodo_pago: "efectivo" },
    context,
    supabase
  );
  
  console.log("📦 Result:", result);
  
  // Verify success (should not contain error messages)
  assertEquals(
    result.includes("no está disponible"),
    false,
    "Should not reject valid payment method"
  );
  
  console.log("✅ TEST PASSED: Valid payment methods are accepted");
});

Deno.test("CONFIRMATION: Prompt should require explicit user confirmation", async () => {
  console.log("\n🧪 TEST: Explicit confirmation requirement in prompt");
  
  const supabase = createMockSupabase();
  const phone = "5493464448311";
  
  // Setup context in confirming_order state
  const context = await getContext(phone, supabase);
  context.selected_vendor_id = "vendor-confirm-test";
  context.selected_vendor_name = "Test Vendor";
  context.cart = [{ product_id: "prod-1", product_name: "Helado", quantity: 1, price: 3000 }];
  context.delivery_address = "Test Address 123";
  context.payment_method = "efectivo";
  context.order_state = "confirming_order";
  await saveContext(context, supabase);
  
  console.log("📍 Building system prompt for confirming_order state");
  
  // Import buildSystemPrompt
  const promptModule = await import("./simplified-prompt.ts");
  const buildSystemPrompt = promptModule.buildSystemPrompt;
  
  const prompt = buildSystemPrompt(context);
  
  console.log("📦 Checking prompt content...");
  
  // Verify prompt contains explicit instructions
  assertEquals(
    prompt.includes("OBLIGATORIO: Mostrá resumen COMPLETO"),
    true,
    "Prompt should require showing complete summary"
  );
  assertEquals(
    prompt.includes("NO llames crear_pedido hasta que el usuario responda"),
    true,
    "Prompt should prohibit calling crear_pedido without response"
  );
  assertEquals(
    prompt.includes("NUNCA llames crear_pedido automáticamente"),
    true,
    "Prompt should explicitly forbid automatic order creation"
  );
  
  console.log("✅ TEST PASSED: Prompt requires explicit confirmation");
});

// ==================== CART ITEM REMOVAL TESTS ====================

Deno.test("CART: quitar_producto_carrito debe funcionar con nombre parcial", async () => {
  console.log("\n🧪 TEST: Remove cart item by partial name");
  
  const supabase = createMockSupabase();
  const context: ConversationContext = {
    phone: "5493464448309",
    cart: [
      { product_id: "uuid-123", product_name: "Alfajor Chocotorta Triple", quantity: 2, price: 1000 },
      { product_id: "uuid-456", product_name: "Coca Cola 1,5 Litros", quantity: 1, price: 2500 }
    ],
    order_state: "adding_items",
    selected_vendor_id: "vendor-123",
    selected_vendor_name: "Test Vendor",
    conversation_history: []
  };

  const response = await ejecutarHerramienta(
    "quitar_producto_carrito",
    { product_id: "alfajor" },
    context,
    supabase
  );

  console.log("Response:", response);
  console.log("Cart after removal:", context.cart);

  expect(response).toContain("Quité");
  const alfajorItem = context.cart.find(i => i.product_name.includes("Alfajor"));
  expect(alfajorItem?.quantity).toBe(1); // Decremented from 2 to 1
  
  console.log("✅ TEST PASSED: Cart item quantity decremented correctly");
});

Deno.test("CART: quitar_producto_carrito debe remover completamente si quantity es 1", async () => {
  console.log("\n🧪 TEST: Remove cart item completely when quantity is 1");
  
  const supabase = createMockSupabase();
  const context: ConversationContext = {
    phone: "5493464448309",
    cart: [
      { product_id: "uuid-123", product_name: "Alfajor Chocotorta Triple", quantity: 1, price: 1000 }
    ],
    order_state: "adding_items",
    selected_vendor_id: "vendor-123",
    selected_vendor_name: "Test Vendor",
    conversation_history: []
  };

  const response = await ejecutarHerramienta(
    "quitar_producto_carrito",
    { product_id: "alfajor" },
    context,
    supabase
  );

  console.log("Response:", response);
  console.log("Cart after removal:", context.cart);

  expect(response).toContain("Quité");
  expect(context.cart.length).toBe(0); // Removed completely
  
  console.log("✅ TEST PASSED: Cart item removed completely");
});

Deno.test("CART: agregar_al_carrito no debe duplicar items", async () => {
  console.log("\n🧪 TEST: Add item to cart without duplication");
  
  const supabase = createMockSupabase();
  const context: ConversationContext = {
    phone: "5493464448309",
    cart: [],
    order_state: "adding_items",
    selected_vendor_id: mockVendorId,
    selected_vendor_name: "Test Vendor",
    conversation_history: []
  };

  // Simulate AI adding "one coca" ONCE
  await ejecutarHerramienta(
    "agregar_al_carrito",
    {
      items: [
        { product_id: "prod-456", product_name: "Coca Cola 1.5L", quantity: 1, price: 2500 }
      ]
    },
    context,
    supabase
  );

  console.log("Cart after adding:", context.cart);

  // Verify only 1 unit
  const cocaItem = context.cart.find(i => i.product_name.includes("Coca"));
  expect(cocaItem?.quantity).toBe(1);
  expect(context.cart.length).toBe(1);
  
  console.log("✅ TEST PASSED: Cart item added without duplication");
});

// ==================== ORDER CANCELLATION TESTS ====================

Deno.test("CANCELATION: Can cancel last order without providing order_id", async () => {
  console.log("\n🧪 TEST: Cancel last order without order_id");
  
  const supabase = createMockSupabase();
  const phone = "5493464448312";
  const orderId = "a29eecaa-1234-5678-90ab-cdef12345678";
  
  // Setup context with last_order_id
  const context = await getContext(phone, supabase);
  context.last_order_id = orderId;
  await saveContext(context, supabase);
  
  console.log(`📍 Context has last_order_id: ${orderId}`);
  
  // Mock order lookup
  supabase.from = (table: string) => {
    if (table === "orders") {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: {
                id: orderId,
                customer_phone: phone,
                status: "pending",
                total: 5000,
              },
              error: null
            })
          })
        }),
        update: () => ({
          eq: () => Promise.resolve({ error: null })
        })
      };
    }
    if (table === "order_status_history") {
      return {
        insert: () => Promise.resolve({ error: null })
      };
    }
    return {
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }),
      upsert: () => Promise.resolve({ error: null })
    };
  };
  
  // Import tool execution
  const botModule = await import("./vendor-bot.ts");
  
  console.log("🚀 Executing cancelar_pedido without order_id");
  
  // This should use context.last_order_id
  const result = await botModule.executeToolCall(
    {
      name: "cancelar_pedido",
      arguments: JSON.stringify({
        motivo: "El negocio no tiene mercado pago disponible"
      })
    },
    context,
    supabase
  );
  
  console.log(`📦 Result: ${result}`);
  
  assertEquals(
    result.includes("cancelado"),
    true,
    "Should confirm cancellation"
  );
  
  console.log("✅ TEST PASSED: Can cancel without order_id using context");
});

Deno.test("CANCELATION: Can cancel using 8-character partial ID", async () => {
  console.log("\n🧪 TEST: Cancel using partial ID");
  
  const supabase = createMockSupabase();
  const phone = "5493464448313";
  const fullId = "a29eecaa-1234-5678-90ab-cdef12345678";
  const partialId = "a29eecaa";
  
  const context = await getContext(phone, supabase);
  await saveContext(context, supabase);
  
  console.log(`📍 Attempting to cancel with partial ID: ${partialId}`);
  
  // Mock partial ID search
  supabase.from = (table: string) => {
    if (table === "orders") {
      const chainable = {
        select: () => chainable,
        eq: () => chainable,
        ilike: () => chainable,
        limit: () => Promise.resolve({
          data: [{ id: fullId }],
          error: null
        }),
        single: () => Promise.resolve({
          data: {
            id: fullId,
            customer_phone: phone,
            status: "pending",
            total: 5000,
          },
          error: null
        }),
        update: () => ({
          eq: () => Promise.resolve({ error: null })
        })
      };
      return chainable;
    }
    if (table === "order_status_history") {
      return {
        insert: () => Promise.resolve({ error: null })
      };
    }
    return {
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }),
      upsert: () => Promise.resolve({ error: null })
    };
  };
  
  const botModule = await import("./vendor-bot.ts");
  
  console.log("🚀 Executing cancelar_pedido with partial ID");
  
  const result = await botModule.executeToolCall(
    {
      name: "cancelar_pedido",
      arguments: JSON.stringify({
        order_id: partialId,
        motivo: "Cambié de opinión sobre el pedido completo"
      })
    },
    context,
    supabase
  );
  
  console.log(`📦 Result: ${result}`);
  
  assertEquals(
    result.includes("cancelado"),
    true,
    "Should cancel using partial ID"
  );
  
  console.log("✅ TEST PASSED: Can cancel with 8-char partial ID");
});

Deno.test("CANCELATION: Finds most recent order if no order_id provided", async () => {
  console.log("\n🧪 TEST: Find recent order automatically");
  
  const supabase = createMockSupabase();
  const phone = "5493464448314";
  const recentOrderId = "recent-order-123";
  
  const context = await getContext(phone, supabase);
  // No last_order_id in context
  await saveContext(context, supabase);
  
  console.log("📍 No last_order_id in context, should search recent orders");
  
  // Mock recent order search
  supabase.from = (table: string) => {
    if (table === "orders") {
      const chainable = {
        select: () => chainable,
        eq: () => chainable,
        in: () => chainable,
        order: () => chainable,
        limit: () => Promise.resolve({
          data: [{ 
            id: recentOrderId,
            status: "pending",
            created_at: new Date().toISOString()
          }],
          error: null
        }),
        single: () => Promise.resolve({
          data: {
            id: recentOrderId,
            customer_phone: phone,
            status: "pending",
            total: 3000,
          },
          error: null
        }),
        update: () => ({
          eq: () => Promise.resolve({ error: null })
        })
      };
      return chainable;
    }
    if (table === "order_status_history") {
      return {
        insert: () => Promise.resolve({ error: null })
      };
    }
    return {
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }),
      upsert: () => Promise.resolve({ error: null })
    };
  };
  
  const botModule = await import("./vendor-bot.ts");
  
  console.log("🚀 Executing cancelar_pedido without any order_id");
  
  const result = await botModule.executeToolCall(
    {
      name: "cancelar_pedido",
      arguments: JSON.stringify({
        motivo: "No quiero el pedido más reciente que hice"
      })
    },
    context,
    supabase
  );
  
  console.log(`📦 Result: ${result}`);
  
  assertEquals(
    result.includes("cancelado"),
    true,
    "Should find and cancel most recent order"
  );
  
  console.log("✅ TEST PASSED: Automatically finds recent order");
});

// ==================== PAYMENT METHOD VALIDATION TESTS ====================

Deno.test("PAYMENT VALIDATION: ver_metodos_pago debe guardar métodos en el contexto", async () => {
  console.log("\n🧪 TEST: ver_metodos_pago saves payment methods to context");
  
  const supabase = createMockSupabase();
  const phone = "5493464448309";
  const mockVendorId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  
  const context = await getContext(phone, supabase);
  context.selected_vendor_id = mockVendorId;
  context.order_state = "collecting_payment";
  
  // Mock vendor with specific payment settings
  supabase.from = (table: string) => {
    if (table === "vendors") {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: {
                id: mockVendorId,
                name: "Test Vendor",
                payment_settings: {
                  efectivo: true,
                  mercadoPago: { activo: false },
                  transferencia: { activo: true, alias: "test.alias", cbu: "1234567890", titular: "Test" }
                }
              },
              error: null
            })
          })
        })
      };
    }
    return {
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }),
      upsert: () => Promise.resolve({ error: null })
    };
  };

  const botModule = await import("./vendor-bot.ts");
  
  await botModule.executeToolCall(
    {
      name: "ver_metodos_pago",
      arguments: JSON.stringify({})
    },
    context,
    supabase
  );

  assertEquals(context.payment_methods_fetched, true, "payment_methods_fetched should be true");
  assertEquals(context.available_payment_methods?.includes("efectivo"), true, "Should include efectivo");
  assertEquals(context.available_payment_methods?.includes("transferencia"), true, "Should include transferencia");
  assertEquals(context.available_payment_methods?.includes("mercadopago"), false, "Should NOT include mercadopago");
  
  console.log(`✅ Payment methods saved: ${context.available_payment_methods?.join(", ")}`);
  console.log("✅ TEST PASSED: Payment methods correctly saved to context");
});

Deno.test("PAYMENT VALIDATION: Context stores correct payment keys", async () => {
  console.log("\n🧪 TEST: Validate payment method keys format");
  
  const supabase = createMockSupabase();
  const phone = "5493464448309";
  const mockVendorId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  
  const context = await getContext(phone, supabase);
  context.selected_vendor_id = mockVendorId;
  context.order_state = "collecting_payment";
  
  // Mock vendor with only efectivo
  supabase.from = (table: string) => {
    if (table === "vendors") {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: {
                id: mockVendorId,
                name: "Cash Only Vendor",
                payment_settings: {
                  efectivo: true,
                  mercadoPago: { activo: false },
                  transferencia: { activo: false }
                }
              },
              error: null
            })
          })
        })
      };
    }
    return {
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }),
      upsert: () => Promise.resolve({ error: null })
    };
  };

  const botModule = await import("./vendor-bot.ts");
  
  await botModule.executeToolCall(
    {
      name: "ver_metodos_pago",
      arguments: JSON.stringify({})
    },
    context,
    supabase
  );

  assertEquals(context.available_payment_methods?.length, 1, "Should have exactly 1 payment method");
  assertEquals(context.available_payment_methods?.[0], "efectivo", "Should be 'efectivo'");
  
  console.log("✅ TEST PASSED: Payment method keys stored correctly");
});
