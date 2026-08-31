# 模块一：追踪曲线动力学 + ICR 约束 — 实现细节

> 本文档基于 `include/bezier_tracking/path_planner.hpp` 和 `src/path_planner.cpp` 的源代码，对算法核心模块一的实现进行逐层拆解。模块一负责：**在离散时间环境下，模拟机器人以追踪曲线动力学追逐目标点，同时满足最小转弯半径约束**。

---

## 一、模块概述

模块一的核心任务是：给定机器人当前位姿 $(x_0, y_0, \theta_0)$ 和一个"理想机器人"（pursuee）在贝塞尔曲线上的初始参数 $\lambda$，数值模拟未来 $N$ 个时间步的追逐轨迹，并计算该轨迹的总代价。

该模块被 `tracking()` 和 `priming()` 调用，是路径规划器中最频繁执行的函数。

### 输入输出

| 输入项 | 类型 | 说明 |
|---|---|---|
| `x0, y0` | `float` | 机器人（pursuer）当前位置 |
| `theta0` | `float` | 机器人当前航向角（弧度） |
| `lambda` | `float` | 理想机器人在贝塞尔曲线上的初始参数 |

| 输出项 | 类型 | 说明 |
|---|---|---|
| `trajectory.pos` | `vector<array<float,2>>` | 未来 $N+1$ 个时间步的位置序列 |
| `trajectory.vel` | `vector<array<float,2>>` | 未来 $N+1$ 个时间步的速度序列 |
| `trajectory.total_cost` | `float` | 轨迹累积代价（距离 + 航向 + 平滑性） |

---

## 二、类结构与参数定义

### 2.1 PathPlanner 类声明（path_planner.hpp）

```cpp
class PathPlanner{
    public:
        struct Params{
            Map *map;              // 贝塞尔曲线路图
            float vel;             // 机器人恒定速度
            float r_min;           // 最小转弯半径
            float dt = 0.01;       // 采样时间（秒）
            int   horizon = 10;    // 预测时域步数
            float distance_cost = 1;  // 距离代价权重
            float heading_cost  = 1;  // 航向代价权重
            float smooth_cost   = 1;  // 平滑代价权重
            // ... 避障相关参数省略
        };

        struct Trajectory{
            std::vector<std::array<float,2>> pos,vel;
            float total_cost;
        };

        // 核心函数
        Trajectory pursuitcurve_sim(float x0, float y0, float theta0, float lambda);
        Trajectory tracking(float x0, float y0, float theta0);
        // ...

    private:
        Params params_;
        float lambda = 0;
        float theta_diff_max;  // 最大允许航向偏差角（核心约束参数）
};
```

### 2.2 关键参数初始化

在构造函数中，根据 README 中的公式计算最大允许偏转角：

$$\theta_{max} = \arctan\left(\frac{L}{R_{min}}\right) = \arctan\left(\frac{v \cdot T_s}{R_{min}}\right)$$

对应代码（`path_planner.cpp:3-5`）：

```cpp
PathPlanner::PathPlanner(Params params):params_(params){
    theta_diff_max = std::atan(params_.vel*params_.dt/params_.r_min);
}
```

**参数示例**（来自 `demo_linear_bezier.cpp`）：
- `vel = 1.0` m/s
- `r_min = 0.1` m
- `dt = 0.01` s

计算得：
$$\theta_{diff\_max} = \arctan\left(\frac{1.0 \times 0.01}{0.1}\right) = \arctan(0.1) \approx 0.0997 \text{ rad} \approx 5.71°$$

这意味着在每个 0.01 秒的控制周期内，机器人的速度方向最多可以改变约 **5.71度**。

---

## 三、辅助函数实现

### 3.1 find_angle — 带符号的向量夹角

**功能**：计算两个二维向量之间的有符号夹角。

**数学原理**：
- 通过点积计算夹角大小：$\cos\theta = \frac{\vec{a} \cdot \vec{b}}{|\vec{a}||\vec{b}|}$
- 通过叉积判断方向：$\vec{a} \times \vec{b} = a_x b_y - a_y b_x$，负值表示 $\vec{b}$ 在 $\vec{a}$ 的顺时针方向

