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

// Accounts from this domain get in automatically; anyone else needs an explicit entry in
// the allowedEmails collection (see lib/auth.ts). Enforced by the Firestore security rules,
// not by this constant — this is only used for client-side messaging.
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

// No `hd` (hosted domain) hint here on purpose: it would bias Google's account picker
// toward one domain, which gets in the way of the external emails on the allowlist.
export const googleProvider = new GoogleAuthProvider();

// Offline-first: Firestore caches everything locally (IndexedDB) and syncs automatically
// once back online, so counting keeps working with a bad or absent signal in the depósito.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
