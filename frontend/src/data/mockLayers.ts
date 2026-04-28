/**
 * Mock layer data for development — provides layer metadata and GeoJSON data
 * for all layers including World Borders (continental drift) and Napoleon's
 * campaign trajectory.
 *
 * Timeline data for both layers is consolidated here. Each layer with a
 * time dimension has a `timelineConfig` that drives a unified slider component.
 */

import type { LayerMeta } from '../types';
import type { FeatureCollection } from '../types/geojson';

// ---------------------------------------------------------------------------
// Napoleon trajectory data (moved from napoleonTrajectory.ts)
// ---------------------------------------------------------------------------

export interface NapoleonWaypoint {
  /** ISO-style date string (YYYY-MM-DD) */
  date: string;
  /** Timestamp in milliseconds (for easy interpolation) */
  timestamp: number;
  /** Latitude in degrees */
  lat: number;
  /** Longitude in degrees */
  lng: number;
  /** Location name */
  location: string;
  /** Brief event description */
  event: string;
  /** Campaign name */
  campaign: string;
}

function d(dateStr: string): number {
  return new Date(dateStr).getTime();
}

export const NAPOLEON_TRAJECTORY: NapoleonWaypoint[] = [
  // --- Italian Campaign (1796–1797) ---
  { date: '1796-03-27', timestamp: d('1796-03-27'), lat: 43.7102, lng: 7.2620, location: 'Nice', event: '就任意大利方面军总司令', campaign: '意大利战役' },
  { date: '1796-04-12', timestamp: d('1796-04-12'), lat: 44.3918, lng: 8.9460, location: 'Montenotte', event: '蒙特诺特战役胜利', campaign: '意大利战役' },
  { date: '1796-05-10', timestamp: d('1796-05-10'), lat: 45.1890, lng: 9.1580, location: 'Lodi', event: '洛迪桥之战', campaign: '意大利战役' },
  { date: '1796-08-05', timestamp: d('1796-08-05'), lat: 45.4384, lng: 10.9916, location: 'Castiglione', event: '卡斯蒂廖内战役', campaign: '意大利战役' },
  { date: '1796-11-17', timestamp: d('1796-11-17'), lat: 45.4408, lng: 11.0034, location: 'Arcole', event: '阿尔科莱桥之战', campaign: '意大利战役' },
  { date: '1797-01-14', timestamp: d('1797-01-14'), lat: 45.3520, lng: 10.8630, location: 'Rivoli', event: '里沃利战役大捷', campaign: '意大利战役' },
  { date: '1797-10-17', timestamp: d('1797-10-17'), lat: 48.8566, lng: 2.3522, location: 'Paris', event: '签署坎波福尔米奥条约，凯旋巴黎', campaign: '意大利战役' },

  // --- Egyptian Campaign (1798–1799) ---
  { date: '1798-05-19', timestamp: d('1798-05-19'), lat: 43.2965, lng: 5.3698, location: 'Toulon', event: '率舰队从土伦出发', campaign: '埃及远征' },
  { date: '1798-06-12', timestamp: d('1798-06-12'), lat: 35.8989, lng: 14.5146, location: 'Malta', event: '攻占马耳他', campaign: '埃及远征' },
  { date: '1798-07-02', timestamp: d('1798-07-02'), lat: 31.2001, lng: 29.9187, location: 'Alexandria', event: '登陆亚历山大港', campaign: '埃及远征' },
  { date: '1798-07-21', timestamp: d('1798-07-21'), lat: 30.0131, lng: 31.2089, location: 'Cairo', event: '金字塔战役，征服开罗', campaign: '埃及远征' },
  { date: '1799-02-20', timestamp: d('1799-02-20'), lat: 31.5000, lng: 34.4667, location: 'Gaza', event: '进军叙利亚', campaign: '埃及远征' },
  { date: '1799-03-19', timestamp: d('1799-03-19'), lat: 32.9225, lng: 35.0680, location: 'Acre', event: '围攻阿克城', campaign: '埃及远征' },
  { date: '1799-08-23', timestamp: d('1799-08-23'), lat: 31.2001, lng: 29.9187, location: 'Alexandria', event: '秘密离开埃及返回法国', campaign: '埃及远征' },

  // --- Rise to Power (1799–1800) ---
  { date: '1799-10-09', timestamp: d('1799-10-09'), lat: 43.6047, lng: 3.8807, location: 'Fréjus', event: '在弗雷瑞斯登陆法国', campaign: '夺权之路' },
  { date: '1799-11-09', timestamp: d('1799-11-09'), lat: 48.8566, lng: 2.3522, location: 'Paris', event: '雾月政变，成为第一执政', campaign: '夺权之路' },
  { date: '1800-05-20', timestamp: d('1800-05-20'), lat: 45.8686, lng: 7.1706, location: 'Great St Bernard', event: '翻越大圣伯纳德山口', campaign: '第二次意大利战役' },
  { date: '1800-06-14', timestamp: d('1800-06-14'), lat: 44.8950, lng: 8.6340, location: 'Marengo', event: '马伦戈战役大捷', campaign: '第二次意大利战役' },
  { date: '1800-07-03', timestamp: d('1800-07-03'), lat: 48.8566, lng: 2.3522, location: 'Paris', event: '返回巴黎巩固权力', campaign: '第二次意大利战役' },

  // --- Emperor & Austerlitz (1804–1805) ---
  { date: '1804-12-02', timestamp: d('1804-12-02'), lat: 48.8530, lng: 2.3499, location: 'Paris (Notre-Dame)', event: '加冕称帝', campaign: '帝国崛起' },
  { date: '1805-09-25', timestamp: d('1805-09-25'), lat: 48.7758, lng: 9.1829, location: 'Stuttgart', event: '大军团越过莱茵河', campaign: '奥斯特里茨战役' },
  { date: '1805-10-20', timestamp: d('1805-10-20'), lat: 48.5100, lng: 10.0900, location: 'Ulm', event: '乌尔姆战役，奥军投降', campaign: '奥斯特里茨战役' },
  { date: '1805-11-13', timestamp: d('1805-11-13'), lat: 48.2082, lng: 16.3738, location: 'Vienna', event: '占领维也纳', campaign: '奥斯特里茨战役' },
  { date: '1805-12-02', timestamp: d('1805-12-02'), lat: 49.1275, lng: 16.7600, location: 'Austerlitz', event: '奥斯特里茨战役——三皇会战大捷', campaign: '奥斯特里茨战役' },

  // --- Prussian & Polish Campaign (1806–1807) ---
  { date: '1806-10-14', timestamp: d('1806-10-14'), lat: 50.9270, lng: 11.5890, location: 'Jena', event: '耶拿战役，击溃普鲁士', campaign: '普鲁士战役' },
  { date: '1806-10-27', timestamp: d('1806-10-27'), lat: 52.5200, lng: 13.4050, location: 'Berlin', event: '进入柏林', campaign: '普鲁士战役' },
  { date: '1807-02-08', timestamp: d('1807-02-08'), lat: 54.3520, lng: 20.4700, location: 'Eylau', event: '艾劳战役（惨烈平局）', campaign: '波兰战役' },
  { date: '1807-06-14', timestamp: d('1807-06-14'), lat: 54.3800, lng: 20.5100, location: 'Friedland', event: '弗里德兰战役大捷', campaign: '波兰战役' },
  { date: '1807-07-07', timestamp: d('1807-07-07'), lat: 55.0833, lng: 21.8833, location: 'Tilsit', event: '签署提尔西特条约', campaign: '波兰战役' },

  // --- Spanish Campaign (1808) ---
  { date: '1808-11-05', timestamp: d('1808-11-05'), lat: 42.8125, lng: -1.6458, location: 'Burgos', event: '亲征西班牙', campaign: '西班牙战役' },
  { date: '1808-12-04', timestamp: d('1808-12-04'), lat: 40.4168, lng: -3.7038, location: 'Madrid', event: '攻占马德里', campaign: '西班牙战役' },

  // --- Austrian Campaign (1809) ---
  { date: '1809-04-23', timestamp: d('1809-04-23'), lat: 48.7433, lng: 11.8800, location: 'Eckmühl', event: '埃克米尔战役', campaign: '奥地利战役' },
  { date: '1809-05-13', timestamp: d('1809-05-13'), lat: 48.2082, lng: 16.3738, location: 'Vienna', event: '再次占领维也纳', campaign: '奥地利战役' },
  { date: '1809-05-22', timestamp: d('1809-05-22'), lat: 48.2000, lng: 16.5200, location: 'Aspern-Essling', event: '阿斯珀恩-埃斯灵战役（首次失利）', campaign: '奥地利战役' },
  { date: '1809-07-06', timestamp: d('1809-07-06'), lat: 48.2900, lng: 16.5600, location: 'Wagram', event: '瓦格拉姆战役大捷', campaign: '奥地利战役' },

  // --- Russian Campaign (1812) ---
  { date: '1812-06-24', timestamp: d('1812-06-24'), lat: 54.6872, lng: 25.2797, location: 'Vilna', event: '大军团渡过涅曼河，入侵俄国', campaign: '俄国战役' },
  { date: '1812-08-17', timestamp: d('1812-08-17'), lat: 54.7818, lng: 32.0401, location: 'Smolensk', event: '斯摩棱斯克战役', campaign: '俄国战役' },
  { date: '1812-09-07', timestamp: d('1812-09-07'), lat: 55.5167, lng: 35.8167, location: 'Borodino', event: '博罗季诺战役——惨烈的胜利', campaign: '俄国战役' },
  { date: '1812-09-14', timestamp: d('1812-09-14'), lat: 55.7558, lng: 37.6173, location: 'Moscow', event: '进入莫斯科，发现空城大火', campaign: '俄国战役' },
  { date: '1812-10-19', timestamp: d('1812-10-19'), lat: 55.7558, lng: 37.6173, location: 'Moscow', event: '被迫撤离莫斯科', campaign: '俄国战役' },
  { date: '1812-11-29', timestamp: d('1812-11-29'), lat: 54.3100, lng: 26.8300, location: 'Berezina', event: '别列津纳河渡河——大军团覆灭', campaign: '俄国战役' },
  { date: '1812-12-18', timestamp: d('1812-12-18'), lat: 48.8566, lng: 2.3522, location: 'Paris', event: '抛下残军返回巴黎', campaign: '俄国战役' },

  // --- German Campaign / Leipzig (1813) ---
  { date: '1813-05-02', timestamp: d('1813-05-02'), lat: 51.1913, lng: 12.1714, location: 'Lützen', event: '吕岑战役', campaign: '德意志战役' },
  { date: '1813-05-21', timestamp: d('1813-05-21'), lat: 51.1809, lng: 14.4344, location: 'Bautzen', event: '包岑战役', campaign: '德意志战役' },
  { date: '1813-08-27', timestamp: d('1813-08-27'), lat: 51.0504, lng: 13.7373, location: 'Dresden', event: '德累斯顿战役', campaign: '德意志战役' },
  { date: '1813-10-19', timestamp: d('1813-10-19'), lat: 51.3397, lng: 12.3731, location: 'Leipzig', event: '莱比锡战役——民族大会战惨败', campaign: '德意志战役' },

  // --- Fall of Paris & Elba (1814) ---
  { date: '1814-02-10', timestamp: d('1814-02-10'), lat: 48.2973, lng: 3.5000, location: 'Champaubert', event: '尚波贝尔战役（六日战役）', campaign: '法兰西战役' },
  { date: '1814-03-31', timestamp: d('1814-03-31'), lat: 48.8566, lng: 2.3522, location: 'Paris', event: '巴黎陷落', campaign: '法兰西战役' },
  { date: '1814-04-20', timestamp: d('1814-04-20'), lat: 47.3220, lng: 5.0415, location: 'Fontainebleau', event: '枫丹白露告别近卫军', campaign: '法兰西战役' },
  { date: '1814-05-04', timestamp: d('1814-05-04'), lat: 42.7625, lng: 10.2480, location: 'Elba', event: '流放厄尔巴岛', campaign: '第一次流放' },

  // --- Hundred Days & Waterloo (1815) ---
  { date: '1815-03-01', timestamp: d('1815-03-01'), lat: 43.5528, lng: 7.0174, location: 'Golfe-Juan', event: '逃离厄尔巴岛，在儒安湾登陆', campaign: '百日王朝' },
  { date: '1815-03-07', timestamp: d('1815-03-07'), lat: 45.1885, lng: 5.7245, location: 'Grenoble', event: '"士兵们，向你们的皇帝开枪吧！"', campaign: '百日王朝' },
  { date: '1815-03-20', timestamp: d('1815-03-20'), lat: 48.8566, lng: 2.3522, location: 'Paris', event: '重返巴黎，路易十八出逃', campaign: '百日王朝' },
  { date: '1815-06-16', timestamp: d('1815-06-16'), lat: 50.4300, lng: 4.4500, location: 'Ligny', event: '利尼战役——最后的胜利', campaign: '百日王朝' },
  { date: '1815-06-18', timestamp: d('1815-06-18'), lat: 50.6800, lng: 4.4100, location: 'Waterloo', event: '滑铁卢战役——最终的失败', campaign: '百日王朝' },
  { date: '1815-07-15', timestamp: d('1815-07-15'), lat: 45.9400, lng: -1.1500, location: 'Rochefort', event: '向英国投降', campaign: '百日王朝' },
  { date: '1815-10-17', timestamp: d('1815-10-17'), lat: -15.9650, lng: -5.7089, location: 'St. Helena', event: '流放圣赫勒拿岛', campaign: '最终流放' },
];

