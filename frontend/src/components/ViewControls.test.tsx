/**
 * Unit tests for ViewControls component.
 *
 * Tests that the component renders two buttons ("回正" and "重置缩放"),
 * positions them as an overlay, and fires the correct callbacks on click.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import ViewControls from './ViewControls';

describe('ViewControls', () => {
  const setup = () => {
    const onResetOrientation = vi.fn();
    const onResetZoom = vi.fn();
    const result = render(
      <ViewControls
        onResetOrientation={onResetOrientation}
        onResetZoom={onResetZoom}
      />,
    );
    return { ...result, onResetOrientation, onResetZoom };
  };

  it('renders the container with data-testid', () => {
    const { getByTestId } = setup();
    expect(getByTestId('view-controls')).toBeDefined();
  });

  it('renders the "回正" (reset orientation) button', () => {
    const { getByTestId } = setup();
    const btn = getByTestId('reset-orientation-btn');
    expect(btn).toBeDefined();
    expect(btn.textContent).toBe('回正');
  });

  it('renders the "重置缩放" (reset zoom) button', () => {
    const { getByTestId } = setup();
    const btn = getByTestId('reset-zoom-btn');
    expect(btn).toBeDefined();
    expect(btn.textContent).toBe('重置缩放');
  });

  it('calls onResetOrientation when "回正" button is clicked', () => {
    const { getByTestId, onResetOrientation } = setup();
    fireEvent.click(getByTestId('reset-orientation-btn'));
    expect(onResetOrientation).toHaveBeenCalledTimes(1);
  });

  it('calls onResetZoom when "重置缩放" button is clicked', () => {
    const { getByTestId, onResetZoom } = setup();
    fireEvent.click(getByTestId('reset-zoom-btn'));
    expect(onResetZoom).toHaveBeenCalledTimes(1);
  });

  it('does not call the other callback when one button is clicked', () => {
    const { getByTestId, onResetOrientation, onResetZoom } = setup();

    fireEvent.click(getByTestId('reset-orientation-btn'));
    expect(onResetZoom).not.toHaveBeenCalled();

    fireEvent.click(getByTestId('reset-zoom-btn'));
    expect(onResetOrientation).toHaveBeenCalledTimes(1); // still just the one from before
  });

  it('positions the container with absolute positioning', () => {
    const { getByTestId } = setup();
    const container = getByTestId('view-controls');
    expect(container.style.position).toBe('absolute');
  });

  it('sets z-index on the container so buttons are always visible', () => {
    const { getByTestId } = setup();
    const container = getByTestId('view-controls');
    expect(Number(container.style.zIndex)).toBeGreaterThan(0);
  });

  it('buttons have accessible aria-labels', () => {
    const { getByTestId } = setup();
    expect(getByTestId('reset-orientation-btn').getAttribute('aria-label')).toBe('回正');
    expect(getByTestId('reset-zoom-btn').getAttribute('aria-label')).toBe('重置缩放');
  });

  it('buttons are of type "button" to prevent form submission', () => {
    const { getByTestId } = setup();
    expect(getByTestId('reset-orientation-btn').getAttribute('type')).toBe('button');
    expect(getByTestId('reset-zoom-btn').getAttribute('type')).toBe('button');
  });
});
