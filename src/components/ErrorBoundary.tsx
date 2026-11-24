import { Component, ReactNode } from 'react';
import { Notice } from './ui';

interface State {
  error: Error | null;
}

/** Impede que a falha de um módulo derrube a aplicação inteira. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // Ao trocar de página, um erro anterior não deve continuar bloqueando a tela.
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  componentDidCatch(error: Error) {
    console.error('[MOLECULAB]', error);
  }

  render() {
    if (this.state.error) {
      return (
        <Notice kind="error" title="Este módulo encontrou um erro">
          <p style={{ margin: '4px 0 10px' }}>{this.state.error.message}</p>
          <button className="btn btn-sm" onClick={() => this.setState({ error: null })}>
            Tentar novamente
          </button>
        </Notice>
      );
    }
    return this.props.children;
  }
}
