/**
 * @file useAuth.ts
 * @description Custom hook that manages authentication state for SkyBalance Airlines.
 *
 * SOLID principles applied:
 *  - (S) Single Responsibility: Only manages who is logged in and how.
 *        No flight data, no routing, no UI logic lives here.
 *  - (O) Open/Closed: Swap the hardcoded credential check for a real API call
 *        by changing only the `login` implementation — the hook's interface stays identical.
 *  - (D) Dependency Inversion: App.tsx depends on this hook's return interface,
 *        not on any concrete auth service.
 *
 * Session persistence:
 *  - Uses sessionStorage so auth is cleared on browser tab close (safe default).
 *  - Replace with localStorage if you need persistence across sessions.
 */

import { useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_KEY = "skybalance_auth";

/**
 * Demo credentials.
 * Replace this with a real call to your Python backend when ready.
 */
const DEMO_CREDENTIALS = {
  username: "admin",
  password: "admin123",
} as const;

// ─── Return Interface ─────────────────────────────────────────────────────────

/**
 * Shape of the object returned by useAuth.
 * App.tsx (and any other consumer) depend on this interface, not on internals.
 */
export interface UseAuthReturn {
  /** True when the user has successfully authenticated in this session. */
  isAuthenticated: boolean;
  /**
   * Attempts to authenticate with the provided credentials.
   * Rejects with an Error if credentials are invalid.
   */
  login: (username: string, password: string) => Promise<void>;
  /** Clears the session and marks the user as unauthenticated. */
  logout: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useAuth — Manages login / logout state with optional session persistence.
 *
 * @example
 * const { isAuthenticated, login, logout } = useAuth();
 */
export const useAuth = (): UseAuthReturn => {
  // Initialise from sessionStorage so a page refresh doesn't kick the user out.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => sessionStorage.getItem(SESSION_KEY) === "true",
  );

  /**
   * Simulates an async auth call (200 ms delay mirrors a real network round-trip).
   * Replace the body with: `await axios.post('/api/auth/login', { username, password })`
   */
  const login = async (username: string, password: string): Promise<void> => {
    await new Promise((res) => setTimeout(res, 200)); // simulate network

    const valid =
      username === DEMO_CREDENTIALS.username &&
      password === DEMO_CREDENTIALS.password;

    if (!valid) {
      throw new Error("Credenciales inválidas.");
    }

    sessionStorage.setItem(SESSION_KEY, "true");
    setIsAuthenticated(true);
  };

  /** Wipes the session and forces re-render back to LoginPage. */
  const logout = (): void => {
    sessionStorage.removeItem(SESSION_KEY);
    setIsAuthenticated(false);
  };

  return { isAuthenticated, login, logout };
};
