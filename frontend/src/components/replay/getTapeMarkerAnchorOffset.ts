import type { TapeMarker } from './marketTapeData';

/** Décalage vertical viewBox : entrées décalées sous/sur le prix ; sorties centrées sur le prix (+ empilement). */
export function getTapeMarkerAnchorOffset(
  marker: Pick<TapeMarker, 'kind' | 'side' | 'pnl' | 'offsetY'>,
): number {
  const stack = marker.offsetY ?? 0;
  if (marker.kind === 'entry') {
    const isLong = (marker.side || '').toLowerCase() === 'long';
    return (isLong ? 14 : -14) + stack;
  }
  if (marker.kind === 'exit') {
    return stack;
  }
  return stack;
}