**源码**（`path_planner.cpp:19-37`）：

```cpp
float PathPlanner::find_angle(float x1, float y1, float x2, float y2){
    double dot;
    double mag1,mag2;
    double arg;
    float angle;

    dot = (x1*x2) + (y1*y2);
    mag1 = std::sqrt(std::pow(x1,2) + std::pow(y1,2));
    mag2 = std::sqrt(std::pow(x2,2) + std::pow(y2,2));
    arg = dot/(mag1*mag2);
    arg = std::min(std::max(arg,-1.),1.);  // 防浮点误差

    angle = std::acos(arg);
    if (x1*y2 - y1*x2 < 0){  // 叉积判断方向
        angle *= -1;
    }

    return angle;
}
```

**关键细节**：
- `arg` 被钳制在 $[-1, 1]$ 范围内，防止浮点精度误差导致 `acos` 输入越界（如 `acos(1.0000001)` 会产生 NaN）；
- 返回值范围：$[-\pi, \pi]$，正值表示逆时针，负值表示顺时针。

### 3.2 rotate — 二维向量旋转

**功能**：将向量 $(x, y)$ 绕原点旋转指定角度。

**数学原理**：
$$\begin{bmatrix} x' \\ y' \end{bmatrix} = \begin{bmatrix} \cos\theta & -\sin\theta \\ \sin\theta & \cos\theta \end{bmatrix} \begin{bmatrix} x \\ y \end{bmatrix}$$

**源码**（`path_planner.cpp:39-45`）：

```cpp
void PathPlanner::rotate(float &x, float &y, float angle){
    float x_temp = x;
    float y_temp = y;

    x = std::cos(angle)*x_temp - std::sin(angle)*y_temp;
    y = std::sin(angle)*x_temp + std::cos(angle)*y_temp;
}
```

**关键细节**：
- 使用临时变量 `x_temp, y_temp` 避免覆盖后影响 `y` 的计算；
- 该函数在 ICR 约束应用中起到核心作用——将超界的速度向量"旋转"回允许范围内。

---

## 四、核心函数：pursuitcurve_sim 逐行解析

### 4.1 函数签名与变量声明

```cpp
PathPlanner::Trajectory PathPlanner::pursuitcurve_sim(
    float x0, float y0, float theta0, float lambda
)
```

**局部变量说明**：

| 变量 | 含义 |
|---|---|
| `x_lead, y_lead` | 理想机器人（pursuee）当前位置 |
| `x_follow, y_follow` | 真实机器人（pursuer）当前位置 |
| `vx_lead, vy_lead` | 理想机器人速度向量 |
| `vx_follow, vy_follow` | 真实机器人速度向量（待约束） |
| `heading_x, heading_y` | 机器人当前航向单位向量 |
| `distance` | 两机器人之间的距离 |
| `angle` | 两机器人速度向量的夹角 |
| `theta_diff` | 机器人速度向量与当前航向的夹角 |
| `angle_diff` | 实际发生的航向变化量（用于平滑性代价） |
| `lambda_vel` | 贝塞尔曲线参数变化率 $\dot{\lambda}$ |

### 4.2 初始化阶段

```cpp
trajectory.pos.clear();
trajectory.vel.clear();
trajectory.pos.resize(params_.horizon+1);
trajectory.vel.resize(params_.horizon+1);
trajectory.total_cost = 0;

x_follow = x0;
y_follow = y0;
heading_x = 1;
heading_y = 0;
rotate(heading_x, heading_y, theta0);  // 航向单位向量 = (cosθ, sinθ)
```

**注意**：`horizon+1` 的大小意味着存储从 $t=0$ 到 $t=horizon$ 共 $N+1$ 个状态点。

### 4.3 主循环结构

```cpp
for (int i = 0; i <= params_.horizon; i++){
    // Step 1: 获取理想机器人状态
    // Step 2: 计算追逐速度向量
    // Step 3: 应用 ICR 约束
    // Step 4: 计算代价
    // Step 5: 存储结果
    // Step 6: 更新状态
}
```

