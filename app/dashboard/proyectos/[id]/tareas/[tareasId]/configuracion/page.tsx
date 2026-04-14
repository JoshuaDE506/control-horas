//app/dashboard/proyectos/[id]/tareas/[tareasId]/configuracion/page.tsx
'use client';

import type { ReactNode } from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ConfirmModal from '@/components/ConfirmModal';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Prioridad = 'baja' | 'media' | 'alta';
type EstadoTarea = 'pendiente' | 'en_progreso' | 'revision' | 'completada';

interface TareaForm {
  titulo: string;
  descripcion: string;
  prioridad: Prioridad;
  estado: EstadoTarea;
  tiempoDias: number;
  tiempoHoras: number;
  tiempoMinutos: number;
  horasPorDia: 8 | 12;
  maxParticipantes: number;
}

interface TareaApi {
  id: number | string;
  titulo: string;
  descripcion: string | null;
  prioridad: string;
  estado: string;
  tiempo_estimado_minutos: number | null;
  max_participantes: number;
}

interface PermisosApi {
  puedeEditar?: boolean;
  puedeEliminar?: boolean;
}

// ─── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_FORM: TareaForm = {
  titulo: '',
  descripcion: '',
  prioridad: 'media',
  estado: 'pendiente',
  tiempoDias: 0,
  tiempoHoras: 0,
  tiempoMinutos: 0,
  horasPorDia: 8,
  maxParticipantes: 1,
};

const inputCls =
  'w-full px-4 py-3 bg-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all outline-none';

// ─── Mapeos API ⇄ UI ───────────────────────────────────────────────────────────

function estadoApiToUi(apiEstado: string | null | undefined): EstadoTarea {
  const v = (apiEstado ?? '').toLowerCase();

  if (v === 'todo') return 'pendiente';
  if (v === 'in-progress' || v === 'in_progress') return 'en_progreso';
  if (v === 'completed') return 'completada';

  return 'pendiente';
}

function estadoUiToApi(uiEstado: EstadoTarea): 'todo' | 'in-progress' | 'completed' {
  switch (uiEstado) {
    case 'pendiente':
      return 'todo';
    case 'en_progreso':
    case 'revision':
      return 'in-progress';
    case 'completada':
      return 'completed';
    default:
      return 'todo';
  }
}

function prioridadApiToUi(apiPrioridad: string | null | undefined): Prioridad {
  const v = (apiPrioridad ?? '').toLowerCase();

  if (v === 'baja') return 'baja';
  if (v === 'alta') return 'alta';
  return 'media';
}

function prioridadUiToApi(uiPrioridad: Prioridad): 'baja' | 'media' | 'alta' {
  switch (uiPrioridad) {
    case 'baja':
      return 'baja';
    case 'alta':
      return 'alta';
    case 'media':
    default:
      return 'media';
  }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  icon,
  children,
  danger = false,
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`${
        danger
          ? 'bg-red-950/20 border-red-500/20'
          : 'bg-slate-900/40 border-slate-700/50'
      } backdrop-blur-sm border rounded-2xl p-4 sm:p-5 lg:p-6 shadow-xl`}
    >
      <div className="flex items-start gap-3 mb-5">
        <div
          className={`w-1 h-6 rounded-full shrink-0 ${
            danger
              ? 'bg-gradient-to-b from-red-500 to-rose-600'
              : 'bg-gradient-to-b from-purple-500 to-blue-500'
          }`}
        />
        <div className="flex items-start gap-2.5 min-w-0">
          <span className={`shrink-0 ${danger ? 'text-red-400' : 'text-gray-400'}`}>{icon}</span>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-white leading-tight break-words">
              {title}
            </h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5 break-words">{subtitle}</p>}
          </div>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  hintColor = 'text-gray-500',
  children,
}: {
  label: string;
  hint?: string;
  hintColor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
      {children}
      {hint && <p className={`mt-2 text-xs ${hintColor}`}>{hint}</p>}
    </div>
  );
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

