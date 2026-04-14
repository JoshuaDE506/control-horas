// app/dashboard/proyectos/[id]/miembros/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import SolicitudesModal from '@/components/SolicitudesModal';
import ConfirmModal from '@/components/ConfirmModal';

// ─── Types ─────────────────────────────────────────────────────────────────────

type RolProyecto = 'owner' | 'admin' | 'miembro';
type ModoAcceso = 'publico' | 'solicitud' | 'privado';

interface Miembro {
  id: string;
  nombre: string;
  apellido: string;
  nombre_completo: string;
  email: string;
  pais: string | null;
  fecha_union: string | null;
  rol: RolProyecto;
  tareas_asignadas?: number;
}

interface MiembroApi {
  id: string | number;
  nombre?: string | null;
  apellido?: string | null;
  nombre_completo?: string | null;
  email?: string | null;
  pais?: string | null;
  pais?: string | null;
  fecha_union?: string | null;
  rol?: string | null;
  tareas_asignadas?: number | null;
}

interface UsuarioBusqueda {
  id: string;
  nombre: string;
  apellido?: string;
  email: string;
}

function esMiembroProyecto(miembros: Miembro[], usuarioId: string | number) {
  return miembros.some((m) => String(m.id) === String(usuarioId));
}

type CambioRolState = {
  miembro: Miembro;
  nuevoRol: 'admin' | 'miembro';
} | null;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(nombre: string, apellido?: string) {
  return `${nombre?.[0] ?? ''}${apellido?.[0] ?? ''}`.toUpperCase() || '?';
}

function getAvatarColor(id: string) {
  const colors = [
    'from-purple-600 to-blue-600',
    'from-pink-600 to-rose-600',
    'from-emerald-600 to-teal-600',
    'from-orange-600 to-amber-600',
    'from-indigo-600 to-violet-600',
    'from-cyan-600 to-sky-600',
    'from-fuchsia-600 to-purple-600',
  ];
  const index = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return colors[index % colors.length];
}

function formatFecha(fecha: string | null) {
  if (!fecha) return null;
  return new Date(fecha).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function normalizarRol(valor: unknown): RolProyecto {
  const v = String(valor ?? '').trim().toLowerCase();
  if (v === 'owner' || v === 'dueño' || v === 'dueno') return 'owner';
  if (v === 'admin' || v === 'administrador') return 'admin';
  return 'miembro';
}

function adaptarMiembro(row: MiembroApi): Miembro {
  const nombre = String(row?.nombre ?? '');
  const apellido = String(row?.apellido ?? '');
  return {
    id: String(row?.id ?? ''),
    nombre,
    apellido,
    nombre_completo:
      String(row?.nombre_completo ?? '').trim() || `${nombre} ${apellido}`.trim(),
    email: String(row?.email ?? ''),
    pais: row?.pais ?? row?.pais ?? null,
    fecha_union: row?.fecha_union ?? null,
    rol: normalizarRol(row?.rol),
    tareas_asignadas: Number(row?.tareas_asignadas ?? 0),
  };
}

const ROL_CONFIG: Record<
  RolProyecto,
  { label: string; cls: string; activeCls: string; dot: string }
> = {
  owner: {
    label: 'Dueño',
    cls: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    activeCls:
      'bg-purple-500/20 text-purple-200 border-purple-400/60 shadow-sm shadow-purple-500/20',
    dot: '#a78bfa',
  },
  admin: {
    label: 'Admin',
    cls: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    activeCls:
      'bg-blue-500/20 text-blue-200 border-blue-400/60 shadow-sm shadow-blue-500/20',
    dot: '#60a5fa',
  },
  miembro: {
    label: 'Miembro',
    cls: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    activeCls: 'bg-slate-600/30 text-slate-200 border-slate-400/50 shadow-sm',
    dot: '#94a3b8',
  },
};

const inputCls =
  'w-full px-4 py-3 bg-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all outline-none';

// ─── Icons ─────────────────────────────────────────────────────────────────────

const Ic = {
  arrow: () => (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  ),
  users: () => (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"
      />
    </svg>
  ),
  search: () => (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  plus: () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  trash: () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  ),
  shield: () => (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  ),
  warn: () => (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  ),
  check: () => (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  ),
  globe: () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"
      />
    </svg>
  ),
  calendar: () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  ),
  x: () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  task: () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  ),
  crown: () => (
    <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  ),
  userPlus: () => (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
      />
    </svg>
  ),
};

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({
  message,
  type,
  visible,
}: {
  message: string;
  type: 'success' | 'error';
  visible: boolean;
}) {
  return (
    <div
      className={`fixed right-4 top-4 z-[400] flex max-w-[calc(100vw-2rem)] items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-xl transition-all duration-300 sm:right-6 sm:top-6 sm:max-w-md sm:px-5
      ${
        type === 'success'
          ? 'border-green-500/30 bg-green-500/10 text-green-400'
          : 'border-red-500/30 bg-red-500/10 text-red-400'
      }
      ${visible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'}`}
    >
      {type === 'success' ? <Ic.check /> : <Ic.warn />}
      <span className="break-words">{message}</span>
    </div>
  );
}

