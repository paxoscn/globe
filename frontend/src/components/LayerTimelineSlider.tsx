/**
 * LayerTimelineSlider — Unified timeline slider for any layer with a
 * time dimension. Renders inline below the layer toggle in the LayerManager.
 *
 * Supports two format types:
 * - 'geological': Continental drift (0–300 Ma) with era segments
 * - 'historical': Napoleon trajectory (1796–1815) with campaign segments
 *
 * Features:
 * - Play/pause auto-advance
 * - Color-coded progress segments
 * - Contextual info display (era/campaign/date)
 */

import { useState, useCallback, useEffect, useRef, type CSSProperties } from 'react';
import type { TimelineConfig } from '../types';
import {
  GEO_ERAS,
  getEraForTime,
  DRIFT_MAX_MA,
  DRIFT_MIN_MA,
  NAPOLEON_TRAJECTORY,
  TRAJECTORY_START,
  TRAJECTORY_END,
  CAMPAIGN_COLORS,
  interpolatePosition,
} from '../data/mockLayers';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LayerTimelineSliderProps {
  /** The timeline configuration from the layer's metadata. */
  config: TimelineConfig;
  /** Current timeline value. */
  value: number;
  /** Called when the user changes the timeline value. */
  onChange: (value: number) => void;
}

// ---------------------------------------------------------------------------
// Playback speeds
// ---------------------------------------------------------------------------

