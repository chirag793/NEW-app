import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

// Fallback/default sound URL. Use a reliable hosted short beep by default (can be overridden by passing a url).
const DEFAULT_SOUND_URL = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';

// Keep a reference to the native sound object so we can stop/unload it later
let soundObject: Audio.Sound | null = null;

// For web preloading/unlock
let webAudioElement: HTMLAudioElement | null = null;
// Track any pending timeouts created for web playback so they can be cleared on stop
let webTimeoutIds: number[] = [];

/**
 * Preload/unlock the web audio element. Call this from a user gesture (Start button) to improve autoplay success.
 */
export async function unlockRemoteNotification(url?: string) {
  if (Platform.OS !== 'web') return;
  const uri = url || DEFAULT_SOUND_URL;
  try {
    if (!webAudioElement) {
      webAudioElement = new (window as any).Audio(uri);
      const el = webAudioElement;
      if (el) {
        el.preload = 'auto';
        try { el.load(); } catch { /* ignore */ }
      }
    } else if (webAudioElement.src !== uri) {
      webAudioElement.src = uri;
    }
  } catch (err) {
    console.warn('unlockRemoteNotification failed:', err);
  }
}

/**
 * Play the completion/notification sound. Works on web (HTMLAudioElement) and native via expo-av.
 * Accepts an optional url to override the built-in one.
 */
export const playCompletionSound = async (url?: string) => {
  const uri = url || DEFAULT_SOUND_URL;
  try {
    if (Platform.OS === 'web') {
      console.log('🔊 Playing completion sound on web...', uri);
      try {
        // Use existing unlocked element when possible
        const audio = webAudioElement ?? new (window as any).Audio(uri);
        if (!webAudioElement) webAudioElement = audio;
        const el = audio;
        if (el) {
          el.volume = 0.5;

          const playOnce = async () => {
            try { el.currentTime = 0; } catch {}
            // trigger vibration if available
            try { (navigator as any).vibrate?.([100]); } catch {}
            await el.play();
            // wait for end
            await new Promise<void>((resolve) => {
              const onEnd = () => {
                el.removeEventListener('ended', onEnd);
                resolve();
              };
              el.addEventListener('ended', onEnd);
            });
          };

          // Play twice with a short gap
          await playOnce();
          // small gap between beeps
          await new Promise<void>((resolve) => {
            const id = window.setTimeout(() => { resolve(); }, 250);
            webTimeoutIds.push(id);
          });
          await playOnce();
        }
        console.log('✅ Sound played successfully on web (2x)');
      } catch (err) {
        console.error('❌ Web audio play failed:', err);
      }
    } else {
      console.log('🔊 Playing completion sound on mobile...', uri);
      // If a sound is already loaded, unload it first
      if (soundObject) {
        try { await soundObject.unloadAsync(); } catch { /* ignore */ }
        soundObject = null;
      }

      // Ensure audio mode is appropriate for notifications
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      } catch (err) {
        console.warn('Audio.setAudioModeAsync failed:', err);
      }

      try {
        // Create sound but don't auto-play; we'll control playback so we can play twice
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false, volume: 0.5 }
        );
        soundObject = sound;

        // Helper to wait until current playback finishes
        const waitForFinish = () => new Promise<void>((resolve) => {
          const cb = (status: any) => {
            if (status && status.isLoaded && status.didJustFinish) {
              // detach handler
              sound.setOnPlaybackStatusUpdate(() => {});
              resolve();
            }
          };
          sound.setOnPlaybackStatusUpdate(cb);
        });

        // Play once
        try {
          // Vibration on start
          try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
          await sound.playAsync();
          await waitForFinish();

          // Small pause then replay
          await new Promise(resolve => setTimeout(resolve, 250));
          try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
          // replay
          if (typeof (sound as any).replayAsync === 'function') {
            await (sound as any).replayAsync();
          } else {
            // fallback: set position to 0 and play
            try { await sound.setPositionAsync(0); } catch {}
            await sound.playAsync();
          }
          await waitForFinish();
        } finally {
          // cleanup
          try { await sound.unloadAsync(); } catch {}
          if (soundObject === sound) soundObject = null;
        }

        console.log('✅ Sound played successfully on mobile (2x)');
      } catch (err) {
        console.error('❌ Error playing sound with expo-av:', err);
      }
    }
  } catch (error) {
    console.error('❌ Error playing completion sound:', error);
  }
};

/**
 * Stop and unload any currently playing native sound.
 */
export const stopSound = async () => {
  try {
    if (soundObject) {
      try { await soundObject.stopAsync(); } catch {}
      try { await soundObject.unloadAsync(); } catch {}
      soundObject = null;
    }
    // On web we can't reliably stop a created element from other modules unless we tracked it; try pausing
    if (webAudioElement) {
      try { webAudioElement.pause(); webAudioElement.currentTime = 0; } catch {}
      try { webAudioElement.removeEventListener('ended', () => {}); } catch {}
    }

    // clear any web timeouts
    try {
      webTimeoutIds.forEach(id => clearTimeout(id));
    } catch {}
    webTimeoutIds = [];
  } catch (error) {
    console.error('Error stopping sound:', error);
  }
};

/**
 * Backwards-compatible wrapper used elsewhere in the repo: playRemoteNotification
 */
export async function playRemoteNotification(url?: string) {
  return playCompletionSound(url);
}

