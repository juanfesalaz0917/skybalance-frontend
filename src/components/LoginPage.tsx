/**
 * @file LoginPage.tsx
 * @description Login screen for SkyBalance Airlines.
 *
 * SOLID principles applied:
 *  - (S) Single Responsibility: This component only handles the login UI and its local form state.
 *  - (O) Open/Closed: Extended via `onLogin` prop without modifying the component itself.
 *  - (I) Interface Segregation: `LoginPageProps` is minimal — only what this component needs.
 *  - (D) Dependency Inversion: Authentication logic is injected via the `onLogin` callback,
 *        so this component never knows about Axios or any service implementation.
 */

import React, { useState } from 'react';
import { User, Lock, ArrowRight, Loader2 } from 'lucide-react';

/**
 * Static logo asset — Vite resolves this import at build time.
 * To swap the logo: change only this import path.
 */
import skybalanceLogo from '../assets/skybalance.png';
// ─── Props Interface ──────────────────────────────────────────────────────────

/**
 * Props for the LoginPage component.
 * Authentication logic is external (DIP — Dependency Inversion Principle).
 */
interface LoginPageProps {
  /** Called when the user submits the form. Should return a promise that resolves on success. */
  onLogin: (username: string, password: string) => Promise<void>;
}

// ─── Sub-component: InputField ────────────────────────────────────────────────

/**
 * Single-responsibility sub-component for a labelled input with an icon.
 * Kept private to this file since it is only meaningful within LoginPage.
 */
interface InputFieldProps {
  id: string;
  type: string;
  value: string;
  placeholder: string;
  icon: React.ReactNode;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const InputField: React.FC<InputFieldProps> = ({
  id,
  type,
  value,
  placeholder,
  icon,
  onChange,
  disabled = false,
}) => (
  <div className="flex items-center gap-3">
    {/* Icon wrapper — always white on dark card */}
    <span className="text-white/80 flex-shrink-0">{icon}</span>

    <input
      id={id}
      type={type}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="
        w-full rounded-full px-4 py-2
        bg-white text-gray-900 placeholder-gray-400
        text-sm font-medium
        border-0 outline-none
        focus:ring-2 focus:ring-white/60
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-all duration-200
      "
    />
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * LoginPage — Full-screen login view for SkyBalance Airlines.
 *
 * Layout matches the provided mockup:
 *  - Grayscale airplane photo as background (or CSS fallback).
 *  - Centered dark card with logo, username + password fields, and submit arrow.
 *  - Loading state disables inputs and shows a spinner inside the button.
 *  - Error message appears below the card when login fails.
 *
 * @example
 * <LoginPage onLogin={async (u, p) => await AuthService.login(u, p)} />
 */
const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  // ── Local state (form data + async feedback) ──
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Handlers ──────────────────────────────────

  /**
   * Submits the form. Delegates the actual auth call to `onLogin` (DIP).
   * Manages local loading/error state around that async operation.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Por favor completa todos los campos.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await onLogin(username, password);
    } catch {
      setError('Credenciales inválidas. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden"
    >
      {/* Re-invert the filter on the content so only the bg is desaturated */}
      <div
        className="w-full flex flex-col items-center justify-center flex-1 relative"
        style={{ filter: 'grayscale(1) brightness(0.97)' }}
      >

      {/* ── Logo above the card ── */}
      <div className="relative z-10 flex flex-col items-center mb-6 select-none">
        {/*
         * mix-blend-mode: multiply — the key trick to remove the white background.
         * How it works: white (255,255,255) × any background colour = that colour,
         * so white pixels become invisible and only the dark logo mark stays visible.
         * This only works on light backgrounds — which the hero.png provides.
         *
         * To resize: change the width/height values below.
         */}
        <img
          src={skybalanceLogo}
          alt="SkyBalance Airlines"
          style={{
            width: '200px',
            height: '140px',
            objectFit: 'contain',
            mixBlendMode: 'multiply',
          }}
        />
      </div>

      {/* ── Login card ── */}
      <div
        className="
          relative z-10 w-full max-w-xs
          bg-black rounded-3xl
          px-8 py-8
          shadow-2xl
        "
      >
        <h1 className="text-white text-center text-2xl font-bold tracking-wide mb-7">
          Inicia sesión
        </h1>

        {/* Use a real <form> for accessibility + Enter-key submission */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <InputField
            id="username"
            type="text"
            value={username}
            placeholder="Usuario"
            icon={<User size={22} />}
            onChange={setUsername}
            disabled={isLoading}
          />

          <InputField
            id="password"
            type="password"
            value={password}
            placeholder="Contraseña"
            icon={<Lock size={22} />}
            onChange={setPassword}
            disabled={isLoading}
          />

          {/* Submit button — arrow icon that switches to a spinner while loading */}
          <button
            type="submit"
            disabled={isLoading}
            aria-label="Iniciar sesión"
            className="
              mt-2 w-full rounded-full py-2.5
              bg-white hover:bg-gray-100
              flex items-center justify-center
              transition-colors duration-200
              disabled:opacity-60 disabled:cursor-not-allowed
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-white
            "
          >
            {isLoading ? (
              <Loader2 size={22} className="text-gray-800 animate-spin" />
            ) : (
              <ArrowRight size={22} className="text-gray-800" />
            )}
          </button>
        </form>

        {/* Inline error message (accessibility: role="alert" for screen readers) */}
        {error && (
          <p role="alert" className="mt-4 text-red-400 text-xs text-center leading-snug">
            {error}
          </p>
        )}
      </div>

      </div>{/* end inner content wrapper */}
    </div>
  );
};

export default LoginPage;