/** Time range of the Napoleon trajectory */
export const TRAJECTORY_START = NAPOLEON_TRAJECTORY[0].timestamp;
export const TRAJECTORY_END = NAPOLEON_TRAJECTORY[NAPOLEON_TRAJECTORY.length - 1].timestamp;

// ---------------------------------------------------------------------------
// Continental drift data (moved from continentalDrift.ts)
// ---------------------------------------------------------------------------

export interface DriftKeyframe {
  ma: number;
  dLng: number;
  dLat: number;
  rotation?: number;
}

export interface ContinentDriftData {
  name: string;
  keyframes: DriftKeyframe[];
}

export const DRIFT_MAX_MA = 300;
export const DRIFT_MIN_MA = 0;

export const CONTINENT_DRIFT: ContinentDriftData[] = [
  {
    name: 'North America',
    keyframes: [
      { ma: 300, dLng: 50,  dLat: -25, rotation: 15 },
      { ma: 250, dLng: 45,  dLat: -22, rotation: 12 },
      { ma: 200, dLng: 35,  dLat: -18, rotation: 8 },
      { ma: 150, dLng: 22,  dLat: -12, rotation: 5 },
      { ma: 100, dLng: 12,  dLat: -6,  rotation: 2 },
      { ma: 50,  dLng: 5,   dLat: -2,  rotation: 1 },
      { ma: 0,   dLng: 0,   dLat: 0,   rotation: 0 },
    ],
  },
  {
    name: 'South America',
    keyframes: [
      { ma: 300, dLng: 35,  dLat: -10, rotation: -30 },
      { ma: 250, dLng: 32,  dLat: -8,  rotation: -25 },
      { ma: 200, dLng: 25,  dLat: -5,  rotation: -18 },
      { ma: 150, dLng: 15,  dLat: -3,  rotation: -10 },
      { ma: 100, dLng: 5,   dLat: -1,  rotation: -4 },
      { ma: 50,  dLng: 2,   dLat: 0,   rotation: -1 },
      { ma: 0,   dLng: 0,   dLat: 0,   rotation: 0 },
    ],
  },
  {
    name: 'Europe',
    keyframes: [
      { ma: 300, dLng: -10, dLat: -30, rotation: -20 },
      { ma: 250, dLng: -8,  dLat: -26, rotation: -16 },
      { ma: 200, dLng: -5,  dLat: -20, rotation: -10 },
      { ma: 150, dLng: -3,  dLat: -14, rotation: -6 },
      { ma: 100, dLng: -2,  dLat: -8,  rotation: -3 },
      { ma: 50,  dLng: -1,  dLat: -3,  rotation: -1 },
      { ma: 0,   dLng: 0,   dLat: 0,   rotation: 0 },
    ],
  },
  {
    name: 'Africa',
    keyframes: [
      { ma: 300, dLng: 10,  dLat: -20, rotation: -25 },
      { ma: 250, dLng: 8,   dLat: -17, rotation: -20 },
      { ma: 200, dLng: 5,   dLat: -12, rotation: -14 },
      { ma: 150, dLng: 3,   dLat: -8,  rotation: -8 },
      { ma: 100, dLng: 1,   dLat: -4,  rotation: -3 },
      { ma: 50,  dLng: 0,   dLat: -1,  rotation: -1 },
      { ma: 0,   dLng: 0,   dLat: 0,   rotation: 0 },
    ],
  },
  {
    name: 'Asia',
    keyframes: [
      { ma: 300, dLng: -25, dLat: -30, rotation: -15 },
      { ma: 250, dLng: -20, dLat: -25, rotation: -12 },
      { ma: 200, dLng: -15, dLat: -18, rotation: -8 },
      { ma: 150, dLng: -10, dLat: -12, rotation: -5 },
      { ma: 100, dLng: -5,  dLat: -6,  rotation: -2 },
      { ma: 50,  dLng: -2,  dLat: -2,  rotation: -1 },
      { ma: 0,   dLng: 0,   dLat: 0,   rotation: 0 },
    ],
  },
  {
    name: 'Australia',
    keyframes: [
      { ma: 300, dLng: -30, dLat: -30, rotation: 40 },
      { ma: 250, dLng: -28, dLat: -28, rotation: 35 },
      { ma: 200, dLng: -25, dLat: -25, rotation: 28 },
      { ma: 150, dLng: -20, dLat: -22, rotation: 22 },
      { ma: 100, dLng: -12, dLat: -18, rotation: 15 },
      { ma: 50,  dLng: -5,  dLat: -8,  rotation: 6 },
      { ma: 0,   dLng: 0,   dLat: 0,   rotation: 0 },
    ],
  },
  {
    name: 'Japan',
    keyframes: [
      { ma: 300, dLng: -30, dLat: -25, rotation: -10 },
      { ma: 250, dLng: -25, dLat: -20, rotation: -8 },
      { ma: 200, dLng: -18, dLat: -15, rotation: -5 },
      { ma: 150, dLng: -12, dLat: -10, rotation: -3 },
      { ma: 100, dLng: -6,  dLat: -5,  rotation: -1 },
      { ma: 50,  dLng: -2,  dLat: -2,  rotation: 0 },
      { ma: 0,   dLng: 0,   dLat: 0,   rotation: 0 },
    ],
  },
  {
    name: 'British Isles',
    keyframes: [
      { ma: 300, dLng: -5,  dLat: -32, rotation: -15 },
      { ma: 250, dLng: -4,  dLat: -28, rotation: -12 },
      { ma: 200, dLng: -3,  dLat: -22, rotation: -8 },
      { ma: 150, dLng: -2,  dLat: -15, rotation: -5 },
      { ma: 100, dLng: -1,  dLat: -8,  rotation: -2 },
      { ma: 50,  dLng: 0,   dLat: -3,  rotation: -1 },
      { ma: 0,   dLng: 0,   dLat: 0,   rotation: 0 },
    ],
  },
];

