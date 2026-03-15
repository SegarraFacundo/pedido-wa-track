import { supabase } from '@/integrations/supabase/client';

/**
 * Get a translated notification message for a customer based on their language preference.
 * Falls back to Spanish if translation fails.
 */
export async function getTranslatedNotification(
  phoneNumber: string,
  notificationType: string,
  data: Record<string, string> = {}
): Promise<string> {
  try {
    const { data: result, error } = await supabase.functions.invoke('translate-customer-notification', {
      body: { phoneNumber, notificationType, data }
    });

    if (error) {
      console.error('Translation function error:', error);
      return ''; // caller should use fallback
    }

    return result?.message || '';
  } catch (e) {
    console.error('Error calling translate-customer-notification:', e);
    return '';
  }
}
