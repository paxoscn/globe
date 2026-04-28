# 时间维度统一实施总结

## 已完成的更改

### 1. 数据库Schema更新

#### backend/src/entities/tiles.rs
- ✅ 添加 `time_year: Option<f64>` 字段
- ✅ 添加字段注释说明用途
- ✅ 将 `z` 字段注释更新为"空间LOD级别"

#### backend/src/schema.rs
- ✅ 添加 `idx_tiles_layer_time` 索引用于 `(layer_id, time_year)` 查询优化

### 2. 数据种子更新

#### backend/src/seed.rs
- ✅ **大陆漂移数据**：
  - 将Ma值转换为绝对CE年份：`time_year = 2026 - (Ma * 1_000_000)`
  - z字段统一设置为0（空间LOD）
  - 示例：300Ma → time_year = -299,997,974
  
- ✅ **城市数据**：
  - time_year设置为None（无时间维度）
  
- ✅ **拿破仑轨迹数据**：
  - time_year设置为None（时间信息保留在feature properties中）
  - 保持单个tile存储所有数据的方式

### 3. API更新

#### backend/src/routes/mod.rs
- ✅ 更新 `TileQuery` 结构：
  - `time` → `time_year: Option<f64>`
  - 支持绝对CE年份查询（可以是负数或小数）
  
- ✅ 更新 `get_tile` 路由处理器：
  - 支持 `?time_year={year}` 查询参数
  - 返回 `actual_time_year` 而不是 `actual_time`

#### backend/src/services/tile_service.rs
- ✅ 更新 `TileResult` 结构：
  - `actual_time: i32` → `actual_time_year: Option<f64>`
  
- ✅ 添加 `get_tile_by_time_year` 函数：
  - 支持按time_year查询tiles
  - 支持epsilon容差（0.001年 ≈ 8小时）用于浮点数比较
  - 支持fallback查询（向前/向后查找最近的tile）
  
- ✅ 更新 `get_tile` 函数：
  - 返回tile的time_year值
  
- ✅ 删除旧的 `get_tile_with_time` 函数（已被新函数替代）

### 4. 编译验证
- ✅ 代码编译通过
- ✅ 清理未使用的导入

## 数据格式示例

### 大陆漂移 Tile
```json
{
  "layer_id": "world-borders",
  "z": 0,
  "x": 0,
  "y": 0,
  "time_year": -299997974.0,
  "geojson": { ... }
}
```

### 城市 Tile
```json
{
  "layer_id": "cities",
  "z": 0,
  "x": 0,
  "y": 0,
  "time_year": null,
  "geojson": { ... }
}
```

### 拿破仑轨迹 Tile
```json
{
  "layer_id": "napoleon-trajectory",
  "z": 0,
  "x": 0,
  "y": 0,
  "time_year": null,
  "geojson": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "properties": {
          "date": "1815-06-18",
          "location": "Waterloo",
          "event": "滑铁卢战役"
        },
        "geometry": { ... }
      }
    ]
  }
}
```

## API使用示例

### 查询大陆漂移数据（300 Ma）
```
GET /api/tiles/world-borders/0/0/0?time_year=-299997974
```

响应：
```json
{
  "actual_time_year": -299997974.0,
  "geojson": { ... }
}
```

### 查询最接近的时间点（带fallback）
```
GET /api/tiles/world-borders/0/0/0?time_year=-150000000&time_fallback=1
```

如果没有精确匹配-150Ma，返回最接近的更新的时间点（如-100Ma）。

### 查询无时间维度的数据
```
GET /api/tiles/cities/0/0/0
```

响应：
```json
{
  "actual_time_year": null,
  "geojson": { ... }
}
```

## 前端需要的更新

### 1. 类型定义更新
需要更新 `frontend/src/types/index.ts`：
- TileCoord 可能需要添加 time_year 字段
- API响应类型需要更新为 actual_time_year

### 2. TileLoader更新
需要更新 `frontend/src/services/TileLoader.ts`：
- 支持在请求URL中添加 `?time_year=` 参数
- 处理 actual_time_year 响应字段

### 3. 时间状态管理
需要统一的时间状态管理：
```typescript
interface LayerTimeState {
  layerId: string;
  currentYear: number;  // 统一使用绝对CE年份
  timelineConfig: TimelineConfig;
}
```

### 4. 时间格式化函数
需要实现两种格式化函数：
- `formatGeological(year: number)`: "300 Ma (二叠纪)"
- `formatHistorical(year: number)`: "1815年6月18日"

## 优势总结

1. **统一性**：所有时间数据使用相同的绝对CE年份坐标系统
2. **精确性**：支持从地质时代（负数百万年）到历史事件（小数年份）的任意精度
3. **可扩展性**：易于添加新的时间序列数据
4. **查询效率**：通过 time_year 索引快速查找
5. **向后兼容**：保留了 z/x/y 坐标系统用于空间LOD

## 测试建议

1. **单元测试**：
   - 测试 time_year 查询的精确匹配
   - 测试 fallback 查询（向前/向后）
   - 测试 epsilon 容差

2. **集成测试**：
   - 测试大陆漂移数据的时间查询
   - 测试城市数据（无时间维度）
   - 测试拿破仑数据

3. **性能测试**：
   - 验证 time_year 索引的查询性能
   - 测试大量时间点的查询效率

## 下一步工作

1. ✅ 后端Schema和API更新（已完成）
2. ⏳ 前端类型定义更新
3. ⏳ 前端TileLoader更新
4. ⏳ 前端时间状态管理统一
5. ⏳ 前端时间格式化实现
6. ⏳ 端到端测试
7. ⏳ 文档更新
