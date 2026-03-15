// ==================== DICCIONARIO I18N PARA EL BOT ====================
// Strings deterministas usados en interceptores y respuestas directas del bot

export type Language = 'es' | 'en' | 'pt' | 'ja';

const translations: Record<string, Record<Language, string>> = {
  // === CARRITO ===
  'cart.empty': {
    es: 'El carrito está vacío. ¿Qué te gustaría pedir?',
    en: 'Your cart is empty. What would you like to order?',
    pt: 'Seu carrinho está vazio. O que você gostaria de pedir?',
    ja: 'カートは空です。何を注文しますか？',
  },
  'cart.added': {
    es: '✅ Productos agregados al carrito de *{vendor}*.\n\n💰 Total actual: ${total}\n\n¿Querés agregar algo más o confirmás el pedido? 📦',
    en: '✅ Products added to *{vendor}* cart.\n\n💰 Current total: ${total}\n\nWant to add more or confirm the order? 📦',
    pt: '✅ Produtos adicionados ao carrinho de *{vendor}*.\n\n💰 Total atual: ${total}\n\nQuer adicionar mais ou confirmar o pedido? 📦',
    ja: '✅ *{vendor}*のカートに商品を追加しました。\n\n💰 合計: ${total}\n\n他に追加しますか？それとも注文を確定しますか？📦',
  },
  'cart.header': {
    es: '🛒 *Tu carrito de {vendor}:*',
    en: '🛒 *Your cart from {vendor}:*',
    pt: '🛒 *Seu carrinho de {vendor}:*',
    ja: '🛒 *{vendor}のカート:*',
  },
  'cart.confirm_prompt': {
    es: 'Para confirmar, decime "confirmar pedido" o "listo" 📦',
    en: 'To confirm, say "confirm order" or "done" 📦',
    pt: 'Para confirmar, diga "confirmar pedido" ou "pronto" 📦',
    ja: '確定するには「注文確定」と言ってください 📦',
  },
  'cart.ready_to_confirm': {
    es: '✅ *Todo listo para confirmar*',
    en: '✅ *Everything ready to confirm*',
    pt: '✅ *Tudo pronto para confirmar*',
    ja: '✅ *確認の準備ができました*',
  },
  'cart.confirm_yes': {
    es: 'Respondé *"sí"* para confirmar el pedido.',
    en: 'Reply *"yes"* to confirm the order.',
    pt: 'Responda *"sim"* para confirmar o pedido.',
    ja: '*「はい」*と返信して注文を確定してください。',
  },

  // === RESUMEN ===
  'summary.header': {
    es: '📋 *RESUMEN DE TU PEDIDO*',
    en: '📋 *YOUR ORDER SUMMARY*',
    pt: '📋 *RESUMO DO SEU PEDIDO*',
    ja: '📋 *注文の概要*',
  },
  'summary.store': {
    es: '🏪 *Negocio:* {vendor}',
    en: '🏪 *Store:* {vendor}',
    pt: '🏪 *Loja:* {vendor}',
    ja: '🏪 *店舗:* {vendor}',
  },
  'summary.products': {
    es: '📦 *Productos:*',
    en: '📦 *Products:*',
    pt: '📦 *Produtos:*',
    ja: '📦 *商品:*',
  },
  'summary.subtotal': {
    es: '💰 *Subtotal:* ${amount}',
    en: '💰 *Subtotal:* ${amount}',
    pt: '💰 *Subtotal:* ${amount}',
    ja: '💰 *小計:* ${amount}',
  },
  'summary.pickup': {
    es: '📍 *Entrega:* Retiro en local',
    en: '📍 *Delivery:* Pickup at store',
    pt: '📍 *Entrega:* Retirada na loja',
    ja: '📍 *受け取り:* 店舗受け取り',
  },
  'summary.delivery': {
    es: '🚚 *Entrega:* A domicilio',
    en: '🚚 *Delivery:* Home delivery',
    pt: '🚚 *Entrega:* Delivery',
    ja: '🚚 *配達:* 自宅配送',
  },
  'summary.address': {
    es: '📍 *Dirección:* {address}',
    en: '📍 *Address:* {address}',
    pt: '📍 *Endereço:* {address}',
    ja: '📍 *住所:* {address}',
  },
  'summary.missing_address': {
    es: '⚠️ *Falta confirmar dirección de entrega*',
    en: '⚠️ *Delivery address not confirmed yet*',
    pt: '⚠️ *Falta confirmar endereço de entrega*',
    ja: '⚠️ *配送先住所の確認が必要です*',
  },
  'summary.shipping_cost': {
    es: '🚴 *Costo de envío:* (se calculará según distancia)',
    en: '🚴 *Shipping cost:* (will be calculated by distance)',
    pt: '🚴 *Custo de envio:* (será calculado pela distância)',
    ja: '🚴 *配送料:* (距離に応じて計算されます)',
  },
  'summary.delivery_type_missing': {
    es: '⚠️ *Tipo de entrega no seleccionado*',
    en: '⚠️ *Delivery type not selected*',
    pt: '⚠️ *Tipo de entrega não selecionado*',
    ja: '⚠️ *配送方法が選択されていません*',
  },
  'summary.payment_not_selected': {
    es: '⚠️ *No seleccionado*',
    en: '⚠️ *Not selected*',
    pt: '⚠️ *Não selecionado*',
    ja: '⚠️ *未選択*',
  },
  'summary.choose_payment': {
    es: 'Por favor elegí uno de estos métodos:',
    en: 'Please choose one of these methods:',
    pt: 'Por favor escolha um destes métodos:',
    ja: '以下の支払い方法からお選びください:',
  },
  'summary.total_estimated': {
    es: '💰💰 *TOTAL ESTIMADO:* ${amount}',
    en: '💰💰 *ESTIMATED TOTAL:* ${amount}',
    pt: '💰💰 *TOTAL ESTIMADO:* ${amount}',
    ja: '💰💰 *合計（税込み）:* ${amount}',
  },
  'summary.plus_shipping': {
    es: ' + envío',
    en: ' + shipping',
    pt: ' + frete',
    ja: ' + 送料',
  },
  'summary.missing_info': {
    es: '⚠️ *Falta completar:* {items}',
    en: '⚠️ *Still needed:* {items}',
    pt: '⚠️ *Falta completar:* {items}',
    ja: '⚠️ *未入力:* {items}',
  },
  'summary.confirm_question': {
    es: '✅ *¿Confirmás el pedido?*\nRespondé "sí" para confirmar o "no" para cancelar.',
    en: '✅ *Confirm your order?*\nReply "yes" to confirm or "no" to cancel.',
    pt: '✅ *Confirma o pedido?*\nResponda "sim" para confirmar ou "não" para cancelar.',
    ja: '✅ *注文を確定しますか？*\n「はい」で確定、「いいえ」でキャンセル。',
  },

  // === PEDIDO ===
  'order.created': {
    es: '✅ ¡Pedido creado exitosamente!',
    en: '✅ Order created successfully!',
    pt: '✅ Pedido criado com sucesso!',
    ja: '✅ 注文が作成されました！',
  },
  'order.duplicate': {
    es: '✅ Ya tenés un pedido activo (#{id}).\n\n📊 Podés consultar su estado diciendo "estado del pedido".\n\nSi querés hacer otro pedido, esperá a que este se complete. 😊',
    en: '✅ You already have an active order (#{id}).\n\n📊 Check its status by saying "order status".\n\nWait for it to complete before making a new one. 😊',
    pt: '✅ Você já tem um pedido ativo (#{id}).\n\n📊 Verifique o status dizendo "status do pedido".\n\nAguarde ele ser concluído para fazer outro. 😊',
    ja: '✅ アクティブな注文があります (#{id})。\n\n📊 「注文状況」で確認できます。\n\n完了を待ってから新しい注文をしてください。😊',
  },
  'order.cancelled': {
    es: 'Pedido cancelado. ¿En qué más puedo ayudarte? 😊',
    en: 'Order cancelled. How else can I help? 😊',
    pt: 'Pedido cancelado. Em que mais posso ajudar? 😊',
    ja: '注文がキャンセルされました。他にお手伝いできることはありますか？😊',
  },
  'order.active_exists': {
    es: '⏳ Ya tenés un pedido activo (#{id}). Esperá a que se complete o cancelalo antes de hacer otro. 😊',
    en: '⏳ You already have an active order (#{id}). Wait for it to complete or cancel it first. 😊',
    pt: '⏳ Você já tem um pedido ativo (#{id}). Aguarde ele ser concluído ou cancele antes de fazer outro. 😊',
    ja: '⏳ アクティブな注文があります (#{id})。完了を待つかキャンセルしてから新しい注文をしてください。😊',
  },

  // === VENDORS ===
  'vendors.header': {
    es: '¡Aquí tenés los negocios disponibles! 🚗',
    en: 'Here are the available stores! 🚗',
    pt: 'Aqui estão as lojas disponíveis! 🚗',
    ja: '利用可能な店舗です！🚗',
  },
  'vendors.open_now': {
    es: '🟢 *ABIERTOS AHORA*',
    en: '🟢 *OPEN NOW*',
    pt: '🟢 *ABERTOS AGORA*',
    ja: '🟢 *営業中*',
  },
  'vendors.closed': {
    es: '🔴 *CERRADOS*',
    en: '🔴 *CLOSED*',
    pt: '🔴 *FECHADOS*',
    ja: '🔴 *閉店*',
  },
  'vendors.select_prompt': {
    es: 'Decime el número o nombre del negocio para ver su menú completo.',
    en: 'Tell me the number or name of the store to see the full menu.',
    pt: 'Diga o número ou nome da loja para ver o menu completo.',
    ja: '番号または店名を教えてください。メニューをお見せします。',
  },
  'vendors.no_available': {
    es: '😔 No hay negocios disponibles en este momento.',
    en: '😔 No stores available right now.',
    pt: '😔 Não há lojas disponíveis no momento.',
    ja: '😔 現在利用可能な店舗はありません。',
  },

  // === ENTREGA ===
  'delivery.ask_type': {
    es: '¿Lo retirás en el local o te lo enviamos? 🏪🚚',
    en: 'Pick up at the store or delivery? 🏪🚚',
    pt: 'Retirada na loja ou delivery? 🏪🚚',
    ja: '店舗受け取りですか？配達ですか？🏪🚚',
  },
  'delivery.ask_address': {
    es: '✍️ Escribí tu dirección de entrega (calle y número)',
    en: '✍️ Write your delivery address (street and number)',
    pt: '✍️ Escreva seu endereço de entrega (rua e número)',
    ja: '✍️ 配送先住所を入力してください（通り名と番号）',
  },
  'delivery.need_address': {
    es: '📍 Para confirmar tu pedido, necesito tu dirección de entrega.\n\n✍️ Escribí tu dirección completa (calle y número).\n\nEl negocio confirmará si hace delivery a tu zona. 🚗',
    en: '📍 To confirm your order, I need your delivery address.\n\n✍️ Write your full address (street and number).\n\nThe store will confirm if they deliver to your area. 🚗',
    pt: '📍 Para confirmar seu pedido, preciso do endereço de entrega.\n\n✍️ Escreva seu endereço completo (rua e número).\n\nA loja confirmará se entrega na sua região. 🚗',
    ja: '📍 注文を確定するには配送先住所が必要です。\n\n✍️ 住所を入力してください（通り名と番号）。\n\n店舗が配達エリアを確認します。🚗',
  },

  // === PAGO ===
  'payment.select': {
    es: 'Por favor seleccioná un método de pago (efectivo, transferencia o mercadopago).',
    en: 'Please select a payment method (cash, transfer or mercadopago).',
    pt: 'Por favor selecione um método de pagamento (dinheiro, transferência ou mercadopago).',
    ja: '支払い方法を選択してください（現金、振込、またはmercadopago）。',
  },
  'payment.invalid': {
    es: '⚠️ El método de pago "{method}" no está disponible en {vendor}.',
    en: '⚠️ The payment method "{method}" is not available at {vendor}.',
    pt: '⚠️ O método de pagamento "{method}" não está disponível em {vendor}.',
    ja: '⚠️ 支払い方法「{method}」は{vendor}では利用できません。',
  },

  // === TRANSFERENCIA ===
  'transfer.reminder': {
    es: 'Ya seleccionaste transferencia bancaria como método de pago. 👍\n\nSolo necesito que *confirmes* si querés continuar con el pedido.\n\nRespondé:\n• *"Sí"* para confirmar el pedido\n• *"No"* para cancelar',
    en: 'You already selected bank transfer as payment. 👍\n\nI just need you to *confirm* if you want to proceed.\n\nReply:\n• *"Yes"* to confirm\n• *"No"* to cancel',
    pt: 'Você já selecionou transferência bancária. 👍\n\nSó preciso que *confirme* se quer continuar.\n\nResponda:\n• *"Sim"* para confirmar\n• *"Não"* para cancelar',
    ja: '銀行振込を選択済みです。👍\n\n注文を進めるか*確認*してください。\n\n返信:\n• *「はい」*で確定\n• *「いいえ」*でキャンセル',
  },
  'transfer.confirmed': {
    es: '✅ ¡Perfecto! Tu pedido está confirmado.\n\n📸 Ahora enviame el *comprobante de transferencia* para que el negocio pueda procesar tu pedido.\n\nPodés enviar una foto o captura del comprobante. 📱',
    en: '✅ Perfect! Your order is confirmed.\n\n📸 Now send me the *transfer receipt* so the store can process your order.\n\nYou can send a photo or screenshot. 📱',
    pt: '✅ Perfeito! Seu pedido está confirmado.\n\n📸 Agora envie o *comprovante de transferência* para a loja processar seu pedido.\n\nVocê pode enviar uma foto ou captura de tela. 📱',
    ja: '✅ 注文が確定しました！\n\n📸 *振込明細書*を送ってください。店舗が注文を処理します。\n\n写真またはスクリーンショットを送信できます。📱',
  },
  'transfer.clarify': {
    es: 'Por favor confirmá si vas a hacer la transferencia bancaria.\n\nRespondé *"sí"* para confirmar o *"no"* para cancelar el pedido.',
    en: 'Please confirm if you will make the bank transfer.\n\nReply *"yes"* to confirm or *"no"* to cancel.',
    pt: 'Por favor confirme se vai fazer a transferência bancária.\n\nResponda *"sim"* para confirmar ou *"não"* para cancelar.',
    ja: '銀行振込を行うか確認してください。\n\n*「はい」*で確定、*「いいえ」*でキャンセル。',
  },

  // === AYUDA ===
  'help.header': {
    es: '📋 *¿Qué puedo hacer?*',
    en: '📋 *What can I do?*',
    pt: '📋 *O que posso fazer?*',
    ja: '📋 *何ができますか？*',
  },
  'help.body': {
    es: '🔍 *Ver negocios* - "mostrame los locales"\n🍕 *Buscar productos* - "quiero pizza", "busco helado"\n🛒 *Ver carrito* - "ver carrito", "qué tengo"\n📦 *Estado de pedido* - "estado de mi pedido"\n❌ *Cancelar pedido* - "cancelar pedido"\n🗣️ *Hablar con negocio* - "hablar con vendedor"\n⭐ *Calificar* - "quiero calificar"\n\nEscribí lo que necesitás y te ayudo 😊',
    en: '🔍 *See stores* - "show me stores"\n🍕 *Search products* - "I want pizza", "looking for ice cream"\n🛒 *View cart* - "view cart", "what do I have"\n📦 *Order status* - "my order status"\n❌ *Cancel order* - "cancel order"\n🗣️ *Talk to store* - "talk to vendor"\n⭐ *Rate* - "I want to rate"\n\nWrite what you need and I\'ll help 😊',
    pt: '🔍 *Ver lojas* - "mostre as lojas"\n🍕 *Buscar produtos* - "quero pizza", "procuro sorvete"\n🛒 *Ver carrinho* - "ver carrinho", "o que tenho"\n📦 *Status do pedido* - "status do meu pedido"\n❌ *Cancelar pedido* - "cancelar pedido"\n🗣️ *Falar com loja* - "falar com vendedor"\n⭐ *Avaliar* - "quero avaliar"\n\nEscreva o que precisa e eu ajudo 😊',
    ja: '🔍 *店舗を見る* - 「お店を見せて」\n🍕 *商品を探す* - 「ピザが欲しい」\n🛒 *カートを見る* - 「カートを見る」\n📦 *注文状況* - 「注文の状況」\n❌ *注文キャンセル* - 「注文キャンセル」\n🗣️ *店舗に連絡* - 「店舗と話す」\n⭐ *評価* - 「評価したい」\n\n何が必要か書いてください 😊',
  },

  // === ERRORES ===
  'error.generic': {
    es: 'Disculpá, tuve un problema técnico. Por favor intentá de nuevo en un momento.',
    en: 'Sorry, I had a technical issue. Please try again in a moment.',
    pt: 'Desculpe, tive um problema técnico. Por favor tente novamente.',
    ja: '申し訳ありません、技術的な問題が発生しました。もう一度お試しください。',
  },
  'error.not_understood': {
    es: 'Perdón, no entendí. ¿Podés repetir?',
    en: 'Sorry, I didn\'t understand. Could you repeat?',
    pt: 'Desculpe, não entendi. Pode repetir?',
    ja: 'すみません、理解できませんでした。もう一度言っていただけますか？',
  },
  'error.max_iterations': {
    es: 'Disculpá, tuve un problema procesando tu mensaje. ¿Podés intentar de nuevo?',
    en: 'Sorry, I had trouble processing your message. Could you try again?',
    pt: 'Desculpe, tive um problema processando sua mensagem. Pode tentar de novo?',
    ja: '申し訳ありません、メッセージの処理に問題がありました。もう一度お試しください。',
  },
  'error.reformulate': {
    es: 'Disculpá, tuve un problema. ¿Podés reformular tu pedido?',
    en: 'Sorry, I had an issue. Could you rephrase your order?',
    pt: 'Desculpe, tive um problema. Pode reformular seu pedido?',
    ja: '申し訳ありません、問題がありました。注文を言い直していただけますか？',
  },
  'error.vendor_fetch': {
    es: '⚠️ Ocurrió un error al buscar negocios. Intentalo nuevamente.',
    en: '⚠️ An error occurred while searching stores. Please try again.',
    pt: '⚠️ Ocorreu um erro ao buscar lojas. Tente novamente.',
    ja: '⚠️ 店舗の検索中にエラーが発生しました。もう一度お試しください。',
  },
  'error.order_create': {
    es: 'Hubo un error al crear tu pedido. Por favor intentá de nuevo.',
    en: 'There was an error creating your order. Please try again.',
    pt: 'Houve um erro ao criar seu pedido. Por favor tente novamente.',
    ja: '注文の作成中にエラーが発生しました。もう一度お試しください。',
  },

  // === PICKUP ===
  'pickup.reminder': {
    es: '📍 Tu pedido es para *retiro en local*, no necesito dirección de entrega.\n\nLo vas a retirar en: {vendor}\n\n¿Con qué método querés pagar? Respondé con el número o nombre del método.',
    en: '📍 Your order is for *store pickup*, I don\'t need a delivery address.\n\nYou\'ll pick up at: {vendor}\n\nWhich payment method? Reply with the number or name.',
    pt: '📍 Seu pedido é para *retirada na loja*, não preciso de endereço.\n\nVocê vai retirar em: {vendor}\n\nQual método de pagamento? Responda com o número ou nome.',
    ja: '📍 *店舗受け取り*のため、配送先住所は不要です。\n\n受け取り場所: {vendor}\n\n支払い方法は？番号または名前で返信してください。',
  },

  // === MISSING INFO LABELS ===
  'missing.delivery_type': {
    es: 'tipo de entrega',
    en: 'delivery type',
    pt: 'tipo de entrega',
    ja: '配送方法',
  },
  'missing.address': {
    es: 'dirección',
    en: 'address',
    pt: 'endereço',
    ja: '住所',
  },
  'missing.payment': {
    es: 'método de pago',
    en: 'payment method',
    pt: 'método de pagamento',
    ja: '支払い方法',
  },
};

