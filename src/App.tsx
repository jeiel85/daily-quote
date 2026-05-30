/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  auth,
  db,
  signInWithGoogle,
  logout,
  requestNotificationPermission,
  onForegroundMessage,
  handleFirestoreError,
  OperationType,
  trackEvent
} from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, Timestamp, getDocFromServer } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import './i18n/config';
import { Capacitor } from '@capacitor/core';

import { Quote, UserSettings } from './types';
import { THEMES, THEME_SEED_POOLS, CARD_BACKGROUNDS, CARD_STYLES, LANGUAGES } from './constants';
import { pickTodayQuote, canChangeTimeToday, markTimeChanged, poolSize, maybeRefreshRemoteQuotes } from './utils/quotePool';
import { ErrorBoundary } from './components/ErrorBoundary';
import { QuoteCard } from './components/QuoteCard';
import { HistoryItem } from './components/HistoryItem';
import { HistorySkeleton } from './components/HistorySkeleton';
import { Header } from './components/Header';
import { hapticLight, hapticMedium, setHapticEnabled } from './utils/haptics';

// In-App Review helper
let actionCount = parseInt(localStorage.getItem('actionCount') || '0', 10);
const trackActionForReview = async () => {
  if (!Capacitor.isNativePlatform()) return;
  actionCount += 1;
  localStorage.setItem('actionCount', String(actionCount));
  if (actionCount >= 3) {
    try {
      const { InAppReview } = await import('@capacitor-community/in-app-review');
      await InAppReview.requestReview();
      actionCount = 0;
      localStorage.setItem('actionCount', '0');
    } catch (e) {
      console.warn('[InAppReview] Failed:', e);
    }
  }
};

// Import icons
import { Bell, Clock, History as HistoryIcon, Home, Settings as SettingsIcon, Sparkles, RefreshCw, ExternalLink, Download, Image as ImageIcon, ChevronRight, Globe, Palette, BookOpen, Type, Sun, Moon, Monitor, X } from 'lucide-react';
import { LocalNotifications } from '@capacitor/local-notifications';

