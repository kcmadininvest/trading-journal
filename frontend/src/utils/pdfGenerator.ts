import { jsPDF } from 'jspdf';
import { PositionStrategy } from '../services/positionStrategies';
import { formatDate } from './dateFormat';
import { UserPreferences } from '../services/userService';

/**
 * Fonction helper pour encoder correctement le texte (gère les caractères spéciaux)
 * Remplace les caractères spéciaux non supportés par jsPDF par leurs équivalents ASCII
 */
const encodeText = (text: string): string => {
  if (!text) return '';
  
  let encoded = String(text);
  
  // Remplacer les flèches et autres caractères spéciaux
  encoded = encoded.replace(/→/g, '->');  // Flèche droite
  encoded = encoded.replace(/←/g, '<-');  // Flèche gauche
  encoded = encoded.replace(/↑/g, '^');   // Flèche haut
  encoded = encoded.replace(/↓/g, 'v');   // Flèche bas
  encoded = encoded.replace(/⇒/g, '=>');  // Double flèche droite
  encoded = encoded.replace(/⇐/g, '<=');  // Double flèche gauche
  encoded = encoded.replace(/•/g, '-');   // Puce
  encoded = encoded.replace(/–/g, '-');  // Tiret cadratin
  encoded = encoded.replace(/—/g, '-');  // Tiret cadratin long
  encoded = encoded.replace(/"/g, '"');   // Guillemet double gauche
  encoded = encoded.replace(/"/g, '"');   // Guillemet double droit
  encoded = encoded.replace(/'/g, "'");   // Guillemet simple gauche
  encoded = encoded.replace(/'/g, "'");   // Guillemet simple droit
  encoded = encoded.replace(/…/g, '...'); // Points de suspension
  encoded = encoded.replace(/€/g, 'EUR'); // Euro
  encoded = encoded.replace(/£/g, 'GBP'); // Livre
  encoded = encoded.replace(/©/g, '(c)'); // Copyright
  encoded = encoded.replace(/®/g, '(R)'); // Marque déposée
  encoded = encoded.replace(/™/g, '(TM)'); // Marque
  encoded = encoded.replace(/\u00A0/g, ' '); // Espace insécable
  
  return encoded;
};

/**
 * Génère un PDF de haute qualité avec du texte vectoriel pour une stratégie
 */
export const generateStrategyPdf = (
  strategy: PositionStrategy,
  preferences: Pick<UserPreferences, 'date_format' | 'timezone'>,
  t: (key: string, options?: { defaultValue?: string }) => string
): jsPDF => {
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
  
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - (margin * 2);
  let yPosition = margin;
  let pageNumber = 1;
  
  // Fonction helper pour ajouter du texte de manière sûre
  const safeText = (text: string, x: number, y: number, options?: any): void => {
    const encodedText = encodeText(text);
    pdf.text(encodedText, x, y, options);
  };
  
  // Fonction helper pour vérifier si on a besoin d'une nouvelle page
  const checkPageBreak = (requiredHeight: number): boolean => {
    if (yPosition + requiredHeight > pageHeight - margin - 10) {
      pdf.addPage();
      yPosition = margin;
      pageNumber++;
      
      // Ajouter le numéro de page en pied de page
      pdf.setFontSize(9);
      pdf.setTextColor(128, 128, 128);
      pdf.setFont('helvetica', 'normal');
      safeText(`Page ${pageNumber}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      
      return true;
    }
    return false;
  };
  
  // Fonction helper pour ajouter du texte avec retour à la ligne automatique
  const addText = (text: string, fontSize: number, fontStyle: 'normal' | 'bold' | 'italic', color: [number, number, number] = [0, 0, 0]): void => {
    pdf.setFontSize(fontSize);
    pdf.setFont('helvetica', fontStyle);
    pdf.setTextColor(color[0], color[1], color[2]);
    
    const encodedText = encodeText(text);
    const lines = pdf.splitTextToSize(encodedText, maxWidth);
    const lineHeight = fontSize * 0.35;
    
    for (const line of lines) {
      checkPageBreak(lineHeight + 2);
      safeText(line, margin, yPosition);
      yPosition += lineHeight;
    }
  };
  
  // 1. Titre de la stratégie
  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(31, 41, 55); // #1f2937
  const encodedTitle = encodeText(strategy.title);
  const titleLines = pdf.splitTextToSize(encodedTitle, maxWidth);
  for (const line of titleLines) {
    safeText(line, margin, yPosition);
    yPosition += 8;
  }
  yPosition += 2;
  
  // 2. Métadonnées (version, date de création et date de mise à jour)
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(107, 114, 128); // #6b7280
  const formattedCreatedDate = formatDate(strategy.created_at, preferences.date_format, false, preferences.timezone);
  const formattedUpdatedDate = formatDate(strategy.updated_at, preferences.date_format, false, preferences.timezone);
  
  // Construire le texte avec les deux dates sur la même ligne
  let versionText = `${t('positionStrategies:version', { defaultValue: 'Version' })} ${strategy.version} • ${t('positionStrategies:createdAt', { defaultValue: 'Créé le' })} ${formattedCreatedDate}`;
  if (strategy.updated_at && strategy.updated_at !== strategy.created_at) {
    versionText += ` • ${t('positionStrategies:updatedAt', { defaultValue: 'Mis à jour le' })} ${formattedUpdatedDate}`;
  }
  
  safeText(versionText, margin, yPosition);
  yPosition += 10;
  
  // 3. Description
  if (strategy.description && strategy.description.trim()) {
    checkPageBreak(15);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(55, 65, 81); // #374151
    safeText(t('positionStrategies:description', { defaultValue: 'Description' }), margin, yPosition);
    yPosition += 7;
    
    addText(strategy.description, 11, 'normal', [75, 85, 99]); // #4b5563
    yPosition += 8;
  }
  
  // 4. Sections et règles
  if (strategy.strategy_content?.sections && strategy.strategy_content.sections.length > 0) {
    checkPageBreak(15);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(55, 65, 81); // #374151
    safeText(t('positionStrategies:sections', { defaultValue: 'Sections de la stratégie' }), margin, yPosition);
    yPosition += 10;
    
    strategy.strategy_content.sections.forEach((section, sectionIndex) => {
      checkPageBreak(12);
      
      // Titre de section
      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(31, 41, 55); // #1f2937
      const sectionTitle = section.title || t('positionStrategies:sectionWithoutTitle', { defaultValue: 'Section sans titre' });
      safeText(sectionTitle, margin, yPosition);
      yPosition += 7;
      
      // Règles
      if (section.rules && section.rules.length > 0) {
        section.rules.forEach((rule, ruleIndex) => {
          checkPageBreak(8);
          
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(55, 65, 81); // #374151
          
          // Dessiner une case à cocher (carré vide)
          const checkboxSize = 3; // Taille de la case en mm
          const checkboxY = yPosition - 2.5; // Ajuster la position verticale
          pdf.setDrawColor(55, 65, 81); // Couleur de la bordure
          pdf.setLineWidth(0.5);
          pdf.rect(margin + 1, checkboxY, checkboxSize, checkboxSize, 'S');
          
          // Ajouter le texte de la règle avec retour à la ligne
          const encodedRule = encodeText(rule);
          const ruleLines = pdf.splitTextToSize(encodedRule, maxWidth - 12);
          ruleLines.forEach((line: string, lineIndex: number) => {
            if (lineIndex > 0) checkPageBreak(4);
            safeText(line, margin + 8, yPosition);
            yPosition += 4.5;
          });
          
          yPosition += 1;
        });
      } else {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(156, 163, 175); // #9ca3af
        safeText(t('positionStrategies:noRules', { defaultValue: 'Aucune règle définie' }), margin + 8, yPosition);
        yPosition += 6;
      }
      
      yPosition += 3;
    });
  } else {
    checkPageBreak(10);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(156, 163, 175); // #9ca3af
    safeText(t('positionStrategies:noSections', { defaultValue: 'Aucune section définie' }), margin, yPosition);
    yPosition += 10;
  }
  
  // 5. Notes de version
  if (strategy.version_notes && strategy.version_notes.trim()) {
    checkPageBreak(20);
    yPosition += 5;
    
    // Encadré pour les notes
    pdf.setDrawColor(59, 130, 246); // #3b82f6 (bleu)
    pdf.setLineWidth(1);
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(59, 130, 246);
    safeText(t('positionStrategies:versionNotes', { defaultValue: 'Notes de version' }), margin + 2, yPosition);
    yPosition += 7;
    
    const notesStartY = yPosition - 10;
    addText(strategy.version_notes, 10, 'italic', [75, 85, 99]);
    
    const notesHeight = yPosition - notesStartY + 2;
    pdf.setFillColor(243, 244, 246); // #f3f4f6 (gris clair)
    pdf.rect(margin, notesStartY, maxWidth, notesHeight, 'S');
    pdf.line(margin, notesStartY, margin, notesStartY + notesHeight);
    pdf.setLineWidth(3);
    pdf.setDrawColor(59, 130, 246);
    pdf.line(margin, notesStartY, margin, notesStartY + notesHeight);
  }
  
  // Ajouter le numéro de page sur la première page
  pdf.setPage(1);
  pdf.setFontSize(9);
  pdf.setTextColor(128, 128, 128);
  pdf.setFont('helvetica', 'normal');
  safeText('Page 1', pageWidth / 2, pageHeight - 10, { align: 'center' });
  
  return pdf;
};

/**
 * Télécharge une stratégie en PDF
 */
export const downloadStrategyPdf = (
  strategy: PositionStrategy,
  preferences: Pick<UserPreferences, 'date_format' | 'timezone'>,
  t: (key: string, options?: { defaultValue?: string }) => string
): void => {
  try {
    // Générer le PDF avec du texte vectoriel
    const pdf = generateStrategyPdf(strategy, preferences, t);
    
    // Générer le nom de fichier
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
    const filename = `strategie_${strategy.title.replace(/[^a-z0-9]/gi, '_')}_v${strategy.version}_${dateStr}_${timeStr}.pdf`;
    
    // Télécharger le PDF
    pdf.save(filename);
  } catch (err: any) {
    console.error('Error generating PDF:', err);
    throw new Error(err.message || 'Erreur lors de la génération du PDF');
  }
};

/**
 * Ouvre une stratégie dans une nouvelle fenêtre pour impression
 */
export const printStrategy = (
  strategy: PositionStrategy,
  preferences: Pick<UserPreferences, 'date_format' | 'timezone'>,
  t: (key: string, options?: { defaultValue?: string }) => string
): void => {
  try {
    // Générer le PDF
    const pdf = generateStrategyPdf(strategy, preferences, t);
    
    // Ouvrir le PDF dans une nouvelle fenêtre pour impression
    const pdfBlob = pdf.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const printWindow = window.open(pdfUrl, '_blank');
    
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  } catch (err: any) {
    console.error('Error printing strategy:', err);
    throw new Error(err.message || 'Erreur lors de l\'impression');
  }
};

