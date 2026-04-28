# 时间参数统一 - 完整总结

## 问题历程

### 问题 1：前端使用旧参数
**现象**：前端调用 `/api/tiles` 时使用 `?time=` 参数  
**原因**：前端代码未更新为新的 `time_year` 参数  
**解决**：更新前端 `TileLoader` 和 `App.tsx`，使用 `time_year` 参数

### 问题 2：拿破仑轨迹报错
**现象**：`/api/tiles/napoleon-trajectory/0/0/0?time_year=2026` 返回 `TILE_NOT_FOUND`  
**原因**：图层有 `timelineConfig` 但瓦片没有 `time_year` 字段  
**解决**：为拿破仑轨迹创建时间瓦片系统

## 最终实现

### 1. 前端更新

#### TileLoader.ts
- 添加 `timeYear` 可选参数到 `loadTiles()` 和 `retryTile()`
- 在 URL 中添加 `?time_year=` 查询参数
- 更新测试用例

#### App.tsx
- 修复 fetch 调用：`?time=` → `?time_year=`
- 修复响应解析：`actual_time` → `actual_time_year`
- 为 TileLoader 调用传递 `timeYear` 参数
- 修复依赖数组，添加 `currentYear`

### 2. 后端更新

#### seed.rs
- 恢复 `napoleon-trajectory` 的 `timelineConfig`
- 创建 57 个时间瓦片（每个航点一个）
- 实现日期到小数年份的转换
- 每个瓦片包含从起点到该航点的完整轨迹

## API 规范

### 时间序列图层请求
```
GET /api/tiles/{layer_id}/{z}/{x}/{y}?time_year={year}&time_fallback={dir}
```

**参数：**
- `time_year`: 绝对 CE 年份（可以是小数，如 1796.235）
- `time_fallback`: 回退方向
  - `1`: 向后查找（找最近的未来时间）
  - `-1`: 向前查找（找最近的过去时间）
  - `0`: 精确匹配

**响应：**
```json
{
  "actual_time_year": 1796.235,
  "geojson": {
    "type": "FeatureCollection",
    "features": [...]
  }
}
```

### 非时间序列图层请求
```
GET /api/tiles/{layer_id}/{z}/{x}/{y}
```

**响应：**
```json
{
  "actual_time_year": null,
  "geojson": {
    "type": "FeatureCollection",
    "features": [...]
  }
}
```

## 图层配置

### 海岸线图层（地质时间）
```json
{
  "id": "world-borders",
  "name": "大陆漂移 (0–300 Ma)",
  "timeline_config": {
    "startYear": -299997974,
    "endYear": 2026,
    "formatType": "geological"
  }
}
```

### 拿破仑轨迹（历史时间）
```json
{
  "id": "napoleon-trajectory",
  "name": "拿破仑战役轨迹 (1796–1815)",
  "timeline_config": {
    "startYear": 1796.24,
    "endYear": 1815.79,
    "formatType": "historical"
  }
}
```

### 城市图层（无时间）
```json
{
  "id": "cities",
  "name": "Major Cities",
  "timeline_config": null
}
```

## 测试结果

### ✅ 前端测试
- 所有 311 个测试通过
- TypeScript 类型检查通过
- 构建成功

### ✅ 后端测试
- 海岸线图层：7 个时间瓦片（0-300 Ma）
- 拿破仑轨迹：57 个时间瓦片（1796-1815）
- 城市图层：1 个静态瓦片

### ✅ API 验证

#### 海岸线（地质时间）
```bash
curl 'http://localhost:3001/api/tiles/world-borders/0/0/0?time_year=-250000000&time_fallback=1'
# actual_time_year: -249997974 (250 Ma)
```

#### 拿破仑轨迹（历史时间）
```bash
curl 'http://localhost:3001/api/tiles/napoleon-trajectory/0/0/0?time_year=1805&time_fallback=1'
# actual_time_year: 1805.732 (奥斯特里茨战役)
# features: 22 (1 条线 + 21 个航点)
```

#### 城市（无时间）
```bash
curl 'http://localhost:3001/api/tiles/cities/0/0/0'
# actual_time_year: null
# features: 12 (12 个城市)
```

## 时间格式对比

| 图层类型 | 时间范围 | 时间单位 | 示例 |
|---------|---------|---------|------|
| 地质 | 300 Ma - 现在 | 百万年 | -249997974 (250 Ma) |
| 历史 | 1796 - 1815 | 年（小数） | 1805.732 (1805-09-25) |
| 静态 | - | - | null |

## 前端行为

1. **图层加载**：从 `/api/layers` 获取元数据
2. **时间滑块**：根据 `timelineConfig` 显示滑块
3. **瓦片请求**：
   - 有 `timelineConfig` → 传递 `time_year` 参数
   - 无 `timelineConfig` → 不传递时间参数
4. **渐进显示**：随时间滑块移动，轨迹逐步显示

## 文件清单

### 前端更改
- `frontend/src/services/TileLoader.ts` - 添加 timeYear 参数
- `frontend/src/services/TileLoader.test.ts` - 更新测试
- `frontend/src/App.tsx` - 修复 API 调用
- `frontend/src/components/LayerManager.test.tsx` - 更新测试
- `frontend/src/utils/geojsonRenderer.ts` - 清理导入

### 后端更改
- `backend/src/seed.rs` - 实现时间瓦片生成

### 文档
- `TIME_PARAMETER_UPDATE.md` - 参数更新说明
- `NAPOLEON_TRAJECTORY_FIX.md` - 拿破仑轨迹修复（已废弃）
- `NAPOLEON_TIME_TILES_IMPLEMENTATION.md` - 时间瓦片实现
- `SUMMARY.md` - 完整总结（本文档）

## 注意事项

1. **后端端口**：3001（不是 3000）
2. **参数名称**：`time_year`（不是 `time`）
3. **响应字段**：`actual_time_year`（不是 `actual_time`）
4. **回退支持**：建议总是使用 `time_fallback=1`
5. **日期精度**：历史时间精确到天，转换为小数年份

## 下一步

前端和后端的时间参数已完全统一。现在可以：

1. 启动前端开发服务器测试完整功能
2. 验证时间滑块控制拿破仑轨迹的显示
3. 测试海岸线图层的地质时间控制
4. 优化前端的时间瓦片缓存策略
