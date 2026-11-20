import { supabase } from "@/integrations/supabase/client";

// Clave pública VAPID (es pública: va en el cliente). La privada es un secret del backend.
const VAPID_PUBLIC_KEY =
  "BBnNorn0H1y9S6O6aeQ1Qj6kK-6foyAI5zH74HhuZgF863KwxFvUHJmGD0Ihs22Ylr7jlYRQS9RWUWlQJsfcwxg";

export type PushResult = "granted" | "denied" | "unsupported" | "error";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Pide permiso de notificaciones, suscribe el navegador al push (VAPID) y guarda
 * la suscripción en la tabla push_subscriptions (atada al usuario; invitado si hace falta).
 * Con esto el cliente recibe avisos del pedido AUNQUE la PWA esté cerrada.
 */
export async function enablePushNotifications(): Promise<PushResult> {
  if (
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = sub.toJSON();
    if (!json.keys?.p256dh || !json.keys?.auth) return "error";

    // Asegurar sesión (invitado) para tener user_id.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) await supabase.auth.signInAnonymously();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return "error";

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent,
      },
      { onConflict: "endpoint" },
    );
    if (error) {
      console.error("Error guardando la suscripción push:", error);
      return "error";
    }
    return "granted";
  } catch (e) {
    console.error("Error suscribiendo al push:", e);
    return "error";
  }
}
