import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNotificationPermission } from './useNotificationPermission';

export interface VendorNotification {
  id: string;
  vendor_id: string;
  type: 'new_order' | 'order_cancelled' | 'payment_received' | 'order_updated' | 'customer_message';
  title: string;
  message: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

interface UseVendorNotificationsReturn {
  notifications: VendorNotification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
}

export function useVendorNotifications(vendorId?: string): UseVendorNotificationsReturn {
  const [notifications, setNotifications] = useState<VendorNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('notification-sound') !== 'false';
    }
    return true;
  });
  const { toast } = useToast();
  const { showNotification, permission } = useNotificationPermission();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio('/sounds/notification.mp3');
    audioRef.current.preload = 'auto';
    return () => {
      audioRef.current = null;
    };
  }, []);

  // Save sound preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('notification-sound', soundEnabled ? 'true' : 'false');
    }
  }, [soundEnabled]);

  // Play notification sound
  const playSound = useCallback((type: string) => {
    if (!soundEnabled || !audioRef.current) return;
    
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(e => console.log('Could not play sound:', e));
  }, [soundEnabled]);

  // Fetch existing notifications
  useEffect(() => {
    if (!vendorId) {
      setLoading(false);
      return;
    }

    const fetchNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('vendor_notification_history')
          .select('*')
          .eq('vendor_id', vendorId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        setNotifications(data as VendorNotification[] || []);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [vendorId]);

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!vendorId) return;

    const channel = supabase
      .channel(`vendor-notifications-${vendorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vendor_notification_history',
          filter: `vendor_id=eq.${vendorId}`
        },
        (payload) => {
          const newNotification = payload.new as VendorNotification;
          console.log('New notification received:', newNotification);
          
          setNotifications(prev => [newNotification, ...prev]);
          
          // Play sound
          playSound(newNotification.type);
          
          // Show toast
          const toastConfig = getToastConfig(newNotification.type);
          toast({
            title: `${toastConfig.emoji} ${newNotification.title}`,
            description: newNotification.message,
            duration: 10000,
          });

          // Show native notification if permission granted
          if (permission === 'granted') {
            showNotification(newNotification.title, {
              body: newNotification.message,
              tag: newNotification.id,
              data: { url: '/vendor-dashboard' }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [vendorId, playSound, toast, showNotification, permission]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('vendor_notification_history')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;
      
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!vendorId) return;
    
    try {
      const { error } = await supabase
        .from('vendor_notification_history')
        .update({ is_read: true })
        .eq('vendor_id', vendorId)
        .eq('is_read', false);

      if (error) throw error;
      
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [vendorId]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    soundEnabled,
    setSoundEnabled
  };
}

function getToastConfig(type: string): { emoji: string; variant?: 'default' | 'destructive' } {
  switch (type) {
    case 'new_order':
      return { emoji: '🆕' };
    case 'order_cancelled':
      return { emoji: '❌', variant: 'destructive' };
    case 'payment_received':
      return { emoji: '💰' };
    case 'order_updated':
      return { emoji: '📦' };
    case 'customer_message':
      return { emoji: '💬' };
    default:
      return { emoji: '🔔' };
  }
}
