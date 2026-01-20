import { useState, useEffect, useCallback } from 'react';

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

interface UseNotificationPermissionReturn {
  permission: NotificationPermissionState;
  requestPermission: () => Promise<boolean>;
  showNotification: (title: string, options?: NotificationOptions) => void;
  isSupported: boolean;
}

export function useNotificationPermission(): UseNotificationPermissionReturn {
  const [permission, setPermission] = useState<NotificationPermissionState>('default');
  const isSupported = typeof window !== 'undefined' && 'Notification' in window;

  useEffect(() => {
    if (!isSupported) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as NotificationPermissionState);
  }, [isSupported]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn('Notifications not supported in this browser');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermissionState);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported]);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSupported || permission !== 'granted') {
      console.log('Cannot show notification: permission not granted or not supported');
      return;
    }

    try {
      // Check if the page is visible
      if (document.visibilityState === 'visible') {
        // If page is visible, just log - the toast will handle it
        console.log('Page visible, skipping native notification');
        return;
      }

      // Show native notification when page is in background
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }, [isSupported, permission]);

  return {
    permission,
    requestPermission,
    showNotification,
    isSupported
  };
}
