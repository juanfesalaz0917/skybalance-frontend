/**
 * @file useTreeData.ts
 * @description Hook that fetches the full AVL tree structure from the backend.
 *
 * SOLID principles applied:
 *  - (S) Single Responsibility: Only manages tree-structure state.
 *        Flight-list state (useFlights) is a separate concern.
 *  - (D) Dependency Inversion: Depends on TreeService interface, not Axios directly.
 *
 * This hook is consumed by App.tsx as the single source of tree refresh.
 * It calls GET /api/tree/current which returns the full recursive TreeNode structure
 * plus summary properties (height, node count, rotations).
 */

import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import type { TreeNode, TreeProperties } from "../models/FlightNode";
import { TreeService } from "../services/TreeService";

// ─── Return Interface ─────────────────────────────────────────────────────────

export interface UseTreeDataReturn {
  /** Root node of the AVL tree, or null when the tree is empty. */
  treeRoot: TreeNode | null;
  /** Summary statistics returned by get_avl_summary() in Python. */
  properties: TreeProperties | null;
  isLoading: boolean;
  error: string | null;
  /** Re-fetches the tree. Call after any mutation to keep the view in sync. */
  refresh: () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useTreeData — Fetches and stores the recursive AVL tree structure.
 *
 * @example
 * const { treeRoot, properties, isLoading } = useTreeData();
 */
export const useTreeData = (): UseTreeDataReturn => {
  const [treeRoot, setTreeRoot] = useState<TreeNode | null>(null);
  const [properties, setProperties] = useState<TreeProperties | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTree = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await TreeService.getCurrentTree();
      setTreeRoot(response.tree);
      setProperties(response.properties);
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.error ?? "No se pudo conectar con el servidor.")
        : "Error al cargar el árbol.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  return { treeRoot, properties, isLoading, error, refresh: fetchTree };
};
