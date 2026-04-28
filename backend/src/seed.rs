//! Seed the in-memory database with mock data matching the frontend's
//! `mockLayers.ts`. This gives the backend real data to serve so the
//! frontend can fetch from `/api/layers` and `/api/tiles/…` instead of
//! falling back to its local mock data.

use sea_orm::{ActiveModelTrait, DatabaseConnection, DbErr, Set};
use serde_json::json;

use crate::entities::{layers, objects, object_references, tiles};

/// Insert all mock layers, tiles, and objects into the database.
pub async fn seed(db: &DatabaseConnection) -> Result<(), DbErr> {
    seed_layers(db).await?;
    seed_tiles(db).await?;
    seed_napoleon_object(db).await?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Layers (no groups — all standalone)
// ---------------------------------------------------------------------------

async fn seed_layers(db: &DatabaseConnection) -> Result<(), DbErr> {
    let now = chrono::Utc::now();

    // world-borders: geological timeline, 300 Ma ago → present (2026 CE)
    // 300 Ma = 300_000_000 years ago → startYear = 2026 - 300_000_000 = -299_997_974
    layers::ActiveModel {
        id: Set("world-borders".into()),
        name: Set("大陆漂移 (0–300 Ma)".into()),
        description: Set("Simplified outlines of major landmasses with continental drift".into()),
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

    // cities: no timeline
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

    // napoleon-trajectory: historical timeline, 1796–1815 CE
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
// Tiles — one z=0 tile per layer with the full GeoJSON
// ---------------------------------------------------------------------------

async fn seed_tiles(db: &DatabaseConnection) -> Result<(), DbErr> {
    // World borders
    let world_borders_geojson = world_borders_geojson();
    let wb_str = serde_json::to_string(&world_borders_geojson).unwrap();
    tiles::ActiveModel {
        id: sea_orm::NotSet,
        layer_id: Set("world-borders".into()),
        z: Set(0),
        x: Set(0),
        y: Set(0),
        geojson: Set(world_borders_geojson),
        size_bytes: Set(wb_str.len() as i32),
    }
    .insert(db)
    .await?;

    // Cities
    let cities_geojson = cities_geojson();
    let c_str = serde_json::to_string(&cities_geojson).unwrap();
    tiles::ActiveModel {
        id: sea_orm::NotSet,
        layer_id: Set("cities".into()),
        z: Set(0),
        x: Set(0),
        y: Set(0),
        geojson: Set(cities_geojson),
        size_bytes: Set(c_str.len() as i32),
    }
    .insert(db)
    .await?;

    // Napoleon trajectory — store waypoints as a GeoJSON LineString + Points
    let napoleon_geojson = napoleon_geojson();
    let n_str = serde_json::to_string(&napoleon_geojson).unwrap();
    tiles::ActiveModel {
        id: sea_orm::NotSet,
        layer_id: Set("napoleon-trajectory".into()),
        z: Set(0),
        x: Set(0),
        y: Set(0),
        geojson: Set(napoleon_geojson),
        size_bytes: Set(n_str.len() as i32),
    }
    .insert(db)
    .await?;

    Ok(())
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

    // Insert a reference for each major campaign waypoint
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
// GeoJSON data builders
// ---------------------------------------------------------------------------

fn world_borders_geojson() -> serde_json::Value {
    json!({
        "type": "FeatureCollection",
        "features": [
            { "type": "Feature", "properties": { "name": "North America" }, "geometry": { "type": "LineString", "coordinates": [
                [-130,50],[-125,55],[-120,60],[-110,65],[-100,68],[-90,65],[-80,62],[-75,58],[-70,50],[-65,45],
                [-70,42],[-75,38],[-80,32],[-82,28],[-85,25],[-90,28],[-95,28],[-100,30],[-105,32],[-110,32],
                [-115,32],[-120,35],[-125,40],[-128,45],[-130,50]
            ]}},
            { "type": "Feature", "properties": { "name": "South America" }, "geometry": { "type": "LineString", "coordinates": [
                [-80,10],[-75,10],[-70,12],[-62,10],[-55,5],[-50,0],[-48,-5],[-45,-10],[-40,-15],[-38,-20],
                [-40,-25],[-48,-28],[-52,-32],[-55,-35],[-58,-38],[-65,-42],[-68,-48],[-70,-52],[-72,-50],[-72,-45],
                [-70,-40],[-70,-35],[-70,-30],[-70,-25],[-70,-18],[-75,-12],[-78,-5],[-80,0],[-78,5],[-80,10]
            ]}},
            { "type": "Feature", "properties": { "name": "Europe" }, "geometry": { "type": "LineString", "coordinates": [
                [-10,36],[-8,40],[-10,42],[-5,44],[0,43],[3,43],[5,44],[8,44],[12,42],[15,38],
                [18,40],[22,38],[25,38],[28,40],[30,42],[32,45],[35,48],[30,52],[25,55],[20,55],
                [18,58],[15,60],[10,58],[8,55],[5,52],[2,51],[0,50],[-5,48],[-8,44],[-10,36]
            ]}},
            { "type": "Feature", "properties": { "name": "Africa" }, "geometry": { "type": "LineString", "coordinates": [
                [-15,30],[-17,22],[-17,15],[-15,10],[-10,5],[-5,5],[0,5],[5,4],[10,4],[10,0],
                [12,-5],[15,-10],[20,-15],[25,-18],[30,-22],[32,-28],[28,-33],[22,-34],[18,-32],[15,-28],
                [12,-18],[10,-10],[10,-2],[15,5],[20,10],[25,12],[30,15],[32,20],[35,30],[32,32],
                [28,32],[20,32],[10,35],[5,36],[0,35],[-5,35],[-10,32],[-15,30]
            ]}},
            { "type": "Feature", "properties": { "name": "Asia" }, "geometry": { "type": "LineString", "coordinates": [
                [35,30],[40,35],[45,38],[50,38],[55,35],[60,25],[65,25],[70,22],[75,15],[78,10],
                [80,15],[85,22],[90,22],[95,18],[100,15],[105,20],[110,22],[115,25],[120,30],[125,35],
                [130,38],[135,35],[140,38],[142,42],[145,45],[140,50],[135,55],[130,55],[120,55],[110,52],
                [100,50],[90,48],[80,50],[70,52],[60,55],[50,52],[45,48],[40,42],[35,38],[35,30]
            ]}},
            { "type": "Feature", "properties": { "name": "Australia" }, "geometry": { "type": "LineString", "coordinates": [
                [115,-20],[118,-18],[122,-15],[128,-14],[132,-12],[136,-12],[140,-15],[145,-15],
                [148,-18],[150,-22],[152,-25],[153,-28],[150,-32],[148,-35],[145,-38],[140,-38],
                [135,-35],[130,-32],[125,-32],[120,-30],[115,-32],[114,-28],[113,-25],[115,-20]
            ]}},
            { "type": "Feature", "properties": { "name": "Japan" }, "geometry": { "type": "LineString", "coordinates": [
                [130,31],[131,33],[132,34],[134,34],[136,35],[138,35],[140,36],[141,38],
                [140,40],[141,42],[142,43],[145,44],[144,43],[143,42],[141,40],[140,38],
                [139,36],[137,35],[135,34],[133,33],[131,32],[130,31]
            ]}},
            { "type": "Feature", "properties": { "name": "British Isles" }, "geometry": { "type": "LineString", "coordinates": [
                [-5,50],[-3,51],[0,51],[1,52],[1,53],[0,54],[-2,55],[-3,56],[-5,58],[-3,58],
                [-2,57],[-1,56],[0,55],[-1,54],[-3,53],[-4,52],[-5,50]
            ]}}
        ]
    })
}

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

fn napoleon_geojson() -> serde_json::Value {
    let wps = napoleon_waypoints();
    let mut features: Vec<serde_json::Value> = Vec::new();

    // Full trajectory as a LineString
    let coords: Vec<serde_json::Value> = wps
        .iter()
        .map(|wp| json!([wp.lng, wp.lat]))
        .collect();
    features.push(json!({
        "type": "Feature",
        "properties": { "name": "Napoleon Trajectory" },
        "geometry": { "type": "LineString", "coordinates": coords }
    }));

    // Each waypoint as a Point
    for wp in &wps {
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
// Napoleon waypoint data
// ---------------------------------------------------------------------------

struct Waypoint {
    date: &'static str,
    lat: f64,
    lng: f64,
    location: &'static str,
    event: &'static str,
    campaign: &'static str,
}

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
