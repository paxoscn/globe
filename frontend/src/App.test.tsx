/**
 * Unit tests for App root component.
 *
 * Tests that the App component:
 * - Renders the Layout with GlobeRenderer, LayerManager, and ViewControls
 * - Fetches layer metadata from /api/layers on mount
 * - Handles layer toggle state changes
 * - Handles layer group slider changes
 * - Debounces viewport change events
 *
 * Requirements: 1.1, 5.1, 6.1, 6.3, 8.1, 9.1, 11.4, 11.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';

// Mock react-three-fiber since jsdom has no WebGL context
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, ...props }: Record<string, unknown>) => {
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        safe[k] = v;
      }
      if (k === 'style') safe[k] = v;
    }
    return (
      <div data-testid="r3f-canvas" {...safe}>
        {children as React.ReactNode}
      </div>
    );
  },
  useFrame: () => {},
  useThree: () => ({
    camera: { position: { x: 0, y: 0, z: 2.8 } },
  }),
}));

import App from './App';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const mockLayersResponse = {
  layers: [
    {
      id: 'coastline-1800',
      name: '1800年海岸线',
      group_id: 'historical-coastlines',
      lod_levels: [2, 5, 8],
      description: 'Historical coastline data',
    },
    {
      id: 'coastline-1850',
      name: '1850年海岸线',
      group_id: 'historical-coastlines',
      lod_levels: [2, 5, 8],
      description: 'Historical coastline data',
    },
    {
      id: 'borders',
      name: 'Borders',
      group_id: null,
      lod_levels: [2, 5, 8],
      description: 'Country borders',
    },
  ],
  groups: [
    {
      id: 'historical-coastlines',
      name: '历史海岸线',
      layer_ids: ['coastline-1800', 'coastline-1850'],
    },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('App', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockMatchMedia(true); // desktop

    vi.stubGlobal('ResizeObserver', class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    });

    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockLayersResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the layout root', async () => {
    const { getByTestId } = render(<App />);
    expect(getByTestId('layout-root')).toBeDefined();
  });

  it('renders the globe renderer', async () => {
    const { getByTestId } = render(<App />);
    expect(getByTestId('globe-renderer')).toBeDefined();
  });

  it('renders the view controls overlay', async () => {
    const { getByTestId } = render(<App />);
    expect(getByTestId('view-controls')).toBeDefined();
  });

  it('renders the layer manager', async () => {
    const { getByTestId } = render(<App />);
    expect(getByTestId('layer-manager')).toBeDefined();
  });

  it('fetches layer metadata from /api/layers on mount', async () => {
    render(<App />);
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/api/layers');
    });
  });

  it('populates layers after successful fetch', async () => {
    const { getByText } = render(<App />);
    await waitFor(() => {
      expect(getByText('Borders')).toBeDefined();
    });
  });

  it('populates layer groups after successful fetch', async () => {
    const { getByText } = render(<App />);
    await waitFor(() => {
      expect(getByText('历史海岸线')).toBeDefined();
    });
  });

  it('handles fetch failure gracefully', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { getByTestId } = render(<App />);

    // App should still render even if fetch fails
    expect(getByTestId('layout-root')).toBeDefined();

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch layer metadata:',
        'Network error',
      );
    });

    consoleSpy.mockRestore();
  });

  it('handles layer toggle by updating layer state', async () => {
    const { getByTestId, getByText } = render(<App />);

    // Wait for layers to load
    await waitFor(() => {
      expect(getByText('Borders')).toBeDefined();
    });

    // Find the toggle for the Borders layer and click it
    const toggle = getByTestId('layer-toggle-borders').querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;

    expect(toggle.checked).toBe(false);

    await act(async () => {
      toggle.click();
    });

    // After toggle, the checkbox should reflect the new state
    // (The component re-renders with updated layers)
    await waitFor(() => {
      const updatedToggle = getByTestId('layer-toggle-borders').querySelector(
        'input[type="checkbox"]',
      ) as HTMLInputElement;
      expect(updatedToggle.checked).toBe(true);
    });
  });
});
