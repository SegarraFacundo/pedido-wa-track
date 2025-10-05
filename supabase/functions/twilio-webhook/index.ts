  import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
  import { handleVendorBot } from './vendor-bot.ts';

  // Configuración CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // --- Config Supabase (si corresponde) ---
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  const SUPABASE_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const supabase = SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : undefined;

  // Lista simple de números de vendedores (puede venir por env VENDOR_NUMBERS = "+54911..., +54922...")
  const VENDOR_NUMBERS = (Deno.env.get('VENDOR_NUMBERS') || '')
    .split(',')
    .map(n => n.trim())
    .filter(Boolean);

  // Helper to create TwiML response
  function createTwiMLResponse(message: string): Response {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${message}</Message>
</Response>`;
    return new Response(twiml, {
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      status: 200
    });
  }

  // --- Persistencia simple en memoria como fallback ---
  const inMemoryContexts = new Map<string, any>();

  // Tipo de contexto de usuario (sólo como guía)
  interface UserContext {
    phone: string;
    orderId?: string | null;
    currentState: string;
    previousState?: string | null;
    flowData?: any;
    en_mano_humana?: boolean;
    lastBotMessage?: string | null;
    assignedVendorPhone?: string | null;
    updatedAt?: string;
  }

  // --- Helpers ---
  async function isVendor(phone: string): Promise<boolean> {
    if (!phone) return false;
    const normalized = phone.trim();
    if (VENDOR_NUMBERS.includes(normalized)) return true;

    if (supabase) {
      try {
        const { data } = await supabase
          .from('vendors')
          .select('phone')
          .eq('phone', normalized)
          .limit(1);
        return !!(data && data.length > 0);
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.warn('isVendor supabase error', errorMsg);
        return false;
      }
    }
    return false;
  }

  async function getUserContextByPhone(phone: string): Promise<UserContext> {
    const normalized = phone?.trim();
    if (!normalized) return { phone: normalized, currentState: 'start' };

    if (supabase) {
      try {
        const { data } = await supabase
          .from('user_contexts')
          .select('*')
          .eq('phone', normalized)
          .limit(1)
          .single();
        if (data) return data as UserContext;
      } catch (e) {
        // ignore, fallback to memory
      }
    }

    if (inMemoryContexts.has(normalized)) return inMemoryContexts.get(normalized);

    const ctx: UserContext = {
      phone: normalized,
      currentState: 'start',
      flowData: {},
      en_mano_humana: false,
      updatedAt: new Date().toISOString(),
    };
    inMemoryContexts.set(normalized, ctx);
    return ctx;
  }

  async function getUserContextByOrder(orderId: string): Promise<UserContext | null> {
    if (!orderId) return null;
    if (supabase) {
      try {
        const { data } = await supabase
          .from('user_contexts')
          .select('*')
          .eq('order_id', orderId)
          .limit(1)
          .single();
        if (data) return data as UserContext;
      } catch (e) {
        // ignore
      }
    }

    // fallback: search memory
    for (const ctx of inMemoryContexts.values()) {
      if (ctx.orderId === orderId) return ctx;
    }
    return null;
  }

  async function saveUserContext(ctx: UserContext) {
    ctx.updatedAt = new Date().toISOString();
    if (supabase) {
      try {
        await supabase.from('user_contexts').upsert([ctx], { onConflict: 'phone' });
        return;
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.warn('saveUserContext supabase error', errorMsg);
      }
    }
    inMemoryContexts.set(ctx.phone, ctx);
  }

  async function findAnyEnManoHumanaAssignedToVendor(vendorPhone: string): Promise<UserContext | null> {
    if (supabase) {
      try {
        const { data } = await supabase
          .from('user_contexts')
          .select('*')
          .eq('en_mano_humana', true)
          .eq('assigned_vendor_phone', vendorPhone)
          .limit(1)
          .single();
        if (data) return data as UserContext;
      } catch (e) {
        // ignore
      }
    }

    for (const ctx of inMemoryContexts.values()) {
      if (ctx.en_mano_humana && ctx.assignedVendorPhone === vendorPhone) return ctx;
    }
    return null;
  }

  // Notifica (placeholder) al equipo de vendedores. Adaptá para crear una tarea, webhook o enviar mensaje.
  async function notifyVendorForUser(ctx: UserContext) {
    try {
      console.info('notifyVendorForUser (placeholder) ->', ctx.phone, ctx.orderId);
      if (supabase) {
        await supabase.from('vendor_notifications').insert({ phone: ctx.phone, order_id: ctx.orderId, created_at: new Date().toISOString() });
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.warn('notifyVendorForUser error', errorMsg);
    }
  }

  // --- Detección de comandos globales ---
  function looksLikeAsksForVendor(text: string): boolean {
    if (!text) return false;
    const t = text.toLowerCase();
    return /\b(vendedor|hablar con vendedor|hablar con alguien|humano|asistencia|persona)\b/.test(t);
  }

  function looksLikeSigueBot(text: string): boolean {
    if (!text) return false;
    return text.toLowerCase().includes('sigue bot');
  }

  function looksLikeGlobalMenuCommands(text: string) {
    if (!text) return null;
    const t = text.toLowerCase().trim();
    if (t === 'menu' || t === 'inicio') return 'menu';
    if (t === 'volver' || t === 'atrás' || t === 'atras') return 'back';
    if (t === 'estado' || t === 'estado del pedido') return 'status';
    if (t === 'ayuda' || t === 'help') return 'help';
    if (t === 'cancelar' || t === 'salir') return 'cancel';
    return null;
  }

  // --- Handler principal ---
  serve(async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Parse incoming data - Twilio sends form-urlencoded data
      const contentType = req.headers.get('content-type') || '';
      let body: any = {};
      
      if (contentType.includes('application/x-www-form-urlencoded')) {
        // Twilio webhook format
        const formData = await req.formData();
        body = {
          message: formData.get('Body') || '',
          phoneNumber: (formData.get('From') || '').toString().replace('whatsapp:', ''),
          orderId: null
        };
      } else {
        // JSON format (for direct API calls)
        body = await req.json();
      }
      
      const orderId = body?.orderId || null;
      const message = (body?.message || '').toString();
      const phoneNumber = (body?.phoneNumber || '').toString().trim();

      console.log('Incoming webhook', { orderId, phoneNumber, message });

      const lowerMessage = message.toLowerCase().trim();

      const senderIsVendor = await isVendor(phoneNumber);

      // If vendor asks 'sigue bot' -> resume the associated user
      if (senderIsVendor && looksLikeSigueBot(lowerMessage)) {
        // Prefer to find by orderId
        let ctx: UserContext | null = null;
        if (orderId) ctx = await getUserContextByOrder(orderId);
        if (!ctx) ctx = await findAnyEnManoHumanaAssignedToVendor(phoneNumber);

        if (!ctx) {
          return createTwiMLResponse('No encontré una conversación derivada a este vendedor para reanudar.');
        }

        ctx.en_mano_humana = false;
        ctx.currentState = ctx.previousState || ctx.currentState || 'start';
        ctx.previousState = null;
        await saveUserContext(ctx);

        const resumeMessage = ctx.lastBotMessage || 'El bot se reactivó y retomará el flujo donde quedó.';

        return createTwiMLResponse(resumeMessage);
      }

      // If sender is a user and asks for a vendor -> mark and notify
      if (!senderIsVendor && looksLikeAsksForVendor(lowerMessage)) {
        const ctx = await getUserContextByPhone(phoneNumber);
        ctx.previousState = ctx.currentState || 'start';
        ctx.en_mano_humana = true;
        ctx.assignedVendorPhone = null;
        await saveUserContext(ctx);
        await notifyVendorForUser(ctx);

        return createTwiMLResponse('Perfecto, un vendedor continúa con la conversación.');
      }

      // If the conversation is currently en_mano_humana and the sender is NOT a vendor,
      // the bot should stop responding
      const ctx = await getUserContextByPhone(phoneNumber);
      if (ctx.en_mano_humana && !senderIsVendor) {
        return new Response('', { headers: corsHeaders, status: 200 });
      }

      // Global menu commands that can be invoked anytime
      const globalCommand = looksLikeGlobalMenuCommands(lowerMessage);
      if (globalCommand) {
        switch (globalCommand) {
          case 'menu':
            ctx.currentState = 'start';
            ctx.flowData = {};
            await saveUserContext(ctx);
            return createTwiMLResponse(handleMenu());
          case 'back':
            ctx.currentState = ctx.previousState || 'start';
            ctx.previousState = null;
            await saveUserContext(ctx);
            return createTwiMLResponse('Volvimos un paso atrás.');
          case 'status':
            return createTwiMLResponse(`Estado actual: ${ctx.currentState}`);
          case 'help':
            return createTwiMLResponse('📚 *Centro de Ayuda*\n\nVisitá nuestra página de ayuda para ver toda la documentación: lovable.app/ayuda\n\nO escribí *"hablar con vendedor"* para asistencia personalizada.');
          case 'cancel':
            ctx.currentState = 'start';
            ctx.flowData = {};
            ctx.previousState = null;
            ctx.en_mano_humana = false;
            await saveUserContext(ctx);
            return createTwiMLResponse('Pedido cancelado. Volvimos al inicio.');
        }
      }

      // Finalmente, procesa el mensaje con el handler existente (user flow)
      const botReply = await handleVendorBot(message, phoneNumber, supabase);

      // Guardar último mensaje enviado por el bot
      ctx.lastBotMessage = botReply || ctx.lastBotMessage;
      await saveUserContext(ctx);

      return createTwiMLResponse(botReply || 'No entendí tu mensaje. Escribí "menu" para ver las opciones.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error en endpoint webhook:', errorMessage);
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  });

  // Mensajes de menú / helper simple
  function handleMenu(): string {
    return `👋 *Menú principal*\n1) Ver locales\n2) Ver menú del local\n3) Hacer pedido\n4) Hablar con vendedor\nEscribí la opción o lo que necesites.`;
  }
