import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Lang = 'es' | 'en' | 'pt' | 'ja';

const translations: Record<string, Record<Lang, string>> = {
  status_confirmed: {
    es: '✅ Tu pedido #{{orderId}} confirmado. El vendedor está preparando tu pedido.',
    en: '✅ Your order #{{orderId}} has been confirmed. The store is preparing your order.',
    pt: '✅ Seu pedido #{{orderId}} foi confirmado. A loja está preparando seu pedido.',
    ja: '✅ 注文 #{{orderId}} が確認されました。店舗が準備中です。',
  },
  status_preparing: {
    es: '👨‍🍳 Tu pedido #{{orderId}} está siendo preparado. Tu pedido está siendo preparado.',
    en: '👨‍🍳 Your order #{{orderId}} is being prepared.',
    pt: '👨‍🍳 Seu pedido #{{orderId}} está sendo preparado.',
    ja: '👨‍🍳 注文 #{{orderId}} を準備中です。',
  },
  status_ready_delivery: {
    es: '📦 Tu pedido #{{orderId}} está listo. Tu pedido está listo para entrega.',
    en: '📦 Your order #{{orderId}} is ready for delivery.',
    pt: '📦 Seu pedido #{{orderId}} está pronto para entrega.',
    ja: '📦 注文 #{{orderId}} の配達準備が整いました。',
  },
  status_ready_pickup: {
    es: '📦 Tu pedido #{{orderId}} está listo. Tu pedido está listo para retirar en el local.',
    en: '📦 Your order #{{orderId}} is ready for pickup at the store.',
    pt: '📦 Seu pedido #{{orderId}} está pronto para retirada na loja.',
    ja: '📦 注文 #{{orderId}} は店舗で受け取り可能です。',
  },
  status_delivering: {
    es: '🚗 Tu pedido #{{orderId}} está en camino. Tu pedido está en camino.',
    en: '🚗 Your order #{{orderId}} is on its way!',
    pt: '🚗 Seu pedido #{{orderId}} está a caminho!',
    ja: '🚗 注文 #{{orderId}} は配達中です！',
  },
  status_cancelled: {
    es: '❌ Tu pedido #{{orderId}} ha sido cancelado. Si tienes alguna duda, contacta al vendedor.',
    en: '❌ Your order #{{orderId}} has been cancelled. Contact the store if you have questions.',
    pt: '❌ Seu pedido #{{orderId}} foi cancelado. Entre em contato com a loja se tiver dúvidas.',
    ja: '❌ 注文 #{{orderId}} がキャンセルされました。ご質問があれば店舗にお問い合わせください。',
  },
  delivered_rating: {
    es: `🎉 ¡Tu pedido #{{orderId}} ha sido entregado!

¡Esperamos que lo disfrutes! 🍽️

📝 *¿Querés calificar tu experiencia?*
Tu opinión nos ayuda a mejorar.

Podés calificar:
⏱️ Tiempo de entrega (1-5 estrellas)
👥 Atención del negocio (1-5 estrellas)
📦 Calidad del producto (1-5 estrellas)

Solo escribí "quiero calificar" o "calificar" cuando quieras hacerlo. Es opcional 😊`,
    en: `🎉 Your order #{{orderId}} has been delivered!

We hope you enjoy it! 🍽️

📝 *Would you like to rate your experience?*
Your feedback helps us improve.

You can rate:
⏱️ Delivery time (1-5 stars)
👥 Store service (1-5 stars)
📦 Product quality (1-5 stars)

Just type "rate" or "review" whenever you want. It's optional 😊`,
    pt: `🎉 Seu pedido #{{orderId}} foi entregue!

Esperamos que aproveite! 🍽️

📝 *Gostaria de avaliar sua experiência?*
Sua opinião nos ajuda a melhorar.

Você pode avaliar:
⏱️ Tempo de entrega (1-5 estrelas)
👥 Atendimento da loja (1-5 estrelas)
📦 Qualidade do produto (1-5 estrelas)

Basta escrever "avaliar" quando quiser. É opcional 😊`,
    ja: `🎉 注文 #{{orderId}} が配達されました！

お楽しみください！🍽️

📝 *体験を評価しませんか？*
ご意見は改善に役立ちます。

評価項目：
⏱️ 配達時間（1-5星）
👥 店舗サービス（1-5星）
📦 商品品質（1-5星）

「評価する」と入力してください。任意です 😊`,
  },
  delivered_pickup: {
    es: '🎉 ¡Tu pedido #{{orderId}} ha sido entregado! ¡Gracias por retirarlo!',
    en: '🎉 Your order #{{orderId}} has been delivered! Thanks for picking it up!',
    pt: '🎉 Seu pedido #{{orderId}} foi entregue! Obrigado por retirá-lo!',
    ja: '🎉 注文 #{{orderId}} が配達されました！お受け取りありがとうございます！',
  },
  payment_confirmed: {
    es: '✅ ¡Tu pago ha sido confirmado!\n\nPedido: #{{orderId}}\nEstado: {{statusLabel}}\n\n¡Gracias por tu compra! 😊',
    en: '✅ Your payment has been confirmed!\n\nOrder: #{{orderId}}\nStatus: {{statusLabel}}\n\nThank you for your purchase! 😊',
    pt: '✅ Seu pagamento foi confirmado!\n\nPedido: #{{orderId}}\nStatus: {{statusLabel}}\n\nObrigado pela sua compra! 😊',
    ja: '✅ お支払いが確認されました！\n\n注文: #{{orderId}}\nステータス: {{statusLabel}}\n\nご購入ありがとうございます！😊',
  },
  payment_problem: {
    es: '⚠️ Hay un problema con tu pago\n\nPedido: #{{orderId}}\n\nPor favor, verificá tu comprobante de pago o contactá con nosotros. 📞',
    en: '⚠️ There is a problem with your payment\n\nOrder: #{{orderId}}\n\nPlease verify your payment receipt or contact us. 📞',
    pt: '⚠️ Há um problema com seu pagamento\n\nPedido: #{{orderId}}\n\nPor favor, verifique seu comprovante de pagamento ou entre em contato conosco. 📞',
    ja: '⚠️ お支払いに問題があります\n\n注文: #{{orderId}}\n\nお支払い証明をご確認いただくか、お問い合わせください。📞',
  },
  cancellation: {
    es: 'Tu pedido #{{orderId}} ha sido cancelado. Motivo: {{reason}}. Si tienes alguna duda, contacta al vendedor.',
    en: 'Your order #{{orderId}} has been cancelled. Reason: {{reason}}. Contact the store if you have questions.',
    pt: 'Seu pedido #{{orderId}} foi cancelado. Motivo: {{reason}}. Entre em contato com a loja se tiver dúvidas.',
    ja: '注文 #{{orderId}} がキャンセルされました。理由: {{reason}}。ご質問があれば店舗にお問い合わせください。',
  },
  bot_active: {
    es: '✅ El bot está activo nuevamente.',
    en: '✅ The bot is active again.',
    pt: '✅ O bot está ativo novamente.',
    ja: '✅ ボットが再びアクティブになりました。',
  },
  bot_active_full: {
    es: '✅ El bot está activo nuevamente. Puedes seguir haciendo consultas o pedidos.',
    en: '✅ The bot is active again. You can continue browsing or placing orders.',
    pt: '✅ O bot está ativo novamente. Você pode continuar fazendo consultas ou pedidos.',
    ja: '✅ ボットが再びアクティブになりました。引き続きご注文やお問い合わせが可能です。',
  },
  bot_paused: {
    es: '⚠️ *{{vendorName}}* va a responderte personalmente.\n\n🤖 El bot está pausado.\n\n_Escribí *"menu"* para volver al bot._',
    en: '⚠️ *{{vendorName}}* will reply to you personally.\n\n🤖 The bot is paused.\n\n_Type *"menu"* to return to the bot._',
    pt: '⚠️ *{{vendorName}}* vai responder pessoalmente.\n\n🤖 O bot está pausado.\n\n_Digite *"menu"* para voltar ao bot._',
    ja: '⚠️ *{{vendorName}}* が直接対応します。\n\n🤖 ボットは一時停止中です。\n\n_*「メニュー」*と入力してボットに戻れます。_',
  },
  vendor_message: {
    es: '📩 Mensaje de *{{vendorName}}*: {{message}}',
    en: '📩 Message from *{{vendorName}}*: {{message}}',
    pt: '📩 Mensagem de *{{vendorName}}*: {{message}}',
    ja: '📩 *{{vendorName}}* からのメッセージ: {{message}}',
  },
};

