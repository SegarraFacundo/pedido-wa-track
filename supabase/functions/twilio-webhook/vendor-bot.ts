export async function handleVendorBot(
  message: string,
  phone: string,
  supabase: any
): Promise<string> {
  const lowerMessage = message.toLowerCase().trim();
  
  // Comandos del bot vendedor
  if (lowerMessage.includes('ofertas') || lowerMessage.includes('promociones')) {
    return await getActiveOffers(supabase);
  }
  
  if (lowerMessage.includes('hablar con vendedor') || lowerMessage.includes('chat')) {
    return await startVendorChat(phone, supabase);
  }
  
  if (lowerMessage.startsWith('calificar') || lowerMessage.startsWith('review')) {
    return await handleReview(message, phone, supabase);
  }
  
  if (lowerMessage.includes('horario') || lowerMessage.includes('abierto')) {
    return await getVendorHours(supabase);
  }
  
  // Respuesta por defecto con menú
  return getWelcomeMessage();
}

async function getActiveOffers(supabase: any): Promise<string> {
  const { data: offers } = await supabase
    .from('vendor_offers')
    .select('*, vendors(name)')
    .eq('is_active', true)
    .gte('valid_until', new Date().toISOString())
    .limit(5);
  
  if (!offers || offers.length === 0) {
    return '😕 No hay ofertas activas en este momento.\n\nEscribe "menú" para ver las opciones disponibles.';
  }
  
  let message = '🎉 *OFERTAS ESPECIALES DE HOY* 🎉\n\n';
  
  offers.forEach((offer: any, index: number) => {
    message += `${index + 1}. *${offer.title}*\n`;
    message += `   📍 ${offer.vendors.name}\n`;
    message += `   ${offer.description}\n`;
    
    if (offer.discount_percentage) {
      message += `   🏷️ *${offer.discount_percentage}% OFF*\n`;
    }
    
    if (offer.original_price && offer.offer_price) {
      message += `   💰 ~$${offer.original_price}~ *$${offer.offer_price}*\n`;
    }
    
    message += '\n';
  });
  
  message += '📱 Para hacer un pedido, escribe el nombre del producto que deseas.';
  
  return message;
}

async function startVendorChat(phone: string, supabase: any): Promise<string> {
  // Buscar vendor activo (por simplicidad, tomamos el primero)
  const { data: vendor } = await supabase
    .from('vendors')
    .select('id, name')
    .eq('is_active', true)
    .limit(1)
    .single();
  
  if (!vendor) {
    return '😕 No hay vendedores disponibles en este momento.';
  }
  
  // Crear nueva sesión de chat
  const { data: chat, error } = await supabase
    .from('vendor_chats')
    .insert({
      vendor_id: vendor.id,
      customer_phone: phone,
      is_active: true
    })
    .select()
    .single();
  
  if (error) {
    return '❌ No se pudo iniciar el chat. Intenta más tarde.';
  }
  
  // Enviar mensaje inicial
  await supabase
    .from('chat_messages')
    .insert({
      chat_id: chat.id,
      sender_type: 'bot',
      message: `Cliente ${phone} ha iniciado un chat`
    });
  
  return `✅ *Chat iniciado con ${vendor.name}*\n\n` +
         `Un vendedor te atenderá en breve.\n` +
         `Puedes enviar tus mensajes y el vendedor los recibirá.\n\n` +
         `Para terminar el chat, escribe "terminar chat".`;
}

async function handleReview(message: string, phone: string, supabase: any): Promise<string> {
  // Extraer calificación y comentario
  const parts = message.split(' ');
  const rating = parseInt(parts[1]);
  
  if (!rating || rating < 1 || rating > 5) {
    return '⭐ Para calificar, usa:\n' +
           '"calificar [1-5] [comentario opcional]"\n\n' +
           'Ejemplo: calificar 5 Excelente servicio!';
  }
  
  const comment = parts.slice(2).join(' ');
  
  // Obtener el último pedido del cliente para saber qué vendor calificar
  const { data: lastOrder } = await supabase
    .from('orders')
    .select('vendor_id')
    .eq('customer_phone', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (!lastOrder) {
    return '😕 No encontramos pedidos recientes para calificar.';
  }
  
  // Guardar la reseña
  const { error } = await supabase
    .from('vendor_reviews')
    .insert({
      vendor_id: lastOrder.vendor_id,
      customer_phone: phone,
      rating: rating,
      comment: comment || null
    });
  
  if (error) {
    return '❌ No se pudo guardar tu calificación. Intenta más tarde.';
  }
  
  const stars = '⭐'.repeat(rating);
  return `✅ *¡Gracias por tu calificación!*\n\n` +
         `${stars}\n` +
         `${comment ? `Tu comentario: "${comment}"` : ''}\n\n` +
         `Tu opinión nos ayuda a mejorar nuestro servicio.`;
}

async function getVendorHours(supabase: any): Promise<string> {
  const { data: vendors } = await supabase
    .from('vendors')
    .select('name, opening_time, closing_time, days_open')
    .eq('is_active', true);
  
  if (!vendors || vendors.length === 0) {
    return '😕 No hay información de horarios disponible.';
  }
  
  let message = '🕐 *HORARIOS DE ATENCIÓN*\n\n';
  
  vendors.forEach((vendor: any) => {
    message += `📍 *${vendor.name}*\n`;
    message += `   Horario: ${vendor.opening_time} - ${vendor.closing_time}\n`;
    message += `   Días: ${vendor.days_open?.join(', ') || 'Todos los días'}\n\n`;
  });
  
  return message;
}

function getWelcomeMessage(): string {
  return `👋 *¡Bienvenido a nuestro servicio!*\n\n` +
         `Soy tu asistente virtual. ¿En qué puedo ayudarte?\n\n` +
         `📱 *OPCIONES DISPONIBLES:*\n` +
         `1️⃣ Ver *ofertas* del día\n` +
         `2️⃣ *Hacer pedido* (escribe lo que necesitas)\n` +
         `3️⃣ *Hablar con vendedor*\n` +
         `4️⃣ Ver *horarios* de atención\n` +
         `5️⃣ *Calificar* servicio\n` +
         `6️⃣ Ver *estado* de tu pedido\n\n` +
         `💬 Escribe cualquier opción para comenzar!`;
}