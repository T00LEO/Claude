import { useEffect, useState, type ReactNode } from "react";
import { CurrentUserContext, isAllowed, signIn, signOutUser, useAuthUser } from "../lib/auth";
import { firebaseConfigured } from "../lib/firebase";

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
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setAllowed(null);
      return;
    }
    let cancelled = false;
    setAllowed(null);
    isAllowed(user.email).then((ok) => {
      if (!cancelled) setAllowed(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

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
        <p>Entre com sua conta Google para continuar.</p>
        <button type="button" className="btn-primary" onClick={() => signIn()}>
          Entrar com Google
        </button>
      </Screen>
    );
  }

  if (allowed === null) {
    return (
      <Screen>
        <p className="hint">Verificando acesso...</p>
      </Screen>
    );
  }

  if (!allowed) {
    return (
      <Screen>
        <p>
          A conta <strong>{user.email}</strong> não tem acesso a este app.
        </p>
        <p className="hint">Peça pra alguém da empresa liberar seu e-mail e tente entrar de novo.</p>
        <button type="button" className="btn-secondary" onClick={() => signOutUser()}>
          Sair e tentar outra conta
        </button>
      </Screen>
    );
  }

  return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>;
}
