import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotifyRequest {
  error_type: string;
  error_message: string;
  error_count: number;
  threshold: number;
}

interface AdminContact {
  user_id: string;
  email: string;
  phone: string | null;
  notify_email: boolean;
  notify_whatsapp: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🚨 notify-admin-emergency: Request received');

  try {
    const { error_type, error_message, error_count, threshold }: NotifyRequest = await req.json();
    
    console.log(`📋 Notification details:
      - Type: ${error_type}
      - Error count: ${error_count}/${threshold}
      - Message: ${error_message?.substring(0, 100)}...`);

    // Initialize clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all admin emergency contacts
    const { data: admins, error: adminsError } = await supabase
      .from('admin_emergency_contacts')
      .select('user_id, email, phone, notify_email, notify_whatsapp');

    if (adminsError) {
      console.error('❌ Error fetching admin contacts:', adminsError);
      throw adminsError;
    }

    if (!admins || admins.length === 0) {
      console.warn('⚠️ No admin emergency contacts configured');
      return new Response(
        JSON.stringify({ success: false, message: 'No admin contacts configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📧 Found ${admins.length} admin contacts to notify`);

    // Format timestamp for Argentina timezone
    const timestamp = new Date().toLocaleString('es-AR', { 
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    let emailsSent = 0;
    let whatsappsSent = 0;

    // Send email notifications
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      
      for (const admin of admins as AdminContact[]) {
        if (admin.notify_email && admin.email) {
          try {
            console.log(`📧 Sending email to ${admin.email}...`);
            
            await resend.emails.send({
              from: 'Alertas Lapacho <onboarding@resend.dev>',
              to: [admin.email],
              subject: '🚨 ALERTA: Modo Emergencia Activado Automáticamente',
              html: `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f5;">
                  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                      <h1 style="margin: 0; font-size: 24px; font-weight: bold;">
                        🚨 MODO EMERGENCIA ACTIVADO
                      </h1>
                      <p style="margin: 10px 0 0 0; opacity: 0.9;">
                        El sistema ha detectado errores consecutivos
                      </p>
                    </div>
                    
                    <!-- Content -->
                    <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
                      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                        <tr>
                          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                            <strong style="color: #374151;">📅 Fecha/Hora:</strong>
                          </td>
                          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">
                            ${timestamp}
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                            <strong style="color: #374151;">❌ Tipo de Error:</strong>
                          </td>
                          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">
                            ${error_type}
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                            <strong style="color: #374151;">🔢 Errores Consecutivos:</strong>
                          </td>
                          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                            <span style="background: #fef2f2; color: #dc2626; padding: 4px 12px; border-radius: 20px; font-weight: bold;">
                              ${error_count}/${threshold}
                            </span>
                          </td>
                        </tr>
                      </table>
                      
                      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                        <strong style="color: #991b1b; display: block; margin-bottom: 8px;">📋 Último Error:</strong>
                        <pre style="background: #fff; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px; color: #374151; margin: 0; white-space: pre-wrap; word-break: break-word;">${error_message || 'Sin mensaje de error'}</pre>
                      </div>
                      
                      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                        <p style="margin: 0; color: #92400e;">
                          <strong>⚠️ Acción Requerida:</strong> El bot de WhatsApp está en modo de contingencia. 
                          Los mensajes se están manejando según el modo de fallback configurado.
                        </p>
                      </div>
                      
                      <!-- CTA Button -->
                      <div style="text-align: center;">
                        <a href="https://pedido-wa-track.lovable.app/admin" 
                           style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                          Ir al Panel de Control →
                        </a>
                      </div>
                    </div>
                    
                    <!-- Footer -->
                    <div style="padding: 20px; text-align: center; color: #6b7280; font-size: 12px;">
                      <p style="margin: 0;">
                        Este es un mensaje automático del sistema de alertas de Lapacho.
                      </p>
                      <p style="margin: 8px 0 0 0;">
                        Si no deseas recibir estas alertas, puedes desactivarlas en el panel de administración.
                      </p>
                    </div>
                  </div>
                </body>
                </html>
              `,
            });
            
            emailsSent++;
            console.log(`✅ Email sent successfully to ${admin.email}`);
          } catch (emailError) {
            console.error(`❌ Failed to send email to ${admin.email}:`, emailError);
          }
        }
      }
    } else {
      console.warn('⚠️ RESEND_API_KEY not configured, skipping email notifications');
    }

    // Send WhatsApp notifications
    for (const admin of admins as AdminContact[]) {
      if (admin.notify_whatsapp && admin.phone) {
        try {
          console.log(`📱 Sending WhatsApp to ${admin.phone}...`);
          
          const whatsappMessage = 
            `🚨 *ALERTA: MODO EMERGENCIA ACTIVADO*\n\n` +
            `📅 *Fecha/Hora:* ${timestamp}\n` +
            `❌ *Tipo:* ${error_type}\n` +
            `🔢 *Errores:* ${error_count}/${threshold}\n\n` +
            `📋 *Último error:*\n${error_message?.substring(0, 200) || 'Sin mensaje'}${error_message && error_message.length > 200 ? '...' : ''}\n\n` +
            `⚠️ El bot está en modo contingencia.\n` +
            `🔗 Panel: https://pedido-wa-track.lovable.app/admin`;
          
          const { error: waError } = await supabase.functions.invoke('send-whatsapp-notification', {
            body: {
              phoneNumber: admin.phone,
              message: whatsappMessage,
              orderId: 'emergency-alert',
            },
          });
          
          if (waError) {
            throw waError;
          }
          
          whatsappsSent++;
          console.log(`✅ WhatsApp sent successfully to ${admin.phone}`);
        } catch (waError) {
          console.error(`❌ Failed to send WhatsApp to ${admin.phone}:`, waError);
        }
      }
    }

    console.log(`📊 Notification summary: ${emailsSent} emails, ${whatsappsSent} WhatsApps sent`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notified: admins.length,
        emails_sent: emailsSent,
        whatsapps_sent: whatsappsSent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in notify-admin-emergency:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
