// app/dashboard/buscar/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useUser } from '../layout';
import { useRouter } from 'next/navigation';
import type { Proyecto, PrioridadProyecto } from '@/model/proyectModel';
import ProjectPreviewModal from '@/components/ProjectPreviewModal';

type EstadoProyecto = 'activo' | 'pausado' | 'completado' | 'cancelado';
type ModoAcceso = 'privado' | 'solicitud' | 'publico';

type PreviewModoAcceso = 'publico' | 'invitacion' | 'privado';

type PreviewProyecto = {
  id: number;
  nombre: string;
  descripcion: string | null;
  prioridad: 'baja' | 'media' | 'alta' | 'critica';
  visibilidad: 'privado' | 'publico' | null;
  modo_acceso: PreviewModoAcceso;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  tiempo_estimado_minutos: number | null;
  codigo_union: string | null;
  creador_id: string;
  creado_en: string;
  actualizado_en: string;
};

type PreviewMeta = {
  totalMiembros: number;
  esMiembro: boolean;
  canJoinDirect: boolean;
  canRequestInvite: boolean;
  puedeVerTareas: boolean;
};

type PreviewResponse = {
  proyecto: PreviewProyecto;
  meta: PreviewMeta;
  tareas?: any[];
  estadisticasTareas?: {
    total: number;
    todo: number;
    'in-progress': number;
    completed: number;
    porcentajeCompletado: number;
  } | null;
};