/** Geological era info for display. */
export interface GeoEra {
  name: string;
  nameEn: string;
  startMa: number;
  endMa: number;
  color: string;
}

export const GEO_ERAS: GeoEra[] = [
  { name: '二叠纪', nameEn: 'Permian',    startMa: 300, endMa: 252, color: '#f97316' },
  { name: '三叠纪', nameEn: 'Triassic',   startMa: 252, endMa: 201, color: '#a855f7' },
  { name: '侏罗纪', nameEn: 'Jurassic',   startMa: 201, endMa: 145, color: '#3b82f6' },
  { name: '白垩纪', nameEn: 'Cretaceous', startMa: 145, endMa: 66,  color: '#22c55e' },
  { name: '古近纪', nameEn: 'Paleogene',  startMa: 66,  endMa: 23,  color: '#eab308' },
  { name: '新近纪', nameEn: 'Neogene',    startMa: 23,  endMa: 2.6, color: '#f59e0b' },
  { name: '第四纪', nameEn: 'Quaternary', startMa: 2.6, endMa: 0,   color: '#06b6d4' },
];

/** Campaign colors for the Napoleon progress bar segments */
export const CAMPAIGN_COLORS: Record<string, string> = {
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
// Year conversion helpers
// ---------------------------------------------------------------------------

/** The current year, used as the "present" reference for geological time. */
export const PRESENT_YEAR = 2026;

/** Convert Ma (millions of years ago) to absolute CE year. */
export function maToYear(ma: number): number {
  return PRESENT_YEAR - ma * 1_000_000;
}

/** Convert absolute CE year to Ma (millions of years ago). */
export function yearToMa(year: number): number {
  return (PRESENT_YEAR - year) / 1_000_000;
}

/** Convert a JS timestamp (ms) to absolute CE year (fractional). */
export function timestampToYear(ts: number): number {
  const d = new Date(ts);
  const y = d.getFullYear();
  const startOfYear = new Date(y, 0, 1).getTime();
  const endOfYear = new Date(y + 1, 0, 1).getTime();
  return y + (ts - startOfYear) / (endOfYear - startOfYear);
}

/** Convert absolute CE year (fractional) to a JS timestamp (ms). */
export function yearToTimestamp(year: number): number {
  const y = Math.floor(year);
  const frac = year - y;
  const startOfYear = new Date(y, 0, 1).getTime();
  const endOfYear = new Date(y + 1, 0, 1).getTime();
  return startOfYear + frac * (endOfYear - startOfYear);
}

// ---------------------------------------------------------------------------
// Layer metadata
// ---------------------------------------------------------------------------

/** Well-known layer ID for the Napoleon trajectory layer. */
export const NAPOLEON_LAYER_ID = 'napoleon-trajectory';

/** Napoleon data range in absolute CE years. */
const NAPOLEON_START_YEAR = timestampToYear(TRAJECTORY_START); // ~1796.2
const NAPOLEON_END_YEAR = timestampToYear(TRAJECTORY_END);     // ~1815.8

export const MOCK_LAYERS: LayerMeta[] = [
  {
    id: 'world-borders',
    name: '大陆漂移 (0–300 Ma)',
    description: 'Simplified outlines of major landmasses with continental drift',
    enabled: true,
    lodLevels: [0, 1, 2],
    timelineConfig: {
      startYear: maToYear(DRIFT_MAX_MA), // -299,997,974
      endYear: maToYear(DRIFT_MIN_MA),   // 2026 (present)
      formatType: 'geological',
    },
  },
  {
    id: 'cities',
    name: 'Major Cities',
    description: 'Locations of major world cities',
    enabled: false,
    lodLevels: [0, 1],
  },
  {
    id: NAPOLEON_LAYER_ID,
    name: '拿破仑战役轨迹 (1796–1815)',
    description: 'Napoleon campaign trajectory with timeline control',
    enabled: false,
    lodLevels: [0],
    timelineConfig: {
      startYear: NAPOLEON_START_YEAR,
      endYear: NAPOLEON_END_YEAR,
      formatType: 'historical',
    },
  },
];


// ---------------------------------------------------------------------------
// Simplified continent/country outlines (GeoJSON)
// Coordinates are [longitude, latitude] per GeoJSON spec.
// ---------------------------------------------------------------------------

export const MOCK_GEOJSON: Record<string, FeatureCollection> = {
  'world-borders': {
    type: 'FeatureCollection',
    features: [
      // --- North America (simplified) ---
      {
        type: 'Feature',
        properties: { name: 'North America' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [-130, 50], [-125, 55], [-120, 60], [-110, 65], [-100, 68],
            [-90, 65], [-80, 62], [-75, 58], [-70, 50], [-65, 45],
            [-70, 42], [-75, 38], [-80, 32], [-82, 28], [-85, 25],
            [-90, 28], [-95, 28], [-100, 30], [-105, 32], [-110, 32],
            [-115, 32], [-120, 35], [-125, 40], [-128, 45], [-130, 50],
          ],
        },
      },
      // --- South America (simplified) ---
      {
        type: 'Feature',
        properties: { name: 'South America' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [-80, 10], [-75, 10], [-70, 12], [-62, 10], [-55, 5],
            [-50, 0], [-48, -5], [-45, -10], [-40, -15], [-38, -20],
            [-40, -25], [-48, -28], [-52, -32], [-55, -35], [-58, -38],
            [-65, -42], [-68, -48], [-70, -52], [-72, -50], [-72, -45],
            [-70, -40], [-70, -35], [-70, -30], [-70, -25], [-70, -18],
            [-75, -12], [-78, -5], [-80, 0], [-78, 5], [-80, 10],
          ],
        },
      },
      // --- Europe (simplified) ---
      {
        type: 'Feature',
        properties: { name: 'Europe' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [-10, 36], [-8, 40], [-10, 42], [-5, 44], [0, 43],
            [3, 43], [5, 44], [8, 44], [12, 42], [15, 38],
            [18, 40], [22, 38], [25, 38], [28, 40], [30, 42],
            [32, 45], [35, 48], [30, 52], [25, 55], [20, 55],
            [18, 58], [15, 60], [10, 58], [8, 55], [5, 52],
            [2, 51], [0, 50], [-5, 48], [-8, 44], [-10, 36],
          ],
        },
      },
      // --- Africa (simplified) ---
      {
        type: 'Feature',
        properties: { name: 'Africa' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [-15, 30], [-17, 22], [-17, 15], [-15, 10], [-10, 5],
            [-5, 5], [0, 5], [5, 4], [10, 4], [10, 0],
            [12, -5], [15, -10], [20, -15], [25, -18], [30, -22],
            [32, -28], [28, -33], [22, -34], [18, -32], [15, -28],
            [12, -18], [10, -10], [10, -2], [15, 5], [20, 10],
            [25, 12], [30, 15], [32, 20], [35, 30], [32, 32],
            [28, 32], [20, 32], [10, 35], [5, 36], [0, 35],
            [-5, 35], [-10, 32], [-15, 30],
          ],
        },
      },
      // --- Asia (simplified) ---
      {
        type: 'Feature',
        properties: { name: 'Asia' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [35, 30], [40, 35], [45, 38], [50, 38], [55, 35],
            [60, 25], [65, 25], [70, 22], [75, 15], [78, 10],
            [80, 15], [85, 22], [90, 22], [95, 18], [100, 15],
            [105, 20], [110, 22], [115, 25], [120, 30], [125, 35],
            [130, 38], [135, 35], [140, 38], [142, 42], [145, 45],
            [140, 50], [135, 55], [130, 55], [120, 55], [110, 52],
            [100, 50], [90, 48], [80, 50], [70, 52], [60, 55],
            [50, 52], [45, 48], [40, 42], [35, 38], [35, 30],
          ],
        },
      },
      // --- Australia (simplified) ---
      {
        type: 'Feature',
        properties: { name: 'Australia' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [115, -20], [118, -18], [122, -15], [128, -14],
            [132, -12], [136, -12], [140, -15], [145, -15],
            [148, -18], [150, -22], [152, -25], [153, -28],
            [150, -32], [148, -35], [145, -38], [140, -38],
            [135, -35], [130, -32], [125, -32], [120, -30],
            [115, -32], [114, -28], [113, -25], [115, -20],
          ],
        },
      },
      // --- Japan (simplified) ---
      {
        type: 'Feature',
        properties: { name: 'Japan' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [130, 31], [131, 33], [132, 34], [134, 34],
            [136, 35], [138, 35], [140, 36], [141, 38],
            [140, 40], [141, 42], [142, 43], [145, 44],
            [144, 43], [143, 42], [141, 40], [140, 38],
            [139, 36], [137, 35], [135, 34], [133, 33],
            [131, 32], [130, 31],
          ],
        },
      },
      // --- UK/Ireland (simplified) ---
      {
        type: 'Feature',
        properties: { name: 'British Isles' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [-5, 50], [-3, 51], [0, 51], [1, 52], [1, 53],
            [0, 54], [-2, 55], [-3, 56], [-5, 58], [-3, 58],
            [-2, 57], [-1, 56], [0, 55], [-1, 54], [-3, 53],
            [-4, 52], [-5, 50],
          ],
        },
      },
    ],
  },
  cities: {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { name: 'New York', population: 8336817 }, geometry: { type: 'Point', coordinates: [-74.006, 40.7128] } },
      { type: 'Feature', properties: { name: 'London', population: 8982000 }, geometry: { type: 'Point', coordinates: [-0.1276, 51.5074] } },
      { type: 'Feature', properties: { name: 'Tokyo', population: 13960000 }, geometry: { type: 'Point', coordinates: [139.6917, 35.6895] } },
      { type: 'Feature', properties: { name: 'Sydney', population: 5312000 }, geometry: { type: 'Point', coordinates: [151.2093, -33.8688] } },
      { type: 'Feature', properties: { name: 'São Paulo', population: 12330000 }, geometry: { type: 'Point', coordinates: [-46.6333, -23.5505] } },
      { type: 'Feature', properties: { name: 'Cairo', population: 9540000 }, geometry: { type: 'Point', coordinates: [31.2357, 30.0444] } },
      { type: 'Feature', properties: { name: 'Mumbai', population: 12480000 }, geometry: { type: 'Point', coordinates: [72.8777, 19.076] } },
      { type: 'Feature', properties: { name: 'Beijing', population: 21540000 }, geometry: { type: 'Point', coordinates: [116.4074, 39.9042] } },
      { type: 'Feature', properties: { name: 'Moscow', population: 12680000 }, geometry: { type: 'Point', coordinates: [37.6173, 55.7558] } },
      { type: 'Feature', properties: { name: 'Buenos Aires', population: 3076000 }, geometry: { type: 'Point', coordinates: [-58.3816, -34.6037] } },
      { type: 'Feature', properties: { name: 'Shanghai', population: 24870000 }, geometry: { type: 'Point', coordinates: [121.4737, 31.2304] } },
      { type: 'Feature', properties: { name: 'Paris', population: 2161000 }, geometry: { type: 'Point', coordinates: [2.3522, 48.8566] } },
    ],
  },
};

