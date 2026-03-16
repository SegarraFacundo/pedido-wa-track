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
  'cart.total': {
    es: 'Total',
    en: 'Total',
    pt: 'Total',
    ja: '合計',
  },
  'cart.empty_warning': {
    es: '⚠️ Tu carrito está vacío. No hay nada que confirmar todavía.',
    en: '⚠️ Your cart is empty. Nothing to confirm yet.',
    pt: '⚠️ Seu carrinho está vazio. Nada para confirmar ainda.',
    ja: '⚠️ カートは空です。まだ確定するものがありません。',
  },
  'cart.cleared': {
    es: '🗑️ Carrito vaciado',
    en: '🗑️ Cart cleared',
    pt: '🗑️ Carrinho esvaziado',
    ja: '🗑️ カートをクリアしました',
  },
  'cart.modified': {
    es: '✅ Corregí tu pedido de *{vendor}*:',
    en: '✅ Updated your order from *{vendor}*:',
    pt: '✅ Corrigi seu pedido de *{vendor}*:',
    ja: '✅ *{vendor}*の注文を修正しました:',
  },
  'cart.modify_not_found': {
    es: '❌ No encontré ninguno de esos productos en este negocio.',
    en: '❌ I couldn\'t find any of those products in this store.',
    pt: '❌ Não encontrei nenhum desses produtos nesta loja.',
    ja: '❌ この店舗でそれらの商品は見つかりませんでした。',
  },
  'cart.is_correct': {
    es: '¿Está correcto?',
    en: 'Is this correct?',
    pt: 'Está correto?',
    ja: 'これで正しいですか？',
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
  'summary.no_vendor': {
    es: '⚠️ Error: No hay negocio seleccionado.',
    en: '⚠️ Error: No store selected.',
    pt: '⚠️ Erro: Nenhuma loja selecionada.',
    ja: '⚠️ エラー: 店舗が選択されていません。',
  },
  'summary.updated_at': {
    es: '🕒 Resumen actualizado a las {time}',
    en: '🕒 Summary updated at {time}',
    pt: '🕒 Resumo atualizado às {time}',
    ja: '🕒 概要更新: {time}',
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
  'order.empty_cart': {
    es: 'No podés crear un pedido con el carrito vacío. ¿Querés que te muestre productos disponibles?',
    en: 'You can\'t create an order with an empty cart. Want me to show you available products?',
    pt: 'Não é possível criar um pedido com o carrinho vazio. Quer que eu mostre produtos disponíveis?',
    ja: 'カートが空のまま注文はできません。利用可能な商品を表示しますか？',
  },
  'order.no_vendor': {
    es: 'Error: No hay negocio seleccionado. Por favor elegí un negocio antes de hacer el pedido.',
    en: 'Error: No store selected. Please choose a store before placing the order.',
    pt: 'Erro: Nenhuma loja selecionada. Por favor escolha uma loja antes de fazer o pedido.',
    ja: 'エラー: 店舗が選択されていません。注文前に店舗を選んでください。',
  },
  'order.ask_delivery_type': {
    es: '¿Querés que te enviemos el pedido a domicilio o lo retirás en el local?\n\nRespondé "delivery" o "retiro"',
    en: 'Do you want home delivery or store pickup?\n\nReply "delivery" or "pickup"',
    pt: 'Quer delivery ou retirada na loja?\n\nResponda "delivery" ou "retirada"',
    ja: '自宅配送ですか、店舗受け取りですか？\n\n「配達」または「受け取り」と返信してください',
  },
  'order.need_address_inline': {
    es: 'Por favor indicá tu dirección de entrega.',
    en: 'Please provide your delivery address.',
    pt: 'Por favor informe seu endereço de entrega.',
    ja: '配送先住所を入力してください。',
  },
  'order.payment_validate_error': {
    es: 'Hubo un problema al validar el método de pago. Por favor intentá de nuevo.',
    en: 'There was a problem validating the payment method. Please try again.',
    pt: 'Houve um problema ao validar o método de pagamento. Por favor tente novamente.',
    ja: '支払い方法の確認に問題がありました。もう一度お試しください。',
  },
  'order.store_label': {
    es: '🏪 Negocio: {vendor}',
    en: '🏪 Store: {vendor}',
    pt: '🏪 Loja: {vendor}',
    ja: '🏪 店舗: {vendor}',
  },
  'order.pickup_at': {
    es: '📍 *Retirá en:*',
    en: '📍 *Pick up at:*',
    pt: '📍 *Retire em:*',
    ja: '📍 *受け取り場所:*',
  },
  'order.delivery_note': {
    es: '📌 *Nota:* El negocio confirmará si hace delivery a tu zona.',
    en: '📌 *Note:* The store will confirm if they deliver to your area.',
    pt: '📌 *Nota:* A loja confirmará se entrega na sua região.',
    ja: '📌 *注意:* 店舗が配達エリアを確認します。',
  },
  'order.cash_info': {
    es: '💵 Pagás en efectivo al recibir el pedido.\n\nEl delivery te contactará pronto. 🚚',
    en: '💵 You\'ll pay cash on delivery.\n\nThe delivery person will contact you soon. 🚚',
    pt: '💵 Você paga em dinheiro na entrega.\n\nO entregador entrará em contato em breve. 🚚',
    ja: '💵 商品受取時に現金でお支払いください。\n\n配達員がすぐにご連絡します。🚚',
  },
  'order.transfer_data': {
    es: '📱 *Datos para transferencia:*',
    en: '📱 *Transfer details:*',
    pt: '📱 *Dados para transferência:*',
    ja: '📱 *振込情報:*',
  },
  'order.transfer_confirm_prompt': {
    es: '¿Confirmás que deseas proceder con la *transferencia bancaria* para completar tu pedido? 😊\n\nRespondé *"sí"* para confirmar o *"no"* para cancelar.',
    en: 'Do you confirm you want to proceed with *bank transfer* to complete your order? 😊\n\nReply *"yes"* to confirm or *"no"* to cancel.',
    pt: 'Confirma que deseja prosseguir com a *transferência bancária* para completar seu pedido? 😊\n\nResponda *"sim"* para confirmar ou *"não"* para cancelar.',
    ja: '*銀行振込*で注文を完了しますか？😊\n\n*「はい」*で確定、*「いいえ」*でキャンセル。',
  },
  'order.transfer_data_error': {
    es: '⚠️ Hubo un problema al obtener los datos de transferencia. Por favor contactá al negocio.',
    en: '⚠️ There was a problem getting transfer details. Please contact the store.',
    pt: '⚠️ Houve um problema ao obter os dados de transferência. Por favor entre em contato com a loja.',
    ja: '⚠️ 振込情報の取得に問題がありました。店舗に連絡してください。',
  },
  'order.mp_link_ready': {
    es: '💳 *¡Link de pago listo!*\n\n🔗 {link}\n\n👆 Tocá el link para pagar de forma segura con MercadoPago.\n\nUna vez que completes el pago, recibirás la confirmación automáticamente. 😊',
    en: '💳 *Payment link ready!*\n\n🔗 {link}\n\n👆 Tap the link to pay securely with MercadoPago.\n\nOnce you complete the payment, you\'ll receive automatic confirmation. 😊',
    pt: '💳 *Link de pagamento pronto!*\n\n🔗 {link}\n\n👆 Toque no link para pagar com segurança via MercadoPago.\n\nAssim que completar o pagamento, receberá confirmação automática. 😊',
    ja: '💳 *支払いリンクの準備ができました！*\n\n🔗 {link}\n\n👆 リンクをタップしてMercadoPagoで安全に支払いください。\n\n支払い完了後、自動的に確認が届きます。😊',
  },
  'order.mp_error': {
    es: '⚠️ Hubo un problema al generar el link de pago. El negocio te contactará.',
    en: '⚠️ There was a problem generating the payment link. The store will contact you.',
    pt: '⚠️ Houve um problema ao gerar o link de pagamento. A loja entrará em contato.',
    ja: '⚠️ 支払いリンクの生成に問題がありました。店舗からご連絡します。',
  },
  'order.mp_unavailable': {
    es: '⚠️ MercadoPago no está disponible en este momento.\n\nMétodos de pago alternativos:\n\n',
    en: '⚠️ MercadoPago is not available right now.\n\nAlternative payment methods:\n\n',
    pt: '⚠️ MercadoPago não está disponível no momento.\n\nMétodos de pagamento alternativos:\n\n',
    ja: '⚠️ MercadoPagoは現在利用できません。\n\n代替支払い方法:\n\n',
  },
  'order.mp_link_error': {
    es: '⚠️ No se pudo generar el link de pago. El negocio te contactará para coordinar.',
    en: '⚠️ Could not generate payment link. The store will contact you to coordinate.',
    pt: '⚠️ Não foi possível gerar o link de pagamento. A loja entrará em contato.',
    ja: '⚠️ 支払いリンクを生成できませんでした。店舗からご連絡します。',
  },

  // === STOCK ===
  'stock.out_of_stock': {
    es: '❌ *{product}* está AGOTADO.\n\nElegí otro producto del menú. 😊',
    en: '❌ *{product}* is OUT OF STOCK.\n\nChoose another product from the menu. 😊',
    pt: '❌ *{product}* está ESGOTADO.\n\nEscolha outro produto do cardápio. 😊',
    ja: '❌ *{product}*は在庫切れです。\n\nメニューから他の商品をお選びください。😊',
  },
  'stock.max_reached': {
    es: '⚠️ Ya tenés {count} de *{product}* en el carrito (máximo disponible: {max}).\n\nNo podés agregar más unidades.',
    en: '⚠️ You already have {count} of *{product}* in your cart (max available: {max}).\n\nYou can\'t add more.',
    pt: '⚠️ Você já tem {count} de *{product}* no carrinho (máximo disponível: {max}).\n\nNão é possível adicionar mais.',
    ja: '⚠️ カートに*{product}*が{count}個あります（最大: {max}）。\n\nこれ以上追加できません。',
  },
  'stock.limited': {
    es: '⚠️ Solo hay {available} unidades de *{product}* disponibles.\n\nYa tenés {count} en el carrito. ¿Querés agregar {can_add} más?',
    en: '⚠️ Only {available} units of *{product}* available.\n\nYou already have {count} in your cart. Want to add {can_add} more?',
    pt: '⚠️ Apenas {available} unidades de *{product}* disponíveis.\n\nVocê já tem {count} no carrinho. Quer adicionar {can_add} a mais?',
    ja: '⚠️ *{product}*は{available}個しかありません。\n\nカートに{count}個あります。{can_add}個追加しますか？',
  },
  'stock.limited_interceptor': {
    es: '⚠️ Solo hay {available} unidades de *{product}*. Ya tenés {count} en el carrito.',
    en: '⚠️ Only {available} units of *{product}*. You already have {count} in your cart.',
    pt: '⚠️ Apenas {available} unidades de *{product}*. Você já tem {count} no carrinho.',
    ja: '⚠️ *{product}*は{available}個しかありません。カートに{count}個あります。',
  },
  'stock.max_interceptor': {
    es: '⚠️ Ya tenés {count} de *{product}* (máximo: {max}).',
    en: '⚠️ You already have {count} of *{product}* (max: {max}).',
    pt: '⚠️ Você já tem {count} de *{product}* (máximo: {max}).',
    ja: '⚠️ *{product}*が{count}個あります（最大: {max}）。',
  },
  'stock.issue_header': {
    es: '🚫 *No se puede crear el pedido*\n\nAlgunos productos ya no tienen stock suficiente:\n\n',
    en: '🚫 *Cannot create order*\n\nSome products no longer have enough stock:\n\n',
    pt: '🚫 *Não é possível criar o pedido*\n\nAlguns produtos não têm estoque suficiente:\n\n',
    ja: '🚫 *注文を作成できません*\n\n一部の商品の在庫が不足しています:\n\n',
  },
  'stock.adjust_cart': {
    es: 'Por favor ajustá tu carrito con "modificar carrito" o eliminá los productos sin stock.',
    en: 'Please adjust your cart with "modify cart" or remove out-of-stock products.',
    pt: 'Por favor ajuste seu carrinho com "modificar carrinho" ou remova os produtos sem estoque.',
    ja: '「カートを変更」でカートを調整するか、在庫切れの商品を削除してください。',
  },
  'stock.out_label': {
    es: 'AGOTADO',
    en: 'OUT OF STOCK',
    pt: 'ESGOTADO',
    ja: '在庫切れ',
  },
  'stock.ordered_vs_available': {
    es: 'Pediste {requested}, solo hay {available}',
    en: 'Ordered {requested}, only {available} left',
    pt: 'Pediu {requested}, só há {available}',
    ja: '{requested}個注文、残り{available}個',
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
  'vendors.closed_hint': {
    es: 'no disponibles ahora',
    en: 'not available now',
    pt: 'não disponíveis agora',
    ja: '現在利用不可',
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
  'vendors.address_unavailable': {
    es: 'Dirección no disponible',
    en: 'Address not available',
    pt: 'Endereço não disponível',
    ja: '住所情報なし',
  },
  'vendors.schedule': {
    es: 'Horario',
    en: 'Hours',
    pt: 'Horário',
    ja: '営業時間',
  },
  'vendors.rating': {
    es: 'Rating',
    en: 'Rating',
    pt: 'Rating',
    ja: '評価',
  },
  'vendors.reviews': {
    es: 'reseñas',
    en: 'reviews',
    pt: 'avaliações',
    ja: 'レビュー',
  },
  'vendors.updated_at': {
    es: '🕒 Datos actualizados a las {time}',
    en: '🕒 Data updated at {time}',
    pt: '🕒 Dados atualizados às {time}',
    ja: '🕒 データ更新: {time}',
  },
  'vendors.select_menu': {
    es: '💬 Decime el *número* o *nombre* del negocio para ver su menú. 😊',
    en: '💬 Tell me the *number* or *name* of the store to see the menu. 😊',
    pt: '💬 Diga o *número* ou *nome* da loja para ver o cardápio. 😊',
    ja: '💬 店舗の*番号*か*名前*を教えてください。😊',
  },

  // === SEARCH ===
  'search.no_results': {
    es: 'No encontré negocios abiertos con "{query}".',
    en: 'I couldn\'t find open stores with "{query}".',
    pt: 'Não encontrei lojas abertas com "{query}".',
    ja: '「{query}」に該当する営業中の店舗は見つかりませんでした。',
  },
  'search.results_header': {
    es: 'Encontré estos negocios con "{query}":',
    en: 'I found these stores with "{query}":',
    pt: 'Encontrei estas lojas com "{query}":',
    ja: '「{query}」の検索結果:',
  },
  'search.select_prompt': {
    es: 'Decime el número o nombre del negocio para ver su menú completo.',
    en: 'Tell me the number or name of the store to see the full menu.',
    pt: 'Diga o número ou nome da loja para ver o menu completo.',
    ja: '番号または店名を教えてください。メニューをお見せします。',
  },

  // === MENU ===
  'menu.not_found': {
    es: 'No encontré ese negocio. Por favor usá el ID exacto que te mostré en la lista de locales abiertos.',
    en: 'I couldn\'t find that store. Please use the exact ID I showed you in the list.',
    pt: 'Não encontrei essa loja. Por favor use o ID exato que mostrei na lista.',
    ja: 'その店舗が見つかりませんでした。リストに表示されたIDをお使いください。',
  },
  'menu.no_products': {
    es: '{vendor} no tiene productos disponibles en este momento. 😔\n\nPodés buscar otros negocios con productos disponibles.',
    en: '{vendor} has no products available right now. 😔\n\nYou can search for other stores with available products.',
    pt: '{vendor} não tem produtos disponíveis no momento. 😔\n\nVocê pode buscar outras lojas com produtos disponíveis.',
    ja: '{vendor}には現在利用可能な商品がありません。😔\n\n他の店舗を検索できます。',
  },
  'menu.fetch_error': {
    es: 'Hubo un error al buscar los productos de "{vendor}". Por favor intentá de nuevo.',
    en: 'There was an error fetching products from "{vendor}". Please try again.',
    pt: 'Houve um erro ao buscar os produtos de "{vendor}". Por favor tente novamente.',
    ja: '「{vendor}」の商品取得中にエラーが発生しました。もう一度お試しください。',
  },
  'menu.delivery_and_pickup': {
    es: '🚚 Delivery y 🏪 Retiro',
    en: '🚚 Delivery & 🏪 Pickup',
    pt: '🚚 Delivery e 🏪 Retirada',
    ja: '🚚 配達 & 🏪 受け取り',
  },
  'menu.pickup_only': {
    es: 'Solo 🏪 Retiro',
    en: '🏪 Pickup only',
    pt: 'Apenas 🏪 Retirada',
    ja: '🏪 受け取りのみ',
  },
  'menu.delivery_only': {
    es: 'Solo 🚚 Delivery',
    en: '🚚 Delivery only',
    pt: 'Apenas 🚚 Delivery',
    ja: '🚚 配達のみ',
  },
  'menu.out_of_stock': {
    es: 'AGOTADO',
    en: 'OUT OF STOCK',
    pt: 'ESGOTADO',
    ja: '在庫切れ',
  },
  'menu.low_stock': {
    es: 'disponibles',
    en: 'available',
    pt: 'disponíveis',
    ja: '在庫あり',
  },
  'menu.updated_at': {
    es: '🕒 Menú actualizado: {time}',
    en: '🕒 Menu updated: {time}',
    pt: '🕒 Cardápio atualizado: {time}',
    ja: '🕒 メニュー更新: {time}',
  },
  'menu.one_at_a_time': {
    es: '⚠️ Solo puedo mostrarte un menú a la vez. Elegí un negocio de la lista y te muestro su menú.',
    en: '⚠️ I can only show one menu at a time. Pick a store from the list and I\'ll show you its menu.',
    pt: '⚠️ Só posso mostrar um cardápio por vez. Escolha uma loja da lista e mostrarei o cardápio.',
    ja: '⚠️ メニューは一度に1つだけ表示できます。リストからお店を選んでください。',
  },
  'menu.already_viewing': {
    es: '⚠️ El usuario ya está viendo este menú. Interpretá su mensaje como un pedido de producto y usá agregar_al_carrito.',
    en: '⚠️ The user is already viewing this menu. Interpret their message as a product order and use agregar_al_carrito.',
    pt: '⚠️ O usuário já está vendo este cardápio. Interprete a mensagem como pedido de produto e use agregar_al_carrito.',
    ja: '⚠️ ユーザーはすでにこのメニューを表示しています。メッセージを商品注文として解釈し、agregar_al_carritoを使用してください。',
  },

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
  'delivery.no_pickup': {
    es: '⚠️ {vendor} no acepta retiro en local. Solo delivery.',
    en: '⚠️ {vendor} does not accept store pickup. Delivery only.',
    pt: '⚠️ {vendor} não aceita retirada na loja. Apenas delivery.',
    ja: '⚠️ {vendor}は店舗受け取りに対応していません。配達のみです。',
  },
  'delivery.no_delivery': {
    es: '⚠️ {vendor} no hace delivery. Solo retiro en local.',
    en: '⚠️ {vendor} does not do delivery. Pickup only.',
    pt: '⚠️ {vendor} não faz delivery. Apenas retirada na loja.',
    ja: '⚠️ {vendor}は配達に対応していません。店舗受け取りのみです。',
  },
  'delivery.pickup_set': {
    es: '✅ Perfecto! Tu pedido será para *retiro en local*.',
    en: '✅ Perfect! Your order will be for *store pickup*.',
    pt: '✅ Perfeito! Seu pedido será para *retirada na loja*.',
    ja: '✅ 了解！*店舗受け取り*で注文します。',
  },
  'delivery.pickup_location': {
    es: '📍 *Retirá en:*',
    en: '📍 *Pick up at:*',
    pt: '📍 *Retire em:*',
    ja: '📍 *受け取り場所:*',
  },
  'delivery.instructions': {
    es: '📝 *Instrucciones:*',
    en: '📝 *Instructions:*',
    pt: '📝 *Instruções:*',
    ja: '📝 *注意事項:*',
  },
  'delivery.type_set': {
    es: '✅ Tipo de entrega seleccionado: *{type}*',
    en: '✅ Delivery type selected: *{type}*',
    pt: '✅ Tipo de entrega selecionado: *{type}*',
    ja: '✅ 配送方法を選択: *{type}*',
  },
  'delivery.pickup_label': {
    es: 'Retiro en local',
    en: 'Store pickup',
    pt: 'Retirada na loja',
    ja: '店舗受け取り',
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
  'payment.need_vendor': {
    es: 'Primero tenés que elegir un negocio. ¿Querés ver los negocios disponibles?',
    en: 'You need to choose a store first. Want to see available stores?',
    pt: 'Primeiro você precisa escolher uma loja. Quer ver as lojas disponíveis?',
    ja: 'まず店舗を選んでください。利用可能な店舗を表示しますか？',
  },
  'payment.fetch_error': {
    es: 'Hubo un problema al obtener los métodos de pago del negocio.',
    en: 'There was a problem getting the store\'s payment methods.',
    pt: 'Houve um problema ao obter os métodos de pagamento da loja.',
    ja: '店舗の支払い方法の取得に問題がありました。',
  },
  'payment.not_configured': {
    es: '⚠️ {vendor} todavía no configuró métodos de pago. Por favor contactá directamente con el negocio.',
    en: '⚠️ {vendor} hasn\'t set up payment methods yet. Please contact the store directly.',
    pt: '⚠️ {vendor} ainda não configurou métodos de pagamento. Por favor entre em contato com a loja.',
    ja: '⚠️ {vendor}はまだ支払い方法を設定していません。店舗に直接お問い合わせください。',
  },
  'payment.single_available': {
    es: 'Tenés disponible el siguiente método de pago:',
    en: 'The following payment method is available:',
    pt: 'O seguinte método de pagamento está disponível:',
    ja: '以下の支払い方法が利用可能です:',
  },
  'payment.multiple_available': {
    es: 'Estos son los métodos de pago disponibles:',
    en: 'These are the available payment methods:',
    pt: 'Estes são os métodos de pagamento disponíveis:',
    ja: '利用可能な支払い方法:',
  },
  'payment.choose': {
    es: 'Elegí uno (podés escribir el número o el nombre). 😊',
    en: 'Choose one (you can type the number or name). 😊',
    pt: 'Escolha um (pode escrever o número ou nome). 😊',
    ja: '選択してください（番号または名前を入力）。😊',
  },
  'payment.updated_at': {
    es: '🕒 Lista de pagos actualizada: {time}',
    en: '🕒 Payment list updated: {time}',
    pt: '🕒 Lista de pagamentos atualizada: {time}',
    ja: '🕒 支払い一覧更新: {time}',
  },
  'payment.need_methods': {
    es: '⚠️ Primero necesito ver qué métodos de pago acepta el negocio. Dame un momento...',
    en: '⚠️ First I need to check which payment methods the store accepts. One moment...',
    pt: '⚠️ Primeiro preciso ver quais métodos de pagamento a loja aceita. Um momento...',
    ja: '⚠️ まず店舗が受け付ける支払い方法を確認します。少々お待ちください...',
  },
  'payment.not_available': {
    es: '❌ "{method}" no está disponible para este negocio.\n\nMétodos disponibles:\n{available}',
    en: '❌ "{method}" is not available for this store.\n\nAvailable methods:\n{available}',
    pt: '❌ "{method}" não está disponível para esta loja.\n\nMétodos disponíveis:\n{available}',
    ja: '❌ 「{method}」はこの店舗では利用できません。\n\n利用可能な方法:\n{available}',
  },
  'payment.need_confirm': {
    es: '⚠️ Primero necesito que confirmes tu método de pago.',
    en: '⚠️ First I need you to confirm your payment method.',
    pt: '⚠️ Primeiro preciso que confirme seu método de pagamento.',
    ja: '⚠️ まず支払い方法を確認してください。',
  },
  'payment.choose_available': {
    es: '⚠️ Por favor elegí uno de los métodos de pago disponibles:\n\n{methods}',
    en: '⚠️ Please choose one of the available payment methods:\n\n{methods}',
    pt: '⚠️ Por favor escolha um dos métodos de pagamento disponíveis:\n\n{methods}',
    ja: '⚠️ 利用可能な支払い方法から選択してください:\n\n{methods}',
  },
  'payment.invalid_with_hint': {
    es: '⚠️ El método de pago "{method}" no está disponible en {vendor}.\n\nPor favor usá ver_metodos_pago para ver las opciones reales disponibles.',
    en: '⚠️ The payment method "{method}" is not available at {vendor}.\n\nPlease use view_payment_methods to see real available options.',
    pt: '⚠️ O método de pagamento "{method}" não está disponível em {vendor}.\n\nPor favor use ver_metodos_pago para ver as opções disponíveis.',
    ja: '⚠️ 支払い方法「{method}」は{vendor}では利用できません。\n\n利用可能なオプションを確認してください。',
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

  // === SHOPPING ===
  'shopping.need_menu': {
    es: '⚠️ Para agregar productos, primero necesito mostrarte el menú.\n\n¿De qué negocio querés ver el menú?',
    en: '⚠️ To add products, I need to show you the menu first.\n\nWhich store\'s menu would you like to see?',
    pt: '⚠️ Para adicionar produtos, preciso mostrar o cardápio primeiro.\n\nDe qual loja quer ver o cardápio?',
    ja: '⚠️ 商品を追加するには、まずメニューを表示する必要があります。\n\nどの店舗のメニューを見ますか？',
  },
  'shopping.need_vendor': {
    es: '⚠️ Necesito que elijas un negocio primero. ¿Cuál negocio te interesa?',
    en: '⚠️ I need you to choose a store first. Which store are you interested in?',
    pt: '⚠️ Preciso que escolha uma loja primeiro. Qual loja te interessa?',
    ja: '⚠️ まず店舗を選んでください。どの店舗に興味がありますか？',
  },
  'shopping.vendor_error': {
    es: 'Hubo un error al validar el negocio. Por favor intentá de nuevo.',
    en: 'There was an error validating the store. Please try again.',
    pt: 'Houve um erro ao validar a loja. Por favor tente novamente.',
    ja: '店舗の検証中にエラーが発生しました。もう一度お試しください。',
  },
  'shopping.vendor_unavailable': {
    es: 'El negocio seleccionado ya no está disponible. Por favor elegí otro negocio.',
    en: 'The selected store is no longer available. Please choose another store.',
    pt: 'A loja selecionada não está mais disponível. Por favor escolha outra loja.',
    ja: '選択した店舗は利用できなくなりました。他の店舗をお選びください。',
  },
  'shopping.vendor_inactive': {
    es: '❌ El negocio "{vendor}" no está disponible en este momento.\n\nPor favor elegí otro negocio de los disponibles.',
    en: '❌ The store "{vendor}" is not available right now.\n\nPlease choose another available store.',
    pt: '❌ A loja "{vendor}" não está disponível no momento.\n\nPor favor escolha outra loja disponível.',
    ja: '❌ 「{vendor}」は現在利用できません。\n\n他の利用可能な店舗をお選びください。',
  },
  'shopping.wrong_vendor': {
    es: '⚠️ Ese producto no pertenece a {vendor}.\n\nSolo podés agregar productos de un negocio a la vez. 🏪',
    en: '⚠️ That product doesn\'t belong to {vendor}.\n\nYou can only add products from one store at a time. 🏪',
    pt: '⚠️ Esse produto não pertence a {vendor}.\n\nVocê só pode adicionar produtos de uma loja por vez. 🏪',
    ja: '⚠️ その商品は{vendor}のものではありません。\n\n一度に1つの店舗の商品のみ追加できます。🏪',
  },
  'shopping.cart_vendor_mismatch': {
    es: '⚠️ Error interno: Detecté productos de otro negocio en el carrito. Por favor vacía el carrito con "vaciar carrito" antes de agregar productos de otro negocio.',
    en: '⚠️ Internal error: Products from another store detected in cart. Please empty your cart with "empty cart" first.',
    pt: '⚠️ Erro interno: Produtos de outra loja detectados no carrinho. Por favor esvazie o carrinho antes.',
    ja: '⚠️ 内部エラー: カートに別の店舗の商品があります。「カートを空にする」でカートをクリアしてください。',
  },
  'shopping.product_not_found': {
    es: '❌ No encontré ese producto en el menú de *{vendor}*.\n\n📋 Productos disponibles:\n{products}\n\nPor favor, elegí uno de estos productos. 😊',
    en: '❌ I couldn\'t find that product in *{vendor}*\'s menu.\n\n📋 Available products:\n{products}\n\nPlease choose one of these products. 😊',
    pt: '❌ Não encontrei esse produto no cardápio de *{vendor}*.\n\n📋 Produtos disponíveis:\n{products}\n\nPor favor, escolha um destes produtos. 😊',
    ja: '❌ *{vendor}*のメニューにその商品は見つかりませんでした。\n\n📋 利用可能な商品:\n{products}\n\nこれらの商品から選んでください。😊',
  },
  'shopping.no_products_available': {
    es: 'No hay productos disponibles',
    en: 'No products available',
    pt: 'Não há produtos disponíveis',
    ja: '利用可能な商品はありません',
  },
  'shopping.need_vendor_first': {
    es: '⚠️ Primero tenés que elegir un negocio. ¿De dónde querés pedir?',
    en: '⚠️ You need to choose a store first. Where do you want to order from?',
    pt: '⚠️ Primeiro você precisa escolher uma loja. De onde quer pedir?',
    ja: '⚠️ まず店舗を選んでください。どこから注文しますか？',
  },
  'shopping.need_vendor_modify': {
    es: '⚠️ Primero necesito que elijas un negocio.',
    en: '⚠️ I need you to choose a store first.',
    pt: '⚠️ Primeiro preciso que escolha uma loja.',
    ja: '⚠️ まず店舗を選んでください。',
  },

  // === VENDOR CHANGE ===
  'vendor_change.warning': {
    es: '⚠️ *¡Atención!*\n\nTenés {count} producto(s) en el carrito de *{current_vendor}*:\n\n{items}\n\n💰 Total actual: ${total}\n\nSi querés ver el menú de *{new_vendor}*, voy a tener que *vaciar tu carrito actual*.\n\n¿Querés cambiar de negocio?\n\n✅ Escribe *"sí"* para vaciar el carrito y cambiar a {new_vendor}\n❌ Escribe *"no"* para seguir con tu pedido de {current_vendor}',
    en: '⚠️ *Attention!*\n\nYou have {count} product(s) in *{current_vendor}*\'s cart:\n\n{items}\n\n💰 Current total: ${total}\n\nTo view *{new_vendor}*\'s menu, I\'ll need to *empty your current cart*.\n\nWant to switch stores?\n\n✅ Type *"yes"* to empty cart and switch to {new_vendor}\n❌ Type *"no"* to continue with {current_vendor}',
    pt: '⚠️ *Atenção!*\n\nVocê tem {count} produto(s) no carrinho de *{current_vendor}*:\n\n{items}\n\n💰 Total atual: ${total}\n\nPara ver o cardápio de *{new_vendor}*, vou precisar *esvaziar seu carrinho*.\n\nQuer trocar de loja?\n\n✅ Escreva *"sim"* para esvaziar e trocar para {new_vendor}\n❌ Escreva *"não"* para continuar com {current_vendor}',
    ja: '⚠️ *注意！*\n\n*{current_vendor}*のカートに{count}個の商品があります:\n\n{items}\n\n💰 現在の合計: ${total}\n\n*{new_vendor}*のメニューを見るには、*現在のカートをクリア*する必要があります。\n\n店舗を変更しますか？\n\n✅ *「はい」*でカートをクリアして{new_vendor}に変更\n❌ *「いいえ」*で{current_vendor}を続ける',
  },
  'vendor_change.confirmed': {
    es: '✅ Perfecto, carrito vaciado.\n\nAhora estás viendo el menú de *{vendor}*.\n\n¿Qué querés pedir? 🍕',
    en: '✅ Perfect, cart cleared.\n\nNow you\'re viewing *{vendor}*\'s menu.\n\nWhat would you like to order? 🍕',
    pt: '✅ Perfeito, carrinho esvaziado.\n\nAgora você está vendo o cardápio de *{vendor}*.\n\n O que gostaria de pedir? 🍕',
    ja: '✅ カートをクリアしました。\n\n*{vendor}*のメニューを表示しています。\n\n何を注文しますか？🍕',
  },
  'vendor_change.cancelled': {
    es: 'Ok, seguimos con {vendor}. ¿Qué más querés agregar al pedido?',
    en: 'Ok, let\'s continue with {vendor}. What else would you like to add?',
    pt: 'Ok, continuamos com {vendor}. O que mais quer adicionar ao pedido?',
    ja: 'OK、{vendor}を続けます。他に何を追加しますか？',
  },
  'vendor_change.clarify': {
    es: 'Por favor confirmá si querés cambiar de negocio.\n\nRespondé *"sí"* para cambiar a {new_vendor} o *"no"* para seguir con {current_vendor}.',
    en: 'Please confirm if you want to switch stores.\n\nReply *"yes"* to switch to {new_vendor} or *"no"* to stay with {current_vendor}.',
    pt: 'Por favor confirme se quer trocar de loja.\n\nResponda *"sim"* para trocar para {new_vendor} ou *"não"* para continuar com {current_vendor}.',
    ja: '店舗を変更するか確認してください。\n\n*「はい」*で{new_vendor}に変更、*「いいえ」*で{current_vendor}を続ける。',
  },

  // === ACTIVE ORDER ===
  'active_order.blocked': {
    es: '⏳ Ya tenés un pedido activo (#{id}) en estado *{status}*.\n\n📊 Podés:\n- Decir "estado de mi pedido" para ver cómo va\n- Decir "cancelar pedido" si querés cancelarlo\n\nUna vez completado o cancelado, podés hacer un nuevo pedido. 😊',
    en: '⏳ You already have an active order (#{id}) with status *{status}*.\n\n📊 You can:\n- Say "order status" to check progress\n- Say "cancel order" to cancel it\n\nOnce completed or cancelled, you can place a new order. 😊',
    pt: '⏳ Você já tem um pedido ativo (#{id}) com status *{status}*.\n\n📊 Você pode:\n- Dizer "status do pedido" para acompanhar\n- Dizer "cancelar pedido" para cancelá-lo\n\nAssim que concluído ou cancelado, pode fazer um novo pedido. 😊',
    ja: '⏳ アクティブな注文があります (#{id})、状態: *{status}*。\n\n📊 以下が可能です:\n- 「注文状況」で進捗確認\n- 「注文キャンセル」でキャンセル\n\n完了またはキャンセル後に新しい注文ができます。😊',
  },
  'active_order.fallback': {
    es: '⏳ Tenés un pedido activo (#{id}).\n\nPuedo ayudarte con:\n- "estado de mi pedido"\n- "cancelar pedido"\n- "hablar con vendedor"',
    en: '⏳ You have an active order (#{id}).\n\nI can help you with:\n- "order status"\n- "cancel order"\n- "talk to vendor"',
    pt: '⏳ Você tem um pedido ativo (#{id}).\n\nPosso ajudar com:\n- "status do pedido"\n- "cancelar pedido"\n- "falar com vendedor"',
    ja: '⏳ アクティブな注文があります (#{id})。\n\n以下でお手伝いできます:\n- 「注文状況」\n- 「注文キャンセル」\n- 「店舗に連絡」',
  },

  // === CANCEL ===
  'cancel.ask_reason': {
    es: '¿Por qué querés cancelar el pedido? Escribí el motivo:',
    en: 'Why do you want to cancel the order? Write the reason:',
    pt: 'Por que quer cancelar o pedido? Escreva o motivo:',
    ja: '注文をキャンセルする理由を教えてください:',
  },
  'cancel.confirm_prompt': {
    es: 'Vas a cancelar el pedido #{id}.\n📝 Motivo: "{reason}"\n\n¿Confirmás la cancelación? (sí/no)',
    en: 'You\'re about to cancel order #{id}.\n📝 Reason: "{reason}"\n\nConfirm cancellation? (yes/no)',
    pt: 'Você vai cancelar o pedido #{id}.\n📝 Motivo: "{reason}"\n\nConfirma o cancelamento? (sim/não)',
    ja: '注文#{id}をキャンセルします。\n📝 理由: 「{reason}」\n\nキャンセルを確定しますか？（はい/いいえ）',
  },
  'cancel.keep': {
    es: 'Ok, no se cancela el pedido. ¿Necesitás algo más? 😊',
    en: 'Ok, order not cancelled. Need anything else? 😊',
    pt: 'Ok, pedido não cancelado. Precisa de mais alguma coisa? 😊',
    ja: 'OK、注文はキャンセルしません。他にお手伝いできることはありますか？😊',
  },
  'cancel.confirm_clarify': {
    es: 'Respondé *"sí"* para confirmar la cancelación o *"no"* para mantener el pedido.',
    en: 'Reply *"yes"* to confirm cancellation or *"no"* to keep the order.',
    pt: 'Responda *"sim"* para confirmar o cancelamento ou *"não"* para manter o pedido.',
    ja: '*「はい」*でキャンセル確定、*「いいえ」*で注文を維持。',
  },
  'cancel.no_active': {
    es: 'No encontré ningún pedido activo para cancelar.',
    en: 'I couldn\'t find any active order to cancel.',
    pt: 'Não encontrei nenhum pedido ativo para cancelar.',
    ja: 'キャンセルできるアクティブな注文が見つかりませんでした。',
  },
  'cancel.not_found': {
    es: 'No encontré un pedido con ID #{id}',
    en: 'I couldn\'t find an order with ID #{id}',
    pt: 'Não encontrei um pedido com ID #{id}',
    ja: 'ID #{id}の注文が見つかりませんでした',
  },
  'cancel.not_found2': {
    es: 'No encontré ese pedido. Por favor verificá el número de pedido.',
    en: 'I couldn\'t find that order. Please verify the order number.',
    pt: 'Não encontrei esse pedido. Por favor verifique o número do pedido.',
    ja: 'その注文が見つかりませんでした。注文番号を確認してください。',
  },
  'cancel.not_yours': {
    es: 'Este pedido no te pertenece.',
    en: 'This order doesn\'t belong to you.',
    pt: 'Este pedido não pertence a você.',
    ja: 'この注文はあなたのものではありません。',
  },
  'cancel.already_cancelled': {
    es: 'Este pedido ya está cancelado.',
    en: 'This order is already cancelled.',
    pt: 'Este pedido já está cancelado.',
    ja: 'この注文はすでにキャンセルされています。',
  },
  'cancel.cannot_cancel': {
    es: 'No se puede cancelar un pedido que ya está "{status}".',
    en: 'You cannot cancel an order that is already "{status}".',
    pt: 'Não é possível cancelar um pedido que já está "{status}".',
    ja: '「{status}」の注文はキャンセルできません。',
  },
  'cancel.success': {
    es: '✅ Pedido #{id} cancelado.\n📝 Motivo: {reason}\n\nEl vendedor ha sido notificado.\n\n¿Querés hacer un nuevo pedido? 😊',
    en: '✅ Order #{id} cancelled.\n📝 Reason: {reason}\n\nThe vendor has been notified.\n\nWant to place a new order? 😊',
    pt: '✅ Pedido #{id} cancelado.\n📝 Motivo: {reason}\n\nO vendedor foi notificado.\n\nQuer fazer um novo pedido? 😊',
    ja: '✅ 注文#{id}がキャンセルされました。\n📝 理由: {reason}\n\n店舗に通知しました。\n\n新しい注文をしますか？😊',
  },

  // === ORDER STATUS ===
  'status.header': {
    es: '📊 *Estado de tu pedido*',
    en: '📊 *Your order status*',
    pt: '📊 *Status do seu pedido*',
    ja: '📊 *注文状況*',
  },
  'status.pending': {
    es: '⏳ Pendiente',
    en: '⏳ Pending',
    pt: '⏳ Pendente',
    ja: '⏳ 保留中',
  },
  'status.confirmed': {
    es: '✅ Confirmado',
    en: '✅ Confirmed',
    pt: '✅ Confirmado',
    ja: '✅ 確認済み',
  },
  'status.preparing': {
    es: '👨‍🍳 En preparación',
    en: '👨‍🍳 Preparing',
    pt: '👨‍🍳 Em preparação',
    ja: '👨‍🍳 準備中',
  },
  'status.ready': {
    es: '🎉 Listo para entregar',
    en: '🎉 Ready for delivery',
    pt: '🎉 Pronto para entrega',
    ja: '🎉 配達準備完了',
  },
  'status.delivered': {
    es: '✅ Entregado',
    en: '✅ Delivered',
    pt: '✅ Entregue',
    ja: '✅ 配達完了',
  },
  'status.cancelled': {
    es: '❌ Cancelado',
    en: '❌ Cancelled',
    pt: '❌ Cancelado',
    ja: '❌ キャンセル済み',
  },
  'status.not_found': {
    es: 'No tengo ningún pedido tuyo registrado recientemente. ¿Querés hacer un nuevo pedido?',
    en: 'I don\'t have any recent orders from you. Want to place a new order?',
    pt: 'Não tenho nenhum pedido seu registrado recentemente. Quer fazer um novo pedido?',
    ja: '最近の注文記録がありません。新しい注文をしますか？',
  },
  'status.not_found2': {
    es: 'No encontré ese pedido. ¿Querés que te ayude con algo más?',
    en: 'I couldn\'t find that order. Can I help with something else?',
    pt: 'Não encontrei esse pedido. Posso ajudar com mais alguma coisa?',
    ja: 'その注文が見つかりませんでした。他にお手伝いできることはありますか？',
  },
  'status.updated_at': {
    es: '🕒 Actualizado hoy {time}',
    en: '🕒 Updated today {time}',
    pt: '🕒 Atualizado hoje {time}',
    ja: '🕒 本日{time}更新',
  },

  // === OFFERS ===
  'offers.no_offers_vendor': {
    es: 'Este negocio no tiene ofertas activas en este momento.',
    en: 'This store has no active offers right now.',
    pt: 'Esta loja não tem ofertas ativas no momento.',
    ja: 'この店舗には現在有効なオファーはありません。',
  },
  'offers.no_offers': {
    es: 'No hay ofertas disponibles en este momento. 😔',
    en: 'No offers available right now. 😔',
    pt: 'Não há ofertas disponíveis no momento. 😔',
    ja: '現在利用可能なオファーはありません。😔',
  },
  'offers.count': {
    es: '🎁 {count} ofertas disponibles:',
    en: '🎁 {count} offers available:',
    pt: '🎁 {count} ofertas disponíveis:',
    ja: '🎁 {count}件のオファー:',
  },
  'offers.count_single': {
    es: '🎁 Oferta disponible:',
    en: '🎁 Offer available:',
    pt: '🎁 Oferta disponível:',
    ja: '🎁 オファー:',
  },
  'offers.price_before': {
    es: 'Antes',
    en: 'Was',
    pt: 'Antes',
    ja: '元の価格',
  },
  'offers.price_now': {
    es: 'Ahora',
    en: 'Now',
    pt: 'Agora',
    ja: '現在',
  },
  'offers.valid_until': {
    es: 'Válido hasta',
    en: 'Valid until',
    pt: 'Válido até',
    ja: '有効期限',
  },

  // === CHAT ===
  'chat.need_vendor': {
    es: 'Primero necesito que selecciones un negocio. Podés buscar productos o locales para elegir con quién querés hablar.',
    en: 'First I need you to select a store. You can search for products or stores to choose who to talk to.',
    pt: 'Primeiro preciso que selecione uma loja. Pode buscar produtos ou lojas para escolher com quem falar.',
    ja: 'まず店舗を選択してください。商品や店舗を検索して話したい相手を選べます。',
  },
  'chat.vendor_not_found': {
    es: 'No pude encontrar el negocio seleccionado. Por favor buscá locales o productos de nuevo.',
    en: 'I couldn\'t find the selected store. Please search for stores or products again.',
    pt: 'Não encontrei a loja selecionada. Por favor busque lojas ou produtos novamente.',
    ja: '選択した店舗が見つかりませんでした。店舗や商品を再検索してください。',
  },
  'chat.error': {
    es: 'Hubo un problema al conectar con el negocio. Por favor intentá de nuevo.',
    en: 'There was a problem connecting with the store. Please try again.',
    pt: 'Houve um problema ao conectar com a loja. Por favor tente novamente.',
    ja: '店舗との接続に問題がありました。もう一度お試しください。',
  },
  'chat.connected': {
    es: '👤 *Conectando con {vendor}*\n\nUn representante del negocio te atenderá en breve. Los mensajes que envíes ahora irán directamente al vendedor.\n\nPara volver al bot automático, el vendedor puede reactivarlo desde su panel.',
    en: '👤 *Connecting with {vendor}*\n\nA store representative will assist you shortly. Messages you send now will go directly to the vendor.\n\nTo return to the bot, the vendor can reactivate it from their panel.',
    pt: '👤 *Conectando com {vendor}*\n\nUm representante da loja vai atender você em breve. As mensagens que enviar agora irão diretamente para o vendedor.\n\nPara voltar ao bot, o vendedor pode reativá-lo do painel.',
    ja: '👤 *{vendor}に接続中*\n\n店舗の担当者がまもなく対応します。送信するメッセージは直接店舗に届きます。\n\nボットに戻るには、店舗側でパネルから再有効化できます。',
  },

  // === RATING ===
  'rating.prompt_order': {
    es: '⭐ ¡Genial que quieras calificar tu pedido!\n\nEnviame 3 números del 1 al 5 separados por guión:\n*Entrega - Atención - Producto*\n\nEjemplo: *4-5-3*\n\nOpcionalmente podés agregar un comentario después.',
    en: '⭐ Great that you want to rate your order!\n\nSend me 3 numbers from 1 to 5 separated by dashes:\n*Delivery - Service - Product*\n\nExample: *4-5-3*\n\nYou can optionally add a comment after.',
    pt: '⭐ Que bom que quer avaliar seu pedido!\n\nEnvie 3 números de 1 a 5 separados por traço:\n*Entrega - Atendimento - Produto*\n\nExemplo: *4-5-3*\n\nOpcionalmente adicione um comentário depois.',
    ja: '⭐ 注文を評価いただけるのですね！\n\n1～5の数字を3つハイフンで区切って送ってください:\n*配達 - サービス - 商品*\n\n例: *4-5-3*\n\nコメントも追加できます。',
  },
  'rating.prompt_platform': {
    es: '⭐ ¡Gracias por querer calificar a Lapacho!\n\nEnviame un número del 1 al 5:\n1 ⭐ = Malo\n2 ⭐⭐ = Regular\n3 ⭐⭐⭐ = Bueno\n4 ⭐⭐⭐⭐ = Muy bueno\n5 ⭐⭐⭐⭐⭐ = Excelente\n\nPodés agregar un comentario después del número.',
    en: '⭐ Thanks for wanting to rate Lapacho!\n\nSend me a number from 1 to 5:\n1 ⭐ = Bad\n2 ⭐⭐ = Fair\n3 ⭐⭐⭐ = Good\n4 ⭐⭐⭐⭐ = Very good\n5 ⭐⭐⭐⭐⭐ = Excellent\n\nYou can add a comment after the number.',
    pt: '⭐ Obrigado por querer avaliar o Lapacho!\n\nEnvie um número de 1 a 5:\n1 ⭐ = Ruim\n2 ⭐⭐ = Regular\n3 ⭐⭐⭐ = Bom\n4 ⭐⭐⭐⭐ = Muito bom\n5 ⭐⭐⭐⭐⭐ = Excelente\n\nVocê pode adicionar um comentário após o número.',
    ja: '⭐ Lapachoを評価いただきありがとうございます！\n\n1～5の数字を送ってください:\n1 ⭐ = 悪い\n2 ⭐⭐ = まあまあ\n3 ⭐⭐⭐ = 良い\n4 ⭐⭐⭐⭐ = とても良い\n5 ⭐⭐⭐⭐⭐ = 素晴らしい\n\n数字の後にコメントを追加できます。',
  },
  'rating.need_rating': {
    es: 'Por favor proporciona al menos una calificación (delivery, atención o producto) o un comentario.',
    en: 'Please provide at least one rating (delivery, service or product) or a comment.',
    pt: 'Por favor forneça pelo menos uma avaliação (entrega, atendimento ou produto) ou um comentário.',
    ja: '少なくとも1つの評価（配達、サービス、商品）またはコメントを入力してください。',
  },
  'rating.no_order': {
    es: 'No encontré ningún pedido reciente para calificar.',
    en: 'I couldn\'t find any recent order to rate.',
    pt: 'Não encontrei nenhum pedido recente para avaliar.',
    ja: '評価できる最近の注文が見つかりませんでした。',
  },
  'rating.save_error': {
    es: 'Hubo un error al guardar tu calificación. Por favor intenta de nuevo.',
    en: 'There was an error saving your rating. Please try again.',
    pt: 'Houve um erro ao salvar sua avaliação. Por favor tente novamente.',
    ja: '評価の保存中にエラーが発生しました。もう一度お試しください。',
  },
  'rating.thanks': {
    es: '⭐ *¡Gracias por tu calificación!*\n\n📊 *Tu calificación:*',
    en: '⭐ *Thanks for your rating!*\n\n📊 *Your rating:*',
    pt: '⭐ *Obrigado pela sua avaliação!*\n\n📊 *Sua avaliação:*',
    ja: '⭐ *評価ありがとうございます！*\n\n📊 *あなたの評価:*',
  },
  'rating.delivery': {
    es: '🚚 Tiempo de entrega',
    en: '🚚 Delivery time',
    pt: '🚚 Tempo de entrega',
    ja: '🚚 配達時間',
  },
  'rating.service': {
    es: '👥 Atención',
    en: '👥 Service',
    pt: '👥 Atendimento',
    ja: '👥 サービス',
  },
  'rating.product': {
    es: '📦 Producto',
    en: '📦 Product',
    pt: '📦 Produto',
    ja: '📦 商品',
  },
  'rating.comment': {
    es: '💬 Comentario',
    en: '💬 Comment',
    pt: '💬 Comentário',
    ja: '💬 コメント',
  },
  'rating.helps': {
    es: 'Tu opinión nos ayuda a mejorar. ¡Gracias por confiar en nosotros! 😊',
    en: 'Your feedback helps us improve. Thanks for trusting us! 😊',
    pt: 'Sua opinião nos ajuda a melhorar. Obrigado por confiar em nós! 😊',
    ja: 'ご意見は改善に役立ちます。ご利用ありがとうございます！😊',
  },

  // === PLATFORM RATING ===
  'platform.invalid_rating': {
    es: 'Por favor proporciona una calificación válida entre 1 y 5 estrellas.',
    en: 'Please provide a valid rating between 1 and 5 stars.',
    pt: 'Por favor forneça uma avaliação válida entre 1 e 5 estrelas.',
    ja: '1から5の星で有効な評価を入力してください。',
  },
  'platform.save_error': {
    es: 'Hubo un error al guardar tu reseña. Por favor intenta de nuevo.',
    en: 'There was an error saving your review. Please try again.',
    pt: 'Houve um erro ao salvar sua resenha. Por favor tente novamente.',
    ja: 'レビューの保存中にエラーが発生しました。もう一度お試しください。',
  },
  'platform.thanks': {
    es: '🌟 *¡Gracias por tu reseña de Lapacho!*',
    en: '🌟 *Thanks for your Lapacho review!*',
    pt: '🌟 *Obrigado pela sua resenha do Lapacho!*',
    ja: '🌟 *Lapachoのレビューありがとうございます！*',
  },
  'platform.helps': {
    es: '¡Tu opinión nos ayuda a mejorar la plataforma! 😊',
    en: 'Your feedback helps us improve the platform! 😊',
    pt: 'Sua opinião nos ajuda a melhorar a plataforma! 😊',
    ja: 'ご意見はプラットフォームの改善に役立ちます！😊',
  },

  // === SUPPORT TICKET ===
  'ticket.error': {
    es: 'Hubo un error al crear el ticket. Intenta de nuevo o contacta directamente con soporte.',
    en: 'There was an error creating the ticket. Try again or contact support directly.',
    pt: 'Houve um erro ao criar o ticket. Tente novamente ou entre em contato com o suporte.',
    ja: 'チケットの作成中にエラーが発生しました。もう一度お試しいただくか、サポートに直接お問い合わせください。',
  },
  'ticket.created': {
    es: '✅ *Ticket de soporte creado*\n\n📋 ID: #{id}\n🏷️ Asunto: {subject}\n⚡ Prioridad: {priority}\n\nNuestro equipo de soporte te contactará pronto. Los mensajes que envíes ahora irán directamente al equipo de soporte.\n\n💡 *Importante:* El bot se desactivará hasta que el equipo de soporte cierre tu ticket.',
    en: '✅ *Support ticket created*\n\n📋 ID: #{id}\n🏷️ Subject: {subject}\n⚡ Priority: {priority}\n\nOur support team will contact you soon. Messages you send now will go directly to support.\n\n💡 *Important:* The bot will be deactivated until support closes your ticket.',
    pt: '✅ *Ticket de suporte criado*\n\n📋 ID: #{id}\n🏷️ Assunto: {subject}\n⚡ Prioridade: {priority}\n\nNossa equipe de suporte entrará em contato em breve. As mensagens enviadas agora irão para o suporte.\n\n💡 *Importante:* O bot será desativado até o suporte fechar seu ticket.',
    ja: '✅ *サポートチケット作成*\n\n📋 ID: #{id}\n🏷️ 件名: {subject}\n⚡ 優先度: {priority}\n\nサポートチームがまもなくご連絡します。送信するメッセージはサポートに直接届きます。\n\n💡 *重要:* サポートがチケットを閉じるまでボットは無効になります。',
  },

  // === ADDRESS ===
  'address.too_short': {
    es: '⚠️ Por favor proporcioná una dirección más completa (calle y número).',
    en: '⚠️ Please provide a more complete address (street and number).',
    pt: '⚠️ Por favor forneça um endereço mais completo (rua e número).',
    ja: '⚠️ より詳しい住所を入力してください（通り名と番号）。',
  },
  'address.confirmed': {
    es: '📍 Perfecto, tu pedido será enviado a: **{address}**',
    en: '📍 Perfect, your order will be sent to: **{address}**',
    pt: '📍 Perfeito, seu pedido será enviado para: **{address}**',
    ja: '📍 了解、注文は**{address}**に配送されます',
  },
  'address.choose_payment': {
    es: '¿Con qué método de pago querés confirmar?',
    en: 'Which payment method would you like to use?',
    pt: 'Qual método de pagamento quer usar?',
    ja: 'どの支払い方法を使いますか？',
  },
  'address.confirm_order': {
    es: '¿Querés confirmar el pedido? 📦',
    en: 'Want to confirm the order? 📦',
    pt: 'Quer confirmar o pedido? 📦',
    ja: '注文を確定しますか？📦',
  },
  'address.confirm_with_payment': {
    es: '¿Confirmás el pedido con pago en {method}? 📦',
    en: 'Confirm the order with {method} payment? 📦',
    pt: 'Confirma o pedido com pagamento em {method}? 📦',
    ja: '{method}で注文を確定しますか？📦',
  },

  // === RESET ===
  'reset.done': {
    es: '🔄 ¡Listo! Borré toda tu memoria de conversación.\n\n¡Empecemos de nuevo! ¿Qué estás buscando hoy? 😊',
    en: '🔄 Done! I\'ve cleared all your conversation memory.\n\nLet\'s start over! What are you looking for today? 😊',
    pt: '🔄 Pronto! Apaguei toda a memória da conversa.\n\nVamos começar de novo! O que você procura hoje? 😊',
    ja: '🔄 完了！会話のメモリをすべてクリアしました。\n\n最初からやり直しましょう！今日は何をお探しですか？😊',
  },

  // === RECEIPT ===
  'receipt.error': {
    es: '❌ Hubo un problema al procesar tu comprobante. Por favor, intenta enviarlo de nuevo o contactá con el negocio.',
    en: '❌ There was a problem processing your receipt. Please try sending it again or contact the store.',
    pt: '❌ Houve um problema ao processar seu comprovante. Por favor tente enviá-lo novamente ou entre em contato com a loja.',
    ja: '❌ 領収書の処理に問題がありました。再送信するか、店舗にお問い合わせください。',
  },
  'receipt.success': {
    es: '✅ ¡Perfecto! Recibí tu comprobante de pago. 📄\n\nEl negocio lo revisará y confirmará tu pedido pronto.\n\nPodés seguir el estado de tu pedido en cualquier momento. 😊\n\n¿Necesitás algo más?',
    en: '✅ Perfect! I received your payment receipt. 📄\n\nThe store will review it and confirm your order soon.\n\nYou can check your order status anytime. 😊\n\nNeed anything else?',
    pt: '✅ Perfeito! Recebi seu comprovante de pagamento. 📄\n\nA loja vai revisar e confirmar seu pedido em breve.\n\nVocê pode acompanhar o status do pedido a qualquer momento. 😊\n\nPrecisa de mais alguma coisa?',
    ja: '✅ 支払い証明を受け取りました。📄\n\n店舗が確認し、まもなく注文を確定します。\n\nいつでも注文状況を確認できます。😊\n\n他にお手伝いできることはありますか？',
  },

  // === CONFIRM FLOW ===
  'confirm.empty_cart': {
    es: '⚠️ Tu carrito está vacío. Primero agregá productos del menú de {vendor}.\n\n¿Querés que te muestre el menú?',
    en: '⚠️ Your cart is empty. First add products from {vendor}\'s menu.\n\nWant me to show you the menu?',
    pt: '⚠️ Seu carrinho está vazio. Primeiro adicione produtos do cardápio de {vendor}.\n\nQuer que eu mostre o cardápio?',
    ja: '⚠️ カートは空です。まず{vendor}のメニューから商品を追加してください。\n\nメニューを表示しますか？',
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

  // === MP FLOW ===
  'mp.no_pending': {
    es: '❌ No encontré un pedido pendiente. Por favor iniciá un nuevo pedido.',
    en: '❌ I couldn\'t find a pending order. Please start a new order.',
    pt: '❌ Não encontrei um pedido pendente. Por favor inicie um novo pedido.',
    ja: '❌ 保留中の注文が見つかりませんでした。新しい注文を始めてください。',
  },
  'mp.link_header': {
    es: '🔗 *Link de pago de MercadoPago:*\n{link}\n\n👆 Tocá el link para completar tu pago de forma segura.\n\nUna vez que pagues, recibirás la confirmación automáticamente. 😊',
    en: '🔗 *MercadoPago payment link:*\n{link}\n\n👆 Tap the link to complete your payment securely.\n\nOnce you pay, you\'ll receive automatic confirmation. 😊',
    pt: '🔗 *Link de pagamento MercadoPago:*\n{link}\n\n👆 Toque no link para completar seu pagamento com segurança.\n\nAssim que pagar, receberá confirmação automática. 😊',
    ja: '🔗 *MercadoPago支払いリンク:*\n{link}\n\n👆 リンクをタップして安全に支払いを完了してください。\n\n支払い後、自動的に確認が届きます。😊',
  },
  'mp.error': {
    es: '⚠️ Hubo un problema al generar el link de pago.\n\nPor favor contactá al negocio para coordinar el pago.',
    en: '⚠️ There was a problem generating the payment link.\n\nPlease contact the store to coordinate payment.',
    pt: '⚠️ Houve um problema ao gerar o link de pagamento.\n\nPor favor entre em contato com a loja para coordenar.',
    ja: '⚠️ 支払いリンクの生成に問題がありました。\n\n店舗に連絡して支払いを調整してください。',
  },
  'mp.not_generated': {
    es: '⚠️ No se pudo generar el link de pago. El negocio te contactará para coordinar.',
    en: '⚠️ Could not generate payment link. The store will contact you to coordinate.',
    pt: '⚠️ Não foi possível gerar o link de pagamento. A loja entrará em contato.',
    ja: '⚠️ 支払いリンクを生成できませんでした。店舗からご連絡します。',
  },
  'mp.request_error': {
    es: '⚠️ Error al procesar tu solicitud. Por favor intentá de nuevo o contactá al negocio.',
    en: '⚠️ Error processing your request. Please try again or contact the store.',
    pt: '⚠️ Erro ao processar sua solicitação. Por favor tente novamente ou entre em contato com a loja.',
    ja: '⚠️ リクエストの処理中にエラーが発生しました。もう一度お試しいただくか、店舗にお問い合わせください。',
  },

  // === AYUDA ===
  'help.full': {
    es: `🤖 *MENÚ DE AYUDA - LAPACHO DELIVERY*

¿Qué podés hacer?

🔍 *BUSCAR Y PEDIR*
• Buscar productos (ej: "Quiero pizza")
• Ver locales abiertos ahora
• Ver ofertas y promociones
• Ver el menú de un negocio
• Hacer un pedido

🛒 *MI CARRITO*
• Ver mi carrito actual
• Agregar productos al carrito
• Quitar productos del carrito
• Vaciar el carrito

📦 *MIS PEDIDOS*
• Ver el estado de mi pedido
• Cancelar un pedido


⭐ *CALIFICAR*
• Calificar mi pedido
• Calificar la plataforma Lapacho

🕐 *HORARIOS*
• Ver horario de un negocio

💬 *SOPORTE*
• Hablar con un vendedor
• Crear un ticket de soporte

Escribí lo que necesites y te ayudo. ¡Es muy fácil! 😊`,
    en: `🤖 *HELP MENU - LAPACHO DELIVERY*

What can you do?

🔍 *SEARCH & ORDER*
• Search products (e.g. "I want pizza")
• See stores open now
• View deals and promotions
• See a store's menu
• Place an order

🛒 *MY CART*
• View my current cart
• Add products to cart
• Remove products from cart
• Empty my cart

📦 *MY ORDERS*
• Check my order status
• Cancel an order

📍 *MY ADDRESSES*
• Save addresses for future orders
• View my saved addresses
• Use a saved address
• Delete or rename addresses

⭐ *RATE*
• Rate my order
• Rate the Lapacho platform

🕐 *SCHEDULE*
• View a store's schedule

💬 *SUPPORT*
• Talk to a vendor
• Create a support ticket

Write what you need and I'll help. It's easy! 😊`,
    pt: `🤖 *MENU DE AJUDA - LAPACHO DELIVERY*

O que você pode fazer?

🔍 *BUSCAR E PEDIR*
• Buscar produtos (ex: "Quero pizza")
• Ver lojas abertas agora
• Ver ofertas e promoções
• Ver o cardápio de uma loja
• Fazer um pedido

🛒 *MEU CARRINHO*
• Ver meu carrinho atual
• Adicionar produtos ao carrinho
• Remover produtos do carrinho
• Esvaziar o carrinho

📦 *MEUS PEDIDOS*
• Ver o status do meu pedido
• Cancelar um pedido

📍 *MEUS ENDEREÇOS*
• Salvar endereços para pedidos futuros
• Ver meus endereços salvos
• Usar um endereço salvo
• Excluir ou renomear endereços

⭐ *AVALIAR*
• Avaliar meu pedido
• Avaliar a plataforma Lapacho

🕐 *HORÁRIOS*
• Ver horário de uma loja

💬 *SUPORTE*
• Falar com um vendedor
• Criar um ticket de suporte

Escreva o que precisa e eu ajudo. É muito fácil! 😊`,
    ja: `🤖 *ヘルプメニュー - LAPACHO DELIVERY*

何ができますか？

🔍 *検索と注文*
• 商品を検索（例：「ピザが欲しい」）
• 営業中の店舗を見る
• セールやプロモーションを見る
• 店舗のメニューを見る
• 注文する

🛒 *カート*
• カートを確認する
• 商品をカートに追加する
• カートから商品を削除する
• カートを空にする

📦 *注文履歴*
• 注文状況を確認する
• 注文をキャンセルする

📍 *住所*
• 今後の注文用に住所を保存する
• 保存した住所を確認する
• 保存した住所を使う
• 住所を削除・名前変更する

⭐ *評価*
• 注文を評価する
• Lapachoプラットフォームを評価する

🕐 *営業時間*
• 店舗の営業時間を見る

💬 *サポート*
• 店舗と話す
• サポートチケットを作成する

必要なことを書いてください。お手伝いします！😊`,
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

  // === LABELS (inline ternary replacements) ===
  'label.order': {
    es: 'Pedido', en: 'Order', pt: 'Pedido', ja: '注文',
  },
  'label.payment': {
    es: 'Pago', en: 'Payment', pt: 'Pagamento', ja: '支払い',
  },
  'label.payment_method': {
    es: 'Método de pago', en: 'Payment method', pt: 'Método de pagamento', ja: '支払い方法',
  },
  'label.delivery_label': {
    es: 'Entrega', en: 'Delivery', pt: 'Entrega', ja: '配送',
  },
  'label.address': {
    es: 'Dirección', en: 'Address', pt: 'Endereço', ja: '住所',
  },
  'label.store': {
    es: 'Negocio', en: 'Store', pt: 'Loja', ja: '店舗',
  },
  'label.status': {
    es: 'Estado', en: 'Status', pt: 'Status', ja: '状態',
  },
  'label.your_rating': {
    es: 'Tu calificación', en: 'Your rating', pt: 'Sua avaliação', ja: 'あなたの評価',
  },
  'label.account_holder': {
    es: 'Titular', en: 'Account holder', pt: 'Titular', ja: '名義人',
  },
  'label.amount': {
    es: 'Monto', en: 'Amount', pt: 'Valor', ja: '金額',
  },
  'label.bank_transfer': {
    es: 'Transferencia bancaria', en: 'Bank transfer', pt: 'Transferência bancária', ja: '銀行振込',
  },
  'label.cash': {
    es: 'Efectivo', en: 'Cash', pt: 'Dinheiro', ja: '現金',
  },
  'label.transfer_details': {
    es: 'Datos para transferencia', en: 'Transfer details', pt: 'Dados para transferência', ja: '振込情報',
  },

  // === HORARIOS ===
  'schedule.header': {
    es: '🕐 *Horarios de {vendor}*',
    en: '🕐 *{vendor} Schedule*',
    pt: '🕐 *Horários de {vendor}*',
    ja: '🕐 *{vendor}の営業時間*',
  },
  'schedule.closed': {
    es: 'Cerrado',
    en: 'Closed',
    pt: 'Fechado',
    ja: '休業',
  },
  'schedule.currently_open': {
    es: '🟢 *Abierto ahora*',
    en: '🟢 *Open now*',
    pt: '🟢 *Aberto agora*',
    ja: '🟢 *営業中*',
  },
  'schedule.currently_closed': {
    es: '🔴 *Cerrado ahora*',
    en: '🔴 *Closed now*',
    pt: '🔴 *Fechado agora*',
    ja: '🔴 *閉店中*',
  },
  'schedule.no_hours': {
    es: 'Este negocio no tiene horarios configurados. Puede estar abierto las 24hs o contactá al negocio para confirmar.',
    en: 'This store has no schedule configured. It may be open 24/7 or contact the store to confirm.',
    pt: 'Esta loja não tem horários configurados. Pode estar aberta 24hs ou entre em contato para confirmar.',
    ja: 'この店舗の営業時間は設定されていません。24時間営業の可能性があります。店舗にお問い合わせください。',
  },
  'schedule.ask_vendor': {
    es: '¿De qué negocio querés ver el horario? Decime el nombre o número de la lista.',
    en: 'Which store\'s schedule do you want to see? Tell me the name or number.',
    pt: 'De qual loja quer ver o horário? Diga o nome ou número.',
    ja: 'どの店舗の営業時間を見たいですか？名前か番号を教えてください。',
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
