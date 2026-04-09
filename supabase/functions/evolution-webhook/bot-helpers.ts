// Shared utility functions for bot modules

const PURCHASE_VERB_REGEX = /\b(dame|deme|quer[ée]s?|quiero|quer(?:ia|ía)|quisiera|poneme|agrega|agreg[aá]me|mand[aá]me|trae(?:me|r)?|ped[ií](?:me)?|necesito|llevo|meti?|pone|sum[aá](?:me)?|pon[eé](?:me)?)\b/i;
const NUMERIC_PURCHASE_REGEX = /^(?:(?:los|las|unos?|unas?)\s+)?\d+\s+\w/i;
const WORD_QTY_PURCHASE_REGEX = /^(?:un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|media|docena|quince|veinte)\s+\w/i;

export function normalizeIntentText(message: string): string {
  return message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/([a-z])\1{2,}/g, "$1$1") // siii -> sii
    .replace(/\s+/g, " ")
    .trim();
}

export function looksLikePurchaseIntent(message: string): boolean {
  const trimmed = message.trim();
  return PURCHASE_VERB_REGEX.test(trimmed)
    || NUMERIC_PURCHASE_REGEX.test(trimmed)
    || WORD_QTY_PURCHASE_REGEX.test(trimmed);
}

export function isOrderConfirmationSignal(message: string): boolean {
  const normalized = normalizeIntentText(message);

  // Confirmaciones naturales (incluye variantes como "siii", "lo confirmo")
  if (/^(?:(?:lo\s+)?confirm(?:o|ado|ar|amos)?|s[i]+|yes+|ok(?:ay)?|dale|listo|va(?:mos)?|claro|obvio|ya\s+esta|eso\s+es\s+todo|nada\s+mas)$/.test(normalized)) {
    return true;
  }

  // Confirmaciones embebidas cortas: "si confirmo", "ok confirmo"
  return /(?:^|\s)(?:confirm(?:o|ado|ar|amos)?|listo|ya\s+esta|eso\s+es\s+todo|nada\s+mas)(?:\s|$)/.test(normalized);
}
