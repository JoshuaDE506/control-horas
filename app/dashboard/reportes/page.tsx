'use client';

import { useEffect, useState, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

type TabReporte = 'jornada' | 'tareas';

type FiltrosJornada = {
  fecha_inicio: string;
  fecha_fin: string;
  usuario_id: string;
  estado: string;
};

type ResumenGeneral = {
  total_registros: number;
  presentes: number;
  ausentes: number;
  justificados: number;
  horas_totales: number;
};

type ResumenColaborador = {
  usuario_id: string;
  colaborador: string;
  puesto: string | null;
  presentes: number;
  ausentes: number;
  justificados: number;
  horas_totales: number;
};

type RegistroJornada = {
  id: string;
  fecha: string;
  colaborador: string;
  puesto: string | null;
  supervisor: string;
  estado: string;
  hora_entrada: string | null;
  hora_salida: string | null;
  horas_trabajadas: number;
  motivo: string | null;
};

type ReporteJornada = {
  resumen_general: ResumenGeneral;
  resumen_por_colaborador: ResumenColaborador[];
  registros: RegistroJornada[];
  filtros: {
    fecha_inicio: string | null;
    fecha_fin: string | null;
    estado: string | null;
  };
};

type Usuario = {
  id: string;
  nombre: string;
  apellido: string;
  puesto: string;
};

type Proyecto = {
  id: string;
  nombre: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hoyISO() {
  return new Date().toISOString().split('T')[0];
}

function primerDiaMesISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatFecha(iso: string) {
  if (!iso) return '—';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    const [y, m, d] = iso.split('-');
    if (y && m && d) return `${d}/${m}/${y}`;
    return iso;
  }

  return date.toLocaleDateString('es-CR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatHoras(h: number) {
  if (!h || h <= 0) return '—';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h ${String(mm).padStart(2, '0')}m`;
}

function normalizarEstadoJornada(estado: string) {
  const v = String(estado ?? '').trim().toLowerCase();

  if (v === 'presente') return 'presente';
  if (v === 'justificado') return 'justificado';
  return 'ausente';
}

const ESTADO_CFG: Record<
  string,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  presente: {
    label: 'Presente',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
    dot: 'bg-emerald-400',
  },
  ausente: {
    label: 'Ausente',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/25',
    dot: 'bg-red-400',
  },
  justificado: {
    label: 'Justificado',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
    dot: 'bg-amber-400',
  },
};

// ─── Componentes pequeños ─────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-700/40 ${className ?? ''}`} />;
}

function StatCard({
  label,
  value,
  sub,
  color,
  bg,
  border,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${bg} ${border}`}>
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${bg} ${border} ${color}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400">{label}</p>
          <p className={`break-words text-2xl font-bold leading-none tabular-nums ${color}`}>
            {value}
          </p>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function SelectFiltro({
  label,
  value,
  onChange,
  children,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none rounded-xl border border-white/8 bg-slate-900/60 px-3 py-2 text-sm text-white transition-all focus:border-cyan-500/40 focus:outline-none disabled:opacity-50"
      >
        {children}
      </select>
    </div>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/8 bg-slate-900/60 px-3 py-2 text-sm text-white transition-all focus:border-cyan-500/40 focus:outline-none"
      />
    </div>
  );
}

// ─── Export button ────────────────────────────────────────────────────────────

function ExportButton({
  href,
  loading,
  disabled,
}: {
  href: string;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <a
      href={disabled || loading ? undefined : href}
      onClick={disabled || loading ? (e) => e.preventDefault() : undefined}
      className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all select-none sm:w-auto ${
        disabled || loading
          ? 'cursor-not-allowed border-white/8 bg-slate-800/60 text-slate-500 opacity-40'
          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/20'
      }`}
      download
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      Excel
    </a>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="py-12 text-center text-sm text-slate-500">{text}</div>;
}

function JornadaResumenCard({ r }: { r: ResumenColaborador }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-slate-900/30 p-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 text-[10px] font-bold text-white">
          {r.colaborador
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{r.colaborador}</p>
          <p className="truncate text-xs text-slate-500">{r.puesto ?? '—'}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Presentes</p>
          <p className="text-sm font-semibold tabular-nums text-emerald-400">{r.presentes}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Ausentes</p>
          <p className="text-sm font-semibold tabular-nums text-red-400">{r.ausentes}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Justificados</p>
          <p className="text-sm font-semibold tabular-nums text-amber-400">{r.justificados}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Horas</p>
          <p className="text-sm font-semibold tabular-nums text-cyan-400">
            {formatHoras(r.horas_totales)}
          </p>
        </div>
      </div>
    </div>
  );
}

function JornadaDetalleCard({ r }: { r: RegistroJornada }) {
  const estadoKey = normalizarEstadoJornada(r.estado);
  const cfg = ESTADO_CFG[estadoKey] ?? ESTADO_CFG.ausente;

  return (
    <div className="rounded-2xl border border-white/8 bg-slate-900/30 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{r.colaborador}</p>
          <p className="mt-0.5 text-xs text-slate-500">{r.supervisor}</p>
        </div>

        <span
          className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cfg.bg} ${cfg.border} ${cfg.color}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Fecha</p>
          <p className="text-sm tabular-nums text-slate-300">{formatFecha(r.fecha)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Horas</p>
          <p className="text-sm font-medium tabular-nums text-cyan-400">
            {formatHoras(r.horas_trabajadas)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Entrada</p>
          <p className="text-sm tabular-nums text-slate-300">{r.hora_entrada ?? '—'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Salida</p>
          <p className="text-sm tabular-nums text-slate-300">{r.hora_salida ?? '—'}</p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[10px] uppercase tracking-wider text-slate-500">Motivo</p>
        <p className="mt-1 break-words text-xs text-slate-400">{r.motivo ?? '—'}</p>
      </div>
    </div>
  );
}

// ─── Tab Jornada ──────────────────────────────────────────────────────────────

function TabJornada() {
  const [filtros, setFiltros] = useState<FiltrosJornada>({
    fecha_inicio: primerDiaMesISO(),
    fecha_fin: hoyISO(),
    usuario_id: '',
    estado: '',
  });
  const [reporte, setReporte] = useState<ReporteJornada | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [vistaTabla, setVistaTabla] = useState<'resumen' | 'detalle'>('resumen');

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch('/api/jornada/usuarios?modo=disponibles', {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = await res.json();
        if (data.ok) setUsuarios(data.data ?? []);
      } catch {}
    };
    fetch_();
  }, []);

  const buildQS = useCallback((f: FiltrosJornada) => {
    const p = new URLSearchParams();
    if (f.fecha_inicio) p.set('fecha_inicio', f.fecha_inicio);
    if (f.fecha_fin) p.set('fecha_fin', f.fecha_fin);
    if (f.usuario_id) p.set('usuario_id', f.usuario_id);
    if (f.estado) p.set('estado', f.estado);
    return p.toString();
  }, []);

  async function buscar() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/reportes/jornada?${buildQS(filtros)}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.ok) {
        setReporte(data);
      } else {
        setError(data.error ?? 'Error al obtener reporte');
      }
    } catch {
      setError('Error de red al obtener reporte.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportQS = buildQS(filtros);
  const tieneResultados = (reporte?.registros.length ?? 0) > 0;

  return (
    <div className="space-y-5">
      <div className="space-y-4 rounded-3xl border border-white/8 bg-slate-800/50 p-4 sm:p-5">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gradient-to-b from-cyan-400 to-blue-500" />
          <h3 className="text-sm font-semibold text-white">Filtros</h3>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DateInput
            label="Fecha inicio"
            value={filtros.fecha_inicio}
            onChange={(v) => setFiltros((f) => ({ ...f, fecha_inicio: v }))}
          />
          <DateInput
            label="Fecha fin"
            value={filtros.fecha_fin}
            onChange={(v) => setFiltros((f) => ({ ...f, fecha_fin: v }))}
          />
          <SelectFiltro
            label="Colaborador"
            value={filtros.usuario_id}
            onChange={(v) => setFiltros((f) => ({ ...f, usuario_id: v }))}
          >
            <option value="">Todos</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} {u.apellido}
              </option>
            ))}
          </SelectFiltro>
          <SelectFiltro
            label="Estado"
            value={filtros.estado}
            onChange={(v) => setFiltros((f) => ({ ...f, estado: v }))}
          >
            <option value="">Todos</option>
            <option value="presente">Presente</option>
            <option value="ausente">Ausente</option>
            <option value="justificado">Justificado</option>
          </SelectFiltro>
        </div>

        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:w-auto">
            <ExportButton
              href={`/api/reportes/jornada/export/excel?${exportQS}`}
              disabled={!tieneResultados}
            />
          </div>
          <button
            onClick={buscar}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:opacity-90 disabled:opacity-50 sm:w-auto"
          >
            {loading ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Generando…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                Generar reporte
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading && !reporte && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      )}

      {reporte && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Presentes"
              value={reporte.resumen_general.presentes}
              sub={`de ${reporte.resumen_general.total_registros} registros`}
              color="text-emerald-400"
              bg="bg-emerald-500/8"
              border="border-emerald-500/20"
              icon={
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
            />
            <StatCard
              label="Ausentes"
              value={reporte.resumen_general.ausentes}
              color="text-red-400"
              bg="bg-red-500/8"
              border="border-red-500/20"
              icon={
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
            />
            <StatCard
              label="Justificados"
              value={reporte.resumen_general.justificados}
              color="text-amber-400"
              bg="bg-amber-500/8"
              border="border-amber-500/20"
              icon={
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  />
                </svg>
              }
            />
            <StatCard
              label="Horas registradas"
              value={formatHoras(reporte.resumen_general.horas_totales)}
              color="text-cyan-400"
              bg="bg-cyan-500/8"
              border="border-cyan-500/20"
              icon={
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
            />
          </div>

          <div className="w-full overflow-x-auto">
            <div className="flex w-max min-w-full items-center gap-1 rounded-xl border border-white/6 bg-slate-900/50 p-1">
              {(['resumen', 'detalle'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setVistaTabla(v)}
                  className={`rounded-lg px-4 py-1.5 text-xs font-semibold capitalize transition-all ${
                    vistaTabla === v
                      ? 'border border-white/10 bg-slate-700 text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {v === 'resumen' ? 'Por colaborador' : 'Detalle completo'}
                </button>
              ))}
            </div>
          </div>

          {vistaTabla === 'resumen' && (
            <div className="overflow-hidden rounded-3xl border border-white/8 bg-slate-800/50">
              <div className="flex flex-col gap-2 border-b border-white/8 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-1 rounded-full bg-gradient-to-b from-cyan-400 to-blue-500" />
                  <h3 className="text-sm font-semibold text-white">Resumen por colaborador</h3>
                </div>
                <span className="text-xs text-slate-500">
                  {reporte.resumen_por_colaborador.length} colaboradores
                </span>
              </div>

              {reporte.resumen_por_colaborador.length === 0 ? (
                <EmptyState text="Sin datos para los filtros seleccionados" />
              ) : (
                <>
                  <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full min-w-[900px]">
                      <thead>
                        <tr className="border-b border-white/5">
                          {[
                            'Colaborador',
                            'Puesto',
                            'Presentes',
                            'Ausentes',
                            'Justificados',
                            'Horas totales',
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-5 py-3 text-left text-[10px] font-medium uppercase tracking-widest text-slate-600"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/4">
                        {reporte.resumen_por_colaborador.map((r) => (
                          <tr key={r.usuario_id} className="transition-colors hover:bg-slate-700/20">
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 text-[10px] font-bold text-white">
                                  {r.colaborador
                                    .split(' ')
                                    .map((n) => n[0])
                                    .join('')
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </div>
                                <span className="text-sm font-medium text-white">{r.colaborador}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-sm text-slate-400">{r.puesto ?? '—'}</td>
                            <td className="px-5 py-3.5">
                              <span className="text-sm font-semibold tabular-nums text-emerald-400">
                                {r.presentes}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="text-sm font-semibold tabular-nums text-red-400">
                                {r.ausentes}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="text-sm font-semibold tabular-nums text-amber-400">
                                {r.justificados}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="text-sm font-medium tabular-nums text-cyan-400">
                                {formatHoras(r.horas_totales)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-3 p-4 lg:hidden">
                    {reporte.resumen_por_colaborador.map((r) => (
                      <JornadaResumenCard key={r.usuario_id} r={r} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {vistaTabla === 'detalle' && (
            <div className="overflow-hidden rounded-3xl border border-white/8 bg-slate-800/50">
              <div className="flex flex-col gap-2 border-b border-white/8 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-1 rounded-full bg-gradient-to-b from-cyan-400 to-blue-500" />
                  <h3 className="text-sm font-semibold text-white">Detalle de registros</h3>
                </div>
                <span className="text-xs text-slate-500">{reporte.registros.length} registros</span>
              </div>

              {reporte.registros.length === 0 ? (
                <EmptyState text="Sin registros para los filtros seleccionados" />
              ) : (
                <>
                  <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full min-w-[1080px]">
                      <thead>
                        <tr className="border-b border-white/5">
                          {[
                            'Fecha',
                            'Colaborador',
                            'Supervisor',
                            'Estado',
                            'Entrada',
                            'Salida',
                            'Horas',
                            'Motivo',
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-5 py-3 text-left text-[10px] font-medium uppercase tracking-widest text-slate-600"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/4">
                        {reporte.registros.map((r) => {
                          const estadoKey = normalizarEstadoJornada(r.estado);
                          const cfg = ESTADO_CFG[estadoKey] ?? ESTADO_CFG.ausente;

                          return (
                            <tr key={r.id} className="transition-colors hover:bg-slate-700/20">
                              <td className="px-5 py-3 text-sm tabular-nums text-slate-300">
                                {formatFecha(r.fecha)}
                              </td>
                              <td className="px-5 py-3 text-sm font-medium text-white">
                                {r.colaborador}
                              </td>
                              <td className="px-5 py-3 text-sm text-slate-400">{r.supervisor}</td>
                              <td className="px-5 py-3">
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cfg.bg} ${cfg.border} ${cfg.color}`}
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                                  {cfg.label}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-sm tabular-nums text-slate-300">
                                {r.hora_entrada ?? '—'}
                              </td>
                              <td className="px-5 py-3 text-sm tabular-nums text-slate-300">
                                {r.hora_salida ?? '—'}
                              </td>
                              <td className="px-5 py-3 text-sm font-medium tabular-nums text-cyan-400">
                                {formatHoras(r.horas_trabajadas)}
                              </td>
                              <td className="max-w-[160px] truncate px-5 py-3 text-xs text-slate-500">
                                {r.motivo ?? '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-3 p-4 lg:hidden">
                    {reporte.registros.map((r) => (
                      <JornadaDetalleCard key={r.id} r={r} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Tab Tareas ───────────────────────────────────────────────────────────────

type FiltrosTareas = {
  fecha_inicio: string;
  fecha_fin: string;
  proyecto_id: string;
  usuario_id: string;
  estado: string;
  prioridad: string;
};

type TareaRegistroRaw = {
  id?: string | number;
  titulo?: string;
  descripcion?: string | null;

  estado?: string | null;
  estado_label?: string | null;

  prioridad?: string | null;

  asignado_a?: string | null;
  asignado?: string | null;
  usuario_asignado?: string | null;
  colaborador?: string | null;

  creado_por?: string | null;
  creador?: string | null;
  creador_nombre?: string | null;

  fecha_limite?: string | null;
  fecha_fin?: string | null;

  fecha_completado?: string | null;
  fecha_completada?: string | null;
  fecha_aprobacion?: string | null;

  fecha_creacion?: string | null;
  creado_en?: string | null;
};

type TareaRegistro = {
  id: string;
  titulo: string;
  descripcion?: string | null;
  estado: string;
  prioridad: string;
  asignado_a: string;
  creado_por: string;
  fecha_limite?: string | null;
  fecha_completado?: string | null;
  fecha_creacion: string;
};

type ResumenTareas = {
  total: number;
  pendientes: number;
  en_progreso: number;
  revision: number;
  completadas: number;
  canceladas: number;
};

type ReporteTareas = {
  resumen: ResumenTareas;
  tareas: TareaRegistro[];
};

function normalizarEstadoTarea(valor: unknown) {
  const v = String(valor ?? '').trim().toLowerCase();

  if (
    v === 'in-progress' ||
    v === 'in_progress' ||
    v === 'en progreso' ||
    v === 'en_progreso'
  ) {
    return 'in-progress';
  }

  if (v === 'review' || v === 'revision' || v === 'revisión') {
    return 'review';
  }

  if (v === 'completed' || v === 'completada' || v === 'completado') {
    return 'completed';
  }

  if (v === 'cancelada' || v === 'cancelado') {
    return 'cancelada';
  }

  return 'todo';
}

function normalizarPrioridadTarea(valor: unknown) {
  const v = String(valor ?? '').trim().toLowerCase();

  if (v === 'critica' || v === 'crítica') return 'critica';
  if (v === 'alta') return 'alta';
  if (v === 'baja') return 'baja';
  return 'media';
}

const TAREA_ESTADO_CFG: Record<
  string,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  todo: {
    label: 'Por hacer',
    color: 'text-slate-300',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/25',
    dot: 'bg-slate-400',
  },
  'in-progress': {
    label: 'En progreso',
    color: 'text-cyan-300',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/25',
    dot: 'bg-cyan-400',
  },
  review: {
    label: 'En revisión',
    color: 'text-amber-300',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
    dot: 'bg-amber-400',
  },
  completed: {
    label: 'Completada',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
    dot: 'bg-emerald-400',
  },
  cancelada: {
    label: 'Cancelada',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/25',
    dot: 'bg-red-400',
  },
};

const TAREA_PRIORIDAD_CFG: Record<string, { label: string; color: string }> = {
  critica: { label: 'Crítica', color: 'text-fuchsia-400' },
  alta: { label: 'Alta', color: 'text-red-400' },
  media: { label: 'Media', color: 'text-amber-400' },
  baja: { label: 'Baja', color: 'text-slate-400' },
};

function mapTareaRegistro(raw: TareaRegistroRaw): TareaRegistro {
  return {
    id: String(raw.id ?? ''),
    titulo: String(raw.titulo ?? 'Sin título'),
    descripcion: raw.descripcion ?? null,
    estado: normalizarEstadoTarea(raw.estado ?? raw.estado_label),
    prioridad: normalizarPrioridadTarea(raw.prioridad),
    asignado_a:
      raw.asignado_a ??
      raw.asignado ??
      raw.usuario_asignado ??
      raw.colaborador ??
      '—',
    creado_por:
      raw.creado_por ??
      raw.creador ??
      raw.creador_nombre ??
      '—',
    fecha_limite: raw.fecha_limite ?? raw.fecha_fin ?? null,
    fecha_completado:
      raw.fecha_completado ??
      raw.fecha_completada ??
      raw.fecha_aprobacion ??
      null,
    fecha_creacion: raw.fecha_creacion ?? raw.creado_en ?? '',
  };
}

function TareaCard({ t }: { t: TareaRegistro }) {
  const estadoCfg = TAREA_ESTADO_CFG[t.estado] ?? TAREA_ESTADO_CFG.todo;
  const prioridadCfg = TAREA_PRIORIDAD_CFG[t.prioridad] ?? TAREA_PRIORIDAD_CFG.media;

  return (
    <div className="rounded-2xl border border-white/8 bg-slate-900/30 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{t.titulo}</p>
          {t.descripcion && (
            <p className="mt-1 break-words text-xs text-slate-500">{t.descripcion}</p>
          )}
        </div>

        <span
          className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${estadoCfg.bg} ${estadoCfg.border} ${estadoCfg.color}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${estadoCfg.dot}`} />
          {estadoCfg.label}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Asignado a</p>
          <p className="break-words text-sm text-slate-300">{t.asignado_a || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Creado por</p>
          <p className="break-words text-sm text-slate-400">{t.creado_por || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Prioridad</p>
          <p className={`text-sm font-semibold ${prioridadCfg.color}`}>{prioridadCfg.label}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Creación</p>
          <p className="text-sm tabular-nums text-slate-400">
            {t.fecha_creacion ? formatFecha(t.fecha_creacion) : '—'}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[10px] uppercase tracking-wider text-slate-500">Completada</p>
        <p className="text-sm tabular-nums text-slate-400">
          {t.fecha_completado ? formatFecha(t.fecha_completado) : '—'}
        </p>
      </div>
    </div>
  );
}

function TabTareas() {
  const [filtros, setFiltros] = useState<FiltrosTareas>({
    fecha_inicio: primerDiaMesISO(),
    fecha_fin: hoyISO(),
    proyecto_id: '',
    usuario_id: '',
    estado: '',
    prioridad: '',
  });

  const [reporte, setReporte] = useState<ReporteTareas | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);

  useEffect(() => {
    const fetchUsuarios = async () => {
      try {
        const res = await fetch('/api/jornada/usuarios?modo=disponibles', {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = await res.json();

        if (data.ok) {
          setUsuarios(Array.isArray(data.data) ? data.data : []);
        }
      } catch {}
    };

    fetchUsuarios();
  }, []);

  useEffect(() => {
    const fetchProyectos = async () => {
      try {
        const [creadosRes, miembroRes] = await Promise.all([
          fetch('/api/proyectos?scope=creados', {
            credentials: 'include',
            cache: 'no-store',
          }),
          fetch('/api/proyectos?scope=miembro', {
            credentials: 'include',
            cache: 'no-store',
          }),
        ]);

        const [creadosData, miembroData] = await Promise.all([
          creadosRes.json(),
          miembroRes.json(),
        ]);

        const creados = Array.isArray(creadosData?.proyectos) ? creadosData.proyectos : [];
        const miembro = Array.isArray(miembroData?.proyectos) ? miembroData.proyectos : [];

        const mapa = new Map<string, Proyecto>();

        [...creados, ...miembro].forEach((p: any) => {
          const id = String(p?.id ?? '').trim();
          if (!id) return;

          mapa.set(id, {
            id,
            nombre: String(p?.nombre ?? `Proyecto ${id}`),
          });
        });

        setProyectos(Array.from(mapa.values()));
      } catch {
        setProyectos([]);
      }
    };

    fetchProyectos();
  }, []);

  function buildQS(f: FiltrosTareas) {
    const p = new URLSearchParams();

    if (f.fecha_inicio) p.set('fecha_inicio', f.fecha_inicio);
    if (f.fecha_fin) p.set('fecha_fin', f.fecha_fin);
    if (f.proyecto_id) p.set('proyecto_id', f.proyecto_id);
    if (f.usuario_id) p.set('usuario_id', f.usuario_id);
    if (f.estado) p.set('estado', f.estado);
    if (f.prioridad) p.set('prioridad', f.prioridad);

    return p.toString();
  }

  async function buscar() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/reportes/tareas?${buildQS(filtros)}`, {
        credentials: 'include',
        cache: 'no-store',
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setError(data?.error ?? 'Error al obtener reporte de tareas');
        setReporte(null);
        return;
      }

      const tareasRaw: TareaRegistroRaw[] = Array.isArray(data?.tareas) ? data.tareas : [];
      const tareas: TareaRegistro[] = tareasRaw.map(mapTareaRegistro);

      const totalCalculado = tareas.length;
      const pendientesCalculado = tareas.filter((t) => t.estado === 'todo').length;
      const enProgresoCalculado = tareas.filter((t) => t.estado === 'in-progress').length;
      const revisionCalculado = tareas.filter((t) => t.estado === 'review').length;
      const completadasCalculado = tareas.filter((t) => t.estado === 'completed').length;
      const canceladasCalculado = tareas.filter((t) => t.estado === 'cancelada').length;

      const resumen: ResumenTareas = {
        total: Number(data?.resumen?.total ?? totalCalculado),
        pendientes: Number(data?.resumen?.pendientes ?? pendientesCalculado),
        en_progreso: Number(data?.resumen?.en_progreso ?? enProgresoCalculado),
        revision: Number(data?.resumen?.revision ?? revisionCalculado),
        completadas: Number(data?.resumen?.completadas ?? completadasCalculado),
        canceladas: Number(data?.resumen?.canceladas ?? canceladasCalculado),
      };

      setReporte({
        resumen,
        tareas,
      });
    } catch {
      setError('Error de red al obtener reporte.');
      setReporte(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportQS = buildQS(filtros);
  const tieneResultados = (reporte?.tareas.length ?? 0) > 0;

  return (
    <div className="space-y-5">
      <div className="space-y-4 rounded-3xl border border-white/8 bg-slate-800/50 p-4 sm:p-5">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gradient-to-b from-violet-400 to-purple-500" />
          <h3 className="text-sm font-semibold text-white">Filtros</h3>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <DateInput
            label="Fecha inicio"
            value={filtros.fecha_inicio}
            onChange={(v) => setFiltros((f) => ({ ...f, fecha_inicio: v }))}
          />

          <DateInput
            label="Fecha fin"
            value={filtros.fecha_fin}
            onChange={(v) => setFiltros((f) => ({ ...f, fecha_fin: v }))}
          />

          <SelectFiltro
            label="Proyecto"
            value={filtros.proyecto_id}
            onChange={(v) => setFiltros((f) => ({ ...f, proyecto_id: v }))}
          >
            <option value="">Todos</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </SelectFiltro>

          <SelectFiltro
            label="Asignado a"
            value={filtros.usuario_id}
            onChange={(v) => setFiltros((f) => ({ ...f, usuario_id: v }))}
          >
            <option value="">Todos</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} {u.apellido}
              </option>
            ))}
          </SelectFiltro>

          <SelectFiltro
            label="Estado"
            value={filtros.estado}
            onChange={(v) => setFiltros((f) => ({ ...f, estado: v }))}
          >
            <option value="">Todos</option>
            <option value="todo">Por hacer</option>
            <option value="in-progress">En progreso</option>
            <option value="review">En revisión</option>
            <option value="completed">Completada</option>
          </SelectFiltro>

          <SelectFiltro
            label="Prioridad"
            value={filtros.prioridad}
            onChange={(v) => setFiltros((f) => ({ ...f, prioridad: v }))}
          >
            <option value="">Todas</option>
            <option value="critica">Crítica</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </SelectFiltro>
        </div>

        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:w-auto">
            <ExportButton
              href={`/api/reportes/tareas/export/excel?${exportQS}`}
              disabled={!tieneResultados}
            />
          </div>
          <button
            onClick={buscar}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:opacity-90 disabled:opacity-50 sm:w-auto"
          >
            {loading ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Generando…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                Generar reporte
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading && !reporte && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      )}

      {reporte && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="Total tareas"
              value={reporte.resumen.total}
              color="text-slate-300"
              bg="bg-slate-700/20"
              border="border-white/8"
              icon={
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
              }
            />
            <StatCard
              label="Por hacer"
              value={reporte.resumen.pendientes}
              color="text-slate-300"
              bg="bg-slate-500/8"
              border="border-slate-500/20"
              icon={
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  />
                </svg>
              }
            />
            <StatCard
              label="En progreso"
              value={reporte.resumen.en_progreso}
              color="text-blue-400"
              bg="bg-blue-500/8"
              border="border-blue-500/20"
              icon={
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
            />
            <StatCard
              label="En revisión"
              value={reporte.resumen.revision}
              color="text-amber-400"
              bg="bg-amber-500/8"
              border="border-amber-500/20"
              icon={
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              }
            />
            <StatCard
              label="Completadas"
              value={reporte.resumen.completadas}
              sub={
                reporte.resumen.total > 0
                  ? `${Math.round((reporte.resumen.completadas / reporte.resumen.total) * 100)}% completado`
                  : undefined
              }
              color="text-emerald-400"
              bg="bg-emerald-500/8"
              border="border-emerald-500/20"
              icon={
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
            />
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/8 bg-slate-800/50">
            <div className="flex flex-col gap-2 border-b border-white/8 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-center gap-2">
                <div className="h-5 w-1 rounded-full bg-gradient-to-b from-violet-400 to-purple-500" />
                <h3 className="text-sm font-semibold text-white">Listado de tareas</h3>
              </div>
              <span className="text-xs text-slate-500">{reporte.tareas.length} tareas</span>
            </div>

            {reporte.tareas.length === 0 ? (
              <EmptyState text="Sin tareas para los filtros seleccionados" />
            ) : (
              <>
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[1100px]">
                    <thead>
                      <tr className="border-b border-white/5">
                        {[
                          'Título',
                          'Asignado a',
                          'Creado por',
                          'Estado',
                          'Prioridad',
                          'Fecha creación',
                          'Completada',
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-5 py-3 text-left text-[10px] font-medium uppercase tracking-widest text-slate-600"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/4">
                      {reporte.tareas.map((t) => {
                        const estadoCfg = TAREA_ESTADO_CFG[t.estado] ?? TAREA_ESTADO_CFG.todo;
                        const prioridadCfg =
                          TAREA_PRIORIDAD_CFG[t.prioridad] ?? TAREA_PRIORIDAD_CFG.media;

                        return (
                          <tr key={t.id} className="transition-colors hover:bg-slate-700/20">
                            <td className="max-w-[240px] px-5 py-3.5">
                              <p className="truncate text-sm font-medium text-white">{t.titulo}</p>
                              {t.descripcion && (
                                <p className="mt-0.5 truncate text-xs text-slate-500">
                                  {t.descripcion}
                                </p>
                              )}
                            </td>

                            <td className="px-5 py-3.5 text-sm text-slate-300">
                              {t.asignado_a || <span className="text-slate-600">—</span>}
                            </td>

                            <td className="px-5 py-3.5 text-sm text-slate-400">
                              {t.creado_por || <span className="text-slate-600">—</span>}
                            </td>

                            <td className="px-5 py-3.5">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${estadoCfg.bg} ${estadoCfg.border} ${estadoCfg.color}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${estadoCfg.dot}`} />
                                {estadoCfg.label}
                              </span>
                            </td>

                            <td className="px-5 py-3.5">
                              <span className={`text-sm font-semibold ${prioridadCfg.color}`}>
                                {prioridadCfg.label}
                              </span>
                            </td>

                            <td className="px-5 py-3.5 text-sm tabular-nums text-slate-400">
                              {t.fecha_creacion ? (
                                formatFecha(t.fecha_creacion)
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>

                            <td className="px-5 py-3.5 text-sm tabular-nums text-slate-400">
                              {t.fecha_completado ? (
                                formatFecha(t.fecha_completado)
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-3 p-4 lg:hidden">
                  {reporte.tareas.map((t) => (
                    <TareaCard key={t.id} t={t} />
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportesPage() {
  const [tab, setTab] = useState<TabReporte>('jornada');

  const tabs: { id: TabReporte; label: string; icon: React.ReactNode; accent: string }[] = [
    {
      id: 'jornada',
      label: 'Jornada',
      accent: 'from-cyan-500 to-blue-600',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      id: 'tareas',
      label: 'Tareas',
      accent: 'from-violet-500 to-purple-600',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      ),
    },
  ];

  const activeTab = tabs.find((t) => t.id === tab)!;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Reportes</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Consulta y exporta la información de tu equipo
          </p>
        </div>

        <div className="w-full overflow-x-auto lg:w-auto">
          <div className="flex w-max min-w-full items-center gap-1 rounded-2xl border border-white/8 bg-slate-800/80 p-1 lg:min-w-0">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                  tab === t.id
                    ? `bg-gradient-to-r ${t.accent} text-white shadow-lg`
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <div className="flex w-fit items-center gap-2 rounded-2xl border border-white/6 bg-slate-800/40 px-4 py-2.5">
          <div
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${activeTab.accent} text-white`}
          >
            <span className="scale-75">{activeTab.icon}</span>
          </div>
          <span className="whitespace-nowrap text-xs text-slate-400">
            Reportes
            <span className="mx-1.5 text-slate-600">/</span>
            <span className="font-medium text-white">{activeTab.label}</span>
          </span>
        </div>
      </div>

      {tab === 'jornada' && <TabJornada />}
      {tab === 'tareas' && <TabTareas />}
    </div>
  );
}