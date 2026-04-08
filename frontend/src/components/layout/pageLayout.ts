/**
 * Tokens de mise en page pour les écrans sous Layout (header + footer).
 * Le padding vertical remplace l’ancien couple Layout pt-6 + racine py-* (même espacement visuel).
 */
export const PAGE_PADDING_X = 'px-3 sm:px-4 md:px-6 lg:px-8';

/** Équivalent à l’ancien pt-6 (Layout) + py-4 / sm:py-6 / md:py-8 sur la page, avec pb-6 en bas. */
export const PAGE_PADDING_Y = 'pt-10 sm:pt-12 md:pt-14 pb-6';

export const PAGE_SHELL_INNER = `${PAGE_PADDING_X} ${PAGE_PADDING_Y}`;

/** Zone de contenu Réglages : mêmes marges horizontales / haut ; bas allongé pour les onglets mobile. */
export const PAGE_SETTINGS_CONTENT_PADDING = `${PAGE_PADDING_X} pt-10 sm:pt-12 md:pt-14 pb-28 lg:pb-8`;