function RolBadge({ rol }: { rol: RolProyecto }) {
  const cfg = ROL_CONFIG[rol];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${cfg.cls}`}
    >
      <span
        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
        style={{ background: cfg.dot }}
      />
      {cfg.label}
    </span>
  );
}

function RolSwitcher({
  rol,
  loading,
  onSwitch,
}: {
  rol: 'admin' | 'miembro';
  loading: boolean;
  onSwitch: (r: 'admin' | 'miembro') => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-slate-700/50 bg-slate-800/70 p-1">
      {(['admin', 'miembro'] as const).map((opt) => {
        const isActive = rol === opt;
        const cfg = ROL_CONFIG[opt];
        return (
          <button
            key={opt}
            type="button"
            onClick={() => !isActive && !loading && onSwitch(opt)}
            disabled={loading || isActive}
            title={isActive ? `Rol actual: ${cfg.label}` : `Pasar a ${cfg.label}`}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-200 select-none ${
              isActive
                ? cfg.activeCls
                : 'border-transparent bg-transparent text-gray-400 hover:bg-slate-700/50 hover:text-gray-200'
            } disabled:cursor-default`}
          >
            {loading && isActive ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />
            ) : (
              <span
                className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ background: isActive ? cfg.dot : '#4b5563' }}
              />
            )}
            {cfg.label}
          </button>
        );
      })}
    </div>
  );
}

