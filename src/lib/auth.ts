import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { ALLOWED_EMAIL_DOMAIN, auth, firebaseConfigured, googleProvider } from "./firebase";

// undefined = still resolving; null = signed out; User = signed in.
export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(firebaseConfigured ? undefined : null);
  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(auth, setUser);
  }, []);
  return user;
}

// Set by AuthGate once the signed-in user is confirmed to belong to the allowed domain,
// so the rest of the app can read "who's logged in" without re-deriving auth state.
export const CurrentUserContext = createContext<User | null>(null);

export function useCurrentUser(): User | null {
  return useContext(CurrentUserContext);
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  if (!ALLOWED_EMAIL_DOMAIN) return true;
  return email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN.toLowerCase()}`);
}

export function signIn() {
  return signInWithPopup(auth, googleProvider);
}

export function signOutUser() {
  return signOut(auth);
}
