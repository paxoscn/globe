# Napoleon Trajectory 图层修复

## 问题描述

调用 `/api/tiles/napoleon-trajectory/0/0/0?time_year=2026&time_fallback=1` 时报错：

```json
{
  "error": {
    "code": "TILE_NOT_FOUND",
    "message": "Tile not found for layer 'napoleon-trajectory' at z=0, x=0, y=0"
  }
}
```

## 根本原因

`napoleon-trajectory` 图层的配置存在矛盾：

1. **图层元数据**：包含 `timelineConfig`，表示这是一个时间序列图层
2. **瓦片数据**：`time_year` 字段为 `NULL`，表示这不是时间序列瓦片

这导致：
- 前端看到 `timelineConfig`，认为这是时间序列图层，调用 API 时传递 `?time_year=` 参数
- 后端的 `get_tile_by_time_year` 函数过滤 `time_year IS NOT NULL` 的瓦片，找不到任何匹配的瓦片

## 设计考虑

拿破仑轨迹的时间信息有两种实现方式：

### 方案 A：时间瓦片（未采用）
- 为每个时间点创建独立的瓦片
- 优点：与后端时间瓦片系统一致
- 缺点：需要大量瓦片（每个航点一个），数据冗余

### 方案 B：单一瓦片 + 前端过滤（已采用）
- 所有轨迹数据存储在一个瓦片中
- 时间信息编码在 GeoJSON 特征的属性中
- 前端根据时间滑块过滤显示的特征
- 优点：数据简洁，适合连续轨迹
- 缺点：需要前端实现时间过滤逻辑

## 解决方案

移除 `napoleon-trajectory` 图层的 `timelineConfig`，使其成为普通（非时间序列）图层。

### 更改内容

**文件：`backend/src/seed.rs`**

```rust
layers::ActiveModel {
    id: Set("napoleon-trajectory".into()),
    name: Set("拿破仑战役轨迹 (1796–1815)".into()),
    description: Set("Napoleon campaign trajectory with timeline control".into()),
    group_id: Set(None),
    order_in_group: Set(0),
    created_at: Set(now),
    timeline_config: Set(None),  // 移除 timelineConfig
}
.insert(db)
.await?;
```

## 验证结果

### 1. 图层元数据
```bash
curl http://localhost:3001/api/layers
```

`napoleon-trajectory` 图层不再包含 `timeline_config` 字段：
```json
{
  "id": "napoleon-trajectory",
  "name": "拿破仑战役轨迹 (1796–1815)",
  "lod_levels": [0],
  "object_refs": ["napoleon"]
}
```

### 2. 瓦片请求（不带时间参数）
```bash
curl http://localhost:3001/api/tiles/napoleon-trajectory/0/0/0
```

成功返回：
```json
{
  "actual_time_year": null,
  "geojson": {
    "type": "FeatureCollection",
    "features": [...]  // 58 个特征
  }
}
```

### 3. 前端行为
- 前端不再为 `napoleon-trajectory` 传递 `time_year` 参数
- 图层管理器中不显示时间滑块
- 轨迹数据一次性加载，前端负责时间过滤和动画

## 后续工作

如果需要在前端实现拿破仑轨迹的时间控制：

1. **在 App.tsx 中添加时间状态**：
   ```typescript
   const [napoleonTime, setNapoleonTime] = useState<number>(Date.parse('1796-03-27'));
   ```

2. **在 GlobeRenderer 中过滤特征**：
   ```typescript
   const filteredFeatures = napoleonGeoJSON.features.filter(f => 
     Date.parse(f.properties.date) <= napoleonTime
   );
   ```

3. **添加独立的时间滑块**：
   - 不依赖 `timelineConfig`
   - 直接控制 `napoleonTime` 状态
   - 范围：1796-03-27 到 1815-10-17

## 注意事项

- 后端端口是 **3001**，不是 3000
- `napoleon-trajectory` 图层现在是普通图层，不会触发时间查询
- 时间控制需要在前端实现（如果需要的话）
