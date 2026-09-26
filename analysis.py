# -*- coding: utf-8 -*-
"""
DormMate C01 · M2 离线分析脚本

读取前端导出的 dormmate.csv（与本脚本同目录），完成：
  1. 统计：总记录数、最高/最低温、最高/最低湿度、四类状态数量
  2. matplotlib 绘制温湿度趋势图 -> trend.png
  3. 生成 report.html（统计摘要 + 重点记录 + 内嵌 trend.png）

每次运行全量重新计算，不硬编码任何结果；换一份新 CSV 重跑即全量更新。
"""

import csv
import html
import os
import sys
from collections import Counter

# 所有输出路径均相对脚本所在目录，保证任意 CWD 下可运行
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# 支持命令行指定 CSV 文件名，默认 dormmate.csv（如：python analysis.py "dormmate (1).csv"）
_CSV_NAME = sys.argv[1] if len(sys.argv) > 1 else "dormmate.csv"
CSV_PATH = os.path.join(_BASE_DIR, _CSV_NAME)
TREND_PNG = os.path.join(_BASE_DIR, "trend.png")
REPORT_HTML = os.path.join(_BASE_DIR, "report.html")

# 与前端 getStatus 产出的四类状态一致（只做计数，不重新实现判定规则）
STATUS_KEYS = ["正常", "偏冷", "偏热", "偏湿"]


def read_records(path):
    """读取 CSV，temperature/humidity 转 float，time/status 保留字符串。"""
    records = []
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            records.append(
                {
                    "time": (row.get("time") or "").strip(),
                    "temperature": float(row.get("temperature") or 0),
                    "humidity": float(row.get("humidity") or 0),
                    "status": (row.get("status") or "").strip(),
                }
            )
    return records


def fmt_num(value, unit=""):
    """空值显示占位符，避免空数据时打印 None。"""
    if value is None:
        return "—"
    return f"{value}{unit}"


def compute_stats(records):
    """统计全部指标，返回值均为运行时计算。"""
    if not records:
        return {
            "total": 0,
            "max_temp": None,
            "min_temp": None,
            "max_humidity": None,
            "min_humidity": None,
            "counts": {k: 0 for k in STATUS_KEYS},
            "other": 0,
        }

    temps = [r["temperature"] for r in records]
    hums = [r["humidity"] for r in records]
    counter = Counter(r["status"] for r in records)
    counts = {k: counter.get(k, 0) for k in STATUS_KEYS}
    other = sum(v for k, v in counter.items() if k not in STATUS_KEYS)

    return {
        "total": len(records),
        "max_temp": max(temps),
        "min_temp": min(temps),
        "max_humidity": max(hums),
        "min_humidity": min(hums),
        "counts": counts,
        "other": other,
    }


def highlight_records(records):
    """需要关注的记录 = 状态非「正常」（偏冷/偏热/偏湿）。"""
    return [r for r in records if r["status"] != "正常"]


def plot_trend(records, out_path):
    """绘制温湿度趋势图（上下两个子图共享 x 轴），保存 PNG。"""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    plt.rcParams["font.sans-serif"] = [
        "Microsoft YaHei",
        "SimHei",
        "PingFang SC",
        "DejaVu Sans",
    ]
    plt.rcParams["axes.unicode_minus"] = False

    x = list(range(len(records)))
    temps = [r["temperature"] for r in records]
    hums = [r["humidity"] for r in records]
    times = [r["time"] for r in records]

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 6), sharex=True)

    ax1.plot(x, temps, color="#4f7cff", marker="o", linewidth=1.5)
    ax1.set_ylabel("温度（℃）")
    ax1.set_title("温湿度趋势")
    ax1.grid(True, linestyle="--", alpha=0.4)

    ax2.plot(x, hums, color="#2bb673", marker="o", linewidth=1.5)
    ax2.set_ylabel("湿度（%）")
    ax2.set_xlabel("时间")
    ax2.grid(True, linestyle="--", alpha=0.4)

    if times:
        ax2.set_xticks(x)
        ax2.set_xticklabels(times, rotation=45, ha="right", fontsize=8)

    fig.tight_layout()
    fig.savefig(out_path, dpi=120)
    plt.close(fig)


