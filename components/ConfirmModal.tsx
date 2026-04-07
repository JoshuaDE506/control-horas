//components/ConfirmModal.tsx
'use client';

import { useEffect } from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'default' | 'danger' | 'success' | 'warning';
  isLoading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  type = 'default',
  isLoading = false,
}: ConfirmModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  const typeConfig = {
    default: {
      icon: (
        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-400',
      buttonClass: 'bg-gradient-to-r from-blue-600 to-cyan-600',
      buttonHover: 'hover:shadow-blue-500/40',
    },
    danger: {
      icon: (
        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
      iconBg: 'bg-red-500/10',
      iconColor: 'text-red-400',
      buttonClass: 'bg-gradient-to-r from-red-600 to-red-700',
      buttonHover: 'hover:shadow-red-500/40',
    },
    success: {
      icon: (
        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      iconBg: 'bg-green-500/10',
      iconColor: 'text-green-400',
      buttonClass: 'bg-gradient-to-r from-green-600 to-emerald-600',
      buttonHover: 'hover:shadow-green-500/40',
    },
    warning: {
      icon: (
        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      iconBg: 'bg-yellow-500/10',
      iconColor: 'text-yellow-400',
      buttonClass: 'bg-gradient-to-r from-yellow-600 to-orange-600',
      buttonHover: 'hover:shadow-yellow-500/40',
    },
  };

  const config = typeConfig[type];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={isLoading ? undefined : onCancel}
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl animate-scale-in max-h-[90vh] flex flex-col">
        <div className="flex items-start gap-3 sm:gap-4 p-4 sm:p-6 pb-4">
          <div
            className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full ${config.iconBg} flex items-center justify-center ${config.iconColor}`}
          >
            {config.icon}
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <h3 className="text-base sm:text-lg font-bold text-white mb-1 break-words leading-tight">
              {title}
            </h3>
            <p className="text-sm text-gray-400 break-words leading-6 max-h-[40vh] overflow-y-auto pr-1">
              {message}
            </p>
          </div>

          {!isLoading && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 flex items-center justify-center text-gray-400 hover:text-white transition-all"
              aria-label="Cerrar modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 p-4 sm:p-6 pt-4 border-t border-white/5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="w-full sm:flex-1 px-4 py-2.5 bg-slate-800/50 border border-white/10 rounded-xl text-gray-300 font-semibold hover:bg-slate-700/50 hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`w-full sm:flex-1 px-4 py-2.5 ${config.buttonClass} rounded-xl text-white font-semibold shadow-lg ${config.buttonHover} transition-all sm:hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 text-sm sm:text-base`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Procesando...</span>
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }

        .animate-scale-in {
          animation: scale-in 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}