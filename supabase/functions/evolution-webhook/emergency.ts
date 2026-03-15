// ==================== EMERGENCY FALLBACK HANDLER ====================

export interface PlatformSettings {
  bot_enabled: boolean;
  emergency_mode: boolean;
  emergency_message: string;
  fallback_mode: 'vendor_direct' | 'support_queue' | 'offline';
  error_count: number;
  auto_emergency_threshold: number;
}

export async function checkPlatformSettings(supabase: any): Promise<PlatformSettings | null> {
  try {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('*')
      .eq('id', 'global')
      .single();
    
    if (error) {
      console.error('❌ Error fetching platform_settings:', error);
      return null;
    }
    
    return data as PlatformSettings;
  } catch (err) {
    console.error('❌ Exception fetching platform_settings:', err);
    return null;
  }
}

export async function logBotError(
  supabase: any, 
  errorType: string, 
  errorMessage: string, 
  customerPhone?: string,
  vendorId?: string,
  errorDetails?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('bot_error_logs').insert({
      error_type: errorType,
      error_message: errorMessage,
      error_details: errorDetails || {},
      customer_phone: customerPhone,
      vendor_id: vendorId,
    });
    console.log(`📝 Error logged: ${errorType}`);
  } catch (err) {
    console.error('❌ Failed to log error:', err);
  }
}

export async function incrementErrorCount(supabase: any, errorMessage: string): Promise<boolean> {
  try {
    const { data: settings } = await supabase
      .from('platform_settings')
      .select('error_count, auto_emergency_threshold')
      .eq('id', 'global')
      .single();
    
    const newCount = (settings?.error_count || 0) + 1;
    const threshold = settings?.auto_emergency_threshold || 3;
    
    const shouldActivateEmergency = newCount >= threshold;
    
    const updateData: Record<string, any> = {
      error_count: newCount,
      last_error: errorMessage,
      last_error_at: new Date().toISOString(),
    };
    
    if (shouldActivateEmergency) {
      updateData.emergency_mode = true;
      console.warn(`🚨 AUTO-EMERGENCY: Threshold reached (${newCount}/${threshold}), activating emergency mode`);
      
      try {
        console.log('📧 Triggering admin emergency notifications...');
        const { error: notifyError } = await supabase.functions.invoke('notify-admin-emergency', {
          body: {
            error_type: 'AUTO_EMERGENCY_ACTIVATED',
            error_message: errorMessage,
            error_count: newCount,
            threshold: threshold,
          },
        });
        
        if (notifyError) {
          console.error('⚠️ Failed to notify admins (non-blocking):', notifyError);
        } else {
          console.log('✅ Admin emergency notifications triggered successfully');
        }
      } catch (notifyErr) {
        console.error('⚠️ Error invoking notify-admin-emergency (non-blocking):', notifyErr);
      }
    }
    
    await supabase
      .from('platform_settings')
      .update(updateData)
      .eq('id', 'global');
    
    return shouldActivateEmergency;
  } catch (err) {
    console.error('❌ Failed to increment error count:', err);
    return false;
  }
}

export async function handleEmergencyFallback(
  settings: PlatformSettings,
  customerPhone: string,
  messageText: string,
  supabase: any
): Promise<string> {
  const mode = settings.fallback_mode || 'vendor_direct';
  console.log(`🚨 Emergency fallback mode: ${mode}`);
  
  switch (mode) {
    case 'vendor_direct': {
      const { data: activeOrder } = await supabase
        .from('orders')
        .select('id, vendor_id, status, vendors!inner(phone, whatsapp_number, name)')
        .eq('customer_phone', customerPhone)
        .not('status', 'in', '("delivered","cancelled")')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (activeOrder) {
        console.log(`📦 Active order found: ${activeOrder.id}, routing to vendor`);
        
        const vendorPhone = activeOrder.vendors?.whatsapp_number || activeOrder.vendors?.phone;
        await supabase.from('user_sessions').upsert({
          phone: customerPhone,
          in_vendor_chat: true,
          assigned_vendor_phone: vendorPhone,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'phone' });
        
        await supabase.from('messages').insert({
          order_id: activeOrder.id,
          sender: 'customer',
          content: messageText,
          is_read: false,
        });
        
        await supabase.from('customer_messages').insert({
          customer_phone: customerPhone,
          message: messageText,
          read: false,
        });
        
        return settings.emergency_message || 
          `⚠️ Estamos experimentando dificultades técnicas.\n\nTu mensaje fue enviado directamente a *${activeOrder.vendors?.name}* y te responderán pronto.\n\nDisculpá las molestias. 🙏`;
      } else {
        return await createSupportTicketFallback(customerPhone, messageText, supabase, settings);
      }
    }
    
    case 'support_queue': {
      return await createSupportTicketFallback(customerPhone, messageText, supabase, settings);
    }
    
    case 'menu_basico' as any: {
      return await sendBasicMenuFallback(customerPhone, supabase, settings);
    }
    
    case 'offline':
    default: {
      return settings.emergency_message || 
        '⚠️ El sistema está temporalmente fuera de servicio. Por favor intentá más tarde.';
    }
  }
}

