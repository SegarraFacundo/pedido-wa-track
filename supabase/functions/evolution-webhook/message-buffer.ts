// =============================================
// SISTEMA DE DEBOUNCE Y COLA PARA MENSAJES
// =============================================

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

// Configuración
const DEBOUNCE_MS = 2000;           // 2 segundos de espera
const MAX_BUFFER_MESSAGES = 5;       // Máximo mensajes a agrupar
const MAX_BUFFER_CHARS = 1000;       // Máximo caracteres combinados
const LOCK_TIMEOUT_MS = 30000;       // 30 segundos timeout del lock
const SPAM_THRESHOLD = 10;           // Mensajes en 10 segundos = spam
const SPAM_WINDOW_SECONDS = 10;
const MAX_SINGLE_MESSAGE_CHARS = 500; // Máximo caracteres por mensaje individual

interface BufferedMessage {
  id: string;
  phone: string;
  message_text: string | null;
  image_url: string | null;
  document_url: string | null;
  raw_jid: string | null;
  created_at: string;
}

interface BufferResult {
  action: 'process' | 'buffered' | 'delegated' | 'spam' | 'too_long';
  combinedText?: string;
  lastImageUrl?: string | null;
  lastDocumentUrl?: string | null;
  messageCount?: number;
  spamMessage?: string;
  warningMessage?: string;
}

/**
 * Agrega un mensaje al buffer
 */
export async function addToBuffer(
  supabase: SupabaseClient,
  phone: string,
  messageText: string | null,
  imageUrl: string | null,
  documentUrl: string | null,
  rawJid: string | null
): Promise<void> {
  await supabase.from('message_buffer').insert({
    phone,
    message_text: messageText,
    image_url: imageUrl,
    document_url: documentUrl,
    raw_jid: rawJid
  });
  
  console.log(`📥 Message buffered for ${phone}`);
}

/**
 * Verifica si hay spam (más de 10 mensajes en 10 segundos)
 */
async function checkSpam(supabase: SupabaseClient, phone: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - SPAM_WINDOW_SECONDS * 1000).toISOString();
  
  const { count } = await supabase
    .from('message_buffer')
    .select('*', { count: 'exact', head: true })
    .eq('phone', phone)
    .gte('created_at', windowStart);
  
  return (count || 0) > SPAM_THRESHOLD;
}

/**
 * Intenta adquirir el lock de procesamiento
 * Retorna true si se adquirió el lock, false si ya hay otro proceso
 */
async function tryAcquireLock(supabase: SupabaseClient, phone: string): Promise<boolean> {
  // Primero verificar si hay un lock activo
  const { data: session } = await supabase
    .from('user_sessions')
    .select('processing_lock, lock_acquired_at')
    .eq('phone', phone)
    .maybeSingle();
  
  if (session?.processing_lock) {
    const lockAge = Date.now() - new Date(session.lock_acquired_at || 0).getTime();
    
    // Si el lock es reciente, no podemos adquirirlo
    if (lockAge < LOCK_TIMEOUT_MS) {
      console.log(`🔒 Lock active for ${phone}, age: ${lockAge}ms`);
      return false;
    }
    
    // Lock viejo, podemos tomarlo (anti-deadlock)
    console.log(`🔓 Stale lock detected for ${phone}, taking over`);
  }
  
  // Intentar adquirir el lock con upsert
  const { error } = await supabase
    .from('user_sessions')
    .upsert({
      phone,
      processing_lock: true,
      lock_acquired_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'phone' });
  
  if (error) {
    console.error('❌ Error acquiring lock:', error);
    return false;
  }
  
  // Verificar que realmente tenemos el lock
  const { data: verify } = await supabase
    .from('user_sessions')
    .select('processing_lock')
    .eq('phone', phone)
    .single();
  
  return verify?.processing_lock === true;
}

/**
 * Libera el lock de procesamiento
 */
