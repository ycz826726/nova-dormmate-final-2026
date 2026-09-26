// NOVA DormMate C01 · M1 环境分析逻辑

// 内存历史（页面刷新即清空，不持久化）
const history = [];

// 环境状态判定（严格顺序，便于 M2/M4/M5 复用）
function getStatus(temperature, humidity) {
  if (temperature < 18) return { status: "偏冷", advice: "建议调高温度" };
  if (temperature >= 30) return { status: "偏热", advice: "建议注意通风" };
  if (humidity >= 75) return { status: "偏湿", advice: "建议除湿" };
  return { status: "正常", advice: "环境状态良好" };
}

// DOM 元素
const temperatureInput = document.getElementById("temperature");
const humidityInput = document.getElementById("humidity");
const analyzeBtn = document.getElementById("analyzeBtn");
const messageEl = document.getElementById("message");
const resultEl = document.getElementById("result");
const statusText = document.getElementById("statusText");
const adviceText = document.getElementById("adviceText");
const historyList = document.getElementById("historyList");
const historyEmpty = document.getElementById("historyEmpty");
const exportBtn = document.getElementById("exportBtn");

// 提示错误（不追加历史）
function showError(text) {
  messageEl.textContent = text;
}

function clearError() {
  messageEl.textContent = "";
}

// 校验失败时隐藏结果区并清空文本，不显示任何状态结果
function clearResult() {
  resultEl.hidden = true;
  statusText.textContent = "";
  adviceText.textContent = "";
}

// 渲染当前状态/建议
function renderResult(status, advice) {
  statusText.textContent = status;
  adviceText.textContent = advice;
  resultEl.hidden = false;
}

// 追加一条历史（不覆盖旧记录，新记录插到顶部）
function renderHistoryItem(record) {
  historyEmpty.hidden = true;

  const li = document.createElement("li");

  const time = document.createElement("span");
  time.className = "time";
  time.textContent = record.time;

  const metrics = document.createElement("span");
  metrics.className = "metrics";
  metrics.textContent = `${record.temperature}℃ | ${record.humidity}% | ${record.status}`;

  li.appendChild(time);
  li.appendChild(metrics);
  historyList.prepend(li);
}

// 校验输入，非法返回错误文案，合法返回 null
function validate(temperatureRaw, humidityRaw) {
  if (temperatureRaw.trim() === "" || humidityRaw.trim() === "") {
    return "请输入温度和湿度";
  }

  const temperature = Number(temperatureRaw);
  const humidity = Number(humidityRaw);

  if (Number.isNaN(temperature) || Number.isNaN(humidity)) {
    return "温度和湿度必须是数字";
  }

  if (temperature < -50 || temperature > 100) {
    return "温度超出合理范围（-50 ~ 100）";
  }

  if (humidity < 0 || humidity > 100) {
    return "湿度超出合理范围（0 ~ 100）";
  }

  return null;
}

// 点击【分析环境】
function onAnalyze() {
  const temperatureRaw = temperatureInput.value;
  const humidityRaw = humidityInput.value;

  // 校验：非法则提示，不追加历史
  const error = validate(temperatureRaw, humidityRaw);
  if (error) {
    showError(error);
    clearResult();
    return;
  }

  clearError();

  const temperature = Number(temperatureRaw);
  const humidity = Number(humidityRaw);
  const { status, advice } = getStatus(temperature, humidity);
  const time = new Date().toLocaleString();

  // 追加历史（内存数组，只存 4 字段；advice 仅用于建议区展示）
  history.push({ time, temperature, humidity, status });

  renderResult(status, advice);
  renderHistoryItem(history[history.length - 1]);
}

analyzeBtn.addEventListener("click", onAnalyze);

// CSV 字段转义：含逗号/引号/换行时加引号并转义内部引号
function csvEscape(value) {
  const s = String(value);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// 点击【导出CSV】：把内存里全部历史记录导出为 dormmate.csv
function onExport() {
  if (history.length === 0) {
    showError("暂无历史记录可导出");
    return;
  }

  clearError();

  const header = ["time", "temperature", "humidity", "status"];
  const lines = [header.join(",")];

  for (const record of history) {
    const row = [record.time, record.temperature, record.humidity, record.status]
      .map(csvEscape)
      .join(",");
    lines.push(row);
  }

  // 前缀 BOM，保证 Excel 打开中文不乱码
  const content = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "dormmate.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

exportBtn.addEventListener("click", onExport);

// ==================== M3 · 摄像头 ====================

// 摄像头 DOM 元素
const startCamBtn = document.getElementById("startCamBtn");
const captureBtn = document.getElementById("captureBtn");
const stopCamBtn = document.getElementById("stopCamBtn");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const photo = document.getElementById("photo");
const mediaMessage = document.getElementById("mediaMessage");
const camPlaceholder = document.getElementById("camPlaceholder");

// 摄像头状态
let mediaStream = null; // 摄像头媒体流

// 媒体错误提示（独立于 M1 的 #message，避免互相覆盖）
function showMediaError(text) {
  mediaMessage.textContent = text;
}

function clearMediaError() {
  mediaMessage.textContent = "";
}

// —— 摄像头 ——
async function startCamera() {
  clearMediaError();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showMediaError("当前环境不支持摄像头，请在 localhost 或 HTTPS 下运行");
    return;
  }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = mediaStream;
    await video.play();
    video.classList.remove("is-hidden");
    camPlaceholder.classList.add("is-hidden");
  } catch (err) {
    mediaStream = null;
    if (err.name === "NotAllowedError" || err.name === "SecurityError") {
      showMediaError("摄像头权限被拒绝，请在地址栏允许访问摄像头");
    } else if (err.name === "NotFoundError") {
      showMediaError("未检测到摄像头设备");
    } else {
      showMediaError("无法开启摄像头：" + err.name);
    }
  }
}

function capturePhoto() {
  if (!mediaStream || !video.videoWidth) {
    showMediaError("请先开启摄像头");
    return;
  }
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  photo.src = canvas.toDataURL("image/png");
  photo.classList.remove("is-hidden");
  clearMediaError();
}

function stopCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  video.srcObject = null;
  video.classList.add("is-hidden");
  camPlaceholder.classList.remove("is-hidden");
}

// 绑定摄像头事件
startCamBtn.addEventListener("click", startCamera);
captureBtn.addEventListener("click", capturePhoto);
stopCamBtn.addEventListener("click", stopCamera);
