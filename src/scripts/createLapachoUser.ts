import { supabase } from "@/integrations/supabase/client";

export async function createLapachoUser() {
  try {
    console.log('Creating Lapacho Restaurant user...');
    
    const { data, error } = await supabase.functions.invoke('create-vendor-user', {
      body: {
        email: 'restaurant@example.com',
        password: 'restaurant123',
        vendorId: 'f6a7b8c9-d0e1-2345-fabc-678901234567'
      }
    });

    if (error) {
      console.error('Error:', error);
      return { success: false, error: error.message };
    }

    console.log('Success:', data);
    return { success: true, data };
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return { success: false, error: error.message };
  }
}

// Auto-execute when imported
createLapachoUser().then(result => {
  if (result.success) {
    console.log('✅ Usuario creado exitosamente para Lapacho Restaurant');
    console.log('📧 Email: restaurant@example.com');
    console.log('🔑 Contraseña: restaurant123');
  } else {
    console.error('❌ Error:', result.error);
  }
});
