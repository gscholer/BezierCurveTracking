# 交互式仿真演示

本页在浏览器中直接运行 Processing 仿真程序。所有计算与渲染均在本地 Canvas 中完成，无需安装 Java 或 Processing IDE。

> **提示**：若仿真未加载，请检查浏览器是否允许运行 JavaScript，或尝试刷新页面。

<div markdown="0">
  <!-- Processing.js 运行时 -->
  <script src="https://cdn.jsdelivr.net/npm/processing-js@1.6.6/processing.min.js"></script>

  <!-- 仿真画布 -->
  <canvas id="simCanvas"
          data-processing-sources="simulation/simulation.pde"
          style="border:1px solid #ccc; max-width:100%; height:auto;">
  </canvas>
</div>

---

## 数据来源

仿真读取以下配置文件（与 `simulation/` 目录结构一致）：

- `general.txt` — 总时间步数、智能体数量、障碍物数量
- `config*.txt` — 各智能体的曲线数与预测时域
- `map*.txt` — 贝塞尔曲线地图定义
- `planner*.txt` — 规划器输出的轨迹点
- `robot*.txt` — 机器人状态序列
- `obstacles.txt` — 障碍物定义

如需更换场景，可修改上述 `.txt` 文件后刷新页面即可生效。
