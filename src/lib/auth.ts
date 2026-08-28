import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { ALLOWED_EMAIL_DOMAIN, auth, db, firebaseConfigured, googleProvider } from "./firebase";

// undefined = still resolving; null = signed out; User = signed in.
export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(firebaseConfigured ? undefined : null);
  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(auth, setUser);
  }, []);
  return user;
}

// Set by AuthGate once the signed-in user is confirmed to have access, so the rest of the
// app can read "who's logged in" without re-deriving auth state.
export const CurrentUserContext = createContext<User | null>(null);

export function useCurrentUser(): User | null {
  return useContext(CurrentUserContext);
}

export function isAllowedByDomain(email: string | null | undefined): boolean {
  if (!email) return false;
  if (!ALLOWED_EMAIL_DOMAIN) return true;
  return email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN.toLowerCase()}`);
}

// Domain accounts get in immediately; anyone else needs an entry in the allowedEmails
// collection (managed from the Produtos tab) — this is the one check that needs a network
// round-trip, since it's the only part not decidable from the token alone.
export async function isAllowed(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  if (isAllowedByDomain(email)) return true;
  if (!firebaseConfigured) return false;
  try {
    const snap = await getDoc(doc(db, "allowedEmails", email.toLowerCase()));
    return snap.exists();
  } catch {
    return false;
  }
}

export function signIn() {
  return signInWithPopup(auth, googleProvider);
}

export function signOutUser() {
  return signOut(auth);
}