# 报告样式（普通字符串，避免与 f-string 花括号冲突）
_REPORT_CSS = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>DormMate 环境分析报告</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
      "Microsoft YaHei", sans-serif;
    background: #eef2f7;
    color: #1f2937;
    padding: 24px;
  }
  main { max-width: 860px; margin: 0 auto; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .sub { color: #6b7280; font-size: 13px; margin-bottom: 20px; }
  section {
    background: #fff; border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
    padding: 20px; margin-bottom: 20px;
  }
  h2 { font-size: 15px; color: #374151; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td, th {
    text-align: left; padding: 8px 10px;
    border-bottom: 1px solid #eef0f4;
  }
  th { color: #6b7280; font-weight: 600; }
  td:last-child, th:last-child { text-align: right; }
  .flag { color: #dc2626; font-weight: 600; }
  img { width: 100%; border-radius: 8px; }
  .empty { color: #9ca3af; }
</style>
</head>
"""


def build_report(records, stats, out_path):
    """生成 report.html：统计摘要 + 重点记录（非「正常」）+ 内嵌趋势图。"""
    highlights = highlight_records(records)

    stat_rows = "".join(
        f"<tr><td>{k}</td><td>{v}</td></tr>"
        for k, v in [
            ("总记录数", stats["total"]),
            ("最高温度", fmt_num(stats["max_temp"], "℃")),
            ("最低温度", fmt_num(stats["min_temp"], "℃")),
            ("最高湿度", fmt_num(stats["max_humidity"], "%")),
            ("最低湿度", fmt_num(stats["min_humidity"], "%")),
            ("正常", stats["counts"]["正常"]),
            ("偏冷", stats["counts"]["偏冷"]),
            ("偏热", stats["counts"]["偏热"]),
            ("偏湿", stats["counts"]["偏湿"]),
        ]
        + ([("其他", stats["other"])] if stats["other"] else [])
    )

    if highlights:
        highlight_rows = "".join(
            f'<tr><td>{html.escape(r["time"])}</td>'
            f'<td>{r["temperature"]}℃</td>'
            f'<td>{r["humidity"]}%</td>'
            f'<td class="flag">{r["status"]}</td></tr>'
            for r in highlights
        )
    else:
        highlight_rows = '<tr><td colspan="4" class="empty">无异常记录</td></tr>'

    image_block = '<img src="trend.png" alt="温湿度趋势图" />'

    doc = (
        _REPORT_CSS
        + "<body><main>"
        + "<h1>DormMate 环境分析报告</h1>"
        + f'<p class="sub">共 {stats["total"]} 条记录</p>'
        + "<section><h2>统计摘要</h2>"
        + "<table><tr><th>指标</th><th>数值</th></tr>"
        + stat_rows
        + "</table></section>"
        + "<section><h2>重点记录（非正常状态）</h2>"
        + "<table><tr><th>时间</th><th>温度</th><th>湿度</th><th>状态</th></tr>"
        + highlight_rows
        + "</table></section>"
        + "<section><h2>温湿度趋势</h2>"
        + image_block
        + "</section>"
        + "</main></body></html>"
    )

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(doc)


def main():
    if not os.path.exists(CSV_PATH):
        print(f"未找到 {CSV_PATH}")
        print("请先在网页导出 CSV，并放到本脚本同目录后重试。")
        return 1

    records = read_records(CSV_PATH)
    stats = compute_stats(records)

    try:
        plot_trend(records, TREND_PNG)
    except ImportError:
        print("缺少 matplotlib，请先运行：pip install matplotlib")
        return 1

    build_report(records, stats, REPORT_HTML)

    print(f"趋势图已生成：{TREND_PNG}")
    print(f"报告已生成：{REPORT_HTML}")
    print("\n=== 统计摘要 ===")
    print(f"总记录数：{stats['total']}")
    print(f"最高温度：{fmt_num(stats['max_temp'], '℃')}")
    print(f"最低温度：{fmt_num(stats['min_temp'], '℃')}")
    print(f"最高湿度：{fmt_num(stats['max_humidity'], '%')}")
    print(f"最低湿度：{fmt_num(stats['min_humidity'], '%')}")
    for key in STATUS_KEYS:
        print(f"{key}：{stats['counts'][key]}")
    if stats["other"]:
        print(f"其他：{stats['other']}")

    print("\n=== 需要关注的记录 ===")
    highlights = highlight_records(records)
    if highlights:
        for r in highlights:
            print(
                f"{r['time']}  温度 {r['temperature']}℃  "
                f"湿度 {r['humidity']}%  状态 {r['status']}"
            )
    else:
        print("无")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