export async function releaseLock(supabase: SupabaseClient, phone: string): Promise<void> {
  await supabase
    .from('user_sessions')
    .update({
      processing_lock: false,
      lock_acquired_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('phone', phone);
  
  console.log(`🔓 Lock released for ${phone}`);
}

/**
 * Obtiene y combina todos los mensajes del buffer
 */
async function getAndCombineBuffer(supabase: SupabaseClient, phone: string): Promise<{
  combinedText: string;
  lastImageUrl: string | null;
  lastDocumentUrl: string | null;
  messageCount: number;
  messageIds: string[];
}> {
  const { data: messages } = await supabase
    .from('message_buffer')
    .select('*')
    .eq('phone', phone)
    .order('created_at', { ascending: true })
    .limit(MAX_BUFFER_MESSAGES);
  
  if (!messages || messages.length === 0) {
    return {
      combinedText: '',
      lastImageUrl: null,
      lastDocumentUrl: null,
      messageCount: 0,
      messageIds: []
    };
  }
  
  // Combinar textos
  let combinedText = messages
    .map(m => m.message_text)
    .filter(Boolean)
    .join('\n');
  
  // Truncar si excede el máximo
  if (combinedText.length > MAX_BUFFER_CHARS) {
    combinedText = combinedText.slice(0, MAX_BUFFER_CHARS) + '...';
  }
  
  // Obtener la última imagen/documento
  const lastImageUrl = messages
    .filter(m => m.image_url)
    .pop()?.image_url || null;
  
  const lastDocumentUrl = messages
    .filter(m => m.document_url)
    .pop()?.document_url || null;
  
  return {
    combinedText,
    lastImageUrl,
    lastDocumentUrl,
    messageCount: messages.length,
    messageIds: messages.map(m => m.id)
  };
}

/**
 * Limpia los mensajes procesados del buffer
 */
async function clearBuffer(supabase: SupabaseClient, phone: string, messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return;
  
  await supabase
    .from('message_buffer')
    .delete()
    .in('id', messageIds);
  
  console.log(`🧹 Cleared ${messageIds.length} messages from buffer for ${phone}`);
}

/**
 * Función principal: procesa el mensaje con debounce
 * 
 * Retorna:
 * - { action: 'process', ... } → Procesar con el bot
 * - { action: 'buffered' } → Mensaje guardado, otro proceso se encargará
 * - { action: 'delegated' } → Otro proceso ya está manejando
 * - { action: 'spam', spamMessage } → Usuario está spameando
 */
export async function processWithDebounce(
  supabase: SupabaseClient,
  phone: string,
  messageText: string | null,
  imageUrl: string | null,
  documentUrl: string | null,
  rawJid: string | null
): Promise<BufferResult> {
  
  // 0. Verificar longitud de mensaje individual ANTES de agregar al buffer
  if (messageText && messageText.length > MAX_SINGLE_MESSAGE_CHARS) {
    console.log(`📏 Message too long (${messageText.length} chars) for ${phone}`);
    return {
      action: 'too_long',
      warningMessage: `⚠️ Tu mensaje es muy largo (${messageText.length} caracteres). Por favor enviá mensajes más cortos. Recordá que estoy para ayudarte con pedidos de comida y productos 🍕📦`
    };
  }
  
  // 1. Agregar mensaje al buffer
  await addToBuffer(supabase, phone, messageText, imageUrl, documentUrl, rawJid);
  
  // 2. Verificar spam
  const isSpam = await checkSpam(supabase, phone);
  if (isSpam) {
    console.log(`🚫 Spam detected for ${phone}`);
    return {
      action: 'spam',
      spamMessage: '⏳ Recibí varios mensajes tuyos. Dame un momento para leerlos todos y te respondo.'
    };
  }
  
  // 3. Intentar adquirir lock
  const gotLock = await tryAcquireLock(supabase, phone);
  
  if (!gotLock) {
    // Otro proceso se encargará
    console.log(`📦 Message buffered for ${phone}, another process will handle`);
    return { action: 'buffered' };
  }
  
  // 4. Tenemos el lock - esperar el debounce
  console.log(`⏱️ Waiting ${DEBOUNCE_MS}ms debounce for ${phone}`);
  await new Promise(resolve => setTimeout(resolve, DEBOUNCE_MS));
  
  // 5. Obtener y combinar todos los mensajes del buffer
  const { combinedText, lastImageUrl, lastDocumentUrl, messageCount, messageIds } = 
    await getAndCombineBuffer(supabase, phone);
  
  if (messageCount === 0) {
    await releaseLock(supabase, phone);
    console.log(`⚠️ No messages in buffer for ${phone} after debounce`);
    return { action: 'delegated' };
  }
  
  console.log(`📬 Processing ${messageCount} buffered message(s) for ${phone}`);
  console.log(`📝 Combined text: "${combinedText.slice(0, 100)}..."`);
  
  // 6. Limpiar buffer ANTES de procesar (evitar duplicados)
  await clearBuffer(supabase, phone, messageIds);
  
  // 7. Retornar para procesamiento
  // NOTA: El llamador debe llamar releaseLock() después de procesar
  return {
    action: 'process',
    combinedText: combinedText || 'mensaje vacío',
    lastImageUrl,
    lastDocumentUrl,
    messageCount
  };
}
