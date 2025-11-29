import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ProductToCreate {
  name: string;
  description: string;
  price: number;
  category: string[];
  vendor_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { products, vendor_id } = await req.json() as { products: Omit<ProductToCreate, 'vendor_id'>[], vendor_id: string };
    
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const results: { name: string; success: boolean; error?: string }[] = [];

    console.log(`Processing ${products.length} products for vendor ${vendor_id}`);

    for (const product of products) {
      try {
        console.log(`Generating image for: ${product.name}`);
        
        // Generate image with OpenAI
        const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-image-1',
            prompt: `Professional product photo of ${product.name} (${product.description}). Pharmaceutical product packaging on clean white background, studio lighting, high quality commercial photography style, centered composition.`,
            n: 1,
            size: '1024x1024',
            quality: 'medium',
          }),
        });

        if (!imageResponse.ok) {
          const errorText = await imageResponse.text();
          console.error(`OpenAI error for ${product.name}:`, errorText);
          throw new Error(`OpenAI API error: ${errorText}`);
        }

        const imageData = await imageResponse.json();
        const base64Image = imageData.data[0].b64_json;
        
        // Convert base64 to Uint8Array
        const binaryString = atob(base64Image);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Upload to Supabase Storage
        const fileName = `${vendor_id}/${product.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${Date.now()}.png`;
        
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, bytes, {
            contentType: 'image/png',
            upsert: true,
          });

        if (uploadError) {
          console.error(`Upload error for ${product.name}:`, uploadError);
          throw new Error(`Upload error: ${uploadError.message}`);
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);

        console.log(`Image uploaded for ${product.name}: ${publicUrl}`);

        // Insert product into database
        const { error: insertError } = await supabase
          .from('products')
          .insert({
            name: product.name,
            description: product.description,
            price: product.price,
            category: product.category,
            vendor_id: vendor_id,
            image: publicUrl,
            is_available: true,
            stock_enabled: false,
          });

        if (insertError) {
          console.error(`Insert error for ${product.name}:`, insertError);
          throw new Error(`Insert error: ${insertError.message}`);
        }

        results.push({ name: product.name, success: true });
        console.log(`Successfully created product: ${product.name}`);

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error processing ${product.name}:`, error);
        results.push({ 
          name: product.name, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Completed: ${successCount}/${products.length} products created successfully`);

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      summary: {
        total: products.length,
        success: successCount,
        failed: products.length - successCount
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-product-images:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
