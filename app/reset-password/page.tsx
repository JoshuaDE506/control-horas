// app/reset-password/page.tsx
'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ResetUser {
  email: string;
  nombre: string;
  apellido: string;
  code: string;
}

function isValidPassword(password: string): boolean {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=\[\]{};':"\\|,.<>/?]).{8,}$/.test(
    password
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedField, setFocusedField] = useState('');
  const [userInfo, setUserInfo] = useState<ResetUser>({
    email: '',
    nombre: '',
    apellido: '',
    code: '',
  });
  const [loadingUserInfo, setLoadingUserInfo] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem('resetUser');

    if (!stored) {
      router.replace('/forgot-password');
      return;
    }

    try {
      const user = JSON.parse(stored) as Partial<ResetUser>;

      if (!user.email || !user.code) {
        sessionStorage.removeItem('resetUser');
        sessionStorage.removeItem('resetEmail');
        router.replace('/forgot-password');
        return;
      }

      setUserInfo({
        email: String(user.email).trim().toLowerCase(),
        nombre: String(user.nombre ?? '').trim(),
        apellido: String(user.apellido ?? '').trim(),
        code: String(user.code).trim(),
      });
    } catch (error) {
      console.error('Error leyendo resetUser:', error);

      sessionStorage.removeItem('resetUser');
      sessionStorage.removeItem('resetEmail');

      router.replace('/forgot-password');
      return;
    } finally {
      setLoadingUserInfo(false);
    }
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (loading) return;

    if (!userInfo.email || !userInfo.code) {
      setError('Sesión de recuperación inválida. Intenta de nuevo.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (!isValidPassword(newPassword)) {
      setError(
        'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un símbolo.'
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({
          email: userInfo.email,
          code: userInfo.code,
          newPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.ok !== true) {
        const message =
          typeof data?.error === 'string'
            ? data.error
            : 'Error al cambiar la contraseña';

        setError(message);
        return;
      }

      sessionStorage.removeItem('resetUser');
      sessionStorage.removeItem('resetEmail');

      router.replace('/login?passwordChanged=true');
    } catch (err) {
      console.error('Error:', err);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = () => {
    if (newPassword.length === 0) {
      return { strength: 0, text: '', color: '' };
    }

    let strength = 0;

    if (newPassword.length >= 8) strength++;
    if (newPassword.length >= 12) strength++;
    if (/[A-Z]/.test(newPassword)) strength++;
    if (/[a-z]/.test(newPassword)) strength++;
    if (/\d/.test(newPassword)) strength++;
    if (/[!@#$%^&*()_\-+=\[\]{};':"\\|,.<>/?]/.test(newPassword)) {
      strength++;
    }

    if (strength <= 2) {
      return { strength: 33, text: 'Débil', color: 'bg-red-500' };
    }

    if (strength <= 4) {
      return { strength: 66, text: 'Media', color: 'bg-yellow-500' };
    }

    return { strength: 100, text: 'Fuerte', color: 'bg-green-500' };
  };

  const passwordStrength = getPasswordStrength();

  if (loadingUserInfo) {
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
          <p className="text-white text-lg">Cargando información...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-violet-900 via-purple-900 to-fuchsia-900">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-10 left-20 w-96 h-96 bg-violet-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse-drift"></div>
        <div className="absolute top-1/3 right-20 w-96 h-96 bg-fuchsia-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse-drift animation-delay-2000"></div>
        <div className="absolute bottom-20 left-1/3 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse-drift animation-delay-4000"></div>
      </div>

      <div className="absolute inset-0 bg-dot-pattern opacity-10"></div>

      <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
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
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                </div>

                <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
                  Nueva Contraseña
                </h1>
                <p className="text-violet-200 text-base leading-relaxed max-w-md mx-auto">
                  Crea una contraseña segura para tu cuenta
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-white/10">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-violet-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  Información de la cuenta
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <svg
                        className="w-4 h-4 text-violet-400"
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
                      <span className="text-xs text-violet-300 font-medium">
                        Correo
                      </span>
                    </div>
                    <p className="text-white font-semibold text-sm break-all">
                      {userInfo.email}
                    </p>
                  </div>

                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <svg
                        className="w-4 h-4 text-violet-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="text-xs text-violet-300 font-medium">
                        Nombre
                      </span>
                    </div>
                    <p className="text-white font-semibold text-sm">
                      {userInfo.nombre}
                    </p>
                  </div>

                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <svg
                        className="w-4 h-4 text-violet-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="text-xs text-violet-300 font-medium">
                        Apellido
                      </span>
                    </div>
                    <p className="text-white font-semibold text-sm">
                      {userInfo.apellido}
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
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
                    htmlFor="newPassword"
                    className="block text-sm font-semibold text-violet-200"
                  >
                    Nueva Contraseña
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
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    </div>

                    <input
                      id="newPassword"
                      name="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      onFocus={() => setFocusedField('newPassword')}
                      onBlur={() => setFocusedField('')}
                      disabled={loading}
                      className={`w-full pl-14 pr-14 py-5 bg-white/5 border-2 rounded-2xl text-white text-lg placeholder-violet-300/40 transition-all duration-300 focus:outline-none focus:bg-white/10 disabled:opacity-50 ${
                        focusedField === 'newPassword'
                          ? 'border-violet-400 shadow-2xl shadow-violet-500/40 scale-[1.02]'
                          : 'border-white/20 hover:border-white/30'
                      }`}
                      placeholder="••••••••"
                    />

                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-5 flex items-center text-violet-400 hover:text-violet-300 transition-all duration-300 hover:scale-110"
                    >
                      {showNewPassword ? (
                        <svg
                          className="h-6 w-6"
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
                          className="h-6 w-6"
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
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>

                  {newPassword.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-violet-300">
                          Fortaleza de la contraseña
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            passwordStrength.strength === 100
                              ? 'text-green-400'
                              : passwordStrength.strength === 66
                              ? 'text-yellow-400'
                              : 'text-red-400'
                          }`}
                        >
                          {passwordStrength.text}
                        </span>
                      </div>

                      <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full ${passwordStrength.color} transition-all duration-500 rounded-full`}
                          style={{
                            width: `${passwordStrength.strength}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-violet-300/70 mt-2 pl-1">
                    Mínimo 8 caracteres con mayúsculas, minúsculas, números y símbolos
                  </p>
                </div>

                <div className="space-y-3">
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-semibold text-violet-200"
                  >
                    Confirmar Nueva Contraseña
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
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>

                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onFocus={() => setFocusedField('confirmPassword')}
                      onBlur={() => setFocusedField('')}
                      disabled={loading}
                      className={`w-full pl-14 pr-14 py-5 bg-white/5 border-2 rounded-2xl text-white text-lg placeholder-violet-300/40 transition-all duration-300 focus:outline-none focus:bg-white/10 disabled:opacity-50 ${
                        focusedField === 'confirmPassword'
                          ? 'border-violet-400 shadow-2xl shadow-violet-500/40 scale-[1.02]'
                          : 'border-white/20 hover:border-white/30'
                      }`}
                      placeholder="••••••••"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute inset-y-0 right-0 pr-5 flex items-center text-violet-400 hover:text-violet-300 transition-all duration-300 hover:scale-110"
                    >
                      {showConfirmPassword ? (
                        <svg
                          className="h-6 w-6"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29M7.532 17.412l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="h-6 w-6"
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
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>

                  {confirmPassword.length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      {newPassword === confirmPassword ? (
                        <>
                          <svg
                            className="w-5 h-5 text-green-400"
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

                          <span className="text-sm text-green-400 font-medium">
                            Las contraseñas coinciden
                          </span>
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-5 h-5 text-red-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>

                          <span className="text-sm text-red-400 font-medium">
                            Las contraseñas no coinciden
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-violet-300/70 mt-2 pl-1">
                    Ingresa la misma contraseña para confirmar
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={
                    loading ||
                    newPassword !== confirmPassword ||
                    !isValidPassword(newPassword)
                  }
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

                        <span>Actualizando contraseña...</span>
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

                        <span>Cambiar Contraseña</span>
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
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>

                  <div className="leading-relaxed">
                    <p className="font-semibold text-violet-200 mb-1">
                      Consejos de seguridad:
                    </p>

                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>No uses contraseñas anteriores</li>
                      <li>Evita información personal (nombres, fechas)</li>
                      <li>Usa una combinación única de caracteres</li>
                      <li>Considera usar un gestor de contraseñas</li>
                    </ul>
                  </div>
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