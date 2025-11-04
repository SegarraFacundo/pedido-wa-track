import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, eventType } = await req.json();
    console.log('📬 Vendor notification request:', { orderId, eventType });

    if (!orderId || !eventType) {
      throw new Error('Missing orderId or eventType');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener información del pedido y vendedor
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, vendors!inner(id, name, whatsapp_number)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('❌ Order not found:', orderError);
      throw new Error('Order not found');
    }

    const vendor = order.vendors;
    console.log('🏪 Vendor:', { id: vendor.id, name: vendor.name, hasWhatsApp: !!vendor.whatsapp_number });

    // Verificar si el vendedor tiene WhatsApp
    if (!vendor.whatsapp_number) {
      console.log('⚠️ Vendor has no WhatsApp number, skipping notification');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'No WhatsApp number' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obtener configuración de notificaciones del vendedor
    const { data: settings } = await supabase
      .from('vendor_notification_settings')
      .select('*')
      .eq('vendor_id', vendor.id)
      .single();

    console.log('⚙️ Notification settings:', settings);

    // Verificar si este tipo de notificación está habilitada
    let shouldNotify = false;
    switch (eventType) {
      case 'new_order':
        shouldNotify = settings?.notify_new_order ?? true;
        break;
      case 'order_cancelled':
        shouldNotify = settings?.notify_order_cancelled ?? true;
        break;
      case 'customer_message':
        shouldNotify = settings?.notify_customer_message ?? true;
        break;
      default:
        console.warn('⚠️ Unknown event type:', eventType);
        shouldNotify = false;
    }

    if (!shouldNotify) {
      console.log('⚠️ Notification type disabled for vendor');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'Notification type disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construir mensaje según el tipo de evento
    let message = '';
    switch (eventType) {
      case 'new_order':
        const itemsList = order.items.map((item: any) => 
          `• ${item.quantity}x ${item.name} - $${item.price}`
        ).join('\n');
        message = `🛍️ *Nuevo Pedido #${order.id.slice(0, 8)}*\n\n` +
                  `👤 Cliente: ${order.customer_name}\n` +
                  `📍 Dirección: ${order.address}\n\n` +
                  `*Productos:*\n${itemsList}\n\n` +
                  `💰 Total: $${order.total}\n\n` +
                  `Por favor, confirma el pedido desde tu panel de vendedor.`;
        break;
      
      case 'order_cancelled':
        message = `❌ *Pedido Cancelado #${order.id.slice(0, 8)}*\n\n` +
                  `El pedido de ${order.customer_name} ha sido cancelado.\n` +
                  `Total: $${order.total}`;
        break;
      
      case 'customer_message':
        message = `💬 *Nuevo mensaje de cliente*\n\n` +
                  `Un cliente está intentando comunicarse contigo. ` +
                  `Por favor, revisa tu panel de vendedor.`;
        break;
    }

    console.log('📝 Message to send:', message);

    // Enviar notificación por WhatsApp
    const { data: whatsappResult, error: whatsappError } = await supabase.functions.invoke(
      'send-whatsapp-notification',
      {
        body: {
          phoneNumber: vendor.whatsapp_number,
          message,
          orderId: order.id,
        },
      }
    );

    if (whatsappError) {
      console.error('❌ WhatsApp notification error:', whatsappError);
      throw whatsappError;
    }

    console.log('✅ Notification sent successfully');

    return new Response(
      JSON.stringify({ success: true, result: whatsappResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('💥 Error in notify-vendor:', msg, error);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