// ---------------------------------------------------------------------------
// Interpolation helpers (moved from continentalDrift.ts)
// ---------------------------------------------------------------------------

function interpolateOffset(
  keyframes: DriftKeyframe[],
  ma: number,
): { dLng: number; dLat: number; rotation: number } {
  if (ma >= keyframes[0].ma) {
    return {
      dLng: keyframes[0].dLng,
      dLat: keyframes[0].dLat,
      rotation: keyframes[0].rotation ?? 0,
    };
  }
  if (ma <= keyframes[keyframes.length - 1].ma) {
    const last = keyframes[keyframes.length - 1];
    return { dLng: last.dLng, dLat: last.dLat, rotation: last.rotation ?? 0 };
  }

  let i = 0;
  for (; i < keyframes.length - 1; i++) {
    if (ma <= keyframes[i].ma && ma >= keyframes[i + 1].ma) break;
  }

  const a = keyframes[i];
  const b = keyframes[i + 1];
  const t = (a.ma - ma) / (a.ma - b.ma);

  return {
    dLng: a.dLng + (b.dLng - a.dLng) * t,
    dLat: a.dLat + (b.dLat - a.dLat) * t,
    rotation: (a.rotation ?? 0) + ((b.rotation ?? 0) - (a.rotation ?? 0)) * t,
  };
}

