// ==================== DormMate C01 M5 · MQTT 监控面板 ====================

// —— M1 环境状态判定规则（前端自动计算，不使用 MQTT 传来的 status）——
function getStatus(temperature, humidity) {
  if (temperature < 18) return "偏冷";
  if (temperature >= 30) return "偏热";
  if (humidity >= 75) return "偏湿";
  return "正常";
}

// 状态 → 颜色 class（正常绿 / 偏热橙 / 偏湿蓝 / 偏冷青）
function statusClass(status) {
  switch (status) {
    case "正常": return "status-normal";
    case "偏热": return "status-hot";
    case "偏湿": return "status-wet";
    case "偏冷": return "status-cold";
    default: return "status-normal";
  }
}

// 合法节点列表
const NODE_IDS = ["dorm-a", "dorm-b", "dorm-c"];

// 三个节点各自独立保存当前值 + 历史趋势
const nodes = {
  "dorm-a": { current: null, history: [] },
  "dorm-b": { current: null, history: [] },
  "dorm-c": { current: null, history: [] },
};

// 当前选中节点（决定图表展示哪个宿舍）
let selectedNode = "dorm-a";

// —— DOM 元素 ——
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const noticeEl = document.getElementById("notice");
const nodeSelect = document.getElementById("nodeSelect");
const historyList = document.getElementById("historyList");
const historyEmpty = document.getElementById("historyEmpty");

// —— MQTT 连接（WebSocket）——
const client = mqtt.connect("ws://127.0.0.1:9001", {
  reconnectPeriod: 4000, // 断线自动重连间隔
  clientId: "dormmate-dashboard-" + Math.random().toString(16).slice(2),
});

// 更新连接状态：绿=已连接 / 黄=重连中 / 红=断开或失败
function setStatus(text, type) {
  statusText.textContent = text;
  statusDot.className = "dot " + type;
}

// 页面错误提示
function setNotice(text) {
  noticeEl.textContent = text;
}
function clearNotice() {
  noticeEl.textContent = "";
}

// 更新某节点卡片
function updateCard(nodeId, record) {
  const card = document.querySelector('.node-card[data-node="' + nodeId + '"]');
  card.querySelector(".node-temp").textContent = record.temperature;
  card.querySelector(".node-humid").textContent = record.humidity;

  const statusEl = card.querySelector(".node-status");
  statusEl.textContent = record.status;
  statusEl.className = "node-status " + statusClass(record.status);
}

// 追加一条历史记录（不删除旧项，全部保留）
function addHistoryItem(record) {
  historyEmpty.style.display = "none";

  const li = document.createElement("li");

  const time = document.createElement("span");
  time.className = "history-time";
  time.textContent = record.time;

  const node = document.createElement("span");
  node.className = "history-node";
  node.textContent = record.nodeId;

  const metrics = document.createElement("span");
  metrics.textContent = record.temperature + "℃ | " + record.humidity + "%";

  const status = document.createElement("span");
  status.className = "history-status " + statusClass(record.status);
  status.textContent = record.status;

  li.appendChild(time);
  li.appendChild(node);
  li.appendChild(metrics);
  li.appendChild(status);
  historyList.appendChild(li);
}

// —— Chart.js 双折线图：左轴温度、右轴湿度，X 轴为时间 ——
const ctx = document.getElementById("trendChart").getContext("2d");
const chart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "温度 (℃)",
        data: [],
        borderColor: "#4f7cff",
        backgroundColor: "rgba(79, 124, 255, 0.1)",
        yAxisID: "y",
        tension: 0.3,
        pointRadius: 3,
      },
      {
        label: "湿度 (%)",
        data: [],
        borderColor: "#16a34a",
        backgroundColor: "rgba(22, 163, 74, 0.1)",
        borderDash: [6, 4],
        yAxisID: "y1",
        tension: 0.3,
        pointRadius: 3,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    scales: {
      y: {
        type: "linear",
        position: "left",
        min: 0,
        max: 100,
        title: { display: true, text: "温度 (℃)" },
      },
      y1: {
        type: "linear",
        position: "right",
        min: 0,
        max: 100,
        title: { display: true, text: "湿度 (%)" },
        grid: { drawOnChartArea: false },
      },
    },
  },
});

// 根据当前选中节点刷新图表数据
function updateChart() {
  const history = nodes[selectedNode].history;
  chart.data.labels = history.map(function (h) { return h.time; });
  chart.data.datasets[0].data = history.map(function (h) { return h.temperature; });
  chart.data.datasets[1].data = history.map(function (h) { return h.humidity; });
  chart.update();
}

// —— MQTT 事件 ——
client.on("connect", function () {
  setStatus("已连接", "connected");
  clearNotice();
  // 订阅三个节点的 env 主题（通配符 +）
  client.subscribe("dormmate/+/env");
});

client.on("reconnect", function () {
  setStatus("重连中…", "reconnecting");
});

client.on("close", function () {
  setStatus("断开", "disconnected");
});

client.on("offline", function () {
  setStatus("断开", "disconnected");
});

client.on("error", function () {
  setStatus("连接失败", "error");
  setNotice("MQTT 连接出错，稍后自动重连");
});

// —— 消息处理（含容错，异常不崩溃）——
client.on("message", function (topic, payload) {
  // 1) 从 topic 解析 nodeId：dormmate/<nodeId>/env
  const parts = topic.split("/");
  const nodeId = parts[1];

  // 2) 未知节点 / 错误 topic：仅丢弃本条，其他节点不受影响
  if (NODE_IDS.indexOf(nodeId) === -1) {
    console.warn("忽略未知节点或错误 topic：", topic);
    setNotice("收到未知节点或错误 topic：" + topic);
    return;
  }

  // 3) 解析 JSON，非法则捕获提示，不崩溃
  let msg;
  try {
    msg = JSON.parse(payload.toString());
  } catch (e) {
    console.warn("收到非法 JSON，已忽略：", payload.toString());
    setNotice("收到非法 JSON 消息，已忽略");
    return;
  }

  // 4) 字段校验
  const temperature = Number(msg.temperature);
  const humidity = Number(msg.humidity);
  if (Number.isNaN(temperature) || Number.isNaN(humidity)) {
    console.warn("消息字段非法，已忽略：", msg);
    setNotice("消息字段非法，已忽略");
    return;
  }

  // 5) status 由前端根据温湿度计算，保证与数据一致（不用 MQTT 的 status）
  const status = getStatus(temperature, humidity);

  // 6) 构造记录，写入对应节点
  const record = {
    nodeId: nodeId,
    temperature: temperature,
    humidity: humidity,
    status: status,
    time: msg.time || new Date().toLocaleTimeString(),
  };
  nodes[nodeId].current = record;
  nodes[nodeId].history.push(record);

  // 更新卡片、历史列表；当前选中节点则同步刷新图表
  updateCard(nodeId, record);
  addHistoryItem(record);
  if (nodeId === selectedNode) {
    updateChart();
  }
});

// —— 节点切换：图表只展示选中节点的温湿度趋势 ——
nodeSelect.addEventListener("change", function () {
  selectedNode = nodeSelect.value;
  updateChart();
});
