//! Seed the in-memory database with layer data.
//!
//! - Coastline data: reads GeoJSON files from `data/coastlines/{Ma}Ma.json`
//!   (sourced from GPlates Web Service, MULLER2022 model). Each file is stored
//!   as a tile with z=Ma, x=0, y=0 on the `world-borders` layer.
//! - Cities and Napoleon trajectory: inline GeoJSON.
//! - Napoleon object + waypoint references.

use sea_orm::{ActiveModelTrait, DatabaseConnection, DbErr, Set};
use serde_json::json;
use std::path::Path;

use crate::entities::{layers, objects, object_references, tiles};

/// Insert all layers, tiles, and objects into the database.
pub async fn seed(db: &DatabaseConnection) -> Result<(), DbErr> {
    seed_layers(db).await?;
    seed_coastline_tiles(db).await?;
    seed_other_tiles(db).await?;
    seed_napoleon_object(db).await?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

async fn seed_layers(db: &DatabaseConnection) -> Result<(), DbErr> {
    let now = chrono::Utc::now();

    layers::ActiveModel {
        id: Set("world-borders".into()),
        name: Set("大陆漂移 (0–300 Ma)".into()),
        description: Set("Reconstructed coastlines from GPlates (MULLER2022 model)".into()),
        group_id: Set(None),
        order_in_group: Set(0),
        created_at: Set(now),
        timeline_config: Set(Some(json!({
            "startYear": -299_997_974,
            "endYear": 2026,
            "formatType": "geological"
        }))),
    }
    .insert(db)
    .await?;

    layers::ActiveModel {
        id: Set("cities".into()),
        name: Set("Major Cities".into()),
        description: Set("Locations of major world cities".into()),
        group_id: Set(None),
        order_in_group: Set(0),
        created_at: Set(now),
        timeline_config: Set(None),
    }
    .insert(db)
    .await?;

    layers::ActiveModel {
        id: Set("napoleon-trajectory".into()),
        name: Set("拿破仑战役轨迹 (1796–1815)".into()),
        description: Set("Napoleon campaign trajectory with timeline control".into()),
        group_id: Set(None),
        order_in_group: Set(0),
        created_at: Set(now),
        timeline_config: Set(Some(json!({
            "startYear": 1796.24,
            "endYear": 1815.79,
            "formatType": "historical"
        }))),
    }
    .insert(db)
    .await?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Coastline tiles — read from data/coastlines/*.json
// Each file {Ma}Ma.json → tile with time_year = 2026 - (Ma * 1_000_000)
// ---------------------------------------------------------------------------

async fn seed_coastline_tiles(db: &DatabaseConnection) -> Result<(), DbErr> {
    let data_dir = Path::new("data/coastlines");

    if !data_dir.exists() {
        eprintln!("Warning: {} not found, skipping coastline seed", data_dir.display());
        return Ok(());
    }

    let mut entries: Vec<_> = std::fs::read_dir(data_dir)
        .map_err(|e| DbErr::Custom(format!("Failed to read coastline dir: {}", e)))?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .map(|ext| ext == "json")
                .unwrap_or(false)
        })
        .collect();

    // Sort for deterministic order
    entries.sort_by_key(|e| e.file_name());

    for entry in &entries {
        let filename = entry.file_name();
        let name = filename.to_string_lossy();

        // Parse Ma value from filename like "100Ma.json"
        let ma: i32 = name
            .trim_end_matches("Ma.json")
            .parse()
            .map_err(|_| DbErr::Custom(format!("Invalid coastline filename: {}", name)))?;

        let content = std::fs::read_to_string(entry.path())
            .map_err(|e| DbErr::Custom(format!("Failed to read {}: {}", name, e)))?;

        let geojson: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| DbErr::Custom(format!("Invalid JSON in {}: {}", name, e)))?;

        let size_bytes = content.len() as i32;

        // Convert Ma to absolute CE year: 2026 - (Ma * 1_000_000)
        let time_year = 2026.0 - (ma as f64 * 1_000_000.0);

        tiles::ActiveModel {
            id: sea_orm::NotSet,
            layer_id: Set("world-borders".into()),
            z: Set(0),  // Spatial LOD level (0 for time-series data)
            x: Set(0),
            y: Set(0),
            geojson: Set(geojson),
            size_bytes: Set(size_bytes),
            time_year: Set(Some(time_year)),
        }
        .insert(db)
        .await?;

        println!("  Seeded coastline tile: {} Ma = {} CE ({} bytes)", ma, time_year, size_bytes);
    }

    println!("  Loaded {} coastline time steps", entries.len());
    Ok(())
}

// ---------------------------------------------------------------------------
// Other tiles (cities, napoleon)
// ---------------------------------------------------------------------------

async fn seed_other_tiles(db: &DatabaseConnection) -> Result<(), DbErr> {
    // Cities (no time dimension)
    let cities = cities_geojson();
    let c_str = serde_json::to_string(&cities).unwrap();
    tiles::ActiveModel {
        id: sea_orm::NotSet,
        layer_id: Set("cities".into()),
        z: Set(0),
        x: Set(0),
        y: Set(0),
        geojson: Set(cities),
        size_bytes: Set(c_str.len() as i32),
        time_year: Set(None),
    }
    .insert(db)
    .await?;

    // Napoleon trajectory — create time-series tiles
    // Each tile contains the trajectory up to that waypoint
    seed_napoleon_tiles(db).await?;

    Ok(())
}

/// Seed Napoleon trajectory as time-series tiles.
/// Each tile contains all waypoints up to and including that time point.
async fn seed_napoleon_tiles(db: &DatabaseConnection) -> Result<(), DbErr> {
    let waypoints = napoleon_waypoints();
    
    for (i, wp) in waypoints.iter().enumerate() {
        // Parse date to get fractional year
        let time_year = parse_date_to_year(wp.date);
        
        // Build GeoJSON with all waypoints up to this point
        let geojson = napoleon_geojson_up_to_index(i);
        let geojson_str = serde_json::to_string(&geojson).unwrap();
        
        tiles::ActiveModel {
            id: sea_orm::NotSet,
            layer_id: Set("napoleon-trajectory".into()),
            z: Set(0),
            x: Set(0),
            y: Set(0),
            geojson: Set(geojson),
            size_bytes: Set(geojson_str.len() as i32),
            time_year: Set(Some(time_year)),
        }
        .insert(db)
        .await?;
        
        if i % 10 == 0 {
            println!("  Seeded Napoleon tile {}/{}: {} ({} bytes)", 
                i + 1, waypoints.len(), wp.date, geojson_str.len());
        }
    }
    
    println!("  Loaded {} Napoleon trajectory time steps", waypoints.len());
    Ok(())
}

/// Parse a date string like "1796-03-27" to a fractional year.
fn parse_date_to_year(date_str: &str) -> f64 {
    let parts: Vec<&str> = date_str.split('-').collect();
    if parts.len() != 3 {
        return 0.0;
    }
    
    let year: i32 = parts[0].parse().unwrap_or(0);
    let month: u32 = parts[1].parse().unwrap_or(1);
    let day: u32 = parts[2].parse().unwrap_or(1);
    
    // Calculate day of year
    let days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut day_of_year = day;
    for m in 0..(month - 1) as usize {
        day_of_year += days_in_month[m];
    }
    
    // Check for leap year
    let is_leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
    if is_leap && month > 2 {
        day_of_year += 1;
    }
    
    let days_in_year = if is_leap { 366.0 } else { 365.0 };
    year as f64 + (day_of_year as f64 - 1.0) / days_in_year
}

/// Build GeoJSON for Napoleon trajectory up to a specific waypoint index.
fn napoleon_geojson_up_to_index(up_to_index: usize) -> serde_json::Value {
    let all_waypoints = napoleon_waypoints();
    let waypoints = &all_waypoints[0..=up_to_index];
    
    let mut features: Vec<serde_json::Value> = Vec::new();
    
    // Add the trajectory line
    let coords: Vec<serde_json::Value> = waypoints.iter()
        .map(|wp| json!([wp.lng, wp.lat]))
        .collect();
    
    features.push(json!({
        "type": "Feature",
        "properties": { "name": "Napoleon Trajectory" },
        "geometry": { "type": "LineString", "coordinates": coords }
    }));
    
    // Add waypoint markers
    for wp in waypoints {
        features.push(json!({
            "type": "Feature",
            "properties": { 
                "name": wp.location, 
                "date": wp.date, 
                "event": wp.event, 
                "campaign": wp.campaign 
            },
            "geometry": { "type": "Point", "coordinates": [wp.lng, wp.lat] }
        }));
    }
    
    json!({ "type": "FeatureCollection", "features": features })
}

// ---------------------------------------------------------------------------
// Napoleon object + references
// ---------------------------------------------------------------------------

async fn seed_napoleon_object(db: &DatabaseConnection) -> Result<(), DbErr> {
    objects::ActiveModel {
        id: Set("napoleon".into()),
        name: Set("拿破仑·波拿巴".into()),
        description: Set("Napoleon Bonaparte (1769–1821)".into()),
    }
    .insert(db)
    .await?;

    let waypoints = napoleon_waypoints();
    for wp in &waypoints {
        object_references::ActiveModel {
            id: sea_orm::NotSet,
            object_id: Set("napoleon".into()),
            layer_id: Set("napoleon-trajectory".into()),
            latitude: Set(wp.lat),
            longitude: Set(wp.lng),
            properties: Set(json!({
                "date": wp.date,
                "location": wp.location,
                "event": wp.event,
                "campaign": wp.campaign,
            })),
        }
        .insert(db)
        .await?;
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Inline GeoJSON builders
// ---------------------------------------------------------------------------

fn cities_geojson() -> serde_json::Value {
    json!({
        "type": "FeatureCollection",
        "features": [
            { "type": "Feature", "properties": { "name": "New York", "population": 8336817 }, "geometry": { "type": "Point", "coordinates": [-74.006, 40.7128] }},
            { "type": "Feature", "properties": { "name": "London", "population": 8982000 }, "geometry": { "type": "Point", "coordinates": [-0.1276, 51.5074] }},
            { "type": "Feature", "properties": { "name": "Tokyo", "population": 13960000 }, "geometry": { "type": "Point", "coordinates": [139.6917, 35.6895] }},
            { "type": "Feature", "properties": { "name": "Sydney", "population": 5312000 }, "geometry": { "type": "Point", "coordinates": [151.2093, -33.8688] }},
            { "type": "Feature", "properties": { "name": "São Paulo", "population": 12330000 }, "geometry": { "type": "Point", "coordinates": [-46.6333, -23.5505] }},
            { "type": "Feature", "properties": { "name": "Cairo", "population": 9540000 }, "geometry": { "type": "Point", "coordinates": [31.2357, 30.0444] }},
            { "type": "Feature", "properties": { "name": "Mumbai", "population": 12480000 }, "geometry": { "type": "Point", "coordinates": [72.8777, 19.076] }},
            { "type": "Feature", "properties": { "name": "Beijing", "population": 21540000 }, "geometry": { "type": "Point", "coordinates": [116.4074, 39.9042] }},
            { "type": "Feature", "properties": { "name": "Moscow", "population": 12680000 }, "geometry": { "type": "Point", "coordinates": [37.6173, 55.7558] }},
            { "type": "Feature", "properties": { "name": "Buenos Aires", "population": 3076000 }, "geometry": { "type": "Point", "coordinates": [-58.3816, -34.6037] }},
            { "type": "Feature", "properties": { "name": "Shanghai", "population": 24870000 }, "geometry": { "type": "Point", "coordinates": [121.4737, 31.2304] }},
            { "type": "Feature", "properties": { "name": "Paris", "population": 2161000 }, "geometry": { "type": "Point", "coordinates": [2.3522, 48.8566] }}
        ]
    })
}

struct Waypoint { date: &'static str, lat: f64, lng: f64, location: &'static str, event: &'static str, campaign: &'static str }

fn napoleon_waypoints() -> Vec<Waypoint> {
    vec![
        Waypoint { date: "1796-03-27", lat: 43.7102, lng: 7.2620, location: "Nice", event: "就任意大利方面军总司令", campaign: "意大利战役" },
        Waypoint { date: "1796-04-12", lat: 44.3918, lng: 8.9460, location: "Montenotte", event: "蒙特诺特战役胜利", campaign: "意大利战役" },
        Waypoint { date: "1796-05-10", lat: 45.1890, lng: 9.1580, location: "Lodi", event: "洛迪桥之战", campaign: "意大利战役" },
        Waypoint { date: "1796-08-05", lat: 45.4384, lng: 10.9916, location: "Castiglione", event: "卡斯蒂廖内战役", campaign: "意大利战役" },
        Waypoint { date: "1796-11-17", lat: 45.4408, lng: 11.0034, location: "Arcole", event: "阿尔科莱桥之战", campaign: "意大利战役" },
        Waypoint { date: "1797-01-14", lat: 45.3520, lng: 10.8630, location: "Rivoli", event: "里沃利战役大捷", campaign: "意大利战役" },
        Waypoint { date: "1797-10-17", lat: 48.8566, lng: 2.3522, location: "Paris", event: "签署坎波福尔米奥条约", campaign: "意大利战役" },
        Waypoint { date: "1798-05-19", lat: 43.2965, lng: 5.3698, location: "Toulon", event: "率舰队从土伦出发", campaign: "埃及远征" },
        Waypoint { date: "1798-06-12", lat: 35.8989, lng: 14.5146, location: "Malta", event: "攻占马耳他", campaign: "埃及远征" },
        Waypoint { date: "1798-07-02", lat: 31.2001, lng: 29.9187, location: "Alexandria", event: "登陆亚历山大港", campaign: "埃及远征" },
        Waypoint { date: "1798-07-21", lat: 30.0131, lng: 31.2089, location: "Cairo", event: "金字塔战役", campaign: "埃及远征" },
        Waypoint { date: "1799-02-20", lat: 31.5000, lng: 34.4667, location: "Gaza", event: "进军叙利亚", campaign: "埃及远征" },
        Waypoint { date: "1799-03-19", lat: 32.9225, lng: 35.0680, location: "Acre", event: "围攻阿克城", campaign: "埃及远征" },
        Waypoint { date: "1799-08-23", lat: 31.2001, lng: 29.9187, location: "Alexandria", event: "秘密离开埃及", campaign: "埃及远征" },
        Waypoint { date: "1799-10-09", lat: 43.6047, lng: 3.8807, location: "Fréjus", event: "登陆法国", campaign: "夺权之路" },
        Waypoint { date: "1799-11-09", lat: 48.8566, lng: 2.3522, location: "Paris", event: "雾月政变", campaign: "夺权之路" },
        Waypoint { date: "1800-05-20", lat: 45.8686, lng: 7.1706, location: "Great St Bernard", event: "翻越大圣伯纳德山口", campaign: "第二次意大利战役" },
        Waypoint { date: "1800-06-14", lat: 44.8950, lng: 8.6340, location: "Marengo", event: "马伦戈战役大捷", campaign: "第二次意大利战役" },
        Waypoint { date: "1800-07-03", lat: 48.8566, lng: 2.3522, location: "Paris", event: "返回巴黎", campaign: "第二次意大利战役" },
        Waypoint { date: "1804-12-02", lat: 48.8530, lng: 2.3499, location: "Paris", event: "加冕称帝", campaign: "帝国崛起" },
        Waypoint { date: "1805-09-25", lat: 48.7758, lng: 9.1829, location: "Stuttgart", event: "越过莱茵河", campaign: "奥斯特里茨战役" },
        Waypoint { date: "1805-10-20", lat: 48.5100, lng: 10.0900, location: "Ulm", event: "乌尔姆战役", campaign: "奥斯特里茨战役" },
        Waypoint { date: "1805-11-13", lat: 48.2082, lng: 16.3738, location: "Vienna", event: "占领维也纳", campaign: "奥斯特里茨战役" },
        Waypoint { date: "1805-12-02", lat: 49.1275, lng: 16.7600, location: "Austerlitz", event: "三皇会战大捷", campaign: "奥斯特里茨战役" },
        Waypoint { date: "1806-10-14", lat: 50.9270, lng: 11.5890, location: "Jena", event: "耶拿战役", campaign: "普鲁士战役" },
        Waypoint { date: "1806-10-27", lat: 52.5200, lng: 13.4050, location: "Berlin", event: "进入柏林", campaign: "普鲁士战役" },
        Waypoint { date: "1807-02-08", lat: 54.3520, lng: 20.4700, location: "Eylau", event: "艾劳战役", campaign: "波兰战役" },
        Waypoint { date: "1807-06-14", lat: 54.3800, lng: 20.5100, location: "Friedland", event: "弗里德兰战役大捷", campaign: "波兰战役" },
        Waypoint { date: "1807-07-07", lat: 55.0833, lng: 21.8833, location: "Tilsit", event: "提尔西特条约", campaign: "波兰战役" },
        Waypoint { date: "1808-11-05", lat: 42.8125, lng: -1.6458, location: "Burgos", event: "亲征西班牙", campaign: "西班牙战役" },
        Waypoint { date: "1808-12-04", lat: 40.4168, lng: -3.7038, location: "Madrid", event: "攻占马德里", campaign: "西班牙战役" },
        Waypoint { date: "1809-04-23", lat: 48.7433, lng: 11.8800, location: "Eckmühl", event: "埃克米尔战役", campaign: "奥地利战役" },
        Waypoint { date: "1809-05-13", lat: 48.2082, lng: 16.3738, location: "Vienna", event: "再次占领维也纳", campaign: "奥地利战役" },
        Waypoint { date: "1809-05-22", lat: 48.2000, lng: 16.5200, location: "Aspern-Essling", event: "首次失利", campaign: "奥地利战役" },
        Waypoint { date: "1809-07-06", lat: 48.2900, lng: 16.5600, location: "Wagram", event: "瓦格拉姆战役大捷", campaign: "奥地利战役" },
        Waypoint { date: "1812-06-24", lat: 54.6872, lng: 25.2797, location: "Vilna", event: "入侵俄国", campaign: "俄国战役" },
        Waypoint { date: "1812-08-17", lat: 54.7818, lng: 32.0401, location: "Smolensk", event: "斯摩棱斯克战役", campaign: "俄国战役" },
        Waypoint { date: "1812-09-07", lat: 55.5167, lng: 35.8167, location: "Borodino", event: "博罗季诺战役", campaign: "俄国战役" },
        Waypoint { date: "1812-09-14", lat: 55.7558, lng: 37.6173, location: "Moscow", event: "进入莫斯科", campaign: "俄国战役" },
        Waypoint { date: "1812-10-19", lat: 55.7558, lng: 37.6173, location: "Moscow", event: "撤离莫斯科", campaign: "俄国战役" },
        Waypoint { date: "1812-11-29", lat: 54.3100, lng: 26.8300, location: "Berezina", event: "别列津纳河渡河", campaign: "俄国战役" },
        Waypoint { date: "1812-12-18", lat: 48.8566, lng: 2.3522, location: "Paris", event: "返回巴黎", campaign: "俄国战役" },
        Waypoint { date: "1813-05-02", lat: 51.1913, lng: 12.1714, location: "Lützen", event: "吕岑战役", campaign: "德意志战役" },
        Waypoint { date: "1813-05-21", lat: 51.1809, lng: 14.4344, location: "Bautzen", event: "包岑战役", campaign: "德意志战役" },
        Waypoint { date: "1813-08-27", lat: 51.0504, lng: 13.7373, location: "Dresden", event: "德累斯顿战役", campaign: "德意志战役" },
        Waypoint { date: "1813-10-19", lat: 51.3397, lng: 12.3731, location: "Leipzig", event: "莱比锡战役", campaign: "德意志战役" },
        Waypoint { date: "1814-02-10", lat: 48.2973, lng: 3.5000, location: "Champaubert", event: "六日战役", campaign: "法兰西战役" },
        Waypoint { date: "1814-03-31", lat: 48.8566, lng: 2.3522, location: "Paris", event: "巴黎陷落", campaign: "法兰西战役" },
        Waypoint { date: "1814-04-20", lat: 47.3220, lng: 5.0415, location: "Fontainebleau", event: "告别近卫军", campaign: "法兰西战役" },
        Waypoint { date: "1814-05-04", lat: 42.7625, lng: 10.2480, location: "Elba", event: "流放厄尔巴岛", campaign: "第一次流放" },
        Waypoint { date: "1815-03-01", lat: 43.5528, lng: 7.0174, location: "Golfe-Juan", event: "逃离厄尔巴岛", campaign: "百日王朝" },
        Waypoint { date: "1815-03-07", lat: 45.1885, lng: 5.7245, location: "Grenoble", event: "向皇帝开枪吧", campaign: "百日王朝" },
        Waypoint { date: "1815-03-20", lat: 48.8566, lng: 2.3522, location: "Paris", event: "重返巴黎", campaign: "百日王朝" },
        Waypoint { date: "1815-06-16", lat: 50.4300, lng: 4.4500, location: "Ligny", event: "最后的胜利", campaign: "百日王朝" },
        Waypoint { date: "1815-06-18", lat: 50.6800, lng: 4.4100, location: "Waterloo", event: "滑铁卢", campaign: "百日王朝" },
        Waypoint { date: "1815-07-15", lat: 45.9400, lng: -1.1500, location: "Rochefort", event: "向英国投降", campaign: "百日王朝" },
        Waypoint { date: "1815-10-17", lat: -15.9650, lng: -5.7089, location: "St. Helena", event: "流放圣赫勒拿岛", campaign: "最终流放" },
    ]
}
