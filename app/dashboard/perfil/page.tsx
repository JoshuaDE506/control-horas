// app/dashboard/perfil/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

type Perfil = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  pais: string;
  telefono: string;
  rol: string;
  puesto: string;
  activo: boolean;
  created_at: string | null;
  proyectosCreados: number;
  proyectosMiembro: number;
  tareasSeleccionadas: number;
  tareasEnProceso: number;
  tareasCompletadas: number;
};

type FormPerfil = {
  nombre: string;
  apellido: string;
  email: string;
  pais: string;
  telefono: string;
};

type ProfileApiResponse = {
  ok: boolean;
  data?: {
    user?: {
      id: string;
      nombre: string;
      apellido: string;
      email: string;
      pais: string | null;
      telefono?: string | null;
      rol: string;
      puesto: string | null;
      activo: boolean;
      created_at: string | null;
    };
    stats?: {
      proyectos_creados?: number;
      proyectos_miembro?: number;
      tareas_seleccionadas?: number;
      tareas_en_proceso?: number;
      tareas_completadas?: number;
    };
  };
  error?: string;
};

function PencilIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M15.232 5.232l3.536 3.536M9 13l6.232-6.232a2.5 2.5 0 113.536 3.536L12.536 16.536A4 4 0 019.707 17.707L7 18l.293-2.707A4 4 0 018.464 12.536L9 13z"
      />
    </svg>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-500">
        {label}
      </span>
      <span className="break-words text-sm font-medium text-white">{value}</span>
    </div>
  );
}

