// components/ProjectPreviewModal.tsx
'use client';

import { useEffect, useId, useMemo, useState } from 'react';

type Prioridad = 'baja' | 'media' | 'alta' | 'critica';
type Visibilidad = 'privado' | 'publico';
type ModoAcceso = 'publico' | 'solicitud' | 'privado';

interface CreadorPreview {
  nombre: string;
  apellido: string | null;
  email: string;
  pais: string | null;
}

interface Proyecto {
  id: number;
  nombre: string;
  descripcion: string | null;
  prioridad: Prioridad;
  visibilidad: Visibilidad | null;
  modo_acceso?: ModoAcceso | string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  tiempo_estimado_minutos?: number | null;
  codigo_union: string | null;
  creador_id: string;
  creador?: CreadorPreview | null;
  created_at: string | null;
  updated_at: string | null;
}

interface Miembro {
  id: string | number;
  nombre: string;
  apellido: string | null;
  email: string;
  rol: 'creador' | 'administrador' | 'miembro';
  fecha_union: string;
}

interface EstadisticasTareas {
  total: number;
  todo: number;
  'in-progress': number;
  completed: number;
  porcentajeCompletado: number;
}

type EstadoTarea = 'todo' | 'in-progress' | 'completed';

interface TareaPreview {
  id: string;
  titulo: string;
  descripcion: string | null;
  prioridad: 'baja' | 'media' | 'alta';
  estado: EstadoTarea;
  created_at: string;
  updated_at: string;
  tiempo_estimado_minutos: number | null;
  max_participantes: number;
}

interface MetaPreview {
  totalMiembros: number;
  esMiembro: boolean;
  canJoinDirect: boolean;
  canRequestInvite: boolean;
  puedeVerTareas: boolean;
}

type PreviewResponse = {
  proyecto: Proyecto;
  meta: MetaPreview;
  tareas: TareaPreview[];
  estadisticasTareas: EstadisticasTareas | null;
};

interface ProjectPreviewModalProps {
  isOpen: boolean;
  proyecto: Proyecto | null;
  meta?: MetaPreview | null;
  tareas?: TareaPreview[];
  miembros?: Miembro[];
  estadisticasTareas?: EstadisticasTareas | null;
  onClose: () => void;
  onNavigate?: (ruta: string) => void;
  onAfterAction?: () => void;
  requestLoading?: boolean;
}

function normalizarModoAcceso(proyecto: Proyecto | null): ModoAcceso {
  const raw = String(proyecto?.modo_acceso ?? proyecto?.visibilidad ?? '').toLowerCase();

  if (raw === 'publico' || raw === 'público' || raw === 'public') return 'publico';

  if (
    raw === 'solicitud' ||
    raw === 'request' ||
    raw === 'invite' ||
    raw === 'invitacion' ||
    raw === 'invitación'
  ) {
    return 'solicitud';
  }

  return 'privado';
}

