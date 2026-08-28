import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  setPersistence,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

const rawConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// True only when every real value above was provided (via .env.local / build secrets).
export const firebaseConfigured = Object.values(rawConfig).every(Boolean);

// The domain everyone signing in must belong to (e.g. "dduck.com.br"). Only a client-side
// hint/UX filter — the real enforcement lives in the Firestore security rules.
export const ALLOWED_EMAIL_DOMAIN = import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN as string | undefined;

// Without real config, fall back to well-formed placeholder values so the SDK can still be
// constructed without throwing at import time — the app renders its "not configured" screen
// instead of a blank crash, and nothing here ever gets used for a real network call because
// every auth/data call site is gated behind `firebaseConfigured`.
const firebaseConfig = firebaseConfigured
  ? rawConfig
  : {
      apiKey: "demo-api-key",
      authDomain: "demo.firebaseapp.com",
      projectId: "demo-project",
      storageBucket: "demo-project.appspot.com",
      messagingSenderId: "0",
      appId: "1:0:web:0",
    };

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
if (firebaseConfigured) {
  void setPersistence(auth, browserLocalPersistence);
}

export const googleProvider = new GoogleAuthProvider();
if (ALLOWED_EMAIL_DOMAIN) {
  googleProvider.setCustomParameters({ hd: ALLOWED_EMAIL_DOMAIN });
}

// Offline-first: Firestore caches everything locally (IndexedDB) and syncs automatically
// once back online, so counting keeps working with a bad or absent signal in the depósito.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
