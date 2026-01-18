'use client';

import React from 'react';

interface ErrorFallbackProps {
    error: Error;
    resetErrorBoundary: () => void;
    title?: string;
    message?: string;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({
    error,
    resetErrorBoundary,
    title = "Ops! Algo deu errado",
    message = "Ocorreu um erro inesperado nesta seção do sistema."
}) => {
    return (
        <div className="flex flex-col items-center justify-center p-8 bg-white/80 backdrop-blur-md rounded-2xl border-2 border-red-200 shadow-xl overflow-hidden animate-fadeIn max-w-md mx-auto my-8 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <span className="text-4xl text-red-600">⚠️</span>
            </div>

            <h2 className="text-2xl font-bold text-slate-800 mb-2">{title}</h2>
            <p className="text-slate-600 mb-6">{message}</p>

            <div className="w-full bg-slate-50 rounded-xl p-4 mb-8 text-left border border-slate-200">
                <p className="text-xs font-mono text-red-500 overflow-auto max-h-32">
                    {error.message}
                </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button
                    onClick={resetErrorBoundary}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-indigo-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                    <span>🔄</span> Tentar novamente
                </button>
                <button
                    onClick={() => window.location.reload()}
                    className="flex-1 bg-slate-200 text-slate-700 font-bold py-3 px-6 rounded-xl hover:bg-slate-300 transition-all active:scale-95"
                >
                    Recarregar página
                </button>
            </div>
        </div>
    );
};

export default ErrorFallback;
