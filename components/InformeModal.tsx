//components/InformeModal.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

export type RolUsuario = 'admin' | 'jefe' | 'colaborador' | 'owner' | 'miembro';
export type TareaEstado = 'todo' | 'in-progress' | 'review' | 'completed';
export type TipoInforme = 'avance' | 'final';

export type InformeExistente = {
  id?: string;
  tipo: TipoInforme;
  titulo: string;
  descripcion: string;
  archivo_url?: string | null;
  creado_por?: string;
  fecha_creacion?: string;
};

type InformeModalProps = {
  isOpen: boolean;
  proyectoId: string | number;
  tareaId: string;
  tareaEstado: TareaEstado;
  rolUsuario: RolUsuario;
  nombreUsuario?: string;
  tipoInforme?: TipoInforme;
  informe?: InformeExistente | null;
  comentarioRevision?: string | null;
  onClose: () => void;
  onSuccess?: () => Promise<void> | void;
};

type EstadoBadge = {
  label: string;
  color: string;
  bg: string;
  border: string;
  dot: string;
};

type InformeApiRow = {
  id?: string;
  tipo?: TipoInforme | null;
  titulo?: string;
  descripcion?: string;
  archivo_url?: string | null;
  created_at?: string | null;
  fecha_creacion?: string | null;
  creado_por?: string | null;
  usuario_nombre?: string | null;
  usuario_apellido?: string | null;
};

function puedeRevisar(rol: RolUsuario) {
  return rol === 'admin' || rol === 'owner';
}

