# 项目代码风格与架构准则

本文档总结本项目的代码风格与模块架构，供 AI 与开发者遵照执行，保证新功能与现有代码风格、分层一致。

---

## 一、技术栈与路径

- **框架**：Next.js（App Router）、React、TypeScript、Prisma。
- **路径别名**：使用 `@/` 指向项目根（如 `@/modules/db/client`、`@/modules/ui/jsx`），不要用相对路径跨多层目录（如 `../../../`）。
- **严格模式**：`tsconfig.json` 中 `strict: true`，类型需完整、避免 `any`。

---

## 二、模块划分与目录结构

### 2.1 业务模块位置

- 业务模块放在 **`modules/`** 下，与 `app/`、`prisma/` 平级。
- 每个模块一个目录，与其它业务平级，例如：`modules/vocabulary/`、`modules/corpus/`。

### 2.2 分层：core / ui

每个业务模块采用 **core / ui** 两层：

| 层级     | 路径                   | 职责                                         | 依赖                                             |
| -------- | ---------------------- | -------------------------------------------- | ------------------------------------------------ |
| **core** | `modules/<模块>/core/` | 领域逻辑、类型、常量、与框架无关的形态与工具 | 不依赖 React/Next；可依赖 Prisma、通用 utils     |
| **ui**   | `modules/<模块>/ui/`   | 仅做「用 core 的数据与能力做渲染和交互」     | 依赖本模块 core；可依赖 `@/modules/ui` 等共享 UI |

- **core** 内典型文件：
  - `types.ts`：接口与类型（见下文命名）
  - `constants.ts`：枚举值、选项列表等常量
  - 领域「实例形态」：如 `vocabulary.ts` 中的 `IVocabulary`，或 microbleed 中的 `Microbleed` 类——描述 UI 通过 Context 拿到的能力与数据
  - 若涉及 AI/外部 API：`ai-schema.ts`（Zod/JSON Schema）、`ai-config.ts`（配置读写）等
- **ui** 内：React 组件、Context、仅通过 **单一 Context** 注入「一个实例」（见下节），子组件用自定义 hook 取实例并调用方法。

### 2.3 模块入口与导出

- **core**：在 `core/index.ts` 中统一 `export * from "./types"` 等（或由主类文件直接导出），对外只暴露 `modules/<模块>/core` 或 `modules/<模块>/core/xxx`。
- **ui**：在 `ui/index.tsx`（或 `index.ts`）中导出 Context、hook、主要页面容器与子组件；页面只从 `modules/<模块>/ui` 引用入口组件。

---

## 三、Core 内部架构（参考 microbleed）

### 3.1 两种形态：类实例 vs 接口形态

- **类实例形态**（如 microbleed）：core 内有一个 **主领域类**（如 `Microbleed`），构造函数接收 `I*Options`，内部组合多个子域（如 `MicrobleedData`、`Controls`、`PointCreator`）；**实例由 core 的 API 层创建**（如 `api.getCreation()` 返回 `new Microbleed(...)`），UI 只负责 `useRequest(api.getCreation())` 后把实例放进 Context。
- **接口形态**（如 vocabulary）：core 内只定义 **实例形态接口**（如 `IVocabulary`），描述「状态 + 方法」；**实例由 UI 根组件用 useState/useCallback 实现**，通过 `useMemo` 成 value 传给 Provider。适合无复杂子域、以 React 状态为主的页面。

### 3.2 子域类与数据层（类实例形态时）

- **数据/状态类**（如 `MicrobleedData`）：用私有 Map/结构维护索引与数据；用 **RxJS**（`BehaviorSubject`、`Subject`）暴露流（如 `points$`、`filteredPoints$`、`filter$`）；提供命令式 API（`getPoints`、`addPoints`、`markDeletePoint`、`refreshPoints` 等）。派生状态通过 `pipe(combineLatestWith, ...)` 订阅计算后推送到新流。
- **控制/配置类**（如 `Controls`）：持有 `BehaviorSubject<IControls>`，提供 `change(params: Partial<IControls>)` 等小 API。
- **主领域类**：组合上述子域（`data`、`controls`、`pointCreator` 等），并暴露 **流**（如 `activePoint$`、`reportText$`）和 **方法**（如 `setActiveId`、`refreshPoints`、`togglePointVisibility`）；在构造函数内完成子域组装与事件订阅（如 `this.data.points$.subscribe(...)`）。

### 3.3 API 层放在 core

