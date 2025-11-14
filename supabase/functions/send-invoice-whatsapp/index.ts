import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL")!;
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY")!;
    const evolutionInstanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME")!;

    const { invoice_id } = await req.json();
    console.log("Sending invoice via WhatsApp for:", invoice_id);

    // Fetch invoice data
    const { data: invoice, error: invoiceError } = await supabase
      .from("commission_invoices")
      .select("*, vendors(name, phone, whatsapp_number)")
      .eq("id", invoice_id)
      .single();

    if (invoiceError) throw invoiceError;

    const vendorPhone = invoice.vendors.whatsapp_number || invoice.vendors.phone;
    
    // Format amounts
    const totalAmount = new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(invoice.total_amount);

    const periodStart = new Date(invoice.period_start).toLocaleDateString("es-AR");
    const periodEnd = new Date(invoice.period_end).toLocaleDateString("es-AR");

    // Generate PDF
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
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

    // Send text message first
    const textMessage = `🧾 *FACTURA DE COMISIONES*\n\n` +
      `Hola *${invoice.vendors.name}*,\n\n` +
      `Te enviamos tu factura de comisiones:\n\n` +
      `📋 *Factura N°:* ${invoice.invoice_number}\n` +
      `📅 *Período:* ${periodStart} - ${periodEnd}\n` +
      `💰 *Total a pagar:* ${totalAmount}\n\n` +
      `A continuación recibirás el PDF con el detalle completo.`;

    await fetch(`${evolutionApiUrl}/message/sendText/${evolutionInstanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": evolutionApiKey,
      },
      body: JSON.stringify({
        number: vendorPhone,
        text: textMessage,
      }),
    });

    // Wait a moment before sending the document
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Send PDF document
    const documentResponse = await fetch(
      `${evolutionApiUrl}/message/sendMedia/${evolutionInstanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": evolutionApiKey,
        },
        body: JSON.stringify({
          number: vendorPhone,
          mediatype: "document",
          mimetype: "application/pdf",
          media: pdfBase64,
          fileName: `Factura-${invoice.invoice_number}.pdf`,
        }),
      }
    );

    const result = await documentResponse.json();
    console.log("WhatsApp message sent successfully:", result);

    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending invoice via WhatsApp:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
