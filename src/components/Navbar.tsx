/**
 * @file Navbar.tsx
 * @description Top navigation bar for the SkyBalance Airlines dashboard.
 *
 * SOLID principles applied:
 *  - (S) Single Responsibility: Only renders navigation UI.
 *        Search submission and menu toggling are delegated outward via callbacks.
 *  - (O) Open/Closed: New actions (e.g., notifications) can be added by extending
 *        `NavbarProps` without touching existing logic.
 *  - (I) Interface Segregation: `NavbarProps` contains only what this component needs;
 *        no unrelated data is passed in.
 *  - (D) Dependency Inversion: Navigation and search logic live in the parent;
 *        Navbar never imports a router or service directly.
 */

import React, { useState } from "react";
import { Menu, Search, X } from "lucide-react";

// ─── Props Interface ──────────────────────────────────────────────────────────

/**
 * Props for the Navbar component.
 */
export interface NavbarProps {
  /** Triggered when the user submits a search query. */
  onSearch: (query: string) => void;
  /** Triggered when the hamburger menu button is clicked. */
  onMenuToggle: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Navbar — Sticky top bar matching the SkyBalance mockup.
 *
 * Contains:
 *  - Hamburger menu button (left)
 *  - SkyBalance logo + wordmark (left, next to hamburger)
 *  - Search bar with clear button (right)
 *
 * The search fires `onSearch` on Enter key or when the input changes
 * (controlled search, no separate submit button needed).
 *
 * @example
 * <Navbar
 *   onSearch={(q) => filterFlights(q)}
 *   onMenuToggle={() => setDrawerOpen(o => !o)}
 * />
 */
const Navbar: React.FC<NavbarProps> = ({ onSearch, onMenuToggle }) => {
  const [query, setQuery] = useState("");

  // ── Handlers ──

  /** Updates local state and notifies parent on every keystroke (live search). */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    onSearch(e.target.value);
  };

  /** Clears the search field and notifies the parent. */
  const handleClear = () => {
    setQuery("");
    onSearch("");
  };

  // ── Render ────

  return (
    <nav
      className="
        w-full bg-black
        px-4 py-3
        flex items-center justify-between gap-4
        sticky top-0 z-50
        shadow-lg
      "
      aria-label="Barra de navegación principal"
    >
      {/* ── Left: hamburger + logo ── */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Hamburger — accessibility: use a <button> with an aria-label */}
        <button
          onClick={onMenuToggle}
          aria-label="Abrir menú"
          className="
            text-white hover:text-gray-300
            transition-colors duration-150
            focus-visible:outline focus-visible:outline-2 focus-visible:outline-white
            rounded
          "
        >
          <Menu size={26} />
        </button>
        <h1 className="text-white text-lg font-bold">SkyBalance Airlines</h1>
      </div>

      {/* ── Right: search bar ── */}
      <div
        className="
          flex items-center gap-2
          bg-white rounded-full
          px-4 py-1.5
          w-full max-w-md
        "
        role="search"
      >
        <Search
          size={16}
          className="text-gray-400 flex-shrink-0"
          aria-hidden="true"
        />

        <input
          type="search"
          value={query}
          onChange={handleChange}
          placeholder="Buscar vuelo..."
          aria-label="Buscar vuelo"
          className="
            flex-1 bg-transparent
            text-sm text-gray-800 placeholder-gray-400
            outline-none border-0
          "
        />

        {/* Clear button — only visible when there is text */}
        {query.length > 0 && (
          <button
            onClick={handleClear}
            aria-label="Limpiar búsqueda"
            className="text-gray-400 hover:text-gray-700 transition-colors duration-150"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
