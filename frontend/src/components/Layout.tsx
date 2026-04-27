/**
 * Layout — Responsive layout wrapper for the globe viewer application.
 *
 * Desktop (>768px): Globe fills the main area, sidebar on the right.
 * Mobile (≤768px): Globe fills the screen, bottom drawer for layer controls.
 *
 * Automatically resizes the globe rendering area on window resize via
 * a ResizeObserver on the main container.
 *
 * Requirements: 9.1 (auto-resize globe), 9.2 (mobile bottom drawer),
 *               9.3 (desktop sidebar)
 */

import { useRef, useEffect, useState, type CSSProperties, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LayoutProps {
  /** The globe renderer element (fills the main area). */
  globe: ReactNode;
  /** The layer manager panel (sidebar on desktop, drawer on mobile). */
  layerPanel: ReactNode;
  /** Overlay controls positioned on top of the globe (e.g. ViewControls). */
  overlayControls?: ReactNode;
}

// ---------------------------------------------------------------------------
// useMediaQuery hook
// ---------------------------------------------------------------------------

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Layout({ globe, layerPanel, overlayControls }: LayoutProps) {
  const isDesktop = useMediaQuery('(min-width: 769px)');
  const mainRef = useRef<HTMLDivElement>(null);
  const [, setSize] = useState({ width: 0, height: 0 });

  // Track container size changes so the globe can auto-resize.
  // The state update triggers a re-render which propagates the new
  // dimensions to the globe renderer via its container's CSS.
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width, height });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (isDesktop) {
    return (
      <div style={desktopRootStyle} data-testid="layout-root">
        <div ref={mainRef} style={desktopMainStyle} data-testid="layout-main">
          {globe}
          {overlayControls && (
            <div style={overlayStyle} data-testid="layout-overlay">
              {overlayControls}
            </div>
          )}
        </div>
        <div style={desktopSidebarSlotStyle} data-testid="layout-sidebar">
          {layerPanel}
        </div>
      </div>
    );
  }

  // Mobile layout
  return (
    <div style={mobileRootStyle} data-testid="layout-root">
      <div ref={mainRef} style={mobileMainStyle} data-testid="layout-main">
        {globe}
        {overlayControls && (
          <div style={overlayStyle} data-testid="layout-overlay">
            {overlayControls}
          </div>
        )}
      </div>
      {/* Layer panel renders as a fixed bottom drawer (handled by LayerManager itself) */}
      {layerPanel}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const desktopRootStyle: CSSProperties = {
  display: 'flex',
  width: '100vw',
  height: '100vh',
  overflow: 'hidden',
  background: '#000',
};

const desktopMainStyle: CSSProperties = {
  flex: 1,
  position: 'relative',
  overflow: 'hidden',
};

const desktopSidebarSlotStyle: CSSProperties = {
  position: 'relative',
  width: 300,
  flexShrink: 0,
};

const mobileRootStyle: CSSProperties = {
  width: '100vw',
  height: '100vh',
  overflow: 'hidden',
  position: 'relative',
  background: '#000',
};

const mobileMainStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  position: 'relative',
};

const overlayStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  pointerEvents: 'none',
  zIndex: 5,
};
