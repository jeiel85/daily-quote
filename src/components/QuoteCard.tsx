import { memo } from 'react';
import { Quote } from '../types';
import { motion, useMotionValue, useTransform, PanInfo } from 'motion/react';
import { Quote as QuoteIcon, Image as ImageIcon, RefreshCw, ExternalLink, Sparkles, Loader2, ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react';
import { hapticLight, hapticMedium } from '../utils/haptics';

interface QuoteCardProps {
  quote: Quote | null;
  isLoading: boolean;
  isGeneratingCard: boolean;
  cardProgress?: number;
  onGenerateCard: () => void;
  onShare: () => void;
  onSpeak?: () => void;
  isSpeaking?: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  canSwipeLeft?: boolean;
  canSwipeRight?: boolean;
  fontSize?: 'small' | 'medium' | 'large';
  t: (key: string) => string;
}

// Enhanced Skeleton component with wave effect
function Skeleton({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <div 
      className={`bg-neutral-200/80 dark:bg-neutral-700/80 rounded-lg overflow-hidden ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div 
        className="h-full w-full bg-gradient-to-r from-transparent via-neutral-100/60 dark:via-neutral-600/60 to-transparent animate-shimmer bg-[length:200%_100%]"
        style={{ animationDelay: `${delay}ms` }}
      />
    </div>
  );
}

// 오늘의 명언 로딩 스켈레톤 (캐시에서 꺼내는 거라 보통 즉시 보임)
function QuoteSkeleton({ t }: { t: (key: string) => string }) {
  return (
    <div className="relative bg-white dark:bg-neutral-900 rounded-[2rem] p-8 shadow-sm border border-neutral-100 dark:border-neutral-800 overflow-hidden min-h-[400px] flex flex-col">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-shimmer bg-[length:200%_100%]" />

      <div className="space-y-3 flex-1">
        <div className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" delay={0} />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-full" delay={100} />
            <Skeleton className="h-7 w-5/6" delay={200} />
            <Skeleton className="h-7 w-4/6" delay={300} />
          </div>
        </div>
        <Skeleton className="h-5 w-1/3 ml-auto" delay={400} />

        <div className="border-t border-neutral-100 dark:border-neutral-800 pt-5 mt-5">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-4 w-24 rounded" delay={500} />
            <div className="flex-1 h-px bg-gradient-to-r from-neutral-200 dark:from-neutral-700 to-transparent" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" delay={600} />
            <Skeleton className="h-4 w-11/12" delay={700} />
            <Skeleton className="h-4 w-3/4" delay={800} />
          </div>
        </div>
      </div>

      <div className="mt-4 bg-gradient-to-br from-indigo-50/80 to-purple-50/80 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-4 border border-indigo-100/50 dark:border-indigo-800/30">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
          <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{t('home.loading')}</span>
        </div>
      </div>
    </div>
  );
}

// 명언 카드 이미지 생성 진행 상태 (카드 만들기 버튼 누른 직후)
function CardGenerationSkeleton({ t, progress }: { t: (key: string) => string; progress?: number }) {
  return (
    <div className="relative bg-white dark:bg-neutral-900 rounded-[2rem] p-8 shadow-sm border border-neutral-100 dark:border-neutral-800 overflow-hidden min-h-[400px] flex flex-col transition-colors">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-shimmer bg-[length:200%_100%]" />

      <div className="relative flex-1">
        <QuoteIcon className="w-10 h-10 text-indigo-100 dark:text-indigo-900/30 absolute top-0 left-0" />
        <div className="relative z-10 pt-2">
          <p className="text-2xl font-serif leading-snug text-neutral-800 dark:text-neutral-100 mb-4">"..."</p>
          <p className="text-neutral-500 dark:text-neutral-400 font-medium text-right">— ...</p>
        </div>

        <div className="pt-6 border-t border-neutral-50 dark:border-neutral-800">
          <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">
            {t('home.explanation')}
          </h4>
          <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-sm">...</p>
        </div>
      </div>

      <div className="pt-4">
        <button
          disabled
          className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 animate-skeleton-pulse"
        >
          <Sparkles className="w-4 h-4 animate-pulse" />
          {t('home.generating_card')}
        </button>

        {progress !== undefined && (
          <div className="mt-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl p-3">
            <div className="flex justify-between items-center text-xs mb-2">
              <span className="text-neutral-500 dark:text-neutral-400">{t('home.generating_card')}</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{progress}%</span>
            </div>
            <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full transition-all duration-500 animate-shimmer"
                style={{ width: `${progress}%`, backgroundSize: '200% 100%' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const QuoteCard = memo(function QuoteCard({
  quote,
  isLoading,
  isGeneratingCard,
  cardProgress,
  onGenerateCard,
  onShare,
  onSpeak,
  isSpeaking,
  onSwipeLeft,
  onSwipeRight,
  canSwipeLeft,
  canSwipeRight,
  fontSize = 'medium',
  t,
}: QuoteCardProps) {
  const textSizeClass = {
    small: 'text-lg',
    medium: 'text-2xl',
    large: 'text-3xl',
  }[fontSize];
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-150, 0, 150], [0.6, 1, 0.6]);
  const rotate = useTransform(x, [-150, 150], [-3, 3]);
  const hintOpacityLeft = useTransform(x, [-150, -40, 0], [1, 0.5, 0]);
  const hintOpacityRight = useTransform(x, [0, 40, 150], [0, 0.5, 1]);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 80;
    if (info.offset.x < -threshold && onSwipeLeft) {
      onSwipeLeft();
    } else if (info.offset.x > threshold && onSwipeRight) {
      onSwipeRight();
    }
  };

  // 오늘의 명언 로딩 중 (보통 즉시 캐시에서 꺼내져서 거의 안 보임)
  if (isLoading) {
    return <QuoteSkeleton t={t} />;
  }

  // 카드 이미지 생성 진행 중
  if (isGeneratingCard && quote) {
    return <CardGenerationSkeleton t={t} progress={cardProgress} />;
  }

  return (
    <motion.div
      style={{ x, opacity, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.15}
      onDragEnd={handleDragEnd}
      className="relative bg-white dark:bg-neutral-900 rounded-[2rem] p-8 shadow-sm border border-neutral-100 dark:border-neutral-800 overflow-hidden min-h-[400px] flex flex-col justify-center transition-colors select-none"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />

      {/* Swipe hints */}
      {canSwipeRight && (
        <motion.div
          style={{ opacity: hintOpacityRight }}
          className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-indigo-600 dark:text-indigo-400 pointer-events-none"
        >
          <ChevronLeft className="w-6 h-6" />
          <span className="text-xs font-medium">{t('home.prev_quote')}</span>
        </motion.div>
      )}
      {canSwipeLeft && (
        <motion.div
          style={{ opacity: hintOpacityLeft }}
          className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-indigo-600 dark:text-indigo-400 pointer-events-none"
        >
          <span className="text-xs font-medium">{t('home.next_quote')}</span>
          <ChevronRight className="w-6 h-6" />
        </motion.div>
      )}

      {quote ? (
        <>
          <QuoteIcon className="w-10 h-10 text-indigo-100 dark:text-indigo-900/30 absolute top-8 left-8 -z-0" />
          <div className="relative z-10">
            <p className={`${textSizeClass} font-serif leading-snug text-neutral-800 dark:text-neutral-100 mb-4`}>
              "{quote.text}"
            </p>
            <p className="text-neutral-500 dark:text-neutral-400 font-medium text-right">— {quote.author}</p>
          </div>

          <div className="pt-6 border-t border-neutral-50 dark:border-neutral-800">
            <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">{t('home.explanation')}</h4>
            <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-sm">
              {quote.explanation}
            </p>
          </div>

          <div className="pt-4 flex flex-col gap-2">
            <button
              onClick={() => { hapticMedium(); onGenerateCard(); }}
              disabled={isGeneratingCard}
              className="w-full py-3 px-4 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-all"
            >
              {isGeneratingCard ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
              {t('home.generate_card')}
            </button>
            <div className="flex gap-2">
              {onSpeak && (
                <button
                  onClick={() => { hapticLight(); onSpeak(); }}
                  className={`flex-1 py-3 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${isSpeaking ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' : 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-100 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700'}`}
                >
                  {isSpeaking ? <VolumeX className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> : <Volume2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                  {t('home.speak')}
                </button>
              )}
              <button
                onClick={() => { hapticLight(); onShare(); }}
                className="flex-1 py-3 px-2 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-100 dark:border-neutral-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                {t('share.button')}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-neutral-50 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8 text-neutral-200 dark:text-neutral-700" />
          </div>
          <p className="text-neutral-400 dark:text-neutral-500">{t('home.no_quote')}</p>
        </div>
      )}
    </motion.div>
  );
});