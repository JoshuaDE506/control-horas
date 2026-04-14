//horaslaborales/lib/countries.ts
// Lista completa de países con códigos telefónicos y banderas
export interface pais {
  code: string;
  pais: string;
  flag: string;
  name: string;
}

export const countries: pais[] = [
  // América del Norte
  { code: '+1', pais: 'US', flag: '🇺🇸', name: 'Estados Unidos' },
  { code: '+1', pais: 'CA', flag: '🇨🇦', name: 'Canadá' },
  { code: '+52', pais: 'MX', flag: '🇲🇽', name: 'México' },

  // América Central
  { code: '+501', pais: 'BZ', flag: '🇧🇿', name: 'Belice' },
  { code: '+506', pais: 'CR', flag: '🇨🇷', name: 'Costa Rica' },
  { code: '+503', pais: 'SV', flag: '🇸🇻', name: 'El Salvador' },
  { code: '+502', pais: 'GT', flag: '🇬🇹', name: 'Guatemala' },
  { code: '+504', pais: 'HN', flag: '🇭🇳', name: 'Honduras' },
  { code: '+505', pais: 'NI', flag: '🇳🇮', name: 'Nicaragua' },
  { code: '+507', pais: 'PA', flag: '🇵🇦', name: 'Panamá' },

  // América del Sur
  { code: '+54', pais: 'AR', flag: '🇦🇷', name: 'Argentina' },
  { code: '+591', pais: 'BO', flag: '🇧🇴', name: 'Bolivia' },
  { code: '+55', pais: 'BR', flag: '🇧🇷', name: 'Brasil' },
  { code: '+56', pais: 'CL', flag: '🇨🇱', name: 'Chile' },
  { code: '+57', pais: 'CO', flag: '🇨🇴', name: 'Colombia' },
  { code: '+593', pais: 'EC', flag: '🇪🇨', name: 'Ecuador' },
  { code: '+592', pais: 'GY', flag: '🇬🇾', name: 'Guyana' },
  { code: '+595', pais: 'PY', flag: '🇵🇾', name: 'Paraguay' },
  { code: '+51', pais: 'PE', flag: '🇵🇪', name: 'Perú' },
  { code: '+597', pais: 'SR', flag: '🇸🇷', name: 'Surinam' },
  { code: '+598', pais: 'UY', flag: '🇺🇾', name: 'Uruguay' },
  { code: '+58', pais: 'VE', flag: '🇻🇪', name: 'Venezuela' },

  // Caribe
  { code: '+1', pais: 'PR', flag: '🇵🇷', name: 'Puerto Rico' },
  { code: '+1', pais: 'DO', flag: '🇩🇴', name: 'República Dominicana' },
  { code: '+53', pais: 'CU', flag: '🇨🇺', name: 'Cuba' },

  // Europa (principales)
  { code: '+34', pais: 'ES', flag: '🇪🇸', name: 'España' },
  { code: '+44', pais: 'GB', flag: '🇬🇧', name: 'Reino Unido' },
  { code: '+33', pais: 'FR', flag: '🇫🇷', name: 'Francia' },
  { code: '+49', pais: 'DE', flag: '🇩🇪', name: 'Alemania' },
  { code: '+39', pais: 'IT', flag: '🇮🇹', name: 'Italia' },
  { code: '+351', pais: 'PT', flag: '🇵🇹', name: 'Portugal' },
];

// Buscar país por ISO (recomendado)
export const findpaisByISO = (iso: string): pais | undefined => {
  return countries.find(c => c.pais === iso);
};

// Buscar país por ISO + código (validación fuerte)
export const isValidpais = (iso: string, code: string): boolean => {
  return countries.some(c => c.pais === iso && c.code === code);
};

// Función helper para obtener el país por defecto (Costa Rica)
export const getDefaultpais = (): pais => {
  return countries.find(c => c.pais === 'CR') || countries[0];
};