//horaslaborales/components/pais/paisComboBox.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { pais, countries } from '@/lib/countries';

interface paisComboBoxProps {
  value: string; // ISO del país seleccionado (ej: "CR"), puede ser '' si no ha elegido
  onChange: (paisIso: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function paisComboBox({
  value,
  onChange,
  disabled = false,
  className = '',
}: paisComboBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Puede no haber país seleccionado aún
  const selectedpais: pais | undefined = countries.find(
    c => c.pais === value
  );

  // Filtrar países según búsqueda
  const filteredCountries = countries.filter(pais =>
    pais.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pais.code.includes(searchTerm)
  );

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (pais: pais) => {
    // Devolvemos el ISO (ej: "CR", "US", "ES")
    onChange(pais.pais);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="h-full px-3 py-3 bg-white/5 border-2 border-white/20 rounded-xl text-white hover:bg-white/10 transition-all duration-300 focus:outline-none focus:border-purple-400 flex items-center gap-2 min-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {selectedpais ? (
          <>
            <span className="text-2xl">{selectedpais.flag}</span>
            <span className="text-sm font-medium">
              {selectedpais.name} ({selectedpais.code})
            </span>
          </>
        ) : (
          <span className="text-sm text-purple-300">
            Seleccionar país
          </span>
        )}
        <svg
          className={`w-4 h-4 transition-transform ml-auto ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-72 bg-slate-800/95 backdrop-blur-xl border-2 border-purple-500/50 rounded-xl shadow-2xl overflow-hidden animate-slide-down">
          {/* Search Input */}
          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-4 w-4 text-purple-400"
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
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar país..."
                className="w-full pl-10 pr-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white text-sm placeholder-purple-300/50 focus:outline-none focus:border-purple-400 transition-colors"
                autoFocus
              />
            </div>
          </div>

          {/* Countries List */}
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            {filteredCountries.length > 0 ? (
              filteredCountries.map(pais => (
                <button
                  key={`${pais.pais}-${pais.code}`}
                  type="button"
                  onClick={() => handleSelect(pais)}
                  className={`w-full px-4 py-3 text-left hover:bg-purple-500/20 transition-colors flex items-center gap-3 ${
                    pais.pais === value ? 'bg-purple-500/30' : ''
                  }`}
                >
                  <span className="text-2xl">{pais.flag}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">
                      {pais.name}
                    </div>
                    <div className="text-xs text-purple-300">
                      {pais.code}
                    </div>
                  </div>
                  {pais.pais === value && (
                    <svg
                      className="w-5 h-5 text-purple-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-purple-300/70 text-sm">
                No se encontraron países
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slide-down {
          animation: slide-down 0.2s ease-out;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(168, 85, 247, 0.5);
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(168, 85, 247, 0.7);
        }
      `}</style>
    </div>
  );
}

