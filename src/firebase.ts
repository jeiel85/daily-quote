import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithCredential, signOut, User as FirebaseUser } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, getToken, onMessage, type Messaging, type NextFn, type MessagePayload } from 'firebase/messaging';
import { getAnalytics, logEvent, type Analytics } from 'firebase/analytics';
import { Capacitor } from '@capacitor/core';

// localConfig is now handled via environment variables in .env
export const localConfig = {} as any;

const defaultFirebaseConfig = {
  apiKey: undefined,
  authDomain: 'lumina-762f8.firebaseapp.com',
  projectId: 'lumina-762f8',
  storageBucket: 'lumina-762f8.firebasestorage.app',
  messagingSenderId: '136746254242',
  appId: '1:136746254242:web:81954480c2e8b47916bcfb',
  measurementId: undefined,
  firestoreDatabaseId: 'lumina-daily',
};

if (typeof window !== 'undefined') {
  console.log('Current origin:', window.location.origin);
  console.log('Local config loaded via import:', {
    ...localConfig,
    apiKey: localConfig.apiKey ? '***' + localConfig.apiKey.slice(-4) : 'missing'
  });
}

// Use environment variables with fallback to local config
// Ensure we handle empty strings from env vars correctly
const isUsableCfg = (value: string | undefined) => {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === '""' || trimmed === "''") return false;
  return !/^(YOUR_|PLACEHOLDER|TODO|demo)/i.test(trimmed);
};

const getCfg = (...values: (string | undefined)[]) => {
  return values.find(isUsableCfg);
};

const firebaseConfig = {
  apiKey: getCfg(import.meta.env.VITE_FIREBASE_API_KEY, localConfig.apiKey, defaultFirebaseConfig.apiKey),
  authDomain: getCfg(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, localConfig.authDomain, defaultFirebaseConfig.authDomain),
  projectId: getCfg(import.meta.env.VITE_FIREBASE_PROJECT_ID, localConfig.projectId, defaultFirebaseConfig.projectId),
  storageBucket: getCfg(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, localConfig.storageBucket, defaultFirebaseConfig.storageBucket),
  messagingSenderId: getCfg(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, localConfig.messagingSenderId, defaultFirebaseConfig.messagingSenderId),
  appId: getCfg(import.meta.env.VITE_FIREBASE_APP_ID, localConfig.appId, defaultFirebaseConfig.appId),
  measurementId: getCfg(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID, localConfig.measurementId, defaultFirebaseConfig.measurementId),
};

const databaseId = getCfg(
  import.meta.env.VITE_FIREBASE_DATABASE_ID,
  localConfig.firestoreDatabaseId,
  defaultFirebaseConfig.firestoreDatabaseId
);

// Check if we have the minimum required config
const isConfigValid = !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId && firebaseConfig.apiKey !== 'missing' && firebaseConfig.authDomain);

if (typeof window !== 'undefined') {
  console.log('Final Firebase Config:', {
    ...firebaseConfig,
    apiKey: firebaseConfig.apiKey ? '***' + firebaseConfig.apiKey.slice(-4) : 'missing',
    isConfigValid
  });
}

if (!isConfigValid) {
  console.error('Firebase configuration is missing or incomplete. Fields check:', {
    apiKey: !!firebaseConfig.apiKey,
    projectId: !!firebaseConfig.projectId,
    appId: !!firebaseConfig.appId,
    authDomain: !!firebaseConfig.authDomain
  });
}

// Initialize Firebase only if config is valid to avoid immediate crash
// If invalid, we provide a dummy app to prevent export errors, but it will fail on usage
const app = isConfigValid 
  ? initializeApp(firebaseConfig) 
  : initializeApp({ 
      apiKey: "missing", 
      projectId: "missing", 
      appId: "missing",
      messagingSenderId: "missing" // Added to prevent Messaging crash
    });

export const auth = getAuth(app);
// Using the custom database ID 'lumina-daily' as requested
export const db = getFirestore(app, databaseId || '(default)');
let _messaging: Messaging | null = null;
if (typeof window !== 'undefined' && isConfigValid && !Capacitor.isNativePlatform()) {
  try {
    _messaging = getMessaging(app);
  } catch (e) {
    console.warn('[Messaging] Web SDK 초기화 실패:', e);
  }
}
export const messaging = _messaging;
export const googleProvider = new GoogleAuthProvider();

// Analytics (web only — Capacitor native doesn't use Web SDK analytics)
let _analytics: Analytics | null = null;
if (typeof window !== 'undefined' && isConfigValid && !Capacitor.isNativePlatform()) {
  try {
    _analytics = getAnalytics(app);
  } catch (e) {
    console.warn('[Analytics] 초기화 실패:', e);
  }
}
export const analytics = _analytics;

/** 핵심 사용자 행동을 Firebase Analytics에 기록 */
export const trackEvent = (name: string, params?: Record<string, string | number | boolean>) => {
  if (!_analytics) return;
  try {
    logEvent(_analytics, name, params);
  } catch (e) {
    console.warn('[Analytics] 이벤트 기록 실패:', name, e);
  }
};

