/**
 * TimelineSlider — A time-dimension slider overlay for controlling
 * Napoleon's campaign trajectory on the globe.
 *
 * Features:
 * - Draggable slider spanning 1796–1815
 * - Displays current date, location, event, and campaign
 * - Play/pause button for auto-advancing through time
 * - Campaign color-coded progress bar
 */

import { useState, useCallback, useEffect, useRef, type CSSProperties } from 'react';
import {
  TRAJECTORY_START,
  TRAJECTORY_END,
  interpolatePosition,
  NAPOLEON_TRAJECTORY,
} from '../data/napoleonTrajectory';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TimelineSliderProps {
  /** Called when the user changes the time position */
  onTimeChange: (timestamp: number) => void;
  /** Current timestamp value (controlled) */
  currentTime: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Playback speed: milliseconds of real time per animation frame step */
const PLAYBACK_SPEED_MS_PER_FRAME = 86400000 * 15; // 15 days per frame (~60fps)

/** Campaign colors for the progress bar segments */
const CAMPAIGN_COLORS: Record<string, string> = {
  '意大利战役': '#4dff88',
  '埃及远征': '#ffcc33',
  '夺权之路': '#ff6b6b',
  '第二次意大利战役': '#4dff88',
  '帝国崛起': '#c084fc',
  '奥斯特里茨战役': '#60a5fa',
  '普鲁士战役': '#f97316',
  '波兰战役': '#f97316',
  '西班牙战役': '#ef4444',
  '奥地利战役': '#60a5fa',
  '俄国战役': '#38bdf8',
  '德意志战役': '#a78bfa',
  '法兰西战役': '#fb7185',
  '第一次流放': '#94a3b8',
  '百日王朝': '#fbbf24',
  '最终流放': '#64748b',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatYear(timestamp: number): string {
  return new Date(timestamp).getFullYear().toString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TimelineSlider({ onTimeChange, currentTime }: TimelineSliderProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const animFrameRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  // Current interpolated position
  const position = interpolatePosition(currentTime);

  // Campaign color
  const campaignColor = CAMPAIGN_COLORS[position.campaign] ?? '#e0e8ff';

  // Slider value as 0–1 range
  const sliderValue = (currentTime - TRAJECTORY_START) / (TRAJECTORY_END - TRAJECTORY_START);

  // --- Playback loop ---
  useEffect(() => {
    if (!isPlaying) return;

    lastFrameTimeRef.current = performance.now();

    const tick = (now: number) => {
      const delta = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      // Advance time proportional to real elapsed time
      const advance = (delta / 16.67) * PLAYBACK_SPEED_MS_PER_FRAME;
      const next = currentTime + advance;

      if (next >= TRAJECTORY_END) {
        onTimeChange(TRAJECTORY_END);
        setIsPlaying(false);
        return;
      }

      onTimeChange(next);
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, currentTime, onTimeChange]);

  // --- Slider change handler ---
  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      const timestamp = TRAJECTORY_START + val * (TRAJECTORY_END - TRAJECTORY_START);
      onTimeChange(timestamp);
    },
    [onTimeChange],
  );

  // --- Play/Pause ---
  const togglePlay = useCallback(() => {
    if (currentTime >= TRAJECTORY_END) {
      // Reset to start if at end
      onTimeChange(TRAJECTORY_START);
    }
    setIsPlaying((prev) => !prev);
  }, [currentTime, onTimeChange]);

  // --- Year tick marks ---
  const yearTicks = [];
  for (let year = 1796; year <= 1815; year++) {
    const ts = new Date(`${year}-01-01`).getTime();
    const pct = ((ts - TRAJECTORY_START) / (TRAJECTORY_END - TRAJECTORY_START)) * 100;
    if (pct >= 0 && pct <= 100) {
      yearTicks.push({ year, pct });
    }
  }

  return (
    <div style={containerStyle} data-testid="timeline-slider">
      {/* Info panel */}
      <div style={infoPanelStyle}>
        <div style={dateStyle}>{formatDate(currentTime)}</div>
        <div style={campaignBadgeStyle(campaignColor)}>{position.campaign}</div>
        <div style={locationStyle}>
          📍 {position.location}
        </div>
        <div style={eventStyle}>{position.event}</div>
      </div>

      {/* Slider row */}
      <div style={sliderRowStyle}>
        <button
          type="button"
          style={playButtonStyle}
          onClick={togglePlay}
          aria-label={isPlaying ? '暂停' : '播放'}
          data-testid="timeline-play-btn"
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <div style={sliderWrapperStyle}>
          {/* Year labels */}
          <div style={tickContainerStyle}>
            {yearTicks.map(({ year, pct }) => (
              <span
                key={year}
                style={{
                  ...tickLabelStyle,
                  left: `${pct}%`,
                }}
              >
                {year % 2 === 0 ? formatYear(new Date(`${year}-01-01`).getTime()) : ''}
              </span>
            ))}
          </div>

          {/* Campaign progress segments (background) */}
          <div style={progressTrackStyle}>
            {NAPOLEON_TRAJECTORY.map((wp, i) => {
              if (i === 0) return null;
              const prev = NAPOLEON_TRAJECTORY[i - 1];
              const startPct = ((prev.timestamp - TRAJECTORY_START) / (TRAJECTORY_END - TRAJECTORY_START)) * 100;
              const endPct = ((wp.timestamp - TRAJECTORY_START) / (TRAJECTORY_END - TRAJECTORY_START)) * 100;
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
            {/* Active progress */}
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

          {/* Range input */}
          <input
            type="range"
            min={0}
            max={1}
            step={0.0001}
            value={sliderValue}
            onChange={handleSliderChange}
            style={rangeInputStyle}
            aria-label="时间轴滑块"
            data-testid="timeline-range"
          />
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
  border: '1px solid rgba(100, 140, 255, 0.2)',
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

const dateStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: '#fff',
  whiteSpace: 'nowrap',
};

const campaignBadgeStyle = (color: string): CSSProperties => ({
  fontSize: 11,
  fontWeight: 500,
  padding: '2px 8px',
  borderRadius: 10,
  backgroundColor: color,
  color: '#000',
  whiteSpace: 'nowrap',
});

const locationStyle: CSSProperties = {
  fontSize: 13,
  color: '#c8d2ff',
  whiteSpace: 'nowrap',
};

const eventStyle: CSSProperties = {
  fontSize: 13,
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
  gap: 10,
};

const playButtonStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  border: '1px solid rgba(100, 140, 255, 0.4)',
  backgroundColor: 'rgba(30, 40, 80, 0.8)',
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

const tickContainerStyle: CSSProperties = {
  position: 'relative',
  height: 14,
  marginBottom: 2,
};

const tickLabelStyle: CSSProperties = {
  position: 'absolute',
  transform: 'translateX(-50%)',
  fontSize: 9,
  color: '#64748b',
  whiteSpace: 'nowrap',
};

const progressTrackStyle: CSSProperties = {
  position: 'relative',
  height: 4,
  borderRadius: 2,
  backgroundColor: 'rgba(100, 140, 255, 0.1)',
  overflow: 'hidden',
};

const rangeInputStyle: CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  width: '100%',
  height: 16,
  margin: 0,
  cursor: 'pointer',
  opacity: 0,
  zIndex: 2,
};
