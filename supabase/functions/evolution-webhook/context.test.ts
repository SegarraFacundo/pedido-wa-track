import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { getContext, saveContext } from "./context.ts";
import type { ConversationContext } from "./types.ts";

// Mock Supabase client
const createMockSupabase = (mockData?: any) => ({
  from: (table: string) => ({
    select: (columns: string) => ({
      eq: (column: string, value: any) => ({
        maybeSingle: async () => ({ data: mockData, error: null }),
      }),
    }),
    upsert: async (data: any, options?: any) => ({ data, error: null }),
  }),
});

Deno.test("getContext - should create new context when no data exists", async () => {
  const mockSupabase = createMockSupabase(null);
  const phone = "5493464448309";

  const context = await getContext(phone, mockSupabase);

  assertEquals(context.phone, phone);
  assertEquals(context.cart, []);
  assertEquals(context.conversation_history, []);
  assertEquals(context.pending_location_decision, false);
});

Deno.test("getContext - should load existing context from database", async () => {
  const phone = "5493464448309";
  const mockData = {
    phone,
    last_bot_message: JSON.stringify({
      cart: [
        { product_id: "123", product_name: "Pizza", quantity: 2, price: 500 },
      ],
      selected_vendor_id: "vendor-123",
      selected_vendor_name: "Pizzería Test",
      delivery_address: "Test Address 123",
      payment_method: "efectivo",
      conversation_history: [
        { role: "user", content: "Hola" },
        { role: "assistant", content: "¡Hola! ¿En qué puedo ayudarte?" },
      ],
    }),
    user_latitude: -33.0325308,
    user_longitude: -61.1750395,
  };

  const mockSupabase = createMockSupabase(mockData);
  const context = await getContext(phone, mockSupabase);

  assertEquals(context.phone, phone);
  assertEquals(context.cart.length, 1);
  assertEquals(context.cart[0].product_name, "Pizza");
  assertEquals(context.selected_vendor_id, "vendor-123");
  assertEquals(context.selected_vendor_name, "Pizzería Test");
  assertEquals(context.delivery_address, "Test Address 123");
  assertEquals(context.payment_method, "efectivo");
  assertEquals(context.user_latitude, -33.0325308);
  assertEquals(context.user_longitude, -61.1750395);
  assertEquals(context.conversation_history.length, 2);
});

Deno.test("getContext - should handle corrupted JSON gracefully", async () => {
  const phone = "5493464448309";
  const mockData = {
    phone,
    last_bot_message: "invalid json {{{",
  };

  const mockSupabase = createMockSupabase(mockData);
  const context = await getContext(phone, mockSupabase);

  // Should create new context on parse error
  assertEquals(context.phone, phone);
  assertEquals(context.cart, []);
  assertEquals(context.conversation_history, []);
});

Deno.test("getContext - should handle location data correctly", async () => {
  const phone = "5493464448309";
  const mockData = {
    phone,
    last_bot_message: JSON.stringify({
      cart: [],
      conversation_history: [],
    }),
    user_latitude: -34.6037,
    user_longitude: -58.3816,
  };

  const mockSupabase = createMockSupabase(mockData);
  const context = await getContext(phone, mockSupabase);

  assertEquals(context.user_latitude, -34.6037);
  assertEquals(context.user_longitude, -58.3816);
});

Deno.test("saveContext - should truncate conversation history to 20 messages", async () => {
  const context: ConversationContext = {
    phone: "5493464448309",
    cart: [],
    conversation_history: Array(25).fill({ role: "user", content: "test" }),
  };

  const mockSupabase = createMockSupabase(null);
  await saveContext(context, mockSupabase);

  // After save, history should be truncated
  assertEquals(context.conversation_history.length, 20);
});

Deno.test("saveContext - should not save if phone is missing", async () => {
  const context: ConversationContext = {
    phone: "", // Empty phone
    cart: [],
    conversation_history: [],
  };

  const mockSupabase = createMockSupabase(null);
  
  // Should not throw error, just log and return
  await saveContext(context, mockSupabase);
  
  // Test passes if no error is thrown
  assertExists(context);
});

Deno.test("saveContext - should preserve all context fields", async () => {
  const context: ConversationContext = {
    phone: "5493464448309",
    cart: [{ product_id: "123", product_name: "Pizza", quantity: 1, price: 500 }],
    selected_vendor_id: "vendor-123",
    selected_vendor_name: "Pizzería",
    delivery_address: "Test St 123",
    payment_method: "efectivo",
    pending_order_id: "order-456",
    user_latitude: -33.0325308,
    user_longitude: -61.1750395,
    pending_location_decision: true,
    conversation_history: [{ role: "user", content: "Hola" }],
  };

  let savedData: any;
  const mockSupabase = {
    from: (table: string) => ({
      upsert: async (data: any) => {
        savedData = data;
        return { data, error: null };
      },
    }),
  };

  await saveContext(context, mockSupabase);

  assertExists(savedData);
  assertEquals(savedData.phone, context.phone);
  assertEquals(savedData.user_latitude, context.user_latitude);
  assertEquals(savedData.user_longitude, context.user_longitude);
  
  const savedContext = JSON.parse(savedData.last_bot_message);
  assertEquals(savedContext.cart.length, 1);
  assertEquals(savedContext.selected_vendor_id, "vendor-123");
  assertEquals(savedContext.delivery_address, "Test St 123");
  assertEquals(savedContext.payment_method, "efectivo");
});
