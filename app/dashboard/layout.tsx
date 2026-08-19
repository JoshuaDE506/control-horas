// app/dashboard/layout.tsx
// app/dashboard/layout.tsx
'use client';

import {
  useState,
  useEffect,
  createContext,
  useContext,
  useMemo,
  useRef,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import type { User as UserModel } from '@/model/userModel';

type RolSistema = 'jefe' | 'admin' | 'colaborador';

type User = Pick<UserModel, 'id' | 'nombre' | 'email'> & {
  rol: RolSistema;
};

const UserContext = createContext<User | null>(null);

export function useUser() {
  const ctx = useContext(UserContext);

  if (!ctx) {
    throw new Error(
      'useUser debe usarse dentro de <UserContext.Provider>'
    );
  }

  return ctx;
}

type MenuItem = {
  name: string;
  href: string;
  visible: boolean;
  icon: React.ReactNode;
};

function normalizarRol(rawRol: unknown): RolSistema {
  const raw = String(rawRol ?? '')
    .toLowerCase()
    .trim();

  if (raw === 'jefe' || raw.startsWith('jefe')) {
    return 'jefe';
  }

  if (
    raw === 'admin' ||
    raw === 'administrador' ||
    raw.startsWith('admin')
  ) {
    return 'admin';
  }

  return 'colaborador';
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const userMenuRef = useRef<HTMLDivElement | null>(null);

  /**
   * =======================================================
   * CARGAR USUARIO AUTENTICADO
   * =======================================================
   */

  useEffect(() => {
    let isMounted = true;

    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || data?.ok !== true || !data?.data) {
          if (isMounted) {
            setUser(null);
            router.replace('/login');
          }

          return;
        }

        if (!isMounted) {
          return;
        }

        setUser({
          id: String(data.data.id ?? ''),
          nombre: String(data.data.nombre ?? ''),
          email: String(data.data.email ?? ''),
          rol: normalizarRol(data.data.rol),
        });
      } catch (error) {
        console.error('Error obteniendo usuario:', error);

        if (isMounted) {
          setUser(null);
          router.replace('/login');
        }
      } finally {
        if (isMounted) {
          setLoadingUser(false);
        }
      }
    };

    fetchUser();

    return () => {
      isMounted = false;
    };
  }, [router]);

  /**
   * =======================================================
   * SIDEBAR RESPONSIVO
   * =======================================================
   */

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }

      setUserMenuOpen(false);
    };

    handleResize();

    window.addEventListener('resize', handleResize);

    return () =>
      window.removeEventListener('resize', handleResize);
  }, []);

  /**
   * =======================================================
   * CERRAR MENÚ AL CAMBIAR DE RUTA
   * =======================================================
   */

  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }

    setUserMenuOpen(false);
  }, [pathname]);

  /**
   * =======================================================
   * CLICK FUERA DEL MENÚ DE USUARIO
   * =======================================================
   */

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!userMenuRef.current) {
        return;
      }

      if (
        !userMenuRef.current.contains(
          event.target as Node
        )
      ) {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener(
        'mousedown',
        handleClickOutside
      );
    }

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      );
    };
  }, [userMenuOpen]);

  /**
   * =======================================================
   * ESCAPE
   * =======================================================
   */

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
        setUserMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () =>
      window.removeEventListener('keydown', handleEscape);
  }, []);

  /**
   * =======================================================
   * LOGOUT
   * =======================================================
   */

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        console.error(
          'El servidor no pudo cerrar la sesión correctamente'
        );
      }
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      /**
       * Se mantiene el comportamiento actual:
       * limpiar información local al cerrar sesión.
       */
      localStorage.clear();
      sessionStorage.clear();

      setUser(null);

      router.replace('/login');
      router.refresh();
    }
  };

  /**
   * =======================================================
   * PERMISOS DEL MENÚ
   * =======================================================
   */

  const esAdminOJefe =
    user?.rol === 'admin' ||
    user?.rol === 'jefe';

  const menuItems: MenuItem[] = useMemo(
    () =>
      [
        {
          name: 'Inicio',
          href: '/dashboard',
          visible: true,
          icon: (
            <svg
              className="h-5 w-5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9.75L12 3l9 6.75V20a1 1 0 01-1 1h-5.5a.5.5 0 01-.5-.5V15a2 2 0 00-2-2h-2a2 2 0 00-2 2v5.5a.5.5 0 01-.5.5H4a1 1 0 01-1-1V9.75z"
              />
            </svg>
          ),
        },
        {
          name: 'Perfil',
          href: '/dashboard/perfil',
          visible: true,
          icon: (
            <svg
              className="h-5 w-5 shrink-0"
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
          ),
        },
        {
          name: 'Mis proyectos',
          href: '/dashboard/proyectos',
          visible: true,
          icon: (
            <svg
              className="h-5 w-5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
          ),
        },
        {
          name: 'Buscar Proyectos',
          href: '/dashboard/buscar',
          visible: true,
          icon: (
            <svg
              className="h-5 w-5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          ),
        },
        {
          name: 'Reportes',
          href: '/dashboard/reportes',
          visible: !!esAdminOJefe,
          icon: (
            <svg
              className="h-5 w-5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17v-4m4 4V7m4 10v-6M5 19h14a1 1 0 001-1V6a1 1 0 00-1-1H5a1 1 0 00-1 1v12a1 1 0 001 1z"
              />
            </svg>
          ),
        },
        {
          name: 'Lista colaboradores',
          href: '/dashboard/colaboradores',
          visible: !!esAdminOJefe,
          icon: (
            <svg
              className="h-5 w-5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M13 7a4 4 0 11-8 0 4 4 0 018 0zM19 8v3m0 0v3m0-3h3m-3 0h-3"
              />
            </svg>
          ),
        },
        {
          name: 'Registro Jornada',
          href: '/dashboard/jornada',
          visible: !!esAdminOJefe,
          icon: (
            <svg
              className="h-5 w-5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                strokeWidth={2}
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 7v5l3 3"
              />
            </svg>
          ),
        },
      ].filter((item) => item.visible),
    [esAdminOJefe]
  );

  /**
   * =======================================================
   * CARGA
   * =======================================================
   */

  if (loadingUser || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 px-6 text-center text-white">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 backdrop-blur">
          <p className="text-sm sm:text-base">
            Cargando usuario...
          </p>
        </div>
      </div>
    );
  }

  return (
    <UserContext.Provider value={user}>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed left-0 top-0 z-40 h-screen w-[280px] max-w-[85vw] transform transition-transform duration-300 ease-in-out lg:w-72 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0`}
        >
          <div className="flex h-full flex-col border-r border-white/10 bg-gradient-to-b from-indigo-900/90 to-purple-900/90 backdrop-blur-xl shadow-2xl">
            <div className="border-b border-white/10 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 shadow-lg">
                  <svg
                    className="h-6 w-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>

                <div className="min-w-0">
                  <h1 className="truncate text-lg font-bold text-white">
                    Dashboard
                  </h1>

                  <p className="text-xs text-cyan-300">
                    Panel de control
                  </p>

                  <p className="mt-0.5 truncate text-[10px] text-gray-400">
                    ID: {user.id}
                  </p>
                </div>
              </div>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {menuItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' &&
                    pathname.startsWith(`${item.href}/`));

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30'
                        : 'text-gray-300 hover:bg-white/10 hover:text-white'
                    }`}
                    onClick={() => {
                      if (window.innerWidth < 1024) {
                        setSidebarOpen(false);
                      }
                    }}
                  >
                    <span
                      className={`transition-transform duration-200 ${
                        isActive
                          ? 'scale-110'
                          : 'group-hover:scale-110'
                      }`}
                    >
                      {item.icon}
                    </span>

                    <span className="truncate text-sm font-medium">
                      {item.name}
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-white/10 p-3">
              <button
                onClick={handleLogout}
                className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-red-300 transition-all duration-200 hover:bg-red-500/20 hover:text-red-200"
              >
                <svg
                  className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>

                <span className="text-sm font-medium">
                  Cerrar Sesión
                </span>
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen flex-col lg:ml-72">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-gradient-to-r from-slate-800/95 to-slate-900/95 shadow-lg backdrop-blur-xl">
            <div className="px-4 py-3 sm:px-5 lg:px-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    onClick={() =>
                      setSidebarOpen((prev) => !prev)
                    }
                    className="shrink-0 rounded-lg bg-white/5 p-2 text-gray-300 transition-all duration-200 hover:bg-white/10 hover:text-white lg:hidden"
                    aria-label="Abrir menú"
                    type="button"
                  >
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
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    </svg>
                  </button>

                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold text-white sm:text-lg lg:text-xl">
                      Bienvenido, {user.nombre}
                    </h2>

                    <p className="hidden truncate text-xs text-gray-400 sm:block sm:text-sm">
                      Gestiona tu trabajo eficientemente
                    </p>
                  </div>
                </div>

                <div
                  className="relative shrink-0"
                  ref={userMenuRef}
                >
                  <button
                    onClick={() =>
                      setUserMenuOpen((prev) => !prev)
                    }
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-2 transition-all duration-200 hover:bg-white/10 sm:px-3"
                    type="button"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 shadow-lg">
                      <span className="text-xs font-bold text-white">
                        {user.nombre.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    <div className="hidden max-w-[150px] text-left sm:block">
                      <p className="truncate text-sm font-medium text-white">
                        {user.nombre}
                      </p>

                      <p className="truncate text-xs text-gray-400">
                        {user.email}
                      </p>
                    </div>

                    <svg
                      className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
                        userMenuOpen ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-slate-800/95 shadow-2xl backdrop-blur-xl animate-dropdown">
                      <div className="border-b border-white/10 p-4">
                        <p className="text-sm font-medium text-white">
                          Mi Cuenta
                        </p>

                        <p className="mt-1 truncate text-xs text-gray-400">
                          {user.email}
                        </p>

                        <p className="mt-0.5 text-[10px] text-gray-500">
                          ID: {user.id}
                        </p>
                      </div>

                      <div className="p-2">
                        <Link
                          href="/dashboard/perfil"
                          className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-300 transition-all duration-200 hover:bg-white/10 hover:text-white"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <svg
                            className="h-4 w-4 shrink-0"
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

                          <span className="text-sm">
                            Ver Perfil
                          </span>
                        </Link>
                      </div>

                      <div className="border-t border-white/10 p-2">
                        <button
                          onClick={handleLogout}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-red-400 transition-all duration-200 hover:bg-red-500/20 hover:text-red-300"
                          type="button"
                        >
                          <svg
                            className="h-4 w-4 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                            />
                          </svg>

                          <span className="text-sm">
                            Cerrar Sesión
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-5 lg:p-6">
            <div className="mx-auto w-full max-w-7xl">
              {children}
            </div>
          </main>
        </div>

        <style jsx>{`
          @keyframes dropdown {
            from {
              opacity: 0;
              transform: translateY(-8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .animate-dropdown {
            animation: dropdown 0.15s ease-out;
          }
        `}</style>
      </div>
    </UserContext.Provider>
  );
}