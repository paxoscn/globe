/**
 * Unit tests for LayerManager component.
 *
 * Tests layer list rendering, toggle switches, layer group expand/collapse,
 * slider controls, and responsive layout (desktop sidebar vs mobile drawer).
 *
 * Requirements: 5.1, 5.2, 5.3, 9.2, 9.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import LayerManager from './LayerManager';
import type { LayerMeta, LayerGroupMeta } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createLayer(overrides: Partial<LayerMeta> = {}): LayerMeta {
  return {
    id: 'layer-1',
    name: 'Coastline 1800',
    description: 'Historical coastline',
    enabled: false,
    lodLevels: [0, 1, 2],
    ...overrides,
  };
}

function createLayerGroup(overrides: Partial<LayerGroupMeta> = {}): LayerGroupMeta {
  return {
    id: 'group-1',
    name: 'Historical Coastlines',
    layers: [
      createLayer({ id: 'g-layer-1', name: 'Coastline 1800' }),
      createLayer({ id: 'g-layer-2', name: 'Coastline 1850', enabled: true }),
      createLayer({ id: 'g-layer-3', name: 'Coastline 1900' }),
    ],
    currentPosition: 0,
    ...overrides,
  };
}

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LayerManager', () => {
  const defaultProps = () => ({
    layers: [
      createLayer({ id: 'standalone-1', name: 'Borders' }),
      createLayer({ id: 'standalone-2', name: 'Rivers', enabled: true }),
    ],
    layerGroups: [createLayerGroup()],
    onLayerToggle: vi.fn(),
    onGroupSliderChange: vi.fn(),
    currentYear: 2026,
    onCurrentYearChange: vi.fn(),
  });

  describe('Desktop layout (sidebar)', () => {
    beforeEach(() => {
      mockMatchMedia(true); // desktop
    });

    it('renders as a sidebar with role complementary', () => {
      const { getByTestId } = render(<LayerManager {...defaultProps()} />);
      const el = getByTestId('layer-manager');
      expect(el.getAttribute('role')).toBe('complementary');
      expect(el.tagName.toLowerCase()).toBe('aside');
    });

    it('does not render a drawer handle on desktop', () => {
      const { queryByTestId } = render(<LayerManager {...defaultProps()} />);
      expect(queryByTestId('drawer-handle')).toBeNull();
    });

    it('renders the "Layers" heading', () => {
      const { getByText } = render(<LayerManager {...defaultProps()} />);
      expect(getByText('Layers')).toBeDefined();
    });
  });

  describe('Mobile layout (bottom drawer)', () => {
    beforeEach(() => {
      mockMatchMedia(false); // mobile
    });

    it('renders as a div (not aside) with a drawer handle', () => {
      const { getByTestId } = render(<LayerManager {...defaultProps()} />);
      const el = getByTestId('layer-manager');
      expect(el.tagName.toLowerCase()).toBe('div');
      expect(getByTestId('drawer-handle')).toBeDefined();
    });

    it('drawer starts collapsed (translated down)', () => {
      const { getByTestId } = render(<LayerManager {...defaultProps()} />);
      const el = getByTestId('layer-manager');
      expect(el.style.transform).toContain('translateY');
      expect(el.style.transform).not.toBe('translateY(0)');
    });

    it('expands drawer when handle is clicked', () => {
      const { getByTestId } = render(<LayerManager {...defaultProps()} />);
      fireEvent.click(getByTestId('drawer-handle'));
      const el = getByTestId('layer-manager');
      expect(el.style.transform).toBe('translateY(0)');
    });

    it('collapses drawer when handle is clicked again', () => {
      const { getByTestId } = render(<LayerManager {...defaultProps()} />);
      fireEvent.click(getByTestId('drawer-handle'));
      fireEvent.click(getByTestId('drawer-handle'));
      const el = getByTestId('layer-manager');
      expect(el.style.transform).not.toBe('translateY(0)');
    });
  });

  describe('Layer list rendering', () => {
    beforeEach(() => {
      mockMatchMedia(true);
    });

    it('renders standalone layers (not in any group)', () => {
      const { getByTestId } = render(<LayerManager {...defaultProps()} />);
      expect(getByTestId('layer-item-standalone-1')).toBeDefined();
      expect(getByTestId('layer-item-standalone-2')).toBeDefined();
    });

    it('displays layer names', () => {
      const { getByText } = render(<LayerManager {...defaultProps()} />);
      expect(getByText('Borders')).toBeDefined();
      expect(getByText('Rivers')).toBeDefined();
    });

    it('renders toggle switches reflecting enabled state', () => {
      const { getByTestId } = render(<LayerManager {...defaultProps()} />);
      const toggle1 = getByTestId('layer-toggle-standalone-1').querySelector(
        'input[type="checkbox"]',
      ) as HTMLInputElement;
      const toggle2 = getByTestId('layer-toggle-standalone-2').querySelector(
        'input[type="checkbox"]',
      ) as HTMLInputElement;
      expect(toggle1.checked).toBe(false);
      expect(toggle2.checked).toBe(true);
    });
  });

  describe('Layer toggle interaction', () => {
    beforeEach(() => {
      mockMatchMedia(true);
    });

    it('calls onLayerToggle with (id, true) when enabling a disabled layer', () => {
      const props = defaultProps();
      const { getByTestId } = render(<LayerManager {...props} />);
      const checkbox = getByTestId('layer-toggle-standalone-1').querySelector(
        'input[type="checkbox"]',
      ) as HTMLInputElement;
      fireEvent.click(checkbox);
      expect(props.onLayerToggle).toHaveBeenCalledWith('standalone-1', true);
    });

    it('calls onLayerToggle with (id, false) when disabling an enabled layer', () => {
      const props = defaultProps();
      const { getByTestId } = render(<LayerManager {...props} />);
      const checkbox = getByTestId('layer-toggle-standalone-2').querySelector(
        'input[type="checkbox"]',
      ) as HTMLInputElement;
      fireEvent.click(checkbox);
      expect(props.onLayerToggle).toHaveBeenCalledWith('standalone-2', false);
    });
  });

  describe('Layer groups', () => {
    beforeEach(() => {
      mockMatchMedia(true);
    });

    it('renders layer group headers', () => {
      const { getByTestId } = render(<LayerManager {...defaultProps()} />);
      expect(getByTestId('group-header-group-1')).toBeDefined();
    });

    it('displays group name', () => {
      const { getByText } = render(<LayerManager {...defaultProps()} />);
      expect(getByText('Historical Coastlines')).toBeDefined();
    });

    it('group content is hidden by default (collapsed)', () => {
      const { queryByTestId } = render(<LayerManager {...defaultProps()} />);
      expect(queryByTestId('group-content-group-1')).toBeNull();
    });

    it('expands group to show child layers when header is clicked', () => {
      const { getByTestId } = render(<LayerManager {...defaultProps()} />);
      fireEvent.click(getByTestId('group-header-group-1'));
      expect(getByTestId('group-content-group-1')).toBeDefined();
      expect(getByTestId('layer-item-g-layer-1')).toBeDefined();
      expect(getByTestId('layer-item-g-layer-2')).toBeDefined();
      expect(getByTestId('layer-item-g-layer-3')).toBeDefined();
    });

    it('collapses group when header is clicked again', () => {
      const { getByTestId, queryByTestId } = render(
        <LayerManager {...defaultProps()} />,
      );
      fireEvent.click(getByTestId('group-header-group-1'));
      fireEvent.click(getByTestId('group-header-group-1'));
      expect(queryByTestId('group-content-group-1')).toBeNull();
    });

    it('shows aria-expanded attribute on group header', () => {
      const { getByTestId } = render(<LayerManager {...defaultProps()} />);
      const header = getByTestId('group-header-group-1');
      expect(header.getAttribute('aria-expanded')).toBe('false');
      fireEvent.click(header);
      expect(header.getAttribute('aria-expanded')).toBe('true');
    });

    it('renders slider when group is expanded and has >1 layer', () => {
      const { getByTestId } = render(<LayerManager {...defaultProps()} />);
      fireEvent.click(getByTestId('group-header-group-1'));
      expect(getByTestId('group-slider-group-1')).toBeDefined();
    });

    it('does not render slider for a group with only 1 layer', () => {
      const props = {
        ...defaultProps(),
        layerGroups: [
          createLayerGroup({
            id: 'single-group',
            layers: [createLayer({ id: 'only-layer' })],
          }),
        ],
      };
      const { getByTestId, queryByTestId } = render(<LayerManager {...props} />);
      fireEvent.click(getByTestId('group-header-single-group'));
      expect(queryByTestId('group-slider-single-group')).toBeNull();
    });

    it('calls onGroupSliderChange when slider value changes', () => {
      const props = defaultProps();
      const { getByTestId } = render(<LayerManager {...props} />);
      fireEvent.click(getByTestId('group-header-group-1'));
      const slider = getByTestId('group-slider-group-1').querySelector(
        'input[type="range"]',
      ) as HTMLInputElement;
      fireEvent.change(slider, { target: { value: '1.5' } });
      expect(props.onGroupSliderChange).toHaveBeenCalledWith('group-1', 1.5);
    });

    it('can toggle layers inside a group', () => {
      const props = defaultProps();
      const { getByTestId } = render(<LayerManager {...props} />);
      fireEvent.click(getByTestId('group-header-group-1'));
      const checkbox = getByTestId('layer-toggle-g-layer-1').querySelector(
        'input[type="checkbox"]',
      ) as HTMLInputElement;
      fireEvent.click(checkbox);
      expect(props.onLayerToggle).toHaveBeenCalledWith('g-layer-1', true);
    });
  });

  describe('Standalone vs grouped layers', () => {
    beforeEach(() => {
      mockMatchMedia(true);
    });

    it('does not render grouped layers as standalone items', () => {
      const { getByTestId } = render(
        <LayerManager {...defaultProps()} />,
      );
      // g-layer-1 is inside group-1, should not appear at top level
      // It should only appear after expanding the group
      const content = getByTestId('layer-manager-content');
      const topLevelItems = content.querySelectorAll(
        ':scope > [data-testid^="layer-item-"]',
      );
      const topLevelIds = Array.from(topLevelItems).map((el) =>
        el.getAttribute('data-testid'),
      );
      expect(topLevelIds).toContain('layer-item-standalone-1');
      expect(topLevelIds).toContain('layer-item-standalone-2');
      expect(topLevelIds).not.toContain('layer-item-g-layer-1');
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      mockMatchMedia(true);
    });

    it('toggle checkboxes have aria-labels', () => {
      const { getByTestId } = render(<LayerManager {...defaultProps()} />);
      const checkbox = getByTestId('layer-toggle-standalone-1').querySelector(
        'input[type="checkbox"]',
      ) as HTMLInputElement;
      expect(checkbox.getAttribute('aria-label')).toBe('Toggle Borders');
    });

    it('group headers have aria-label', () => {
      const { getByTestId } = render(<LayerManager {...defaultProps()} />);
      const header = getByTestId('group-header-group-1');
      expect(header.getAttribute('aria-label')).toContain('Historical Coastlines');
    });
  });
});
