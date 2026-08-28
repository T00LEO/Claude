import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erro inesperado no app", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="auth-screen">
          <h1>Algo deu errado</h1>
          <p>Recarregue a página. Se o problema continuar, avise quem cuida do app.</p>
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
