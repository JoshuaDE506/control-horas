//horaslaborales/lib/countries.ts
// Lista completa de países con códigos telefónicos y banderas
export interface Country {
  code: string;
  country: string;
  flag: string;
  name: string;
}

export const countries: Country[] = [
  // América del Norte
  { code: '+1', country: 'US', flag: '🇺🇸', name: 'Estados Unidos' },
  { code: '+1', country: 'CA', flag: '🇨🇦', name: 'Canadá' },
  { code: '+52', country: 'MX', flag: '🇲🇽', name: 'México' },

  // América Central
  { code: '+501', country: 'BZ', flag: '🇧🇿', name: 'Belice' },
  { code: '+506', country: 'CR', flag: '🇨🇷', name: 'Costa Rica' },
  { code: '+503', country: 'SV', flag: '🇸🇻', name: 'El Salvador' },
  { code: '+502', country: 'GT', flag: '🇬🇹', name: 'Guatemala' },
  { code: '+504', country: 'HN', flag: '🇭🇳', name: 'Honduras' },
  { code: '+505', country: 'NI', flag: '🇳🇮', name: 'Nicaragua' },
  { code: '+507', country: 'PA', flag: '🇵🇦', name: 'Panamá' },

  // América del Sur
  { code: '+54', country: 'AR', flag: '🇦🇷', name: 'Argentina' },
  { code: '+591', country: 'BO', flag: '🇧🇴', name: 'Bolivia' },
  { code: '+55', country: 'BR', flag: '🇧🇷', name: 'Brasil' },
  { code: '+56', country: 'CL', flag: '🇨🇱', name: 'Chile' },
  { code: '+57', country: 'CO', flag: '🇨🇴', name: 'Colombia' },
  { code: '+593', country: 'EC', flag: '🇪🇨', name: 'Ecuador' },
  { code: '+592', country: 'GY', flag: '🇬🇾', name: 'Guyana' },
  { code: '+595', country: 'PY', flag: '🇵🇾', name: 'Paraguay' },
  { code: '+51', country: 'PE', flag: '🇵🇪', name: 'Perú' },
  { code: '+597', country: 'SR', flag: '🇸🇷', name: 'Surinam' },
  { code: '+598', country: 'UY', flag: '🇺🇾', name: 'Uruguay' },
  { code: '+58', country: 'VE', flag: '🇻🇪', name: 'Venezuela' },

  // Caribe
  { code: '+1', country: 'PR', flag: '🇵🇷', name: 'Puerto Rico' },
  { code: '+1', country: 'DO', flag: '🇩🇴', name: 'República Dominicana' },
  { code: '+53', country: 'CU', flag: '🇨🇺', name: 'Cuba' },

  // Europa (principales)
  { code: '+34', country: 'ES', flag: '🇪🇸', name: 'España' },
  { code: '+44', country: 'GB', flag: '🇬🇧', name: 'Reino Unido' },
  { code: '+33', country: 'FR', flag: '🇫🇷', name: 'Francia' },
  { code: '+49', country: 'DE', flag: '🇩🇪', name: 'Alemania' },
  { code: '+39', country: 'IT', flag: '🇮🇹', name: 'Italia' },
  { code: '+351', country: 'PT', flag: '🇵🇹', name: 'Portugal' },
];

// Buscar país por ISO (recomendado)
export const findCountryByISO = (iso: string): Country | undefined => {
  return countries.find(c => c.country === iso);
};

// Buscar país por ISO + código (validación fuerte)
export const isValidCountry = (iso: string, code: string): boolean => {
  return countries.some(c => c.country === iso && c.code === code);
};

// Función helper para obtener el país por defecto (Costa Rica)
export const getDefaultCountry = (): Country => {
  return countries.find(c => c.country === 'CR') || countries[0];
};