function rotateCoord(
  lng: number,
  lat: number,
  centerLng: number,
  centerLat: number,
  degrees: number,
): [number, number] {
  if (Math.abs(degrees) < 0.001) return [lng, lat];
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = lng - centerLng;
  const dy = lat - centerLat;
  return [
    centerLng + dx * cos - dy * sin,
    centerLat + dx * sin + dy * cos,
  ];
}

function centroid(coords: [number, number][]): [number, number] {
  let sumLng = 0;
  let sumLat = 0;
  for (const [lng, lat] of coords) {
    sumLng += lng;
    sumLat += lat;
  }
  return [sumLng / coords.length, sumLat / coords.length];
}

/**
 * Get the geological era for a given time (Ma).
 */
export function getEraForTime(ma: number): GeoEra {
  for (const era of GEO_ERAS) {
    if (ma >= era.endMa && ma <= era.startMa) return era;
  }
  return GEO_ERAS[GEO_ERAS.length - 1];
}

/**
 * Generate a FeatureCollection with continent outlines shifted to their
 * positions at the given geological time (Ma).
 */
export function interpolateContinents(ma: number): FeatureCollection {
  const presentDay = MOCK_GEOJSON['world-borders'];
  if (!presentDay) {
    return { type: 'FeatureCollection', features: [] };
  }

  const driftMap = new Map<string, ContinentDriftData>();
  for (const cd of CONTINENT_DRIFT) {
    driftMap.set(cd.name, cd);
  }

  const features = presentDay.features.map((feature) => {
    const name = (feature.properties as Record<string, unknown>)?.name as string | undefined;
    const drift = name ? driftMap.get(name) : undefined;

    if (!drift || feature.geometry.type !== 'LineString') {
      return feature;
    }

    const offset = interpolateOffset(drift.keyframes, ma);
    const coords = feature.geometry.coordinates as [number, number][];
    const center = centroid(coords);

    const shifted = coords.map(([lng, lat]) => {
      const [rLng, rLat] = rotateCoord(lng, lat, center[0], center[1], offset.rotation);
      return [rLng + offset.dLng, rLat + offset.dLat] as [number, number];
    });

    return {
      ...feature,
      geometry: {
        type: 'LineString' as const,
        coordinates: shifted,
      },
    };
  });

  return { type: 'FeatureCollection', features };
}