export default function ProjectPreviewModal({
  isOpen,
  proyecto,
  meta = null,
  tareas = [],
  miembros = [],
  estadisticasTareas = null,
  onClose,
  onNavigate,
  onAfterAction,
  requestLoading = false,
}: ProjectPreviewModalProps) {
  const titleId = useId();

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionOk, setActionOk] = useState<string | null>(null);

  const [joinedAndNavigating, setJoinedAndNavigating] = useState(false);
  const [confirmJoinOpen, setConfirmJoinOpen] = useState(false);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);

  const [hasJoinedNow, setHasJoinedNow] = useState(false);

  useEffect(() => {
    if (!isOpen || !proyecto?.id) return;

    let cancelled = false;

    const run = async () => {
      setPreviewLoading(true);
      setPreviewError(null);

      try {
        const res = await fetch(`/api/proyectos/${proyecto.id}/preview`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        const data = (await res.json().catch(() => null)) as PreviewResponse | null;

        if (!res.ok || !data?.proyecto) {
          throw new Error((data as any)?.error || 'No se pudo cargar el preview');
        }

        if (!cancelled) setPreviewData(data);
      } catch (e) {
        if (!cancelled) {
          setPreviewData(null);
          setPreviewError(e instanceof Error ? e.message : 'Error');
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [isOpen, proyecto?.id]);

  const proyectoUI = previewData?.proyecto ?? proyecto;
  const metaUI = previewData?.meta ?? meta;
  const tareasUI = previewData?.tareas ?? tareas;
  const statsUI = previewData?.estadisticasTareas ?? estadisticasTareas;

  const modoAcceso = useMemo(() => {
    if (metaUI) {
      if (metaUI.canJoinDirect) return 'publico';
      if (metaUI.canRequestInvite) return 'solicitud';
    }
    return normalizarModoAcceso(proyectoUI);
  }, [metaUI, proyectoUI]);

  const flags = useMemo(() => {
    const fallbackEsMiembro = (miembros?.length ?? 0) > 0;
    const esMiembro = metaUI?.esMiembro ?? fallbackEsMiembro;

    const canJoinDirect = metaUI?.canJoinDirect ?? (!esMiembro && modoAcceso === 'publico');
    const canRequestInvite = metaUI?.canRequestInvite ?? (!esMiembro && modoAcceso === 'solicitud');

    const puedeVerTareas = metaUI?.puedeVerTareas ?? (modoAcceso === 'publico' || esMiembro);

    const totalMiembros =
      typeof metaUI?.totalMiembros === 'number' ? metaUI.totalMiembros : 0;

    return { esMiembro, canJoinDirect, canRequestInvite, puedeVerTareas, totalMiembros };
  }, [metaUI, miembros, modoAcceso]);

  const showTasksPreview =
    flags.puedeVerTareas && Array.isArray(tareasUI) && tareasUI.length > 0;

  const esMiembroUI = flags.esMiembro || hasJoinedNow;

  const openJoinConfirm = () => {
    if (actionLoading || joinedAndNavigating || !proyectoUI) return;
    setActionError(null);
    setActionOk(null);
    setConfirmJoinOpen(true);
  };

  const confirmAndJoin = async () => {
    if (actionLoading || joinedAndNavigating || !proyectoUI) return;

    setActionError(null);
    setActionOk(null);
    setActionLoading(true);

    try {
      const res = await fetch(`/api/proyectos/${proyectoUI.id}/unirse`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'No se pudo unir al proyecto');

      setActionOk('Te has unido exitosamente al proyecto.');
      setHasJoinedNow(true);
      onAfterAction?.();

      const ruta = `/dashboard/proyectos/${proyectoUI.id}/tareas`;
      setJoinedAndNavigating(true);

      if (onNavigate) {
        onNavigate(ruta);
      } else if (typeof window !== 'undefined') {
        window.location.href = ruta;
      }

      onClose();
      setConfirmJoinOpen(false);
      return;
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Error');
      setHasJoinedNow(false);
    } finally {
      setActionLoading(false);
      setJoinedAndNavigating(false);
    }
  };

  const handleSolicitar = async () => {
    if (actionLoading || joinedAndNavigating || !proyectoUI) return;

    setActionError(null);
    setActionOk(null);
    setActionLoading(true);

    try {
      const res = await fetch(`/api/proyectos/${proyectoUI.id}/solicitudes`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'No se pudo solicitar acceso');

      setActionOk('Solicitud enviada. Espera la aprobación del creador.');
      onAfterAction?.();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Error');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow || 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmJoinOpen) return;
      onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, confirmJoinOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setActionError(null);
    setActionOk(null);
    setActionLoading(false);
    setJoinedAndNavigating(false);
    setConfirmJoinOpen(false);
    setPreviewError(null);
    setHasJoinedNow(false);
  }, [isOpen, proyecto?.id]);

  if (!isOpen || !proyectoUI) return null;

  const getPrioridadConfig = (prioridad: Prioridad) => {
    const configs = {
      critica: {
        gradient: 'from-red-600/20 to-red-700/20',
        border: 'border-red-500/30',
        badge: 'bg-red-500/10 text-red-400 border-red-500/30',
        text: 'Crítica',
        icon: '🔴',
      },
      alta: {
        gradient: 'from-orange-600/20 to-orange-700/20',
        border: 'border-orange-500/30',
        badge: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
        text: 'Alta',
        icon: '🟠',
      },
      media: {
        gradient: 'from-yellow-600/20 to-yellow-700/20',
        border: 'border-yellow-500/30',
        badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
        text: 'Media',
        icon: '🟡',
      },
      baja: {
        gradient: 'from-green-600/20 to-green-700/20',
        border: 'border-green-500/30',
        badge: 'bg-green-500/10 text-green-400 border-green-500/30',
        text: 'Baja',
        icon: '🟢',
      },
    };
    return configs[prioridad];
  };

  const getRolBadge = (rol: 'creador' | 'administrador' | 'miembro') => {
    const badges = {
      creador: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      administrador: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      miembro: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
    };
    return badges[rol];
  };

  const getRolTexto = (rol: 'creador' | 'administrador' | 'miembro') => {
    const textos = { creador: 'Creador', administrador: 'Admin', miembro: 'Miembro' };
    return textos[rol];
  };

  const prioridadConfig = getPrioridadConfig(proyectoUI.prioridad);

  const formatearFecha = (fecha: string | null) => {
    if (!fecha) return '—';
    const date = new Date(fecha);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('es-CR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const modoAccesoLabel =
    modoAcceso === 'publico'
      ? 'Público'
      : modoAcceso === 'solicitud'
      ? 'Por solicitud'
      : 'Privado';

  const creador = proyectoUI.creador ?? null;

  const mostrarBotonUnirse = modoAcceso === 'publico' && !hasJoinedNow;
  const mostrarBotonSolicitud = !esMiembroUI && modoAcceso === 'solicitud';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={() => {
          if (confirmJoinOpen) return;
          onClose();
        }}
      />

      <div
        className="relative flex w-full flex-col rounded-t-3xl border border-white/10 bg-slate-900 shadow-2xl animate-scale-in sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl"
        style={{ maxHeight: '94vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-white/10 bg-slate-900/95 p-4 backdrop-blur-xl sm:p-6">
          <div className="mb-3 flex justify-center sm:hidden">
            <div className="h-1.5 w-14 rounded-full bg-white/10" />
          </div>

          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h2
                id={titleId}
                className="mb-2 break-words text-xl font-bold text-white sm:text-2xl"
              >
                {proyectoUI.nombre}
              </h2>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold sm:px-3 sm:text-xs ${prioridadConfig.badge}`}
                >
                  <span>{prioridadConfig.icon}</span>
                  <span>{prioridadConfig.text}</span>
                </span>

                <span className="flex items-center gap-1.5 rounded-lg border border-slate-500/30 bg-slate-500/10 px-2.5 py-1 text-[11px] font-semibold text-slate-400 sm:px-3 sm:text-xs">
                  {modoAcceso === 'publico' ? (
                    <>
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path
                          fillRule="evenodd"
                          d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>{modoAccesoLabel}</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>{modoAccesoLabel}</span>
                    </>
                  )}
                </span>

                <span className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-300 sm:px-3 sm:text-xs">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>{flags.totalMiembros} miembros</span>
                </span>

                <span
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold sm:px-3 sm:text-xs ${
                    esMiembroUI
                      ? 'border-green-500/30 bg-green-500/10 text-green-300'
                      : 'border-white/10 bg-slate-700/20 text-slate-300'
                  }`}
                >
                  {esMiembroUI ? 'Eres miembro' : 'Vista previa'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (confirmJoinOpen) return;
                onClose();
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800/50 text-gray-400 transition-all hover:bg-slate-700/50 hover:text-white"
              aria-label="Cerrar"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:space-y-6 sm:p-6">
          {(previewLoading || previewError) && (
            <div
              className={`rounded-xl border p-4 ${
                previewError
                  ? 'border-red-500/30 bg-red-500/10'
                  : 'border-white/5 bg-slate-800/30'
              }`}
            >
              <p className={`text-sm ${previewError ? 'text-red-300' : 'text-gray-400'}`}>
                {previewError ? previewError : 'Cargando información del proyecto...'}
              </p>
            </div>
          )}

          {(actionError || actionOk) && (
            <div
              className={`rounded-xl border p-4 ${
                actionError
                  ? 'border-red-500/30 bg-red-500/10'
                  : 'border-green-500/30 bg-green-500/10'
              }`}
            >
              <p className={`text-sm break-words ${actionError ? 'text-red-300' : 'text-green-300'}`}>
                {actionError ?? actionOk}
              </p>
            </div>
          )}

          {proyectoUI.descripcion && (
            <div className="rounded-xl border border-white/5 bg-slate-800/30 p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-400">
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                Descripción
              </h3>
              <p className="break-words text-sm leading-relaxed text-gray-300">
                {proyectoUI.descripcion}
              </p>
            </div>
          )}

          {!esMiembroUI && modoAcceso !== 'publico' && (
            <div className="rounded-xl border border-white/5 bg-slate-800/30 p-4">
              <p className="text-sm text-gray-400">
                {modoAcceso === 'privado'
                  ? 'Método de acceso: Privado. Solo el creador puede añadir miembros.'
                  : 'Método de acceso: Por solicitud. Debes enviar una solicitud para unirte.'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-white/5 bg-slate-800/30 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-400">
                <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h6l2 2 2-2h2a2 2 0 002-2V5a2 2 0 00-2-2H4z" />
                </svg>
                Registro
              </h3>

              <div className="space-y-2 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-gray-400">Creado:</span>
                  <span className="text-right font-medium text-white">
                    {formatearFecha(proyectoUI.created_at)}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-gray-400">Actualizado:</span>
                  <span className="text-right font-medium text-white">
                    {formatearFecha(proyectoUI.updated_at)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-slate-800/30 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-400">
                <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                    clipRule="evenodd"
                  />
                </svg>
                Fechas
              </h3>

              <div className="space-y-2 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-gray-400">Inicio:</span>
                  <span className="text-right font-medium text-white">
                    {formatearFecha(proyectoUI.fecha_inicio)}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-gray-400">Fin:</span>
                  <span className="text-right font-medium text-white">
                    {formatearFecha(proyectoUI.fecha_fin)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-slate-800/30 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-400">
              <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 10a4 4 0 100-8 4 4 0 000 8zM2 18a8 8 0 0116 0H2z" />
              </svg>
              Creador
            </h3>

            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-400">Nombre:</span>
                <span className="text-right font-medium text-white">
                  {creador ? `${creador.nombre} ${creador.apellido ?? ''}`.trim() : '—'}
                </span>
              </div>

              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-400">Correo:</span>
                <span className="max-w-[220px] truncate text-right font-medium text-white">
                  {creador?.email ?? '—'}
                </span>
              </div>

              <div className="flex items-start justify-between gap-3 sm:col-span-2">
                <span className="text-gray-400">País:</span>
                <span className="text-right font-medium text-white">
                  {creador?.pais ?? '—'}
                </span>
              </div>
            </div>
          </div>

          {statsUI && flags.puedeVerTareas && (
            <div className="rounded-xl border border-white/5 bg-slate-800/30 p-4">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-400">
                <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path
                    fillRule="evenodd"
                    d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                    clipRule="evenodd"
                  />
                </svg>
                Progreso de tareas
              </h3>

              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-400">Completado</span>
                  <span className="text-sm font-semibold text-white">
                    {statsUI.porcentajeCompletado}%
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-700/50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-500"
                    style={{ width: `${statsUI.porcentajeCompletado}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-slate-700/30 p-3 text-center">
                  <div className="text-xl font-bold text-white sm:text-2xl">{statsUI.total}</div>
                  <div className="mt-1 text-[11px] text-gray-400 sm:text-xs">Total</div>
                </div>

                <div className="rounded-lg border border-gray-500/30 bg-gray-500/10 p-3 text-center">
                  <div className="text-xl font-bold text-gray-300 sm:text-2xl">{statsUI.todo}</div>
                  <div className="mt-1 text-[11px] text-gray-400 sm:text-xs">Por hacer</div>
                </div>

                <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-center">
                  <div className="text-xl font-bold text-blue-400 sm:text-2xl">
                    {statsUI['in-progress']}
                  </div>
                  <div className="mt-1 text-[11px] text-blue-300 sm:text-xs">En progreso</div>
                </div>

                <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-center">
                  <div className="text-xl font-bold text-green-400 sm:text-2xl">
                    {statsUI.completed}
                  </div>
                  <div className="mt-1 text-[11px] text-green-300 sm:text-xs">Completadas</div>
                </div>
              </div>
            </div>
          )}

          {!flags.puedeVerTareas && (
            <div className="rounded-xl border border-white/5 bg-slate-800/30 p-4">
              <p className="text-sm text-gray-400">
                {modoAcceso === 'privado'
                  ? 'Este proyecto es privado. No puedes ver las tareas.'
                  : 'Este proyecto es por solicitud. No puedes ver las tareas sin ser miembro.'}
              </p>
            </div>
          )}

          {showTasksPreview && (
            <div className="rounded-xl border border-white/5 bg-slate-800/30 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-400">
                <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4 5a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 3a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 000 2h6a1 1 0 100-2H7z"
                    clipRule="evenodd"
                  />
                </svg>
                Tareas (vista previa)
              </h3>

              <div className="max-h-56 space-y-2 overflow-y-auto">
                {tareasUI.slice(0, 25).map((t) => (
                  <div
                    key={t.id}
                    className="rounded-lg border border-white/5 bg-slate-900/40 p-3 transition-colors hover:border-purple-500/30"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <p className="line-clamp-2 break-words text-sm font-medium text-white">
                        {t.titulo}
                      </p>

                      <span className="w-fit shrink-0 rounded border border-white/10 bg-slate-800/30 px-2 py-0.5 text-[11px] text-gray-300">
                        {t.estado === 'todo'
                          ? 'Por hacer'
                          : t.estado === 'in-progress'
                          ? 'En progreso'
                          : 'Completada'}
                      </span>
                    </div>

                    {t.descripcion && (
                      <p className="mt-1 line-clamp-2 break-words text-xs text-gray-500">
                        {t.descripcion}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {miembros.length > 0 && (
            <div className="rounded-xl border border-white/5 bg-slate-800/30 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-400">
                <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Equipo ({miembros.length})
              </h3>

              <div className="max-h-48 space-y-2 overflow-y-auto">
                {miembros.map((miembro) => (
                  <div
                    key={String(miembro.id)}
                    className="flex items-center gap-3 rounded-lg bg-slate-700/30 p-2 transition-colors hover:bg-slate-700/50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-sm font-semibold text-white">
                      {miembro.nombre.charAt(0).toUpperCase()}
                      {miembro.apellido?.charAt(0).toUpperCase() || ''}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {miembro.nombre} {miembro.apellido || ''}
                      </p>
                      <p className="truncate text-xs text-gray-500">{miembro.email}</p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full border px-2 py-1 text-xs font-semibold ${getRolBadge(
                        miembro.rol
                      )}`}
                    >
                      {getRolTexto(miembro.rol)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-white/10 bg-slate-900/95 p-4 backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              disabled={joinedAndNavigating}
              className="flex-1 rounded-xl border border-white/10 bg-slate-800/50 px-4 py-2.5 font-semibold text-gray-300 transition-all hover:border-white/20 hover:bg-slate-700/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cerrar
            </button>

            {mostrarBotonUnirse && (
              <button
                type="button"
                onClick={openJoinConfirm}
                disabled={actionLoading || joinedAndNavigating}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 font-semibold text-white shadow-lg transition-all hover:scale-[1.01] hover:shadow-purple-500/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>{actionLoading ? 'Uniéndote...' : 'Unirse'}</span>
              </button>
            )}

            {mostrarBotonSolicitud && (
              <button
                type="button"
                onClick={handleSolicitar}
                disabled={actionLoading || joinedAndNavigating || requestLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 font-semibold text-white shadow-lg transition-all hover:scale-[1.01] hover:shadow-purple-500/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>{actionLoading || requestLoading ? 'Enviando...' : 'Enviar solicitud'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {confirmJoinOpen && proyectoUI && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full rounded-t-3xl border border-white/10 bg-slate-900 p-4 shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-5">
            <div className="mb-3 flex justify-center sm:hidden">
              <div className="h-1.5 w-14 rounded-full bg-white/10" />
            </div>

            <h3 className="mb-2 text-lg font-bold text-white">Confirmar unión</h3>
            <p className="mb-4 break-words text-sm text-gray-400">
              ¿Seguro que quieres unirte a{' '}
              <span className="font-semibold text-white">{proyectoUI.nombre}</span>?
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setConfirmJoinOpen(false)}
                disabled={actionLoading || joinedAndNavigating}
                className="flex-1 rounded-xl border border-white/10 bg-slate-800/50 px-4 py-2.5 font-semibold text-gray-300 transition-all hover:border-white/20 hover:bg-slate-700/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmAndJoin}
                disabled={actionLoading || joinedAndNavigating}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 font-semibold text-white shadow-lg transition-all hover:scale-[1.01] hover:shadow-purple-500/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>{actionLoading ? 'Confirmando...' : 'Confirmar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
            transform: translateY(12px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
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