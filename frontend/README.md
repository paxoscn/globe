# Vector Globe Viewer — 前端

交互式透明球体矢量数据可视化应用的前端部分。基于 React + TypeScript + Three.js（react-three-fiber）构建。

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 运行测试
npm run test
```

开发服务器默认运行在 `http://localhost:5173`。需要后端服务（默认 `http://localhost:3001`）提供数据支持。

## 操作说明

### 球体旋转

| 操作 | 桌面端 | 移动端 |
|------|--------|--------|
| 旋转球体 | 鼠标左键拖拽 | 单指滑动 |
| 惯性旋转 | 拖拽后松开，球体会沿释放方向继续旋转并逐渐停止 | 同左 |

旋转基于四元数（Quaternion）实现，经过极点区域时不会出现卡顿或锁定。

### 缩放

| 操作 | 桌面端 | 移动端 |
|------|--------|--------|
| 放大 | 鼠标滚轮向上 | 双指张开 |
| 缩小 | 鼠标滚轮向下 | 双指捏合 |

缩放范围限制在预设的最小值与最大值之间，缩放过程带有平滑动画。缩放级别变化时，矢量数据会自动切换到对应精细度（LOD）。

### 视图重置

界面右上角提供两个按钮：

- **回正** — 将球体旋转恢复到默认朝向（平滑动画过渡）
- **重置缩放** — 将缩放恢复到默认级别（平滑动画过渡）

### 分层管理

分层控制面板在桌面端显示为右侧边栏，在移动端显示为底部可展开抽屉（点击拖拽手柄展开/收起）。

- **启用/禁用分层** — 点击分层名称旁的开关，启用后该分层的矢量数据会叠加显示在球体上
- **多分层叠加** — 可同时启用多个分层，数据会叠加渲染
- **分层组** — 点击分层组名称展开，查看组内各分层

### 分层组滑块

展开分层组后，组内显示一个滑块控件：

- 拖动滑块可在组内各分层之间平滑切换
- 同一物体在不同分层中的位置会通过球面插值（Slerp）平滑过渡
- 数值属性通过线性插值过渡，文字属性在中间点切换
- 仅存在于部分分层的物体会在边界处淡入/淡出

### 数据加载

- 矢量瓦片按需加载，优先加载视野中心区域的瓦片
- 已加载的瓦片会缓存在内存中（桌面端上限 256MB，移动端 128MB）
- 离开视野的瓦片在超时后自动释放
- 加载失败时显示错误提示，支持重试

## 技术栈

| 技术 | 用途 |
|------|------|
| React 19 | UI 框架 |
| TypeScript | 类型安全 |
| react-three-fiber | Three.js 的 React 声明式绑定 |
| Three.js | 3D 渲染引擎 |
| Vite | 构建工具与开发服务器 |
| Vitest + fast-check | 单元测试与属性测试 |

## 项目结构

```
src/
├── components/          # React 组件
│   ├── GlobeRenderer.tsx    # 透明球体渲染（自定义 Shader）
│   ├── LayerManager.tsx     # 分层管理面板
│   ├── ViewControls.tsx     # 视图重置按钮
│   └── Layout.tsx           # 响应式布局
├── hooks/               # React Hooks
│   ├── useArcballRotation.ts  # 四元数旋转 + 惯性
│   ├── useZoom.ts             # 缩放交互
│   └── useLayerState.ts       # 分层状态管理
├── services/            # 业务逻辑
│   ├── MemoryManager.ts       # LRU 瓦片缓存
│   ├── TileLoader.ts          # 瓦片加载与优先级排序
│   └── TransitionEngine.ts    # 关键帧插值引擎
├── utils/               # 工具函数
│   ├── lodMapping.ts          # 缩放到 LOD 映射
│   ├── viewportTiles.ts       # 视口到瓦片坐标计算
│   ├── geojsonRenderer.ts     # GeoJSON 解析与球面渲染
│   └── slerp.ts               # 球面线性插值
├── types/               # TypeScript 类型定义
│   ├── index.ts
│   └── geojson.ts
├── App.tsx              # 根组件
└── main.tsx             # 入口文件
```
