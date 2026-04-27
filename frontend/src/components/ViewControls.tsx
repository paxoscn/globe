/**
 * ViewControls — Overlay buttons for resetting globe orientation and zoom.
 *
 * Renders two always-visible buttons on top of the globe:
 * - "回正" (reset orientation): triggers smooth animated quaternion slerp back to default
 * - "重置缩放" (reset zoom): triggers smooth animated zoom interpolation back to default
 *
 * Requirements: 4.1 (visible reset orientation button), 4.2 (smooth orientation reset),
 *               4.3 (visible reset zoom button), 4.4 (smooth zoom reset)
 */

import type { CSSProperties } from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ViewControlsProps {
  /** Callback to reset the globe orientation to default (identity quaternion). */
  onResetOrientation: () => void;
  /** Callback to reset the zoom level to default. */
  onResetZoom: () => void;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: CSSProperties = {
  position: 'absolute',
  top: 16,
  right: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  zIndex: 10,
  pointerEvents: 'auto',
};

const buttonStyle: CSSProperties = {
  padding: '8px 16px',
  fontSize: 14,
  fontWeight: 500,
  color: '#e0e8ff',
  backgroundColor: 'rgba(15, 20, 45, 0.75)',
  border: '1px solid rgba(100, 140, 255, 0.3)',
  borderRadius: 6,
  cursor: 'pointer',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  transition: 'background-color 0.2s, border-color 0.2s',
  userSelect: 'none',
  lineHeight: 1.4,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ViewControls({
  onResetOrientation,
  onResetZoom,
}: ViewControlsProps) {
  return (
    <div style={containerStyle} data-testid="view-controls">
      <button
        type="button"
        style={buttonStyle}
        onClick={onResetOrientation}
        aria-label="回正"
        data-testid="reset-orientation-btn"
      >
        回正
      </button>
      <button
        type="button"
        style={buttonStyle}
        onClick={onResetZoom}
        aria-label="重置缩放"
        data-testid="reset-zoom-btn"
      >
        重置缩放
      </button>
    </div>
  );
}
