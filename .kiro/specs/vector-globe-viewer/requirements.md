# Requirements Document

## Introduction

本文档定义了一个交互式透明球体可视化应用的需求。该应用采用 React 前端与 Rust (Axum + SeaORM) 后端架构，支持矢量分层数据的渲染、叠加与增量加载。用户可在球体上浏览多层矢量地理数据，支持缩放、旋转、分层切换等交互操作，并适配桌面与移动端。

## Glossary

- **Globe_Renderer**: 负责在前端渲染透明球体并处理用户交互的核心组件
- **Layer**: 一个矢量数据分层，包含特定主题的地理数据（如海岸线、国界等）
- **Layer_Group**: 一组相关的分层集合，用户可在组内滑动切换不同分层（如不同历史时期的海岸线）
- **Layer_Manager**: 管理分层和分层组的加载、显示、叠加与切换的前端模块
- **Tile_Service**: 后端服务，负责根据视野范围和缩放级别提供对应精细度的矢量瓦片数据
- **Viewport**: 当前用户可见的球体区域，由旋转姿态和缩放级别决定
- **LOD (Level of Detail)**: 细节层级，根据缩放级别决定矢量数据的简化程度
- **Quaternion_Rotation**: 基于四元数的旋转方式，避免万向节锁（Gimbal Lock）问题
- **Memory_Manager**: 负责管理前端矢量数据缓存，及时释放不在视野内的数据以节省内存
- **Object**: 分层数据中引用的实体（如人物、事件、地标等），具有可随分层变化的属性值（如经纬度位置）
- **Object_Reference**: 分层中对某个 Object 的引用记录，包含该 Object 在该分层中的属性值
- **Keyframe**: 关键帧，记录某个 Object 在特定分层中的属性值快照，用于插值计算
- **Transition_Engine**: 负责在分层组切换时，对同一 Object 在相邻分层间的属性值进行插值计算并驱动过渡动画的模块

## Requirements

### Requirement 1: 透明球体渲染

**User Story:** 作为用户，我希望在界面上看到一个透明球体，以便在其上浏览矢量地理数据。

#### Acceptance Criteria

1. THE Globe_Renderer SHALL 在页面加载完成后渲染一个具有透明效果的三维球体
2. THE Globe_Renderer SHALL 在球体表面显示经纬度网格作为参考
3. THE Globe_Renderer SHALL 保持球体渲染帧率不低于 30fps

### Requirement 2: 球体旋转交互

**User Story:** 作为用户，我希望能够自由旋转球体查看任意方向，以便浏览全球各区域的数据。

#### Acceptance Criteria

1. WHEN 用户在桌面端拖拽球体时, THE Globe_Renderer SHALL 使用 Quaternion_Rotation 实现球体的全向旋转
2. WHEN 用户在移动端单指滑动球体时, THE Globe_Renderer SHALL 使用 Quaternion_Rotation 实现球体的全向旋转
3. THE Globe_Renderer SHALL 在旋转经过极点区域时保持平滑连续运动，不产生卡顿或锁定
4. WHEN 用户释放拖拽操作时, THE Globe_Renderer SHALL 根据释放时的速度施加惯性旋转效果

### Requirement 3: 缩放交互

**User Story:** 作为用户，我希望能够缩放球体以查看不同精细度的数据。

#### Acceptance Criteria

1. WHEN 用户在桌面端滚动鼠标滚轮时, THE Globe_Renderer SHALL 平滑缩放球体视图
2. WHEN 用户在移动端双指捏合时, THE Globe_Renderer SHALL 平滑缩放球体视图
3. THE Globe_Renderer SHALL 将缩放范围限制在预定义的最小值与最大值之间
4. WHEN 缩放级别变化时, THE Tile_Service SHALL 提供与当前缩放级别匹配的 LOD 数据

### Requirement 4: 视图重置

**User Story:** 作为用户，我希望能够快速将球体恢复到默认视角和缩放，以便重新开始浏览。

#### Acceptance Criteria

1. THE Globe_Renderer SHALL 提供一个"回正"按钮，在界面上始终可见
2. WHEN 用户点击"回正"按钮时, THE Globe_Renderer SHALL 以平滑动画将球体旋转恢复到默认朝向
3. THE Globe_Renderer SHALL 提供一个"重置缩放"按钮，在界面上始终可见
4. WHEN 用户点击"重置缩放"按钮时, THE Globe_Renderer SHALL 以平滑动画将缩放恢复到默认值

### Requirement 5: 分层与分层组管理

**User Story:** 作为用户，我希望能够管理多个数据分层和分层组，以便灵活查看不同主题和时期的数据。

#### Acceptance Criteria

1. THE Layer_Manager SHALL 在侧边栏中显示所有可用的 Layer 和 Layer_Group 列表
2. WHEN 用户启用某个 Layer 时, THE Layer_Manager SHALL 将该分层的矢量数据叠加显示在球体上
3. WHEN 用户禁用某个 Layer 时, THE Layer_Manager SHALL 从球体上移除该分层的显示并释放相关数据
4. THE Layer_Manager SHALL 支持同时叠加显示多个已启用的 Layer
5. WHEN 一个 Layer_Group 被展开时, THE Layer_Manager SHALL 显示一个滑块控件用于在组内各分层间切换
6. WHEN 用户拖动 Layer_Group 的滑块时, THE Layer_Manager SHALL 切换显示对应位置的分层数据

