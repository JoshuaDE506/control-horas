// app/register/page.tsx
'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import CountrySelect from '@/components/country/countrySelect';
import CountryComboBox from '@/components/country/countryComboBox';
import { countries } from '@/lib/countries';

const isValidPassword = (password: string) => {
  const regex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=\[\]{};':"\\|,.<>/?]).{8,}$/;

  return regex.test(password);
};

export default function RegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    telefono: '',
    paisIso: '',
    phonepaisIso: '',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const selectedpais = countries.find(
    (c) => c.pais === formData.paisIso
  );

  const selectedPhonepais = countries.find(
    (c) => c.pais === formData.phonepaisIso
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    router.push('/login');
    router.refresh();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (loading) {
      return;
    }

    setError('');

    const nombre = formData.nombre.trim();
    const apellido = formData.apellido.trim();
    const email = formData.email.trim().toLowerCase();
    const telefono = formData.telefono.trim();

    if (!nombre) {
      setError('El nombre es obligatorio.');
      return;
    }

    if (!apellido) {
      setError('El apellido es obligatorio.');
      return;
    }

    if (!email) {
      setError('El correo electrónico es obligatorio.');
      return;
    }

    if (!formData.paisIso) {
      setError('Debes seleccionar tu país de residencia.');
      return;
    }

    if (!selectedpais) {
      setError('El país de residencia no es válido.');
      return;
    }

    if (!isValidPassword(formData.password)) {
      setError(
        'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un símbolo.'
      );
      return;
    }

    if (telefono !== '') {
      if (telefono.length < 7) {
        setError('El número de teléfono parece incompleto.');
        return;
      }

      if (!formData.phonepaisIso) {
        setError(
          'Si ingresas un número de teléfono, debes seleccionar el código de país.'
        );
        return;
      }

      if (!selectedPhonepais) {
        setError('Código de país para teléfono no es válido.');
        return;
      }
    }

    let phoneFull: string | null = null;

    if (telefono !== '' && selectedPhonepais) {
      phoneFull = `${selectedPhonepais.code}${telefono}`;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({
          nombre,
          apellido,
          email,
          password: formData.password,
          pais: formData.paisIso,
          telefono_completo: phoneFull,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.ok !== true) {
        setError(
          typeof data?.error === 'string'
            ? data.error
            : 'Error al registrar usuario'
        );

        return;
      }

      setSuccessMessage(
        typeof data?.message === 'string'
          ? data.message
          : 'Cuenta registrada exitosamente. Activación pendiente por un administrador.'
      );

      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error registrando usuario:', error);
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>

        <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>

        <div className="relative w-full max-w-2xl">
          <div className="text-center mb-6 animate-fade-in-down">
            <div className="inline-block p-2.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl mb-3 shadow-lg shadow-purple-500/50">
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
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
            </div>

            <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">
              Crear Cuenta
            </h1>

            <p className="text-purple-200 text-sm">
              Únete a nuestra comunidad hoy
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-6 animate-fade-in-up">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 animate-shake">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-red-300 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>

                    <span className="text-xs text-red-200">{error}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="nombre"
                      className="block text-xs font-medium text-purple-200"
                    >
                      Nombre
                    </label>

                    <input
                      id="nombre"
                      name="nombre"
                      type="text"
                      required
                      value={formData.nombre}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('nombre')}
                      onBlur={() => setFocusedField('')}
                      disabled={loading}
                      className={`w-full px-3 py-2.5 bg-white/5 border-2 rounded-xl text-white text-sm placeholder-purple-300/50 transition-all duration-300 focus:outline-none focus:bg-white/10 disabled:opacity-50 ${
                        focusedField === 'nombre'
                          ? 'border-purple-400 shadow-lg shadow-purple-500/50'
                          : 'border-white/20'
                      }`}
                      placeholder="Juan"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="email"
                      className="block text-xs font-medium text-purple-200"
                    >
                      Correo Electrónico
                    </label>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg
                          className="h-4 w-4 text-purple-300"
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
                        value={formData.email}
                        onChange={handleChange}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField('')}
                        disabled={loading}
                        className={`w-full pl-10 pr-3 py-2.5 bg-white/5 border-2 rounded-xl text-white text-sm placeholder-purple-300/50 transition-all duration-300 focus:outline-none focus:bg-white/10 disabled:opacity-50 ${
                          focusedField === 'email'
                            ? 'border-purple-400 shadow-lg shadow-purple-500/50'
                            : 'border-white/20'
                        }`}
                        placeholder="tu@ejemplo.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="pais"
                      className="block text-xs font-medium text-purple-200"
                    >
                      País de Residencia
                    </label>

                    <CountrySelect
                      value={formData.paisIso}
                      onChange={(iso) =>
                        setFormData({
                          ...formData,
                          paisIso: iso,
                        })
                      }
                      disabled={loading}
                      placeholder="¿Dónde vives?"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="password"
                      className="block text-xs font-medium text-purple-200"
                    >
                      Contraseña
                    </label>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg
                          className="h-4 w-4 text-purple-300"
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
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        value={formData.password}
                        onChange={handleChange}
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => setFocusedField('')}
                        disabled={loading}
                        className={`w-full pl-10 pr-10 py-2.5 bg-white/5 border-2 rounded-xl text-white text-sm placeholder-purple-300/50 transition-all duration-300 focus:outline-none focus:bg-white/10 disabled:opacity-50 ${
                          focusedField === 'password'
                            ? 'border-purple-400 shadow-lg shadow-purple-500/50'
                            : 'border-white/20'
                        }`}
                        placeholder="••••••••"
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-purple-300 hover:text-purple-200 transition-colors"
                      >
                        {showPassword ? (
                          <svg
                            className="h-4 w-4"
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
                            className="h-4 w-4"
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

                    <p className="text-xs text-purple-300/70 mt-1">
                      Min. 8 caracteres, mayúscula, minúscula, número y símbolo
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="apellido"
                      className="block text-xs font-medium text-purple-200"
                    >
                      Apellido
                    </label>

                    <input
                      id="apellido"
                      name="apellido"
                      type="text"
                      required
                      value={formData.apellido}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('apellido')}
                      onBlur={() => setFocusedField('')}
                      disabled={loading}
                      className={`w-full px-3 py-2.5 bg-white/5 border-2 rounded-xl text-white text-sm placeholder-purple-300/50 transition-all duration-300 focus:outline-none focus:bg-white/10 disabled:opacity-50 ${
                        focusedField === 'apellido'
                          ? 'border-purple-400 shadow-lg shadow-purple-500/50'
                          : 'border-white/20'
                      }`}
                      placeholder="Pérez"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="telefono"
                      className="block text-xs font-medium text-purple-200"
                    >
                      Número de Teléfono (opcional)
                    </label>

                    <div className="flex gap-2">
                      <CountryComboBox
                        value={formData.phonepaisIso}
                        onChange={(iso) =>
                          setFormData({
                            ...formData,
                            phonepaisIso: iso,
                          })
                        }
                        disabled={loading}
                      />

                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg
                            className="h-4 w-4 text-purple-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                            />
                          </svg>
                        </div>

                        <input
                          id="telefono"
                          name="telefono"
                          type="tel"
                          value={formData.telefono}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '');

                            setFormData({
                              ...formData,
                              telefono: value,
                            });
                          }}
                          onFocus={() => setFocusedField('telefono')}
                          onBlur={() => setFocusedField('')}
                          disabled={loading}
                          className={`w-full pl-10 pr-3 py-2.5 bg-white/5 border-2 rounded-xl text-white text-sm placeholder-purple-300/50 transition-all duration-300 focus:outline-none focus:bg-white/10 disabled:opacity-50 ${
                            focusedField === 'telefono'
                              ? 'border-purple-400 shadow-lg shadow-purple-500/50'
                              : 'border-white/20'
                          }`}
                          placeholder="88888888"
                        />
                      </div>
                    </div>

                    {selectedPhonepais && formData.telefono && (
                      <p className="text-xs text-purple-300/70 mt-1">
                        {selectedPhonepais.code} {formData.telefono}
                      </p>
                    )}
                  </div>

                  <div className="lg:h-[88px]"></div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group relative w-full py-3 px-4 border border-transparent rounded-xl text-white font-medium bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] hover:shadow-2xl hover:shadow-purple-500/50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5"
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

                    Registrando...
                  </span>
                ) : (
                  'Crear Cuenta'
                )}
              </button>

              <div className="text-center pt-2">
                <span className="text-sm text-purple-200">
                  ¿Ya tienes cuenta?{' '}
                </span>

                <a
                  href="/login"
                  className="text-sm text-purple-300 hover:text-purple-200 font-medium transition-colors"
                >
                  Inicia sesión →
                </a>
              </div>
            </form>
          </div>

          <p className="mt-4 text-center text-xs text-purple-300/70 animate-fade-in">
            Al registrarte, aceptas nuestros Términos y Condiciones
          </p>
        </div>

        <style jsx>{`
          @keyframes blob {
            0%,
            100% {
              transform: translate(0, 0) scale(1);
            }
            33% {
              transform: translate(30px, -50px) scale(1.1);
            }
            66% {
              transform: translate(-20px, 20px) scale(0.9);
            }
          }
          .animate-blob {
            animation: blob 7s infinite;
          }
          .animation-delay-2000 {
            animation-delay: 2s;
          }
          .animation-delay-4000 {
            animation-delay: 4s;
          }

          @keyframes fade-in-down {
            0% {
              opacity: 0;
              transform: translateY(-20px);
            }
            100% {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes fade-in-up {
            0% {
              opacity: 0;
              transform: translateY(20px);
            }
            100% {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes fade-in {
            0% {
              opacity: 0;
            }
            100% {
              opacity: 1;
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
              transform: translateX(-5px);
            }
            20%,
            40%,
            60%,
            80% {
              transform: translateX(5px);
            }
          }

          .animate-fade-in-down {
            animation: fade-in-down 0.6s ease-out;
          }
          .animate-fade-in-up {
            animation: fade-in-up 0.6s ease-out 0.2s both;
          }
          .animate-fade-in {
            animation: fade-in 0.8s ease-out 0.4s both;
          }
          .animate-shake {
            animation: shake 0.5s;
          }

          .bg-grid-pattern {
            background-image: linear-gradient(
                to right,
                rgba(255, 255, 255, 0.1) 1px,
                transparent 1px
              ),
              linear-gradient(
                to bottom,
                rgba(255, 255, 255, 0.1) 1px,
                transparent 1px
              );
            background-size: 40px 40px;
          }
        `}</style>
      </div>

      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-slate-900/95 shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="p-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20">
                <svg
                  className="h-8 w-8 text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>

              <h2 className="text-center text-xl font-bold text-white mb-3">
                Registro completado
              </h2>

              <p className="text-center text-sm text-slate-300 leading-relaxed">
                {successMessage}
              </p>
            </div>

            <div className="border-t border-white/10 p-4">
              <button
                type="button"
                onClick={handleSuccessClose}
                className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-3 text-white font-medium transition-all duration-300 hover:from-purple-600 hover:to-pink-600"
              >
                Ir al login
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}