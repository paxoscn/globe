/**
 * Pure constants and utility functions for timeline display.
 *
 * These are presentation-layer constants (era colors, campaign colors,
 * year conversion helpers) — NOT mock tile data. All actual GeoJSON
 * data comes from the backend API.
 */

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
// Geological era display constants
// ---------------------------------------------------------------------------

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

export function getEraForTime(ma: number): GeoEra {
  for (const era of GEO_ERAS) {
    if (ma >= era.endMa && ma <= era.startMa) return era;
  }
  return GEO_ERAS[GEO_ERAS.length - 1];
}

// ---------------------------------------------------------------------------
// Napoleon display constants
// ---------------------------------------------------------------------------

export interface NapoleonWaypoint {
  date: string;
  timestamp: number;
  lat: number;
  lng: number;
  location: string;
  event: string;
  campaign: string;
}

function d(dateStr: string): number {
  return new Date(dateStr).getTime();
}

export const NAPOLEON_LAYER_ID = 'napoleon-trajectory';

export const NAPOLEON_TRAJECTORY: NapoleonWaypoint[] = [
  { date: '1796-03-27', timestamp: d('1796-03-27'), lat: 43.7102, lng: 7.2620, location: 'Nice', event: '就任意大利方面军总司令', campaign: '意大利战役' },
  { date: '1796-04-12', timestamp: d('1796-04-12'), lat: 44.3918, lng: 8.9460, location: 'Montenotte', event: '蒙特诺特战役胜利', campaign: '意大利战役' },
  { date: '1796-05-10', timestamp: d('1796-05-10'), lat: 45.1890, lng: 9.1580, location: 'Lodi', event: '洛迪桥之战', campaign: '意大利战役' },
  { date: '1796-08-05', timestamp: d('1796-08-05'), lat: 45.4384, lng: 10.9916, location: 'Castiglione', event: '卡斯蒂廖内战役', campaign: '意大利战役' },
  { date: '1796-11-17', timestamp: d('1796-11-17'), lat: 45.4408, lng: 11.0034, location: 'Arcole', event: '阿尔科莱桥之战', campaign: '意大利战役' },
  { date: '1797-01-14', timestamp: d('1797-01-14'), lat: 45.3520, lng: 10.8630, location: 'Rivoli', event: '里沃利战役大捷', campaign: '意大利战役' },
  { date: '1797-10-17', timestamp: d('1797-10-17'), lat: 48.8566, lng: 2.3522, location: 'Paris', event: '签署坎波福尔米奥条约，凯旋巴黎', campaign: '意大利战役' },
  { date: '1798-05-19', timestamp: d('1798-05-19'), lat: 43.2965, lng: 5.3698, location: 'Toulon', event: '率舰队从土伦出发', campaign: '埃及远征' },
  { date: '1798-06-12', timestamp: d('1798-06-12'), lat: 35.8989, lng: 14.5146, location: 'Malta', event: '攻占马耳他', campaign: '埃及远征' },
  { date: '1798-07-02', timestamp: d('1798-07-02'), lat: 31.2001, lng: 29.9187, location: 'Alexandria', event: '登陆亚历山大港', campaign: '埃及远征' },
  { date: '1798-07-21', timestamp: d('1798-07-21'), lat: 30.0131, lng: 31.2089, location: 'Cairo', event: '金字塔战役，征服开罗', campaign: '埃及远征' },
  { date: '1799-02-20', timestamp: d('1799-02-20'), lat: 31.5000, lng: 34.4667, location: 'Gaza', event: '进军叙利亚', campaign: '埃及远征' },
  { date: '1799-03-19', timestamp: d('1799-03-19'), lat: 32.9225, lng: 35.0680, location: 'Acre', event: '围攻阿克城', campaign: '埃及远征' },
  { date: '1799-08-23', timestamp: d('1799-08-23'), lat: 31.2001, lng: 29.9187, location: 'Alexandria', event: '秘密离开埃及返回法国', campaign: '埃及远征' },
  { date: '1799-10-09', timestamp: d('1799-10-09'), lat: 43.6047, lng: 3.8807, location: 'Fréjus', event: '在弗雷瑞斯登陆法国', campaign: '夺权之路' },
  { date: '1799-11-09', timestamp: d('1799-11-09'), lat: 48.8566, lng: 2.3522, location: 'Paris', event: '雾月政变，成为第一执政', campaign: '夺权之路' },
  { date: '1800-05-20', timestamp: d('1800-05-20'), lat: 45.8686, lng: 7.1706, location: 'Great St Bernard', event: '翻越大圣伯纳德山口', campaign: '第二次意大利战役' },
  { date: '1800-06-14', timestamp: d('1800-06-14'), lat: 44.8950, lng: 8.6340, location: 'Marengo', event: '马伦戈战役大捷', campaign: '第二次意大利战役' },
  { date: '1800-07-03', timestamp: d('1800-07-03'), lat: 48.8566, lng: 2.3522, location: 'Paris', event: '返回巴黎巩固权力', campaign: '第二次意大利战役' },
  { date: '1804-12-02', timestamp: d('1804-12-02'), lat: 48.8530, lng: 2.3499, location: 'Paris (Notre-Dame)', event: '加冕称帝', campaign: '帝国崛起' },
  { date: '1805-09-25', timestamp: d('1805-09-25'), lat: 48.7758, lng: 9.1829, location: 'Stuttgart', event: '大军团越过莱茵河', campaign: '奥斯特里茨战役' },
  { date: '1805-10-20', timestamp: d('1805-10-20'), lat: 48.5100, lng: 10.0900, location: 'Ulm', event: '乌尔姆战役，奥军投降', campaign: '奥斯特里茨战役' },
  { date: '1805-11-13', timestamp: d('1805-11-13'), lat: 48.2082, lng: 16.3738, location: 'Vienna', event: '占领维也纳', campaign: '奥斯特里茨战役' },
  { date: '1805-12-02', timestamp: d('1805-12-02'), lat: 49.1275, lng: 16.7600, location: 'Austerlitz', event: '奥斯特里茨战役——三皇会战大捷', campaign: '奥斯特里茨战役' },
  { date: '1806-10-14', timestamp: d('1806-10-14'), lat: 50.9270, lng: 11.5890, location: 'Jena', event: '耶拿战役，击溃普鲁士', campaign: '普鲁士战役' },
  { date: '1806-10-27', timestamp: d('1806-10-27'), lat: 52.5200, lng: 13.4050, location: 'Berlin', event: '进入柏林', campaign: '普鲁士战役' },
  { date: '1807-02-08', timestamp: d('1807-02-08'), lat: 54.3520, lng: 20.4700, location: 'Eylau', event: '艾劳战役（惨烈平局）', campaign: '波兰战役' },
  { date: '1807-06-14', timestamp: d('1807-06-14'), lat: 54.3800, lng: 20.5100, location: 'Friedland', event: '弗里德兰战役大捷', campaign: '波兰战役' },
  { date: '1807-07-07', timestamp: d('1807-07-07'), lat: 55.0833, lng: 21.8833, location: 'Tilsit', event: '签署提尔西特条约', campaign: '波兰战役' },
  { date: '1808-11-05', timestamp: d('1808-11-05'), lat: 42.8125, lng: -1.6458, location: 'Burgos', event: '亲征西班牙', campaign: '西班牙战役' },
  { date: '1808-12-04', timestamp: d('1808-12-04'), lat: 40.4168, lng: -3.7038, location: 'Madrid', event: '攻占马德里', campaign: '西班牙战役' },
  { date: '1809-04-23', timestamp: d('1809-04-23'), lat: 48.7433, lng: 11.8800, location: 'Eckmühl', event: '埃克米尔战役', campaign: '奥地利战役' },
  { date: '1809-05-13', timestamp: d('1809-05-13'), lat: 48.2082, lng: 16.3738, location: 'Vienna', event: '再次占领维也纳', campaign: '奥地利战役' },
  { date: '1809-05-22', timestamp: d('1809-05-22'), lat: 48.2000, lng: 16.5200, location: 'Aspern-Essling', event: '阿斯珀恩-埃斯灵战役（首次失利）', campaign: '奥地利战役' },
  { date: '1809-07-06', timestamp: d('1809-07-06'), lat: 48.2900, lng: 16.5600, location: 'Wagram', event: '瓦格拉姆战役大捷', campaign: '奥地利战役' },
  { date: '1812-06-24', timestamp: d('1812-06-24'), lat: 54.6872, lng: 25.2797, location: 'Vilna', event: '大军团渡过涅曼河，入侵俄国', campaign: '俄国战役' },
  { date: '1812-08-17', timestamp: d('1812-08-17'), lat: 54.7818, lng: 32.0401, location: 'Smolensk', event: '斯摩棱斯克战役', campaign: '俄国战役' },
  { date: '1812-09-07', timestamp: d('1812-09-07'), lat: 55.5167, lng: 35.8167, location: 'Borodino', event: '博罗季诺战役——惨烈的胜利', campaign: '俄国战役' },
  { date: '1812-09-14', timestamp: d('1812-09-14'), lat: 55.7558, lng: 37.6173, location: 'Moscow', event: '进入莫斯科，发现空城大火', campaign: '俄国战役' },
  { date: '1812-10-19', timestamp: d('1812-10-19'), lat: 55.7558, lng: 37.6173, location: 'Moscow', event: '被迫撤离莫斯科', campaign: '俄国战役' },
  { date: '1812-11-29', timestamp: d('1812-11-29'), lat: 54.3100, lng: 26.8300, location: 'Berezina', event: '别列津纳河渡河——大军团覆灭', campaign: '俄国战役' },
  { date: '1812-12-18', timestamp: d('1812-12-18'), lat: 48.8566, lng: 2.3522, location: 'Paris', event: '抛下残军返回巴黎', campaign: '俄国战役' },
  { date: '1813-05-02', timestamp: d('1813-05-02'), lat: 51.1913, lng: 12.1714, location: 'Lützen', event: '吕岑战役', campaign: '德意志战役' },
  { date: '1813-05-21', timestamp: d('1813-05-21'), lat: 51.1809, lng: 14.4344, location: 'Bautzen', event: '包岑战役', campaign: '德意志战役' },
  { date: '1813-08-27', timestamp: d('1813-08-27'), lat: 51.0504, lng: 13.7373, location: 'Dresden', event: '德累斯顿战役', campaign: '德意志战役' },
  { date: '1813-10-19', timestamp: d('1813-10-19'), lat: 51.3397, lng: 12.3731, location: 'Leipzig', event: '莱比锡战役——民族大会战惨败', campaign: '德意志战役' },
  { date: '1814-02-10', timestamp: d('1814-02-10'), lat: 48.2973, lng: 3.5000, location: 'Champaubert', event: '尚波贝尔战役（六日战役）', campaign: '法兰西战役' },
  { date: '1814-03-31', timestamp: d('1814-03-31'), lat: 48.8566, lng: 2.3522, location: 'Paris', event: '巴黎陷落', campaign: '法兰西战役' },
  { date: '1814-04-20', timestamp: d('1814-04-20'), lat: 47.3220, lng: 5.0415, location: 'Fontainebleau', event: '枫丹白露告别近卫军', campaign: '法兰西战役' },
  { date: '1814-05-04', timestamp: d('1814-05-04'), lat: 42.7625, lng: 10.2480, location: 'Elba', event: '流放厄尔巴岛', campaign: '第一次流放' },
  { date: '1815-03-01', timestamp: d('1815-03-01'), lat: 43.5528, lng: 7.0174, location: 'Golfe-Juan', event: '逃离厄尔巴岛，在儒安湾登陆', campaign: '百日王朝' },
  { date: '1815-03-07', timestamp: d('1815-03-07'), lat: 45.1885, lng: 5.7245, location: 'Grenoble', event: '"士兵们，向你们的皇帝开枪吧！"', campaign: '百日王朝' },
  { date: '1815-03-20', timestamp: d('1815-03-20'), lat: 48.8566, lng: 2.3522, location: 'Paris', event: '重返巴黎，路易十八出逃', campaign: '百日王朝' },
  { date: '1815-06-16', timestamp: d('1815-06-16'), lat: 50.4300, lng: 4.4500, location: 'Ligny', event: '利尼战役——最后的胜利', campaign: '百日王朝' },
  { date: '1815-06-18', timestamp: d('1815-06-18'), lat: 50.6800, lng: 4.4100, location: 'Waterloo', event: '滑铁卢战役——最终的失败', campaign: '百日王朝' },
  { date: '1815-07-15', timestamp: d('1815-07-15'), lat: 45.9400, lng: -1.1500, location: 'Rochefort', event: '向英国投降', campaign: '百日王朝' },
  { date: '1815-10-17', timestamp: d('1815-10-17'), lat: -15.9650, lng: -5.7089, location: 'St. Helena', event: '流放圣赫勒拿岛', campaign: '最终流放' },
];