const Ic = {
  arrow: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 12H5M12 5l-7 7 7 7"
      />
    </svg>
  ),
  edit: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  ),
  flag: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 21V3m0 0l9 4 9-4v12l-9 4-9-4V3z"
      />
    </svg>
  ),
  clock: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
    </svg>
  ),
  shield: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  ),
  lock: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  ),
  check: () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  ),
  warn: () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  ),
  trash: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  ),
};

// ─── Color helpers ─────────────────────────────────────────────────────────────

function estadoColor(v: EstadoTarea) {
  switch (v) {
    case 'pendiente':
      return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
    case 'en_progreso':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'revision':
      return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
    case 'completada':
      return 'bg-green-500/10 text-green-400 border-green-500/30';
    default:
      return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
  }
}

function prioridadColor(v: Prioridad) {
  switch (v) {
    case 'baja':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'media':
      return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
    case 'alta':
      return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
    default:
      return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
  }
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function TareaConfiguracionesPage() {
  const router = useRouter();
  const params = useParams() as { id?: string | string[]; tareasId?: string | string[] };

  const proyectoId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const tareaId = Array.isArray(params?.tareasId) ? params.tareasId[0] : params?.tareasId;

  const [form, setForm] = useState<TareaForm>(DEFAULT_FORM);
  const [initialForm, setInitialForm] = useState<TareaForm | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [puedeEditar, setPuedeEditar] = useState(false);
  const [puedeEliminar, setPuedeEliminar] = useState(false);

  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showNoPermission, setShowNoPermission] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const readOnly = !puedeEditar;
  const estadoBloqueado = true;

  const update = useCallback(<K extends keyof TareaForm>(key: K, value: TareaForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
    setSaved(false);
  }, []);

  const tituloLeft = 120 - form.titulo.length;

  const estadoOpts: { value: EstadoTarea; label: string; dot: string }[] = [
    { value: 'pendiente', label: 'Pendiente', dot: '#94a3b8' },
    { value: 'en_progreso', label: 'En progreso', dot: '#60a5fa' },
    { value: 'revision', label: 'En revisión', dot: '#facc15' },
    { value: 'completada', label: 'Completada', dot: '#4ade80' },
  ];

  const prioridadOpts: { value: Prioridad; label: string; dot: string }[] = [
    { value: 'baja', label: 'Baja', dot: '#60a5fa' },
    { value: 'media', label: 'Media', dot: '#facc15' },
    { value: 'alta', label: 'Alta', dot: '#fb923c' },
  ];

  useEffect(() => {
    if (!proyectoId || !tareaId) {
      setError('ID de proyecto o tarea inválido');
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError('');

        const tareaRes = await fetch(
          `/api/proyectos/${proyectoId}/tareas/${tareaId}/configuracion`,
          { method: 'GET', cache: 'no-store', credentials: 'include' }
        );

        const tareaData: any = await tareaRes.json().catch(() => ({}));

        if (!tareaRes.ok || !tareaData?.ok) {
          if (tareaRes.status === 403) {
            setPuedeEditar(false);
            setPuedeEliminar(false);
            setShowNoPermission(true);
          }
          throw new Error(tareaData?.error || 'Error al cargar la tarea');
        }

        const t = (tareaData?.data?.tarea ?? tareaData?.tarea) as TareaApi | undefined;
        if (!t) throw new Error('Tarea no encontrada');

        const totalMin = t.tiempo_estimado_minutos ?? 0;
        const horasPorDia: 8 | 12 = 8;
        const minutosPorDia = horasPorDia * 60;
        const tiempoDias = Math.floor(totalMin / minutosPorDia);
        const resto = totalMin % minutosPorDia;
        const tiempoHoras = Math.floor(resto / 60);
        const tiempoMinutos = resto % 60;

        const mapped: TareaForm = {
          titulo: t.titulo ?? '',
          descripcion: t.descripcion ?? '',
          prioridad: prioridadApiToUi(t.prioridad),
          estado: estadoApiToUi(t.estado),
          tiempoDias,
          tiempoHoras,
          tiempoMinutos,
          horasPorDia,
          maxParticipantes: t.max_participantes ?? DEFAULT_FORM.maxParticipantes,
        };

        setForm(mapped);
        setInitialForm(mapped);
        setIsDirty(false);

        const permisos: PermisosApi =
          tareaData?.data?.permisos ?? tareaData?.permisos ?? {};

        const canEdit = Boolean(permisos.puedeEditar);
        const canDelete = Boolean(permisos.puedeEliminar);

        setPuedeEditar(canEdit);
        setPuedeEliminar(canDelete);

        if (!canEdit) {
          setShowNoPermission(true);
        }
      } catch (err: any) {
        setError(err?.message || 'Error cargando configuración');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [proyectoId, tareaId]);

  const handleSave = async () => {
    if (!proyectoId || !tareaId || !puedeEditar) return;
    if (!form.titulo.trim()) {
      setError('El título es obligatorio');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const dias = Math.max(0, form.tiempoDias || 0);
      const horas = Math.max(0, form.tiempoHoras || 0);
      const minutos = Math.max(0, Math.min(59, form.tiempoMinutos || 0));
      const horasPorDia = form.horasPorDia === 12 ? 12 : 8;

      const totalMinutos = dias * horasPorDia * 60 + horas * 60 + minutos;

      const payload = {
        titulo: form.titulo,
        descripcion: form.descripcion || null,
        prioridad: prioridadUiToApi(form.prioridad),
        estado: estadoUiToApi(form.estado),
        tiempo_estimado_minutos: totalMinutos > 0 ? totalMinutos : null,
        max_participantes: form.maxParticipantes,
      };

      const res = await fetch(
        `/api/proyectos/${proyectoId}/tareas/${tareaId}/configuracion`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const data: any = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Error al guardar la configuración');
      }

      const t = (data?.data?.tarea ?? data?.tarea) as TareaApi | undefined;

      if (t) {
        const totalMin = t.tiempo_estimado_minutos ?? 0;
        const horasPorDiaActual: 8 | 12 = form.horasPorDia;
        const minutosPorDia = horasPorDiaActual * 60;
        const tiempoDias = Math.floor(totalMin / minutosPorDia);
        const resto = totalMin % minutosPorDia;
        const tiempoHoras = Math.floor(resto / 60);
        const tiempoMinutos = resto % 60;

        const mapped: TareaForm = {
          titulo: t.titulo ?? '',
          descripcion: t.descripcion ?? '',
          prioridad: prioridadApiToUi(t.prioridad),
          estado: estadoApiToUi(t.estado),
          tiempoDias,
          tiempoHoras,
          tiempoMinutos,
          horasPorDia: horasPorDiaActual,
          maxParticipantes: t.max_participantes ?? DEFAULT_FORM.maxParticipantes,
        };

        setForm(mapped);
        setInitialForm(mapped);
      }

      setIsDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err?.message || 'Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (!initialForm) return;
    setForm(initialForm);
    setIsDirty(false);
    setSaved(false);
    setError('');
  };

  const handleDelete = async () => {
    if (!proyectoId || !tareaId || !puedeEliminar || deleting) return;

    setDeleting(true);
    setError('');

    try {
      const res = await fetch(
        `/api/proyectos/${proyectoId}/tareas/${tareaId}/configuracion`,
        {
          method: 'DELETE',
          credentials: 'include',
          cache: 'no-store',
        }
      );

      const data: any = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Error al eliminar la tarea');
      }

      setShowDeleteConfirm(false);
      router.push(`/dashboard/proyectos/${proyectoId}/tareas`);
      router.refresh();
    } catch (e: any) {
      setError(e?.message || 'Error al eliminar la tarea');
    } finally {
      setDeleting(false);
    }
  };

  const totalPreviewMinutos =
    Math.max(0, form.tiempoDias || 0) * (form.horasPorDia === 12 ? 12 : 8) * 60 +
    Math.max(0, form.tiempoHoras || 0) * 60 +
    Math.max(0, Math.min(59, form.tiempoMinutos || 0));

  const totalPreviewHoras = Math.floor(totalPreviewMinutos / 60);
  const totalPreviewMinRest = totalPreviewMinutos % 60;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-400 text-center">
            Cargando configuración de la tarea...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-10 pb-32">
      <div className="max-w-4xl mx-auto mb-6 sm:mb-8">
        <div className="relative overflow-hidden rounded-2xl bg-slate-900/40 backdrop-blur-sm border border-slate-700/50 p-4 sm:p-6 lg:p-8 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5" />
          <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-1.5 h-8 bg-gradient-to-b from-purple-500 to-blue-500 rounded-full shrink-0 mt-1" />
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">
                  Configuración de la tarea
                </h1>
                <p className="text-gray-400 mt-1 text-sm max-w-lg truncate">
                  <span className="text-purple-400 font-medium">
                    {form.titulo || 'Sin título'}
                  </span>
                </p>
                {tareaId && (
                  <p className="text-xs text-gray-500 mt-0.5 break-all">ID de tarea: #{tareaId}</p>
                )}
                {readOnly && (
                  <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg border text-xs font-semibold bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                    <Ic.lock />
                    Solo lectura
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
              <div className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-xs font-medium bg-purple-500/10 border-purple-500/30 text-purple-300">
                <Ic.shield />
                Configuración
              </div>

              <button
                type="button"
                onClick={() => router.back()}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900/40 backdrop-blur-sm border border-slate-700/50 text-gray-300 hover:text-white hover:border-slate-600 rounded-xl text-sm font-medium transition-all"
              >
                <Ic.arrow />
                Volver
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-4xl mx-auto mb-5">
          <div className="px-4 py-3 rounded-xl border border-red-500/40 bg-red-500/10 text-sm text-red-300 flex items-start gap-2">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l6.518 11.59C19.021 16.92 18.245 18 17.014 18H2.986c-1.23 0-2.007-1.08-1.247-2.31l6.518-11.59zM11 14a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="break-words">{error}</span>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-5">
        <Section
          title="Información básica"
          subtitle="Título y descripción de la tarea"
          icon={<Ic.edit />}
        >
          <Field
            label="Título de la tarea *"
            hint={!readOnly ? `${tituloLeft} caracteres restantes` : undefined}
            hintColor={tituloLeft < 20 ? 'text-yellow-400' : 'text-gray-500'}
          >
            <input
              type="text"
              maxLength={120}
              value={form.titulo}
              onChange={(e) => !readOnly && update('titulo', e.target.value)}
              placeholder="Ej: Rediseño de pantalla de login"
              className={`${inputCls} ${
                !form.titulo.trim() && !readOnly ? 'border-red-500/40' : ''
              } ${readOnly ? 'cursor-not-allowed opacity-70' : ''}`}
              disabled={readOnly}
            />
            {!form.titulo.trim() && !readOnly && (
              <p className="mt-1.5 text-xs text-red-400">El título es obligatorio</p>
            )}
          </Field>

          <Field label="Descripción">
            <textarea
              rows={4}
              value={form.descripcion}
              onChange={(e) => !readOnly && update('descripcion', e.target.value)}
              placeholder="Describe la tarea en detalle..."
              className={`${inputCls} resize-none ${
                readOnly ? 'cursor-not-allowed opacity-70' : ''
              }`}
              disabled={readOnly}
            />
          </Field>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Section
            title="Estado"
            subtitle="El estado solo se modifica desde el flujo operativo de la tarea"
            icon={<Ic.flag />}
          >
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <label className="block text-sm font-medium text-gray-300">
                  Estado actual de la tarea
                </label>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-600/50 bg-slate-800/60 text-[11px] text-slate-300 w-fit">
                  <Ic.lock />
                  Bloqueado
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {estadoOpts.map((opt) => {
                  const isActive = form.estado === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border cursor-not-allowed
                        ${
                          isActive
                            ? estadoColor(opt.value)
                            : 'bg-slate-800/30 text-slate-500 border-slate-700/40'
                        } ${isActive ? 'opacity-100' : 'opacity-60'}`}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: isActive ? opt.dot : '#4b5563' }}
                      />
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Aquí solo se muestra el estado actual. Para evitar saltos inválidos, no se puede
                cambiar manualmente desde esta pantalla.
              </p>
            </div>
          </Section>

          <Section title="Prioridad" subtitle="Nivel de urgencia" icon={<Ic.flag />}>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Nivel de prioridad
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {prioridadOpts.map((opt) => {
                  const isActive = form.prioridad === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => !readOnly && update('prioridad', opt.value)}
                      disabled={readOnly}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border
                        ${
                          isActive
                            ? prioridadColor(opt.value)
                            : 'bg-slate-800/50 text-gray-400 hover:bg-slate-700/50 border-slate-700/50'
                        }
                        ${readOnly ? 'opacity-60 cursor-not-allowed hover:bg-slate-800/50' : ''}`}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: isActive ? opt.dot : '#4b5563' }}
                      />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </Section>
        </div>

        <Section
          title="Tiempo y capacidad"
          subtitle="Estimación y límite de participantes"
          icon={<Ic.clock />}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5">
            <Field label="Días" hint="Cantidad de días estimados.">
              <input
                type="number"
                min={0}
                max={999}
                value={Number.isFinite(form.tiempoDias) ? form.tiempoDias : ''}
                onChange={(e) =>
                  !readOnly && update('tiempoDias', Math.max(0, Number(e.target.value) || 0))
                }
                className={`${inputCls} ${readOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                placeholder="0"
                disabled={readOnly}
              />
            </Field>

            <Field label="Horas por día" hint="Equivalencia para convertir días.">
              <select
                value={form.horasPorDia}
                onChange={(e) =>
                  !readOnly && update('horasPorDia', Number(e.target.value) === 12 ? 12 : 8)
                }
                className={`${inputCls} ${readOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                disabled={readOnly}
              >
                <option value={8}>8 horas</option>
                <option value={12}>12 horas</option>
              </select>
            </Field>

            <Field label="Horas" hint="Horas adicionales fuera de los días.">
              <input
                type="number"
                min={0}
                max={999}
                value={Number.isFinite(form.tiempoHoras) ? form.tiempoHoras : ''}
                onChange={(e) =>
                  !readOnly && update('tiempoHoras', Math.max(0, Number(e.target.value) || 0))
                }
                className={`${inputCls} ${readOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                placeholder="0"
                disabled={readOnly}
              />
            </Field>

            <Field label="Minutos" hint="0 a 59 minutos adicionales.">
              <input
                type="number"
                min={0}
                max={59}
                value={Number.isFinite(form.tiempoMinutos) ? form.tiempoMinutos : ''}
                onChange={(e) => {
                  if (readOnly) return;
                  update('tiempoMinutos', Math.max(0, Math.min(59, Number(e.target.value) || 0)));
                }}
                className={`${inputCls} ${readOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                placeholder="0"
                disabled={readOnly}
              />
            </Field>

            <Field
              label="Máximo de participantes"
              hint="Límite máximo permitido para esta tarea."
            >
              <input
                type="number"
                min={1}
                max={50}
                value={Number.isFinite(form.maxParticipantes) ? form.maxParticipantes : ''}
                onChange={(e) =>
                  !readOnly &&
                  update('maxParticipantes', Math.max(1, Number(e.target.value) || 1))
                }
                className={`${inputCls} ${readOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                placeholder="1"
                disabled={readOnly}
              />
            </Field>
          </div>

          <div className="mt-4 rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-3">
            <p className="text-xs text-slate-400">
              Total estimado:
              <span className="ml-2 font-semibold text-purple-300">
                {totalPreviewMinutos <= 0
                  ? '0m'
                  : `${totalPreviewHoras}h ${String(totalPreviewMinRest).padStart(2, '0')}m`}
              </span>
            </p>
          </div>
        </Section>

        {puedeEliminar && (
          <Section
            title="Zona de peligro"
            subtitle="Acciones irreversibles sobre esta tarea"
            icon={<Ic.warn />}
            danger
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-red-950/20 border border-red-500/20 rounded-xl">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">Eliminar esta tarea</p>
                <p className="text-xs text-gray-500 mt-0.5 break-words">
                  Se eliminará por completo la tarea del proyecto. Esta acción no se puede
                  deshacer.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600/80 hover:bg-red-500 border border-red-500/50 text-white rounded-xl text-sm font-semibold transition-all"
              >
                <Ic.trash />
                Eliminar
              </button>
            </div>
          </Section>
        )}
      </div>

      <div
        className={`fixed bottom-0 left-0 right-0 z-50 px-4 sm:px-6 lg:px-8 py-4 bg-slate-950/90 backdrop-blur-xl border-t border-slate-700/50 transition-transform duration-300 ease-out ${
          isDirty && puedeEditar ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-gray-400 hidden sm:block">
            Tienes cambios <span className="text-white font-medium">sin guardar</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:ml-auto w-full sm:w-auto">
            <button
              type="button"
              onClick={handleDiscard}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-900/40 backdrop-blur-sm border border-slate-700/50 text-gray-300 hover:text-white hover:border-slate-600 rounded-xl text-sm font-medium transition-all"
            >
              Descartar
            </button>

            <button
              type="button"
              onClick={() => {
                if (puedeEditar && !saving && isDirty) setShowSaveConfirm(true);
              }}
              disabled={saving || !form.titulo.trim() || !puedeEditar}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01] sm:hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {saving && (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              )}
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`fixed top-4 right-4 sm:top-6 sm:right-6 z-[200] flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium px-4 sm:px-5 py-3 rounded-xl shadow-xl transition-all duration-300 max-w-[calc(100vw-2rem)] sm:max-w-sm ${
          saved ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        <Ic.check />
        <span className="break-words">Tarea actualizada correctamente</span>
      </div>

      <ConfirmModal
        isOpen={showSaveConfirm}
        title="Guardar configuración"
        message={`¿Deseas guardar los cambios en "${
          form.titulo || 'esta tarea'
        }"? Los cambios se aplicarán de inmediato para todos los miembros del proyecto.`}
        confirmText="Guardar cambios"
        cancelText="Cancelar"
        type="default"
        isLoading={saving}
        onConfirm={() => {
          setShowSaveConfirm(false);
          handleSave();
        }}
        onCancel={() => setShowSaveConfirm(false)}
      />

      <ConfirmModal
        isOpen={showNoPermission}
        title="Sin permisos de edición"
        message={`No tienes permisos para modificar la configuración de "${
          form.titulo || 'esta tarea'
        }". Puedes ver los datos, pero los campos están bloqueados. Contacta al dueño o un administrador del proyecto para obtener acceso.`}
        confirmText="Entendido"
        cancelText="Cerrar"
        type="warning"
        onConfirm={() => setShowNoPermission(false)}
        onCancel={() => router.back()}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Eliminar tarea"
        message={`¿Seguro que deseas eliminar "${
          form.titulo || 'esta tarea'
        }"? Se borrará permanentemente del proyecto. Esta acción no se puede deshacer.`}
        confirmText="Eliminar tarea"
        cancelText="Cancelar"
        type="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}