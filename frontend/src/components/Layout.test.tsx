/**
 * Unit tests for Layout component.
 *
 * Tests responsive layout behavior:
 * - Desktop: globe fills main area, sidebar on the right
 * - Mobile: globe fills screen, bottom drawer for layer controls
 * - Overlay controls positioned on top of the globe
 * - Auto-resize via ResizeObserver
 *
 * Requirements: 9.1, 9.2, 9.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import Layout from './Layout';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set window.matchMedia to simulate desktop or mobile. */
function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Mock ResizeObserver
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

class MockResizeObserver {
  constructor(_callback: ResizeObserverCallback) {}
  observe = mockObserve;
  unobserve = vi.fn();
  disconnect = mockDisconnect;
}

beforeEach(() => {
  mockObserve.mockClear();
  mockDisconnect.mockClear();
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Layout', () => {
  const defaultProps = {
    globe: <div data-testid="mock-globe">Globe</div>,
    layerPanel: <div data-testid="mock-layer-panel">Layers</div>,
    overlayControls: <div data-testid="mock-overlay">Controls</div>,
  };

  describe('Desktop layout', () => {
    beforeEach(() => {
      mockMatchMedia(true); // desktop
    });

    it('renders the root container', () => {
      const { getByTestId } = render(<Layout {...defaultProps} />);
      expect(getByTestId('layout-root')).toBeDefined();
    });

    it('renders the globe in the main area', () => {
      const { getByTestId } = render(<Layout {...defaultProps} />);
      const main = getByTestId('layout-main');
      expect(main).toBeDefined();
      expect(getByTestId('mock-globe')).toBeDefined();
    });

    it('renders the sidebar slot', () => {
      const { getByTestId } = render(<Layout {...defaultProps} />);
      expect(getByTestId('layout-sidebar')).toBeDefined();
    });

    it('renders the layer panel inside the sidebar', () => {
      const { getByTestId } = render(<Layout {...defaultProps} />);
      const sidebar = getByTestId('layout-sidebar');
      expect(sidebar.querySelector('[data-testid="mock-layer-panel"]')).toBeDefined();
    });

    it('renders overlay controls on top of the globe', () => {
      const { getByTestId } = render(<Layout {...defaultProps} />);
      expect(getByTestId('layout-overlay')).toBeDefined();
      expect(getByTestId('mock-overlay')).toBeDefined();
    });

    it('uses flex layout for desktop', () => {
      const { getByTestId } = render(<Layout {...defaultProps} />);
      const root = getByTestId('layout-root');
      expect(root.style.display).toBe('flex');
    });

    it('sets sidebar width to 300px', () => {
      const { getByTestId } = render(<Layout {...defaultProps} />);
      const sidebar = getByTestId('layout-sidebar');
      expect(sidebar.style.width).toBe('300px');
    });
  });

  describe('Mobile layout', () => {
    beforeEach(() => {
      mockMatchMedia(false); // mobile
    });

    it('renders the root container', () => {
      const { getByTestId } = render(<Layout {...defaultProps} />);
      expect(getByTestId('layout-root')).toBeDefined();
    });

    it('renders the globe filling the screen', () => {
      const { getByTestId } = render(<Layout {...defaultProps} />);
      const main = getByTestId('layout-main');
      expect(main.style.width).toBe('100%');
      expect(main.style.height).toBe('100%');
    });

    it('does not render a sidebar slot on mobile', () => {
      const { queryByTestId } = render(<Layout {...defaultProps} />);
      expect(queryByTestId('layout-sidebar')).toBeNull();
    });

    it('renders the layer panel (as bottom drawer)', () => {
      const { getByTestId } = render(<Layout {...defaultProps} />);
      expect(getByTestId('mock-layer-panel')).toBeDefined();
    });

    it('renders overlay controls on mobile', () => {
      const { getByTestId } = render(<Layout {...defaultProps} />);
      expect(getByTestId('layout-overlay')).toBeDefined();
    });
  });

  describe('Optional overlay controls', () => {
    beforeEach(() => {
      mockMatchMedia(true);
    });

    it('does not render overlay when overlayControls is undefined', () => {
      const { queryByTestId } = render(
        <Layout globe={defaultProps.globe} layerPanel={defaultProps.layerPanel} />,
      );
      expect(queryByTestId('layout-overlay')).toBeNull();
    });
  });

  describe('ResizeObserver', () => {
    beforeEach(() => {
      mockMatchMedia(true);
    });

    it('attaches a ResizeObserver to the main container', () => {
      render(<Layout {...defaultProps} />);
      expect(mockObserve).toHaveBeenCalled();
    });

    it('disconnects ResizeObserver on unmount', () => {
      const { unmount } = render(<Layout {...defaultProps} />);
      unmount();
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });
});
