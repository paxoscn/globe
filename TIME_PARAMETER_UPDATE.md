# 时间参数统一更新

## 问题描述

前端调用 `/api/tiles` 接口时使用的是旧的 `time` 参数，而后端已经更新为使用 `time_year` 参数。

## 更改内容

### 1. 后端 API 接口

后端接口已经正确实现：
- 路径：`/api/tiles/{layer_id}/{z}/{x}/{y}`
- 查询参数：`?time_year={year}&time_fallback={dir}`
- 响应格式：`{ actual_time_year: number, geojson: FeatureCollection }`

### 2. 前端 TileLoader 服务

**文件：`frontend/src/services/TileLoader.ts`**

更新了 `TileLoader` 类以支持时间序列图层：

- 在 `fetchTileWithRetry` 函数中添加了 `timeYear` 可选参数
- 当 `timeYear` 参数存在时，在 URL 中添加 `?time_year=` 查询参数
- 更新了 `loadTiles` 方法签名，添加 `timeYear` 可选参数
- 更新了 `retryTile` 方法签名，添加 `timeYear` 可选参数

**测试更新：`frontend/src/services/TileLoader.test.ts`**

- 修复了 abort signal 测试，正确传递参数顺序
- 添加了两个新测试用例：
  - 验证当提供 `timeYear` 时，URL 包含 `?time_year=` 查询参数
  - 验证当不提供 `timeYear` 时，URL 不包含时间参数

### 3. 前端 App 组件

**文件：`frontend/src/App.tsx`**

更新了主应用组件以正确传递时间参数：

1. **修复旧的 fetch 调用**（第 232 行）：
   - 从 `?time=${timeParam}` 改为 `?time_year=${timeParam}`

2. **修复响应解析**（第 235 行）：
   - 从 `actual_time` 改为 `actual_time_year`

3. **更新 TileLoader 调用**（第 268 行）：
   - 为每个启用的图层计算 `timeYear` 参数
   - 调用 `loadTiles` 时传递 `timeYear` 参数

4. **修复依赖数组**（第 271 行）：
   - 在 `handleViewportChange` 的依赖数组中添加 `currentYear`

### 4. 其他修复

**文件：`frontend/src/components/LayerManager.test.tsx`**

- 更新 `defaultProps` 函数，添加 `currentYear` 和 `onCurrentYearChange` 属性

**文件：`frontend/src/utils/geojsonRenderer.ts`**

- 移除未使用的类型导入

## 测试结果

✅ 所有 311 个前端测试通过  
✅ TypeScript 类型检查通过  
✅ 构建成功

## API 调用示例

### 非时间序列图层
```
GET /api/tiles/borders/2/1/1
```

### 时间序列图层
```
GET /api/tiles/coastlines/2/1/1?time_year=-250000000
```

响应格式：
```json
{
  "actual_time_year": -250000000,
  "geojson": {
    "type": "FeatureCollection",
    "features": [...]
  }
}
```

## 向后兼容性

- `timeYear` 参数是可选的，不会破坏现有的非时间序列图层
- 所有现有测试都已更新并通过
- API 接口保持一致，只是参数名称更新