### Requirement 6: 矢量数据增量加载

**User Story:** 作为用户，我希望数据能够按需加载，以便获得流畅的浏览体验而无需等待全部数据下载。

#### Acceptance Criteria

1. WHEN Viewport 发生变化时, THE Tile_Service SHALL 仅返回当前视野范围内的矢量瓦片数据
2. THE Tile_Service SHALL 根据当前缩放级别选择对应 LOD 的简化矢量数据
3. WHEN 前端请求矢量瓦片时, THE Tile_Service SHALL 以增量方式传输数据，优先传输视野中心区域的瓦片
4. IF Tile_Service 返回错误, THEN THE Layer_Manager SHALL 显示加载失败提示并提供重试选项

### Requirement 7: 多精细度支持

**User Story:** 作为用户，我希望在不同缩放级别下看到不同精细度的数据，以便在宏观和微观视角间平衡性能与细节。

#### Acceptance Criteria

1. THE Tile_Service SHALL 为每个 Layer 维护至少 3 个 LOD 级别的矢量数据
2. WHEN 缩放级别跨越 LOD 阈值时, THE Globe_Renderer SHALL 平滑过渡到新精细度的数据显示
3. THE Tile_Service SHALL 使用矢量简化算法（如 Douglas-Peucker）生成低精细度数据

### Requirement 8: 内存管理与数据释放

**User Story:** 作为用户，我希望应用在移动设备上也能流畅运行，不会因内存占用过高而崩溃。

#### Acceptance Criteria

1. WHEN 矢量瓦片离开 Viewport 超过预定义时间阈值时, THE Memory_Manager SHALL 释放该瓦片的内存
2. THE Memory_Manager SHALL 将前端矢量数据缓存总量限制在预定义的内存上限内
3. WHEN 缓存达到内存上限时, THE Memory_Manager SHALL 按照 LRU（最近最少使用）策略淘汰瓦片数据
4. WHILE 设备为移动端时, THE Memory_Manager SHALL 使用更低的内存上限阈值

### Requirement 9: 响应式布局适配

**User Story:** 作为用户，我希望在手机和电脑上都能正常使用该应用。

#### Acceptance Criteria

1. THE Globe_Renderer SHALL 根据设备屏幕尺寸自适应调整球体渲染区域大小
2. WHILE 设备为移动端时, THE Layer_Manager SHALL 将分层控制面板折叠为可展开的底部抽屉
3. WHILE 设备为桌面端时, THE Layer_Manager SHALL 将分层控制面板显示为侧边栏
4. THE Globe_Renderer SHALL 支持触摸手势（单指旋转、双指缩放）和鼠标操作（拖拽旋转、滚轮缩放）

### Requirement 10: 后端矢量数据存储与查询

**User Story:** 作为开发者，我希望后端能高效存储和查询矢量数据，以便快速响应前端的瓦片请求。

#### Acceptance Criteria

1. THE Tile_Service SHALL 使用 SeaORM 管理矢量数据的持久化存储
2. WHEN 收到瓦片请求时, THE Tile_Service SHALL 在 200ms 内返回对应的矢量数据
3. THE Tile_Service SHALL 支持按空间范围和 LOD 级别进行索引查询
4. THE Tile_Service SHALL 以 GeoJSON 或等效紧凑格式传输矢量数据

### Requirement 11: 分层组切换时的物体关键帧过渡效果

**User Story:** 作为用户，我希望在分层组内滑动切换分层时，同一物体能在不同位置和属性之间平滑过渡，以便直观感受物体随时间或条件变化的轨迹。

#### Acceptance Criteria

1. THE Layer_Manager SHALL 在加载 Layer_Group 时解析每个 Layer 中包含的 Object_Reference 列表
2. WHEN 用户在 Layer_Group 内滑动切换分层时, THE Transition_Engine SHALL 识别相邻分层中引用的同一 Object
3. WHEN 同一 Object 在相邻两个分层中具有不同属性值时, THE Transition_Engine SHALL 为该 Object 建立 Keyframe 序列
4. WHILE 用户正在拖动 Layer_Group 滑块时, THE Transition_Engine SHALL 根据滑块位置对相邻 Keyframe 之间的属性值进行线性插值
5. THE Transition_Engine SHALL 对 Object 的经纬度位置属性使用球面线性插值（Slerp）以确保地理路径的自然过渡
6. WHEN 滑块位置恰好对齐某个分层时, THE Transition_Engine SHALL 精确显示该分层中 Object 的原始属性值，不进行插值
7. IF 某个 Object 仅存在于 Layer_Group 中的部分分层, THEN THE Transition_Engine SHALL 在该 Object 不存在的分层边界处执行淡入或淡出动画
8. THE Transition_Engine SHALL 在属性插值过程中保持渲染帧率不低于 30fps
