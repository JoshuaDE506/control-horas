// app/login/page.tsx
'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (loading) {
      return;
    }

    setError('');

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError('Email y contraseña son obligatorios');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.ok !== true) {
        if (response.status === 403) {
          setError(
            data?.message ||
              data?.error ||
              'Tu cuenta está pendiente de activación. Contacta a un administrador.'
          );
        } else {
          setError(
            data?.message ||
              data?.error ||
              'Error al iniciar sesión'
          );
        }

        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      console.error('Error en login:', err);

      setError(
        'Error de conexión. Intenta de nuevo.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-indigo-900 via-blue-900 to-purple-900">
      {/* Fondo decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-48 h-48 sm:w-72 sm:h-72 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" />
        <div className="absolute top-40 right-10 w-48 h-48 sm:w-72 sm:h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float animation-delay-2000" />
        <div className="absolute -bottom-20 left-1/3 w-48 h-48 sm:w-72 sm:h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float animation-delay-4000" />
      </div>

      <div className="absolute inset-0 bg-diagonal-lines opacity-5 pointer-events-none" />

      <div className="relative min-h-screen flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-6 animate-slide-down">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl mb-4 shadow-2xl shadow-cyan-500/50 transform hover:rotate-12 transition-transform duration-300">
              <svg
                className="w-8 h-8 sm:w-10 sm:h-10 text-white"
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

            <h1 className="text-3xl sm:text-5xl font-bold text-white mb-2 tracking-tight">
              Bienvenido
            </h1>

            <p className="text-cyan-200 text-sm sm:text-base">
              Inicia sesión para continuar
            </p>
          </div>

          {/* Card */}
          <div className="relative">
            <div className="pointer-events-none absolute -inset-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-3xl blur opacity-25 animate-pulse-slow" />

            <div className="relative bg-white/10 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-8 animate-slide-up">
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-red-500/20 border border-red-400/50 rounded-xl p-3 sm:p-4 animate-shake backdrop-blur-sm">
                    <div className="flex items-start gap-3">
                      <svg
                        className="w-5 h-5 text-red-300 flex-shrink-0 mt-0.5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>

                      <span className="text-xs sm:text-sm text-red-200 font-medium leading-relaxed">
                        {error}
                      </span>
                    </div>
                  </div>
                )}

                {/* Email */}
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="block text-sm font-semibold text-cyan-200"
                  >
                    Correo Electrónico
                  </label>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg
                        className="h-5 w-5 text-cyan-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
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
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField('')}
                      disabled={loading}
                      className={`w-full pl-12 pr-4 py-3 bg-white/5 border-2 rounded-xl text-white text-sm placeholder-cyan-300/40 transition-all duration-300 focus:outline-none focus:bg-white/10 disabled:opacity-50 ${
                        focusedField === 'email'
                          ? 'border-cyan-400 shadow-lg shadow-cyan-500/30'
                          : 'border-white/20 hover:border-white/30'
                      }`}
                      placeholder="correo@ejemplo.com"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label
                    htmlFor="password"
                    className="block text-sm font-semibold text-cyan-200"
                  >
                    Contraseña
                  </label>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg
                        className="h-5 w-5 text-cyan-400"
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

                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField('')}
                      disabled={loading}
                      className={`w-full pl-12 pr-12 py-3 bg-white/5 border-2 rounded-xl text-white text-sm placeholder-cyan-300/40 transition-all duration-300 focus:outline-none focus:bg-white/10 disabled:opacity-50 ${
                        focusedField === 'password'
                          ? 'border-cyan-400 shadow-lg shadow-cyan-500/30'
                          : 'border-white/20 hover:border-white/30'
                      }`}
                      placeholder="••••••••"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      {showPassword ? (
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268-2.943 9.542-7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => router.push('/forgot-password')}
                    className="text-xs sm:text-sm text-cyan-300 hover:text-cyan-200 font-medium transition-colors hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full py-3 px-6 rounded-xl text-white font-bold text-base sm:text-lg bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 hover:from-cyan-600 hover:via-blue-600 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-cyan-500/40 overflow-hidden"
                >
                  <span className="relative flex items-center justify-center gap-2">
                    {loading ? (
                      <>
                        <svg
                          className="animate-spin h-5 w-5"
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

                        <span>Iniciando sesión...</span>
                      </>
                    ) : (
                      <>
                        <span>Iniciar Sesión</span>

                        <svg
                          className="h-5 w-5 transition-transform group-hover:translate-x-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 7l5 5m0 0l-5 5m5-5H6"
                          />
                        </svg>
                      </>
                    )}
                  </span>
                </button>
              </form>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20" />
                </div>

                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-transparent text-cyan-200 font-medium">
                    ¿No tienes cuenta?
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push('/register')}
                className="block w-full py-3 px-6 text-center border-2 border-cyan-400/50 rounded-xl text-cyan-300 hover:text-white font-bold bg-white/5 hover:bg-white/10 hover:border-cyan-400 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-cyan-500/20 text-sm sm:text-base"
              >
                Crear una cuenta nueva
              </button>
            </div>
          </div>

          <p className="mt-4 text-center text-xs sm:text-sm text-cyan-200/70 animate-fade-in">
            © 2024 Tu Empresa. Todos los derechos reservados.
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes float { 0%,100%{transform:translate(0,0) rotate(0deg)}33%{transform:translate(30px,-30px) rotate(5deg)}66%{transform:translate(-20px,20px) rotate(-5deg)} }
        @keyframes slide-down { 0%{opacity:0;transform:translateY(-30px)}100%{opacity:1;transform:translateY(0)} }
        @keyframes slide-up { 0%{opacity:0;transform:translateY(30px)}100%{opacity:1;transform:translateY(0)} }
        @keyframes fade-in { 0%{opacity:0}100%{opacity:1} }
        @keyframes shake { 0%,100%{transform:translateX(0)}10%,30%,50%,70%,90%{transform:translateX(-8px)}20%,40%,60%,80%{transform:translateX(8px)} }
        @keyframes pulse-slow { 0%,100%{opacity:0.25}50%{opacity:0.4} }
        .animate-float{animation:float 8s ease-in-out infinite}
        .animate-slide-down{animation:slide-down 0.6s ease-out}
        .animate-slide-up{animation:slide-up 0.6s ease-out 0.2s both}
        .animate-fade-in{animation:fade-in 0.8s ease-out 0.4s both}
        .animate-shake{animation:shake 0.5s}
        .animate-pulse-slow{animation:pulse-slow 3s ease-in-out infinite}
        .animation-delay-2000{animation-delay:2s}
        .animation-delay-4000{animation-delay:4s}
        .bg-diagonal-lines{background-image:repeating-linear-gradient(45deg,rgba(255,255,255,0.03) 0px,rgba(255,255,255,0.03) 2px,transparent 2px,transparent 10px)}
      `}</style>
    </div>
  );
}