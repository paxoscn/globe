# 时间维度统一方案

## 设计原则

### 1. 统一时间坐标系统
- **所有数据使用绝对CE年份**作为统一的时间坐标
- CE年份可以是负数（公元前）或小数（精确到日期）
- 示例：
  - 300 Ma → -299,997,974 CE
  - 1815年6月18日 → 1815.46 CE

### 2. 数据存储格式

#### 2.1 Tile表的时间字段
```rust
// backend/src/entities/tiles.rs
pub struct Model {
    // ... 其他字段
    pub z: i16,              // 保留用于空间LOD
    pub time_year: Option<f64>,  // 新增：绝对CE年份（可选）
}
```

#### 2.2 Layer的timeline_config
```json
{
  "startYear": -299997974,    // 绝对CE年份（整数或小数）
  "endYear": 2026,            // 绝对CE年份
  "formatType": "geological"  // 或 "historical"
}
```

### 3. 数据迁移策略

#### 3.1 大陆漂移数据
- **当前**：z字段存储Ma值（0, 50, 100, 150, 200, 250, 300）
- **迁移后**：
  - z字段保持为0（空间LOD）
  - time_year字段存储绝对年份：
    - 0Ma → 2026
    - 50Ma → -49,997,974
    - 100Ma → -99,997,974
    - 300Ma → -299,997,974

#### 3.2 拿破仑轨迹数据
- **当前**：所有数据在单个tile（z=0），前端使用timestamp插值
- **迁移后**：
  - 可选方案A：保持单个tile，time_year=null，前端继续使用properties中的date
  - **推荐方案B**：按时间切片创建多个tiles
    - 每个关键事件一个tile
    - time_year存储精确年份（如1796.24, 1815.46）
    - 前端可以根据时间范围加载相应tiles

#### 3.3 城市数据
- 无时间维度，time_year保持为null

### 4. API变更

#### 4.1 Tile查询API
```
GET /api/tiles/{layer_id}/{z}/{x}/{y}?time_year={year}
```
- 如果layer有timeline_config，必须提供time_year参数
- 返回最接近指定时间的tile

#### 4.2 Tile列表API（新增）
```
GET /api/layers/{layer_id}/tiles?start_year={start}&end_year={end}
```
- 返回指定时间范围内的所有tiles
- 用于前端预加载和时间轴显示

### 5. 前端变更

#### 5.1 统一的时间状态
```typescript
interface LayerTimeState {
  layerId: string;
  currentYear: number;  // 统一使用绝对CE年份
  timelineConfig: TimelineConfig;
}
```

#### 5.2 时间格式化
```typescript
// 地质时间：显示为 "300 Ma (二叠纪)"
function formatGeological(year: number): string;

// 历史时间：显示为 "1815年6月18日"
function formatHistorical(year: number): string;
```

### 6. 数据库Schema变更

```sql
-- 1. 添加time_year字段
ALTER TABLE tiles ADD COLUMN time_year REAL;

-- 2. 迁移大陆漂移数据
UPDATE tiles 
SET time_year = 2026 - (z * 1000000)
WHERE layer_id = 'world-borders';

-- 3. 重置z字段为0（空间LOD）
UPDATE tiles 
SET z = 0
WHERE layer_id = 'world-borders';

-- 4. 创建索引
CREATE INDEX idx_tiles_time ON tiles(layer_id, time_year);
```

### 7. 实施步骤

1. **Phase 1: Schema变更**
   - 添加time_year字段到tiles表
   - 更新entities定义

2. **Phase 2: 数据迁移**
   - 迁移现有大陆漂移数据
   - 保持拿破仑数据不变（或按方案B切片）

3. **Phase 3: API更新**
   - 更新tile查询逻辑
   - 添加时间范围查询API

4. **Phase 4: 前端适配**
   - 更新TileLoader支持time_year参数
   - 统一时间状态管理
   - 更新UI显示

5. **Phase 5: 测试验证**
   - 验证时间查询准确性
   - 验证时间轴滑动流畅性
   - 验证格式化显示正确性

## 优势

1. **统一性**：所有时间数据使用相同的坐标系统
2. **精确性**：支持从地质时代到历史事件的任意精度
3. **可扩展性**：易于添加新的时间序列数据
4. **查询效率**：通过time_year索引快速查找
5. **前端简化**：统一的时间状态管理和插值逻辑

## 示例数据

### 大陆漂移
```json
{
  "layer_id": "world-borders",
  "z": 0,
  "x": 0,
  "y": 0,
  "time_year": -299997974,
  "geojson": { ... }
}
```

### 拿破仑轨迹（方案B）
```json
{
  "layer_id": "napoleon-trajectory",
  "z": 0,
  "x": 0,
  "y": 0,
  "time_year": 1815.4630,  // 1815年6月18日
  "geojson": {
    "type": "Feature",
    "properties": {
      "location": "Waterloo",
      "event": "滑铁卢战役"
    },
    "geometry": { ... }
  }
}
```