/** Geological: Ma per animation frame at ~60fps */
const GEO_SPEED = 0.8;
/** Historical: ms of Napoleon-time per animation frame */
const HIST_SPEED = 86400000 * 15; // 15 days per frame

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(timestamp: number): string {
  const dt = new Date(timestamp);
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LayerTimelineSlider({
  config,
  value,
  onChange,
}: LayerTimelineSliderProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const animFrameRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  const isGeo = config.formatType === 'geological';

  // Normalized slider position 0..1 (left to right)
  const sliderValue = isGeo
    ? 1 - (value - DRIFT_MIN_MA) / (DRIFT_MAX_MA - DRIFT_MIN_MA)
    : (value - TRAJECTORY_START) / (TRAJECTORY_END - TRAJECTORY_START);

  // --- Playback loop ---
  useEffect(() => {
    if (!isPlaying) return;

    lastFrameTimeRef.current = performance.now();

    const tick = (now: number) => {
      const delta = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      if (isGeo) {
        const advance = (delta / 16.67) * GEO_SPEED;
        const next = value - advance; // Ma decreases toward present
        if (next <= DRIFT_MIN_MA) {
          onChange(DRIFT_MIN_MA);
          setIsPlaying(false);
          return;
        }
        onChange(next);
      } else {
        const advance = (delta / 16.67) * HIST_SPEED;
        const next = value + advance;
        if (next >= TRAJECTORY_END) {
          onChange(TRAJECTORY_END);
          setIsPlaying(false);
          return;
        }
        onChange(next);
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, value, onChange, isGeo]);

  // --- Slider change ---
  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value); // 0..1
      if (isGeo) {
        const ma = DRIFT_MAX_MA - val * (DRIFT_MAX_MA - DRIFT_MIN_MA);
        onChange(ma);
      } else {
        const ts = TRAJECTORY_START + val * (TRAJECTORY_END - TRAJECTORY_START);
        onChange(ts);
      }
    },
    [onChange, isGeo],
  );

  // --- Play/Pause ---
  const togglePlay = useCallback(() => {
    if (isGeo) {
      if (value <= DRIFT_MIN_MA) onChange(DRIFT_MAX_MA);
    } else {
      if (value >= TRAJECTORY_END) onChange(TRAJECTORY_START);
    }
    setIsPlaying((prev) => !prev);
  }, [value, onChange, isGeo]);

  // --- Render geological slider ---
  if (isGeo) {
    const era = getEraForTime(value);
    const timeLabel =
      value < 1
        ? '现代'
        : value < 10
          ? `${value.toFixed(1)} 百万年前`
          : `${Math.round(value)} 百万年前`;

    return (
      <div style={containerStyle} data-testid="layer-timeline-slider">
        {/* Info row */}
        <div style={infoRowStyle}>
          <span style={infoLabelStyle}>🌍 {timeLabel}</span>
          <span style={badgeStyle(era.color)}>
            {era.name} ({era.nameEn})
          </span>
          {value >= 280 && <span style={pangeaStyle}>盘古大陆</span>}
        </div>

        {/* Slider row */}
        <div style={sliderRowStyle}>
          <button
            type="button"
            style={playBtnStyle}
            onClick={togglePlay}
            aria-label={isPlaying ? '暂停' : '播放'}
            data-testid="timeline-play-btn"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          <div style={trackWrapperStyle}>
            {/* Era color segments */}
            <div style={trackBgStyle}>
              {GEO_ERAS.map((e) => {
                const leftPct =
                  ((DRIFT_MAX_MA - e.startMa) / (DRIFT_MAX_MA - DRIFT_MIN_MA)) * 100;
                const widthPct =
                  ((e.startMa - e.endMa) / (DRIFT_MAX_MA - DRIFT_MIN_MA)) * 100;
                return (
                  <div
                    key={e.nameEn}
                    style={{
                      position: 'absolute',
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      height: '100%',
                      backgroundColor: e.color,
                      opacity: 0.3,
                    }}
                    title={`${e.name} (${e.startMa}–${e.endMa} Ma)`}
                  />
                );
              })}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  width: `${sliderValue * 100}%`,
                  height: '100%',
                  backgroundColor: era.color,
                  opacity: 0.6,
                  transition: isPlaying ? 'none' : 'width 0.1s ease',
                }}
              />
            </div>

            {/* Era labels */}
            <div style={labelTrackStyle}>
              {GEO_ERAS.map((e) => {
                const centerPct =
                  ((DRIFT_MAX_MA - (e.startMa + e.endMa) / 2) /
                    (DRIFT_MAX_MA - DRIFT_MIN_MA)) *
                  100;
                return (
                  <span
                    key={e.nameEn}
                    style={{
                      ...tickLabelStyle,
                      left: `${centerPct}%`,
                      color: e.color,
                    }}
                  >
                    {e.name}
                  </span>
                );
              })}
            </div>

            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={sliderValue}
              onChange={handleSliderChange}
              style={rangeStyle}
              aria-label="地质时间轴"
              data-testid="timeline-range"
            />
          </div>
        </div>
      </div>
    );
  }

  // --- Render historical (Napoleon) slider ---
  const position = interpolatePosition(value);
  const campaignColor = CAMPAIGN_COLORS[position.campaign] ?? '#e0e8ff';

  // Year ticks
  const yearTicks: { year: number; pct: number }[] = [];
  for (let year = 1796; year <= 1815; year++) {
    const ts = new Date(`${year}-01-01`).getTime();
    const pct = ((ts - TRAJECTORY_START) / (TRAJECTORY_END - TRAJECTORY_START)) * 100;
    if (pct >= 0 && pct <= 100) yearTicks.push({ year, pct });
  }

  return (
    <div style={containerStyle} data-testid="layer-timeline-slider">
      {/* Info row */}
      <div style={infoRowStyle}>
        <span style={infoLabelStyle}>{formatDate(value)}</span>
        <span style={badgeStyle(campaignColor)}>{position.campaign}</span>
        <span style={locationStyle}>📍 {position.location}</span>
        <span style={eventStyle}>{position.event}</span>
      </div>

      {/* Slider row */}
      <div style={sliderRowStyle}>
        <button
          type="button"
          style={playBtnStyle}
          onClick={togglePlay}
          aria-label={isPlaying ? '暂停' : '播放'}
          data-testid="timeline-play-btn"
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <div style={trackWrapperStyle}>
          {/* Year labels */}
          <div style={labelTrackStyle}>
            {yearTicks.map(({ year, pct }) => (
              <span
                key={year}
                style={{ ...tickLabelStyle, left: `${pct}%`, color: '#64748b' }}
              >
                {year % 2 === 0 ? String(year) : ''}
              </span>
            ))}
          </div>

          {/* Campaign segments */}
          <div style={trackBgStyle}>
            {NAPOLEON_TRAJECTORY.map((wp, i) => {
              if (i === 0) return null;
              const prev = NAPOLEON_TRAJECTORY[i - 1];
              const startPct =
                ((prev.timestamp - TRAJECTORY_START) / (TRAJECTORY_END - TRAJECTORY_START)) * 100;
              const endPct =
                ((wp.timestamp - TRAJECTORY_START) / (TRAJECTORY_END - TRAJECTORY_START)) * 100;
              const color = CAMPAIGN_COLORS[wp.campaign] ?? '#334155';
              return (
                <div
                  key={`seg-${i}`}
                  style={{
                    position: 'absolute',
                    left: `${startPct}%`,
                    width: `${endPct - startPct}%`,
                    height: '100%',
                    backgroundColor: color,
                    opacity: 0.3,
                  }}
                />
              );
            })}
            <div
              style={{
                position: 'absolute',
                left: 0,
                width: `${sliderValue * 100}%`,
                height: '100%',
                backgroundColor: campaignColor,
                opacity: 0.6,
                transition: isPlaying ? 'none' : 'width 0.1s ease',
              }}
            />
          </div>

          <input
            type="range"
            min={0}
            max={1}
            step={0.0001}
            value={sliderValue}
            onChange={handleSliderChange}
            style={rangeStyle}
            aria-label="时间轴滑块"
            data-testid="timeline-range"
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles — compact for inline display in LayerManager
// ---------------------------------------------------------------------------

const containerStyle: CSSProperties = {
  padding: '8px 0 4px',
  color: '#e0e8ff',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const infoRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 6,
  flexWrap: 'wrap',
};

const infoLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#fff',
  whiteSpace: 'nowrap',
};

