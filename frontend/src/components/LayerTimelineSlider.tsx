/**
 * LayerTimelineSlider — Unified timeline slider for any layer with a
 * time dimension. Renders inline below the layer toggle in the LayerManager.
 *
 * All layers share a single absolute CE year (`currentYear`). Each slider
 * displays its own range and converts between the shared year and its
 * native display format. When `currentYear` is outside the layer's data
 * range, an "out of range" indicator is shown.
 *
 * Supports two format types:
 * - 'geological': Continental drift with era segments (range in Ma)
 * - 'historical': Napoleon trajectory with campaign segments (range in years)
 */

import { useState, useCallback, useEffect, useRef, type CSSProperties } from 'react';
import type { TimelineConfig } from '../types';
import {
  GEO_ERAS,
  getEraForTime,
  yearToMa,
  maToYear,
  yearToTimestamp,
  timestampToYear,
  NAPOLEON_TRAJECTORY,
  TRAJECTORY_START,
  TRAJECTORY_END,
  CAMPAIGN_COLORS,
  interpolatePosition,
} from '../data/constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LayerTimelineSliderProps {
  /** The timeline configuration from the layer's metadata. */
  config: TimelineConfig;
  /** Shared absolute CE year. */
  currentYear: number;
  /** Called when the user changes the shared time. */
  onCurrentYearChange: (year: number) => void;
}

// ---------------------------------------------------------------------------
// Playback speed: years per animation frame at ~60fps
// ---------------------------------------------------------------------------

/** Geological playback: ~0.8 Ma per frame = 800,000 years per frame */
const GEO_YEARS_PER_FRAME = 800_000;
/** Historical playback: ~15 days per frame ≈ 0.041 years per frame */
const HIST_YEARS_PER_FRAME = 15 / 365;

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
  currentYear,
  onCurrentYearChange,
}: LayerTimelineSliderProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const animFrameRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  const isGeo = config.formatType === 'geological';
  const { startYear, endYear } = config;

  // Is the current time within this layer's data range?
  const inRange = currentYear >= startYear && currentYear <= endYear;

  // Normalized slider position 0..1 (left = startYear, right = endYear)
  const range = endYear - startYear;
  const clampedYear = Math.max(startYear, Math.min(endYear, currentYear));
  const sliderValue = range > 0 ? (clampedYear - startYear) / range : 0;

  // --- Playback loop (always advances toward endYear) ---
  useEffect(() => {
    if (!isPlaying) return;

    lastFrameTimeRef.current = performance.now();
    const speed = isGeo ? GEO_YEARS_PER_FRAME : HIST_YEARS_PER_FRAME;

    const tick = (now: number) => {
      const delta = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      const advance = (delta / 16.67) * speed;
      const next = currentYear + advance;

      if (next >= endYear) {
        onCurrentYearChange(endYear);
        setIsPlaying(false);
        return;
      }

      onCurrentYearChange(next);
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, currentYear, onCurrentYearChange, endYear, isGeo]);

  // --- Slider change: convert 0..1 back to absolute year ---
  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value); // 0..1
      const year = startYear + val * range;
      onCurrentYearChange(year);
    },
    [onCurrentYearChange, startYear, range],
  );

  // --- Play/Pause ---
  const togglePlay = useCallback(() => {
    if (currentYear >= endYear || currentYear < startYear) {
      onCurrentYearChange(startYear);
    }
    setIsPlaying((prev) => !prev);
  }, [currentYear, startYear, endYear, onCurrentYearChange]);

  // --- Render geological slider ---
  if (isGeo) {
    const ma = yearToMa(currentYear);
    const era = getEraForTime(Math.max(0, ma));

    const timeLabel = !inRange
      ? `${Math.round(currentYear)} CE — 超出范围`
      : ma < 0.001
        ? '现代'
        : ma < 10
          ? `${ma.toFixed(1)} 百万年前`
          : `${Math.round(ma)} 百万年前`;

    return (
      <div style={containerStyle} data-testid="layer-timeline-slider">
        {/* Info row */}
        <div style={infoRowStyle}>
          <span style={infoLabelStyle}>🌍 {timeLabel}</span>
          {inRange && (
            <span style={badgeStyle(era.color)}>
              {era.name} ({era.nameEn})
            </span>
          )}
          {inRange && ma >= 280 && <span style={pangeaStyle}>盘古大陆</span>}
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
                // Convert Ma to slider position (startYear..endYear)
                const eraStartYear = maToYear(e.startMa);
                const eraEndYear = maToYear(e.endMa);
                const leftPct = ((eraStartYear - startYear) / range) * 100;
                const widthPct = ((eraEndYear - eraStartYear) / range) * 100;
                return (
                  <div
                    key={e.nameEn}
                    style={{
                      position: 'absolute',
                      left: `${Math.max(0, leftPct)}%`,
                      width: `${Math.min(100 - Math.max(0, leftPct), widthPct)}%`,
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
                const eraCenterYear = maToYear((e.startMa + e.endMa) / 2);
                const centerPct = ((eraCenterYear - startYear) / range) * 100;
                if (centerPct < 0 || centerPct > 100) return null;
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
  // Convert currentYear to a timestamp for Napoleon interpolation
  const napTs = yearToTimestamp(currentYear);
  const napInRange = napTs >= TRAJECTORY_START && napTs <= TRAJECTORY_END;
  const position = napInRange ? interpolatePosition(napTs) : null;
  const campaignColor = position
    ? (CAMPAIGN_COLORS[position.campaign] ?? '#e0e8ff')
    : '#64748b';

  // Year ticks
  const yearTicks: { year: number; pct: number }[] = [];
  for (let year = 1796; year <= 1815; year++) {
    const ts = new Date(`${year}-01-01`).getTime();
    const yearVal = timestampToYear(ts);
    const pct = ((yearVal - startYear) / range) * 100;
    if (pct >= 0 && pct <= 100) yearTicks.push({ year, pct });
  }

  return (
    <div style={containerStyle} data-testid="layer-timeline-slider">
      {/* Info row */}
      <div style={infoRowStyle}>
        {napInRange && position ? (
          <>
            <span style={infoLabelStyle}>{formatDate(napTs)}</span>
            <span style={badgeStyle(campaignColor)}>{position.campaign}</span>
            <span style={locationStyle}>📍 {position.location}</span>
            <span style={eventStyle}>{position.event}</span>
          </>
        ) : (
          <span style={outOfRangeStyle}>
            {currentYear < startYear
              ? `${Math.round(currentYear)} CE — 早于数据范围`
              : `${Math.round(currentYear)} CE — 晚于数据范围`}
          </span>
        )}
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
              const segStartYear = timestampToYear(prev.timestamp);
              const segEndYear = timestampToYear(wp.timestamp);
              const startPct = ((segStartYear - startYear) / range) * 100;
              const endPct = ((segEndYear - startYear) / range) * 100;
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

const outOfRangeStyle: CSSProperties = {
  fontSize: 11,
  color: '#64748b',
  fontStyle: 'italic',
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