/**
 * Get a translated string, with optional interpolation.
 * Usage: t('cart.added', lang, { vendor: 'Pizza Express', total: '1500' })
 */
export function t(key: string, lang: Language = 'es', vars?: Record<string, string>): string {
  const entry = translations[key];
  if (!entry) {
    console.warn(`⚠️ i18n: Missing key "${key}"`);
    return key;
  }
  
  let text = entry[lang] || entry['es']; // Fallback to Spanish
  
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, v);
    }
  }
  
  return text;
}

/**
 * Detect language from user message using heuristics.
 * Returns detected language or 'es' as default.
 */
export function detectLanguage(text: string): Language {
  const lower = text.toLowerCase().trim();
  
  // Japanese: detect katakana, hiragana, or kanji characters
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text)) {
    return 'ja';
  }
  
  // English keywords (common greetings/phrases)
  const enKeywords = /\b(hello|hi|hey|good morning|good afternoon|how are you|i want|i need|i would like|please|thank you|thanks|order|menu|what|where|help|show me|looking for)\b/i;
  if (enKeywords.test(lower)) {
    return 'en';
  }
  
  // Portuguese keywords
  const ptKeywords = /\b(olá|oi|bom dia|boa tarde|boa noite|como vai|eu quero|preciso|por favor|obrigad[oa]|pedido|cardápio|onde|ajuda|mostre|procuro|quero)\b/i;
  if (ptKeywords.test(lower)) {
    return 'pt';
  }
  
  // Default to Spanish
  return 'es';
}