### 4.4 Step 1-2：获取理想机器人状态并计算追逐速度

```cpp
// 获取理想机器人在参数 lambda 处的位置
params_.map->get_point(lambda, x_lead, y_lead);

// 计算两机器人之间的距离
distance = std::sqrt(std::pow(x_lead-x_follow,2) + std::pow(y_lead-y_follow,2));

// 计算理想机器人的速度（恒定速度控制）
lambda_vel = params_.map->lambda_velocity(lambda, params_.vel);
params_.map->get_velocity(lambda, lambda_vel, vx_lead, vy_lead);

// 计算追逐速度向量
if (distance < 1e-4){
    // 距离极近时，直接采用理想机器人速度（避免除零）
    vx_follow = vx_lead;
    vy_follow = vy_lead;
    angle = 0;
}
else{
    // 追踪曲线动力学：速度向量始终指向目标
    vx_follow = params_.vel*(x_lead-x_follow)/distance;
    vy_follow = params_.vel*(y_lead-y_follow)/distance;
    // 计算两机器人速度向量的夹角（用于航向代价）
    angle = find_angle(vx_lead, vy_lead, vx_follow, vy_follow);
}
```

**数学对应**：
- 追逐速度方向：$\vec{v}_{follow} = v \cdot \frac{\vec{P}_{lead} - \vec{P}_{follow}}{|\vec{P}_{lead} - \vec{P}_{follow}|}$
- 这正是追踪曲线的核心动力学：**pursuer 的速度向量始终指向 pursuee**。

**边界处理**：当 `distance < 1e-4` 时，直接采用理想机器人速度。这是一个必要的数值稳定性处理，避免除以接近零的距离。

### 4.5 Step 3：ICR 约束 — 核心实现

这是整个模块一最关键的代码段，实现了 README 中描述的"将速度向量限制在最大允许偏转角范围内"。

```cpp
// 计算追逐速度向量与当前航向的夹角
theta_diff = find_angle(vx_follow, vy_follow, heading_x, heading_y);

if(std::abs(theta_diff) > theta_diff_max){
    // 超界：需要约束
    if(theta_diff <= 0){
        // 顺时针方向超界，逆时针旋转回边界
        rotate(vx_follow, vy_follow, theta_diff + theta_diff_max);
    }
    else{
        // 逆时针方向超界，顺时针旋转回边界
        rotate(vx_follow, vy_follow, theta_diff - theta_diff_max);
    }
    angle_diff = theta_diff_max;  // 实际航向变化 = 最大允许值
}
else{
    // 未超界：直接采用追逐速度
    angle_diff = std::abs(theta_diff);  // 实际航向变化 = 当前偏差
}

// 更新航向为（约束后的）速度方向
heading_x = vx_follow;
heading_y = vy_follow;
```

**几何解释**：

假设机器人当前航向为 $\vec{h}$，计算出的追逐速度方向为 $\vec{v}$，两者夹角为 $\theta_{diff}$。

- 若 $|\theta_{diff}| \leq \theta_{max}$：允许直接转向 $\vec{v}$；
- 若 $|\theta_{diff}| > \theta_{max}$：不允许直接转向，只能转向最接近 $\vec{v}$ 的允许方向。

允许方向的确定方法：
- 当 $\theta_{diff} > 0$（$\vec{v}$ 在 $\vec{h}$ 逆时针方向）：将 $\vec{v}$ **顺时针**旋转 $(\theta_{diff} - \theta_{max})$，使其刚好落在 $\theta_{max}$ 边界上；
- 当 $\theta_{diff} < 0$（$\vec{v}$ 在 $\vec{h}$ 顺时针方向）：将 $\vec{v}$ **逆时针**旋转 $(\theta_{diff} + \theta_{max})$，使其刚好落在 $-\theta_{max}$ 边界上。

**可视化**：