async function sendBasicMenuFallback(
  customerPhone: string,
  supabase: any,
  settings: PlatformSettings
): Promise<string> {
  try {
    console.log('📋 Sending basic menu fallback...');
    
    const now = new Date();
    const argentinaTime = new Date(
      now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" })
    );
    const currentDay = [
      "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"
    ][argentinaTime.getDay()];
    const currentTimeStr = argentinaTime.toTimeString().slice(0, 5);
    
    const { data: vendors, error: vendorsError } = await supabase
      .from('vendors')
      .select('id, name, phone, whatsapp_number, address, category')
      .eq('is_active', true);
    
    if (vendorsError || !vendors || vendors.length === 0) {
      console.error('Error fetching vendors:', vendorsError);
      return settings.emergency_message || 
        '⚠️ El sistema está temporalmente fuera de servicio. Por favor intentá más tarde.';
    }
    
    const vendorIds = vendors.map((v: any) => v.id);
    const { data: vendorHours } = await supabase
      .from('vendor_hours')
      .select('vendor_id, day_of_week, opening_time, closing_time, is_closed, is_open_24_hours')
      .in('vendor_id', vendorIds)
      .eq('day_of_week', currentDay);
    
    const hoursMap = new Map();
    vendorHours?.forEach((h: any) => {
      if (!hoursMap.has(h.vendor_id)) hoursMap.set(h.vendor_id, []);
      hoursMap.get(h.vendor_id).push(h);
    });
    
    const isVendorOpen = (vendorId: string): boolean => {
      const todayHours = hoursMap.get(vendorId);
      if (!todayHours || todayHours.length === 0) return true;
      
      return todayHours.some((h: any) => {
        if (h.is_closed) return false;
        if (h.is_open_24_hours) return true;
        return currentTimeStr >= h.opening_time.slice(0, 5) && currentTimeStr <= h.closing_time.slice(0, 5);
      });
    };
    
    const openVendors = vendors.filter((v: any) => isVendorOpen(v.id));
    const closedVendors = vendors.filter((v: any) => !isVendorOpen(v.id));
    
    let message = '🔧 *Nuestro asistente está temporalmente fuera de servicio.*\n\n';
    
    if (openVendors.length > 0) {
      message += '📍 *Negocios disponibles ahora:*\n\n';
      
      openVendors.forEach((v: any, i: number) => {
        const contactNumber = v.whatsapp_number || v.phone;
        message += `${i + 1}. *${v.name}*\n`;
        if (v.category) message += `   📂 ${v.category}\n`;
        if (v.address) message += `   📍 ${v.address.split(',')[0]}\n`;
        message += `   📱 ${contactNumber}\n\n`;
      });
      
      message += '👆 Contactá directamente al negocio de tu preferencia.\n';
    } else if (closedVendors.length > 0) {
      message += '😔 No hay negocios abiertos en este momento.\n\n';
      message += '🕐 *Negocios que abrirán pronto:*\n\n';
      
      closedVendors.slice(0, 3).forEach((v: any, i: number) => {
        message += `${i + 1}. ${v.name}\n`;
      });
      
      message += '\n⏰ Intentá más tarde cuando estén abiertos.';
    } else {
      message += '😔 No hay negocios disponibles en este momento.';
    }
    
    message += '\n\n_Disculpá las molestias. 🙏_';
    
    console.log(`✅ Basic menu sent with ${openVendors.length} open vendors`);
    return message;
    
  } catch (error) {
    console.error('Error in sendBasicMenuFallback:', error);
    return settings.emergency_message || 
      '⚠️ El sistema está temporalmente fuera de servicio. Por favor intentá más tarde.';
  }
}

async function createSupportTicketFallback(
  customerPhone: string,
  messageText: string,
  supabase: any,
  settings: PlatformSettings
): Promise<string> {
  try {
    const { data: existingTicket } = await supabase
      .from('support_tickets')
      .select('id')
      .eq('customer_phone', customerPhone)
      .eq('status', 'open')
      .ilike('subject', '%[EMERGENCIA]%')
      .maybeSingle();
    
    if (existingTicket) {
      await supabase.from('support_messages').insert({
        ticket_id: existingTicket.id,
        sender_type: 'customer',
        message: messageText,
      });
      
      console.log(`📩 Message added to existing emergency ticket: ${existingTicket.id}`);
    } else {
      const { data: newTicket, error } = await supabase
        .from('support_tickets')
        .insert({
          customer_phone: customerPhone,
          customer_name: 'Cliente (Emergencia Bot)',
          subject: '[EMERGENCIA] Bot no disponible - Mensaje de cliente',
          priority: 'high',
          status: 'open',
        })
        .select('id')
        .single();
      
      if (!error && newTicket) {
        await supabase.from('support_messages').insert({
          ticket_id: newTicket.id,
          sender_type: 'customer',
          message: messageText,
        });
        
        console.log(`🎫 New emergency support ticket created: ${newTicket.id}`);
      }
    }
    
    return settings.emergency_message || 
      '⚠️ Estamos experimentando dificultades técnicas.\n\nTu mensaje fue enviado a nuestro equipo de soporte y te contactaremos pronto.\n\nDisculpá las molestias. 🙏';
  } catch (err) {
    console.error('❌ Error creating support ticket fallback:', err);
    return '⚠️ El sistema está temporalmente fuera de servicio. Por favor intentá más tarde.';
  }
}
