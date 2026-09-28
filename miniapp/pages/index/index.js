Page({
  data: {
    temperature: "",
    humidity: "",
    status: "",
    advice: "",
    message: "",
    historyList: []
  },

  onLoad() {
    const saveHistory = wx.getStorageSync('dormHistory') || [];
    this.setData({ historyList: saveHistory });
  },

  // 数字补零工具，统一两位
  padZero(num) {
    return num < 10 ? '0' + num : String(num);
  },

  getStatus(temperature, humidity) {
    if (temperature < 18) return { status: "偏冷", advice: "建议调高温度" };
    if (temperature >= 30) return { status: "偏热", advice: "建议注意通风" };
    if (humidity >= 75) return { status: "偏湿", advice: "建议除湿" };
    return { status: "正常", advice: "环境状态良好" };
  },

  validate(temperatureRaw, humidityRaw) {
    if (temperatureRaw.trim() === "" || humidityRaw.trim() === "") {
      return "请输入温度和湿度";
    }
    const temp = Number(temperatureRaw);
    const hum = Number(humidityRaw);
    if (isNaN(temp) || isNaN(hum)) {
      return "温度和湿度必须是数字";
    }
    if (temp < -50 || temp > 100) return "温度超出合理范围（-50 ~ 100）";
    if (hum < 0 || hum > 100) return "湿度超出合理范围（0 ~ 100）";
    return null;
  },

  onTempInput(e) {
    this.setData({ temperature: e.detail.value });
  },
  onHumInput(e) {
    this.setData({ humidity: e.detail.value });
  },

  onAnalyze() {
    const tempRaw = this.data.temperature;
    const humidityRaw = this.data.humidity;
    const errorMsg = this.validate(tempRaw, humidityRaw);

    if (errorMsg) {
      this.setData({
        message: errorMsg,
        status: "",
        advice: ""
      });
      return;
    }
    this.setData({ message: "" });
    const temp = Number(tempRaw);
    const hum = Number(humidityRaw);
    const res = this.getStatus(temp, hum);

    // 标准两位数时间格式：09/27 23:09:05
    const now = new Date();
    const month = this.padZero(now.getMonth() + 1);
    const day = this.padZero(now.getDate());
    const hour = this.padZero(now.getHours());
    const minute = this.padZero(now.getMinutes());
    const second = this.padZero(now.getSeconds());
    const timeStr = `${month}/${day} ${hour}:${minute}:${second}`;

    const newRecord = {
      time: timeStr,
      temp: temp,
      hum: hum,
      status: res.status
    };

    // 新记录追加到底部
    const newHistory = [...this.data.historyList, newRecord];
    this.setData({
      status: res.status,
      advice: res.advice,
      historyList: newHistory
    });
    wx.setStorageSync('dormHistory', newHistory);
  },

  // 一键清空全部历史记录
  clearAllHistory() {
    wx.showModal({
      title: "确认清空",
      content: "旧历史记录时间格式不统一，清空后所有新记录将使用标准两位数时间格式，确定清空？",
      success: (res) => {
        if (res.confirm) {
          const emptyArr = [];
          this.setData({ historyList: emptyArr });
          wx.setStorageSync('dormHistory', emptyArr);
          wx.showToast({ title: "已清空", icon: "success" });
        }
      }
    })
  }
})