const badgeStyle = (color: string): CSSProperties => ({
  fontSize: 10,
  fontWeight: 500,
  padding: '1px 6px',
  borderRadius: 8,
  backgroundColor: color,
  color: '#000',
  whiteSpace: 'nowrap',
});

const pangeaStyle: CSSProperties = {
  fontSize: 10,
  color: '#f97316',
  fontWeight: 500,
};

const locationStyle: CSSProperties = {
  fontSize: 11,
  color: '#c8d2ff',
  whiteSpace: 'nowrap',
};

const eventStyle: CSSProperties = {
  fontSize: 11,
  color: '#a0a8cc',
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const sliderRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const playBtnStyle: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: '50%',
  border: '1px solid rgba(100, 140, 255, 0.3)',
  backgroundColor: 'rgba(20, 30, 60, 0.8)',
  color: '#e0e8ff',
  fontSize: 11,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  padding: 0,
};

const trackWrapperStyle: CSSProperties = {
  flex: 1,
  position: 'relative',
  height: 30,
};

const trackBgStyle: CSSProperties = {
  position: 'relative',
  height: 4,
  borderRadius: 2,
  backgroundColor: 'rgba(100, 140, 255, 0.1)',
  overflow: 'hidden',
};

const labelTrackStyle: CSSProperties = {
  position: 'relative',
  height: 12,
  marginBottom: 2,
};

const tickLabelStyle: CSSProperties = {
  position: 'absolute',
  transform: 'translateX(-50%)',
  fontSize: 7,
  whiteSpace: 'nowrap',
  opacity: 0.8,
};

const rangeStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: 18,
  margin: 0,
  cursor: 'pointer',
  opacity: 0,
  zIndex: 2,
};
