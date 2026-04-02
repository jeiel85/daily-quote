import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  SafeAreaView, 
  ScrollView, 
  Image, 
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
  StatusBar as RNStatusBar,
  useColorScheme
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  RefreshCw, 
  Share2, 
  Sparkles,
  Quote as QuoteIcon,
  Settings as SettingsIcon,
  Check,
  Home,
  History as HistoryIcon,
  Clock,
  LogIn,
  LogOut,
  Palette,
  Sun,
  Moon,
  Smartphone
} from 'lucide-react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import DateTimePicker from '@react-native-community/datetimepicker';

// Import our custom AI and Firebase logic
import { generateNativeQuote, generateNativeImage, Quote } from './src/lib/ai';
import { auth, db } from './src/config/firebase';
import { signInAnonymously, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
import { 
  registerForPushNotificationsAsync, 
  scheduleDailyQuoteNotification,
  cancelAllNotifications 
} from './src/lib/notifications';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  limit, 
  onSnapshot 
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const APP_THEMES: any = {
  white: { bg: '#FFFFFF', text: '#1E293B', subText: '#64748B', accent: '#6366F1', card: '#F8FAFC', light: true, border: '#E2E8F0' },
  dark: { bg: '#0F172A', text: '#F1F5F9', subText: '#94A3B8', accent: '#818CF8', card: '#1E293B', light: false, border: '#334155' },
  material: { bg: '#FDF7FF', text: '#1D1B1E', subText: '#49454E', accent: '#6750A4', card: '#F3EDF7', light: true, border: '#E8E0EB' },
};

const TRANSLATIONS: any = {
  ko: {
    home: '홈', history: '기록', settings: '설정', refresh: '새 지혜', share: '카드 저장 및 공유',
    subscribe: '지혜 배달 신청', subscribed: '신청됨', explanation: '지혜의 깊이', authorSuffix: 'Lumina',
    wisdomDesc: '매일 당신을 채우는 지혜 한 조각', noHistory: '아직 저장된 지혜가 없습니다.',
    settingsTitle: '설정', category: '카테고리', language: '언어', appTheme: '앱 테마',
    cat_motivation: '동기부여', cat_comfort: '위로', cat_humor: '유머', cat_success: '성공', cat_love: '사랑', cat_calm: '평온', cat_growth: '성장', cat_leadership: '리더십',
    loginAnonymously: '익명으로 시작하기', loginGoogle: '구글로 계속하기', logout: '로그아웃',
    errorTitle: '오류 발생', errorMsg: '알 수 없는 네트워크 오류', loading: '지혜를 불러오는 중...',
    notificationTime: '배달 시간 설정', notificationDesc: '선택하신 시간에 지혜가 배달됩니다.'
  },
  en: {
    home: 'Home', history: 'History', settings: 'Settings', refresh: 'Refresh', share: 'Save & Share Card',
    subscribe: 'Daily Wisdom', subscribed: 'Subscribed', explanation: 'Depth of Wisdom', authorSuffix: 'Lumina',
    wisdomDesc: 'A piece of wisdom for your day', noHistory: 'No history yet.',
    settingsTitle: 'Settings', category: 'Category', language: 'Language', appTheme: 'App Theme',
    cat_motivation: 'Motivation', cat_comfort: 'Comfort', cat_humor: 'Humor', cat_success: 'Success', cat_love: 'Love', cat_calm: 'Calm', cat_growth: 'Growth', cat_leadership: 'Leadership',
    loginAnonymously: 'Start Anonymously', loginGoogle: 'Sign in with Google', logout: 'Log Out',
    errorTitle: 'Error Detected', errorMsg: 'Network or API error occurred.', loading: 'Fetching wisdom...',
    notificationTime: 'Set Time', notificationDesc: 'Wisdom will be delivered at your time.'
  },
  ja: {
    home: 'ホーム', history: '履歴', settings: '設定', refresh: '更新', share: 'カード保存・共有',
    subscribe: '毎日智慧をお届け', subscribed: '購読中', explanation: '智慧の深み', authorSuffix: 'Lumina',
    wisdomDesc: 'あなたの毎日を彩る智慧のひとかけら', noHistory: '履歴はありません。',
    settingsTitle: '設定', category: 'カテゴリー', language: '言語', appTheme: 'アプリテーマ',
    cat_motivation: 'モチベーション', cat_comfort: '癒やし', cat_humor: 'ユー모ア', cat_success: '成功', cat_love: '愛', cat_calm: '静寂', cat_growth: '成長', cat_leadership: 'リーダーシップ',
    loginAnonymously: '匿名で開始', loginGoogle: 'Googleで続行', logout: 'ログアウト',
    errorTitle: 'エラー', errorMsg: '読み込みに失敗しました。', loading: '智慧を読み込み中...',
    notificationTime: '時間設定', notificationDesc: '選択した時間に智慧を配達します。'
  },
  zh: {
    home: '主页', history: '记录', settings: '设置', refresh: '刷新', share: '保存并分享',
    subscribe: '订阅智慧', subscribed: '已订阅', explanation: '智慧的深度', authorSuffix: 'Lumina',
    wisdomDesc: '为您带来每天的智慧启迪', noHistory: '尚无记录。',
    settingsTitle: '设置', category: '分类', language: '语言', appTheme: '应用主题',
    cat_motivation: '动力', cat_comfort: '安慰', cat_humor: '幽默', cat_success: '成功', cat_love: '爱', cat_calm: '平静', cat_growth: '成长', cat_leadership: '领导力',
    loginAnonymously: '以匿名身份开始', loginGoogle: '使用 Google 登录', logout: '登出',
    errorTitle: '发生错误', errorMsg: '网络或 API 错误。', loading: '正在获取智慧...',
    notificationTime: '设置时间', notificationDesc: '系统将在指定时间推送智慧。'
  }
};

const THEMES_LIST = [
  { id: 'motivation', icon: '🔥' }, { id: 'comfort', icon: '🌿' },
  { id: 'humor', icon: '😄' }, { id: 'success', icon: '🏆' },
  { id: 'love', icon: '❤️' }, { id: 'calm', icon: '🧘' },
  { id: 'growth', icon: '🌱' }, { id: 'leadership', icon: '👑' }
];

export default function App() {
  const systemColorScheme = useColorScheme();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'settings'>('home');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isNotified, setIsNotified] = useState(false);
  const [history, setHistory] = useState<Quote[]>([]);
  const [theme, setTheme] = useState('motivation'); 
  const [appTheme, setAppTheme] = useState('system'); // white, dark, system, material
  const [language, setLanguage] = useState('ko');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [notifTime, setNotifTime] = useState(new Date());

  const viewRef = useRef(null);
  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  // Resolve current visual theme based on selection
  const currentVisualTheme = appTheme === 'system' 
    ? (systemColorScheme === 'dark' ? APP_THEMES.dark : APP_THEMES.white)
    : (APP_THEMES[appTheme] || APP_THEMES.white);

  // Google Login Integration
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: "DUMMY_ID.apps.googleusercontent.com",
    webClientId: "DUMMY_ID.apps.googleusercontent.com",
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential);
    }
  }, [response]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      if (firebaseUser) loadHistoryFromFirestore(firebaseUser.uid);
    });
    loadSettings();
    return unsubscribe;
  }, []);

  const loadSettings = async () => {
    const sTheme = await AsyncStorage.getItem('@lumina_theme');
    const sAppTheme = await AsyncStorage.getItem('@lumina_app_theme');
    const sLang = await AsyncStorage.getItem('@lumina_lang');
    const sNotif = await AsyncStorage.getItem('@lumina_notified');
    if (sTheme) setTheme(sTheme);
    if (sAppTheme) setAppTheme(sAppTheme);
    if (sLang) setLanguage(sLang);
    setIsNotified(sNotif === 'true');
  };

  const saveSetting = async (key: string, value: string) => { await AsyncStorage.setItem(key, value); };

  const loadHistoryFromFirestore = (uid: string) => {
    const historyRef = collection(db, 'users', uid, 'history');
    const q = query(historyRef, orderBy('createdAt', 'desc'), limit(30));
    return onSnapshot(q, (snapshot) => { setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any); });
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const newQuoteData = await generateNativeQuote(theme, language);
      const base64Image = await generateNativeImage(theme);
      const finalQuote = { ...newQuoteData, imageUrl: base64Image ? `data:image/png;base64,${base64Image}` : undefined };
      setQuote(finalQuote);
      if (user) await addDoc(collection(db, 'users', user.uid, 'history'), { ...finalQuote, createdAt: serverTimestamp(), theme });
    } catch (error: any) {
      console.error(error);
      Alert.alert(t('errorTitle'), `${t('errorMsg')}\n\n[Details]\n${error.message}`);
    } finally { setIsGenerating(false); }
  };

  const handleSaveAndShare = async () => {
    if (!viewRef.current) return;
    setIsCapturing(true);
    setTimeout(async () => {
      try {
        const uri = await captureRef(viewRef, { format: 'jpg', quality: 0.95 });
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          const asset = await MediaLibrary.createAssetAsync(uri);
          await MediaLibrary.createAlbumAsync('Lumina', asset, false);
          if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
        }
      } catch (error) { Alert.alert('Error', 'Save failed.'); } finally { setIsCapturing(false); }
    }, 100);
  };

  const renderBackground = () => {
    if (quote?.imageUrl) return <Image source={{ uri: quote.imageUrl }} style={StyleSheet.absoluteFill} />;
    return <LinearGradient colors={['#6366f1', '#a855f7', '#ec4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />;
  };

  if (loading) return <View style={[styles.loadingFull, { backgroundColor: currentVisualTheme.bg }]}><ActivityIndicator size="large" color={currentVisualTheme.accent} /></View>;

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', backgroundColor: currentVisualTheme.bg }]}>
        <View style={styles.loginCard}>
          <View style={[styles.loginIconContainer, { backgroundColor: currentVisualTheme.accent }]}><Sparkles color="white" size={40} /></View>
          <Text style={[styles.loginTitle, { color: currentVisualTheme.text }]}>Lumina</Text>
          <Text style={[styles.loginSubtitle, { color: currentVisualTheme.subText }]}>{t('wisdomDesc')}</Text>
          <TouchableOpacity style={[styles.loginButton, { backgroundColor: currentVisualTheme.accent }]} onPress={() => signInAnonymously(auth)}>
            <LogIn color="white" size={20} /><Text style={styles.loginButtonText}>{t('loginAnonymously')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.loginButton, { backgroundColor: '#ea4335', marginTop: 12 }]} onPress={() => promptAsync()}>
            <LogIn color="white" size={20} /><Text style={styles.loginButtonText}>{t('loginGoogle')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: currentVisualTheme.bg }]}>
      <StatusBar style={currentVisualTheme.light ? 'dark' : 'light'} />
      <SafeAreaView style={[styles.header, { backgroundColor: currentVisualTheme.card, borderBottomColor: currentVisualTheme.border, borderBottomWidth: 1 }]}>
        <View style={styles.headerBrand}>
          <View style={[styles.headerIconContainer, { backgroundColor: currentVisualTheme.accent }]}><Sparkles color="white" size={14} /></View>
          <View>
            <Text style={[styles.headerTitle, { color: currentVisualTheme.accent }]}>Lumina</Text>
            <Text style={styles.headerSubtitleText}>Wisdom for you</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={() => auth.signOut()}>
            <LogOut color={currentVisualTheme.subText} size={18} />
        </TouchableOpacity>
      </SafeAreaView>

      <View style={styles.mainContent}>
        {activeTab === 'home' && (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <ViewShot ref={viewRef} style={isCapturing ? styles.cardContainerCapture : styles.cardContainerWrapper} options={{ format: 'jpg', quality: 0.95 }}>
              <View style={[styles.card, isCapturing && { borderRadius: 0 }]}>
                {renderBackground()}
                <View style={styles.overlay} />
                <View style={styles.cardContent}>
                  <QuoteIcon color="white" size={40} opacity={0.6} />
                  <Text style={styles.quoteText}>{quote?.text || t('loading')}</Text>
                  <Text style={styles.authorText}>— {quote?.author || t('authorSuffix')}</Text>
                  <View style={styles.explanationContainer}>
                    <Text style={styles.explanationTitle}>{t('explanation')}</Text>
                    <Text style={styles.explanationText}>{quote?.explanation || t('wisdomDesc')}</Text>
                  </View>
                </View>
              </View>
            </ViewShot>

            <View style={styles.actions}>
              <View style={styles.gridActions}>
                <TouchableOpacity style={[styles.gridActionItem, { backgroundColor: currentVisualTheme.card, borderColor: currentVisualTheme.border }]} onPress={handleGenerate} disabled={isGenerating}>
                  <RefreshCw color={currentVisualTheme.accent} size={24} style={isGenerating && { opacity: 0.5 }} />
                  <Text style={[styles.gridActionLabel, { color: currentVisualTheme.subText }]}>{t('refresh')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.gridActionItem, { backgroundColor: currentVisualTheme.card, borderColor: currentVisualTheme.border }]} onPress={() => setShowTimePicker(true)}>
                  <Clock color="#a855f7" size={24} />
                  <Text style={[styles.gridActionLabel, { color: currentVisualTheme.subText }]}>{t('notificationTime')}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[styles.promoBanner, { backgroundColor: currentVisualTheme.accent }]} onPress={() => setShowTimePicker(true)}>
                <View>
                  <Text style={styles.promoTitle}>{t('subscribe')}</Text>
                  <Text style={styles.promoSubtitle}>{t('notificationDesc')}</Text>
                </View>
                <View style={styles.promoButton}>
                  {isNotified ? <Check color="#10b981" size={16} /> : <Text style={styles.promoButtonText}>SET</Text>}
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.mainActionButton, { backgroundColor: currentVisualTheme.accent }]} onPress={handleSaveAndShare}>
                <Share2 color="white" size={20} />
                <Text style={styles.mainActionButtonText}>{t('share')}</Text>
              </TouchableOpacity>
            </View>

            {showTimePicker && <DateTimePicker value={notifTime} mode="time" is24Hour={true} onChange={(e, d) => { setShowTimePicker(false); if(d) setNotifTime(d); }} />}
          </ScrollView>
        )}

        {activeTab === 'history' && (
          <ScrollView contentContainerStyle={styles.historyContent}>
            <Text style={[styles.tabTitle, { color: currentVisualTheme.text }]}>{t('history')}</Text>
            {history.map((h, i) => (
              <TouchableOpacity key={i} style={[styles.historyCard, { backgroundColor: currentVisualTheme.card, borderColor: currentVisualTheme.border }]} onPress={() => { setQuote(h); setActiveTab('home'); }}>
                <Text style={[styles.historyThemeTag, { backgroundColor: currentVisualTheme.accent + '20', color: currentVisualTheme.accent }]}>{t('cat_' + h.theme)}</Text>
                <Text style={[styles.historyText, { color: currentVisualTheme.text }]} numberOfLines={2}>"{h.text}"</Text>
                <Text style={[styles.historyAuthor, { color: currentVisualTheme.subText }]}>— {h.author}</Text>
              </TouchableOpacity>
            ))}
            {history.length === 0 && <View style={styles.emptyContainer}><HistoryIcon color={currentVisualTheme.border} size={48} /><Text style={styles.emptyText}>{t('noHistory')}</Text></View>}
          </ScrollView>
        )}

        {activeTab === 'settings' && (
          <ScrollView contentContainerStyle={styles.settingsContent}>
            <Text style={[styles.tabTitle, { color: currentVisualTheme.text }]}>{t('settingsTitle')}</Text>
            
            <View style={styles.settingSection}>
              <Text style={[styles.settingSectionTitle, { color: currentVisualTheme.subText }]}>{t('appTheme')}</Text>
              <View style={styles.themeGrid}>
                {['system', 'white', 'dark', 'material'].map(id => (
                  <TouchableOpacity key={id} style={[styles.themeItem, appTheme === id && { backgroundColor: currentVisualTheme.accent }, { borderColor: currentVisualTheme.border }]} onPress={() => { setAppTheme(id); saveSetting('@lumina_app_theme', id); }}>
                    {id === 'system' && <Smartphone color={appTheme === id ? 'white' : currentVisualTheme.accent} size={24} />}
                    {id === 'white' && <Sun color={appTheme === id ? 'white' : currentVisualTheme.accent} size={24} />}
                    {id === 'dark' && <Moon color={appTheme === id ? 'white' : currentVisualTheme.accent} size={24} />}
                    {id === 'material' && <Palette color={appTheme === id ? 'white' : currentVisualTheme.accent} size={24} />}
                    <Text style={[styles.themeLabel, { color: appTheme === id ? 'white' : currentVisualTheme.text }]}>{id.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.settingSection}>
              <Text style={[styles.settingSectionTitle, { color: currentVisualTheme.subText }]}>{t('language')}</Text>
              <View style={styles.langList}>
                {['ko', 'en', 'ja', 'zh'].map(l => (
                  <TouchableOpacity key={l} style={[styles.langItem, language === l && { backgroundColor: currentVisualTheme.accent }]} onPress={() => { setLanguage(l); saveSetting('@lumina_lang', l); }}>
                    <Text style={[styles.langText, { color: language === l ? 'white' : currentVisualTheme.text }]}>
                        {l === 'ko' ? '한국어' : l === 'en' ? 'English' : l === 'ja' ? '日本語' : '中文'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        )}
      </View>

      <View style={[styles.bottomNav, { backgroundColor: currentVisualTheme.card, borderTopColor: currentVisualTheme.border }]}>
        {[ { id: 'home', icon: Home, label: 'home' }, { id: 'history', icon: HistoryIcon, label: 'history' }, { id: 'settings', icon: SettingsIcon, label: 'settings' } ].map(nav => (
          <TouchableOpacity key={nav.id} style={styles.navItem} onPress={() => setActiveTab(nav.id as any)}>
            <nav.icon color={activeTab === nav.id ? currentVisualTheme.accent : currentVisualTheme.subText} size={24} />
            <Text style={[styles.navText, { color: activeTab === nav.id ? currentVisualTheme.accent : currentVisualTheme.subText }]}>{t(nav.label)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingFull: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mainContent: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: Platform.OS === 'android' ? 40 : 12, paddingBottom: 20 },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconContainer: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitleText: { fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: -2 },
  logoutButton: { padding: 8, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.05)' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 },
  cardContainerWrapper: { width: '100%', aspectRatio: 0.82, borderRadius: 32, overflow: 'hidden', backgroundColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 12 },
  cardContainerCapture: { width: '100%', aspectRatio: 0.82, backgroundColor: 'white' },
  card: { flex: 1, padding: 32, justifyContent: 'center', borderRadius: 32, overflow: 'hidden' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.3)' },
  cardContent: { width: '100%' },
  quoteText: { fontSize: 24, fontWeight: '700', color: 'white', lineHeight: 36, marginTop: 20 },
  authorText: { fontSize: 16, color: 'rgba(255, 255, 255, 0.8)', marginTop: 16, textAlign: 'right', fontStyle: 'italic' },
  explanationContainer: { marginTop: 32, paddingTop: 24, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.2)' },
  explanationTitle: { fontSize: 12, fontWeight: '800', color: 'white', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, opacity: 0.7 },
  explanationText: { fontSize: 14, color: 'rgba(255, 255, 255, 0.9)', lineHeight: 22 },
  actions: { marginTop: 24, gap: 16 },
  gridActions: { flexDirection: 'row', gap: 12 },
  gridActionItem: { flex: 1, borderRadius: 20, padding: 18, alignItems: 'center', gap: 8, borderWidth: 1 },
  gridActionLabel: { fontSize: 12, fontWeight: '700' },
  promoBanner: { borderRadius: 24, padding: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  promoTitle: { color: 'white', fontSize: 15, fontWeight: '700' },
  promoSubtitle: { color: 'rgba(255, 255, 255, 0.8)', fontSize: 12, marginTop: 4 },
  promoButton: { backgroundColor: 'white', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  promoButtonText: { color: '#6366f1', fontWeight: '800', fontSize: 13 },
  mainActionButton: { height: 64, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
  mainActionButtonText: { color: 'white', fontSize: 16, fontWeight: '700' },
  bottomNav: { flexDirection: 'row', height: 80, paddingBottom: 20 },
  navItem: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 4 },
  navText: { fontSize: 10, fontWeight: '700' },
  tabTitle: { fontSize: 28, fontWeight: '800', marginBottom: 24, paddingHorizontal: 24 },
  historyContent: { paddingTop: 24, paddingBottom: 100 },
  historyCard: { marginHorizontal: 24, marginBottom: 16, padding: 20, borderRadius: 24, borderWidth: 1 },
  historyThemeTag: { fontSize: 10, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', textTransform: 'uppercase', marginBottom: 12 },
  historyText: { fontSize: 16, fontWeight: '600', lineHeight: 24 },
  historyAuthor: { fontSize: 13, marginTop: 12 },
  emptyContainer: { alignItems: 'center', marginTop: 100, gap: 16 },
  emptyText: { color: '#94a3b8', fontSize: 16, fontWeight: '600' },
  settingsContent: { paddingTop: 24, paddingBottom: 100 },
  settingSection: { marginBottom: 32, paddingHorizontal: 24 },
  settingSectionTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  themeItem: { width: (width - 60) / 2, backgroundColor: 'white', padding: 20, borderRadius: 24, alignItems: 'center', gap: 12, borderWidth: 1 },
  themeLabel: { fontSize: 14, fontWeight: '700' },
  langList: { backgroundColor: 'white', borderRadius: 24, padding: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  langItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 16 },
  langText: { fontSize: 15, fontWeight: '600' },
  loginCard: { padding: 32, alignItems: 'center' },
  loginIconContainer: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 24, shadowColor: '#6366f1', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  loginTitle: { fontSize: 32, fontWeight: '900' },
  loginSubtitle: { fontSize: 16, marginTop: 8, textAlign: 'center' },
  loginButton: { width: '100%', height: 56, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 32, flexDirection: 'row', gap: 10 },
  loginButtonText: { color: 'white', fontSize: 16, fontWeight: '700' }
});
