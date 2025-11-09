import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePreferences } from '../../hooks/usePreferences';
import { formatNumber } from '../../utils/numberFormat';

interface NumberInputProps {
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  min?: number;
  max?: number;
  step?: string | number;
  digits?: number;
  required?: boolean;
}

/**
 * Composant d'input numérique personnalisé qui formate selon les préférences utilisateur
 * La valeur interne est toujours en format numérique standard (point comme séparateur décimal)
 * L'affichage est formaté selon preferences.number_format (point ou comma)
 */
export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  placeholder,
  className = '',
  min,
  max,
  step = '0.01',
  digits = 2,
  required = false,
}) => {
  const { preferences } = usePreferences();
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Convertir valeur numérique vers format d'affichage
  const formatForDisplay = useCallback((numValue: string | number): string => {
    if (numValue === '' || numValue === null || numValue === undefined) return '';
    const num = typeof numValue === 'string' ? parseFloat(numValue) : numValue;
    if (isNaN(num)) return '';
    return formatNumber(num, digits, preferences.number_format);
  }, [preferences.number_format, digits]);

  // Convertir format d'affichage vers valeur numérique standard
  const parseToStandard = useCallback((displayVal: string): string => {
    if (!displayVal) return '';
    
    // Remplacer le séparateur de milliers et le séparateur décimal selon le format
    let cleaned = displayVal.trim();
    
    if (preferences.number_format === 'comma') {
      // Format français: 1 234,56 -> 1234.56
      // Supprimer les espaces (séparateurs de milliers)
      cleaned = cleaned.replace(/\s/g, '');
      // Remplacer la virgule par un point
      cleaned = cleaned.replace(/,/g, '.');
    } else {
      // Format US: 1,234.56 -> 1234.56
      // Supprimer les virgules (séparateurs de milliers)
      cleaned = cleaned.replace(/,/g, '');
      // Le point est déjà le séparateur décimal
    }
    
    // Vérifier que c'est un nombre valide
    const num = parseFloat(cleaned);
    if (isNaN(num)) return '';
    
    // Valider les limites min/max
    if (min !== undefined && num < min) return String(min);
    if (max !== undefined && num > max) return String(max);
    
    return String(num);
  }, [preferences.number_format, min, max]);

  // Initialiser la valeur d'affichage
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatForDisplay(value));
    }
  }, [value, isFocused, formatForDisplay]);

  // Initialiser au montage
  useEffect(() => {
    if (value !== '' && value !== null && value !== undefined) {
      setDisplayValue(formatForDisplay(value));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFocus = () => {
    setIsFocused(true);
    // Afficher la valeur numérique standard pendant la saisie
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (!isNaN(numValue)) {
      setDisplayValue(String(numValue));
    } else {
      setDisplayValue('');
    }
    // Sélectionner tout le texte pour faciliter la saisie
    setTimeout(() => {
      inputRef.current?.select();
    }, 0);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    const standardValue = parseToStandard(e.target.value);
    if (standardValue) {
      setDisplayValue(formatForDisplay(standardValue));
      onChange(standardValue);
    } else {
      setDisplayValue('');
      if (!required) {
        onChange('');
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={className}
      required={required}
      min={min}
      max={max}
      step={step}
    />
  );
};

