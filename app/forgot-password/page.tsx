//app/forgot-password/page.tsx
'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(false);

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Debes ingresar tu correo electrónico.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.error || 'No se pudo enviar el código');
        return;
      }

      sessionStorage.setItem('resetEmail', normalizedEmail);
      sessionStorage.removeItem('resetUser');

      router.push('/verify-code');
    } catch (err) {
      console.error('Error de red:', err);
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-violet-900 via-purple-900 to-fuchsia-900">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-10 left-20 w-96 h-96 bg-violet-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse-drift"></div>
        <div className="absolute top-1/3 right-20 w-96 h-96 bg-fuchsia-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse-drift animation-delay-2000"></div>
        <div className="absolute bottom-20 left-1/3 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse-drift animation-delay-4000"></div>
      </div>

      <div className="absolute inset-0 bg-dot-pattern opacity-10"></div>

      <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <button
            type="button"
            onClick={() => router.push('/login')}
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
            <span className="font-medium">Volver al inicio de sesión</span>
          </button>

          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-purple-500 rounded-3xl blur-lg opacity-30 animate-pulse-glow"></div>

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
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>

                <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
                  ¿Olvidaste tu contraseña?
                </h1>
                <p className="text-violet-200 text-base leading-relaxed max-w-md mx-auto">
                  No te preocupes, te enviaremos un código de verificación a tu
                  correo electrónico
                </p>
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-6">
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

                <div className="space-y-3">
                  <label
                    htmlFor="email"
                    className="block text-sm font-semibold text-violet-200"
                  >
                    Correo Electrónico
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
                          d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                        />
                      </svg>
                    </div>

                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedField(true)}
                      onBlur={() => setFocusedField(false)}
                      disabled={loading}
                      className={`w-full pl-14 pr-5 py-5 bg-white/5 border-2 rounded-2xl text-white text-lg placeholder-violet-300/40 transition-all duration-300 focus:outline-none focus:bg-white/10 disabled:opacity-50 ${
                        focusedField
                          ? 'border-violet-400 shadow-2xl shadow-violet-500/40 scale-[1.02]'
                          : 'border-white/20 hover:border-white/30'
                      }`}
                      placeholder="correo@ejemplo.com"
                    />
                  </div>

                  <p className="text-xs text-violet-300/70 mt-2 pl-1">
                    Ingresa el correo asociado a tu cuenta
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full py-5 px-6 border border-transparent rounded-2xl text-white font-bold text-lg bg-gradient-to-r from-violet-500 via-fuchsia-500 to-purple-500 hover:from-violet-600 hover:via-fuchsia-600 hover:to-purple-600 focus:outline-none focus:ring-4 focus:ring-violet-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-violet-500/50 overflow-hidden mt-8"
                >
                  <span className="absolute inset-0 w-full h-full">
                    <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></span>
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
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        <span>Enviando código...</span>
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
                            d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76"
                          />
                        </svg>
                        <span>Enviar código</span>
                      </>
                    )}
                  </span>
                </button>
              </form>

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
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="leading-relaxed">
                    Recibirás un código de 6 dígitos válido por 15 minutos. Si
                    no recibes el correo, revisa tu carpeta de spam.
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