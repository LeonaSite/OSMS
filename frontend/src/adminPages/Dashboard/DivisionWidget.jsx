import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { IoArrowForwardOutline } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";

import "./Dashboard.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

export default function DivisionWidget() {
  const navigate = useNavigate();

  const {
    data = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["topDivisionWidget"],
    queryFn: async () => {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/adminDashboard/top-divisions`,
      );
      return res.data;
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  const peso = (num) => `Php. ${Number(num || 0).toLocaleString("en-PH")}`;

  const ordered = [data[1] || null, data[0] || null, data[2] || null].filter(
    Boolean,
  );

  const isEmpty = !ordered || ordered.length === 0;

  const createGradient = (ctx, colorStart, colorEnd) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, colorStart);
    gradient.addColorStop(1, colorEnd);
    return gradient;
  };

  const chartData = {
    labels: ordered.map((x) => x.DepartmentName),
    datasets: [
      {
        data: ordered.map((x) => x.TotalAmount),
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return null;

          const colors = [
            ["#e2e7e4", "#7f8c8d"],
            ["#ead74d", "#57f10f"],
            ["#a87550", "#5c3d26"],
          ];

          const index = context.dataIndex;
          return createGradient(ctx, colors[index][0], colors[index][1]);
        },
        borderWidth: 0,
        borderRadius: 6,
        barThickness: 110,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { display: false } },
      y: { ticks: { display: false }, grid: { display: true } },
    },
  };

  return (
    <div className="division-widget">
      <div className="division-widget-header">
        <h2>Offices</h2>
        <button
          className="widget-view-btn"
          onClick={() => navigate(`/admin/departments`)}
        >
          View <IoArrowForwardOutline className="widget-view-icon" />
        </button>
      </div>

      {isLoading ? (
        <div className="division-loading">Loading...</div>
      ) : isError || isEmpty ? (
        <div className="division-empty">No data available.</div>
      ) : (
        <>
          <div className="division-chart-wrap">
            <Bar data={chartData} options={options} />
          </div>

          <div className="division-cards">
            {ordered.map((item, index) => (
              <div
                key={index}
                className="division-card"
                onClick={() =>
                  navigate(
                    `/admin/reports?table=departments&department=${item.DepartmentID}`,
                  )
                }
              >
                <h3>
                  {item.DepartmentName?.length > 8
                    ? `${item.DepartmentName.substring(0, 8)}...`
                    : item.DepartmentName}
                </h3>
                <p>{peso(item.TotalAmount)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
