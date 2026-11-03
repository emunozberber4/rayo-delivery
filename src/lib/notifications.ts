// Utilities for order audio chimes, native mobile/browser push notifications, and tab title flashing

let originalTitle = typeof document !== 'undefined' ? document.title : 'Rayo Delivery';
let titleInterval: any = null;

// Synthesize an energetic electronic delivery chime using Web Audio API
export const playOrderChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      const fallbackAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      fallbackAudio.play().catch(() => {});
      return;
    }
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number, type: OscillatorType = 'triangle') => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.4, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    // 4-note ascending futuristic arrival chime: G5, C6, E6, G6
    playTone(783.99, now, 0.18, 'triangle');
    playTone(1046.50, now + 0.12, 0.20, 'triangle');
    playTone(1318.51, now + 0.24, 0.22, 'sine');
    playTone(1567.98, now + 0.36, 0.50, 'triangle');
  } catch (err) {
    try {
      const fallbackAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      fallbackAudio.play().catch(() => {});
    } catch {}
  }
};

// Vibrate mobile device (Android & supported mobile browsers)
export const vibrateDevice = (pattern: number[] = [400, 200, 400, 200, 400]) => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.log('Vibration error:', e);
    }
  }
};

// Flash the browser tab title so user sees it even if viewing another tab or app
export const flashTabTitle = (alertText: string = '⚡ ¡NUEVO PEDIDO! (1)') => {
  if (typeof document === 'undefined') return;
  if (!originalTitle || originalTitle.includes('NUEVO PEDIDO')) {
    originalTitle = 'Rayo Delivery ⚡️';
  }
  if (titleInterval) clearInterval(titleInterval);

  let toggle = false;
  titleInterval = setInterval(() => {
    document.title = toggle ? alertText : '⚡ Rayo Delivery';
    toggle = !toggle;
  }, 1000);

  const stopFlash = () => {
    if (titleInterval) {
      clearInterval(titleInterval);
      titleInterval = null;
    }
    document.title = originalTitle;
    window.removeEventListener('focus', stopFlash);
  };

  window.addEventListener('focus', stopFlash);
};

// Request system notification permissions
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (e) {
    console.error('Error requesting notification permission:', e);
    return 'denied';
  }
};

export const getNotificationPermission = (): NotificationPermission => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
};

// Dispatch a system web notification to Android / Desktop
export const sendOrderNotification = ({
  title,
  body,
  tag = 'rayo-order',
}: {
  title: string;
  body: string;
  tag?: string;
}) => {
  // Always trigger sound and vibration
  playOrderChime();
  vibrateDevice();
  flashTabTitle('🔔 ' + title);

  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.png',
        badge: '/favicon.png',
        tag,
        requireInteraction: true,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (e) {
      console.log('Native notification error:', e);
    }
  }
};

// Run an immediate end-to-end test of sound, vibration, tab alert and notification
export const testNotificationAndSound = async () => {
  let perm = getNotificationPermission();
  if (perm !== 'granted') {
    perm = await requestNotificationPermission();
  }

  sendOrderNotification({
    title: '⚡ ¡ALERTA DE PEDIDO ACTIVA!',
    body: 'Las notificaciones con sonido y vibración están funcionando perfectamente en tu dispositivo.',
    tag: 'test-notification',
  });
};
