import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { PDFDocument, rgb, StandardFonts } from "https://cdn.skypack.dev/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvoiceData {
  invoice_id: string;
  vendor_name: string;
  vendor_phone: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  items: Array<{
    order_id: string;
    commission_amount: number;
    order_total: number;
    created_at: string;
  }>;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { invoice_id } = await req.json();
    console.log("Generating PDF for invoice:", invoice_id);

    // Fetch invoice data
    const { data: invoice, error: invoiceError } = await supabase
      .from("commission_invoices")
      .select("*, vendors(name, phone)")
      .eq("id", invoice_id)
      .single();

    if (invoiceError) throw invoiceError;

    // Fetch invoice items with commission details
    const { data: items, error: itemsError } = await supabase
      .from("commission_invoice_items")
      .select(`
        commission_id,
        vendor_commissions!inner(
          order_id,
          commission_amount,
          order_total,
          created_at
        )
      `)
      .eq("invoice_id", invoice_id);

    if (itemsError) throw itemsError;

    const invoiceData: InvoiceData = {
      invoice_id: invoice.id,
      vendor_name: invoice.vendors.name,
      vendor_phone: invoice.vendors.phone,
      invoice_number: invoice.invoice_number,
      period_start: invoice.period_start,
      period_end: invoice.period_end,
      total_amount: invoice.total_amount,
      items: items.map((item: any) => ({
        order_id: item.vendor_commissions.order_id,
        commission_amount: item.vendor_commissions.commission_amount,
        order_total: item.vendor_commissions.order_total,
        created_at: item.vendor_commissions.created_at,
      })),
    };

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoiceData);

    return new Response(pdfBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Factura-${invoiceData.invoice_number}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating invoice PDF:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function generateInvoicePDF(data: InvoiceData): Promise<Uint8Array> {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
  const { width, height } = page.getSize();
  
  // Load fonts
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  let yPosition = height - 50;
  
  // Header - Title
  page.drawText("FACTURA DE COMISIONES", {
    x: width / 2 - 120,
    y: yPosition,
    size: 24,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  
  yPosition -= 40;
  
  // Invoice info (right aligned)
  page.drawText(`Factura N°: ${data.invoice_number}`, {
    x: width - 200,
    y: yPosition,
    size: 10,
    font: font,
  });
  
  yPosition -= 15;
  
  page.drawText(`Fecha: ${new Date().toLocaleDateString("es-AR")}`, {
    x: width - 200,
    y: yPosition,
    size: 10,
    font: font,
  });
  
  yPosition -= 30;
  
  // Vendor info
  page.drawText("DATOS DEL VENDOR", {
    x: 50,
    y: yPosition,
    size: 12,
    font: fontBold,
  });
  
  yPosition -= 20;
  
  page.drawText(`Nombre: ${data.vendor_name}`, {
    x: 50,
    y: yPosition,
    size: 10,
    font: font,
  });
  
  yPosition -= 15;
  
  page.drawText(`Teléfono: ${data.vendor_phone}`, {
    x: 50,
    y: yPosition,
    size: 10,
    font: font,
  });
  
  yPosition -= 30;
  
  // Period info
  page.drawText("PERÍODO DE FACTURACIÓN", {
    x: 50,
    y: yPosition,
    size: 12,
    font: fontBold,
  });
  
  yPosition -= 20;
  
  const periodStart = new Date(data.period_start).toLocaleDateString("es-AR");
  const periodEnd = new Date(data.period_end).toLocaleDateString("es-AR");
  
  page.drawText(`Desde: ${periodStart}`, {
    x: 50,
    y: yPosition,
    size: 10,
    font: font,
  });
  
  yPosition -= 15;
  
  page.drawText(`Hasta: ${periodEnd}`, {
    x: 50,
    y: yPosition,
    size: 10,
    font: font,
  });
  
  yPosition -= 30;
  
  // Table header
  page.drawText("DETALLE DE COMISIONES", {
    x: 50,
    y: yPosition,
    size: 12,
    font: fontBold,
  });
  
  yPosition -= 25;
  
  // Table headers
  page.drawText("Fecha", { x: 50, y: yPosition, size: 9, font: fontBold });
  page.drawText("Pedido", { x: 130, y: yPosition, size: 9, font: fontBold });
  page.drawText("Total Pedido", { x: 230, y: yPosition, size: 9, font: fontBold });
  page.drawText("Comisión", { x: 380, y: yPosition, size: 9, font: fontBold });
  
  yPosition -= 5;
  
  // Draw line
  page.drawLine({
    start: { x: 50, y: yPosition },
    end: { x: width - 50, y: yPosition },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  
  yPosition -= 15;
  
  // Table rows
  for (const item of data.items) {
    if (yPosition < 100) {
      // Add new page if needed
      const newPage = pdfDoc.addPage([595.28, 841.89]);
      yPosition = height - 50;
    }
    
    const date = new Date(item.created_at).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
    });
    const orderId = item.order_id.substring(0, 8);
    const orderTotal = `$ ${Number(item.order_total).toLocaleString("es-AR")}`;
    const commission = `$ ${Number(item.commission_amount).toLocaleString("es-AR")}`;
    
    page.drawText(date, { x: 50, y: yPosition, size: 8, font: font });
    page.drawText(orderId, { x: 130, y: yPosition, size: 8, font: font });
    page.drawText(orderTotal, { x: 230, y: yPosition, size: 8, font: font });
    page.drawText(commission, { x: 380, y: yPosition, size: 8, font: font });
    
    yPosition -= 15;
  }
  
  yPosition -= 10;
  
  // Draw line before total
  page.drawLine({
    start: { x: 50, y: yPosition },
    end: { x: width - 50, y: yPosition },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  
  yPosition -= 20;
  
  // Total
  const totalText = `TOTAL A PAGAR: $ ${Number(data.total_amount).toLocaleString("es-AR")}`;
  page.drawText(totalText, {
    x: width - 250,
    y: yPosition,
    size: 14,
    font: fontBold,
  });
  
  // Footer
  page.drawText(
    "Esta factura corresponde a las comisiones generadas durante el período especificado.",
    {
      x: 50,
      y: 50,
      size: 8,
      font: font,
      maxWidth: width - 100,
    }
  );
  
  // Save the PDF
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
