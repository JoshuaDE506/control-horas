//app/verify-code/page.tsx
'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VerifyCodePage() {
  const router = useRouter();

  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [focusedField, setFocusedField] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(true);

  useEffect(() => {
    const savedEmail = sessionStorage.getItem('resetEmail');

    if (!savedEmail) {
      router.replace('/forgot-password');
      return;
    }

    setEmail(savedEmail);
    setLoadingEmail(false);
  }, [router]);

  const handleCodeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.error || 'Código inválido o expirado');
        return;
      }

      sessionStorage.setItem(
        'resetUser',
        JSON.stringify({
          ...(data.data ?? {}),
          code,
        })
      );

      router.push('/reset-password');
    } catch (err) {
      console.error('Error de red al verificar código:', err);
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setSuccess('');
    setResending(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.error || 'Error al reenviar el código');
        return;
      }

      setSuccess(
        data.message || 'Si el correo existe, se generó un nuevo código.'
      );
      setCode('');
    } catch (err) {
      console.error('Error al reenviar código:', err);
      setError('Error de conexión con el servidor');
    } finally {
      setResending(false);
    }
  };

  if (loadingEmail) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-violet-900 via-purple-900 to-fuchsia-900 flex items-center justify-center">
        <div className="text-center">
          <svg
            className="animate-spin h-12 w-12 text-white mx-auto mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-white text-lg">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-violet-900 via-purple-900 to-fuchsia-900">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-10 left-20 w-96 h-96 bg-violet-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse-drift" />
        <div className="absolute top-1/3 right-20 w-96 h-96 bg-fuchsia-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse-drift animation-delay-2000" />
        <div className="absolute bottom-20 left-1/3 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse-drift animation-delay-4000" />
      </div>

      <div className="absolute inset-0 bg-dot-pattern opacity-10" />

      <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <button
            type="button"
            onClick={() => router.push('/forgot-password')}
            className="mb-8 flex items-center gap-2 text-violet-200 hover:text-white transition-colors duration-300 group animate-slide-in-left"
          >
            <svg
              className="w-5 h-5 transition-transform group-hover:-translate-x-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="font-medium">Volver</span>
          </button>

          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-purple-500 rounded-3xl blur-lg opacity-30 animate-pulse-glow" />

            <div className="relative bg-white/10 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 p-10 animate-scale-in">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-violet-400 to-fuchsia-500 rounded-full mb-6 shadow-2xl shadow-violet-500/50 animate-bounce-subtle">
                  <svg
                    className="w-10 h-10 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                </div>

                <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
                  Ingresa el Código
                </h1>

                <p className="text-violet-200 text-base leading-relaxed max-w-md mx-auto">
                  Hemos enviado un código de 6 dígitos a
                </p>

                <p className="text-white font-semibold text-lg mt-2 break-all">
                  {email}
                </p>
              </div>

              <form onSubmit={handleCodeSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-500/20 border border-red-400/50 rounded-xl p-4 animate-shake backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <svg
                        className="w-5 h-5 text-red-300 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-sm text-red-200 font-medium">
                        {error}
                      </span>
                    </div>
                  </div>
                )}

                {success && (
                  <div className="bg-emerald-500/20 border border-emerald-400/50 rounded-xl p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <svg
                        className="w-5 h-5 text-emerald-300 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.172 7.707 8.879a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-sm text-emerald-200 font-medium">
                        {success}
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <label
                    htmlFor="code"
                    className="block text-sm font-semibold text-violet-200"
                  >
                    Código de Verificación
                  </label>

                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-all duration-300 group-hover:scale-110">
                      <svg
                        className="h-6 w-6 text-violet-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                        />
                      </svg>
                    </div>

                    <input
                      id="code"
                      name="code"
                      type="text"
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      required
                      maxLength={6}
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, ''))
                      }
                      onFocus={() => setFocusedField(true)}
                      onBlur={() => setFocusedField(false)}
                      disabled={loading || resending}
                      className={`w-full pl-14 pr-5 py-5 bg-white/5 border-2 rounded-2xl text-white text-lg placeholder-violet-300/40 transition-all duration-300 focus:outline-none focus:bg-white/10 disabled:opacity-50 tracking-widest text-center ${
                        focusedField
                          ? 'border-violet-400 shadow-2xl shadow-violet-500/40 scale-[1.02]'
                          : 'border-white/20 hover:border-white/30'
                      }`}
                      placeholder="000000"
                    />
                  </div>

                  <p className="text-xs text-violet-300/70 mt-2 pl-1">
                    Ingresa el código de 6 dígitos que recibiste
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || resending || code.length !== 6}
                  className="group relative w-full py-5 px-6 border border-transparent rounded-2xl text-white font-bold text-lg bg-gradient-to-r from-violet-500 via-fuchsia-500 to-purple-500 hover:from-violet-600 hover:via-fuchsia-600 hover:to-purple-600 focus:outline-none focus:ring-4 focus:ring-violet-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-violet-500/50 overflow-hidden mt-8"
                >
                  <span className="absolute inset-0 w-full h-full">
                    <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  </span>

                  <span className="relative flex items-center justify-center gap-3">
                    {loading ? (
                      <>
                        <svg
                          className="animate-spin h-6 w-6"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        <span>Verificando...</span>
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-6 h-6"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>Verificar Código</span>
                      </>
                    )}
                  </span>
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-violet-200/80 mb-3">
                  ¿No recibiste el código?
                </p>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading || resending}
                  className="text-violet-300 hover:text-white font-medium underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resending ? 'Reenviando...' : 'Reenviar código'}
                </button>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10">
                <div className="flex items-start gap-3 text-sm text-violet-200/80">
                  <svg
                    className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="leading-relaxed">
                    Este código expirará en 15 minutos por razones de seguridad.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-8 text-center text-sm text-violet-200/60">
            © 2024 Tu Empresa. Todos los derechos reservados.
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse-drift {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
            opacity: 0.2;
          }
          33% {
            transform: translate(40px, -40px) scale(1.1);
            opacity: 0.3;
          }
          66% {
            transform: translate(-30px, 30px) scale(0.9);
            opacity: 0.15;
          }
        }

        @keyframes pulse-glow {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.02);
          }
        }

        @keyframes scale-in {
          0% {
            opacity: 0;
            transform: scale(0.95);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes slide-in-left {
          0% {
            opacity: 0;
            transform: translateX(-20px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes bounce-subtle {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          10%,
          30%,
          50%,
          70%,
          90% {
            transform: translateX(-8px);
          }
          20%,
          40%,
          60%,
          80% {
            transform: translateX(8px);
          }
        }

        .animate-pulse-drift {
          animation: pulse-drift 10s ease-in-out infinite;
        }

        .animate-pulse-glow {
          animation: pulse-glow 4s ease-in-out infinite;
        }

        .animate-scale-in {
          animation: scale-in 0.5s ease-out;
        }

        .animate-slide-in-left {
          animation: slide-in-left 0.5s ease-out;
        }

        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }

        .animate-shake {
          animation: shake 0.5s;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }

        .bg-dot-pattern {
          background-image: radial-gradient(
            circle,
            rgba(255, 255, 255, 0.1) 1px,
            transparent 1px
          );
          background-size: 20px 20px;
        }
      `}</style>
    </div>
  );
}