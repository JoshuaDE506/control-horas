// app/dashboard/proyectos/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useUser } from '../layout';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Proyecto, PrioridadProyecto } from '@/model/proyectModel';

type EstadoProyecto = 'activo' | 'pausado' | 'completado' | 'cancelado';
type ModoAcceso = 'privado' | 'solicitud' | 'publico';
type Vista = 'mios' | 'miembro';
type PermisoProyecto = 'owner' | 'owner_admin' | 'all_members';
type VisibilidadProyecto = 'privado' | 'publico';

type UsuarioBusqueda = {
  id: number | string;
  nombre: string;
  apellido?: string;
  email: string;
  pais?: string;
};

export default function ProyectosPage() {
  const user = useUser();
  const router = useRouter();

  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [prioridad, setPrioridad] = useState<PrioridadProyecto>('media');

  const [modoAcceso, setModoAcceso] = useState<ModoAcceso>('privado');
  const [visibilidad, setVisibilidad] = useState<VisibilidadProyecto>('privado');

  const [permisoEdicion, setPermisoEdicion] = useState<PermisoProyecto>('owner');
  const [permisoGestionTareas, setPermisoGestionTareas] =
    useState<PermisoProyecto>('owner_admin');

  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [busquedaMiembro, setBusquedaMiembro] = useState('');
  const [usuariosEncontrados, setUsuariosEncontrados] = useState<UsuarioBusqueda[]>([]);
  const [miembrosSeleccionados, setMiembrosSeleccionados] = useState<UsuarioBusqueda[]>([]);
  const [buscandoUsuarios, setBuscandoUsuarios] = useState(false);

  const [vista, setVista] = useState<Vista>('mios');

  const dedupeById = (items: any[]) => {
    const map = new Map<string, any>();
    for (const it of items) {
      const id = String(it?.id ?? '');
      if (!id) continue;
      map.set(id, it);
    }
    return Array.from(map.values());
  };

  useEffect(() => {
    if (modoAcceso === 'publico' && visibilidad !== 'publico') {
      setVisibilidad('publico');
    }
  }, [modoAcceso, visibilidad]);

  const fetchProyectos = async (scope: 'creados' | 'miembro') => {
    try {
      setLoading(true);
      setError('');

      const res = await fetch(`/api/proyectos?scope=${scope}`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'No se pudieron cargar los proyectos');
      }

      const lista = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.proyectos)
        ? data.proyectos
        : [];

      setProyectos(dedupeById(lista));
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error cargando proyectos');
      setProyectos([]);
    } finally {
      setLoading(false);
    }
  };

  const buscarUsuarios = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setUsuariosEncontrados([]);
      return;
    }

    try {
      setBuscandoUsuarios(true);

      const res = await fetch(`/api/user/buscar?q=${encodeURIComponent(query)}`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Error al buscar usuarios');
      }

      const lista = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.usuarios)
        ? data.usuarios
        : [];

      const usuariosFiltrados = lista.filter(
        (u: UsuarioBusqueda) =>
          String(u.id) !== String(user?.id) &&
          !miembrosSeleccionados.some((m) => String(m.id) === String(u.id))
      );

      setUsuariosEncontrados(usuariosFiltrados);
    } catch (err: any) {
      console.error(err);
      setUsuariosEncontrados([]);
    } finally {
      setBuscandoUsuarios(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      buscarUsuarios(busquedaMiembro);
    }, 300);

    return () => clearTimeout(timer);
  }, [busquedaMiembro, miembrosSeleccionados, user?.id]);

  useEffect(() => {
    fetchProyectos('creados');
  }, []);

  useEffect(() => {
    if (vista === 'mios') fetchProyectos('creados');
    if (vista === 'miembro') fetchProyectos('miembro');
  }, [vista]);

  const agregarMiembro = (usuario: UsuarioBusqueda) => {
    if (!miembrosSeleccionados.some((m) => String(m.id) === String(usuario.id))) {
      setMiembrosSeleccionados([...miembrosSeleccionados, usuario]);
      setBusquedaMiembro('');
      setUsuariosEncontrados([]);
    }
  };

  const removerMiembro = (usuarioId: string | number) => {
    setMiembrosSeleccionados((prev) => prev.filter((m) => String(m.id) !== String(usuarioId)));
  };

  const resetFormulario = () => {
    setNombre('');
    setDescripcion('');
    setPrioridad('media');
    setModoAcceso('privado');
    setVisibilidad('privado');
    setPermisoEdicion('owner');
    setPermisoGestionTareas('owner_admin');
    setFechaInicio('');
    setFechaFin('');
    setMiembrosSeleccionados([]);
    setBusquedaMiembro('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!nombre.trim()) {
      setError('El nombre del proyecto es obligatorio');
      return;
    }

    try {
      const res = await fetch('/api/proyectos', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          descripcion,
          prioridad,
          visibilidad,
          modo_acceso: modoAcceso,
          modoAcceso,
          permisoEdicion,
          permisoGestionTareas,
          fecha_inicio: fechaInicio || null,
          fecha_fin: fechaFin || null,
          miembros: miembrosSeleccionados.map((m) => String(m.id)),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Error al crear proyecto');
      }

      resetFormulario();
      setShowForm(false);
      setVista('mios');
      fetchProyectos('creados');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al crear proyecto');
    }
  };

  const getPrioridadColor = (prioridad: string) => {
    const colors = {
      baja: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
      media: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30',
      alta: 'from-orange-500/20 to-orange-600/20 border-orange-500/30',
      critica: 'from-red-500/20 to-red-600/20 border-red-500/30',
    };
    return colors[prioridad as keyof typeof colors] || colors.media;
  };

  const getPrioridadBadge = (prioridad: string) => {
    const badges = {
      baja: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      media: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
      alta: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
      critica: 'bg-red-500/10 text-red-400 border-red-500/30',
    };
    return badges[prioridad as keyof typeof badges] || badges.media;
  };

  const getEstadoColor = (estado: string) => {
    const colors = {
      activo: 'bg-green-500/10 text-green-400 border-green-500/30',
      pausado: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
      completado: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      cancelado: 'bg-red-500/10 text-red-400 border-red-500/30',
    };
    return colors[estado as keyof typeof colors] || colors.activo;
  };

  const getModoAccesoIcon = (modo: ModoAcceso | string): React.ReactNode => {
    const icons: Record<ModoAcceso, React.ReactNode> = {
      privado: (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2V7a3 3 0 00-6 0v2h6z"
            clipRule="evenodd"
          />
        </svg>
      ),
      solicitud: (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
        </svg>
      ),
      publico: (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z"
            clipRule="evenodd"
          />
        </svg>
      ),
    };

    const valor = (modo as ModoAcceso) || 'privado';
    return icons[valor] ?? icons.privado;
  };

  const calcularDiasRestantes = (fechaFin?: string | null) => {
    if (!fechaFin) return null;
    const hoy = new Date();
    const fin = new Date(fechaFin);
    const diff = Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getAccesoProyecto = (p: any): ModoAcceso => {
    const raw = (p?.modo_acceso ?? p?.modoAcceso ?? p?.visibilidad ?? 'privado')
      ?.toString()
      ?.toLowerCase();

    if (raw === 'publico' || raw === 'solicitud' || raw === 'privado') {
      return raw as ModoAcceso;
    }

    return 'privado';
  };

  const proyectosVista = useMemo(() => dedupeById(proyectos as any[]), [proyectos]);

  const permisoLabel: Record<PermisoProyecto, string> = {
    owner: 'Solo dueño',
    owner_admin: 'Dueño y admins',
    all_members: 'Todos los miembros',
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
        <div className="relative">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-purple-500/20 border-t-purple-500" />
          <div className="mt-4 text-center text-gray-400">Cargando proyectos...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-10">
      <div className="mx-auto mb-6 max-w-7xl sm:mb-8">
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 p-4 shadow-xl backdrop-blur-sm sm:p-6 lg:p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5" />
          <div className="relative z-10">
            <div className="mb-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-7 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-purple-500 to-blue-500 sm:h-8" />
                  <h1 className="text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
                    {vista === 'mios' ? 'Mis Proyectos' : 'Proyectos donde soy miembro'}
                  </h1>
                </div>

                <p className="mt-2 ml-[18px] text-sm text-gray-400 sm:ml-[22px]">
                  Bienvenido, <span className="font-medium text-purple-400">{user?.nombre}</span>
                </p>

                {vista === 'mios' && (
                  <div className="mt-4 ml-[18px] flex flex-wrap items-center gap-4 text-sm sm:ml-[22px] sm:gap-6">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-400" />
                      <span className="text-gray-300">
                        {
                          proyectosVista.filter((p: any) => (p.estado || 'activo') === 'activo')
                            .length
                        }
                      </span>
                      <span className="text-gray-500">Activos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-400" />
                      <span className="text-gray-300">
                        {proyectosVista.filter((p: any) => p.estado === 'completado').length}
                      </span>
                      <span className="text-gray-500">Completados</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="w-full overflow-x-auto lg:w-auto">
                <div className="flex w-max min-w-full items-center gap-2 lg:min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setVista('mios');
                      setShowForm(false);
                    }}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                      vista === 'mios'
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                        : 'border border-slate-700/50 bg-slate-900/40 text-gray-300 backdrop-blur-sm hover:bg-slate-800/50'
                    }`}
                  >
                    Mis proyectos
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setVista('miembro');
                      setShowForm(false);
                    }}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                      vista === 'miembro'
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                        : 'border border-slate-700/50 bg-slate-900/40 text-gray-300 backdrop-blur-sm hover:bg-slate-800/50'
                    }`}
                  >
                    Soy miembro
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl">
        {vista === 'mios' && (
          <div className="mb-6 flex justify-stretch sm:mb-8 sm:justify-end">
            <button
              onClick={() => setShowForm(!showForm)}
              className="group relative w-full rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-3 font-medium text-white shadow-lg transition-all duration-300 hover:scale-[1.01] hover:shadow-xl sm:w-auto sm:hover:scale-105"
            >
              <span className="flex items-center justify-center gap-2">
                <svg
                  className={`h-5 w-5 transition-transform duration-300 ${
                    showForm ? 'rotate-45' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {showForm ? 'Cancelar' : 'Nuevo Proyecto'}
              </span>
            </button>
          </div>
        )}

        {vista === 'mios' && (
          <div
            className={`overflow-hidden transition-all duration-500 ease-in-out ${
              showForm ? 'mb-8 max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <form
              onSubmit={handleCreate}
              className="rounded-2xl border border-slate-700/50 bg-slate-900/40 p-4 shadow-xl backdrop-blur-sm sm:p-6 lg:p-8"
            >
              <div className="mb-6 flex items-center gap-3">
                <div className="h-6 w-1 rounded-full bg-gradient-to-b from-purple-500 to-blue-500" />
                <h2 className="text-xl font-bold text-white sm:text-2xl">Crear Nuevo Proyecto</h2>
              </div>

              {error && (
                <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Nombre del proyecto *
                  </label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej: Control de Horas"
                    className="w-full rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-3 text-white outline-none transition-all placeholder:text-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Descripción
                  </label>
                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Describe el proyecto..."
                    rows={4}
                    className="w-full resize-none rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-3 text-white outline-none transition-all placeholder:text-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>

                <div>
                  <label className="mb-3 block text-sm font-medium text-gray-300">
                    Prioridad
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['baja', 'media', 'alta', 'critica'] as PrioridadProyecto[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPrioridad(p)}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                          prioridad === p
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                            : 'bg-slate-800/50 text-gray-400 hover:bg-slate-700/50'
                        }`}
                      >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-3 block text-sm font-medium text-gray-300">
                    Estado
                  </label>
                  <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-3 text-gray-300">
                    Activo (por defecto)
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Acceso al proyecto
                  </label>
                  <div className="relative">
                    <select
                      value={modoAcceso}
                      onChange={(e) => setModoAcceso(e.target.value as ModoAcceso)}
                      className="w-full appearance-none rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-3 text-white outline-none transition-all focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                    >
                      <option value="privado">Privado</option>
                      <option value="solicitud">Solicitud de aceptación</option>
                      <option value="publico">Público</option>
                    </select>
                    <svg
                      className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {modoAcceso === 'publico'
                      ? 'Cualquiera puede entrar directamente al proyecto.'
                      : modoAcceso === 'solicitud'
                      ? 'Los usuarios deben solicitar acceso y esperar aprobación.'
                      : 'Solo miembros invitados pueden entrar al proyecto.'}
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Visibilidad del proyecto
                  </label>
                  <div className="relative">
                    <select
                      value={visibilidad}
                      onChange={(e) => setVisibilidad(e.target.value as VisibilidadProyecto)}
                      className="w-full appearance-none rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-3 text-white outline-none transition-all focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                    >
                      <option value="privado">Privado</option>
                      <option value="publico">Público</option>
                    </select>
                    <svg
                      className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Define si el proyecto aparece visible para otros usuarios en el sistema.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <div className="rounded-2xl border border-slate-700/50 bg-slate-900/30 p-4 sm:p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="h-5 w-1 rounded-full bg-gradient-to-b from-purple-500 to-blue-500" />
                      <h3 className="text-lg font-semibold text-white">Permisos del proyecto</h3>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-300">
                          Quién puede editar el proyecto
                        </label>
                        <div className="relative">
                          <select
                            value={permisoEdicion}
                            onChange={(e) =>
                              setPermisoEdicion(e.target.value as PermisoProyecto)
                            }
                            className="w-full appearance-none rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-3 text-white outline-none transition-all focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                          >
                            <option value="owner">Solo dueño</option>
                            <option value="owner_admin">Dueño y admins</option>
                            <option value="all_members">Todos los miembros</option>
                          </select>
                          <svg
                            className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
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
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                          Controla quién puede modificar la configuración general del proyecto.
                        </p>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-300">
                          Quién puede gestionar tareas
                        </label>
                        <div className="relative">
                          <select
                            value={permisoGestionTareas}
                            onChange={(e) =>
                              setPermisoGestionTareas(e.target.value as PermisoProyecto)
                            }
                            className="w-full appearance-none rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-3 text-white outline-none transition-all focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                          >
                            <option value="owner">Solo dueño</option>
                            <option value="owner_admin">Dueño y admins</option>
                            <option value="all_members">Todos los miembros</option>
                          </select>
                          <svg
                            className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
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
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                          Define quién puede crear, editar o administrar tareas dentro del proyecto.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-slate-700/50 bg-slate-950/40 px-4 py-3">
                        <p className="mb-1 text-xs text-gray-500">Edición del proyecto</p>
                        <p className="text-sm font-medium text-gray-200">
                          {permisoLabel[permisoEdicion]}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-700/50 bg-slate-950/40 px-4 py-3">
                        <p className="mb-1 text-xs text-gray-500">Gestión de tareas</p>
                        <p className="text-sm font-medium text-gray-200">
                          {permisoLabel[permisoGestionTareas]}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Fecha inicio
                  </label>
                  <input
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="w-full rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-3 text-white outline-none transition-all focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Fecha fin
                  </label>
                  <input
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    className="w-full rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-3 text-white outline-none transition-all focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  />
                  {fechaFin && (
                    <p className="mt-2 text-xs text-gray-500">
                      {(() => {
                        const dias = calcularDiasRestantes(fechaFin);
                        if (dias === null) return '';
                        if (dias < 0) return 'La fecha fin está en el pasado.';
                        if (dias === 0) return 'Vence hoy.';
                        return `${dias} día(s) restantes desde hoy.`;
                      })()}
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Añadir miembros
                  </label>

                  {miembrosSeleccionados.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {miembrosSeleccionados.map((m) => (
                        <div
                          key={String(m.id)}
                          className="flex max-w-full items-center gap-2 rounded-full border border-slate-700/50 bg-slate-800/50 px-3 py-1.5 text-gray-200"
                        >
                          <span className="max-w-[240px] truncate text-xs font-medium sm:max-w-none">
                            {m.nombre} {m.apellido || ''}{' '}
                            <span className="font-normal text-gray-400">({m.email})</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => removerMiembro(m.id)}
                            className="text-gray-400 transition-colors hover:text-white"
                            aria-label="Quitar miembro"
                          >
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="relative">
                    <input
                      type="text"
                      value={busquedaMiembro}
                      onChange={(e) => setBusquedaMiembro(e.target.value)}
                      placeholder="Buscar por nombre o correo (min. 2 caracteres)..."
                      className="w-full rounded-xl border border-slate-700/50 bg-slate-900/40 py-3 pl-11 pr-4 text-white outline-none transition-all placeholder:text-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                    />
                    <svg
                      className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
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

                    {(buscandoUsuarios || usuariosEncontrados.length > 0) &&
                      busquedaMiembro.trim().length >= 2 && (
                        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-700/50 bg-slate-950/95 shadow-2xl">
                          {buscandoUsuarios && (
                            <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-400">
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-500/20 border-t-purple-500" />
                              Buscando...
                            </div>
                          )}

                          {!buscandoUsuarios && usuariosEncontrados.length === 0 && (
                            <div className="px-4 py-3 text-sm text-gray-500">
                              No se encontraron usuarios.
                            </div>
                          )}

                          {!buscandoUsuarios &&
                            usuariosEncontrados.slice(0, 10).map((u) => (
                              <button
                                key={String(u.id)}
                                type="button"
                                onClick={() => agregarMiembro(u)}
                                className="w-full border-b border-slate-800/50 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-800/40"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-white">
                                      {u.nombre} {u.apellido || ''}
                                    </div>
                                    <div className="truncate text-xs text-gray-500">{u.email}</div>
                                  </div>
                                  <span className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-2 py-1 text-xs text-purple-300">
                                    Agregar
                                  </span>
                                </div>
                              </button>
                            ))}
                        </div>
                      )}
                  </div>

                  <p className="mt-2 text-xs text-gray-500">
                    Los miembros seleccionados se agregan al crear el proyecto.
                  </p>
                </div>
              </div>

              <div className="mt-8">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-3 font-semibold text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.01] sm:hover:scale-105"
                >
                  Crear Proyecto
                </button>
              </div>
            </form>
          </div>
        )}

        {proyectosVista.length === 0 ? (
          <div className="py-16 text-center sm:py-20">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-800/50">
              <svg
                className="h-10 w-10 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-semibold text-gray-300">
              {vista === 'mios' ? 'No hay proyectos aún' : 'No perteneces a ningún proyecto aún'}
            </h3>
            <p className="text-gray-500">
              {vista === 'mios'
                ? 'Crea tu primer proyecto para comenzar'
                : 'Cuando te agreguen como miembro, aparecerán aquí'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
            {proyectosVista.map((proyecto: any, index) => {
              const diasRestantes = calcularDiasRestantes(proyecto.fecha_fin);
              const idStr = String(proyecto.id);

              return (
                <Link
                  key={idStr}
                  href={`/dashboard/proyectos/${idStr}/tareas`}
                  className="group block"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div
                    className={`relative flex h-full flex-col overflow-hidden rounded-2xl border bg-gradient-to-br p-4 shadow-lg backdrop-blur-xl transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl sm:p-5 lg:p-6 ${getPrioridadColor(
                      proyecto.prioridad
                    )}`}
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getPrioridadBadge(
                            proyecto.prioridad
                          )}`}
                        >
                          {String(proyecto.prioridad || '').toUpperCase()}
                        </span>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getEstadoColor(
                            proyecto.estado || 'activo'
                          )}`}
                        >
                          {String(proyecto.estado || 'activo').toUpperCase()}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-gray-400">
                          {getModoAccesoIcon(getAccesoProyecto(proyecto))}
                        </span>
                        <svg
                          className="h-5 w-5 text-gray-400 transition-colors group-hover:text-purple-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>

                    <h3 className="mb-3 break-words text-lg font-bold text-white transition-colors group-hover:text-purple-300 sm:text-xl">
                      {proyecto.nombre}
                    </h3>

                    {proyecto.descripcion && (
                      <p className="mb-4 flex-grow break-words text-sm text-gray-400 line-clamp-3">
                        {proyecto.descripcion}
                      </p>
                    )}

                    {diasRestantes !== null && (
                      <div className="mb-4">
                        <div
                          className={`text-xs font-medium ${
                            diasRestantes < 0
                              ? 'text-red-400'
                              : diasRestantes <= 7
                              ? 'text-yellow-400'
                              : 'text-green-400'
                          }`}
                        >
                          {diasRestantes < 0
                            ? `Vencido hace ${Math.abs(diasRestantes)} días`
                            : diasRestantes === 0
                            ? '¡Vence hoy!'
                            : `${diasRestantes} días restantes`}
                        </div>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800/50">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              diasRestantes < 0
                                ? 'bg-red-500'
                                : diasRestantes <= 7
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                            }`}
                            style={{
                              width:
                                diasRestantes < 0
                                  ? '100%'
                                  : `${Math.min(100, (1 - diasRestantes / 30) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="mt-auto border-t border-white/5 pt-4">
                      <div className="flex flex-col gap-3 sm:gap-4">
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          <div className="flex items-center gap-2">
                            <svg
                              className="h-4 w-4 text-white"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                                clipRule="evenodd"
                              />
                            </svg>
                            {proyecto.creado_en && (
                              <span>
                                {new Date(proyecto.creado_en).toLocaleDateString('es-ES', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </span>
                            )}
                          </div>

                          {proyecto.codigo_union && (
                            <span className="font-mono text-purple-400">
                              #{String(proyecto.codigo_union).slice(0, 6)}
                            </span>
                          )}
                        </div>

                        <div className="flex">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              router.push(`/dashboard/proyectos/${idStr}/configuracion`);
                            }}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-600/60 bg-slate-900/60 px-2.5 py-2 text-[11px] text-gray-300 transition-all hover:border-purple-400/70 hover:bg-slate-800/80 hover:text-white sm:w-auto"
                          >
                            <svg
                              className="h-3.5 w-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10.325 4.317a1 1 0 011.35-.516l.39.195a1 1 0 00.894 0l.39-.195a1 1 0 011.35.516l.188.377a1 1 0 00.83.553l.417.03a1 1 0 01.924.924l.03.417a1 1 0 00.553.83l.377.188a1 1 0 01.516 1.35l-.195.39a1 1 0 000 .894l.195.39a1 1 0 01-.516 1.35l-.377.188a1 1 0 00-.553.83l-.03.417a1 1 0 01-.924.924l-.417.03a1 1 0 00-.83.553l-.188.377a1 1 0 01-1.35.516l-.39-.195a1 1 0 00-.894 0l-.39.195a1 1 0 01-1.35-.516l-.188-.377a1 1 0 00-.83-.553l-.417-.03a1 1 0 01-.924-.924l-.03-.417a1 1 0 00-.553-.83l-.377-.188a1 1 0 01-.516-1.35l.195-.39a1 1 0 000-.894l-.195-.39a1 1 0 01.516-1.35l.377-.188a1 1 0 00.553-.83l.03-.417a1 1 0 01.924-.924l.417-.03a1 1 0 00.83-.553l.188-.377z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                            </svg>
                            <span>Configurar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}