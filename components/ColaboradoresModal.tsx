// components/ColaboradoresModal.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';

// ─── Types exportados ─────────────────────────────────────────────────────────

export type RolSistema = 'jefe' | 'admin' | 'colaborador';

export interface Colaborador {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  pais: string | null;
  rol: RolSistema;
  puesto: string | null;
  created_at: string;
  avatar_url?: string | null;
  proyectos_count?: number;
  activo: boolean;

  tareas_seleccionadas?: number;
  tareas_en_proceso?: number;
  tareas_completadas?: number;
}

export interface ColaboradoresModalProps {
  colaborador: Colaborador | null;
  onClose: () => void;
  currentUserRol: RolSistema;
  onUpdated?: (updated: Colaborador) => void;
  onDeleted?: (id: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fullName = (c: Colaborador) => `${c.nombre} ${c.apellido}`;

function getInitials(c: Colaborador) {
  return `${c.nombre?.[0] ?? ''}${c.apellido?.[0] ?? ''}`.toUpperCase();
}

const GRADIENTS = [
  'from-violet-500 to-purple-700',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-700',
  'from-rose-500 to-pink-700',
  'from-orange-500 to-amber-600',
  'from-indigo-500 to-blue-700',
  'from-fuchsia-500 to-violet-700',
  'from-teal-500 to-emerald-700',
];

function avatarGradient(id: string) {
  const n = id.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
  return GRADIENTS[n % GRADIENTS.length];
}

function fmtDate(s: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function antiguedad(s: string) {
  if (!s) return '—';

  const days = Math.floor((Date.now() - new Date(s).getTime()) / 86400000);
  if (days < 0) return '—';
  if (days < 30) return `${days} días`;
  if (days < 365) return `${Math.floor(days / 30)} meses`;

  const y = Math.floor(days / 365);
  const m = Math.floor((days % 365) / 30);

  return m > 0 ? `${y}a ${m}m` : `${y} año${y !== 1 ? 's' : ''}`;
}

// ─── Rol config ───────────────────────────────────────────────────────────────

const ROL: Record<
  RolSistema,
  { label: string; dot: string; badge: string; accent: string }
> = {
  jefe: {
    label: 'Jefe',
    dot: '#e879f9',
    badge: 'text-fuchsia-300 border-fuchsia-500/40 bg-fuchsia-500/10',
    accent: 'from-fuchsia-500/8 to-purple-500/4',
  },
  admin: {
    label: 'Admin',
    dot: '#60a5fa',
    badge: 'text-blue-300 border-blue-500/40 bg-blue-500/10',
    accent: 'from-blue-500/8 to-cyan-500/4',
  },
  colaborador: {
    label: 'Colaborador',
    dot: '#94a3b8',
    badge: 'text-slate-300 border-slate-500/40 bg-slate-500/10',
    accent: 'from-slate-500/8 to-slate-600/4',
  },
};

// ─── Icons ────────────────────────────────────────────────────────────────────

const Ic = {
  close: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  mail: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  phone: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  globe: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
    </svg>
  ),
  bag: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  shield: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  calendar: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  clock: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
    </svg>
  ),
  folder: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  ),
  hash: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
    </svg>
  ),
  trash: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0h8l-1-2.5A1 1 0 0014.09 4H9.91a1 1 0 00-.92.5L8 7z" />
    </svg>
  ),
  warn: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l6.518 11.59C19.021 16.92 18.245 18 17.014 18H2.986c-1.23 0-2.007-1.08-1.247-2.31l6.518-11.59zM11 14a1 1 0 10-2 0 1 1 0 002 0zm-1-2a1 1 0 01-1-1V8a1 1 0 112 0v3a1 1 0 01-1 1z" clipRule="evenodd" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  power: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v10m6.364-5.364a9 9 0 11-12.728 0" />
    </svg>
  ),
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function RolBadge({ rol }: { rol: RolSistema }) {
  const cfg = ROL[rol];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold whitespace-nowrap ${cfg.badge}`}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

function InfoRow({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-1">
      <span className="text-gray-500 flex-shrink-0 mt-0.5">{icon}</span>
      <span className="text-xs text-gray-500 w-28 flex-shrink-0 pt-0.5">{label}</span>
      <span
        className={`text-sm text-gray-200 break-all min-w-0 leading-6 ${
          mono ? 'font-mono text-xs tracking-tight' : ''
        }`}
      >
        {value || '—'}
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex-1 bg-slate-800/60 border border-slate-700/40 rounded-xl px-4 py-4 text-center">
      <p className={`text-xl font-bold leading-none ${accent ? 'text-purple-300' : 'text-gray-100'}`}>
        {value}
      </p>
      <p className="text-xs text-gray-500 mt-2">{label}</p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-0.5 h-4 bg-gradient-to-b from-purple-500 to-blue-500 rounded-full" />
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
        {children}
      </p>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function ColaboradoresModal({
  colaborador: c,
  onClose,
  currentUserRol,
  onUpdated,
}: ColaboradoresModalProps) {
  const open = !!c;

  const canEdit = currentUserRol === 'admin' || currentUserRol === 'jefe';
  const canEditRole = currentUserRol === 'jefe';

  const [rol, setRol] = useState<RolSistema>('colaborador');
  const [puesto, setPuesto] = useState('');
  const [activo, setActivo] = useState(true);

  const [initialRol, setInitialRol] = useState<RolSistema>('colaborador');
  const [initialPuesto, setInitialPuesto] = useState('');
  const [initialActivo, setInitialActivo] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveOk, setSaveOk] = useState(false);

  const [confirmToggleEstado, setConfirmToggleEstado] = useState(false);

  useEffect(() => {
    if (!c) return;

    const puestoInicial = c.puesto ?? '';
    const rolInicial = c.rol;
    const activoInicial = c.activo;

    setRol(rolInicial);
    setPuesto(puestoInicial);
    setActivo(activoInicial);

    setInitialRol(rolInicial);
    setInitialPuesto(puestoInicial);
    setInitialActivo(activoInicial);

    setSaveError('');
    setSaveOk(false);
    setConfirmToggleEstado(false);
  }, [c]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : 'unset';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [open, onClose]);

  const isDirty = useMemo(() => {
    if (!c) return false;

    const cambioRol = canEditRole ? rol !== initialRol : false;
    const cambioPuesto = (puesto.trim() || '') !== (initialPuesto.trim() || '');
    const cambioActivo = activo !== initialActivo;

    return cambioRol || cambioPuesto || cambioActivo;
  }, [c, canEditRole, rol, initialRol, puesto, initialPuesto, activo, initialActivo]);

  if (!open || !c) return null;

  const rolCfg = ROL[rol];

  const resetForm = () => {
    setRol(initialRol);
    setPuesto(initialPuesto);
    setActivo(initialActivo);
    setSaveError('');
    setSaveOk(false);
    setConfirmToggleEstado(false);
  };

  const handleSave = async () => {
    if (!canEdit || saving || !isDirty) return;

    try {
      setSaving(true);
      setSaveError('');
      setSaveOk(false);

      const body: Record<string, unknown> = {
        id: c.id,
        puesto: puesto.trim() || null,
        activo,
      };

      if (canEditRole) {
        body.rol = rol;
      }

      const res = await fetch('/api/user/usuarios', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'No se pudo guardar los cambios');
      }

      const updated: Colaborador = {
        ...c,
        ...(data?.data ?? {}),
        rol: canEditRole ? rol : c.rol,
        puesto: puesto.trim() || null,
        activo,
      };

      setInitialRol(updated.rol);
      setInitialPuesto(updated.puesto ?? '');
      setInitialActivo(updated.activo);

      setRol(updated.rol);
      setPuesto(updated.puesto ?? '');
      setActivo(updated.activo);

      onUpdated?.(updated);
      setConfirmToggleEstado(false);
      setSaveOk(true);
    } catch (err: any) {
      setSaveError(err?.message || 'Error inesperado al guardar cambios');
    } finally {
      setSaving(false);
    }
  };

  const toggleEstadoLocal = () => {
    if (!canEdit || saving) return;
    setActivo((prev) => !prev);
    setConfirmToggleEstado(false);
    setSaveError('');
    setSaveOk(false);
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        style={{ animation: 'cmFadeIn 0.2s ease-out' }}
        onClick={onClose}
      />

      <div
        className="relative z-10 w-full max-w-xl bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '90vh', animation: 'cmScaleIn 0.22s ease-out' }}
      >
        <div
          className={`relative flex-shrink-0 px-6 pt-6 pb-5 border-b border-slate-800/70 bg-gradient-to-br ${rolCfg.accent}`}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 to-blue-500" />

          <div className="flex items-start gap-5 pl-3">
            <div
              className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarGradient(c.id)} flex items-center justify-center text-xl font-bold text-white flex-shrink-0 shadow-xl`}
              style={{ boxShadow: '0 0 0 4px rgba(15,23,42,0.8)' }}
            >
              {getInitials(c)}
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white leading-tight">
                {fullName(c)}
              </h2>
              <p className="text-sm text-gray-200 mt-1 truncate">
                {puesto || c.puesto || 'Sin puesto'}
              </p>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <RolBadge rol={canEditRole ? rol : c.rol} />
                {c.pais && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium text-slate-300 border-slate-600/50 bg-slate-800/60">
                    {Ic.globe} {c.pais}
                  </span>
                )}
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                    activo
                      ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                      : 'border-red-500/40 text-red-300 bg-red-500/10'
                  }`}
                >
                  {activo ? 'Activo' : 'Inactivo'}
                </span>
                {isDirty && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-amber-500/40 text-amber-300 bg-amber-500/10">
                    Cambios sin guardar
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 rounded-xl bg-slate-800/80 border border-slate-700/50 text-gray-400 hover:text-white hover:bg-slate-700/60 transition-all flex items-center justify-center"
            >
              {Ic.close}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {!canEdit && (
            <div className="px-4 py-3 rounded-lg border border-slate-700/60 bg-slate-900/70 text-xs text-gray-300 flex items-start gap-2.5">
              <span className="mt-0.5 text-purple-300">{Ic.shield}</span>
              <p>
                Solo los usuarios con rol <b>Jefe</b> o <b>Admin</b> pueden
                editar información del colaborador.
              </p>
            </div>
          )}

          {canEdit && !canEditRole && (
            <div className="px-4 py-3 rounded-lg border border-blue-500/30 bg-blue-500/10 text-xs text-blue-200 flex items-start gap-2.5">
              <span className="mt-0.5 text-blue-300">{Ic.shield}</span>
              <p>
                Como <b>Admin</b> puedes editar el puesto y el estado del colaborador,
                pero solo un <b>Jefe</b> puede cambiar roles o ascender a otro usuario a jefe.
              </p>
            </div>
          )}

          {canEditRole && (
            <div className="px-4 py-3 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 text-xs text-fuchsia-200 flex items-start gap-2.5">
              <span className="mt-0.5 text-fuchsia-300">{Ic.shield}</span>
              <p>
                Como <b>Jefe</b> puedes asignar los roles <b>Jefe</b>, <b>Admin</b> o <b>Colaborador</b>.
              </p>
            </div>
          )}

          <div className="flex gap-4 flex-col sm:flex-row">
            <StatCard label="Proyectos" value={String(c.proyectos_count ?? 0)} accent />
            <StatCard label="Antigüedad" value={antiguedad(c.created_at)} />
            <StatCard label="ID" value={`#${c.id}`} />
          </div>

          <div>
            <SectionLabel>Contacto</SectionLabel>
            <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl px-5 py-5 space-y-4">
              <InfoRow icon={Ic.mail} label="Correo electrónico" value={c.email} mono />
              <InfoRow icon={Ic.phone} label="Teléfono" value={c.telefono ?? ''} />
              <InfoRow icon={Ic.globe} label="País" value={c.pais ?? ''} />
            </div>
          </div>

          <div>
            <SectionLabel>Información laboral</SectionLabel>
            <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl px-5 py-5 space-y-5">
              <div className="flex items-start gap-3">
                <span className="text-gray-500 flex-shrink-0 mt-0.5">{Ic.bag}</span>
                <span className="text-xs text-gray-500 w-28 flex-shrink-0 pt-0.5">
                  Puesto
                </span>
                {canEdit ? (
                  <input
                    type="text"
                    value={puesto}
                    onChange={(e) => {
                      setPuesto(e.target.value);
                      setSaveError('');
                      setSaveOk(false);
                    }}
                    placeholder="Puesto / cargo"
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-700/70 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                  />
                ) : (
                  <span className="text-sm text-gray-200 min-w-0 leading-6">
                    {c.puesto ?? '—'}
                  </span>
                )}
              </div>

              <div className="flex items-start gap-3">
                <span className="text-gray-500 flex-shrink-0 mt-0.5">{Ic.shield}</span>
                <span className="text-xs text-gray-500 w-28 flex-shrink-0 pt-0.5">
                  Rol del sistema
                </span>
                {canEditRole ? (
                  <select
                    value={rol}
                    onChange={(e) => {
                      setRol(e.target.value as RolSistema);
                      setSaveError('');
                      setSaveOk(false);
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-700/70 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 [color-scheme:dark]"
                  >
                    <option value="jefe">Jefe</option>
                    <option value="admin">Admin</option>
                    <option value="colaborador">Colaborador</option>
                  </select>
                ) : (
                  <RolBadge rol={c.rol} />
                )}
              </div>

              <div className="flex items-start gap-3">
                <span className="text-gray-500 flex-shrink-0 mt-0.5">{Ic.clock}</span>
                <span className="text-xs text-gray-500 w-28 flex-shrink-0 pt-0.5">
                  Estado
                </span>
                <span
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${
                    activo
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
                      : 'border-red-500/50 bg-red-500/10 text-red-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      activo ? 'bg-emerald-400' : 'bg-red-400'
                    }`}
                  />
                  {activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <SectionLabel>Actividad</SectionLabel>
            <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl px-5 py-5 space-y-4">
              <InfoRow icon={Ic.calendar} label="Miembro desde" value={fmtDate(c.created_at)} />
              <InfoRow icon={Ic.clock} label="Antigüedad" value={antiguedad(c.created_at)} />
              <InfoRow
                icon={Ic.folder}
                label="Proyectos"
                value={`${c.proyectos_count ?? 0} proyecto${(c.proyectos_count ?? 0) !== 1 ? 's' : ''}`}
              />
              <InfoRow icon={Ic.hash} label="ID interno" value={`#${c.id}`} mono />
            </div>
          </div>

          <div>
            <SectionLabel>Tareas</SectionLabel>
            <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl px-5 py-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 px-4 py-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Seleccionadas</p>
                  <p className="text-2xl font-bold text-white mt-2">
                    {c.tareas_seleccionadas ?? 0}
                  </p>
                </div>

                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-4">
                  <p className="text-xs text-amber-300/80 uppercase tracking-wider">En progreso</p>
                  <p className="text-2xl font-bold text-amber-300 mt-2">
                    {c.tareas_en_proceso ?? 0}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4">
                  <p className="text-xs text-emerald-300/80 uppercase tracking-wider">Completadas</p>
                  <p className="text-2xl font-bold text-emerald-300 mt-2">
                    {c.tareas_completadas ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {canEdit && (
            <div>
              <SectionLabel>Zona peligrosa</SectionLabel>

              {activo ? (
                <div className="bg-red-950/40 border border-red-700/40 rounded-xl px-5 py-5 space-y-4">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 text-red-400">{Ic.warn}</span>
                    <div className="text-xs text-red-100/90">
                      <p className="font-semibold mb-1">Desactivar colaborador</p>
                      <p className="leading-6">
                        Esta acción marcará a <b>{fullName(c)}</b> como inactivo
                        en el formulario. El cambio se aplicará realmente hasta que presiones
                        <b> Guardar cambios</b>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    {!confirmToggleEstado ? (
                      <button
                        type="button"
                        onClick={() => setConfirmToggleEstado(true)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-500/60 text-xs font-semibold text-red-200 bg-red-500/10 hover:bg-red-500/20 transition-all"
                      >
                        {Ic.trash}
                        Marcar como inactivo
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setConfirmToggleEstado(false)}
                          disabled={saving}
                          className="px-3 py-1.5 rounded-lg border border-slate-700/70 text-xs text-gray-300 hover:bg-slate-800/70 transition-all disabled:opacity-60"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={toggleEstadoLocal}
                          disabled={saving}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-500/80 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 disabled:bg-red-900/60 disabled:text-red-200/70 transition-all"
                        >
                          Marcar inactivo
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-950/30 border border-emerald-700/40 rounded-xl px-5 py-5 space-y-4">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 text-emerald-400">{Ic.check}</span>
                    <div className="text-xs text-emerald-100/90">
                      <p className="font-semibold mb-1">Activar colaborador</p>
                      <p className="leading-6">
                        <b>{fullName(c)}</b> está marcado como inactivo en el formulario.
                        Puedes volver a activarlo, pero el cambio real se aplicará hasta que
                        presiones <b>Guardar cambios</b>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    {!confirmToggleEstado ? (
                      <button
                        type="button"
                        onClick={() => setConfirmToggleEstado(true)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/60 text-xs font-semibold text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all"
                      >
                        {Ic.power}
                        Marcar como activo
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setConfirmToggleEstado(false)}
                          disabled={saving}
                          className="px-3 py-1.5 rounded-lg border border-slate-700/70 text-xs text-gray-300 hover:bg-slate-800/70 transition-all disabled:opacity-60"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={toggleEstadoLocal}
                          disabled={saving}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/80 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900/60 disabled:text-emerald-200/70 transition-all"
                        >
                          Marcar activo
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {(saveError || saveOk) && (
            <div
              className={`px-4 py-3 rounded-lg text-xs border ${
                saveError
                  ? 'border-red-500/40 bg-red-500/10 text-red-200'
                  : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              }`}
            >
              {saveError || 'Cambios guardados correctamente.'}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 px-6 py-5 border-t border-slate-800/60 bg-slate-900/60 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (isDirty) {
                resetForm();
              }
              onClose();
            }}
            className="px-4 py-2.5 bg-slate-800/60 border border-slate-700/50 text-gray-300 hover:text-white hover:border-slate-600 rounded-xl text-sm font-medium transition-all flex-1"
          >
            Cerrar
          </button>

          {canEdit && isDirty && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900/60 disabled:text-gray-400 border border-purple-500/60 rounded-xl text-sm font-semibold text-white shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 flex-1"
            >
              {saving && (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes cmFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes cmScaleIn {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}