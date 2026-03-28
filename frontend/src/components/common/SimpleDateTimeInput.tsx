import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePreferences } from '../../hooks/usePreferences';

interface SimpleDateTimeInputProps {
  value: string; // Format ISO (YYYY-MM-DDTHH:mm)
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Composant simple de saisie de date/heure qui respecte les préférences de format
 * Permet la saisie libre sans reformatage automatique (pas de bug de curseur)
 * Valide et formate uniquement au blur
 */
export const SimpleDateTimeInput: React.FC<SimpleDateTimeInputProps> = ({
  value,
  onChange,
  className = '',
  required = false,
  disabled = false,
  placeholder,
}) => {
  const { preferences } = usePreferences();
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Convertir ISO vers format d'affichage
  const formatForDisplay = useCallback((isoDateTime: string): string => {
    if (!isoDateTime) return '';
    
    try {
      const date = new Date(isoDateTime);
      if (isNaN(date.getTime())) return '';
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      if (preferences.date_format === 'US') {
        return `${month}/${day}/${year} ${hours}:${minutes}`;
      } else {
        return `${day}/${month}/${year} ${hours}:${minutes}`;
      }
    } catch {
      return '';
    }
  }, [preferences.date_format]);

  // Convertir format d'affichage vers ISO
  const parseToISO = (displayDateTime: string): string | null => {
    if (!displayDateTime.trim()) return null;

    try {
      // Format: DD/MM/YYYY HH:mm ou MM/DD/YYYY HH:mm
      const parts = displayDateTime.trim().split(' ');
      if (parts.length !== 2) return null;

      const datePart = parts[0];
      const timePart = parts[1];

      // Parser la date
      const dateParts = datePart.split('/');
      if (dateParts.length !== 3) return null;

      let day: string, month: string, year: string;
      
      if (preferences.date_format === 'US') {
        month = dateParts[0].padStart(2, '0');
        day = dateParts[1].padStart(2, '0');
        year = dateParts[2];
      } else {
        day = dateParts[0].padStart(2, '0');
        month = dateParts[1].padStart(2, '0');
        year = dateParts[2];
      }

      // Parser l'heure
      const timeParts = timePart.split(':');
      if (timeParts.length !== 2) return null;
      
      const hours = timeParts[0].padStart(2, '0');
      const minutes = timeParts[1].padStart(2, '0');

      // Valider
      const yearNum = parseInt(year, 10);
      const monthNum = parseInt(month, 10);
      const dayNum = parseInt(day, 10);
      const hoursNum = parseInt(hours, 10);
      const minutesNum = parseInt(minutes, 10);

      if (isNaN(yearNum) || isNaN(monthNum) || isNaN(dayNum) || isNaN(hoursNum) || isNaN(minutesNum)) {
        return null;
      }
      if (monthNum < 1 || monthNum > 12) return null;
      if (dayNum < 1 || dayNum > 31) return null;
      if (hoursNum < 0 || hoursNum > 23) return null;
      if (minutesNum < 0 || minutesNum > 59) return null;

      // Créer une date pour valider
      const date = new Date(yearNum, monthNum - 1, dayNum, hoursNum, minutesNum);
      if (
        date.getFullYear() !== yearNum ||
        date.getMonth() !== monthNum - 1 ||
        date.getDate() !== dayNum ||
        date.getHours() !== hoursNum ||
        date.getMinutes() !== minutesNum
      ) {
        return null;
      }

      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
      return null;
    }
  };

  // Mettre à jour l'affichage quand la valeur change (sauf pendant la saisie)
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatForDisplay(value));
    }
  }, [value, isFocused, preferences.date_format, formatForDisplay]);

  const handleFocus = () => {
    setIsFocused(true);
    setDisplayValue(formatForDisplay(value));
  };

  const handleBlur = () => {
    setIsFocused(false);
    
    const isoValue = parseToISO(displayValue);
    
    if (isoValue) {
      onChange(isoValue);
      setDisplayValue(formatForDisplay(isoValue));
    } else if (displayValue.trim() === '') {
      onChange('');
      setDisplayValue('');
    } else {
      // Si invalide, réinitialiser à la valeur originale
      setDisplayValue(formatForDisplay(value));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Saisie libre sans reformatage automatique
    setDisplayValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  // Générer le placeholder selon le format
  const placeholderText = placeholder || (preferences.date_format === 'US' 
    ? 'MM/DD/YYYY HH:mm' 
    : 'DD/MM/YYYY HH:mm');

  return (
    <input
      ref={inputRef}
      type="text"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholderText}
      className={className}
      required={required}
      disabled={disabled}
    />
  );
};
