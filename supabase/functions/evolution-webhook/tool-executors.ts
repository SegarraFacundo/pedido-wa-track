import type { ConversationContext, CartItem } from "./types.ts";
import { getPendingStateForPayment } from "./types.ts";
import { normalizeArgentinePhone } from "./utils.ts";
import { saveContext } from "./context.ts";

// Forward declaration — will be set by vendor-bot.ts to avoid circular imports
let _getVendorConfig: (vendorId: string, supabase: any) => Promise<any>;
let _isValidAddress: (address: string) => boolean;

export function setGetVendorConfig(fn: typeof _getVendorConfig) {
  _getVendorConfig = fn;
}

export function setIsValidAddress(fn: typeof _isValidAddress) {
  _isValidAddress = fn;
}

// ==================== EJECUTORES DE HERRAMIENTAS ====================

export async function ejecutarHerramienta(
  toolName: string,
  args: any,
  context: ConversationContext,
  supabase: any,
): Promise<string> {
  console.log(`🔧 [TOOL CALL] ${toolName}`, JSON.stringify(args, null, 2));
  console.log(`Ejecutando herramienta: ${toolName}`, args);

  try {
    switch (toolName) {
