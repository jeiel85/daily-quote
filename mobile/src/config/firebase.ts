import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  initializeAuth, 
  // @ts-ignore
  getReactNativePersistence,
  GoogleAuthProvider // 추가: 구글 제공업체
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// Persistence check with version safety
// For React Native, initializeAuth is needed. 
// If getReactNativePersistence is missing from your types, we use ts-ignore but it should exist at runtime in JS SDK v10+.
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider(); // 구글 로그인 제공업체 초기화

export { auth, db, googleProvider };