- 在 **core** 内可设 `api.ts`（或等价入口）：定义 **IApi** 接口（如 `getCreation()`、`save()`、`confirm()`），提供 Mock / 真实实现，按运行环境选择（如 `window.parent === window ? new Mock() : new Api()`）。
- **实例创建**：若采用类实例形态，由 **api 的 getCreation()（或等价方法）** 负责 `new 主领域类(options)` 并返回，UI 不直接 `new` 任何 core 类。
- **DTO 转换**：与后端/iframe 的入参出参转换（如 `formatPointsToApi`、`formatApiToPoints`）放在 core 的 api 或 utils，以纯函数形式导出。

### 3.4 常量与 utils

- **常量**：`DEFAULT_*` 表示默认值（如 `DEFAULT_CONTROLS`、`DEFAULT_POINT_CREATOR_PAYLOAD`）；选项列表用 `*_LIST`、`*_LABELS`、`*_COLORS` 等；复杂字面量对象/数组用 `as const`。
- **utils**：`core/utils.ts` 只放 **纯函数**；多参数用 **options 对象**（如 `IDrawRectOptions`）封装，避免长参数列表。

---

## 四、UI 架构：单一 Context + 实例形态

### 4.1 设计原则

- 页面级状态与领域能力收敛到 **一个「实例」**（可以是类实例，也可以是符合某接口的 plain object）。
- 该实例通过 **React Context** 注入；子组件 **不** 直接接很多 props，而是通过 **自定义 hook** 从 Context 取实例，读状态、调方法。

### 4.2 约定

1. **Context**：在 `ui/context.tsx` 中定义，例如 `VocabularyContext`、`createContext<IVocabulary | null>(null)`；或使用项目封装的 `createContext<T>()` 返回 `{ context, useContext: useXxx }`（保证 Provider 内必有值）。
2. **Hook**：提供 `useXxx(): IXxx`，内部 `useContext`，若为 `null` 则 `throw new Error("...")`；可选提供 `useXxxOptional(): IXxx | null` 供不在 Provider 树内的场景（如独立表单页）。
3. **实例形态**（接口形态时）：在 core 中定义接口（如 `IVocabulary`），描述「筛选条件、列表结果、分页、loading、以及 setFilter、fetchEntries、handlePageChange 等方法」。UI 根组件用 `useState`/`useCallback` 实现该接口，在根容器中 `useMemo` 成 value 传给 Provider。
4. **根容器**：主 UI 组件负责拉取/创建「实例」、挂载 `Context.Provider`、组合子组件。**类实例形态**时：用 `useRequest(api.getCreation())` 等拿到实例后再渲染 Provider 与内容（loading 期间可展示 LoadingProgress）。**接口形态**时：在根组件内直接构造符合接口的 value 并注入。
5. **子组件**：只做一件事（如 Filter 只筛、Table 只列表、Save 只保存）；通过 **useXxx()** 取实例后访问 `m.data.xxx`、`m.controls` 或调用 `m.refreshPoints()`、`m.setActiveId()` 等方法；**不**在 UI 里 `new` core 类。

### 4.3 流式状态与 React 的桥接（类实例形态 + RxJS 时）

- 若 core 暴露的是 RxJS 流（如 `m.data.filter$`、`m.activePoint$`），UI 用 **useObservable(stream$)**、**useSubscribe(stream$, callback)** 等将流接到 React；子组件只读流与调用方法，不维护一份「同步状态」的拷贝。

### 4.4 与语料库等模块对齐

- 列表类页面的「筛选 + 搜索 + 分页」交互与语料库保持一致，便于复用心智模型与后续扩展（如「记单词」）。

---

## 五、类型与命名

### 5.1 接口与枚举

- **接口**：以 **`I` 开头**，如 `IVocabularyFilter`、`IVocabularyEntryFormData`、`IMicrobleedPoint`。
- **枚举**：以 **`E` 开头**，如 `EModifyType`、`EWindowLevelMode`；枚举值用 PascalCase。

### 5.2 类型命名习惯

- **构造/配置**：主类或入口的配置用 **`I*Options`**（如 `IMicrobleedOptions`）。
- **DTO/载荷**：与 API 或子流程交换的数据用 **`I*Payload`** 或具体名（如 `IPointCreatorPayload`）；内部小参数对象也可用 `I*`（如 `IDrawRectOptions`）。

### 5.3 类型定义位置

- 领域相关类型、表单/API 入参出参、筛选条件等，一律放在 **core**，优先放在 `core/types.ts`；若某块类型较多可拆文件（如 `core/ai-schema.ts` 中的 Zod 推断类型），再在 `core/index.ts` 中导出。

### 5.4 常用形态

- **setState 风格**：若 Context 暴露「可写」状态，可定义 `SetState<T> = (value: T | ((prev: T) => T)) => void`，与 React 的 setState 签名一致。
- **列表/分页**：如 `{ items: T[]; total: number }` 表示一页数据与总数。

