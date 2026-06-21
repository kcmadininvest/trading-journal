/**
 * Distingue premier chargement (skeleton) vs refresh (données précédentes visibles).
 */
export function useQueryLoadingState(
  isLoading: boolean,
  isFetching: boolean,
  data: unknown,
) {
  const hasData = data != null;
  return {
    isInitialLoading: isLoading && !hasData,
    isRefreshing: isFetching && hasData,
  };
}

export function combineQueryLoadingStates(
  states: Array<{ isLoading: boolean; isFetching: boolean; data: unknown }>,
) {
  const isInitialLoading = states.some((s) => s.isLoading && s.data == null);
  const isRefreshing = states.some((s) => s.isFetching && s.data != null);
  return { isInitialLoading, isRefreshing };
}
