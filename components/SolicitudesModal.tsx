// components/SolicitudesModal.tsx
'use client';

import { useEffect, useState } from 'react';

type SolicitudEstado = 'pendiente' | 'aprobada' | 'rechazada';

interface SolicitudApi {
  id: number;
  proyecto_id: number;
  usuario_id: string;
  estado: SolicitudEstado;
  mensaje: string | null;
  creado_en: string;
  actualizado_en: string | null;
  nombre: string;
  apellido: string | null;
  email: string;
}

interface SolicitudesModalProps {
  proyectoId: string | number;
  isOpen: boolean;
  onClose: () => void;
}

const pillBase =
  'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border';

const cardCls =
  'bg-slate-900/95 backdrop-blur-md border border-slate-700/60 shadow-2xl';

const IconCheck = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

const IconX = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const IconUsers = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 20h5v-1a4 4 0 00-4-4h-1m-4 5v-1a4 4 0 00-4-4H8a4 4 0 00-4 4v1h9zm1-10a4 4 0 10-8 0 4 4 0 008 0zm6-4a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const IconSpinner = () => (
  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
);

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function estadoPill(estado: SolicitudEstado) {
  if (estado === 'pendiente') {
    return (
      <span
        className={`${pillBase} bg-yellow-500/10 text-yellow-300 border-yellow-500/40`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
        Pendiente
      </span>
    );
  }
  if (estado === 'aprobada') {
    return (
      <span
        className={`${pillBase} bg-green-500/10 text-green-300 border-green-500/40`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
        Aprobada
      </span>
    );
  }
  return (
    <span
      className={`${pillBase} bg-red-500/10 text-red-300 border-red-500/40`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
      Rechazada
    </span>
  );
}

export default function SolicitudesModal({
  proyectoId,
  isOpen,
  onClose,
}: SolicitudesModalProps) {
  const [solicitudes, setSolicitudes] = useState<SolicitudApi[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [error, setError] = useState('');

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
      if (e.key === 'Escape' && processingId === null) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, processingId]);

  useEffect(() => {
    if (!isOpen) return;

    const load = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch(`/api/proyectos/${proyectoId}/solicitudes`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        const data: any = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || 'No se pudieron cargar las solicitudes');
        }

        const list = (data.solicitudes ?? []) as SolicitudApi[];
        setSolicitudes(list);
      } catch (err: any) {
        setError(err.message || 'Error cargando solicitudes');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isOpen, proyectoId]);

  const handleAccion = async (solicitud: SolicitudApi, accion: 'aprobar' | 'rechazar') => {
    try {
      setProcessingId(solicitud.id);
      setError('');

      const res = await fetch(
        `/api/proyectos/${proyectoId}/solicitudes/${solicitud.id}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion }),
        },
      );

      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo procesar la solicitud');
      }

      const nuevoEstado: SolicitudEstado =
        accion === 'aprobar' ? 'aprobada' : 'rechazada';

      setSolicitudes((prev) =>
        prev.map((s) =>
          s.id === solicitud.id ? { ...s, estado: nuevoEstado } : s,
        ),
      );
    } catch (err: any) {
      setError(err.message || 'Error procesando la solicitud');
    } finally {
      setProcessingId(null);
    }
  };

  if (!isOpen) return null;

  const thereArePendientes = solicitudes.some((s) => s.estado === 'pendiente');

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className="absolute inset-0"
        onClick={() => {
          if (processingId !== null) return;
          onClose();
        }}
      />

      <div
        className={`relative w-full sm:max-w-4xl ${cardCls} rounded-t-3xl sm:rounded-2xl`}
        style={{ maxHeight: '92vh' }}
      >
        <div className="sticky top-0 z-10 rounded-t-3xl sm:rounded-t-2xl border-b border-slate-700/60 bg-slate-900/95 px-4 pb-4 pt-3 backdrop-blur-xl sm:px-6 sm:pt-5">
          <div className="mb-3 flex justify-center sm:hidden">
            <div className="h-1.5 w-14 rounded-full bg-white/10" />
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 hidden h-8 w-1.5 rounded-full bg-gradient-to-b from-purple-500 to-blue-500 sm:block" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <IconUsers />
                  <h2 className="text-base font-semibold text-white sm:text-lg">
                    Solicitudes de acceso
                  </h2>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-gray-500 sm:text-xs">
                  Gestiona las solicitudes de usuarios que quieren unirse a este proyecto.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={processingId !== null}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-600/60 bg-slate-800/80 text-gray-300 transition-colors hover:bg-slate-700/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconX />
            </button>
          </div>

          <div className="mt-3 text-xs text-gray-400">
            {loading
              ? 'Cargando solicitudes...'
              : solicitudes.length === 0
              ? 'No hay solicitudes para este proyecto.'
              : `${solicitudes.length} solicitud(es) en total • ${
                  thereArePendientes
                    ? 'Hay solicitudes pendientes.'
                    : 'No hay solicitudes pendientes.'
                }`}
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l6.518 11.59C19.021 16.92 18.245 18 17.014 18H2.986c-1.23 0-2.007-1.08-1.247-2.31l6.518-11.59zM11 14a1 1 0 10-2 0 1 1 0 002 0zm-1-2a1 1 0 01-1-1V8a1 1 0 112 0v3a1 1 0 01-1 1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="max-h-[calc(92vh-170px)] overflow-y-auto px-4 py-4 sm:px-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 text-sm text-gray-400">
              <div className="mb-3 h-8 w-8 animate-spin rounded-full border-4 border-purple-500/20 border-t-purple-500" />
              Cargando solicitudes...
            </div>
          ) : solicitudes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-sm text-gray-500">
              No se han recibido solicitudes aún.
            </div>
          ) : (
            <div className="space-y-3">
              {solicitudes.map((s) => {
                const fullName =
                  `${s.nombre ?? ''} ${s.apellido ?? ''}`.trim() || 'Sin nombre';
                const disabledRow = s.estado !== 'pendiente';

                return (
                  <div
                    key={s.id}
                    className={`rounded-xl border border-slate-700/60 bg-slate-900/80 px-4 py-3 ${
                      disabledRow ? 'opacity-80' : ''
                    }`}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-white">
                            {fullName}
                          </p>
                          {estadoPill(s.estado)}
                        </div>

                        <p className="mb-1 break-all text-xs text-gray-400 sm:break-normal sm:truncate">
                          {s.email} · ID usuario: {s.usuario_id}
                        </p>

                        <p className="text-[11px] text-gray-500">
                          Solicitado: {formatDateTime(s.creado_en)}
                        </p>

                        <p className="mt-2 break-words text-xs text-gray-300">
                          {s.mensaje || (
                            <span className="italic text-gray-500">
                              Sin mensaje de solicitud
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center lg:self-auto">
                        <button
                          type="button"
                          onClick={() => handleAccion(s, 'rechazar')}
                          disabled={disabledRow || processingId === s.id}
                          className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all sm:px-3 sm:py-1.5 ${
                            disabledRow
                              ? 'cursor-not-allowed opacity-40'
                              : 'border-red-500/40 bg-red-500/10 text-red-300 hover:border-red-500/60 hover:bg-red-500/20'
                          }`}
                        >
                          {processingId === s.id ? <IconSpinner /> : <IconX />}
                          Rechazar
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAccion(s, 'aprobar')}
                          disabled={disabledRow || processingId === s.id}
                          className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all sm:px-3 sm:py-1.5 ${
                            disabledRow
                              ? 'cursor-not-allowed opacity-40'
                              : 'border-green-500/40 bg-green-500/10 text-green-300 hover:border-green-500/60 hover:bg-green-500/20'
                          }`}
                        >
                          {processingId === s.id ? <IconSpinner /> : <IconCheck />}
                          Aprobar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 z-10 border-t border-slate-700/60 bg-slate-900/95 px-4 py-4 backdrop-blur-xl sm:px-6">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={processingId !== null}
              className="rounded-xl border border-slate-600/60 bg-slate-800/80 px-4 py-2.5 text-xs font-medium text-gray-200 transition-colors hover:bg-slate-700/80 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}