export default function PerfilPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [form, setForm] = useState<FormPerfil>({
    nombre: '',
    apellido: '',
    email: '',
    pais: '',
    telefono: '',
  });
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function cargarPerfil() {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/user/perfil', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });
      const data: ProfileApiResponse = await res
        .json()
        .catch(() => ({ ok: false, error: 'Respuesta inválida del servidor' }));

      if (!res.ok || !data?.ok || !data?.data?.user) {
        throw new Error(data?.error || 'No se pudo cargar el perfil');
      }

      const user = data.data.user;
      const stats = data.data.stats ?? {};

      const perfilNormalizado: Perfil = {
        id: String(user.id),
        nombre: String(user.nombre ?? ''),
        apellido: String(user.apellido ?? ''),
        email: String(user.email ?? ''),
        pais: user.pais ?? 'No definido',
        telefono: user.telefono ?? '',
        rol: String(user.rol ?? 'colaborador'),
        puesto: user.puesto ?? 'Sin puesto',
        activo: Boolean(user.activo),
        created_at: user.created_at ?? null,
        proyectosCreados: Number(stats.proyectos_creados ?? 0),
        proyectosMiembro: Number(stats.proyectos_miembro ?? 0),
        tareasSeleccionadas: Number(stats.tareas_seleccionadas ?? 0),
        tareasEnProceso: Number(stats.tareas_en_proceso ?? 0),
        tareasCompletadas: Number(stats.tareas_completadas ?? 0),
      };

      setPerfil(perfilNormalizado);
      setForm({
        nombre: perfilNormalizado.nombre,
        apellido: perfilNormalizado.apellido,
        email: perfilNormalizado.email,
        pais: perfilNormalizado.pais === 'No definido' ? '' : perfilNormalizado.pais,
        telefono: perfilNormalizado.telefono,
      });
    } catch (err) {
      setPerfil(null);
      setError(err instanceof Error ? err.message : 'No se pudo cargar el perfil');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarPerfil();
  }, []);

  const dirty = useMemo(() => {
    if (!perfil) return false;
    return (
      form.nombre !== perfil.nombre ||
      form.apellido !== perfil.apellido ||
      form.email !== perfil.email ||
      form.telefono !== perfil.telefono ||
      form.pais !== (perfil.pais === 'No definido' ? '' : perfil.pais)
    );
  }, [form, perfil]);

  async function guardarPerfil() {
    if (!dirty) {
      setEditando(false);
      return;
    }

    try {
      setGuardando(true);
      setError('');
      setSuccess('');

      const res = await fetch('/api/user/perfil', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res
        .json()
        .catch(() => ({ ok: false, error: 'Respuesta inválida del servidor' }));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'No se pudo actualizar el perfil');
      }

      setSuccess('Perfil actualizado correctamente');
      setEditando(false);
      await cargarPerfil();
      setTimeout(() => setSuccess(''), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el perfil');
    } finally {
      setGuardando(false);
    }
  }

  function cancelarEdicion() {
    if (!perfil) return;
    setForm({
      nombre: perfil.nombre,
      apellido: perfil.apellido,
      email: perfil.email,
      pais: perfil.pais === 'No definido' ? '' : perfil.pais,
      telefono: perfil.telefono,
    });
    setEditando(false);
    setError('');
    setSuccess('');
  }

  function actualizarCampo<K extends keyof FormPerfil>(campo: K, valor: FormPerfil[K]) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20" />
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          </div>
          <p className="text-xs uppercase tracking-widest text-slate-500">Cargando</p>
        </div>
      </div>
    );
  }

  if (!perfil) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <p className="font-medium text-slate-300">No se pudo cargar el perfil</p>
          <p className="mt-1 text-sm text-slate-600">Intenta recargar la página</p>
        </div>
      </div>
    );
  }

  const initials = `${perfil.nombre.charAt(0)}${perfil.apellido.charAt(0)}`.toUpperCase();
  const totalTareas = perfil.tareasSeleccionadas;
  const pctCompletadas =
    totalTareas > 0 ? Math.round((perfil.tareasCompletadas / totalTareas) * 100) : 0;
  const rolCapitalizado = perfil.rol.charAt(0).toUpperCase() + perfil.rol.slice(1);
  const fechaIngreso = perfil.created_at
    ? new Date(perfil.created_at).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  const inputCls =
    'w-full rounded-lg bg-slate-900/80 border border-white/8 px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/40 transition-colors';

  const tareaStats = [
    {
      label: 'Seleccionadas',
      value: perfil.tareasSeleccionadas,
      color: 'bg-violet-500',
      text: 'text-violet-400',
      bar: 'bg-violet-500',
    },
    {
      label: 'En proceso',
      value: perfil.tareasEnProceso,
      color: 'bg-amber-500',
      text: 'text-amber-400',
      bar: 'bg-amber-500',
    },
    {
      label: 'Completadas',
      value: perfil.tareasCompletadas,
      color: 'bg-emerald-500',
      text: 'text-emerald-400',
      bar: 'bg-emerald-500',
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-0 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Mi Perfil
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
            Información personal y actividad
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <span
            className={`flex items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:justify-start ${
              perfil.activo
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                : 'border-red-500/20 bg-red-500/10 text-red-400'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                perfil.activo ? 'bg-emerald-400' : 'bg-red-400'
              } animate-pulse`}
            />
            {perfil.activo ? 'Activo' : 'Inactivo'}
          </span>

          {!editando ? (
            <button
              onClick={() => {
                setEditando(true);
                setError('');
                setSuccess('');
              }}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/8 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 transition-all hover:bg-slate-700 hover:text-white sm:w-auto sm:py-1.5"
            >
              <PencilIcon /> Editar
            </button>
          ) : (
            <>
              <button
                onClick={cancelarEdicion}
                disabled={guardando}
                className="w-full rounded-lg border border-white/8 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-400 transition-all hover:bg-slate-700 disabled:opacity-50 sm:w-auto sm:py-1.5"
              >
                Cancelar
              </button>
              <button
                onClick={guardarPerfil}
                disabled={guardando || !dirty}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-2 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 sm:w-auto sm:py-1.5"
              >
                <PencilIcon />
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-400">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="relative flex flex-col items-center overflow-hidden rounded-2xl border border-white/8 bg-slate-800/60 p-4 text-center sm:p-5">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-600/10 via-transparent to-indigo-600/10" />

          <div className="relative mb-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 shadow-lg shadow-cyan-500/20">
              <span className="text-xl font-bold tracking-tight text-white">{initials}</span>
            </div>
            <div
              className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-slate-800 ${
                perfil.activo ? 'bg-emerald-400' : 'bg-slate-500'
              }`}
            />
          </div>

          <h2 className="break-words text-base font-bold leading-tight text-white">
            {perfil.nombre} {perfil.apellido}
          </h2>
          <p className="mt-0.5 break-words text-xs text-slate-400">{perfil.puesto}</p>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            <span className="rounded-full border border-cyan-500/20 bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-300">
              {rolCapitalizado}
            </span>
            <span className="rounded-full border border-white/8 bg-slate-700/60 px-2 py-0.5 text-[11px] text-slate-400">
              {perfil.pais}
            </span>
          </div>

          <div className="my-3 h-px w-full bg-white/6" />

          <div className="grid w-full grid-cols-2 gap-2">
            <div className="rounded-lg border border-white/5 bg-slate-900/50 px-3 py-2 text-center">
              <p className="text-lg font-bold tabular-nums text-white">{perfil.proyectosCreados}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">Creados</p>
            </div>
            <div className="rounded-lg border border-white/5 bg-slate-900/50 px-3 py-2 text-center">
              <p className="text-lg font-bold tabular-nums text-white">{perfil.proyectosMiembro}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">Participa</p>
            </div>
          </div>

          <div className="my-3 h-px w-full bg-white/6" />

          <p className="text-[10px] text-slate-600">Desde {fechaIngreso}</p>
          <p className="mt-0.5 max-w-full break-all px-2 font-mono text-[9px] text-slate-700">
            {perfil.id}
          </p>
        </div>

        <div className="rounded-2xl border border-white/8 bg-slate-800/60 p-4 sm:p-5 xl:col-span-2">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="h-4 w-0.5 rounded-full bg-gradient-to-b from-cyan-400 to-blue-500" />
              <h3 className="text-sm font-semibold text-white">Información personal</h3>
            </div>
            <button
              onClick={() => {
                editando ? cancelarEdicion() : (setEditando(true), setError(''), setSuccess(''));
              }}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/8 bg-slate-900/50 px-2.5 py-2 text-[11px] text-slate-400 transition-all hover:bg-slate-800 hover:text-white sm:w-auto sm:py-1.5"
            >
              <PencilIcon />
              {editando ? 'Cancelar' : 'Editar'}
            </button>
          </div>

          {!editando ? (
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Nombre" value={perfil.nombre} />
              <Field label="Apellido" value={perfil.apellido} />
              <Field label="Correo" value={perfil.email} />
              <Field label="Teléfono" value={perfil.telefono || '—'} />
              <Field label="País" value={perfil.pais} />
              <Field label="Rol" value={rolCapitalizado} />
              <Field label="Puesto" value={perfil.puesto} />
              <Field label="Ingreso" value={fechaIngreso} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Nombre
                </label>
                <input
                  className={inputCls}
                  value={form.nombre}
                  onChange={(e) => actualizarCampo('nombre', e.target.value)}
                  placeholder="Nombre"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Apellido
                </label>
                <input
                  className={inputCls}
                  value={form.apellido}
                  onChange={(e) => actualizarCampo('apellido', e.target.value)}
                  placeholder="Apellido"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Correo
                </label>
                <input
                  type="email"
                  className={inputCls}
                  value={form.email}
                  onChange={(e) => actualizarCampo('email', e.target.value)}
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Teléfono
                </label>
                <input
                  className={inputCls}
                  value={form.telefono}
                  onChange={(e) => actualizarCampo('telefono', e.target.value)}
                  placeholder="Teléfono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  País
                </label>
                <input
                  className={inputCls}
                  value={form.pais}
                  onChange={(e) => actualizarCampo('pais', e.target.value)}
                  placeholder="País de residencia"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-white/8 bg-slate-800/60 p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-0.5 rounded-full bg-gradient-to-b from-violet-400 to-emerald-500" />
              <h3 className="text-sm font-semibold text-white">Tareas</h3>
            </div>
            <span className="text-xs font-bold tabular-nums text-slate-400 sm:ml-auto">
              {totalTareas} total
            </span>
          </div>

          <div className="space-y-2">
            {tareaStats.map(({ label, value, text, bar }) => {
              const pct = totalTareas > 0 ? Math.round((value / totalTareas) * 100) : 0;
              return (
                <div key={label}>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-400">{label}</span>
                    <span className={`text-xs font-bold tabular-nums ${text}`}>{value}</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-slate-900/60">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${bar}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-slate-800/60 p-4 xl:col-span-2">
          <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="h-4 w-0.5 rounded-full bg-gradient-to-b from-cyan-400 to-blue-500" />
              <h3 className="text-sm font-semibold text-white">Progreso general</h3>
            </div>
            <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-2xl font-bold tabular-nums text-transparent">
              {pctCompletadas}%
            </span>
          </div>
          <p className="mb-3 pl-0 text-[11px] text-slate-600 sm:pl-2.5">
            tareas completadas
          </p>

          <div className="mb-5 h-2 overflow-hidden rounded-full border border-white/5 bg-slate-900/60">
            <div
              className="relative h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-1000"
              style={{ width: `${pctCompletadas}%` }}
            >
              <div className="absolute inset-0 animate-pulse rounded-full bg-white/20" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tareaStats.map(({ label, value, color, text }) => {
              const pct = totalTareas > 0 ? Math.round((value / totalTareas) * 100) : 0;
              return (
                <div
                  key={label}
                  className="rounded-xl border border-white/5 bg-slate-900/40 px-3 py-2.5"
                >
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <div className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
                    <span className="truncate text-[11px] text-slate-400">{label}</span>
                  </div>
                  <p className={`text-xl font-bold tabular-nums ${text}`}>{value}</p>
                  <p className="mt-0.5 text-[10px] text-slate-600">{pct}% del total</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}