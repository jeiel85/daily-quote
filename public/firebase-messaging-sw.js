// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// https://firebase.google.com/docs/web/setup#config-object
// Note: These values should be provided at build time or via environment variables
// For GitHub security, we use placeholders for sensitive values.
firebase.initializeApp({
  apiKey: "AIzaSyDwj48xtxWNK4b2ejOBediztjgHZjJ2iAY",
  authDomain: "spheric-shield-487302-a2.firebaseapp.com",
  projectId: "spheric-shield-487302-a2",
  storageBucket: "spheric-shield-487302-a2.firebasestorage.app",
  messagingSenderId: "746169091837",
  appId: "1:746169091837:web:bd4c4af19cd96ab23f6094"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icons/icon-192x192.png'
  };

  self.registration.showNotification(notificationTitle,
    notificationOptions);
});
