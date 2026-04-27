/**
 * Unit tests for GlobeRenderer component.
 *
 * Note: react-three-fiber Canvas requires a WebGL context which is not
 * available in jsdom. We test that the component renders its wrapper div
 * and accepts the expected props without throwing.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock react-three-fiber since jsdom has no WebGL context
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, ...props }: Record<string, unknown>) => (
    <div data-testid="r3f-canvas" {...filterDomProps(props)}>
      {children as React.ReactNode}
    </div>
  ),
  useFrame: () => {},
  useThree: () => ({
    camera: { position: { x: 0, y: 0, z: 2.8 } },
  }),
}));

// Helper to strip non-DOM-safe props from the mock Canvas
function filterDomProps(props: Record<string, unknown>) {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      safe[k] = v;
    }
    if (k === 'style') safe[k] = v;
  }
  return safe;
}

import { render } from '@testing-library/react';
import GlobeRenderer from './GlobeRenderer';
import type { EnabledLayer, InterpolatedObject, Viewport } from '../types';

describe('GlobeRenderer', () => {
  const defaultProps = {
    layers: [] as EnabledLayer[],
    interpolatedObjects: [] as InterpolatedObject[],
    onViewportChange: (_v: Viewport) => {},
  };

  it('renders the wrapper div with data-testid', () => {
    const { getByTestId } = render(<GlobeRenderer {...defaultProps} />);
    expect(getByTestId('globe-renderer')).toBeDefined();
  });

  it('renders the mocked Canvas element', () => {
    const { getByTestId } = render(<GlobeRenderer {...defaultProps} />);
    expect(getByTestId('r3f-canvas')).toBeDefined();
  });

  it('accepts layers and interpolatedObjects props without error', () => {
    const layers: EnabledLayer[] = [
      {
        layerId: 'test-layer',
        meta: {
          id: 'test-layer',
          name: 'Test',
          description: 'A test layer',
          enabled: true,
          lodLevels: [0, 1, 2],
        },
      },
    ];

    const objects: InterpolatedObject[] = [
      {
        objectId: 'obj-1',
        latitude: 48.85,
        longitude: 2.35,
        properties: { name: 'Paris' },
        opacity: 1,
      },
    ];

    const onViewportChange = vi.fn();

    const { getByTestId } = render(
      <GlobeRenderer
        layers={layers}
        interpolatedObjects={objects}
        onViewportChange={onViewportChange}
      />,
    );

    expect(getByTestId('globe-renderer')).toBeDefined();
  });
});
