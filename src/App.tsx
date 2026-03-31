/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Bell, 
  History as HistoryIcon, 
  Home, 
  Settings as SettingsIcon, 
  LogOut, 
  Sparkles, 
  Clock, 
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Quote as QuoteIcon,
  RefreshCw,
  Globe,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  auth, 
  db, 
  signInWithGoogle, 
  logout, 
  requestNotificationPermission 
} from './firebase';
import { 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import './i18n/config';

// Types
interface Quote {
  id?: string;
  text: string;
  author: string;
  explanation: string;
  theme: string;
  createdAt: any;
}

interface UserSettings {
  notificationTime: string;
  theme: string;
  isSubscribed: boolean;
  language: string;
  fcmToken?: string;
}

const THEMES = [
  { id: 'motivation', labelKey: 'themes.motivation', icon: '🔥' },
  { id: 'comfort', labelKey: 'themes.comfort', icon: '🌿' },
  { id: 'humor', labelKey: 'themes.humor', icon: '😄' },
  { id: 'success', labelKey: 'themes.success', icon: '🏆' },
];

const LANGUAGES = [
  { id: 'ko', label: '한국어' },
  { id: 'en', label: 'English' },
  { id: 'ja', label: '日本語' },
  { id: 'zh', label: '中文' },
];

export default function App() {
  const { t, i18n } = useTranslation();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'settings'>('home');
  const [currentQuote, setCurrentQuote] = useState<Quote | null>(null);
  const [history, setHistory] = useState<Quote[]>([]);
  const [settings, setSettings] = useState<UserSettings>({
    notificationTime: '08:00',
    theme: 'motivation',
    isSubscribed: false,
    language: 'ko',
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      if (user) {
        fetchUserSettings(user.uid);
        fetchHistory(user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchUserSettings = async (uid: string) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as UserSettings;
        setSettings(data);
        if (data.language) {
          i18n.changeLanguage(data.language);
        }
      } else {
        // Initialize user settings
        const initialSettings = {
          uid,
          email: auth.currentUser?.email || '',
          notificationTime: '08:00',
          theme: 'motivation',
          language: i18n.language || 'ko',
          isSubscribed: false,
          updatedAt: serverTimestamp(),
        };
        await setDoc(docRef, initialSettings);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const fetchHistory = (uid: string) => {
    const q = query(
      collection(db, 'users', uid, 'history'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    return onSnapshot(q, (snapshot) => {
      const quotes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Quote[];
      setHistory(quotes);
      if (quotes.length > 0 && !currentQuote) {
        setCurrentQuote(quotes[0]);
      }
    });
  };

  const generateQuote = async () => {
    if (!user) return;
    setIsGenerating(true);
    setError(null);
    try {
      const model = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: `당신은 세계 최고의 동기부여 전문가이자 작가입니다. 사용자가 선택한 테마에 맞춰 깊은 통찰력을 담은 명언과 그에 대한 따뜻한 해설을 제공하세요. 모든 응답은 반드시 '${i18n.language}' 언어로 작성해야 합니다.`,
          responseMimeType: "application/json",
        },
        contents: `테마: ${t(THEMES.find(t => t.id === settings.theme)?.labelKey || '')}. 다음 JSON 형식으로 응답하세요: { "text": "명언 내용", "author": "저자 이름", "explanation": "해설 내용" }`
      });

      const result = await model;
      const data = JSON.parse(result.text);
      
      const newQuote: Quote = {
        ...data,
        theme: settings.theme,
        createdAt: serverTimestamp(),
        uid: user.uid
      };

      // Save to Firestore
      const docRef = await addDoc(collection(db, 'users', user.uid, 'history'), newQuote);
      setCurrentQuote({ ...newQuote, id: docRef.id });
    } catch (err) {
      console.error('Error generating quote:', err);
      setError(t('common.error'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubscribe = async () => {
    if (!user) return;
    const token = await requestNotificationPermission();
    if (token) {
      const newSettings = { ...settings, isSubscribed: true, fcmToken: token };
      setSettings(newSettings);
      await setDoc(doc(db, 'users', user.uid), newSettings, { merge: true });
    } else {
      setError(t('settings.status_desc'));
    }
  };

  const saveSettings = async (updates: Partial<UserSettings>) => {
    if (!user) return;
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    if (updates.language) {
      i18n.changeLanguage(updates.language);
    }
    await setDoc(doc(db, 'users', user.uid), newSettings, { merge: true });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-50 p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-neutral-100"
        >
          <div className="w-20 h-20 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-10 h-10 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">{t('auth.welcome')}</h1>
          <p className="text-neutral-500 mb-8 leading-relaxed">
            {t('auth.desc')}
          </p>
          <button 
            onClick={signInWithGoogle}
            className="w-full py-4 px-6 bg-indigo-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-3 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg" className="w-5 h-5 bg-white rounded-full p-0.5" alt="Google" />
            {t('auth.google_login')}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-bottom border-neutral-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-indigo-600" />
          <span className="font-bold text-xl text-neutral-900">AI Quote</span>
        </div>
        <button onClick={logout} className="p-2 text-neutral-400 hover:text-neutral-600 transition-colors">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="max-w-md mx-auto p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              {/* Quote Card */}
              <div className="relative bg-white rounded-[2rem] p-8 shadow-sm border border-neutral-100 overflow-hidden min-h-[400px] flex flex-col justify-center">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
                
                {currentQuote ? (
                  <div className="space-y-6">
                    <QuoteIcon className="w-10 h-10 text-indigo-100 absolute top-8 left-8 -z-0" />
                    <div className="relative z-10">
                      <p className="text-2xl font-serif leading-snug text-neutral-800 mb-4">
                        "{currentQuote.text}"
                      </p>
                      <p className="text-neutral-500 font-medium text-right">— {currentQuote.author}</p>
                    </div>
                    
                    <div className="pt-6 border-t border-neutral-50">
                      <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">{t('home.ai_explanation')}</h4>
                      <p className="text-neutral-600 leading-relaxed text-sm">
                        {currentQuote.explanation}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto">
                      <Sparkles className="w-8 h-8 text-neutral-200" />
                    </div>
                    <p className="text-neutral-400">{t('home.no_quote')}</p>
                    <button 
                      onClick={generateQuote}
                      disabled={isGenerating}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-full text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {isGenerating ? t('common.loading') : t('home.generate_first')}
                    </button>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={generateQuote}
                  disabled={isGenerating}
                  className="bg-white p-4 rounded-2xl border border-neutral-100 flex flex-col items-center gap-2 hover:bg-neutral-50 transition-colors"
                >
                  <RefreshCw className={`w-6 h-6 text-indigo-600 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span className="text-xs font-bold text-neutral-600">{t('home.refresh')}</span>
                </button>
                <div className="bg-white p-4 rounded-2xl border border-neutral-100 flex flex-col items-center gap-2">
                  <Clock className="w-6 h-6 text-purple-600" />
                  <span className="text-xs font-bold text-neutral-600">{t('home.notification_at', { time: settings.notificationTime })}</span>
                </div>
              </div>

              {/* Ad Placeholder */}
              <div className="bg-neutral-100 rounded-2xl p-4 border border-dashed border-neutral-300 flex flex-col items-center justify-center min-h-[100px] text-neutral-400">
                <p className="text-[10px] uppercase font-bold tracking-widest mb-1">Advertisement</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs">Sponsor Area</span>
                  <ExternalLink className="w-3 h-3" />
                </div>
              </div>

              {/* Notification Banner */}
              {!settings.isSubscribed && (
                <div className="bg-indigo-600 rounded-2xl p-6 text-white flex items-center justify-between">
                  <div className="space-y-1">
                    <h4 className="font-bold">{t('home.subscribe_title')}</h4>
                    <p className="text-xs text-indigo-100">{t('home.subscribe_desc')}</p>
                  </div>
                  <button 
                    onClick={handleSubscribe}
                    className="bg-white text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold shadow-sm"
                  >
                    {t('home.activate')}
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <h2 className="text-2xl font-bold text-neutral-900 mb-6">{t('history.title')}</h2>
              {history.map((quote) => (
                <div 
                  key={quote.id} 
                  className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm space-y-3"
                  onClick={() => {
                    setCurrentQuote(quote);
                    setActiveTab('home');
                  }}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 bg-indigo-50 px-2 py-1 rounded">
                      {t(THEMES.find(t => t.id === quote.theme)?.labelKey || '')}
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      {quote.createdAt instanceof Timestamp ? quote.createdAt.toDate().toLocaleDateString() : t('history.just_now')}
                    </span>
                  </div>
                  <p className="text-neutral-800 font-medium line-clamp-2">"{quote.text}"</p>
                  <p className="text-xs text-neutral-500">— {quote.author}</p>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              <h2 className="text-2xl font-bold text-neutral-900">{t('settings.title')}</h2>
              
              <section className="space-y-4">
                <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">{t('settings.notification_time')}</h3>
                <div className="bg-white p-6 rounded-3xl border border-neutral-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                      <Clock className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-bold text-neutral-800">{settings.notificationTime}</p>
                      <p className="text-xs text-neutral-400">{t('settings.notification_desc')}</p>
                    </div>
                  </div>
                  <input 
                    type="time" 
                    value={settings.notificationTime}
                    onChange={(e) => saveSettings({ notificationTime: e.target.value })}
                    className="w-12 h-12 opacity-0 absolute right-12 cursor-pointer"
                  />
                  <ChevronRight className="w-5 h-5 text-neutral-300" />
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">{t('settings.language')}</h3>
                <div className="bg-white p-6 rounded-3xl border border-neutral-100">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center">
                      <Globe className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-bold text-neutral-800">{LANGUAGES.find(l => l.id === settings.language)?.label}</p>
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
                          : 'bg-white border-neutral-100 text-neutral-600 hover:border-indigo-200'
                        }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">{t('settings.theme')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  {THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => saveSettings({ theme: theme.id })}
                      className={`p-6 rounded-3xl border transition-all flex flex-col items-center gap-3 ${
                        settings.theme === theme.id 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' 
                        : 'bg-white border-neutral-100 text-neutral-600 hover:border-indigo-200'
                      }`}
                    >
                      <span className="text-2xl">{theme.icon}</span>
                      <span className="font-bold text-sm">{t(theme.labelKey)}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">{t('settings.status')}</h3>
                <div className="bg-white p-6 rounded-3xl border border-neutral-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${settings.isSubscribed ? 'bg-green-50' : 'bg-red-50'}`}>
                      <Bell className={`w-6 h-6 ${settings.isSubscribed ? 'text-green-600' : 'text-red-600'}`} />
                    </div>
                    <div>
                      <p className="font-bold text-neutral-800">{settings.isSubscribed ? t('settings.enabled') : t('settings.disabled')}</p>
                      <p className="text-xs text-neutral-400">{t('settings.status_desc')}</p>
                    </div>
                  </div>
                  {!settings.isSubscribed && (
                    <button 
                      onClick={handleSubscribe}
                      className="text-indigo-600 font-bold text-sm"
                    >
                      {t('settings.turn_on')}
                    </button>
                  )}
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-lg border-t border-neutral-100 px-6 py-4 flex items-center justify-around z-50">
        <button 
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'home' ? 'text-indigo-600' : 'text-neutral-400'}`}
        >
          <Home className="w-6 h-6" />
          <span className="text-[10px] font-bold">{t('common.home')}</span>
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'history' ? 'text-indigo-600' : 'text-neutral-400'}`}
        >
          <HistoryIcon className="w-6 h-6" />
          <span className="text-[10px] font-bold">{t('common.history')}</span>
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'settings' ? 'text-indigo-600' : 'text-neutral-400'}`}
        >
          <SettingsIcon className="w-6 h-6" />
          <span className="text-[10px] font-bold">{t('common.settings')}</span>
        </button>
      </nav>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-6 right-6 bg-red-600 text-white p-4 rounded-2xl shadow-xl flex items-center gap-3 z-[60]"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-white/60 hover:text-white">
              <CheckCircle2 className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
