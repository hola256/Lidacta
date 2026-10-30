import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, LogOut } from 'lucide-react';
import { safeString } from '../utils/safeError';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Lidacta ErrorBoundary] Uncaught render error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleLogout = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#2D1B4E] flex items-center justify-center p-4 text-white font-sans">
          <div className="max-w-md w-full bg-[#24153F] border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                Continuar con Lidacta
              </h1>
              <p className="text-xs sm:text-sm text-[#FFF7EF]/80 leading-relaxed">
                Detectamos un inconveniente al cargar esta sección. Tus datos están seguros en la base de datos central.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-black/40 border border-white/10 rounded-xl text-left text-xs font-mono text-rose-300 max-h-32 overflow-y-auto">
                {safeString(this.state.error, 'Error no especificado')}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-3 px-4 bg-[#F7B538] hover:bg-[#F7B538]/90 text-[#2D1B4E] font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                Recargar Aplicación
              </button>

              <button
                type="button"
                onClick={this.handleLogout}
                className="py-3 px-4 bg-white/10 hover:bg-white/15 text-white/90 font-medium rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all border border-white/15 active:scale-95"
              >
                <LogOut className="w-4 h-4" />
                Ir al Inicio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
