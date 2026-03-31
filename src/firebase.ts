import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

export const requestNotificationPermission = async () => {
  if (!messaging || !('Notification' in window)) {
    console.warn('Notifications not supported in this browser.');
    return null;
  }
  
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Note: getToken will fail if VAPID key is not configured in Firebase Console
      // For now, we attempt to get it, but catch the error gracefully
      try {
        const token = await getToken(messaging, {
          // vapidKey: 'YOUR_VAPID_KEY_HERE' // Replace with your actual VAPID key from Firebase Console
        });
        return token;
      } catch (tokenError) {
        console.error('FCM Token error (Check VAPID key):', tokenError);
        return 'granted_but_no_token'; // Special state to indicate permission is OK but token failed
      }
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
  }
  return null;
};
