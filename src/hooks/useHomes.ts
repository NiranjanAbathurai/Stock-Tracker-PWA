import { useHomesContext } from '../contexts/HomesContext';

/**
 * Thin wrapper around HomesContext.
 * All 6 consumers share a single provider instance — one fetch, one state tree.
 * Must be used within a <HomesProvider>.
 */
export function useHomes() {
  return useHomesContext();
}
