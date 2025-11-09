import { useMemo } from 'react';

interface TooltipConfig {
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  disabled?: boolean;
}

export const useTooltip = (config: TooltipConfig) => {
  return useMemo(() => ({
    'data-tooltip': config.content,
    'data-tooltip-position': config.position || 'top',
    'data-tooltip-delay': config.delay || 300,
    'data-tooltip-disabled': config.disabled || false,
  }), [config.content, config.position, config.delay, config.disabled]);
};

// Hook pour les tooltips d'actions courantes
export const useActionTooltips = () => {
  return {
    edit: useTooltip({ content: 'Modifier', position: 'top' }),
    delete: useTooltip({ content: 'Supprimer', position: 'top' }),
    activate: useTooltip({ content: 'Activer', position: 'top' }),
    deactivate: useTooltip({ content: 'Désactiver', position: 'top' }),
    view: useTooltip({ content: 'Voir les détails', position: 'top' }),
    copy: useTooltip({ content: 'Copier', position: 'top' }),
    download: useTooltip({ content: 'Télécharger', position: 'top' }),
    upload: useTooltip({ content: 'Téléverser', position: 'top' }),
    refresh: useTooltip({ content: 'Actualiser', position: 'top' }),
    settings: useTooltip({ content: 'Paramètres', position: 'top' }),
  };
};
