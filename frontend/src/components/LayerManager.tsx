/**
 * LayerManager — Responsive layer management panel.
 *
 * Desktop (>768px): renders as a sidebar panel on the right side.
 * Mobile (≤768px): renders as a collapsible bottom drawer with a drag handle.
 *
 * Displays:
 * - A list of all layers with toggle switches for enable/disable
 * - Layer groups with expandable/collapsible sections containing child layers
 *   and a slider control for transitioning between layers in the group
 *
 * Requirements: 5.1 (layer list in sidebar), 5.2 (enable layer),
 *               5.3 (disable layer), 9.2 (mobile bottom drawer),
 *               9.3 (desktop sidebar)
 */

import { useState, useCallback, useEffect, type CSSProperties } from 'react';
import type { LayerMeta, LayerGroupMeta } from '../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LayerManagerProps {
  layers: LayerMeta[];
  layerGroups: LayerGroupMeta[];
  onLayerToggle: (layerId: string, enabled: boolean) => void;
  onGroupSliderChange: (groupId: string, position: number) => void;
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
// Sub-components
// ---------------------------------------------------------------------------

interface LayerItemProps {
  layer: LayerMeta;
  onToggle: (layerId: string, enabled: boolean) => void;
}

function LayerItem({ layer, onToggle }: LayerItemProps) {
  return (
    <div style={layerItemStyle} data-testid={`layer-item-${layer.id}`}>
      <span style={layerNameStyle}>{layer.name}</span>
      <label style={toggleLabelStyle} data-testid={`layer-toggle-${layer.id}`}>
        <input
          type="checkbox"
          checked={layer.enabled}
          onChange={() => onToggle(layer.id, !layer.enabled)}
          aria-label={`Toggle ${layer.name}`}
          style={checkboxStyle}
        />
        <span
          style={{
            ...toggleTrackStyle,
            backgroundColor: layer.enabled
              ? 'rgba(100, 140, 255, 0.8)'
              : 'rgba(100, 100, 120, 0.4)',
          }}
        >
          <span
            style={{
              ...toggleThumbStyle,
              transform: layer.enabled ? 'translateX(16px)' : 'translateX(0)',
            }}
          />
        </span>
      </label>
    </div>
  );
}

interface LayerGroupSectionProps {
  group: LayerGroupMeta;
  onLayerToggle: (layerId: string, enabled: boolean) => void;
  onSliderChange: (groupId: string, position: number) => void;
}

