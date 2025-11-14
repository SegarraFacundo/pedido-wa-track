// ==================== UTILIDADES ====================

export function normalizeArgentinePhone(phone: string): string {
  let cleaned = phone.replace(/@s\.whatsapp\.net$/i, "");
  cleaned = cleaned.replace(/[\s\-\(\)\+]/g, "");
  cleaned = cleaned.replace(/[^\d]/g, "");

  if (cleaned.startsWith("549") && cleaned.length === 13) return cleaned;
  if (cleaned.startsWith("54") && !cleaned.startsWith("549") && cleaned.length === 12) {
    return "549" + cleaned.substring(2);
  }
  if (cleaned.startsWith("9") && cleaned.length === 11) return "54" + cleaned;
  if (!cleaned.startsWith("54") && cleaned.length === 10) return "549" + cleaned;
  if (cleaned.length > 13) return normalizeArgentinePhone(cleaned.slice(-13));

  return cleaned;
}
