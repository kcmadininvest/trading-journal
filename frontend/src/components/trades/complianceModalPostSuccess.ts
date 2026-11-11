/**
 * Après save/delete réussis dans StrategyComplianceModal, faut-il recharger
 * le contenu de la modale avant de fermer ?
 *
 * Non : le parent rafraîchit via `onClose(true)`. Un `loadData()` ici provoque
 * un flash spinner (scintillement) juste avant la fermeture.
 */
export function shouldReloadComplianceDataBeforeClose(): boolean {
  return false;
}