export const signInWithGoogle = async () => {
  if (!isConfigValid) {
    const error = '환경 변수가 설정되지 않았습니다. .env 파일을 작성하거나 Firebase 콘솔에서 설정을 확인해 주세요.';
    console.error(error);
    alert(error);
    return Promise.reject(new Error(error));
  }

  // 네이티브 앱(Capacitor)에서는 네이티브 Google 로그인 사용
  if (Capacitor.isNativePlatform()) {
    try {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');

      // Credential Manager 방식 시도 → 실패 시 레거시 방식으로 폴백
      let result;
      try {
        result = await FirebaseAuthentication.signInWithGoogle({ useCredentialManager: true });
      } catch (credentialManagerError: any) {
        const isCancelled = credentialManagerError.message?.includes('cancelled')
          || credentialManagerError.message?.includes('canceled')
          || credentialManagerError.message?.includes('No credentials');
        if (isCancelled) return;

        console.warn('[Auth] Credential Manager 실패, 레거시 방식으로 재시도:', credentialManagerError.message);
        try {
          result = await FirebaseAuthentication.signInWithGoogle({ useCredentialManager: false });
        } catch (legacyError: any) {
          // Error 10 = DEVELOPER_ERROR: SHA-1/SHA-256 지문이 Firebase Console에 미등록
          const isError10 = legacyError.message?.includes('10:')
            || legacyError.message?.includes('DEVELOPER_ERROR');
          if (isError10) {
            const msg = 'Google 로그인 설정 오류 (Error 10)\n\n'
              + 'Firebase Console → 프로젝트 설정 → Android 앱에\n'
              + '아래 지문이 등록되어 있는지 확인해주세요.\n\n'
              + 'SHA-1:   39:64:39:BF:65:1D:ED:F4:CC:4C:B9:82:58:1A:29:52:CC:AF:1D:9F\n'
              + 'SHA-256: 94:69:60:11:A3:72:2A:1D:12:A7:5F:2E:C9:FA:C7:AD:94:F5:53:26:3D:18:81:71:B6:98:6E:0E:57:E8:40:C4';
            console.error('[Auth] SHA 지문 미등록 의심:', msg);
            alert(msg);
            throw legacyError;
          }
          throw legacyError;
        }
      }

      if (result?.credential?.idToken) {
        const credential = GoogleAuthProvider.credential(result.credential.idToken);
        return await signInWithCredential(auth, credential);
      }
      throw new Error('Google 로그인 토큰을 받지 못했습니다.');
    } catch (error: any) {
      if (error.message?.includes('cancelled') || error.message?.includes('canceled')) return;
      // Error 10 오류는 위에서 이미 alert 처리됨
      if (!error.message?.includes('Error 10') && !error.message?.includes('SHA-1')) {
        alert(`로그인 중 오류가 발생했습니다: ${error.message}`);
      }
      throw error;
    }
  }

  // 웹에서는 기존 팝업 방식 사용
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    if (error.code === 'auth/unauthorized-domain') {
      const currentDomain = window.location.hostname;
      const message = `도메인 (${currentDomain})이 Firebase 콘솔에서 승인되지 않았습니다.\n\n` +
        `1. Firebase Console > Authentication > Settings > Authorized domains 로 이동\n` +
        `2. '${currentDomain}'를 리스트에 추가해 주세요.`;
      console.error(message);
      alert(message);
    } else if (error.code === 'auth/popup-closed-by-user') {
      console.warn('사용자가 로그인 팝업을 닫았습니다.');
    } else {
      alert(`로그인 중 오류가 발생했습니다: ${error.message}`);
    }
    throw error;
  }
};
export const logout = () => signOut(auth);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, user?: FirebaseUser | null) {
  const currentUser = user || auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo: currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const requestNotificationPermission = async () => {
  // 네이티브 앱에서는 @capacitor-firebase/messaging 사용
  if (Capacitor.isNativePlatform()) {
    try {
      const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
      const { receive } = await FirebaseMessaging.requestPermissions();
      if (receive === 'granted') {
        const { token } = await FirebaseMessaging.getToken();
        return token || 'granted_but_no_token';
      }
      return null;
    } catch (error) {
      console.error('Native FCM error:', error);
      return 'granted_but_no_token';
    }
  }

  // 웹에서는 기존 FCM Web SDK 사용
  if (!messaging || !('Notification' in window)) {
    console.warn('Notifications not supported in this browser.');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      try {
        const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
        const token = await getToken(messaging, {
          ...(vapidKey ? { vapidKey } : {})
        });
        return token;
      } catch (tokenError) {
        console.error('FCM Token error (Check VAPID key):', tokenError);
        return 'granted_but_no_token';
      }
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
  }
  return null;
};

// 포그라운드 메시지 리스너 (앱이 열려있을 때 FCM 수신)
// 콜백으로 { title, body } 전달, 구독 해제 함수 반환
export const onForegroundMessage = (callback: NextFn<MessagePayload>): (() => void) => {
  // 네이티브(Android)에서는 @capacitor-firebase/messaging 리스너 사용
  if (Capacitor.isNativePlatform()) {
    let unsubscribed = false;
    import('@capacitor-firebase/messaging').then(({ FirebaseMessaging }) => {
      FirebaseMessaging.addListener('notificationReceived', (event) => {
        if (unsubscribed) return;
        // Capacitor 이벤트를 FCM MessagePayload 형태로 변환해 콜백 호출
        callback({
          notification: {
            title: event.notification.title,
            body: event.notification.body,
          },
        } as MessagePayload);
      });
    });
    return () => { unsubscribed = true; };
  }

  // 웹에서는 Firebase Web SDK onMessage 사용
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
};