export default function ProyectosPage() {
  const user = useUser();
  const router = useRouter();

  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [busqueda, setBusqueda] = useState('');
  const [filtroPrioridad, setFiltroPrioridad] = useState<PrioridadProyecto | 'todas'>('todas');
  const [filtroEstado, setFiltroEstado] = useState<EstadoProyecto | 'todos'>('todos');
  const [showFilters, setShowFilters] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [previewProjectId, setPreviewProjectId] = useState<number | null>(null);

  useEffect(() => {
    const fetchProyectos = async () => {
      try {
        const currentUserId = user?.id ? String(user.id) : null;
        if (!currentUserId) {
          setLoading(false);
          return;
        }

        const res = await fetch('/api/proyectos/buscar?page=1&limit=50', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || (data?.ok !== undefined && !data.ok)) {
          throw new Error(data?.error || 'No se pudieron cargar los proyectos');
        }

        const lista = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.proyectos)
          ? data.proyectos
          : [];

        const filtrados = lista.filter((p: any) => {
          const creadorId = String(p.creador_id ?? '');
          const vis = String(p.visibilidad ?? '').toLowerCase();

          if (creadorId === currentUserId) return false;
          if (vis === 'privado') return false;

          return true;
        });

        setProyectos(filtrados as Proyecto[]);
        setError('');
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Error cargando proyectos');
        setProyectos([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProyectos();
  }, [user?.id]);

  const fetchPreview = useCallback(async (proyectoId: number) => {
    setPreviewLoading(true);
    setPreviewError(null);

    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/preview`, {
        method: 'GET',
        credentials: 'include',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || (data?.ok !== undefined && !data.ok)) {
        throw new Error(data?.error || 'No se pudo cargar el preview');
      }

      const preview = (data?.data ?? data) as PreviewResponse;
      setPreviewData(preview);
    } catch (e) {
      setPreviewData(null);
      setPreviewError(e instanceof Error ? e.message : 'Error al cargar preview');
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const openPreview = useCallback(
    (proyectoId: number) => {
      setPreviewProjectId(proyectoId);
      setPreviewOpen(true);
      void fetchPreview(proyectoId);
    },
    [fetchPreview]
  );

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    setPreviewProjectId(null);
    setPreviewData(null);
    setPreviewError(null);
    setPreviewLoading(false);
  }, []);

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
            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
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

  const proyectosFiltrados = useMemo(() => {
    const terminoBusqueda = busqueda.trim().toLowerCase();

    return proyectos.filter((proyecto: any) => {
      const coincideBusqueda =
        !terminoBusqueda ||
        proyecto.nombre.toLowerCase().includes(terminoBusqueda) ||
        (proyecto.codigo_union && proyecto.codigo_union.toLowerCase().includes(terminoBusqueda)) ||
        String(proyecto.id).includes(terminoBusqueda);

      if (!coincideBusqueda) return false;

      if (filtroPrioridad !== 'todas' && proyecto.prioridad !== filtroPrioridad) {
        return false;
      }

      const estadoProyecto = (proyecto.estado || 'activo') as EstadoProyecto;
      if (filtroEstado !== 'todos' && estadoProyecto !== filtroEstado) {
        return false;
      }

      return true;
    });
  }, [busqueda, filtroEstado, filtroPrioridad, proyectos]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center">
        <div className="relative">
          <div className="h-14 w-14 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin sm:h-16 sm:w-16" />
          <div className="mt-4 text-center text-sm text-gray-400 sm:text-base">
            Cargando proyectos...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <ProjectPreviewModal
        isOpen={previewOpen}
        proyecto={
          previewData?.proyecto
            ? {
                id: previewData.proyecto.id,
                nombre: previewData.proyecto.nombre,
                descripcion: previewData.proyecto.descripcion,
                prioridad: previewData.proyecto.prioridad,
                visibilidad:
                  (previewData.proyecto.visibilidad === 'publico' ? 'publico' : 'privado') as any,
                fecha_inicio: previewData.proyecto.fecha_inicio,
                fecha_fin: previewData.proyecto.fecha_fin,
                tiempo_estimado_minutos: previewData.proyecto.tiempo_estimado_minutos,
                codigo_union: previewData.proyecto.codigo_union,
                creador_id: previewData.proyecto.creador_id,
                creado_en: previewData.proyecto.creado_en,
                actualizado_en: previewData.proyecto.actualizado_en,
              }
            : null
        }
        miembros={[]}
        estadisticasTareas={previewData?.estadisticasTareas ?? null}
        onClose={closePreview}
        onNavigate={(ruta) => router.push(ruta)}
      />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-0 sm:gap-7 lg:gap-8">
        <section className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 p-4 shadow-xl backdrop-blur-sm sm:p-6 lg:p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5" />
          <div className="relative z-10">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-8 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-purple-500 to-blue-500 sm:h-9" />
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
                  Buscar Proyectos
                </h1>
                <p className="mt-2 text-sm text-gray-400 sm:text-base">
                  Encuentra proyectos públicos o únete mediante código
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <svg
                className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>

              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, código o ID del proyecto..."
                className="w-full rounded-xl border border-slate-700/50 bg-slate-900/40 py-3 pl-12 pr-11 text-sm text-white outline-none transition-all placeholder:text-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 sm:text-base"
              />

              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 transition-colors hover:text-white"
                  aria-label="Limpiar búsqueda"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                aria-expanded={showFilters}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 sm:px-5 sm:text-base ${
                  showFilters
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                    : 'border border-slate-700/50 bg-slate-900/40 text-gray-300 hover:bg-slate-800/50'
                }`}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
                Filtros
                {(filtroPrioridad !== 'todas' || filtroEstado !== 'todos') && (
                  <span className="h-2 w-2 rounded-full bg-purple-400" />
                )}
              </button>
            </div>
          </div>

          <div
            className={`overflow-hidden transition-all duration-500 ease-in-out ${
              showFilters ? 'mt-1 max-h-[32rem] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 backdrop-blur-sm sm:p-5 lg:p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <label className="mb-3 block text-sm font-medium text-gray-300">Prioridad</label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => setFiltroPrioridad('todas')}
                      className={`rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 sm:px-4 sm:text-sm ${
                        filtroPrioridad === 'todas'
                          ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                          : 'bg-slate-800/50 text-gray-400 hover:bg-slate-700/50'
                      }`}
                    >
                      Todas
                    </button>

                    {(['baja', 'media', 'alta', 'critica'] as PrioridadProyecto[]).map((p) => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setFiltroPrioridad(p)}
                        className={`rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 sm:px-4 sm:text-sm ${
                          filtroPrioridad === p
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
                  <label className="mb-3 block text-sm font-medium text-gray-300">Estado</label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => setFiltroEstado('todos')}
                      className={`rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 sm:px-4 sm:text-sm ${
                        filtroEstado === 'todos'
                          ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                          : 'bg-slate-800/50 text-gray-400 hover:bg-slate-700/50'
                      }`}
                    >
                      Todos
                    </button>

                    {(['activo', 'pausado', 'completado', 'cancelado'] as EstadoProyecto[]).map((e) => (
                      <button
                        type="button"
                        key={e}
                        onClick={() => setFiltroEstado(e)}
                        className={`rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 sm:px-4 sm:text-sm ${
                          filtroEstado === e
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                            : 'bg-slate-800/50 text-gray-400 hover:bg-slate-700/50'
                        }`}
                      >
                        {e.charAt(0).toUpperCase() + e.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {(filtroPrioridad !== 'todas' || filtroEstado !== 'todos') && (
                <div className="mt-4 border-t border-slate-700/50 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setFiltroPrioridad('todas');
                      setFiltroEstado('todos');
                    }}
                    className="inline-flex items-center gap-2 text-sm text-purple-400 transition-colors hover:text-purple-300"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Limpiar filtros
                  </button>
                </div>
              )}
            </div>
          </div>

          {(busqueda || filtroPrioridad !== 'todas' || filtroEstado !== 'todos') && (
            <div className="flex flex-col gap-2 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between sm:text-sm">
              <span>
                Mostrando {proyectosFiltrados.length} de {proyectos.length} proyecto
                {proyectos.length !== 1 ? 's' : ''}
              </span>

              <button
                type="button"
                onClick={() => {
                  setBusqueda('');
                  setFiltroPrioridad('todas');
                  setFiltroEstado('todos');
                }}
                className="self-start text-purple-400 transition-colors hover:text-purple-300 sm:self-auto"
              >
                Limpiar todo
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
        </section>

        {proyectosFiltrados.length === 0 ? (
          <section className="py-14 text-center sm:py-16 lg:py-20">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-800/50 sm:h-20 sm:w-20">
              <svg className="h-8 w-8 text-gray-500 sm:h-10 sm:w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {busqueda || filtroPrioridad !== 'todas' || filtroEstado !== 'todos' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                )}
              </svg>
            </div>

            <h3 className="mb-2 text-lg font-semibold text-gray-300 sm:text-xl">
              {busqueda || filtroPrioridad !== 'todas' || filtroEstado !== 'todos'
                ? 'No se encontraron proyectos'
                : 'No hay proyectos aún'}
            </h3>

            <p className="mx-auto max-w-md text-sm text-gray-500 sm:text-base">
              {busqueda || filtroPrioridad !== 'todas' || filtroEstado !== 'todos'
                ? 'Intenta ajustar los filtros de búsqueda'
                : 'Crea tu primer proyecto para comenzar'}
            </p>
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
            {proyectosFiltrados.map((proyecto: any, index) => {
              const diasRestantes = calcularDiasRestantes(proyecto.fecha_fin);

              return (
                <button
                  key={proyecto.id}
                  type="button"
                  onClick={() => openPreview(Number(proyecto.id))}
                  className="group block h-full text-left"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div
                    className={`relative flex h-full min-h-[280px] flex-col overflow-hidden rounded-2xl border bg-gradient-to-br ${getPrioridadColor(
                      proyecto.prioridad
                    )} p-4 shadow-lg backdrop-blur-xl transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-2xl sm:min-h-[300px] sm:p-5 lg:p-6`}
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold sm:px-3 sm:text-[11px] ${getPrioridadBadge(
                            proyecto.prioridad
                          )}`}
                        >
                          {proyecto.prioridad.toUpperCase()}
                        </span>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold sm:px-3 sm:text-[11px] ${getEstadoColor(
                            proyecto.estado || 'activo'
                          )}`}
                        >
                          {(proyecto.estado || 'activo').toUpperCase()}
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-gray-400">
                          {getModoAccesoIcon((proyecto.modo_acceso as ModoAcceso) || 'privado')}
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

                    <h3 className="mb-3 line-clamp-2 text-lg font-bold text-white transition-colors group-hover:text-purple-300 sm:text-xl">
                      {proyecto.nombre}
                    </h3>

                    {proyecto.descripcion ? (
                      <p className="mb-4 line-clamp-3 flex-grow text-sm text-gray-400">
                        {proyecto.descripcion}
                      </p>
                    ) : (
                      <div className="mb-4 flex-grow" />
                    )}

                    {diasRestantes !== null && (
                      <div className="mb-4">
                        <div
                          className={`text-xs font-medium sm:text-sm ${
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

                    <div className="mt-auto flex flex-col gap-2 border-t border-white/5 pt-4 text-[11px] text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:text-xs">
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
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
                        <span className="font-mono text-[11px] text-purple-400 sm:text-xs">
                          #{String(proyecto.codigo_union).slice(0, 6)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </section>
        )}

        {previewOpen && (previewLoading || previewError) && (
          <div className="mt-2">
            {previewLoading && (
              <div className="text-xs text-gray-400 sm:text-sm">
                Cargando preview...
              </div>
            )}
            {previewError && (
              <div className="text-xs text-red-400 sm:text-sm">{previewError}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}