/**
 * Interpolate Napoleon's position at a given timestamp.
 */
export function interpolatePosition(timestamp: number): {
  lat: number;
  lng: number;
  location: string;
  event: string;
  campaign: string;
  date: string;
  progress: number;
} {
  const data = NAPOLEON_TRAJECTORY;

  if (timestamp <= data[0].timestamp) {
    return {
      lat: data[0].lat,
      lng: data[0].lng,
      location: data[0].location,
      event: data[0].event,
      campaign: data[0].campaign,
      date: data[0].date,
      progress: 0,
    };
  }
  if (timestamp >= data[data.length - 1].timestamp) {
    const last = data[data.length - 1];
    return {
      lat: last.lat,
      lng: last.lng,
      location: last.location,
      event: last.event,
      campaign: last.campaign,
      date: last.date,
      progress: 1,
    };
  }

  let i = 0;
  for (; i < data.length - 1; i++) {
    if (timestamp >= data[i].timestamp && timestamp < data[i + 1].timestamp) {
      break;
    }
  }

  const a = data[i];
  const b = data[i + 1];
  const t = (timestamp - a.timestamp) / (b.timestamp - a.timestamp);

  const lat = a.lat + (b.lat - a.lat) * t;
  const lng = a.lng + (b.lng - a.lng) * t;

  const nearest = t < 0.5 ? a : b;
  const progress = (timestamp - data[0].timestamp) / (data[data.length - 1].timestamp - data[0].timestamp);

  return {
    lat,
    lng,
    location: nearest.location,
    event: nearest.event,
    campaign: nearest.campaign,
    date: nearest.date,
    progress,
  };
}