function interpolate(template: string, data: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumber, notificationType, data } = await req.json();

    if (!phoneNumber || !notificationType) {
      return new Response(
        JSON.stringify({ error: 'phoneNumber and notificationType are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const template = translations[notificationType];
    if (!template) {
      return new Response(
        JSON.stringify({ error: `Unknown notificationType: ${notificationType}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Lookup customer language from user_sessions
    let lang: Lang = 'es';
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);

      // Normalize phone for lookup (remove non-digits)
      const cleanPhone = phoneNumber.replace(/[^\\d]/g, '');

      const { data: session } = await supabase
        .from('user_sessions')
        .select('last_bot_message')
        .or(`phone.eq.${cleanPhone},phone.eq.${phoneNumber}`)
        .maybeSingle();

      if (session?.last_bot_message) {
        try {
          const ctx = typeof session.last_bot_message === 'string'
            ? JSON.parse(session.last_bot_message)
            : session.last_bot_message;
          if (ctx.language && ['es', 'en', 'pt', 'ja'].includes(ctx.language)) {
            lang = ctx.language as Lang;
          }
        } catch {
          // keep default
        }
      }
    } catch (e) {
      console.error('Error looking up language:', e);
    }

    const message = interpolate(template[lang], data || {});

    return new Response(
      JSON.stringify({ message, language: lang }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in translate-customer-notification:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