function formatFecha(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getEstadoBadge(estado: TareaEstado): EstadoBadge {
  switch (estado) {
    case 'todo':
      return {
        label: 'Pendiente',
        color: 'text-slate-300',
        bg: 'bg-slate-500/10',
        border: 'border-slate-500/25',
        dot: 'bg-slate-400',
      };
    case 'in-progress':
      return {
        label: 'En progreso',
        color: 'text-cyan-300',
        bg: 'bg-cyan-500/10',
        border: 'border-cyan-500/25',
        dot: 'bg-cyan-400',
      };
    case 'review':
      return {
        label: 'En review',
        color: 'text-amber-300',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/25',
        dot: 'bg-amber-400',
      };
    case 'completed':
      return {
        label: 'Completada',
        color: 'text-emerald-300',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/25',
        dot: 'bg-emerald-400',
      };
  }
}

function getTipoLabel(tipo: TipoInforme) {
  return tipo === 'final' ? 'Informe final' : 'Informe de avance';
}

function detectUrlKind(url?: string | null): 'imagen' | 'pdf' | 'otro' | null {
  if (!url) return null;

  const v = url.toLowerCase();

  if (
    v.endsWith('.jpg') ||
    v.endsWith('.jpeg') ||
    v.endsWith('.png') ||
    v.endsWith('.webp') ||
    v.endsWith('.gif') ||
    v.endsWith('.svg')
  ) {
    return 'imagen';
  }

  if (v.endsWith('.pdf')) return 'pdf';

  return 'otro';
}

function mapInformeApiRow(row: InformeApiRow): InformeExistente {
  const nombre =
    row.creado_por?.trim() ||
    [row.usuario_nombre?.trim(), row.usuario_apellido?.trim()]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    undefined;

  return {
    id: row.id ? String(row.id) : undefined,
    tipo: row.tipo === 'avance' ? 'avance' : 'final',
    titulo: row.titulo?.trim() || '',
    descripcion: row.descripcion?.trim() || '',
    archivo_url: row.archivo_url ?? null,
    creado_por: nombre,
    fecha_creacion: row.fecha_creacion ?? row.created_at ?? undefined,
  };
}

function Lightbox({
  url,
  nombre,
  onClose,
}: {
  url: string;
  nombre: string;
  onClose: () => void;
}) {
  const kind = detectUrlKind(url);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />

      <div
        className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {kind === 'imagen' ? (
          <img
            src={url}
            alt={nombre}
            className="max-h-[78vh] max-w-full rounded-2xl object-contain shadow-2xl"
          />
        ) : kind === 'pdf' ? (
          <iframe
            src={url}
            title={nombre}
            className="h-[76vh] w-full rounded-2xl border border-white/10"
          />
        ) : (
          <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-3xl border border-white/10 bg-slate-800 px-6 py-10 sm:px-10 sm:py-16">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-slate-700/60">
              <svg
                className="h-10 w-10 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>

            <p className="max-w-full text-center font-medium text-white break-words">{nombre}</p>

            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-2.5 text-sm font-semibold text-cyan-400 transition-all hover:bg-cyan-500/20"
            >
              Abrir archivo
            </a>
          </div>
        )}

        <div className="mt-3 max-w-full truncate px-2 text-center text-sm font-medium text-slate-300">
          {nombre}
        </div>
      </div>

      <button
        onClick={onClose}
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 bg-white/8 text-white transition-all hover:bg-white/15 sm:right-4 sm:top-4"
      >
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
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

function PanelRevision({
  onAprobar,
  onRechazar,
}: {
  onAprobar: (comentario: string) => Promise<void>;
  onRechazar: (comentario: string) => Promise<void>;
}) {
  const [accion, setAccion] = useState<'aprobar' | 'rechazar' | null>(null);
  const [comentario, setComentario] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function confirmar() {
    if (!accion) return;

    if (accion === 'rechazar' && !comentario.trim()) {
      setError('El motivo de rechazo es obligatorio.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (accion === 'aprobar') {
        await onAprobar(comentario.trim());
      } else {
        await onRechazar(comentario.trim());
      }

      setAccion(null);
      setComentario('');
    } catch (e: any) {
      setError(e?.message ?? 'Error al procesar la revisión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-slate-900/40">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-white/6 px-4 py-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
          <svg
            className="h-3.5 w-3.5 text-white"
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
        </div>

        <span className="text-sm font-semibold text-white">Panel de revisión</span>

        <span className="ml-0 sm:ml-auto rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-400">
          Admin / Owner
        </span>
      </div>

      <div className="space-y-4 p-4">
        {!accion ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => {
                setAccion('aprobar');
                setError('');
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-sm font-semibold text-emerald-400 transition-all hover:bg-emerald-500/20"
            >
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Aprobar tarea
            </button>

            <button
              onClick={() => {
                setAccion('rechazar');
                setError('');
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 py-2.5 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20"
            >
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Rechazar tarea
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                accion === 'aprobar'
                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
                  : 'border-red-500/25 bg-red-500/10 text-red-400'
              }`}
            >
              <div
                className={`h-1.5 w-1.5 rounded-full ${
                  accion === 'aprobar' ? 'bg-emerald-400' : 'bg-red-400'
                }`}
              />
              {accion === 'aprobar' ? 'Aprobando tarea' : 'Rechazando tarea'}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
                {accion === 'rechazar'
                  ? 'Motivo de rechazo *'
                  : 'Comentario (opcional)'}
              </label>

              <textarea
                rows={3}
                placeholder={
                  accion === 'rechazar'
                    ? 'Describe el motivo del rechazo…'
                    : 'Agrega un comentario de aprobación (opcional)…'
                }
                value={comentario}
                onChange={(e) => {
                  setComentario(e.target.value);
                  setError('');
                }}
                disabled={loading}
                className="w-full resize-none rounded-xl border border-white/8 bg-slate-900/70 px-3 py-2.5 text-sm text-white placeholder-slate-700 transition-all focus:border-cyan-500/40 focus:outline-none disabled:opacity-50"
              />
            </div>

            {error ? <p className="text-xs text-red-400">{error}</p> : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => {
                  setAccion(null);
                  setComentario('');
                  setError('');
                }}
                disabled={loading}
                className="flex-1 rounded-xl border border-white/8 bg-slate-700/60 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-slate-700 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                onClick={confirmar}
                disabled={loading}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold text-white transition-all disabled:opacity-50 ${
                  accion === 'aprobar'
                    ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400'
                    : 'bg-red-500 shadow-lg shadow-red-500/20 hover:bg-red-400'
                }`}
              >
                {loading
                  ? 'Procesando...'
                  : accion === 'aprobar'
                    ? 'Confirmar aprobación'
                    : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InformeModal({
  isOpen,
  proyectoId,
  tareaId,
  tareaEstado,
  rolUsuario,
  nombreUsuario,
  tipoInforme = 'final',
  informe,
  comentarioRevision,
  onClose,
  onSuccess,
}: InformeModalProps) {
  const badgeEstado = getEstadoBadge(tareaEstado);

  const [informeData, setInformeData] = useState<InformeExistente | null>(informe ?? null);
  const [loadingInforme, setLoadingInforme] = useState(false);

  const currentInforme = informeData || informe || null;

  const [titulo, setTitulo] = useState(currentInforme?.titulo ?? '');
  const [descripcion, setDescripcion] = useState(currentInforme?.descripcion ?? '');
  const [archivoUrl, setArchivoUrl] = useState(currentInforme?.archivo_url ?? '');
  const [saving, setSaving] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState('');
  const [tabVista, setTabVista] = useState<'informe' | 'evidencia'>('informe');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [comentarioRevisionActual, setComentarioRevisionActual] = useState<string | null>(
    comentarioRevision ?? null
  );

  const esRevisor = puedeRevisar(rolUsuario);

  const mostrarPanelRevision = esRevisor && tareaEstado === 'review';
  const puedeEditar = tareaEstado === 'todo' || tareaEstado === 'in-progress';

  const evidenciaKind = useMemo(() => detectUrlKind(archivoUrl), [archivoUrl]);

  useEffect(() => {
    if (!isOpen) return;
    setInformeData(informe ?? null);
    setComentarioRevisionActual(comentarioRevision ?? null);
  }, [isOpen, informe, comentarioRevision]);

  useEffect(() => {
    if (!isOpen) return;

    async function fetchInforme() {
      try {
        setLoadingInforme(true);
        setErrorGlobal('');

        const res = await fetch(
          `/api/proyectos/${proyectoId}/tareas/${tareaId}/informes`,
          {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
          }
        );

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(data?.error || 'No se pudieron cargar los informes');
        }

        const lista = Array.isArray(data?.informes) ? data.informes : [];
        const informeFinal = lista.find((item: InformeApiRow) => item?.tipo === 'final');
        const informeMasReciente = informeFinal ?? lista[0] ?? null;

        if (informeMasReciente) {
          setInformeData(mapInformeApiRow(informeMasReciente));
        } else {
          setInformeData(null);
        }

        setComentarioRevisionActual(data?.meta?.comentario_revision ?? null);
      } catch (e: any) {
        console.error('Error cargando informe:', e);
        setErrorGlobal((prev) => prev || e?.message || 'Error cargando el informe');
        setInformeData(null);
        setComentarioRevisionActual(null);
      } finally {
        setLoadingInforme(false);
      }
    }

    fetchInforme();
  }, [isOpen, proyectoId, tareaId]);

  useEffect(() => {
    if (!isOpen) return;

    const inf = informeData || informe || null;

    setTitulo(inf?.titulo ?? '');
    setDescripcion(inf?.descripcion ?? '');
    setArchivoUrl(inf?.archivo_url ?? '');
    setErrorGlobal('');
    setTabVista('informe');
    setLightboxOpen(false);
  }, [isOpen, informeData, informe]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape' && !lightboxOpen) onClose();
    }

    if (isOpen) {
      window.addEventListener('keydown', handler);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, lightboxOpen, onClose]);

  if (!isOpen) return null;

  async function handleGuardar() {
    if (!titulo.trim()) {
      setErrorGlobal('El título es obligatorio.');
      return;
    }

    if (!descripcion.trim()) {
      setErrorGlobal('La descripción del informe es obligatoria.');
      return;
    }

    if (!archivoUrl.trim()) {
      setErrorGlobal('Debes indicar la URL de la evidencia.');
      return;
    }

    setSaving(true);
    setErrorGlobal('');

    try {
      const resInforme = await fetch(
        `/api/proyectos/${proyectoId}/tareas/${tareaId}/informes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            tipo: tipoInforme,
            titulo: titulo.trim(),
            descripcion: descripcion.trim(),
            archivo_url: archivoUrl.trim(),
          }),
        }
      );

      const dataInforme = await resInforme.json().catch(() => null);

      if (!resInforme.ok) {
        throw new Error(dataInforme?.error || 'No se pudo guardar el informe');
      }

      if (tipoInforme === 'final') {
        const resCompletar = await fetch(
          `/api/proyectos/${proyectoId}/tareas/${tareaId}/completar`,
          {
            method: 'POST',
            credentials: 'include',
          }
        );

        const dataCompletar = await resCompletar.json().catch(() => null);

        if (!resCompletar.ok) {
          throw new Error(
            dataCompletar?.error || 'No se pudo enviar la tarea a review'
          );
        }
      }

      await onSuccess?.();
      onClose();
    } catch (e: any) {
      setErrorGlobal(e?.message ?? 'Error al guardar el informe.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAprobar(comentario: string) {
    const res = await fetch(
      `/api/proyectos/${proyectoId}/tareas/${tareaId}/aprobar`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ comentario }),
      }
    );

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.error || 'No se pudo aprobar la tarea');
    }

    await onSuccess?.();
    onClose();
  }

  async function handleRechazar(comentario: string) {
    const res = await fetch(
      `/api/proyectos/${proyectoId}/tareas/${tareaId}/rechazar`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ comentario }),
      }
    );

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.error || 'No se pudo rechazar la tarea');
    }

    await onSuccess?.();
    onClose();
  }

  return (
    <>
      {lightboxOpen && archivoUrl ? (
        <Lightbox
          url={archivoUrl}
          nombre={titulo || 'Evidencia'}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}

      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        <div
          className="absolute inset-0 bg-black/65 backdrop-blur-sm"
          onClick={() => !lightboxOpen && onClose()}
        />

        <div className="relative flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-slate-800 shadow-2xl shadow-black/60">
          <div className="h-0.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500" />

          <div className="shrink-0 border-b border-white/8 px-4 pb-4 pt-4 sm:px-6 sm:pb-4 sm:pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold leading-tight text-white break-words">
                    {getTipoLabel(currentInforme?.tipo ?? tipoInforme)}
                  </h2>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badgeEstado.bg} ${badgeEstado.border} ${badgeEstado.color}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${badgeEstado.dot}`} />
                    {badgeEstado.label}
                  </span>

                  <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-300">
                    {(currentInforme?.tipo ?? tipoInforme) === 'final'
                      ? 'Final'
                      : 'Avance'}
                  </span>
                </div>

                {(currentInforme?.creado_por || nombreUsuario) && (
                  <p className="text-xs text-slate-500 break-words">
                    {currentInforme?.creado_por || nombreUsuario}
                    {currentInforme?.fecha_creacion ? (
                      <span className="block sm:inline sm:ml-2 text-slate-600">
                        {formatFecha(currentInforme.fecha_creacion)}
                      </span>
                    ) : null}
                  </p>
                )}
              </div>

              <button
                onClick={onClose}
                className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-slate-700/60 text-slate-400 transition-all hover:bg-slate-700 hover:text-white"
              >
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="shrink-0 px-4 pt-3 sm:px-6">
            <div className="flex w-full overflow-x-auto pb-1 sm:pb-0 items-center gap-1">
              {[
                { id: 'informe', label: 'Informe' },
                { id: 'evidencia', label: 'Evidencia' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTabVista(t.id as 'informe' | 'evidencia')}
                  className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    tabVista === t.id
                      ? 'border border-white/10 bg-slate-700 text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
            {loadingInforme ? (
              <div className="flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3.5 py-3 text-sm text-cyan-300">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" />
                Cargando informe...
              </div>
            ) : null}

            {errorGlobal ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-3 text-sm text-red-400">
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  />
                </svg>
                <span className="break-words">{errorGlobal}</span>
              </div>
            ) : null}

            {tabVista === 'informe' ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
                    Título
                  </label>

                  {puedeEditar ? (
                    <input
                      type="text"
                      placeholder="Escribe un título claro para el informe…"
                      value={titulo}
                      onChange={(e) => {
                        setTitulo(e.target.value);
                        setErrorGlobal('');
                      }}
                      disabled={saving}
                      className="w-full rounded-xl border border-white/8 bg-slate-900/60 px-3 py-2.5 text-sm text-white placeholder-slate-700 transition-all focus:border-cyan-500/40 focus:outline-none disabled:opacity-50"
                    />
                  ) : (
                    <p className="break-words text-base font-semibold text-white">
                      {currentInforme?.titulo || 'Sin título'}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
                    Descripción del informe
                  </label>

                  {puedeEditar ? (
                    <textarea
                      rows={window.innerWidth < 640 ? 7 : 9}
                      placeholder="Describe lo realizado, resultados, observaciones y lo que entregas como evidencia…"
                      value={descripcion}
                      onChange={(e) => {
                        setDescripcion(e.target.value);
                        setErrorGlobal('');
                      }}
                      disabled={saving}
                      className="w-full resize-none rounded-xl border border-white/8 bg-slate-900/60 px-3 py-3 text-sm leading-relaxed text-white placeholder-slate-700 transition-all focus:border-cyan-500/40 focus:outline-none disabled:opacity-50"
                    />
                  ) : (
                    <div className="whitespace-pre-wrap break-words rounded-xl border border-white/6 bg-slate-900/40 px-4 py-4 text-sm leading-relaxed text-slate-300">
                      {currentInforme?.descripcion || (
                        <span className="text-slate-600">Sin descripción</span>
                      )}
                    </div>
                  )}
                </div>

                {mostrarPanelRevision ? (
                  <PanelRevision
                    onAprobar={handleAprobar}
                    onRechazar={handleRechazar}
                  />
                ) : null}

                {comentarioRevisionActual && !mostrarPanelRevision ? (
                  <div className="space-y-1 rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-red-500">
                      Motivo del rechazo
                    </p>
                    <p className="break-words text-sm text-red-300">{comentarioRevisionActual}</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                {puedeEditar ? (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
                      URL de evidencia
                    </label>

                    <input
                      type="url"
                      placeholder="https://.../archivo.pdf"
                      value={archivoUrl}
                      onChange={(e) => {
                        setArchivoUrl(e.target.value);
                        setErrorGlobal('');
                      }}
                      disabled={saving}
                      className="w-full rounded-xl border border-white/8 bg-slate-900/60 px-3 py-2.5 text-sm text-white placeholder-slate-700 transition-all focus:border-cyan-500/40 focus:outline-none disabled:opacity-50"
                    />

                    <p className="text-xs text-slate-600 break-words">
                      Este modal usa la estructura actual del backend, que guarda una sola
                      <code> archivo_url </code> por informe.
                    </p>
                  </div>
                ) : null}

                {!archivoUrl ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-slate-500">No hay evidencia adjunta.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="group relative overflow-hidden rounded-2xl border border-white/8 bg-slate-900/60">
                      {evidenciaKind === 'imagen' ? (
                        <button
                          onClick={() => setLightboxOpen(true)}
                          className="w-full"
                        >
                          <img
                            src={archivoUrl}
                            alt={titulo || 'Evidencia'}
                            className="max-h-[220px] sm:max-h-[320px] w-full object-cover"
                          />
                        </button>
                      ) : evidenciaKind === 'pdf' ? (
                        <button
                          onClick={() => setLightboxOpen(true)}
                          className="flex w-full flex-col items-center gap-3 px-4 py-8 sm:px-6 sm:py-10"
                        >
                          <svg
                            className="h-12 w-12 text-red-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                            />
                          </svg>
                          <span className="text-sm font-semibold text-red-400">
                            Abrir PDF
                          </span>
                        </button>
                      ) : (
                        <div className="flex flex-col items-center gap-3 px-4 py-8 sm:px-6 sm:py-10">
                          <svg
                            className="h-12 w-12 text-slate-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                            />
                          </svg>

                          <a
                            href={archivoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-400 transition-all hover:bg-cyan-500/20"
                          >
                            Abrir evidencia
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="break-all rounded-xl border border-white/8 bg-slate-900/40 px-3 py-2 text-xs text-slate-500">
                      {archivoUrl}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {puedeEditar ? (
            <div className="shrink-0 border-t border-white/8 bg-slate-800/80 px-4 py-4 sm:px-6">
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  onClick={onClose}
                  disabled={saving}
                  className="w-full sm:w-auto rounded-xl border border-white/8 bg-slate-700/60 px-4 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-slate-700 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  onClick={handleGuardar}
                  disabled={saving}
                  className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
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
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                  )}
                  {tipoInforme === 'final' ? 'Enviar a review' : 'Guardar avance'}
                </button>
              </div>
            </div>
          ) : (
            <div className="shrink-0 border-t border-white/8 px-4 py-4 sm:px-6">
              <div className="flex items-center justify-end">
                <button
                  onClick={onClose}
                  className="w-full sm:w-auto rounded-xl border border-white/8 bg-slate-700/60 px-5 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-slate-700"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}