---

## 六、数据层与 Server Actions

### 6.1 Prisma 与表命名

- 业务表名带 **业务前缀**，便于与其它域区分，例如：`VocabularyEntry`、`VocabularyMorpheme`、`VocabularyCategory`、`VocabularyEntryMorpheme`、`VocabularyEntryPartOfSpeech`。
- 索引、唯一约束按查询与写入需求在 schema 中显式声明。

### 6.2 Server Actions

- 每个模块的 Server Actions 放在 **模块根目录** 的 `actions.ts`，即 `modules/<模块>/actions.ts`。
- 文件顶部使用 `"use server";`；只从该文件导出服务端可调用的函数；入参/返回值使用 **core** 中定义的类型（或 Prisma 生成类型），避免在 actions 里重复定义领域类型。

### 6.3 API Route

- 需要走 HTTP 的接口（如 AI 补全）放在 **`app/api/...`**，例如 `app/api/vocabulary/ai-fill/route.ts`。
- 敏感配置（baseUrl、accessToken、model）不写死在前端；可由前端从 localStorage 读配置再传给 API，或由 API 读 `process.env`。

---

## 七、路由与导航

- **路由路径** 与 **app 目录** 一致：例如路径 `/vocabulary` 对应 `app/vocabulary/page.tsx`。
- **路径名** 在 `modules/ui/pathnames.ts` 中集中定义（如 `vocabulary: () => "/vocabulary"`），导航、链接统一使用 `pathnames.xxx()`，不手写 URL 字符串。
- 导航入口在 `modules/ui/navbar.tsx` 中增加，指向上述 pathnames。

---

## 八、组件与文件约定

### 8.1 组件

- 仅需客户端的根组件加 `"use client";`；子组件若只做展示或仅用 Context，可不重复加。
- 避免在服务端组件树中混入依赖 `localStorage`、`window` 或 Leva 等仅客户端 API 的组件；可用 `useEffect` + `useState(false)` 在挂载后再渲染该部分，避免 hydration 报错。

### 8.2 样式

- 使用项目已有的 UI 体系（如 DaisyUI 的 `btn`、`alert`、`form-control` 等）和 `@/modules/ui` 下的共享组件（如 `cn`）。
- 类名保持简洁，布局优先用 Tailwind 工具类（如 `flex`、`gap-4`、`min-w-0`）。

### 8.3 注释与文档

- 对导出的接口、类型、复杂函数用 JSDoc 简要说明用途；中文注释即可。
- 模块级设计说明放在该模块的 `README.md`（如 `modules/vocabulary/README.md`），便于 AI 与新人理解「为何这样拆 core/ui、为何这样设计 Context」。

---

## 九、参考实现

- **接口形态 + React 状态**：`modules/vocabulary/`（core：types、constants、IVocabulary 形态；ui：VocabularyContext、useVocabulary、根组件内 useState/useCallback 实现接口并注入；Server Actions 在模块根 `actions.ts`）。
- **类实例形态 + RxJS**：`ai/code-style/microbleed/`（core：types、constants、MicrobleedData/Controls/PointCreator 子域类、主类 Microbleed、api.ts 的 getCreation() 创建实例；ui：useRequest(api.getCreation()) 后 Provider 注入，子组件 useMicrobleed() + useObservable(m.data.filter$) 等）。注意：`ai/` 被 tsconfig 排除，仅作风格参考，不参与构建。

---

## 十、AI 开发时的检查清单

开发或修改功能时，请自觉对照：

1. 新业务是否放在 `modules/<模块>/` 并区分 **core** / **ui**？
2. 类型是否在 core、接口是否 **I\***、枚举是否 **E\***；配置是否 **I\*Options**、DTO 是否 **I\*Payload** 等？
3. 页面级状态是否通过 **单一 Context + 一个实例形态** 提供，子组件是否用 **hook** 取实例而非层层 props？
4. 若采用类实例形态：实例是否由 **core 的 api**（如 getCreation）创建并返回，UI 是否只负责请求后注入 Context？子域（data/controls）是否用 RxJS 流暴露状态、UI 用 useObservable/useSubscribe 桥接？
5. 常量是否用 **DEFAULT\_\***、**\_LIST** 等；utils 是否纯函数、多参是否用 options 对象？
6. Server Actions 是否在 `modules/<模块>/actions.ts`、是否使用 core 类型？
7. 路由与 pathnames 是否在 `modules/ui/pathnames.ts` 和 navbar 中统一？
8. 表名是否带业务前缀、新 import 是否用 `@/` 路径？

按上述准则实现，可与现有 vocabulary、corpus 及参考风格（含 microbleed）保持一致，便于维护与 AI 后续接龙开发。