function ChangeRoleModal({
  miembro,
  nuevoRol,
  loading,
  onConfirm,
  onCancel,
}: {
  miembro: Miembro;
  nuevoRol: 'admin' | 'miembro';
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const actualLabel = ROL_CONFIG[miembro.rol].label;
  const nuevoLabel = ROL_CONFIG[nuevoRol].label;

  return (
    <div className="fixed inset-0 z-[310] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={!loading ? onCancel : undefined}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-700/50 bg-slate-900 p-5 shadow-2xl sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400">
            <Ic.shield />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Cambiar rol del miembro</h3>
            <p className="mt-0.5 text-xs text-gray-400">
              Estás a punto de cambiar los permisos dentro del proyecto.
            </p>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-700/40 bg-slate-800/50 p-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarColor(
              miembro.id,
            )} text-sm font-bold text-white`}
          >
            {getInitials(miembro.nombre, miembro.apellido)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              {miembro.nombre_completo}
            </p>
            <p className="truncate text-xs text-gray-400">{miembro.email}</p>
          </div>
        </div>

        <div className="mb-5 rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
          <p className="mb-2 text-xs text-gray-400">Rol actual → nuevo rol</p>
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <RolBadge rol={miembro.rol} />
            <span className="text-xs text-gray-500">→</span>
            <RolBadge rol={nuevoRol} />
          </div>
          <p className="mt-3 text-xs text-gray-400">
            El usuario pasará de{' '}
            <span className="font-semibold text-gray-200">{actualLabel}</span> a{' '}
            <span className="font-semibold text-gray-200">{nuevoLabel}</span>.
          </p>
        </div>

        <p className="mb-5 text-xs text-gray-400">
          ¿Seguro que deseas aplicar este cambio de rol?
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-2.5 text-sm font-medium text-gray-300 transition-all hover:text-white disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            )}
            Confirmar cambio
          </button>
        </div>
      </div>
    </div>
  );
}

function RemoveMemberModal({
  miembro,
  loading,
  onConfirm,
  onCancel,
}: {
  miembro: Miembro;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const n = miembro.tareas_asignadas ?? 0;
  const tieneTareas = n > 0;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={!loading ? onCancel : undefined}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-700/50 bg-slate-900 p-5 shadow-2xl sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-400">
            <Ic.warn />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Eliminar miembro</h3>
            <p className="mt-0.5 text-xs text-gray-400">
              Esta acción retira el acceso al proyecto
            </p>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-700/40 bg-slate-800/50 p-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarColor(
              miembro.id,
            )} text-sm font-bold text-white`}
          >
            {getInitials(miembro.nombre, miembro.apellido)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              {miembro.nombre_completo}
            </p>
            <p className="truncate text-xs text-gray-400">{miembro.email}</p>
          </div>
          <RolBadge rol={miembro.rol} />
        </div>

        {tieneTareas ? (
          <div className="mb-5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-4">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex-shrink-0 text-amber-400">
                <Ic.task />
              </span>
              <div>
                <p className="text-sm font-semibold text-amber-300">
                  {n} tarea{n > 1 ? 's' : ''} asignada{n > 1 ? 's' : ''}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-amber-400/80">
                  Las tareas se conservarán en el proyecto pero quedarán sin asignar.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-5 rounded-xl border border-slate-700/30 bg-slate-800/30 p-3">
            <p className="flex items-center gap-2 text-xs text-gray-400">
              <Ic.check />
              Sin tareas asignadas en este proyecto.
            </p>
          </div>
        )}

        <p className="mb-5 text-xs text-gray-400">
          El miembro perderá acceso inmediato al proyecto y todo su contenido.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-2.5 text-sm font-medium text-gray-300 transition-all hover:text-white disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            )}
            {tieneTareas ? 'Eliminar y liberar tareas' : 'Eliminar del proyecto'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MiembroCard({
  miembro,
  esYo,
  puedeGestionar,
  puedeEdit,
  puedeDel,
  rolLoad,
  delLoad,
  miId,
  onOpenChangeRole,
  onOpenDelete,
}: {
  miembro: Miembro;
  esYo: boolean;
  puedeGestionar: boolean;
  puedeEdit: boolean;
  puedeDel: boolean;
  rolLoad: boolean;
  delLoad: boolean;
  miId: string | null;
  onOpenChangeRole: (m: Miembro, r: 'admin' | 'miembro') => void;
  onOpenDelete: (m: Miembro) => void;
}) {
  const esOwner = miembro.rol === 'owner';
  const n = miembro.tareas_asignadas ?? 0;

  return (
    <div
      className={`rounded-2xl border p-4 ${
        esYo ? 'border-purple-500/20 bg-purple-500/[0.03]' : 'border-slate-700/50 bg-slate-900/30'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarColor(
              miembro.id,
            )} text-sm font-bold text-white`}
          >
            {getInitials(miembro.nombre, miembro.apellido)}
          </div>
          {esOwner && (
            <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-slate-900 bg-purple-600">
              <Ic.crown />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-words text-sm font-semibold text-white">
              {miembro.nombre_completo}
            </span>
            {esYo && (
              <span className="rounded-md border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">
                Tú
              </span>
            )}
            {n > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                <Ic.task />
                {n} tarea{n > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <p className="mt-1 break-all text-xs text-gray-400">{miembro.email}</p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            {miembro.pais && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <Ic.globe />
                {miembro.pais}
              </span>
            )}
            {miembro.fecha_union && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <Ic.calendar />
                Se unió {formatFecha(miembro.fecha_union)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {puedeEdit && (miembro.rol === 'admin' || miembro.rol === 'miembro') ? (
            <RolSwitcher
              rol={miembro.rol}
              loading={rolLoad}
              onSwitch={(nr) => onOpenChangeRole(miembro, nr)}
            />
          ) : (
            <RolBadge rol={miembro.rol} />
          )}
        </div>

        {puedeGestionar && puedeDel && (
          <button
            type="button"
            onClick={() => onOpenDelete(miembro)}
            disabled={delLoad}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-400 transition-all hover:border-red-500/30 hover:bg-red-500/10 sm:w-auto"
          >
            {delLoad ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-500/20 border-t-red-500" />
            ) : (
              <Ic.trash />
            )}
            Quitar
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MiembrosPage() {
  const { id: proyectoId } = useParams<{ id: string }>();
  const router = useRouter();

  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [miRol, setMiRol] = useState<RolProyecto | null>(null);
  const [miId, setMiId] = useState<string | null>(null);
  const [modoAcceso, setModoAcceso] = useState<ModoAcceso | null>(null);

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<UsuarioBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [rolNuevo, setRolNuevo] = useState<'admin' | 'miembro'>('miembro');
  const searchRef = useRef<HTMLDivElement>(null);

  const [pendienteAgregar, setPendienteAgregar] = useState<UsuarioBusqueda | null>(null);

  const [filtroRol, setFiltroRol] = useState<'todos' | RolProyecto>('todos');
  const [busquedaLocal, setBusquedaLocal] = useState('');

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState<Miembro | null>(null);
  const [cambioRol, setCambioRol] = useState<CambioRolState>(null);

  const [showSolicitudes, setShowSolicitudes] = useState(false);

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
    visible: boolean;
  }>({
    message: '',
    type: 'success',
    visible: false,
  });

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type, visible: true });
      setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3200);
    },
    [],
  );

  const fetchMiembros = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [membRes, sessRes, projRes] = await Promise.all([
        fetch(`/api/proyectos/${proyectoId}/miembros`, {
          credentials: 'include',
          cache: 'no-store',
        }),
        fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' }),
        fetch(`/api/proyectos/${proyectoId}`, {
          credentials: 'include',
          cache: 'no-store',
        }),
      ]);

      const membData = await membRes.json().catch(() => ({}));
      if (!membRes.ok) {
        throw new Error(membData?.error || 'Error al cargar miembros');
      }

      const sessData = await sessRes.json().catch(() => ({}));
      const userId =
        sessData?.user?.id ??
        sessData?.id ??
        sessData?.data?.id ??
        null;

      setMiId(userId ? String(userId) : null);

      const listaRaw = Array.isArray(membData?.data)
        ? membData.data
        : Array.isArray(membData?.miembros)
        ? membData.miembros
        : [];

      const lista: Miembro[] = listaRaw.map(adaptarMiembro);
      setMiembros(lista);

      if (projRes.ok) {
        const projData = await projRes.json().catch(() => ({}));
        const rawModo = String(projData?.proyecto?.modo_acceso ?? '').toLowerCase();

        if (rawModo === 'publico' || rawModo === 'privado' || rawModo === 'solicitud') {
          setModoAcceso(rawModo as ModoAcceso);
        } else {
          setModoAcceso(null);
        }

        const creadorId = String(projData?.proyecto?.creador_id ?? '');
        if (userId && creadorId && String(userId) === creadorId) {
          setMiRol('owner');
        } else if (userId) {
          const yo = lista.find((m) => String(m.id) === String(userId));
          setMiRol(yo?.rol ?? null);
        } else {
          setMiRol(null);
        }
      } else {
        setModoAcceso(null);
        if (userId) {
          const yo = lista.find((m) => String(m.id) === String(userId));
          setMiRol(yo?.rol ?? null);
        } else {
          setMiRol(null);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Error cargando miembros');
      setMiembros([]);
      setMiRol(null);
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    fetchMiembros();
  }, [fetchMiembros]);

  useEffect(() => {
    if (!busqueda.trim() || busqueda.length < 2 || pendienteAgregar) {
      setResultados([]);
      return;
    }

    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await fetch(
          `/api/user/buscar?q=${encodeURIComponent(busqueda)}`,
          { credentials: 'include', cache: 'no-store' },
        );
        const data = await res.json().catch(() => ({}));

        const usuarios = Array.isArray(data?.usuarios)
          ? data.usuarios
          : Array.isArray(data?.data)
          ? data.data
          : [];

        const filtrados = usuarios.filter((u: UsuarioBusqueda) => {
          const yaEsMiembro = esMiembroProyecto(miembros, u.id);
          const esElMismoUsuario = miId ? String(miId) === String(u.id) : false;
          return !yaEsMiembro && !esElMismoUsuario;
        });

        setResultados(filtrados.slice(0, 8));
      } catch {
        setResultados([]);
      } finally {
        setBuscando(false);
      }
    }, 300);

    return () => clearTimeout(t);
  }, [busqueda, miembros, miId, pendienteAgregar]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setResultados([]);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const solicitarAgregar = (u: UsuarioBusqueda) => {
    if (actionLoading) return;

    if (esMiembroProyecto(miembros, u.id)) {
      setResultados([]);
      showToast('Ese usuario ya forma parte del proyecto', 'error');
      return;
    }

    setResultados([]);
    setBusqueda('');
    setShowAddPanel(false);
    setPendienteAgregar(u);
  };

  const agregarMiembro = async (u: UsuarioBusqueda) => {
    if (esMiembroProyecto(miembros, u.id)) {
      setPendienteAgregar(null);
      setResultados([]);
      showToast('Ese usuario ya forma parte del proyecto', 'error');
      return;
    }

    setActionLoading(`add-${u.id}`);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/miembros`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: u.id, rol_en_proyecto: rolNuevo }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Error al agregar');

      setBusqueda('');
      setResultados([]);
      setPendienteAgregar(null);
      setShowAddPanel(false);
      await fetchMiembros();
      showToast(`${u.nombre} ${u.apellido ?? ''} agregado como ${ROL_CONFIG[rolNuevo].label}`);
    } catch (err: any) {
      showToast(err?.message || 'Error al agregar miembro', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const cambiarRol = async (miembro: Miembro, nuevoRol: 'admin' | 'miembro') => {
    const key = `rol-${miembro.id}`;
    setActionLoading(key);

    const rolAnterior = miembro.rol;
    setMiembros((prev) =>
      prev.map((m) => (m.id === miembro.id ? { ...m, rol: nuevoRol } : m)),
    );

    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/miembros`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: miembro.id, rol_en_proyecto: nuevoRol }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Error al actualizar rol');

      showToast(`${miembro.nombre} ahora es ${ROL_CONFIG[nuevoRol].label}`);
    } catch (err: any) {
      setMiembros((prev) =>
        prev.map((m) => (m.id === miembro.id ? { ...m, rol: rolAnterior } : m)),
      );
      showToast(err?.message || 'Error al cambiar rol', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const eliminarMiembro = async () => {
    if (!eliminando) return;

    const key = `del-${eliminando.id}`;
    setActionLoading(key);

    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/miembros`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: eliminando.id, liberar_tareas: true }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Error al eliminar');

      const n = eliminando.tareas_asignadas ?? 0;
      showToast(
        n > 0
          ? `${eliminando.nombre_completo} eliminado · ${n} tarea${n > 1 ? 's' : ''} liberada${n > 1 ? 's' : ''}`
          : `${eliminando.nombre_completo} eliminado del proyecto`,
      );

      setEliminando(null);
      await fetchMiembros();
    } catch (err: any) {
      showToast(err?.message || 'Error al eliminar miembro', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const puedeGestionar = miRol === 'owner' || miRol === 'admin';

  const miembrosFiltrados = miembros.filter((m) => {
    const matchRol = filtroRol === 'todos' || m.rol === filtroRol;
    const query = busquedaLocal.trim().toLowerCase();

    const matchText =
      !query ||
      m.nombre_completo.toLowerCase().includes(query) ||
      m.email.toLowerCase().includes(query) ||
      (m.pais ?? '').toLowerCase().includes(query);

    return matchRol && matchText;
  });

  const stats = {
    total: miembros.length,
    owners: miembros.filter((m) => m.rol === 'owner').length,
    admins: miembros.filter((m) => m.rol === 'admin').length,
    miembros: miembros.filter((m) => m.rol === 'miembro').length,
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-purple-500/20 border-t-purple-500" />
          <p className="mt-4 text-sm text-gray-400">Cargando miembros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-10">
      <div className="mx-auto mb-6 max-w-5xl sm:mb-8">
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 p-4 shadow-xl backdrop-blur-sm sm:p-6 lg:p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5" />
          <div className="relative z-10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-7 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-purple-500 to-blue-500 sm:h-8" />
                  <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-white sm:text-3xl">
                      Miembros del Proyecto
                    </h1>
                    <p className="mt-1 text-sm text-gray-400">
                      Gestiona el equipo, roles y accesos
                    </p>
                  </div>
                </div>

                <div className="mt-4 ml-[18px] flex flex-wrap items-center gap-4 text-sm sm:ml-[22px] sm:gap-6">
                  {(
                    [
                      { label: 'Total', value: stats.total, color: 'bg-white' },
                      { label: 'Dueño', value: stats.owners, color: 'bg-purple-400' },
                      { label: 'Admins', value: stats.admins, color: 'bg-blue-400' },
                      { label: 'Miembros', value: stats.miembros, color: 'bg-slate-400' },
                    ] as const
                  ).map((s) => (
                    <div key={s.label} className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${s.color}`} />
                      <span className="font-medium text-gray-300">{s.value}</span>
                      <span className="text-gray-500">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
                {miRol && (
                  <div
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium sm:justify-start ${ROL_CONFIG[miRol].cls}`}
                  >
                    <Ic.shield />
                    Tu rol: {ROL_CONFIG[miRol].label}
                  </div>
                )}

                {modoAcceso === 'solicitud' && puedeGestionar && (
                  <button
                    type="button"
                    onClick={() => setShowSolicitudes(true)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-slate-900/40 px-4 py-2.5 text-sm font-medium text-amber-200 transition-all hover:border-amber-400 hover:bg-amber-500/20 hover:text-white"
                  >
                    <Ic.users />
                    Solicitudes
                  </button>
                )}

                {puedeGestionar && (
                  <button
                    type="button"
                    onClick={() => {
                      if (pendienteAgregar || actionLoading) return;
                      setShowAddPanel((v) => !v);
                      if (showAddPanel) {
                        setBusqueda('');
                        setResultados([]);
                      }
                    }}
                    className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300 ${
                      showAddPanel
                        ? 'border border-slate-600/50 bg-slate-700/60 text-gray-300'
                        : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg hover:scale-[1.01] hover:shadow-xl sm:hover:scale-105'
                    }`}
                  >
                    <span
                      className={`transition-transform duration-300 ${
                        showAddPanel ? 'rotate-45' : ''
                      }`}
                    >
                      <Ic.plus />
                    </span>
                    {showAddPanel ? 'Cancelar' : 'Agregar miembro'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => router.back()}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-2.5 text-sm font-medium text-gray-300 transition-all hover:border-slate-600 hover:text-white"
                >
                  <Ic.arrow />
                  Volver
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-5">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            <Ic.warn />
            <span>{error}</span>
            <button
              onClick={fetchMiembros}
              className="ml-auto text-xs underline transition-colors hover:text-red-300"
            >
              Reintentar
            </button>
          </div>
        )}

        <div
          className={`relative transition-all duration-500 ease-in-out ${
            showAddPanel && !pendienteAgregar
              ? 'z-[120] translate-y-0 overflow-visible opacity-100'
              : 'pointer-events-none z-0 h-0 -translate-y-2 overflow-hidden opacity-0'
          }`}
        >
          <div className="relative z-[120] overflow-visible rounded-2xl border border-slate-700/50 bg-slate-900/40 p-4 shadow-xl backdrop-blur-sm sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="mt-0.5 h-6 w-1 shrink-0 rounded-full bg-gradient-to-b from-purple-500 to-blue-500" />
              <div className="flex items-start gap-2.5">
                <span className="text-gray-400">
                  <Ic.userPlus />
                </span>
                <div>
                  <h2 className="text-base font-bold text-white">Agregar miembro</h2>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Busca por nombre o correo · mín. 2 caracteres
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
              <div ref={searchRef} className="relative z-[130] min-w-0 flex-1">
                <div className="relative">
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Nombre o correo del usuario..."
                    className={`${inputCls} pl-11`}
                  />
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <Ic.search />
                  </span>
                  {busqueda && (
                    <button
                      type="button"
                      onClick={() => {
                        setBusqueda('');
                        setResultados([]);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-gray-300"
                    >
                      <Ic.x />
                    </button>
                  )}
                </div>

                {(buscando ||
                  resultados.length > 0 ||
                  (!buscando && busqueda.trim().length >= 2 && resultados.length === 0)) &&
                  busqueda.trim().length >= 2 &&
                  !pendienteAgregar && (
                    <div className="absolute left-0 right-0 top-full z-[140] mt-2 overflow-hidden rounded-2xl border border-slate-600/60 bg-slate-900 shadow-2xl shadow-black/60 ring-1 ring-white/5">
                      <div className="border-b border-slate-800/60 bg-slate-800/40 px-4 py-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          {buscando
                            ? 'Buscando...'
                            : `${resultados.length} resultado${resultados.length !== 1 ? 's' : ''}`}
                        </p>
                      </div>

                      {buscando && (
                        <div className="flex items-center gap-3 px-4 py-4 text-sm text-gray-400">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-purple-500/30 border-t-purple-500 flex-shrink-0" />
                          <span>Buscando usuarios...</span>
                        </div>
                      )}

                      {!buscando && resultados.length === 0 && (
                        <div className="px-4 py-5 text-center">
                          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/50 bg-slate-800/60 text-gray-500">
                            <Ic.search />
                          </div>
                          <p className="text-sm font-medium text-gray-400">Sin resultados</p>
                          <p className="mt-0.5 text-xs text-gray-600">
                            No se encontró "{busqueda}"
                          </p>
                        </div>
                      )}

                      {!buscando && resultados.length > 0 && (
                        <div className="max-h-[280px] overflow-y-auto py-1">
                          {resultados.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                solicitarAgregar(u);
                              }}
                              disabled={actionLoading === `add-${u.id}`}
                              className="group/item flex w-full items-center gap-3 border-b border-slate-800/30 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-800/60 active:bg-slate-700/60 disabled:opacity-60"
                            >
                              <div
                                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarColor(u.id)} text-sm font-bold text-white ring-2 ring-slate-800`}
                              >
                                {getInitials(u.nombre, u.apellido)}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="truncate leading-tight text-sm font-semibold text-white">
                                  {u.nombre} {u.apellido ?? ''}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-gray-400">
                                  {u.email}
                                </p>
                              </div>

                              <span className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-300 transition-all group-hover/item:border-purple-400/50 group-hover/item:bg-purple-500/20 group-hover/item:text-purple-200">
                                {actionLoading === `add-${u.id}` ? (
                                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-purple-400/30 border-t-purple-400" />
                                ) : (
                                  <Ic.plus />
                                )}
                                Agregar
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 border-t border-slate-800/60 bg-slate-800/30 px-4 py-2.5">
                        <span className="text-[11px] text-gray-500">Se agregará como:</span>
                        <RolBadge rol={rolNuevo} />
                      </div>
                    </div>
                  )}
              </div>

              <div className="flex flex-col gap-1.5 lg:w-auto">
                <span className="ml-1 text-xs text-gray-500">Rol inicial</span>
                <div className="flex flex-wrap gap-1 rounded-xl border border-slate-700/50 bg-slate-800/60 p-1">
                  {(['miembro', 'admin'] as const).map((r) => {
                    const cfg = ROL_CONFIG[r];
                    const isActive = rolNuevo === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRolNuevo(r)}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all duration-200 ${
                          isActive
                            ? cfg.activeCls
                            : 'border-transparent bg-transparent text-gray-400 hover:bg-slate-700/40 hover:text-gray-200'
                        }`}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: isActive ? cfg.dot : '#4b5563' }}
                        />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <input
              type="text"
              value={busquedaLocal}
              onChange={(e) => setBusquedaLocal(e.target.value)}
              placeholder="Filtrar por nombre, correo o país..."
              className={`${inputCls} py-2.5 pl-11`}
            />
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
              <Ic.search />
            </span>
            {busquedaLocal && (
              <button
                type="button"
                onClick={() => setBusquedaLocal('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-gray-300"
              >
                <Ic.x />
              </button>
            )}
          </div>

          <div className="w-full overflow-x-auto lg:w-auto">
            <div className="flex w-max min-w-full gap-2 lg:min-w-0">
              {(['todos', 'owner', 'admin', 'miembro'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setFiltroRol(r)}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                    filtroRol === r
                      ? 'border-purple-500/50 bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                      : 'border-slate-700/50 bg-slate-900/40 text-gray-400 hover:border-slate-600 hover:text-gray-200'
                  }`}
                >
                  {r === 'todos' ? 'Todos' : ROL_CONFIG[r].label}
                  <span className="ml-1.5 text-xs opacity-60">
                    {r === 'todos'
                      ? stats.total
                      : miembros.filter((m) => m.rol === r).length}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-0 overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 shadow-xl backdrop-blur-sm">
          <div
            className="hidden border-b border-slate-800/60 bg-slate-900/30 px-6 py-3 sm:grid"
            style={{ gridTemplateColumns: '44px 1fr auto auto' }}
          >
            <div />
            <span className="self-center text-xs font-semibold uppercase tracking-wider text-gray-500">
              Miembro
            </span>
            <span className="self-center pr-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Rol
            </span>
            {puedeGestionar && <div className="w-8" />}
          </div>

          {miembrosFiltrados.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-800/50 text-gray-500">
                <Ic.users />
              </div>
              <p className="font-medium text-gray-300">Sin miembros</p>
              <p className="mt-1 text-sm text-gray-500">Prueba con otro filtro</p>
            </div>
          ) : (
            <>
              <div className="hidden divide-y divide-slate-800/50 sm:block">
                {miembrosFiltrados.map((m) => {
                  const esYo = String(m.id) === String(miId);
                  const esOwner = m.rol === 'owner';
                  const puedeEdit = puedeGestionar && !esOwner;
                  const puedeDel = puedeGestionar && !esOwner && !esYo;
                  const rolLoad = actionLoading === `rol-${m.id}`;
                  const delLoad = actionLoading === `del-${m.id}`;
                  const n = m.tareas_asignadas ?? 0;

                  return (
                    <div
                      key={m.id}
                      className={`group flex items-center gap-4 px-6 py-4 transition-all ${
                        esYo ? 'bg-purple-500/[0.03]' : 'hover:bg-slate-800/20'
                      }`}
                    >
                      <div className="relative flex-shrink-0">
                        <div
                          className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarColor(
                            m.id,
                          )} text-sm font-bold text-white`}
                        >
                          {getInitials(m.nombre, m.apellido)}
                        </div>
                        {esOwner && (
                          <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-slate-900 bg-purple-600">
                            <Ic.crown />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-white">
                            {m.nombre_completo}
                          </span>
                          {esYo && (
                            <span className="rounded-md border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">
                              Tú
                            </span>
                          )}
                          {n > 0 && (
                            <span className="hidden items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400 md:flex">
                              <Ic.task />
                              {n} tarea{n > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>

                        <div className="mt-0.5 flex flex-wrap items-center gap-3">
                          <span className="max-w-[220px] truncate text-xs text-gray-400">
                            {m.email}
                          </span>
                          {m.pais && (
                            <span className="hidden items-center gap-1 text-xs text-gray-500 lg:flex">
                              <Ic.globe />
                              {m.pais}
                            </span>
                          )}
                          {m.fecha_union && (
                            <span className="hidden items-center gap-1 text-xs text-gray-500 xl:flex">
                              <Ic.calendar />
                              Se unió {formatFecha(m.fecha_union)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        {puedeEdit && (m.rol === 'admin' || m.rol === 'miembro') ? (
                          <RolSwitcher
                            rol={m.rol}
                            loading={rolLoad}
                            onSwitch={(nr) => setCambioRol({ miembro: m, nuevoRol: nr })}
                          />
                        ) : (
                          <RolBadge rol={m.rol} />
                        )}
                      </div>

                      {puedeGestionar && (
                        <div className="w-8 flex-shrink-0">
                          {puedeDel && (
                            <button
                              type="button"
                              onClick={() => setEliminando(m)}
                              disabled={delLoad}
                              title="Eliminar del proyecto"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-gray-500 opacity-0 transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 disabled:opacity-50"
                            >
                              {delLoad ? (
                                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-500/20 border-t-red-500" />
                              ) : (
                                <Ic.trash />
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-3 p-4 sm:hidden">
                {miembrosFiltrados.map((m) => {
                  const esYo = String(m.id) === String(miId);
                  const esOwner = m.rol === 'owner';
                  const puedeEdit = puedeGestionar && !esOwner;
                  const puedeDel = puedeGestionar && !esOwner && !esYo;
                  const rolLoad = actionLoading === `rol-${m.id}`;
                  const delLoad = actionLoading === `del-${m.id}`;

                  return (
                    <MiembroCard
                      key={m.id}
                      miembro={m}
                      esYo={esYo}
                      puedeGestionar={puedeGestionar}
                      puedeEdit={puedeEdit}
                      puedeDel={puedeDel}
                      rolLoad={rolLoad}
                      delLoad={delLoad}
                      miId={miId}
                      onOpenChangeRole={(miembro, r) =>
                        setCambioRol({ miembro, nuevoRol: r })
                      }
                      onOpenDelete={(miembro) => setEliminando(miembro)}
                    />
                  );
                })}
              </div>
            </>
          )}

          {miembrosFiltrados.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-slate-800/50 bg-slate-900/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-xs text-gray-500">
                Mostrando{' '}
                <span className="font-medium text-gray-300">
                  {miembrosFiltrados.length}
                </span>{' '}
                de{' '}
                <span className="font-medium text-gray-300">{stats.total}</span>{' '}
                miembros
              </p>

              {(filtroRol !== 'todos' || busquedaLocal) && (
                <button
                  type="button"
                  onClick={() => {
                    setFiltroRol('todos');
                    setBusquedaLocal('');
                  }}
                  className="text-left text-xs text-gray-400 transition-colors hover:text-white sm:text-right"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
      />

      {showSolicitudes && (
        <SolicitudesModal
          isOpen={showSolicitudes}
          proyectoId={String(proyectoId)}
          onClose={() => setShowSolicitudes(false)}
        />
      )}

      {pendienteAgregar && (
        <ConfirmModal
          isOpen={!!pendienteAgregar}
          title="Agregar miembro al proyecto"
          message={`¿Deseas agregar a ${pendienteAgregar.nombre} ${pendienteAgregar.apellido ?? ''} como ${ROL_CONFIG[rolNuevo].label}? Tendrá acceso inmediato al proyecto y su contenido.`}
          confirmText="Agregar miembro"
          cancelText="Cancelar"
          onConfirm={() => agregarMiembro(pendienteAgregar)}
          onCancel={() => {
            if (actionLoading) return;
            setPendienteAgregar(null);
            setResultados([]);
          }}
          isLoading={actionLoading === `add-${pendienteAgregar.id}`}
          type="success"
        />
      )}

      {cambioRol && (
        <ChangeRoleModal
          miembro={cambioRol.miembro}
          nuevoRol={cambioRol.nuevoRol}
          loading={actionLoading === `rol-${cambioRol.miembro.id}`}
          onCancel={() => {
            if (actionLoading) return;
            setCambioRol(null);
          }}
          onConfirm={async () => {
            const data = cambioRol;
            setCambioRol(null);
            await cambiarRol(data.miembro, data.nuevoRol);
          }}
        />
      )}

      {eliminando && (
        <RemoveMemberModal
          miembro={eliminando}
          loading={actionLoading === `del-${eliminando.id}`}
          onCancel={() => {
            if (actionLoading) return;
            setEliminando(null);
          }}
          onConfirm={eliminarMiembro}
        />
      )}
    </div>
  );
}