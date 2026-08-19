// app/dashboard/jornada/page.tsx
'use client';

import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

type Usuario = {
  id: string;
  nombre: string;
  apellido: string;
  rol: string;
  puesto: string;
};

type Estado = 'presente' | 'ausente' | 'justificado';

type RegistroJornada = {
  id: string;
  usuario_id: string;
  nombre: string;
  apellido: string;
  fecha: string;
  hora_entrada: string | null;
  hora_salida: string | null;
  minutos_trabajados: number;
  estado: Estado;
  motivo: string | null;
};

type FilaTrabajo = {
  usuario: Usuario;
  registro: RegistroJornada | null;
  estado: Estado;
  hora_entrada: string;
  hora_salida: string;
  motivo: string;
  saving: boolean;
  saved: boolean;
  error: string;
  dirty: boolean;
};

function hoyISO() {
  const d = new Date();

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getInitials(u: Usuario) {
  return `${u.nombre.charAt(0)}${u.apellido.charAt(0)}`.toUpperCase();
}

function minutosAHoras(min: number) {
  if (!min || min <= 0) return '—';

  const h = Math.floor(min / 60);
  const m = min % 60;

  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function calcularMinutosLocal(entrada: string, salida: string): number {
  if (!entrada || !salida) return 0;

  const [h1, m1] = entrada.split(':').map(Number);
  const [h2, m2] = salida.split(':').map(Number);

  return h2 * 60 + m2 - (h1 * 60 + m1);
}

function filaDefault(
  usuario: Usuario,
  registro: RegistroJornada | null
): FilaTrabajo {
  return {
    usuario,
    registro,
    estado: registro?.estado ?? 'presente',
    hora_entrada: registro?.hora_entrada ?? '',
    hora_salida: registro?.hora_salida ?? '',
    motivo: registro?.motivo ?? '',
    saving: false,
    saved: false,
    error: '',
    dirty: false,
  };
}

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

function parseTime(value: string) {
  if (!value || !value.includes(':')) {
    return {
      hour: '',
      minute: '',
    };
  }

  const [hour, minute] = value.split(':');

  return {
    hour,
    minute,
  };
}

function mapUsuario(raw: any): Usuario {
  return {
    id: String(raw?.id ?? ''),
    nombre: String(raw?.nombre ?? ''),
    apellido: String(raw?.apellido ?? ''),
    rol: String(raw?.rol ?? ''),
    puesto: String(raw?.puesto ?? ''),
  };
}

function mapRegistro(raw: any): RegistroJornada {
  return {
    id: String(raw?.id ?? ''),
    usuario_id: String(raw?.usuario_id ?? ''),
    nombre: String(raw?.nombre ?? ''),
    apellido: String(raw?.apellido ?? ''),
    fecha: String(raw?.fecha ?? ''),
    hora_entrada:
      raw?.hora_entrada == null
        ? null
        : String(raw.hora_entrada),
    hora_salida:
      raw?.hora_salida == null
        ? null
        : String(raw.hora_salida),
    minutos_trabajados:
      Number(raw?.minutos_trabajados ?? 0) || 0,
    estado:
      raw?.estado === 'ausente'
        ? 'ausente'
        : raw?.estado === 'justificado'
        ? 'justificado'
        : 'presente',
    motivo:
      raw?.motivo == null
        ? null
        : String(raw.motivo),
  };
}

const ESTADO_CFG = {
  presente: {
    label: 'Presente',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
  },
  ausente: {
    label: 'Ausente',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/25',
  },
  justificado: {
    label: 'Justificado',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
  },
} as const;

function BuscadorUsuarios({
  todosUsuarios,
  usuariosEnTabla,
  onAgregar,
}: {
  todosUsuarios: Usuario[];
  usuariosEnTabla: Set<string>;
  onAgregar: (u: Usuario) => void | Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }

    document.addEventListener('mousedown', handler);

    return () =>
      document.removeEventListener('mousedown', handler);
  }, []);

  const filtrados = todosUsuarios.filter((u) => {
    if (usuariosEnTabla.has(u.id)) return false;

    const q = query.toLowerCase();

    return (
      u.nombre.toLowerCase().includes(q) ||
      u.apellido.toLowerCase().includes(q) ||
      (u.puesto ?? '').toLowerCase().includes(q) ||
      u.rol.toLowerCase().includes(q)
    );
  });

  async function seleccionar(u: Usuario) {
    await onAgregar(u);

    setQuery('');
    setAbierto(false);
  }

  return (
    <div ref={ref} className="relative w-full sm:w-auto">
      <div className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 transition-all focus-within:border-cyan-500/40">
        <svg
          className="h-4 w-4 shrink-0 text-slate-500"
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

        <input
          type="text"
          placeholder="Buscar usuario a supervisar…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          className="w-full bg-transparent text-sm text-white placeholder-slate-600 outline-none sm:w-64"
        />
      </div>

      {abierto && (
        <div className="absolute left-0 top-full z-30 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-800 shadow-2xl shadow-black/50 sm:w-80">
          {filtrados.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              {query
                ? 'Sin resultados'
                : 'Todos los usuarios disponibles ya están en la tabla'}
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto py-1.5">
              {filtrados.map((u) => (
                <button
                  key={u.id}
                  onClick={() => seleccionar(u)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-slate-700/60"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 text-xs font-bold text-white">
                    {getInitials(u)}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {u.nombre} {u.apellido}
                    </p>

                    <p className="truncate text-xs text-slate-500">
                      {u.puesto || u.rol}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TimePickerField({
  value,
  disabled,
  placeholder = 'Seleccionar',
  accent = 'cyan',
  onChange,
}: {
  value: string;
  disabled?: boolean;
  placeholder?: string;
  accent?: 'cyan' | 'emerald' | 'amber';
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { hour, minute } = parseTime(value);

  const hours = Array.from({ length: 24 }, (_, i) => pad2(i));
  const minutes = Array.from({ length: 12 }, (_, i) => pad2(i * 5));

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () =>
      document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function openPicker() {
    if (disabled || !buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const estimatedHeight = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp =
      spaceBelow < estimatedHeight &&
      rect.top > spaceBelow;

    const width =
      viewportWidth < 640
        ? Math.min(viewportWidth - 24, 360)
        : 260;

    let left = rect.left;

    if (left + width > viewportWidth - 12) {
      left = viewportWidth - width - 12;
    }

    if (left < 12) left = 12;

    setDropdownStyle({
      position: 'fixed',
      left,
      width,
      zIndex: 9999,
      ...(openUp
        ? {
            bottom:
              window.innerHeight -
              rect.top +
              4,
          }
        : {
            top: rect.bottom + 4,
          }),
    });

    setOpen((v) => !v);
  }

  const accentMap = {
    cyan: {
      border: 'focus:border-cyan-500/40 border-cyan-500/20',
      ring: 'shadow-cyan-500/10',
      selected: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      action: 'text-cyan-300 hover:bg-cyan-500/10',
      icon: 'text-cyan-400',
    },
    emerald: {
      border: 'focus:border-emerald-500/40 border-emerald-500/20',
      ring: 'shadow-emerald-500/10',
      selected: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      action: 'text-emerald-300 hover:bg-emerald-500/10',
      icon: 'text-emerald-400',
    },
    amber: {
      border: 'focus:border-amber-500/40 border-amber-500/20',
      ring: 'shadow-amber-500/10',
      selected: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      action: 'text-amber-300 hover:bg-amber-500/10',
      icon: 'text-amber-400',
    },
  }[accent];

  function selectHour(nextHour: string) {
    const nextMinute = minute || '00';

    onChange(`${nextHour}:${nextMinute}`);
  }

  function selectMinute(nextMinute: string) {
    const nextHour = hour || '08';

    onChange(`${nextHour}:${nextMinute}`);
  }

  function setNow() {
    const now = new Date();

    onChange(
      `${pad2(now.getHours())}:${pad2(now.getMinutes())}`
    );

    setOpen(false);
  }

  function clearValue() {
    onChange('');
    setOpen(false);
  }

  const dropdown = open
    ? createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl shadow-black/50 backdrop-blur"
        >
          <div className="border-b border-white/5 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 sm:text-xs">
                Seleccionar hora
              </p>

              <div className="text-base font-semibold text-white tabular-nums sm:text-lg">
                {value || '--:--'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-0">
            <div className="border-r border-white/5">
              <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-slate-500">
                Hora
              </div>

              <div className="max-h-48 overflow-y-auto px-2 pb-2">
                {hours.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => selectHour(h)}
                    className={`mb-1 w-full rounded-lg border px-3 py-2 text-sm tabular-nums transition-all ${
                      hour === h
                        ? accentMap.selected
                        : 'border-transparent text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-slate-500">
                Min
              </div>

              <div className="max-h-48 overflow-y-auto px-2 pb-2">
                {minutes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => selectMinute(m)}
                    className={`mb-1 w-full rounded-lg border px-3 py-2 text-sm tabular-nums transition-all ${
                      minute === m
                        ? accentMap.selected
                        : 'border-transparent text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-white/5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={clearValue}
              className="rounded-lg px-3 py-1.5 text-left text-xs text-slate-400 transition-all hover:bg-slate-800 sm:text-center"
            >
              Limpiar
            </button>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={setNow}
                className={`rounded-lg px-3 py-1.5 text-xs transition-all ${accentMap.action}`}
              >
                Ahora
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-white transition-all hover:bg-slate-700"
              >
                Listo
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={openPicker}
        className={`w-full rounded-xl border bg-slate-900/70 px-3 py-2 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${accentMap.border} ${accentMap.ring}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={`truncate text-sm tabular-nums ${
              value
                ? 'font-medium text-white'
                : 'text-slate-500'
            }`}
          >
            {value || placeholder}
          </span>

          <svg
            className={`h-4 w-4 shrink-0 ${accentMap.icon}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3M12 22a10 10 0 100-20 10 10 0 000 20z"
            />
          </svg>
        </div>
      </button>

      {dropdown}
    </div>
  );
}

function FilaRegistro({
  fila,
  onChange,
  onGuardar,
  onQuitar,
}: {
  fila: FilaTrabajo;
  onChange: (campos: Partial<FilaTrabajo>) => void;
  onGuardar: () => void;
  onQuitar: () => void;
}) {
  const cfg = ESTADO_CFG[fila.estado];

  const permiteHoras =
    fila.estado === 'presente' ||
    fila.estado === 'justificado';

  const minutosLocal =
    permiteHoras &&
    fila.hora_entrada &&
    fila.hora_salida
      ? calcularMinutosLocal(
          fila.hora_entrada,
          fila.hora_salida
        )
      : 0;

  const horasCalculadas =
    permiteHoras
      ? minutosLocal > 0
        ? minutosAHoras(minutosLocal)
        : fila.hora_entrada &&
          !fila.hora_salida
        ? 'Pendiente salida'
        : '—'
      : '—';

  const puedeGuardar =
    !fila.saving &&
    fila.dirty &&
    (fila.estado === 'ausente' ||
      (fila.estado === 'presente' &&
        !!fila.hora_entrada) ||
      (fila.estado === 'justificado' &&
        !!fila.motivo.trim()));

  const inputCls =
    'w-full rounded-lg border border-white/8 bg-slate-900/70 px-2.5 py-2 text-sm text-white tabular-nums placeholder-slate-700 transition-all focus:border-cyan-500/40 focus:outline-none disabled:opacity-50';

  return (
    <tr className="border-b border-white/5 last:border-0">
      <td className="w-60 px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white ${
              fila.registro
                ? 'bg-gradient-to-br from-cyan-600 to-blue-700'
                : 'bg-gradient-to-br from-slate-600 to-slate-700'
            }`}
          >
            {getInitials(fila.usuario)}
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">
              {fila.usuario.nombre}{' '}
              {fila.usuario.apellido}
            </p>

            <p className="truncate text-xs text-slate-500">
              {fila.usuario.puesto ||
                fila.usuario.rol}
            </p>
          </div>
        </div>
      </td>

      <td className="w-56 px-4 py-3">
        <div className="flex gap-1">
          {(
            [
              'presente',
              'ausente',
              'justificado',
            ] as Estado[]
          ).map((e) => {
            const c = ESTADO_CFG[e];
            const active =
              fila.estado === e;

            return (
              <button
                key={e}
                disabled={fila.saving}
                onClick={() =>
                  onChange({
                    estado: e,
                    dirty: true,
                    saved: false,
                    error: '',
                    ...(e === 'ausente'
                      ? {
                          hora_entrada: '',
                          hora_salida: '',
                        }
                      : {}),
                    ...(e !== 'justificado'
                      ? { motivo: '' }
                      : {}),
                  })
                }
                className={`flex-1 rounded-lg border py-1.5 text-[10px] font-semibold transition-all disabled:opacity-50 ${
                  active
                    ? `${c.bg} ${c.border} ${c.color}`
                    : 'border-white/6 bg-slate-900/40 text-slate-600 hover:border-white/12 hover:text-slate-400'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </td>

      <td className="w-40 px-4 py-3">
        {permiteHoras ? (
          <TimePickerField
            value={fila.hora_entrada}
            disabled={fila.saving}
            placeholder="Entrada"
            accent={
              fila.estado === 'justificado'
                ? 'amber'
                : 'emerald'
            }
            onChange={(value) =>
              onChange({
                hora_entrada: value,
                dirty: true,
                saved: false,
                error: '',
              })
            }
          />
        ) : (
          <span className="text-sm text-slate-700">
            —
          </span>
        )}
      </td>

      <td className="w-40 px-4 py-3">
        {permiteHoras ? (
          <TimePickerField
            value={fila.hora_salida}
            disabled={fila.saving}
            placeholder="Salida"
            accent={
              fila.estado === 'justificado'
                ? 'amber'
                : 'cyan'
            }
            onChange={(value) =>
              onChange({
                hora_salida: value,
                dirty: true,
                saved: false,
                error: '',
              })
            }
          />
        ) : (
          <span className="text-sm text-slate-700">
            —
          </span>
        )}
      </td>

      <td className="min-w-[180px] px-4 py-3">
        {fila.estado === 'justificado' ? (
          <input
            type="text"
            placeholder="Motivo…"
            className={inputCls}
            value={fila.motivo}
            disabled={fila.saving}
            onChange={(e) =>
              onChange({
                motivo: e.target.value,
                dirty: true,
                saved: false,
                error: '',
              })
            }
          />
        ) : (
          <span className="text-sm text-slate-700">
            —
          </span>
        )}
      </td>

      <td className="w-36 px-4 py-3">
        <span
          className={`text-sm font-medium tabular-nums ${cfg.color}`}
        >
          {horasCalculadas}
        </span>
      </td>

      <td className="w-48 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onGuardar}
            disabled={!puedeGuardar}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
              fila.saving
                ? 'border border-white/8 bg-slate-700/60 text-slate-500'
                : puedeGuardar
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm shadow-cyan-500/20 hover:opacity-90'
                : 'cursor-not-allowed border border-white/6 bg-slate-800/60 text-slate-700'
            }`}
          >
            {fila.saving
              ? 'Guardando…'
              : fila.saved &&
                !fila.dirty
              ? 'Guardado'
              : 'Guardar'}
          </button>

          {!fila.registro && (
            <button
              onClick={onQuitar}
              disabled={fila.saving}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-all hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
              title="Quitar de la tabla"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {fila.error && (
          <p className="mt-1 text-[10px] leading-tight text-red-400">
            {fila.error}
          </p>
        )}
      </td>
    </tr>
  );
}

function FilaRegistroMobile({
  fila,
  onChange,
  onGuardar,
  onQuitar,
}: {
  fila: FilaTrabajo;
  onChange: (campos: Partial<FilaTrabajo>) => void;
  onGuardar: () => void;
  onQuitar: () => void;
}) {
  const cfg = ESTADO_CFG[fila.estado];

  const permiteHoras =
    fila.estado === 'presente' ||
    fila.estado === 'justificado';

  const minutosLocal =
    permiteHoras &&
    fila.hora_entrada &&
    fila.hora_salida
      ? calcularMinutosLocal(
          fila.hora_entrada,
          fila.hora_salida
        )
      : 0;

  const horasCalculadas =
    permiteHoras
      ? minutosLocal > 0
        ? minutosAHoras(minutosLocal)
        : fila.hora_entrada &&
          !fila.hora_salida
        ? 'Pendiente salida'
        : '—'
      : '—';

  const puedeGuardar =
    !fila.saving &&
    fila.dirty &&
    (fila.estado === 'ausente' ||
      (fila.estado === 'presente' &&
        !!fila.hora_entrada) ||
      (fila.estado === 'justificado' &&
        !!fila.motivo.trim()));

  const inputCls =
    'w-full rounded-xl border border-white/8 bg-slate-900/70 px-3 py-2.5 text-sm text-white placeholder-slate-700 transition-all focus:border-cyan-500/40 focus:outline-none disabled:opacity-50';

  return (
    <div className="rounded-2xl border border-white/8 bg-slate-900/35 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white ${
              fila.registro
                ? 'bg-gradient-to-br from-cyan-600 to-blue-700'
                : 'bg-gradient-to-br from-slate-600 to-slate-700'
            }`}
          >
            {getInitials(fila.usuario)}
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {fila.usuario.nombre}{' '}
              {fila.usuario.apellido}
            </p>

            <p className="truncate text-xs text-slate-500">
              {fila.usuario.puesto ||
                fila.usuario.rol}
            </p>
          </div>
        </div>

        {!fila.registro && (
          <button
            onClick={onQuitar}
            disabled={fila.saving}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-all hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
            title="Quitar de la tabla"
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
        )}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[10px] uppercase tracking-widest text-slate-500">
          Estado
        </p>

        <div className="grid grid-cols-1 gap-2 xs:grid-cols-3">
          {(
            [
              'presente',
              'ausente',
              'justificado',
            ] as Estado[]
          ).map((e) => {
            const c = ESTADO_CFG[e];
            const active =
              fila.estado === e;

            return (
              <button
                key={e}
                disabled={fila.saving}
                onClick={() =>
                  onChange({
                    estado: e,
                    dirty: true,
                    saved: false,
                    error: '',
                    ...(e === 'ausente'
                      ? {
                          hora_entrada: '',
                          hora_salida: '',
                        }
                      : {}),
                    ...(e !== 'justificado'
                      ? { motivo: '' }
                      : {}),
                  })
                }
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-all disabled:opacity-50 ${
                  active
                    ? `${c.bg} ${c.border} ${c.color}`
                    : 'border-white/6 bg-slate-900/40 text-slate-600 hover:border-white/12 hover:text-slate-400'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-widest text-slate-500">
            Hora entrada
          </p>

          {permiteHoras ? (
            <TimePickerField
              value={fila.hora_entrada}
              disabled={fila.saving}
              placeholder="Entrada"
              accent={
                fila.estado === 'justificado'
                  ? 'amber'
                  : 'emerald'
              }
              onChange={(value) =>
                onChange({
                  hora_entrada: value,
                  dirty: true,
                  saved: false,
                  error: '',
                })
              }
            />
          ) : (
            <div className="rounded-xl border border-white/6 bg-slate-900/40 px-3 py-2.5 text-sm text-slate-700">
              —
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-[10px] uppercase tracking-widest text-slate-500">
            Hora salida
          </p>

          {permiteHoras ? (
            <TimePickerField
              value={fila.hora_salida}
              disabled={fila.saving}
              placeholder="Salida"
              accent={
                fila.estado === 'justificado'
                  ? 'amber'
                  : 'cyan'
              }
              onChange={(value) =>
                onChange({
                  hora_salida: value,
                  dirty: true,
                  saved: false,
                  error: '',
                })
              }
            />
          ) : (
            <div className="rounded-xl border border-white/6 bg-slate-900/40 px-3 py-2.5 text-sm text-slate-700">
              —
            </div>
          )}
        </div>
      </div>

      {fila.estado === 'justificado' && (
        <div className="mt-4">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-slate-500">
            Motivo
          </p>

          <input
            type="text"
            placeholder="Motivo…"
            className={inputCls}
            value={fila.motivo}
            disabled={fila.saving}
            onChange={(e) =>
              onChange({
                motivo: e.target.value,
                dirty: true,
                saved: false,
                error: '',
              })
            }
          />
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-white/6 bg-slate-950/30 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-500">
            Tiempo
          </p>

          <p
            className={`mt-1 text-sm font-semibold tabular-nums ${cfg.color}`}
          >
            {horasCalculadas}
          </p>
        </div>

        <button
          onClick={onGuardar}
          disabled={!puedeGuardar}
          className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-all sm:w-auto ${
            fila.saving
              ? 'border border-white/8 bg-slate-700/60 text-slate-500'
              : puedeGuardar
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm shadow-cyan-500/20 hover:opacity-90'
              : 'cursor-not-allowed border border-white/6 bg-slate-800/60 text-slate-700'
          }`}
        >
          {fila.saving
            ? 'Guardando…'
            : fila.saved &&
              !fila.dirty
            ? 'Guardado'
            : 'Guardar'}
        </button>
      </div>

      {fila.error && (
        <p className="mt-3 text-xs text-red-400">
          {fila.error}
        </p>
      )}
    </div>
  );
}

export default function JornadaPage() {
  const [fecha, setFecha] = useState(hoyISO());

  const [todosUsuarios, setTodosUsuarios] =
    useState<Usuario[]>([]);

  const [
    usuariosAsignados,
    setUsuariosAsignados,
  ] = useState<Usuario[]>([]);

  const [filas, setFilas] =
    useState<FilaTrabajo[]>([]);

  const [
    loadingUsuarios,
    setLoadingUsuarios,
  ] = useState(true);

  const [
    loadingRegistros,
    setLoadingRegistros,
  ] = useState(false);

  const [
    guardandoAsignacion,
    setGuardandoAsignacion,
  ] = useState(false);

  const [
    errorGlobal,
    setErrorGlobal,
  ] = useState('');

  const fetchDisponibles = useRef(
    async () => {}
  );

  const fetchAsignados = useRef(
    async (_fecha: string) => {}
  );

  const fetchRegistros = useRef(
    async (_fecha: string) => {}
  );

  useEffect(() => {
    fetchDisponibles.current =
      async () => {
        const resDisponibles =
          await fetch(
            '/api/jornada/usuarios?modo=disponibles',
            {
              method: 'GET',
              credentials: 'include',
              cache: 'no-store',
            }
          );

        const dataDisponibles =
          await resDisponibles
            .json()
            .catch(() => ({}));

        if (
          !resDisponibles.ok ||
          dataDisponibles?.ok !== true
        ) {
          throw new Error(
            typeof dataDisponibles?.error ===
              'string'
              ? dataDisponibles.error
              : 'Error al cargar usuarios disponibles'
          );
        }

        const usuarios = Array.isArray(
          dataDisponibles?.data
        )
          ? dataDisponibles.data.map(
              mapUsuario
            )
          : [];

        setTodosUsuarios(usuarios);
      };

    fetchAsignados.current =
      async (fechaActual: string) => {
        const resAsignados =
          await fetch(
            `/api/jornada/usuarios?fecha=${encodeURIComponent(
              fechaActual
            )}`,
            {
              method: 'GET',
              credentials: 'include',
              cache: 'no-store',
            }
          );

        const dataAsignados =
          await resAsignados
            .json()
            .catch(() => ({}));

        if (
          !resAsignados.ok ||
          dataAsignados?.ok !== true
        ) {
          throw new Error(
            typeof dataAsignados?.error ===
              'string'
              ? dataAsignados.error
              : 'Error al cargar asignados'
          );
        }

        const asignados = Array.isArray(
          dataAsignados?.data
        )
          ? dataAsignados.data.map(
              mapUsuario
            )
          : [];

        setUsuariosAsignados(asignados);
      };
  }, []);

  useEffect(() => {
    const cargarUsuarios =
      async () => {
        setLoadingUsuarios(true);
        setErrorGlobal('');

        try {
          await fetchDisponibles.current();
          await fetchAsignados.current(
            fecha
          );
        } catch (error) {
          console.error(
            'Error cargando usuarios de jornada:',
            error
          );

          setErrorGlobal(
            error instanceof Error
              ? error.message
              : 'Error de red al cargar usuarios.'
          );
        } finally {
          setLoadingUsuarios(false);
        }
      };

    void cargarUsuarios();
  }, [fecha]);

  useEffect(() => {
    fetchRegistros.current =
      async (fechaActual: string) => {
        setLoadingRegistros(true);
        setErrorGlobal('');

        try {
          const [
            resRegistros,
            resAsignados,
          ] = await Promise.all([
            fetch(
              `/api/jornada?fecha=${encodeURIComponent(
                fechaActual
              )}`,
              {
                method: 'GET',
                credentials: 'include',
                cache: 'no-store',
              }
            ),

            fetch(
              `/api/jornada/usuarios?fecha=${encodeURIComponent(
                fechaActual
              )}`,
              {
                method: 'GET',
                credentials: 'include',
                cache: 'no-store',
              }
            ),
          ]);

          const [
            dataRegistros,
            dataAsignados,
          ] = await Promise.all([
            resRegistros
              .json()
              .catch(() => ({})),

            resAsignados
              .json()
              .catch(() => ({})),
          ]);

          if (
            !resRegistros.ok ||
            dataRegistros?.ok !== true
          ) {
            throw new Error(
              typeof dataRegistros?.error ===
                'string'
                ? dataRegistros.error
                : 'Error al obtener registros'
            );
          }

          if (
            !resAsignados.ok ||
            dataAsignados?.ok !== true
          ) {
            throw new Error(
              typeof dataAsignados?.error ===
                'string'
                ? dataAsignados.error
                : 'Error al obtener asignados'
            );
          }

          const registros: RegistroJornada[] =
            Array.isArray(
              dataRegistros?.data
            )
              ? dataRegistros.data.map(
                  mapRegistro
                )
              : [];

          const asignados: Usuario[] =
            Array.isArray(
              dataAsignados?.data
            )
              ? dataAsignados.data.map(
                  mapUsuario
                )
              : [];

          setUsuariosAsignados(
            asignados
          );

          const registrosPorUsuario =
            new Map(
              registros.map((r) => [
                String(r.usuario_id),
                r,
              ])
            );

          const baseUsuarios = [
            ...asignados,
          ];

          for (const reg of registros) {
            if (
              !baseUsuarios.some(
                (u) =>
                  String(u.id) ===
                  String(reg.usuario_id)
              )
            ) {
              const usuarioMatch =
                todosUsuarios.find(
                  (u) =>
                    String(u.id) ===
                    String(
                      reg.usuario_id
                    )
                ) ??
                ({
                  id: String(
                    reg.usuario_id
                  ),
                  nombre: String(
                    reg.nombre ?? ''
                  ),
                  apellido: String(
                    reg.apellido ?? ''
                  ),
                  rol: '',
                  puesto: '',
                } as Usuario);

              baseUsuarios.push(
                usuarioMatch
              );
            }
          }

          setFilas((prev) => {
            const prevMap = new Map(
              prev.map((f) => [
                f.usuario.id,
                f,
              ])
            );

            return baseUsuarios.map(
              (usuario) => {
                const registro =
                  registrosPorUsuario.get(
                    usuario.id
                  ) ?? null;

                const previa =
                  prevMap.get(
                    usuario.id
                  );

                if (
                  previa &&
                  previa.dirty
                ) {
                  return {
                    ...previa,
                    usuario,
                    registro,
                  };
                }

                return filaDefault(
                  usuario,
                  registro
                );
              }
            );
          });
        } catch (error) {
          console.error(
            'Error obteniendo registros de jornada:',
            error
          );

          setErrorGlobal(
            error instanceof Error
              ? error.message
              : 'Error de red al obtener registros.'
          );
        } finally {
          setLoadingRegistros(
            false
          );
        }
      };
  }, [todosUsuarios]);

  useEffect(() => {
    if (!loadingUsuarios) {
      void fetchRegistros.current(
        fecha
      );
    }
  }, [fecha, loadingUsuarios]);

  async function persistirAsignados(
    siguienteUsuariosIds: string[]
  ) {
    if (guardandoAsignacion) {
      return false;
    }

    setGuardandoAsignacion(true);
    setErrorGlobal('');

    try {
      const idsNormalizados = [
        ...new Set(
          siguienteUsuariosIds
            .map((id) =>
              String(id).trim()
            )
            .filter(Boolean)
        ),
      ];

      const res = await fetch(
        '/api/jornada/usuarios',
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            usuarios_ids:
              idsNormalizados,
            fecha,
          }),
        }
      );

      const data = await res
        .json()
        .catch(() => ({}));

      if (
        !res.ok ||
        data?.ok !== true
      ) {
        setErrorGlobal(
          typeof data?.error === 'string'
            ? data.error
            : 'Error al actualizar usuarios asignados'
        );

        return false;
      }

      const asignados =
        Array.isArray(data?.data)
          ? data.data.map(
              mapUsuario
            )
          : [];

      setUsuariosAsignados(
        asignados
      );

      return true;
    } catch (error) {
      console.error(
        'Error actualizando usuarios asignados:',
        error
      );

      setErrorGlobal(
        'Error de red al actualizar usuarios asignados.'
      );

      return false;
    } finally {
      setGuardandoAsignacion(
        false
      );
    }
  }

  async function agregarUsuario(
    u: Usuario
  ) {
    if (
      filas.some(
        (f) =>
          f.usuario.id === u.id
      )
    ) {
      return;
    }

    /*
     * Importante:
     * solo utilizamos los usuarios realmente
     * asignados para construir la nueva lista.
     *
     * "filas" también puede contener usuarios
     * con registros históricos que ya no están
     * asignados a esta fecha.
     */
    const idsActuales =
      usuariosAsignados.map(
        (usuario) => usuario.id
      );

    const nuevosIds = [
      ...new Set([
        ...idsActuales,
        u.id,
      ]),
    ];

    const ok =
      await persistirAsignados(
        nuevosIds
      );

    if (!ok) return;

    setFilas((prev) => {
      if (
        prev.some(
          (f) =>
            f.usuario.id === u.id
        )
      ) {
        return prev;
      }

      return [
        ...prev,
        filaDefault(u, null),
      ];
    });

    await fetchRegistros.current(
      fecha
    );
  }

  async function quitarFila(
    usuarioId: string
  ) {
    const fila = filas.find(
      (f) =>
        f.usuario.id === usuarioId
    );

    /*
     * Una fila con registro existente no
     * representa necesariamente una asignación
     * activa. Además el botón de quitar solo
     * aparece cuando no existe registro.
     */
    if (fila?.registro) {
      setFilas((prev) =>
        prev.filter(
          (f) =>
            f.usuario.id !==
            usuarioId
        )
      );

      return;
    }

    const nuevosIds =
      usuariosAsignados
        .filter(
          (u) =>
            u.id !== usuarioId
        )
        .map((u) => u.id);

    const ok =
      await persistirAsignados(
        nuevosIds
      );

    if (!ok) return;

    setFilas((prev) =>
      prev.filter(
        (f) =>
          f.usuario.id !==
          usuarioId
      )
    );

    await fetchRegistros.current(
      fecha
    );
  }

  function actualizarFila(
    usuarioId: string,
    campos: Partial<FilaTrabajo>
  ) {
    setFilas((prev) =>
      prev.map((f) =>
        f.usuario.id === usuarioId
          ? {
              ...f,
              ...campos,
            }
          : f
      )
    );
  }

  async function guardarFila(
    usuarioId: string
  ) {
    const fila = filas.find(
      (f) =>
        f.usuario.id === usuarioId
    );

    if (!fila) return;

    if (fila.saving) return;

    const permiteHoras =
      fila.estado === 'presente' ||
      fila.estado === 'justificado';

    if (
      fila.estado === 'presente' &&
      !fila.hora_entrada
    ) {
      actualizarFila(usuarioId, {
        error:
          'Ingresa la hora de entrada',
      });

      return;
    }

    if (
      fila.estado ===
        'justificado' &&
      !fila.motivo.trim()
    ) {
      actualizarFila(usuarioId, {
        error:
          'Ingresa un motivo',
      });

      return;
    }

    if (
      permiteHoras &&
      fila.hora_entrada &&
      fila.hora_salida
    ) {
      const mins =
        calcularMinutosLocal(
          fila.hora_entrada,
          fila.hora_salida
        );

      if (mins <= 0) {
        actualizarFila(usuarioId, {
          error:
            'La hora de salida debe ser mayor que la de entrada',
        });

        return;
      }
    }

    actualizarFila(usuarioId, {
      saving: true,
      error: '',
    });

    try {
      const body: Record<
        string,
        unknown
      > = {
        usuario_id:
          fila.usuario.id,

        fecha,

        estado: fila.estado,

        motivo:
          fila.estado ===
          'justificado'
            ? fila.motivo.trim()
            : null,

        hora_entrada:
          fila.estado ===
            'presente' ||
          fila.estado ===
            'justificado'
            ? fila.hora_entrada ||
              null
            : null,

        hora_salida:
          fila.estado ===
            'presente' ||
          fila.estado ===
            'justificado'
            ? fila.hora_salida ||
              null
            : null,
      };

      const res = await fetch(
        '/api/jornada',
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      const data = await res
        .json()
        .catch(() => ({}));

      if (
        !res.ok ||
        data?.ok !== true
      ) {
        actualizarFila(usuarioId, {
          saving: false,

          error:
            typeof data?.error ===
            'string'
              ? data.error
              : 'Error al guardar',
        });

        return;
      }

      /*
       * Primero dejamos la fila local como
       * guardada para que el refresco posterior
       * pueda recuperar el registro definitivo.
       */
      actualizarFila(usuarioId, {
        saving: false,
        saved: true,
        dirty: false,
        error: '',
      });

      await fetchRegistros.current(
        fecha
      );

      setTimeout(() => {
        setFilas((prev) =>
          prev.map((f) =>
            f.usuario.id ===
            usuarioId
              ? {
                  ...f,
                  saved: false,
                }
              : f
          )
        );
      }, 1800);
    } catch (error) {
      console.error(
        'Error guardando jornada:',
        error
      );

      actualizarFila(usuarioId, {
        saving: false,
        error: 'Error de red',
      });
    }
  }

  const resumen = useMemo(() => {
    return {
      presentes: filas.filter(
        (f) =>
          f.registro?.estado ===
          'presente'
      ).length,

      ausentes: filas.filter(
        (f) =>
          f.registro?.estado ===
          'ausente'
      ).length,

      justificados: filas.filter(
        (f) =>
          f.registro?.estado ===
          'justificado'
      ).length,

      totalMinutos: filas.reduce(
        (acc, f) =>
          acc +
          (f.registro
            ?.minutos_trabajados ??
            0),
        0
      ),

      sinGuardar: filas.filter(
        (f) => f.dirty
      ).length,
    };
  }, [filas]);

  const usuariosEnTabla =
    useMemo(
      () =>
        new Set(
          filas.map(
            (f) =>
              f.usuario.id
          )
        ),
      [filas]
    );

  const fechaFormateada =
    new Date(
      `${fecha}T00:00:00`
    ).toLocaleDateString(
      'es-ES',
      {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }
    );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-0 sm:space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Registro de Jornada
          </h1>

          <p className="mt-0.5 text-sm capitalize text-slate-400">
            {fechaFormateada}
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap lg:w-auto">
          <div className="relative w-full sm:w-auto">
            <input
              type="date"
              value={fecha}
              onChange={(e) =>
                setFecha(e.target.value)
              }
              className="w-full cursor-pointer rounded-xl border border-white/10 bg-slate-800/80 py-2 pl-9 pr-3 text-sm text-white transition-all focus:border-cyan-500/40 focus:outline-none sm:w-[190px]"
            />

            <svg
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>

          {!loadingUsuarios && (
            <BuscadorUsuarios
              todosUsuarios={
                todosUsuarios
              }
              usuariosEnTabla={
                usuariosEnTabla
              }
              onAgregar={
                agregarUsuario
              }
            />
          )}
        </div>
      </div>

      {errorGlobal && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-400">
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

          <span>
            {errorGlobal}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Presentes',
            value:
              resumen.presentes,
            color:
              'text-emerald-400',
            bg: 'bg-emerald-500/8',
            border:
              'border-emerald-500/20',
          },
          {
            label: 'Ausentes',
            value:
              resumen.ausentes,
            color: 'text-red-400',
            bg: 'bg-red-500/8',
            border:
              'border-red-500/20',
          },
          {
            label: 'Justificados',
            value:
              resumen.justificados,
            color:
              'text-amber-400',
            bg: 'bg-amber-500/8',
            border:
              'border-amber-500/20',
          },
          {
            label:
              'Horas registradas',
            value: minutosAHoras(
              resumen.totalMinutos
            ),
            color:
              'text-cyan-400',
            bg: 'bg-cyan-500/8',
            border:
              'border-cyan-500/20',
          },
        ].map(
          ({
            label,
            value,
            color,
            bg,
            border,
          }) => (
            <div
              key={label}
              className={`rounded-2xl border px-4 py-3 ${bg} ${border}`}
            >
              <p className="mb-0.5 text-xs text-slate-500">
                {label}
              </p>

              <p
                className={`break-words text-2xl font-bold tabular-nums ${color}`}
              >
                {value}
              </p>
            </div>
          )
        )}
      </div>

      <div className="overflow-visible rounded-3xl border border-white/8 bg-slate-800/50">
        <div className="flex flex-col gap-3 border-b border-white/8 px-4 py-4 sm:px-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-cyan-400 to-blue-500" />

            <h2 className="truncate text-base font-semibold text-white">
              Usuarios a supervisar
            </h2>

            {filas.length > 0 && (
              <span className="rounded-full border border-white/8 bg-slate-700/60 px-2 py-0.5 text-xs text-slate-400">
                {filas.length}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            {guardandoAsignacion && (
              <div className="flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1">
                <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />

                <span className="text-xs font-medium text-cyan-400">
                  Actualizando supervisados…
                </span>
              </div>
            )}

            {resumen.sinGuardar >
              0 && (
              <div className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />

                <span className="text-xs font-medium text-amber-400">
                  {resumen.sinGuardar}{' '}
                  cambio
                  {resumen.sinGuardar >
                  1
                    ? 's'
                    : ''}{' '}
                  sin guardar
                </span>
              </div>
            )}
          </div>
        </div>

        {loadingRegistros ? (
          <div className="flex items-center justify-center py-16">
            <div className="relative h-10 w-10">
              <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20" />
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            </div>
          </div>
        ) : filas.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/6 bg-slate-700/30">
              <svg
                className="h-7 w-7 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>

            <p className="font-medium text-slate-400">
              Sin usuarios en la tabla
            </p>

            <p className="mt-1 max-w-md text-sm text-slate-600">
              Busca usuarios para supervisar y registrarlos en la seleccionado_en
            </p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-[980px] w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    {[
                      'Usuario',
                      'Estado',
                      'Hora entrada',
                      'Hora salida',
                      'Motivo',
                      'Tiempo',
                      'Acción',
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-widest text-slate-600"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filas.map(
                    (fila) => (
                      <FilaRegistro
                        key={
                          fila
                            .usuario.id
                        }
                        fila={fila}
                        onChange={(
                          campos
                        ) =>
                          actualizarFila(
                            fila
                              .usuario
                              .id,
                            campos
                          )
                        }
                        onGuardar={() =>
                          guardarFila(
                            fila
                              .usuario
                              .id
                          )
                        }
                        onQuitar={() =>
                          quitarFila(
                            fila
                              .usuario
                              .id
                          )
                        }
                      />
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 md:hidden">
              {filas.map(
                (fila) => (
                  <FilaRegistroMobile
                    key={
                      fila.usuario.id
                    }
                    fila={fila}
                    onChange={(
                      campos
                    ) =>
                      actualizarFila(
                        fila
                          .usuario
                          .id,
                        campos
                      )
                    }
                    onGuardar={() =>
                      guardarFila(
                        fila
                          .usuario
                          .id
                      )
                    }
                    onQuitar={() =>
                      quitarFila(
                        fila
                          .usuario
                          .id
                      )
                    }
                  />
                )
              )}
            </div>
          </>
        )}

        {filas.length > 0 && (
          <div className="flex items-start gap-2 border-t border-white/5 px-4 py-3 sm:px-5">
            <svg
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>

            <p className="text-xs leading-relaxed text-slate-600">
              Puedes guardar primero la entrada, luego volver a guardar la salida, después corregir cualquier hora sin duplicar registros, y usar justificado también con horas si aplica.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}