```
            v (原始追逐方向，超界)
           /
          / θ_diff (> θ_max)
         /
   h ———┘  ← 允许边界 (θ_max)
         \
          \  ← 约束后的方向 v_clamped
```

### 4.6 Step 4：代价函数计算

```cpp
trajectory.total_cost += params_.distance_cost * distance;
trajectory.total_cost += params_.heading_cost * std::abs(angle);
trajectory.total_cost += params_.smooth_cost * angle_diff;
```

| 代价项 | 数学表达 | 权重参数 | 目的 |
|---|---|---|---|
| 距离代价 | $w_1 \cdot d$ | `distance_cost` | 使机器人尽快接近理想机器人 |
| 航向代价 | $w_2 \cdot \|\angle(\vec{v}_{lead}, \vec{v}_{follow})\|$ | `heading_cost` | 使机器人航向与理想机器人一致 |
| 平滑代价 | $w_3 \cdot \|\theta_{diff\_clamped}\|$ | `smooth_cost` | 惩罚剧烈转向，优先平滑轨迹 |

**参数示例**（`demo_linear_bezier.cpp`）：
- `distance_cost = 1`
- `heading_cost = 5`（航向匹配优先级最高）
- `smooth_cost = 2`

### 4.7 Step 5-6：存储结果与状态更新

```cpp
// 存储当前状态
trajectory.pos[i][0] = x_follow;
trajectory.pos[i][1] = y_follow;
trajectory.vel[i][0] = vx_follow;
trajectory.vel[i][1] = vy_follow;

// 更新下一时刻状态（欧拉积分）
x_follow += vx_follow * params_.dt;
y_follow += vy_follow * params_.dt;
lambda   += lambda_vel * params_.dt;  // 理想机器人沿贝塞尔曲线前进
```

**注意**：
- 采用简单的**前向欧拉积分**更新位置；
- 理想机器人的参数 $\lambda$ 也同步更新，确保 pursuee 始终沿贝塞尔曲线以恒定速度前进。

---

## 五、完整控制流程图

```
输入: (x0, y0, θ0, λ)
│
├─► 初始化轨迹缓冲区、机器人状态、航向向量
│
▼
循环 i = 0 to horizon:
│
├─► 获取理想机器人位置 P_lead(λ)
│   ├─► 计算距离 d = |P_lead - P_follow|
│   ├─► 计算 λ_vel 使理想机器人保持恒定速度
│   └─► 获取理想机器人速度 v_lead
│
├─► 计算追逐速度 v_follow = v * (P_lead - P_follow) / d
│   └─► [边界处理] d < 1e-4 时，v_follow = v_lead
│
├─► 【ICR 约束】计算 θ_diff = angle(v_follow, heading)
│   ├─► |θ_diff| ≤ θ_max: 接受 v_follow
│   └─► |θ_diff| > θ_max: 将 v_follow 旋转至边界
│
├─► 计算代价: w1*d + w2*|angle(v_lead, v_follow)| + w3*|θ_diff_clamped|
│
├─► 存储 (pos, vel)
│
└─► 更新: P_follow += v_follow * dt, λ += λ_vel * dt, heading = v_follow
│
返回: trajectory (pos, vel, total_cost)
```

---

## 六、与 README 数学公式的对应关系

| README 公式 | 代码实现 | 位置 |
|---|---|---|
| $L = v \cdot T_s$ | `params_.vel * params_.dt` | 构造函数（隐式） |
| $\theta_{max} = \arctan(L / R_{min})$ | `std::atan(params_.vel*params_.dt/params_.r_min)` | 构造函数 |
| 追逐方向：速度指向目标 | `params_.vel*(x_lead-x_follow)/distance` | 主循环 |
| 贝塞尔曲线恒定速度：$\dot{\lambda}$ | `params_.map->lambda_velocity(lambda, params_.vel)` | 主循环 |
| 航向限制在 $[\theta - \theta_{max}, \theta + \theta_{max}]$ | `find_angle` + `rotate` 的组合 | ICR 约束段 |

---

## 七、关键设计决策与潜在问题

### 7.1 设计决策分析

