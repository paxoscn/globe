# 拿破仑轨迹时间瓦片实现

## 需求

拿破仑轨迹需要随着时间线移动，用户可以通过时间滑块查看不同时期的轨迹。

## 实现方案

采用**时间瓦片系统**：为每个航点创建一个时间瓦片，每个瓦片包含从起点到该航点的所有轨迹数据。

### 优点
- 与后端时间瓦片系统一致
- 支持时间查询和回退
- 前端可以使用统一的时间滑块控制
- 轨迹会随着时间逐步显示

### 数据结构
- **57 个时间瓦片**：对应 57 个航点（1796-03-27 到 1815-10-17）
- 每个瓦片包含：
  - 从起点到当前航点的轨迹线（LineString）
  - 所有已访问航点的标记（Point）
  - 航点属性：日期、地点、事件、战役

## 代码更改

### 1. 恢复 timelineConfig

**文件：`backend/src/seed.rs`**

```rust
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
```

### 2. 创建时间瓦片生成函数

**新增函数：**

- `seed_napoleon_tiles()`: 为每个航点创建时间瓦片
- `parse_date_to_year()`: 将日期字符串转换为小数年份
- `napoleon_geojson_up_to_index()`: 生成到指定航点的 GeoJSON

**关键逻辑：**

```rust
for (i, wp) in waypoints.iter().enumerate() {
    // 解析日期为小数年份（如 1796.235）
    let time_year = parse_date_to_year(wp.date);
    
    // 生成包含所有航点（0 到 i）的 GeoJSON
    let geojson = napoleon_geojson_up_to_index(i);
    
    // 创建瓦片
    tiles::ActiveModel {
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
}
```

### 3. 日期转换算法

将 "YYYY-MM-DD" 格式转换为小数年份：

```rust
fn parse_date_to_year(date_str: &str) -> f64 {
    let year: i32 = parts[0].parse().unwrap_or(0);
    let month: u32 = parts[1].parse().unwrap_or(1);
    let day: u32 = parts[2].parse().unwrap_or(1);
    
    // 计算年内第几天
    let day_of_year = calculate_day_of_year(year, month, day);
    let days_in_year = if is_leap_year(year) { 366.0 } else { 365.0 };
    
    year as f64 + (day_of_year as f64 - 1.0) / days_in_year
}
```

示例：
- `1796-03-27` → `1796.235`
- `1815-06-18` → `1815.462`

## 验证结果

### 1. 种子数据生成

```
Seeded Napoleon tile 1/57: 1796-03-27 (368 bytes)
Seeded Napoleon tile 11/57: 1798-07-21 (2433 bytes)
Seeded Napoleon tile 21/57: 1805-09-25 (4471 bytes)
Seeded Napoleon tile 31/57: 1808-12-04 (6481 bytes)
Seeded Napoleon tile 41/57: 1812-11-29 (8505 bytes)
Seeded Napoleon tile 51/57: 1815-03-01 (10519 bytes)
Loaded 57 Napoleon trajectory time steps
```

### 2. API 测试

#### 1796 年（开始）
```bash
curl 'http://localhost:3001/api/tiles/napoleon-trajectory/0/0/0?time_year=1796&time_fallback=1'
```
```json
{
  "actual_time_year": 1796.235,
  "geojson": {
    "features": [...]  // 2 个特征（1 条线 + 1 个点）
  }
}
```

#### 1805 年（奥斯特里茨战役）
```bash
curl 'http://localhost:3001/api/tiles/napoleon-trajectory/0/0/0?time_year=1805&time_fallback=1'
```
```json
{
  "actual_time_year": 1805.732,
  "geojson": {
    "features": [...]  // 22 个特征（1 条线 + 21 个点）
  }
}
```

#### 1815 年（滑铁卢）
```bash
curl 'http://localhost:3001/api/tiles/napoleon-trajectory/0/0/0?time_year=1815&time_fallback=1'
```
```json
{
  "actual_time_year": 1815.162,
  "geojson": {
    "features": [...]  // 52 个特征（1 条线 + 51 个点）
  }
}
```

### 3. 图层元数据

```bash
curl http://localhost:3001/api/layers
```

```json
{
  "id": "napoleon-trajectory",
  "name": "拿破仑战役轨迹 (1796–1815)",
  "lod_levels": [0],
  "object_refs": ["napoleon"],
  "timeline_config": {
    "startYear": 1796.24,
    "endYear": 1815.79,
    "formatType": "historical"
  }
}
```

## 前端行为

1. **图层管理器**：显示拿破仑轨迹图层，带有时间滑块（1796-1815）
2. **时间查询**：前端调用 `/api/tiles/napoleon-trajectory/0/0/0?time_year={year}&time_fallback=1`
3. **渐进显示**：随着时间滑块移动，轨迹逐步显示
4. **回退支持**：`time_fallback=1` 确保总能找到最近的可用瓦片

## 性能特征

- **瓦片数量**：57 个
- **瓦片大小**：368 bytes（起点）到 10,519 bytes（终点）
- **平均大小**：约 5-6 KB
- **总存储**：约 300 KB（内存数据库）

## 与海岸线图层的对比

| 特征 | 海岸线图层 | 拿破仑轨迹 |
|------|-----------|-----------|
| 时间范围 | 300 Ma - 现在 | 1796 - 1815 |
| 时间单位 | 百万年 | 年（小数） |
| 瓦片数量 | 7 | 57 |
| 瓦片大小 | 2 MB | 5 KB |
| 格式类型 | geological | historical |
| 数据类型 | 大陆边界 | 轨迹线 + 航点 |

## 后续优化（可选）

1. **瓦片压缩**：对于较大的瓦片可以使用 gzip 压缩
2. **增量更新**：只传输新增的航点，而不是完整轨迹
3. **LOD 支持**：根据缩放级别简化轨迹线
4. **缓存策略**：前端缓存已加载的时间瓦片

## 注意事项

- 后端端口是 **3001**
- 时间参数使用 `time_year`（不是 `time`）
- 必须使用 `time_fallback=1` 以支持时间回退
- 日期精度到天，转换为小数年份（如 1796.235）