export const TRAJECTORY_START = NAPOLEON_TRAJECTORY[0].timestamp;
export const TRAJECTORY_END = NAPOLEON_TRAJECTORY[NAPOLEON_TRAJECTORY.length - 1].timestamp;

/** Campaign colors for the Napoleon progress bar segments. */
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
    return { lat: data[0].lat, lng: data[0].lng, location: data[0].location, event: data[0].event, campaign: data[0].campaign, date: data[0].date, progress: 0 };
  }
  if (timestamp >= data[data.length - 1].timestamp) {
    const last = data[data.length - 1];
    return { lat: last.lat, lng: last.lng, location: last.location, event: last.event, campaign: last.campaign, date: last.date, progress: 1 };
  }

  let i = 0;
  for (; i < data.length - 1; i++) {
    if (timestamp >= data[i].timestamp && timestamp < data[i + 1].timestamp) break;
  }

  const a = data[i];
  const b = data[i + 1];
  const t = (timestamp - a.timestamp) / (b.timestamp - a.timestamp);
  const nearest = t < 0.5 ? a : b;

  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
    location: nearest.location,
    event: nearest.event,
    campaign: nearest.campaign,
    date: nearest.date,
    progress: (timestamp - data[0].timestamp) / (data[data.length - 1].timestamp - data[0].timestamp),
  };
}