// Multi-language regex patterns for interceptors
export const CONFIRM_REGEX = /^(s[ií]|si|yes|sim|はい|dale|ok|confirmo|listo|confirmar|confirm|pronto|done)$/i;
export const CANCEL_REGEX = /^(no|nop|cancel|cancela|cancelar|cancelamento|キャンセル|いいえ)$/i;
export const HELP_REGEX = /^(ayuda|help|ajuda|ヘルプ|menu|opciones|que puedo hacer|qué puedo hacer|como funciona|cómo funciona|what can i do|o que posso fazer|\?|info)$/i;

// Payment method detection in multiple languages
export function detectPaymentMethod(text: string): string | null {
  const lower = text.toLowerCase().trim();
  
  if (/\b(efectivo|cash|dinheiro|現金)\b/i.test(lower)) return 'efectivo';
  if (/\b(transferencia|transfer[eê]ncia|transfer|振込)\b/i.test(lower)) return 'transferencia';
  if (/\b(mercadopago|mercado\s*pago|mp)\b/i.test(lower)) return 'mercadopago';
  
  return null;
}

// Confirm/cancel detection in multiple languages
export function isConfirmation(text: string): boolean {
  return CONFIRM_REGEX.test(text.trim());
}

export function isCancellation(text: string): boolean {
  return CANCEL_REGEX.test(text.trim());
}