**决策 1：使用 `heading = velocity` 而非独立的航向状态**

代码中 `heading_x = vx_follow; heading_y = vy_follow` 意味着：**机器人的航向始终等于其速度方向**。这隐含假设了机器人没有侧滑（sideslip），对于差速驱动机器人是合理的。

**决策 2：代价函数中的 `angle` 使用 `find_angle(vx_lead, vy_lead, vx_follow, vy_follow)`**

注意这里的 `angle` 是**两机器人速度向量之间的夹角**，而非机器人与理想机器人位置连线的夹角。这确保了代价函数惩罚的是"速度方向不一致"，而非简单的"位置偏离"。

**决策 3：前向欧拉积分**

位置更新采用最简单的前向欧拉法：$x_{k+1} = x_k + v_k \cdot dt$。在 $dt = 0.01$ s 且速度较低时误差可接受，但对于高速或高动态场景，应考虑 Runge-Kutta 等更高阶积分方法。

### 7.2 潜在问题与边界情况

| 问题 | 场景 | 影响 | 缓解措施 |
|---|---|---|---|
| 除零风险 | 机器人与目标点完全重合 | `distance = 0` 导致 `NaN` | 已处理：`distance < 1e-4` 时采用 `v_lead` |
| 数值积分误差 | 大步长或高速度 | 轨迹偏离真实动力学 | 减小 `dt` 或使用更高阶积分 |
| $\theta_{diff}$ 边界钳制 | `find_angle` 中的 `acos` 输入 | 浮点误差导致 `NaN` | 已处理：`arg = clamp(arg, -1, 1)` |
| 航向突变累积 | 连续多步 ICR 约束激活 | 实际轨迹与理想轨迹偏差增大 | 通过 `smooth_cost` 惩罚，但无理论保证 |

---

## 八、调用关系与上下文

### 8.1 谁在调用 pursuitcurve_sim？

```cpp
// 1. tracking() —— 每个控制周期执行的一维搜索
traj_best     = pursuitcurve_sim(x0, y0, theta0, lambda);
traj_forward  = pursuitcurve_sim(x0, y0, theta0, lambda + lambda_diff);
traj_backward = pursuitcurve_sim(x0, y0, theta0, lambda - lambda_diff);

// 2. priming() —— 初始化阶段的全局搜索
for (float lambda_test = 1; lambda_test < num_curves; lambda_test += 1){
    lambda = lambda_test;
    trajectory = tracking(x0, y0, theta0);  // 内部调用 pursuitcurve_sim
}
```

### 8.2 典型调用频率

以 `demo_linear_bezier.cpp` 为例：
- 仿真总步数：`tsteps = 350`
- 每步调用 `tracking()` 一次
- `tracking()` 内部至少调用 `pursuitcurve_sim` 3 次（当前点 + 前向搜索 + 后向搜索）
- 如果前向/后向搜索继续迭代，调用次数进一步增加
- **总计**：约 `350 × 3 = 1050` 次以上，每次模拟 `horizon = 150` 步

这意味着 `pursuitcurve_sim` 是性能瓶颈，其内部的数值计算效率直接影响实时性。

---

## 九、小结

模块一的实现体现了"简洁即美"的设计哲学：

1. **追踪曲线动力学**仅用两行代码实现（指向目标的速度向量）；
2. **ICR 约束**通过 `find_angle` + `rotate` 的组合优雅地编码了最小转弯半径限制；
3. **代价函数**三项（距离、航向、平滑）提供了足够的表达能力来评估轨迹质量。

其核心创新在于将**纯追踪的几何直觉**、**追踪曲线的收敛理论**和**ICR 的物理约束**无缝融合，形成一个无需复杂优化的反应式轨迹生成器。

**最值得关注的技术细节**：
- `theta_diff_max` 的预计算使得约束检查变为简单的数值比较，避免了每步重复计算三角函数；
- `rotate` 函数的巧妙使用将"钳制角度"转化为"旋转向量"，代码简洁且几何意义明确；
- 距离阈值 `1e-4` 的边界处理是必要的数值稳定性措施。
