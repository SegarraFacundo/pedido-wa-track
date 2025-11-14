import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import PDFDocument from "npm:pdfkit@0.15.0";

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
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Uint8Array[] = [];

    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("FACTURA DE COMISIONES", { align: "center" })
      .moveDown(0.5);

    // Invoice info
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`Factura N°: ${data.invoice_number}`, { align: "right" })
      .text(
        `Fecha de emisión: ${new Date().toLocaleDateString("es-AR")}`,
        { align: "right" }
      )
      .moveDown(1);

    // Vendor info
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("DATOS DEL VENDOR")
      .moveDown(0.3);

    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`Nombre: ${data.vendor_name}`)
      .text(`Teléfono: ${data.vendor_phone}`)
      .moveDown(1);

    // Period info
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("PERÍODO DE FACTURACIÓN")
      .moveDown(0.3);

    doc
      .fontSize(10)
      .font("Helvetica")
      .text(
        `Desde: ${new Date(data.period_start).toLocaleDateString("es-AR")}`
      )
      .text(`Hasta: ${new Date(data.period_end).toLocaleDateString("es-AR")}`)
      .moveDown(1);

    // Table header
    doc.fontSize(12).font("Helvetica-Bold").text("DETALLE DE COMISIONES");
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const tableHeaders = [
      { label: "Fecha", x: 50, width: 80 },
      { label: "Pedido", x: 130, width: 100 },
      { label: "Total Pedido", x: 230, width: 100 },
      { label: "Comisión", x: 330, width: 100 },
    ];

    // Draw table header
    doc.fontSize(9).font("Helvetica-Bold");
    tableHeaders.forEach((header) => {
      doc.text(header.label, header.x, tableTop, {
        width: header.width,
        align: "left",
      });
    });

    doc
      .moveTo(50, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .stroke();

    // Draw table rows
    let currentY = tableTop + 25;
    doc.fontSize(8).font("Helvetica");

    data.items.forEach((item, index) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      const date = new Date(item.created_at).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
      });
      const orderId = item.order_id.substring(0, 8);
      const orderTotal = `$ ${Number(item.order_total).toLocaleString("es-AR")}`;
      const commission = `$ ${Number(item.commission_amount).toLocaleString("es-AR")}`;

      doc.text(date, 50, currentY, { width: 80 });
      doc.text(orderId, 130, currentY, { width: 100 });
      doc.text(orderTotal, 230, currentY, { width: 100, align: "right" });
      doc.text(commission, 330, currentY, { width: 100, align: "right" });

      currentY += 20;
    });

    // Draw line before total
    doc
      .moveTo(50, currentY)
      .lineTo(550, currentY)
      .stroke();

    currentY += 15;

    // Total
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text(
        `TOTAL A PAGAR: $ ${Number(data.total_amount).toLocaleString("es-AR")}`,
        330,
        currentY,
        { width: 200, align: "right" }
      );

    // Footer
    doc
      .fontSize(8)
      .font("Helvetica")
      .text(
        "Esta factura corresponde a las comisiones generadas durante el período especificado.",
        50,
        750,
        { align: "center", width: 500 }
      );

    doc.end();
  });
}
