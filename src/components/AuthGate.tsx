import type { ReactNode } from "react";
import { CurrentUserContext, isAllowedEmail, signIn, signOutUser, useAuthUser } from "../lib/auth";
import { ALLOWED_EMAIL_DOMAIN, firebaseConfigured } from "../lib/firebase";

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="auth-screen">
      <img src={`${import.meta.env.BASE_URL}logo-dduck.png`} alt="DDuck" className="auth-logo" />
      {children}
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const user = useAuthUser();

  if (!firebaseConfigured) {
    return (
      <Screen>
        <p>
          O app ainda não foi configurado com um projeto Firebase. Preencha o arquivo{" "}
          <code>.env.local</code> com os dados do projeto (veja <code>.env.local.example</code>).
        </p>
      </Screen>
    );
  }

  if (user === undefined) {
    return (
      <Screen>
        <p className="hint">Carregando...</p>
      </Screen>
    );
  }

  if (user === null) {
    return (
      <Screen>
        <h1>Controle de Estoque</h1>
        <p>Entre com sua conta Google da empresa para continuar.</p>
        <button type="button" className="btn-primary" onClick={() => signIn()}>
          Entrar com Google
        </button>
      </Screen>
    );
  }

  if (!isAllowedEmail(user.email)) {
    return (
      <Screen>
        <p>
          A conta <strong>{user.email}</strong> não tem acesso a este app.
        </p>
        {ALLOWED_EMAIL_DOMAIN && <p className="hint">Entre com uma conta @{ALLOWED_EMAIL_DOMAIN}.</p>}
        <button type="button" className="btn-secondary" onClick={() => signOutUser()}>
          Sair e tentar outra conta
        </button>
      </Screen>
    );
  }

  return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>;
}
