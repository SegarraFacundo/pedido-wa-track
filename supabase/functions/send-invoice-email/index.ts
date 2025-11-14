import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { invoice_id, vendor_email } = await req.json();
    console.log("Sending invoice email for:", invoice_id, "to:", vendor_email);

    // Fetch invoice data
    const { data: invoice, error: invoiceError } = await supabase
      .from("commission_invoices")
      .select("*, vendors(name, phone)")
      .eq("id", invoice_id)
      .single();

    if (invoiceError) throw invoiceError;

    // Generate PDF by calling the generate-invoice-pdf function
    const pdfResponse = await fetch(
      `${supabaseUrl}/functions/v1/generate-invoice-pdf`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ invoice_id }),
      }
    );

    if (!pdfResponse.ok) {
      throw new Error("Failed to generate PDF");
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = btoa(
      String.fromCharCode(...new Uint8Array(pdfBuffer))
    );

    // Format amounts
    const totalAmount = new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(invoice.total_amount);

    const periodStart = new Date(invoice.period_start).toLocaleDateString(
      "es-AR"
    );
    const periodEnd = new Date(invoice.period_end).toLocaleDateString("es-AR");

    // Send email with Resend
    const emailResponse = await resend.emails.send({
      from: "Plataforma de Delivery <onboarding@resend.dev>",
      to: [vendor_email],
      subject: `Factura de Comisiones ${invoice.invoice_number}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px;">
            Factura de Comisiones
          </h1>
          
          <p>Hola <strong>${invoice.vendors.name}</strong>,</p>
          
          <p>Te enviamos tu factura de comisiones correspondiente al período del <strong>${periodStart}</strong> al <strong>${periodEnd}</strong>.</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0;"><strong>N° de Factura:</strong></td>
                <td style="text-align: right;">${invoice.invoice_number}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Período:</strong></td>
                <td style="text-align: right;">${periodStart} - ${periodEnd}</td>
              </tr>
              <tr style="border-top: 2px solid #ddd;">
                <td style="padding: 8px 0; font-size: 18px;"><strong>Total a Pagar:</strong></td>
                <td style="text-align: right; font-size: 18px; color: #4CAF50;"><strong>${totalAmount}</strong></td>
              </tr>
            </table>
          </div>
          
          <p>Encontrarás el detalle completo de las comisiones en el archivo PDF adjunto.</p>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Si tienes alguna pregunta sobre esta factura, no dudes en contactarnos.
          </p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            Este es un correo automático, por favor no respondas a este mensaje.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `Factura-${invoice.invoice_number}.pdf`,
          content: pdfBase64,
        },
      ],
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending invoice email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
