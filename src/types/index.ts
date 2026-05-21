export interface Quote {
  id?: string;
  text: string;
  author: string;
  explanation: string;
  theme: string;
  createdAt: any;
  imageUrl?: string;
  isBookmarked?: boolean;
}

export interface UserSettings {
  uid: string;
  email: string;
  notificationTime: string;
  notificationTimeUTC?: string;
  preferredThemes: string[];
  preferredCardStyle: string;
  isSubscribed: boolean;
  language: string;
  darkMode: 'light' | 'dark' | 'system' | 'material';
  fontSize?: 'small' | 'medium' | 'large';
  hapticEnabled?: boolean;
  fcmToken?: string;
  role: string;
  updatedAt?: any;
  referralCode?: string;
  referralCount?: number;
  rewards?: { type: string; earnedAt: any; message: string }[];
}