// components/TaskFormalModal.tsx
'use client';

import React, { useEffect } from 'react';

type Prioridad =
  | 'baja'
  | 'media'
  | 'alta'
  | 'critica';

type Estado =
  | 'todo'
  | 'in-progress'
  | 'review'
  | 'completed';

export interface TaskFormData {
  titulo: string;
  descripcion: string;
  prioridad: Prioridad;
  estado: Estado;
  tiempo_estimado_dias: string;
  tiempo_estimado_horas: string;
  tiempo_estimado_minutos: string;
  horas_por_dia: '8' | '12';
  max_participantes: string;
}

type TaskModalMode = 'create' | 'edit';

interface TaskFormModalProps {
  isOpen: boolean;
  mode: TaskModalMode;
  formData: TaskFormData;
  error: string | null;
  saving: boolean;
  canManage: boolean;
  onChange: (data: TaskFormData) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export default function TaskFormModal({
  isOpen,
  mode,
  formData,
  error,
  saving,
  canManage,
  onChange,
  onClose,
  onSubmit,
}: TaskFormModalProps) {
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
      if (e.key === 'Escape' && !saving) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, saving, onClose]);

  if (!isOpen) return null;

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement |
      HTMLTextAreaElement |
      HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    onChange({
      ...formData,
      [name]: value,
    });
  };

  const tituloModal =
    mode === 'create'
      ? 'Crear Nueva Tarea'
      : 'Editar Tarea';

  const submitLabel = saving
    ? mode === 'create'
      ? 'Creando...'
      : 'Guardando...'
    : mode === 'create'
    ? 'Crear Tarea'
    : 'Guardar cambios';

  const dias = Math.max(
    0,
    parseInt(
      formData.tiempo_estimado_dias || '0',
      10
    ) || 0
  );

  const horas = Math.max(
    0,
    parseInt(
      formData.tiempo_estimado_horas || '0',
      10
    ) || 0
  );

  const minutos = Math.max(
    0,
    Math.min(
      59,
      parseInt(
        formData.tiempo_estimado_minutos || '0',
        10
      ) || 0
    )
  );

  const horasPorDia =
    formData.horas_por_dia === '12'
      ? 12
      : 8;

  const totalMinutos =
    dias * horasPorDia * 60 +
    horas * 60 +
    minutos;

  const totalHoras =
    Math.floor(totalMinutos / 60);

  const restMinutos =
    totalMinutos % 60;

  const tieneTiempo =
    totalMinutos > 0;

  const previewParts: string[] = [];

  if (dias > 0) {
    previewParts.push(`${dias}d`);
  }

  if (horas > 0) {
    previewParts.push(`${horas}h`);
  }

  if (minutos > 0) {
    previewParts.push(`${minutos}m`);
  }

  const previewLabel = tieneTiempo
    ? `${previewParts.join(' ')} • jornada ${horasPorDia}h → ${totalHoras}h ${restMinutos
        .toString()
        .padStart(2, '0')}m total`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className="absolute inset-0"
        onClick={() => {
          if (saving) return;
          onClose();
        }}
      />

      <div
        className="relative w-full rounded-t-3xl border border-white/10 bg-slate-900/95 shadow-2xl sm:max-w-xl sm:rounded-2xl"
        style={{ maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 rounded-t-3xl border-b border-white/10 bg-slate-900/95 px-4 pb-4 pt-3 backdrop-blur-xl sm:rounded-t-2xl sm:px-6 sm:pt-5">
          <div className="mb-3 flex justify-center sm:hidden">
            <div className="h-1.5 w-14 rounded-full bg-white/10" />
          </div>

          <div className="flex items-start justify-between gap-3">
            <h2 className="pr-2 text-lg font-bold text-white sm:text-xl">
              {tituloModal}
            </h2>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-800/50 text-gray-400 transition-all hover:bg-slate-700/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Cerrar"
            >
              <svg
                className="h-5 w-5"
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

        <div className="max-h-[calc(92vh-76px)] overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>

              <span>{error}</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();

              if (!canManage || saving) {
                return;
              }

              onSubmit();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  Título *
                </label>

                <input
                  type="text"
                  name="titulo"
                  value={formData.titulo}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
                  placeholder="Nombre de la tarea"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  Prioridad
                </label>

                <select
                  name="prioridad"
                  value={formData.prioridad}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 [color-scheme:dark]"
                  disabled={saving}
                >
                  <option value="baja">
                    Baja
                  </option>

                  <option value="media">
                    Media
                  </option>

                  <option value="alta">
                    Alta
                  </option>

                  <option value="critica">
                    Crítica
                  </option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                Descripción
              </label>

              <textarea
                name="descripcion"
                value={formData.descripcion}
                onChange={handleInputChange}
                rows={3}
                className="w-full resize-none rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
                placeholder="Descripción (opcional)"
                disabled={saving}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                Tiempo estimado
              </label>

              <div className="mb-3">
                <label className="mb-1 block text-[11px] text-slate-400">
                  Equivalencia por día
                </label>

                <select
                  name="horas_por_dia"
                  value={formData.horas_por_dia}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 [color-scheme:dark]"
                  disabled={saving}
                >
                  <option value="8">
                    1 día = 8 horas
                  </option>

                  <option value="12">
                    1 día = 12 horas
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div>
                  <div className="relative">
                    <input
                      type="number"
                      name="tiempo_estimado_dias"
                      value={formData.tiempo_estimado_dias}
                      onChange={handleInputChange}
                      min="0"
                      className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2.5 pr-12 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
                      placeholder="0"
                      disabled={saving}
                    />

                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-500">
                      días
                    </span>
                  </div>
                </div>

                <div>
                  <div className="relative">
                    <input
                      type="number"
                      name="tiempo_estimado_horas"
                      value={formData.tiempo_estimado_horas}
                      onChange={handleInputChange}
                      min="0"
                      className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2.5 pr-10 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
                      placeholder="0"
                      disabled={saving}
                    />

                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-500">
                      h
                    </span>
                  </div>
                </div>

                <div>
                  <div className="relative">
                    <input
                      type="number"
                      name="tiempo_estimado_minutos"
                      value={formData.tiempo_estimado_minutos}
                      onChange={handleInputChange}
                      min="0"
                      max="59"
                      className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2.5 pr-10 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
                      placeholder="0"
                      disabled={saving}
                    />

                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-500">
                      m
                    </span>
                  </div>
                </div>
              </div>

              {previewLabel && (
                <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-purple-500/20 bg-purple-500/8 px-2.5 py-2">
                  <svg
                    className="mt-0.5 h-3 w-3 shrink-0 text-purple-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                      clipRule="evenodd"
                    />
                  </svg>

                  <span className="text-[11px] leading-relaxed text-purple-300">
                    {previewLabel}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                Max. participantes
              </label>

              <input
                type="number"
                name="max_participantes"
                value={formData.max_participantes}
                onChange={handleInputChange}
                min="1"
                max="50"
                className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
                disabled={saving}
              />
            </div>

            <div className="sticky bottom-0 -mx-4 border-t border-white/5 bg-slate-900/95 px-4 pb-1 pt-4 sm:-mx-6 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-white/10 bg-slate-800/50 px-4 py-2.5 font-semibold text-gray-300 transition-all hover:bg-slate-700/50"
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={!canManage || saving}
                  className="flex-1 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitLabel}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}