function LayerGroupSection({
  group,
  onLayerToggle,
  onSliderChange,
}: LayerGroupSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const maxPosition = Math.max(0, group.layers.length - 1);

  return (
    <div style={groupSectionStyle} data-testid={`layer-group-${group.id}`}>
      <button
        type="button"
        style={groupHeaderStyle}
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${group.name}`}
        data-testid={`group-header-${group.id}`}
      >
        <span style={expandIconStyle}>{expanded ? '▼' : '▶'}</span>
        <span style={groupNameStyle}>{group.name}</span>
      </button>

      {expanded && (
        <div style={groupContentStyle} data-testid={`group-content-${group.id}`}>
          {group.layers.map((layer) => (
            <LayerItem key={layer.id} layer={layer} onToggle={onLayerToggle} />
          ))}

          {group.layers.length > 1 && (
            <div style={sliderContainerStyle} data-testid={`group-slider-${group.id}`}>
              <label style={sliderLabelStyle}>
                <span>Position</span>
                <input
                  type="range"
                  min={0}
                  max={maxPosition}
                  step="any"
                  value={group.currentPosition}
                  onChange={(e) =>
                    onSliderChange(group.id, parseFloat(e.target.value))
                  }
                  aria-label={`${group.name} slider`}
                  style={sliderInputStyle}
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function LayerManager({
  layers,
  layerGroups,
  onLayerToggle,
  onGroupSliderChange,
}: LayerManagerProps) {
  const isDesktop = useMediaQuery('(min-width: 769px)');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleDrawer = useCallback(() => {
    setDrawerOpen((prev) => !prev);
  }, []);

  // Layers that are NOT part of any group (standalone layers)
  const groupedLayerIds = new Set(
    layerGroups.flatMap((g) => g.layers.map((l) => l.id)),
  );
  const standaloneLayers = layers.filter((l) => !groupedLayerIds.has(l.id));

  const content = (
    <div style={contentWrapperStyle} data-testid="layer-manager-content">
      <h2 style={headingStyle}>Layers</h2>

      {/* Standalone layers */}
      {standaloneLayers.map((layer) => (
        <LayerItem key={layer.id} layer={layer} onToggle={onLayerToggle} />
      ))}

      {/* Layer groups */}
      {layerGroups.map((group) => (
        <LayerGroupSection
          key={group.id}
          group={group}
          onLayerToggle={onLayerToggle}
          onSliderChange={onGroupSliderChange}
        />
      ))}
    </div>
  );

  // Desktop: sidebar panel
  if (isDesktop) {
    return (
      <aside style={sidebarStyle} data-testid="layer-manager" role="complementary">
        {content}
      </aside>
    );
  }

  // Mobile: collapsible bottom drawer
  return (
    <div
      style={{
        ...drawerContainerStyle,
        transform: drawerOpen ? 'translateY(0)' : 'translateY(calc(100% - 48px))',
      }}
      data-testid="layer-manager"
      role="complementary"
    >
      <button
        type="button"
        style={drawerHandleStyle}
        onClick={toggleDrawer}
        aria-label={drawerOpen ? 'Collapse layer panel' : 'Expand layer panel'}
        data-testid="drawer-handle"
      >
        <span style={handleBarStyle} />
      </button>
      {content}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const sidebarStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  width: 300,
  height: '100%',
  backgroundColor: 'rgba(15, 20, 45, 0.9)',
  borderLeft: '1px solid rgba(100, 140, 255, 0.2)',
  overflowY: 'auto',
  zIndex: 20,
  color: '#e0e8ff',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
};

const drawerContainerStyle: CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  maxHeight: '70vh',
  backgroundColor: 'rgba(15, 20, 45, 0.95)',
  borderTop: '1px solid rgba(100, 140, 255, 0.2)',
  borderRadius: '16px 16px 0 0',
  zIndex: 30,
  color: '#e0e8ff',
  transition: 'transform 0.3s ease',
  overflowY: 'auto',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
};

const drawerHandleStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  width: '100%',
  height: 48,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
};

const handleBarStyle: CSSProperties = {
  display: 'block',
  width: 40,
  height: 4,
  borderRadius: 2,
  backgroundColor: 'rgba(200, 210, 255, 0.5)',
};

const contentWrapperStyle: CSSProperties = {
  padding: '0 16px 16px',
};

const headingStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  margin: '16px 0 12px',
  color: '#c8d2ff',
};

const layerItemStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 0',
  borderBottom: '1px solid rgba(100, 140, 255, 0.1)',
};

const layerNameStyle: CSSProperties = {
  fontSize: 14,
  color: '#e0e8ff',
};

const toggleLabelStyle: CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  cursor: 'pointer',
};

const checkboxStyle: CSSProperties = {
  position: 'absolute',
  opacity: 0,
  width: 0,
  height: 0,
};

const toggleTrackStyle: CSSProperties = {
  display: 'inline-block',
  width: 36,
  height: 20,
  borderRadius: 10,
  transition: 'background-color 0.2s',
  position: 'relative',
};

const toggleThumbStyle: CSSProperties = {
  display: 'block',
  width: 16,
  height: 16,
  borderRadius: '50%',
  backgroundColor: '#fff',
  position: 'absolute',
  top: 2,
  left: 2,
  transition: 'transform 0.2s',
};

const groupSectionStyle: CSSProperties = {
  marginTop: 8,
  borderBottom: '1px solid rgba(100, 140, 255, 0.1)',
};

const groupHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '10px 0',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#c8d2ff',
  fontSize: 14,
  fontWeight: 500,
};

const expandIconStyle: CSSProperties = {
  fontSize: 10,
  width: 16,
  textAlign: 'center',
};

const groupNameStyle: CSSProperties = {
  flex: 1,
  textAlign: 'left',
};

const groupContentStyle: CSSProperties = {
  paddingLeft: 16,
  paddingBottom: 8,
};

const sliderContainerStyle: CSSProperties = {
  marginTop: 8,
  padding: '4px 0',
};

const sliderLabelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  color: '#a0a8cc',
};

const sliderInputStyle: CSSProperties = {
  flex: 1,
  cursor: 'pointer',
};
