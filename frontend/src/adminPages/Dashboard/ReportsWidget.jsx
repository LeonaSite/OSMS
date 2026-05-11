import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import BeatLoader from "react-spinners/BeatLoader";
import { useReports } from "../../adminComponents/Context/ReportsContext";
import { useOverview } from "../../hooks/Reports/useReportsData";
import { useNavigate } from "react-router-dom";
import { IoArrowForwardOutline } from "react-icons/io5";
import "./Dashboard.css";

import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
);

export default function ReportsWidget() {
  const navigate = useNavigate();
  const { filter, setFilter, from, setFrom, to, setTo } = useReports();

  // 🔥 ONLY overview (no requests / arrivals)
  const { data: overview = [], isLoading } = useOverview({
    filter,
    from,
    to,
  });

  const safeOverview = useMemo(
    () => (Array.isArray(overview) ? overview : []),
    [overview],
  );

  // ================= TOTALS =================
  const totals = useMemo(() => {
    return safeOverview.reduce(
      (acc, d) => {
        acc.arrivedItems += d?.ArrivedItems || 0;
        acc.arrivedQty += d?.ArrivedQty || 0;
        acc.arrivedAmount += d?.ArrivedAmount || 0;

        acc.releasedItems += d?.ReleasedItems || 0;
        acc.releasedQty += d?.ReleasedQty || 0;
        acc.releasedAmount += d?.ReleasedAmount || 0;

        return acc;
      },
      {
        arrivedItems: 0,
        arrivedQty: 0,
        arrivedAmount: 0,
        releasedItems: 0,
        releasedQty: 0,
        releasedAmount: 0,
      },
    );
  }, [safeOverview]);

  // ================= LABEL FORMAT =================
  const formatLabel = (period) => {
    if (!period) return "";

    const val = String(period);

    if (filter === "daily") {
      const date = new Date(val);
      return isNaN(date)
        ? val
        : date.toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
          });
    }

    if (filter === "weekly") {
      const [year, week] = val.split("-W");
      return `W${week} ${year}`;
    }

    if (filter === "monthly") {
      const date = new Date(val + "-01");
      return date.toLocaleString("en-US", {
        month: "short",
      });
    }

    if (filter === "semi-annual") {
      if (!val.includes("-H")) return val;

      const [year, half] = val.split("-H");
      return `H${half} ${year}`;
    }

    return val;
  };

  // ================= CHART =================
  const chartData = useMemo(() => {
    return {
      labels: safeOverview.map((d) => formatLabel(d?.period)),
      datasets: [
        {
          label: "Arrived",
          data: safeOverview.map((d) => d?.ArrivedQty || 0),
          borderColor: "#f59e0b",
          tension: 0.2,
          fill: false,
          backgroundColor: (context) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;

            if (!chartArea) return null;

            const gradient = ctx.createLinearGradient(
              0,
              chartArea.top,
              0,
              chartArea.bottom,
            );

            gradient.addColorStop(0, "rgba(245,158,11,0.4)");
            gradient.addColorStop(1, "rgba(245,158,11,0)");

            return gradient;
          },
        },
        {
          label: "Released",
          data: safeOverview.map((d) => d?.ReleasedQty || 0),
          borderColor: "#2563eb",
          tension: 0.4,
          fill: false,
          backgroundColor: (context) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;

            if (!chartArea) return null;

            const gradient = ctx.createLinearGradient(
              0,
              chartArea.top,
              0,
              chartArea.bottom,
            );

            gradient.addColorStop(0, "rgba(37,99,235,0.4)");
            gradient.addColorStop(1, "rgba(37,99,235,0)");

            return gradient;
          },
        },
      ],
    };
  }, [safeOverview, filter]);

  const chartOptions = {
    responsive: true,
    plugins: { legend: { position: "top" } },
    scales: { y: { beginAtZero: true } },
  };

  return (
    <div className="reports-widget-container">
      {/* ================= HEADER ================= */}
      <div className="reports-widget-header">
        <h2>Supply Inflow and Outflow Report</h2>

        <div className="date-range">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="date-range-type"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="semi-annual">Semi-Annual</option>
            <option value="annually">Annually</option>
          </select>

          <span>From</span>

          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />

          <span>To</span>

          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      {/* ================= CONTENT ================= */}
      {isLoading ? (
        <div className="spinner-container">
          <BeatLoader size={15} color="#1e3a8a" />
        </div>
      ) : (
        <div className="reports-summary-card">
          <div className="reports-summary">
            <div className="summary-grid">
              <div className="reports-summary-group">
                <h4>
                  <div className="arrived-circle"></div> Arrived Items
                </h4>
                <p className="p-arrived">
                  {totals.arrivedItems.toLocaleString()} (
                  {totals.arrivedQty.toLocaleString()})
                </p>
                <p className="p-arrived">
                  Php{" "}
                  {totals.arrivedAmount.toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>

              <div className="reports-summary-group">
                <h4>
                  <div className="released-circle"></div>Released Items
                </h4>
                <p className="p-released">
                  {totals.releasedItems.toLocaleString()} (
                  {totals.releasedQty.toLocaleString()})
                </p>
                <p className="p-released">
                  Php{" "}
                  {totals.releasedAmount.toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* ===== CHART ===== */}
          <div className="chart-container">
            <Line
              data={chartData}
              options={chartOptions}
              key={JSON.stringify(chartData.labels)}
            />
          </div>
        </div>
      )}
      <div className="widget-view-container">
        <button
          onClick={() => navigate(`/admin/reports`)}
          className="widget-view-btn"
        >
          View All <IoArrowForwardOutline className="widget-view-icon" />
        </button>
      </div>
    </div>
  );
}