export default function App() {
  const { t, i18n } = useTranslation();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'settings'>('home');
  const [currentQuote, setCurrentQuote] = useState<Quote | null>(null);
  const [history, setHistory] = useState<Quote[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [settings, setSettings] = useState<UserSettings>({
    uid: '',
    email: '',
    notificationTime: '08:00',
    preferredThemes: ['motivation'],
    preferredCardStyle: 'classic',
    isSubscribed: false,
    language: 'ko',
    darkMode: 'system',
    fontSize: 'medium',
    hapticEnabled: true,
    role: 'client'
  });
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem('hasSeenOnboarding') !== 'true');
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);
  const [cardProgress, setCardProgress] = useState(0);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempHour, setTempHour] = useState(8);
  const [tempMinute, setTempMinute] = useState(0);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);
  const [isTabletViewport, setIsTabletViewport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inAppNotification, setInAppNotification] = useState<{ title: string; body: string } | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const pendingNotifQuoteId = useRef<string | null>(null);

  // Notification tap listener (early mount, before auth)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const setup = async () => {
      const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
      FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
        const quoteId = (event.notification.data as Record<string, string> | undefined)?.quoteId;
        if (quoteId) pendingNotifQuoteId.current = quoteId;
      });
    };
    setup();
  }, []);

  // Load pending notification quote when user becomes available
  useEffect(() => {
    if (!user || !pendingNotifQuoteId.current) return;
    const quoteId = pendingNotifQuoteId.current;
    pendingNotifQuoteId.current = null;
    getDoc(doc(db, 'users', user.uid, 'history', quoteId)).then((snap) => {
      if (snap.exists()) {
        setCurrentQuote({ id: snap.id, ...snap.data() } as Quote);
        handleTabChange('home');
      }
    }).catch(err => console.error('[Notification] Failed to load quote:', err));
  }, [user]);

  // Device & Orientation Listener
  useEffect(() => {
    const checkDeviceAndOrientation = () => {
      const isTouch = window.matchMedia("(pointer: coarse)").matches;
      setIsMobileOrTablet(isTouch);
      setIsLandscape(window.innerWidth > window.innerHeight);
      setIsTabletViewport(window.innerWidth >= 768 && window.innerWidth <= 1024);
    };
    checkDeviceAndOrientation();
    window.addEventListener('resize', checkDeviceAndOrientation);
    return () => window.removeEventListener('resize', checkDeviceAndOrientation);
  }, []);

  const useSidebar = isMobileOrTablet && isLandscape || isTabletViewport;

  // Auth & Data Listener with optimized subscriptions
  useEffect(() => {
    let unsubscribeSettings: (() => void) | null = null;
    let unsubscribeHistory: (() => void) | null = null;
    let isSubscribed = true; // Flag to prevent state updates after unmount

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!isSubscribed) return;
      setUser(firebaseUser);
      if (firebaseUser) trackEvent('login', { method: 'google' });

      if (firebaseUser) {
        // 1. Settings Listener
        const settingsRef = doc(db, 'users', firebaseUser.uid);
        unsubscribeSettings = onSnapshot(settingsRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as UserSettings;
            const mergedSettings: UserSettings = {
              uid: data.uid || firebaseUser.uid,
              email: data.email || firebaseUser.email || '',
              notificationTime: data.notificationTime || '08:00',
              preferredThemes: data.preferredThemes || ['motivation'],
              preferredCardStyle: data.preferredCardStyle || 'classic',
              language: data.language || i18n.language || 'ko',
              darkMode: data.darkMode || 'system',
              fontSize: data.fontSize || 'medium',
              hapticEnabled: data.hapticEnabled ?? true,
              isSubscribed: data.isSubscribed || false,
              role: data.role || 'client',
              updatedAt: data.updatedAt,
              fcmToken: data.fcmToken
            };
            setSettings(mergedSettings);
            if (mergedSettings.language && mergedSettings.language !== i18n.language) {
              i18n.changeLanguage(mergedSettings.language);
            }
          } else {
            // Generate referral code for new user
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            const referralCode = 'REF-' + Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
            
            const initialSettings = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              notificationTime: '08:00',
              preferredThemes: ['motivation'],
              preferredCardStyle: 'classic',
              language: i18n.language || 'ko',
              darkMode: 'system',
              isSubscribed: false,
              updatedAt: serverTimestamp(),
              role: 'client',
              referralCode: referralCode,
              referralCount: 0,
              rewards: []
            };
            setDoc(settingsRef, initialSettings).catch(err => 
              handleFirestoreError(err, OperationType.CREATE, `users/${firebaseUser.uid}`, firebaseUser)
            );
          }
        }, (err) => {
          // 스냅샷 에러 콜백에서 throw 하면 unhandled rejection 이 되므로 swallow
          try { handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`, firebaseUser); } catch { /* logged */ }
        });

        // 2. History Listener
        const historyRef = collection(db, 'users', firebaseUser.uid, 'history');
        const q = query(historyRef, orderBy('createdAt', 'desc'), limit(20));
        unsubscribeHistory = onSnapshot(q, (snapshot) => {
          const quotes = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Quote[];
          setHistory(quotes);
          setIsHistoryLoading(false);
          if (quotes.length > 0 && !currentQuote) {
            setCurrentQuote(quotes[0]);
          }
        }, (err) => {
          // 에러 시에도 스켈레톤이 영구히 멈추지 않도록 로딩 상태 해제 후 기록
          setIsHistoryLoading(false);
          try { handleFirestoreError(err, OperationType.LIST, `users/${firebaseUser.uid}/history`, firebaseUser); } catch { /* logged */ }
        });

        // 3. Connection Test
        getDocFromServer(doc(db, 'test', 'connection')).catch(error => {
          if (error instanceof Error && error.message.includes('the client is offline')) {
            console.error("Please check your Firebase configuration.");
          }
        });
      } else {
        setHistory([]);
        setIsHistoryLoading(false);
        setCurrentQuote(null);
        setSettings(prev => ({ ...prev, uid: '', email: '' }));
        if (unsubscribeSettings) unsubscribeSettings();
        if (unsubscribeHistory) unsubscribeHistory();
      }
      setLoading(false);
    });

    return () => {
      isSubscribed = false;
      unsubscribeAuth();
      if (unsubscribeSettings) unsubscribeSettings();
      if (unsubscribeHistory) unsubscribeHistory();
    };
  }, []);

  // Sync HTML lang attribute with i18n
  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  // Sync Dark Mode class
  useEffect(() => {
    const applyTheme = () => {
      const html = document.documentElement;
      let isDark = false;
      let isMaterial = false;

      if (settings.darkMode === 'dark') {
        isDark = true;
      } else if (settings.darkMode === 'system') {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      } else if (settings.darkMode === 'material') {
        isMaterial = true;
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      
      if (isDark) {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }

      if (isMaterial) {
        html.classList.add('theme-material');
      } else {
        html.classList.remove('theme-material');
      }
    };

    applyTheme();

    if (settings.darkMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [settings.darkMode]);

  // Sync Font Size
  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('text-sm', 'text-base', 'text-lg');
    
    const fontSizeClass = settings.fontSize === 'small' ? 'text-sm' : 
                         settings.fontSize === 'large' ? 'text-lg' : 'text-base';
    html.classList.add(fontSizeClass);
    html.style.fontSize = settings.fontSize === 'small' ? '14px' : 
                         settings.fontSize === 'large' ? '18px' : '16px';
  }, [settings.fontSize]);

  // 햅틱 설정 → localStorage 동기화 (utils/haptics 가 즉시 읽음)
  useEffect(() => {
    setHapticEnabled(settings.hapticEnabled !== false);
  }, [settings.hapticEnabled]);

  // Tab change with haptic feedback
  const handleTabChange = (tab: 'home' | 'history' | 'settings') => {
    hapticLight();
    setActiveTab(tab);
  };

  // Quote Navigation via swipe
  const navigateQuote = (direction: 'prev' | 'next') => {
    if (!currentQuote || history.length === 0) return;
    const currentIndex = history.findIndex(q => q.id === currentQuote.id);
    if (currentIndex === -1) return;

    if (direction === 'prev' && currentIndex > 0) {
      setCurrentQuote(history[currentIndex - 1]);
      hapticLight();
    } else if (direction === 'next' && currentIndex < history.length - 1) {
      setCurrentQuote(history[currentIndex + 1]);
      hapticLight();
    }
  };

  const currentQuoteIndex = currentQuote ? history.findIndex(q => q.id === currentQuote.id) : -1;
  const canSwipeLeft = currentQuoteIndex >= 0 && currentQuoteIndex < history.length - 1;
  const canSwipeRight = currentQuoteIndex > 0;

  // Text-to-Speech
  const speakQuote = (quote: Quote) => {
    if (!window.speechSynthesis) return;
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const text = `${quote.text}. ${quote.author}. ${t('home.explanation')}: ${quote.explanation}`;
    const utterance = new SpeechSynthesisUtterance(text);

    const langMap: Record<string, string> = {
      ko: 'ko-KR',
      en: 'en-US',
      ja: 'ja-JP',
      zh: 'zh-CN',
    };
    utterance.lang = langMap[i18n.language] || 'en-US';
    utterance.rate = 0.9;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // 세션당 1회 자동 배달 — 풀에서 오늘의 명언을 꺼내 화면에 띄운다.
  // 같은 날 두 번 부르면 캐시된 명언이 그대로 나오므로 안전하다.
  const autoPickedRef = useRef(false);
  useEffect(() => {
    if (!user || !settings.uid) return;
    if (autoPickedRef.current) return;
    autoPickedRef.current = true;
    deliverDailyQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, settings.uid]);

  // 원격 풀 갱신 — 앱 마운트 시 1회 시도 (24시간 캐시, fire-and-forget)
  // 실패해도 번들/기존 캐시로 동작하므로 사용자 영향 없음
  useEffect(() => {
    maybeRefreshRemoteQuotes().then((r) => {
      if (r.status === 'updated') console.log(`[quotePool] remote updated to v${r.version}`);
    });
  }, []);

  // 오늘의 명언 배달 — 로컬 풀에서 1일 1회 선택, 사용자별 중복방지.
  // 정책 상세는 src/utils/quotePool.ts 참고.
  const deliverDailyQuote = async () => {
    if (!user) return;

    setIsGenerating(true);
    try {
      const lang = i18n.language || settings.language || 'ko';
      const result = pickTodayQuote({
        preferredThemes: settings.preferredThemes || ['motivation'],
        language: lang,
      });

      if (!result) {
        setError(t('common.error_pool_empty'));
        setIsGenerating(false);
        return;
      }

      const { quote, isFresh } = result;
      setCurrentQuote(quote);
      setIsGenerating(false);

      if (isFresh) {
        // Firestore history 저장 (기기 간 동기화 + 과거 명언 조회용)
        try {
          const docRef = await addDoc(collection(db, `users/${user.uid}/history`), {
            text: quote.text,
            author: quote.author,
            explanation: quote.explanation,
            theme: quote.theme,
            uid: user.uid,
            createdAt: serverTimestamp(),
            source: 'daily',
            poolQuoteId: quote.id,
          });
          setCurrentQuote((prev) => (prev ? { ...prev, id: docRef.id } : prev));
        } catch (e) {
          console.warn('[Firestore] history save failed:', e);
        }
        trackEvent('quote_delivered', { theme: quote.theme, language: lang, pool_size: poolSize() });
        hapticMedium();
        trackActionForReview();
      }
    } catch (err) {
      console.error('Error delivering quote:', err);
      setError(t('common.error_loading_quote'));
      setIsGenerating(false);
    }
  };

  // Sync notification permission
  useEffect(() => {
    const syncPermission = async () => {
      if (user && 'Notification' in window && Notification.permission === 'granted' && !settings.isSubscribed) {
        const token = await requestNotificationPermission();
        if (token) {
          const fcmToken = token === 'granted_but_no_token' ? '' : token;
          setSettings(prev => ({ ...prev, isSubscribed: true, fcmToken }));
          await setDoc(doc(db, 'users', user.uid), { isSubscribed: true, fcmToken, updatedAt: serverTimestamp() }, { merge: true });
        }
      }
    };
    syncPermission();
  }, [user, settings.isSubscribed]);

  // Foreground messages
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onForegroundMessage((payload) => {
      const title = payload.notification?.title ?? t('settings.section_notification');
      const body = payload.notification?.body ?? '';
      setInAppNotification({ title, body });
      setTimeout(() => setInAppNotification(null), 5000);
    });
    return unsubscribe;
  }, [user]);

  // 매일 지정 시각 로컬 알림 스케줄 (네이티브 전용).
  // 반드시 존재하는 리소스만 참조한다 — 과거 잘못된 smallIcon('ic_stat_icon_config_sample')
  // 과 sound('beep.wav') 가 schedule 을 통째로 throw 시켜 알림이 아예 안 떴다.
  const scheduleDailyNotification = async (time: string) => {
    if (!Capacitor.isNativePlatform()) return;
    const [hour, minute] = time.split(':').map(Number);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return;
    try {
      await LocalNotifications.requestPermissions();
      await LocalNotifications.cancel({ notifications: [{ id: 1 }] });
      await LocalNotifications.schedule({
        notifications: [
          {
            title: t('home.subscribe_title'),
            body: t('home.subscribe_desc'),
            id: 1,
            schedule: { on: { hour, minute }, allowWhileIdle: true },
            smallIcon: 'ic_stat_notification',
          }
        ]
      });
    } catch (e) {
      console.warn('[LocalNotif] Schedule failed:', e);
    }
  };

  // 구독자 앱 시작 시 로컬 알림 재스케줄 — 과거 버전(잘못된 아이콘)에서
  // schedule 이 실패해 알림이 안 오던 사용자를 자동 복구한다. 1회만.
  const reschedRef = useRef(false);
  useEffect(() => {
    if (reschedRef.current) return;
    if (!Capacitor.isNativePlatform()) return;
    if (!settings.isSubscribed) return;
    reschedRef.current = true;
    scheduleDailyNotification(settings.notificationTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.isSubscribed, settings.notificationTime]);

  const handleSubscribe = async () => {
    if (!user) return;
    const token = await requestNotificationPermission();
    if (token) {
      const fcmToken = token === 'granted_but_no_token' ? '' : token;
      setSettings(prev => ({ ...prev, isSubscribed: true, fcmToken }));
      trackEvent('notification_subscribe');
      // saveSettings 로 통일: isSubscribed 저장 + notificationTime 으로 LocalNotifications 스케줄
      // (서버 cron 제거 후 알림은 100% LocalNotifications 의존이라 구독 시점에 반드시 스케줄 해둬야 함)
      await saveSettings({
        isSubscribed: true,
        fcmToken,
        notificationTime: settings.notificationTime,
      });
    } else if (Notification.permission === 'denied') {
      setError(t('settings.status_desc'));
    }
  };

  const saveSettings = async (updates: Partial<UserSettings>) => {
    if (!user) return;

    if (updates.notificationTime) {
      const [h, m] = updates.notificationTime.split(':').map(Number);
      const local = new Date();
      local.setHours(h, m, 0, 0);
      updates.notificationTimeUTC = `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;

      // Schedule local notification (native only)
      await scheduleDailyNotification(updates.notificationTime);
    }

    setSettings(prev => ({ ...prev, ...updates }));

    if (updates.language) {
      i18n.changeLanguage(updates.language);
      trackEvent('language_change', { language: updates.language });
      hapticLight();
    }

    try {
      await setDoc(doc(db, 'users', user.uid), { ...updates, updatedAt: serverTimestamp() }, { merge: true });
      hapticLight();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`, user);
    }
  };

  const handleShare = async (quote: Quote) => {
    try {
      const shareData: ShareData = {
        title: t('home.title'),
        text: `"${quote.text}" — ${quote.author}`,
        url: window.location.href,
      };

      if (quote.imageUrl && navigator.canShare) {
        const response = await fetch(quote.imageUrl);
        const blob = await response.blob();
        const file = new File([blob], 'quote.jpg', { type: 'image/jpeg' });
        if (navigator.canShare({ files: [file] })) {
          shareData.files = [file];
        }
      }

      await navigator.share(shareData);
      trackEvent('share_quote', { has_image: !!quote.imageUrl });
      hapticLight();
      trackActionForReview();
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(t('share.error'));
      }
    }
  };

  const generateQuoteCard = async (quote: Quote) => {
    if (!user) return;
    setIsGeneratingCard(true);
    setCardProgress(10);
    setError(null);

    // 카드 생성은 picsum + canvas 로 클라이언트에서 처리 (Gemini 불필요)
    try {
      const seedPool = THEME_SEED_POOLS[quote.theme] ?? THEME_SEED_POOLS.life;
      const seed = seedPool[Math.floor(Math.random() * seedPool.length)];

      let base64Image = "";
      try {
        const imgResponse = await fetch(`https://picsum.photos/seed/${seed}/1024/1024`);
        if (imgResponse.ok) {
          const blob = await imgResponse.blob();
          base64Image = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).replace(/^data:[^;]+;base64,/, ''));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      } catch (imgErr) {
        console.warn('[Card] Picsum fetch failed, using gradient fallback');
      }

      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      if (base64Image) {
        const bgImg = new Image();
        bgImg.src = `data:image/png;base64,${base64Image}`;
        await new Promise((resolve, reject) => { bgImg.onload = resolve; bgImg.onerror = reject; });
        ctx.drawImage(bgImg, 0, 0, 1024, 1024);
      } else {
        const bg = CARD_BACKGROUNDS[Math.floor(Math.random() * CARD_BACKGROUNDS.length)];
        const gradient = ctx.createLinearGradient(0, 0, 1024, 1024);
        gradient.addColorStop(0, bg.colors[0]);
        gradient.addColorStop(1, bg.colors[1]);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1024, 1024);
      }

      const style = settings.preferredCardStyle || 'classic';
      
      // Style-specific background overlays
      if (style === 'modern') {
        const gradient = ctx.createLinearGradient(0, 0, 0, 1024);
        gradient.addColorStop(0, 'rgba(0,0,0,0.2)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.7)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1024, 1024);
      } else if (style === 'classic') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, 1024, 1024);
      } else if (style === 'elegant') {
        // Elegant: subtle gold-tinted overlay
        const gradient = ctx.createLinearGradient(0, 0, 1024, 1024);
        gradient.addColorStop(0, 'rgba(139, 119, 101, 0.3)');
        gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.2)');
        gradient.addColorStop(1, 'rgba(139, 119, 101, 0.4)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1024, 1024);
        // Add decorative border
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.6)';
        ctx.lineWidth = 8;
        ctx.strokeRect(40, 40, 944, 944);
      } else if (style === 'nature') {
        // Nature: green-tinted overlay
        const gradient = ctx.createLinearGradient(0, 0, 0, 1024);
        gradient.addColorStop(0, 'rgba(76, 175, 80, 0.25)');
        gradient.addColorStop(1, 'rgba(27, 94, 32, 0.5)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1024, 1024);
      } else if (style === 'dark') {
        // Dark: heavy dark overlay
        const gradient = ctx.createLinearGradient(0, 0, 1024, 1024);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
        gradient.addColorStop(1, 'rgba(20, 20, 30, 0.85)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1024, 1024);
      } else {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, 1024, 1024);
      }
      setCardProgress(50);

      // Style-specific text styling
      const isDarkStyle = style === 'dark';
      ctx.fillStyle = isDarkStyle ? '#e0e0e0' : 'white';
      
      const alignLeft = style === 'modern' || style === 'nature';
      ctx.textAlign = alignLeft ? 'left' : 'center';
      ctx.textBaseline = 'middle';
      
      const fontSize = style === 'bold' ? 64 : style === 'elegant' ? 52 : 48;
      const fontName = style === 'classic' || style === 'elegant' ? 'Georgia, serif' : '"Inter", sans-serif';
      const fontWeight = style === 'bold' ? '800' : style === 'elegant' ? '400' : '600';
      const fontStyle = style === 'classic' || style === 'elegant' ? 'italic' : 'normal';
      ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontName}`;

      const maxWidth = alignLeft ? 700 : 800;
      const startX = alignLeft ? 100 : 512;
      const words = quote.text.split(' ');
      let line = '';
      const lines = [];
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        if (ctx.measureText(testLine).width > maxWidth && n > 0) {
          lines.push(line);
          line = words[n] + ' ';
        } else {
          line = testLine;
        }
      }
      lines.push(line);

      const totalHeight = lines.length * (fontSize + 20);
      let startY = (1024 - totalHeight) / 2;
      lines.forEach(l => {
        ctx.fillText(l.trim(), startX, startY);
        startY += fontSize + 20;
      });

      ctx.font = `${style === 'bold' ? '700' : '600'} 32px ${fontName}`;
      ctx.fillText(`— ${quote.author}`, startX, startY + 40);

      const finalImageUrl = canvas.toDataURL('image/jpeg', 0.8);
      setCardProgress(80);

      if (quote.id && !quote.id.startsWith('temp-')) {
        setDoc(doc(db, 'users', user.uid, 'history', quote.id), { imageUrl: finalImageUrl }, { merge: true })
          .then(() => setCurrentQuote(prev => prev?.id === quote.id ? { ...prev, imageUrl: finalImageUrl } : prev))
          .catch(err => console.error('[Firestore] Image save failed:', err));
      }

      setIsGeneratingCard(false);
      trackEvent('generate_card', { card_style: settings.preferredCardStyle });
      hapticMedium();

      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        const base64Data = finalImageUrl.replace(/^data:image\/jpeg;base64,/, '');
        const fileName = `quote-${quote.id || 'new'}.jpg`;
        await Filesystem.writeFile({ path: fileName, data: base64Data, directory: Directory.Cache });
        const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
        try { await Share.share({ title: t('home.title'), url: uri, dialogTitle: t('home.title') }); } catch {}
      } else {
        const link = document.createElement('a');
        link.download = `quote-${quote.id || 'new'}.jpg`;
        link.href = finalImageUrl;
        link.click();
      }
    } catch (err) {
      console.error('Error generating quote card:', err);
      setError(t('common.error'));
      setIsGeneratingCard(false);
    }
  };

  // Tab Navigation
  const TabIcon = activeTab === 'home' ? Home : activeTab === 'history' ? HistoryIcon : SettingsIcon;
  const tabs = [
    { id: 'home', icon: Home, label: t('nav.home') },
    { id: 'history', icon: HistoryIcon, label: t('nav.history') },
    { id: 'settings', icon: SettingsIcon, label: t('nav.settings') },
  ] as const;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-indigo-950">
        <motion.div
          initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
          className="w-24 h-24 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-indigo-200 dark:shadow-indigo-900/30"
        >
          <Sparkles className="w-12 h-12 text-white" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6, ease: 'easeOut' }}
          className="text-3xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-300 dark:to-fuchsia-300 bg-clip-text text-transparent mb-2"
        >
          Lumina Daily
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="max-w-sm text-sm text-neutral-500 dark:text-neutral-400 mb-8"
        >
          {t('auth.desc')}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.65, duration: 0.4 }}
          className="flex items-center gap-2"
        >
          <div className="w-1.5 h-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    const ONBOARDING_THEME_PREVIEWS = ['motivation', 'philosophy', 'comfort', 'success', 'humor', 'wisdom'];
    const ONBOARDING_STEPS = [
      { emoji: '✨', titleKey: 'onboarding.step1_title', descKey: 'onboarding.step1_desc' },
      { emoji: '🎨', titleKey: 'onboarding.step2_title', descKey: 'onboarding.step2_desc' },
      { emoji: '🚀', titleKey: 'onboarding.step3_title', descKey: 'onboarding.step3_desc' },
    ];

    const completeOnboarding = () => {
      localStorage.setItem('hasSeenOnboarding', 'true');
      setShowOnboarding(false);
      trackEvent('onboarding_complete', { steps_seen: onboardingStep + 1 });
    };

    if (showOnboarding) {
      const step = ONBOARDING_STEPS[onboardingStep];
      const isLast = onboardingStep === ONBOARDING_STEPS.length - 1;
      
      const handleSkip = () => {
        hapticLight();
        trackEvent('onboarding_skip', { step: onboardingStep });
        completeOnboarding();
      };
      
      const handleLater = () => {
        hapticLight();
        trackEvent('onboarding_later', { step: onboardingStep });
        // Don't mark as completed, just hide for this session
        setShowOnboarding(false);
      };
      
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-indigo-950 p-6">
          <div className="w-full flex justify-between items-center mb-6">
            <button
              onClick={() => { hapticLight(); trackEvent('onboarding_has_account', { step: onboardingStep }); completeOnboarding(); signInWithGoogle(); }}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              {t('onboarding.has_account')}
            </button>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleLater}
                className="text-sm text-neutral-500 hover:text-neutral-700 px-3 py-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
                title={t('onboarding.later_tooltip')}
              >
                {t('onboarding.later')}
              </button>
              <div className="w-px h-4 bg-neutral-300" />
              <button 
                onClick={handleSkip}
                className="text-sm font-medium text-neutral-400 hover:text-neutral-600 px-3 py-1.5 rounded-lg hover:bg-neutral-100 transition-colors flex items-center gap-1"
              >
                <span>{t('onboarding.skip')}</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={onboardingStep}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="w-full flex flex-col items-center text-center"
            >
              <div className="text-7xl mb-8">{step.emoji}</div>
              <h2 className="text-2xl font-extrabold text-neutral-900 dark:text-neutral-100 mb-4">{t(step.titleKey)}</h2>
              <p className="text-neutral-500 dark:text-neutral-400 mb-8">{t(step.descKey)}</p>
              {onboardingStep === 1 && (
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                  {ONBOARDING_THEME_PREVIEWS.map(id => (
                    <span key={id} className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-sm">{t(`themes.${id}`)}</span>
                  ))}
                </div>
              )}
              {isLast && (
                <button onClick={() => { hapticMedium(); completeOnboarding(); signInWithGoogle(); }} className="w-full py-4 px-6 bg-indigo-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-3">
                  <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="w-5 h-5 bg-white rounded-full" alt="Google" />
                  {t('auth.google_login')}
                </button>
              )}
            </motion.div>
          </AnimatePresence>
          <div className="flex gap-2 mt-6">
            {ONBOARDING_STEPS.map((_, i) => (
              <div key={i} className={`h-2 rounded-full ${i === onboardingStep ? 'w-6 bg-indigo-600' : 'w-2 bg-neutral-200 dark:bg-neutral-700'}`} />
            ))}
          </div>
          {!isLast && (
            <button onClick={() => { hapticLight(); setOnboardingStep(s => s + 1); }} className="mt-8 w-full py-4 px-6 bg-indigo-600 text-white rounded-2xl font-semibold">
              {t('onboarding.next')}
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-50 dark:bg-neutral-950 p-6 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-3xl shadow-xl p-8">
          <div className="w-24 h-24 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">{t('auth.welcome')}</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mb-10">{t('auth.desc')}</p>
          <button onClick={() => { hapticMedium(); signInWithGoogle(); }} className="w-full py-4 px-6 bg-indigo-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-3">
            <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="w-5 h-5 bg-white rounded-full" alt="Google" />
            {t('auth.google_login')}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary t={t}>
      <div className={`min-h-screen bg-neutral-50 dark:bg-neutral-950 transition-colors ${useSidebar ? 'flex flex-row-reverse' : 'flex flex-col'}`}>
        <Header isLoggedIn onLogout={logout} />

        <main className={`flex-1 p-6 ${useSidebar ? 'mr-20' : 'pb-24'}`}>
          <div className={`mx-auto ${useSidebar ? 'max-w-6xl' : 'max-w-md'}`}>
            <AnimatePresence mode="wait">
              {activeTab === 'home' && (
                <motion.div key="home" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className={`space-y-6 ${useSidebar ? 'grid grid-cols-1 md:grid-cols-2 gap-8' : ''}`}>
                  <QuoteCard
                    key={currentQuote?.id}
                    quote={currentQuote}
                    isLoading={isGenerating}
                    isGeneratingCard={isGeneratingCard}
                    cardProgress={cardProgress}
                    onGenerateCard={() => currentQuote && generateQuoteCard(currentQuote)}
                    onShare={() => currentQuote && handleShare(currentQuote)}
                    onSpeak={() => currentQuote && speakQuote(currentQuote)}
                    isSpeaking={isSpeaking}
                    onSwipeLeft={() => navigateQuote('next')}
                    onSwipeRight={() => navigateQuote('prev')}
                    canSwipeLeft={canSwipeLeft}
                    canSwipeRight={canSwipeRight}
                    fontSize={settings.fontSize}
                    t={t}
                  />
                  <div className="space-y-6">
                    {!settings.isSubscribed && (
                      <div className="bg-indigo-600 rounded-2xl p-6 text-white flex items-center justify-between">
                        <div>
                          <h4 className="font-bold">{t('home.subscribe_title')}</h4>
                          <p className="text-xs text-indigo-100">{t('home.subscribe_desc')}</p>
                        </div>
                        <button onClick={handleSubscribe} className="bg-white text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold">{t('home.activate')}</button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'history' && (
                <motion.div key="history" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                  <h2 className="text-2xl font-bold">{t('history.title')}</h2>
                  {isHistoryLoading ? (
                    <HistorySkeleton />
                  ) : history.length === 0 ? (
                    <div className="text-center py-16 space-y-6">
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mx-auto"
                      >
                        <BookOpen className="w-12 h-12 text-indigo-300 dark:text-indigo-700" />
                      </motion.div>
                      <div className="space-y-2">
                        <p className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">{t('history.empty_title')}</p>
                        <p className="text-sm text-neutral-400 dark:text-neutral-500">{t('history.empty_desc')}</p>
                      </div>
                    </div>
                  ) : (
                    history.map((quote) => (
                      <HistoryItem
                        key={quote.id}
                        quote={quote}
                        onSelect={() => { setCurrentQuote(quote); handleTabChange('home'); }}
                        onDownload={() => {}}
                        onShare={() => handleShare(quote)}
                        onRegenerate={() => generateQuoteCard(quote)}
                        t={t}
                      />
                    ))
                  )}
                </motion.div>
              )}

              {activeTab === 'settings' && (
                <motion.div key="settings" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-8">
                  <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{t('settings.title')}</h2>

                  {/* ─── 그룹 1: 알림 ─── */}
                  <section className="space-y-3">
                    <h3 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">{t('settings.section_notification')}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {/* 구독 상태 카드 */}
                      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-100 dark:border-neutral-800 p-4 flex flex-col gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${settings.isSubscribed ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                          <Bell className={`w-5 h-5 ${settings.isSubscribed ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`} />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-neutral-800 dark:text-neutral-200 text-sm leading-tight">{settings.isSubscribed ? t('settings.enabled') : t('settings.disabled')}</p>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 leading-snug">{settings.isSubscribed ? t('settings.enabled_desc') : t('settings.disabled_desc')}</p>
                        </div>
                        {!settings.isSubscribed && (
                          <button
                            onClick={handleSubscribe}
                            className="w-full py-2.5 bg-indigo-600 text-white rounded-2xl text-xs font-bold"
                          >
                            {t('settings.turn_on')}
                          </button>
                        )}
                      </div>
                      {/* 알림 시간 카드 */}
                      <button
                        onClick={() => {
                          const [h, m] = settings.notificationTime.split(':').map(Number);
                          setTempHour(h);
                          setTempMinute(m);
                          setShowTimePicker(true);
                        }}
                        className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-100 dark:border-neutral-800 p-4 flex flex-col gap-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center">
                          <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-neutral-800 dark:text-neutral-200 text-sm leading-tight">{t('settings.notification_time')}</p>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 leading-snug">{t('settings.notification_desc')}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums">{settings.notificationTime}</span>
                          <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-600" />
                        </div>
                      </button>
                    </div>
                  </section>

                  {/* Time Picker Modal */}
                  {showTimePicker && (
                    <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowTimePicker(false)}>
                      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                      <div
                        className="relative w-full bg-white dark:bg-neutral-900 rounded-t-3xl px-6 pt-6 pb-10 space-y-6"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="w-10 h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full mx-auto" />
                        <div className="flex items-center justify-between">
                          <button onClick={() => setShowTimePicker(false)} className="text-sm text-neutral-400 dark:text-neutral-500 font-semibold px-2 py-1">{t('common.cancel')}</button>
                          <h3 className="text-base font-extrabold text-neutral-900 dark:text-neutral-100">{t('settings.notification_time')}</h3>
                          <button
                            onClick={() => {
                              const time = `${String(tempHour).padStart(2, '0')}:${String(tempMinute).padStart(2, '0')}`;
                              // 시간 변경은 하루 1회만 — 이미 오늘 바꿨으면 안내
                              if (time !== settings.notificationTime && !canChangeTimeToday()) {
                                setInAppNotification({
                                  title: t('settings.notification_time'),
                                  body: t('settings.time_change_limit'),
                                });
                                setTimeout(() => setInAppNotification(null), 4000);
                                setShowTimePicker(false);
                                return;
                              }
                              if (time !== settings.notificationTime) markTimeChanged();
                              saveSettings({ notificationTime: time });
                              setShowTimePicker(false);
                            }}
                            className="text-sm text-indigo-600 dark:text-indigo-400 font-bold px-2 py-1"
                          >{t('common.done')}</button>
                        </div>
                        <div className="flex items-center justify-center gap-3 py-2">
                          <div className="flex flex-col items-center gap-3">
                            <button onClick={() => setTempHour(h => (h + 1) % 24)} className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-2xl font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">▲</button>
                            <span className="text-6xl font-black text-neutral-900 dark:text-neutral-100 w-28 text-center tabular-nums">{String(tempHour).padStart(2, '0')}</span>
                            <button onClick={() => setTempHour(h => (h - 1 + 24) % 24)} className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-2xl font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">▼</button>
                            <p className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">{t('common.hour')}</p>
                          </div>
                          <span className="text-5xl font-black text-neutral-300 dark:text-neutral-600 mb-6">:</span>
                          <div className="flex flex-col items-center gap-3">
                            <button onClick={() => setTempMinute(m => (m + 5) % 60)} className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-2xl font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">▲</button>
                            <span className="text-6xl font-black text-neutral-900 dark:text-neutral-100 w-28 text-center tabular-nums">{String(tempMinute).padStart(2, '0')}</span>
                            <button onClick={() => setTempMinute(m => (m - 5 + 60) % 60)} className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-2xl font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">▼</button>
                            <p className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">{t('common.minute')}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {['07:00', '08:00', '09:00', '12:00', '18:00', '20:00', '21:00', '22:00'].map(t2 => (
                            <button
                              key={t2}
                              onClick={() => { const [h, m] = t2.split(':').map(Number); setTempHour(h); setTempMinute(m); }}
                              className={`py-2 rounded-xl text-sm font-bold transition-colors ${tempHour === parseInt(t2) && tempMinute === 0 ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'}`}
                            >{t2}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─── 그룹 2: 테마 ─── */}
                  <section className="space-y-3">
                    <h3 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">{t('settings.section_theme')}</h3>

                    {/* 통합 테마 선택 (다중 선택) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">{t('preferredThemes.title')}</p>
                        <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">{t('preferredThemes.multi_hint')}</span>
                      </div>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 px-1">{t('preferredThemes.description')}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {THEMES.map((theme) => {
                          const isSelected = (settings.preferredThemes || []).includes(theme.id);
                          return (
                            <button
                              key={theme.id}
                              onClick={() => {
                                const current = settings.preferredThemes || ['motivation'];
                                const next = isSelected
                                  ? current.filter(id => id !== theme.id)
                                  : [...current, theme.id];
                                if (next.length > 0) saveSettings({ preferredThemes: next });
                              }}
                              className={`py-3 px-2 rounded-2xl border transition-all flex flex-col items-center gap-1.5 ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                  : 'bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:border-indigo-200'
                              }`}
                            >
                              <span className="text-xl">{theme.icon}</span>
                              <span className="font-bold text-[10px]">{t(theme.labelKey)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                  </section>

                  {/* ─── 그룹 3: 외관 ─── */}
                  <section className="space-y-3">
                    <h3 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">{t('settings.section_appearance')}</h3>
                    {/* 비주얼 테마 */}
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-300 px-1">{t('settings.visual_theme')}</p>
                      <div className="bg-white dark:bg-neutral-900 p-2 rounded-3xl border border-neutral-100 dark:border-neutral-800 grid grid-cols-4 gap-1">
                        <button onClick={() => saveSettings({ darkMode: 'light' })} className={`flex flex-col items-center gap-2 py-4 rounded-2xl transition-all ${settings.darkMode === 'light' ? 'bg-indigo-600 text-white shadow-lg' : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}>
                          <Sun className="w-5 h-5" />
                          <span className="text-[10px] font-bold leading-tight text-center px-1">{t('settings.light_mode')}</span>
                        </button>
                        <button onClick={() => saveSettings({ darkMode: 'dark' })} className={`flex flex-col items-center gap-2 py-4 rounded-2xl transition-all ${settings.darkMode === 'dark' ? 'bg-indigo-600 text-white shadow-lg' : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}>
                          <Moon className="w-5 h-5" />
                          <span className="text-[10px] font-bold leading-tight text-center px-1">{t('settings.dark_mode')}</span>
                        </button>
                        <button onClick={() => saveSettings({ darkMode: 'system' })} className={`flex flex-col items-center gap-2 py-4 rounded-2xl transition-all ${settings.darkMode === 'system' ? 'bg-indigo-600 text-white shadow-lg' : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}>
                          <Monitor className="w-5 h-5" />
                          <span className="text-[10px] font-bold leading-tight text-center px-1">{t('settings.system_mode')}</span>
                        </button>
                        <button onClick={() => saveSettings({ darkMode: 'material' })} className={`flex flex-col items-center gap-2 py-4 rounded-2xl transition-all ${settings.darkMode === 'material' ? 'bg-indigo-600 text-white shadow-lg' : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}>
                          <Palette className="w-5 h-5" />
                          <span className="text-[10px] font-bold leading-tight text-center px-1">{t('settings.material_mode')}</span>
                        </button>
                      </div>
                    </div>
                    {/* 카드 스타일 */}
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-300 px-1">{t('cardStyles.title')}</p>
                      <div className="bg-white dark:bg-neutral-900 p-2 rounded-3xl border border-neutral-100 dark:border-neutral-800 grid grid-cols-4 gap-1">
                        {CARD_STYLES.map((style) => (
                          <button
                            key={style.id}
                            onClick={() => saveSettings({ preferredCardStyle: style.id })}
                            className={`py-3 px-1 rounded-2xl transition-all text-[10px] font-bold leading-tight text-center ${settings.preferredCardStyle === style.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}
                          >
                            {t(style.labelKey)}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* 글자 크기 */}
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-300 px-1">{t('settings.font_size')}</p>
                      <div className="bg-white dark:bg-neutral-900 p-2 rounded-3xl border border-neutral-100 dark:border-neutral-800 grid grid-cols-3 gap-1">
                        {(['small', 'medium', 'large'] as const).map(size => (
                          <button
                            key={size}
                            onClick={() => saveSettings({ fontSize: size })}
                            className={`py-3 rounded-2xl flex flex-col items-center gap-1 transition-all ${settings.fontSize === size ? 'bg-indigo-600 text-white shadow-lg' : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}
                          >
                            <Type className={`${size === 'small' ? 'w-3.5 h-3.5' : size === 'large' ? 'w-6 h-6' : 'w-5 h-5'}`} />
                            <span className="text-[10px] font-bold">{t(`fontSizes.${size}`)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* 햅틱 피드백 ON/OFF */}
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-300 px-1">{t('settings.haptic')}</p>
                      <div className="bg-white dark:bg-neutral-900 p-4 rounded-3xl border border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{t('settings.haptic_label')}</span>
                          <span className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">{t('settings.haptic_desc')}</span>
                        </div>
                        <button
                          onClick={() => {
                            const next = !(settings.hapticEnabled !== false);
                            // 먼저 prefs 동기화: OFF 로 가기 직전엔 마지막 햅틱 한 번 (UX 피드백)
                            if (!next) hapticLight();
                            saveSettings({ hapticEnabled: next });
                          }}
                          role="switch"
                          aria-checked={settings.hapticEnabled !== false}
                          className={`relative w-12 h-7 rounded-full transition-colors ${settings.hapticEnabled !== false ? 'bg-indigo-600' : 'bg-neutral-300 dark:bg-neutral-700'}`}
                        >
                          <span
                            className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.hapticEnabled !== false ? 'translate-x-5' : 'translate-x-0'}`}
                          />
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* ─── 그룹 4: 앱 설정 ─── */}
                  <section className="space-y-3">
                    <h3 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">{t('settings.section_app')}</h3>
                    <div className="bg-white dark:bg-neutral-900 p-5 rounded-3xl border border-neutral-100 dark:border-neutral-800">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center">
                          <Globe className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500">{t('settings.language')}</p>
                          <p className="font-bold text-neutral-800 dark:text-neutral-200 text-sm">{LANGUAGES.find(l => l.id === settings.language)?.label}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {LANGUAGES.map((lang) => (
                          <button
                            key={lang.id}
                            onClick={() => saveSettings({ language: lang.id })}
                            className={`py-2 px-4 rounded-xl text-sm font-medium border transition-colors ${
                              settings.language === lang.id
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'bg-white dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-indigo-200'
                            }`}
                          >
                            {lang.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </section>

                  {/* ─── 그룹 5: 추천 코드 ─── */}
                  <section className="space-y-3">
                    <h3 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">{t('settings.referral_section', '초대 리워드')}</h3>
                    <div className="bg-white dark:bg-neutral-900 p-5 rounded-3xl border border-neutral-100 dark:border-neutral-800">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center">
                          <span className="text-xl">🎁</span>
                        </div>
                        <div>
                          <p className="font-bold text-neutral-800 dark:text-neutral-200 text-sm">{t('settings.referral_title', '초대 리워드')}</p>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">{t('settings.referral_desc', '친구에게 앱을 공유하고 리워드를 받으세요!')}</p>
                        </div>
                      </div>
                      {settings.referralCode && (
                        <div className="flex items-center gap-2 mb-3">
                          <code className="flex-1 bg-neutral-100 dark:bg-neutral-800 px-3 py-2 rounded-xl text-sm font-mono text-neutral-800 dark:text-neutral-200">
                            {settings.referralCode}
                          </code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`https://jeiel85.github.io/lumina-daily/?ref=${settings.referralCode}`);
                              hapticLight();
                            }}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700"
                          >
                            {t('settings.copy', '복사')}
                          </button>
                        </div>
                      )}
                      <p className="text-xs text-neutral-400 dark:text-neutral-500">
                        {t('settings.referral_count', { count: settings.referralCount || 0 })}
                      </p>
                    </div>
                  </section>

                  {/* ─── 그룹 6: 지원 ─── */}
                  <section className="space-y-3 pb-4">
                    <h3 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">{t('settings.section_support')}</h3>
                    <button
                      onClick={async () => {
                        const url = 'https://ko-fi.com/jeiel85';
                        try {
                          const { Browser } = await import('@capacitor/browser');
                          await Browser.open({ url });
                        } catch {
                          window.open(url, '_blank');
                        }
                      }}
                      className="w-full bg-gradient-to-r from-amber-400 to-orange-400 text-white p-5 rounded-3xl flex items-center justify-center gap-3 font-bold text-base shadow-lg shadow-orange-200 dark:shadow-none hover:from-amber-500 hover:to-orange-500 transition-all active:scale-95"
                    >
                      <span className="text-2xl">☕</span>
                      {t('settings.buy_coffee')}
                    </button>
                  </section>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* Bottom Navigation with Animation */}
        <nav className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800 px-6 py-2 flex justify-around ${useSidebar ? 'hidden' : ''}`}>
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as typeof activeTab)}
                className="relative flex flex-col items-center gap-1 py-1 px-4"
              >
                {/* Animated background indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeTabBg"
                    className="absolute inset-0 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                
                {/* Icon with bounce animation */}
                <motion.div
                  animate={isActive ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className={`relative z-10 ${isActive ? 'text-indigo-600' : 'text-neutral-400'}`}
                >
                  <tab.icon className="w-6 h-6" />
                </motion.div>
                
                {/* Label */}
                <span className={`relative z-10 text-xs font-medium transition-colors ${isActive ? 'text-indigo-600' : 'text-neutral-400'}`}>
                  {tab.label}
                </span>
                
                {/* Active indicator dot */}
                {isActive && (
                  <motion.div
                    layoutId="activeTabDot"
                    className="absolute -bottom-1 w-1 h-1 bg-indigo-600 rounded-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Native-Style In-App Notification */}
        <AnimatePresence>
          {inAppNotification && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: 'spring', damping: 30, stiffness: 400 }}
              className="fixed top-16 left-4 right-4 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-xl rounded-2xl shadow-2xl z-50 overflow-hidden border border-neutral-200/50 dark:border-neutral-700/50"
              style={{ 
                boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.1)'
              }}
            >
              {/* Progress bar */}
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 5, ease: 'linear' }}
                className="absolute bottom-0 left-0 h-0.5 bg-indigo-500"
              />
              
              <div className="flex items-start gap-3 p-4">
                {/* App Icon */}
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-sm text-neutral-900 dark:text-neutral-100">{inAppNotification.title}</p>
                    <span className="text-xs text-neutral-400">{t('common.now')}</span>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-200 leading-snug">{inAppNotification.body}</p>
                </div>
                
                {/* Close button */}
                <button
                  onClick={() => setInAppNotification(null)}
                  className="w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-full transition-colors shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}
