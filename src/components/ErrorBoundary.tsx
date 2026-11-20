import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || "Terjadi kesalahan yang tidak terduga.",
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[SynFit ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#08080d] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full rounded-3xl bg-white/5 border border-white/10 p-8 space-y-5 shadow-2xl">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-2xl">
              ⚠️
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-black uppercase tracking-wider">
                Terjadi Gangguan Aplikasi
              </h1>
              <p className="text-xs text-gray-400 leading-relaxed">
                {this.state.errorMessage}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-3 px-4 rounded-xl bg-[#FF5A2C] hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider transition-colors"
              >
                Muat Ulang
              </button>
              <button
                onClick={() => {
                  window.location.href = "/";
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Ke Beranda
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
