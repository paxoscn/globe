/**
 * DriftTimelineSlider — Geological time slider for continental drift.
 *
 * Controls the time dimension (0–300 Ma) for the world-borders layer,
 * showing continent positions from Pangaea to present day.
 *
 * Features:
 * - Slider from 300 Ma (left) to 0 Ma / present (right)
 * - Geological era color segments and labels
 * - Play/pause for auto-advancing through time
 * - Current era and time display
 */

import { useState, useCallback, useEffect, useRef, type CSSProperties } from 'react';
import {
  DRIFT_MAX_MA,
  DRIFT_MIN_MA,
  GEO_ERAS,
  getEraForTime,
} from '../data/continentalDrift';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DriftTimelineSliderProps {
  /** Current time in Ma (millions of years ago). */
  currentMa: number;
  /** Called when the user changes the time. */
  onTimeChange: (ma: number) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Playback speed: Ma per animation frame at 60fps. */
const PLAYBACK_SPEED_MA_PER_FRAME = 0.8;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DriftTimelineSlider({
  currentMa,
  onTimeChange,
}: DriftTimelineSliderProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const animFrameRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  const era = getEraForTime(currentMa);

  // Slider value: 0 = 300 Ma (left), 1 = 0 Ma (right)
  const sliderValue = 1 - (currentMa - DRIFT_MIN_MA) / (DRIFT_MAX_MA - DRIFT_MIN_MA);

  // --- Playback loop (time flows from past → present, i.e. Ma decreases) ---
  useEffect(() => {
    if (!isPlaying) return;

    lastFrameTimeRef.current = performance.now();

    const tick = (now: number) => {
      const delta = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      const advance = (delta / 16.67) * PLAYBACK_SPEED_MA_PER_FRAME;
      const next = currentMa - advance; // Ma decreases toward present

      if (next <= DRIFT_MIN_MA) {
        onTimeChange(DRIFT_MIN_MA);
        setIsPlaying(false);
        return;
      }

      onTimeChange(next);
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, currentMa, onTimeChange]);

  // --- Slider change ---
  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value); // 0..1, 0=300Ma, 1=0Ma
      const ma = DRIFT_MAX_MA - val * (DRIFT_MAX_MA - DRIFT_MIN_MA);
      onTimeChange(ma);
    },
    [onTimeChange],
  );

  // --- Play/Pause ---
  const togglePlay = useCallback(() => {
    if (currentMa <= DRIFT_MIN_MA) {
      onTimeChange(DRIFT_MAX_MA); // reset to Pangaea
    }
    setIsPlaying((prev) => !prev);
  }, [currentMa, onTimeChange]);

  // --- Format time ---
  const timeLabel =
    currentMa < 1
      ? '现代'
      : currentMa < 10
        ? `${currentMa.toFixed(1)} 百万年前`
        : `${Math.round(currentMa)} 百万年前`;

  return (
    <div style={containerStyle} data-testid="drift-timeline-slider">
      {/* Info row */}
      <div style={infoPanelStyle}>
        <div style={timeStyle}>🌍 {timeLabel}</div>
        <div style={eraBadgeStyle(era.color)}>
          {era.name} ({era.nameEn})
        </div>
        {currentMa >= 280 && (
          <div style={pangeaLabelStyle}>盘古大陆 Pangaea</div>
        )}
      </div>

      {/* Slider row */}
      <div style={sliderRowStyle}>
        <button
          type="button"
          style={playButtonStyle}
          onClick={togglePlay}
          aria-label={isPlaying ? '暂停' : '播放'}
          data-testid="drift-play-btn"
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <div style={sliderWrapperStyle}>
          {/* Era segments */}
          <div style={eraTrackStyle}>
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
            {/* Progress indicator */}
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
          <div style={eraLabelTrackStyle}>
            {GEO_ERAS.filter((_, i) => i % 1 === 0).map((e) => {
              const centerPct =
                ((DRIFT_MAX_MA - (e.startMa + e.endMa) / 2) /
                  (DRIFT_MAX_MA - DRIFT_MIN_MA)) *
                100;
              return (
                <span
                  key={e.nameEn}
                  style={{
                    ...eraLabelStyle,
                    left: `${centerPct}%`,
                    color: e.color,
                  }}
                >
                  {e.name}
                </span>
              );
            })}
          </div>

          {/* Range input */}
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={sliderValue}
            onChange={handleSliderChange}
            style={rangeInputStyle}
            aria-label="地质时间轴"
            data-testid="drift-range"
          />
        </div>

        {/* Endpoint labels */}
        <div style={endpointStyle}>
          <span style={endpointLabelStyle}>300 Ma</span>
          <span style={endpointLabelStyle}>现代</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 15,
  pointerEvents: 'auto',
  backgroundColor: 'rgba(10, 14, 39, 0.85)',
  borderRadius: 12,
  padding: '12px 16px',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(100, 200, 140, 0.25)',
  color: '#e0e8ff',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const infoPanelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginBottom: 8,
  flexWrap: 'wrap',
};

const timeStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: '#fff',
  whiteSpace: 'nowrap',
};

const eraBadgeStyle = (color: string): CSSProperties => ({
  fontSize: 11,
  fontWeight: 500,
  padding: '2px 8px',
  borderRadius: 10,
  backgroundColor: color,
  color: '#000',
  whiteSpace: 'nowrap',
});

const pangeaLabelStyle: CSSProperties = {
  fontSize: 12,
  color: '#f97316',
  fontWeight: 500,
};

const sliderRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const playButtonStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  border: '1px solid rgba(100, 200, 140, 0.4)',
  backgroundColor: 'rgba(20, 40, 30, 0.8)',
  color: '#e0e8ff',
  fontSize: 14,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  transition: 'background-color 0.2s',
};

const sliderWrapperStyle: CSSProperties = {
  flex: 1,
  position: 'relative',
  height: 36,
};

const eraTrackStyle: CSSProperties = {
  position: 'relative',
  height: 4,
  borderRadius: 2,
  backgroundColor: 'rgba(100, 200, 140, 0.1)',
  overflow: 'hidden',
};

const eraLabelTrackStyle: CSSProperties = {
  position: 'relative',
  height: 14,
  marginTop: 2,
};

const eraLabelStyle: CSSProperties = {
  position: 'absolute',
  transform: 'translateX(-50%)',
  fontSize: 8,
  whiteSpace: 'nowrap',
  opacity: 0.8,
};

const rangeInputStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: 20,
  margin: 0,
  cursor: 'pointer',
  opacity: 0,
  zIndex: 2,
};

const endpointStyle: CSSProperties = {
  display: 'none', // hidden — era labels are more informative
};

const endpointLabelStyle: CSSProperties = {
  fontSize: 9,
  color: '#64748b',
};
