import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import "./Reports.css";
import CooldownButton from "../../adminComponents/Button/CooldownButton";
import BeatLoader from "react-spinners/BeatLoader";
import { Line } from "react-chartjs-2";
import { formatDateTime } from "../../Utilities/FormatDateTime";
import { FaSort, FaSortUp, FaSortDown, FaSearch } from "react-icons/fa";
import { useReports } from "../../adminComponents/Context/ReportsContext";
import { exportReportsExcel } from "./exportReportsExcel";
import { RiFileExcel2Line } from "react-icons/ri";

import {
  useOverview,
  useRequests,
  useArrivals,
} from "../../hooks/Reports/useReportsData";

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

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rowsPerPage = 50;

  const {
    filter,
    setFilter,
    from,
    setFrom,
    to,
    setTo,
    searchTerm,
    setSearchTerm,
    sortConfig,
    setSortConfig,
    currentPage,
    setCurrentPage,
    activeTab,
    setActiveTab,
  } = useReports();

  // ✅ URL SYNC
  useEffect(() => {
    const type = searchParams.get("type");

    if (type && type !== filter) {
      setFilter(type);
    } else if (!type) {
      setSearchParams({ type: filter });
    }
  }, [searchParams]);

  // ================= TANSTACK QUERY =================
  const { data: overview = [], isLoading: overviewLoading } = useOverview({
    filter,
    from,
    to,
  });

  const { data: requests = [], isLoading: requestsLoading } = useRequests({
    from,
    to,
  });

  const { data: arrivals = [], isLoading: arrivalsLoading } = useArrivals({
    from,
    to,
  });

  const loading = overviewLoading || requestsLoading || arrivalsLoading;

  // ================= SAFE DATA =================
  const safeOverview = useMemo(
    () => (Array.isArray(overview) ? overview : []),
    [overview],
  );

  // ================= TOTALS =================
  const totalArrivedItems = useMemo(
    () => safeOverview.reduce((s, d) => s + (d?.ArrivedItems || 0), 0),
    [safeOverview],
  );

  const totalArrivedQty = useMemo(
    () => safeOverview.reduce((s, d) => s + (d?.ArrivedQty || 0), 0),
    [safeOverview],
  );

  const totalReleasedItems = useMemo(
    () => safeOverview.reduce((s, d) => s + (d?.ReleasedItems || 0), 0),
    [safeOverview],
  );

  const totalReleasedQty = useMemo(
    () => safeOverview.reduce((s, d) => s + (d?.ReleasedQty || 0), 0),
    [safeOverview],
  );

  const totalArrived = useMemo(
    () => safeOverview.reduce((s, d) => s + (d?.ArrivedAmount || 0), 0),
    [safeOverview],
  );

  const totalReleased = useMemo(
    () => safeOverview.reduce((s, d) => s + (d?.ReleasedAmount || 0), 0),
    [safeOverview],
  );

  // ================= FIXED LABEL =================
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
            year: "numeric",
          });
    }

    if (filter === "weekly") {
      if (!val.includes("-W")) return val;

      const parts = val.split("-W");
      if (parts.length !== 2) return val;

      const [year, week] = parts;
      return `Week ${week} ${year}`;
    }

    if (filter === "monthly") {
      const date = new Date(val + "-01");
      return isNaN(date)
        ? val
        : date.toLocaleString("en-US", {
            month: "short",
            year: "numeric",
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
          label: "Arrived Items",
          data: safeOverview.map((d) => d?.ArrivedQty || 0),
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245,158,11,0.2)",
          tension: 0.4,
        },
        {
          label: "Released Items",
          data: safeOverview.map((d) => d?.ReleasedQty || 0),
          borderColor: "#2563eb",
          backgroundColor: "rgba(37,99,235,0.2)",
          tension: 0.4,
        },
      ],
    };
  }, [safeOverview, filter]);

  const chartOptions = {
    responsive: true,
    plugins: { legend: { position: "top" } },
    scales: { y: { beginAtZero: true } },
  };

  // ================= RESET =================
  const resetDateRange = () => {
    const year = new Date().getFullYear();
    setFrom(`${year}-01-01`);
    setTo(`${year}-12-31`);
  };

  // ================= FILTER =================
  const filteredData = useMemo(() => {
    const dataSource = activeTab === "requests" ? requests : arrivals;

    return dataSource.filter((item) =>
      Object.values(item)
        .join(" ")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()),
    );
  }, [requests, arrivals, searchTerm, activeTab]);

  // ================= SORT =================
  const sortedData = useMemo(() => {
    const sorted = [...filteredData];

    if (sortConfig.key) {
      sorted.sort((a, b) => {
        let aVal = a[sortConfig.key] ?? "";
        let bVal = b[sortConfig.key] ?? "";

        if (typeof aVal === "string") {
          return sortConfig.direction === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      });
    }

    return sorted;
  }, [filteredData, sortConfig]);

  const totalPages = Math.ceil(sortedData.length / rowsPerPage);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, currentPage]);

  const handleSort = (key) => {
    let direction = "asc";

    if (sortConfig.key === key) {
      if (sortConfig.direction === "asc") direction = "desc";
      else if (sortConfig.direction === "desc") direction = null;
    }

    setSortConfig({
      key: direction ? key : null,
      direction,
    });
  };

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return <FaSort />;
    if (sortConfig.direction === "asc") return <FaSortUp />;
    if (sortConfig.direction === "desc") return <FaSortDown />;
    return <FaSort />;
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab]);

  if (loading) {
    return (
      <div className="spinner-container">
        <BeatLoader size={15} color="#1e3a8a" />
      </div>
    );
  }

  return (
    <div className="reports-container">
      <div className="reports-header">
        <h2>Supply Inflow and Outflow Report</h2>

        <div className="date-range">
          <select
            value={filter}
            onChange={(e) => {
              const val = e.target.value;

              setFilter(val);

              setSearchParams((prev) => {
                const params = Object.fromEntries(prev.entries());
                return { ...params, type: val };
              });
            }}
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

          <button className="clear-date-btn" onClick={resetDateRange}>
            Clear
          </button>
        </div>
      </div>

      <div className="reports-summary-card">
        <div className="reports-summary">
          <h2>Graphs Summary</h2>
          <div className="reports-summary-group">
            <h4>
              <div className="arrived-circle"></div> Arrived Items
            </h4>
            <p className="p-arrived">
              {totalArrivedItems.toLocaleString()} (
              {totalArrivedQty.toLocaleString()})
            </p>
            <p className="p-arrived">
              Php{" "}
              {Number(totalArrived).toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>

          <div className="reports-summary-group">
            <h4>
              <div className="released-circle"></div>Released Items
            </h4>
            <p className="p-released">
              {totalReleasedItems.toLocaleString()} (
              {totalReleasedQty.toLocaleString()})
            </p>
            <p className="p-released">
              Php{" "}
              {Number(totalReleased).toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>

        <div className="reports-chart">
          <Line key={filter} data={chartData} options={chartOptions} />
        </div>
      </div>

      <div className="reports-table-tools">
        <div className="reports-table-filter">
          <div className="search-wrapper">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search item, description, stock card..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="department-search"
            />
          </div>
          <div className="reports-tabs">
            <button
              className={activeTab === "requests" ? "active" : ""}
              onClick={() => setActiveTab("requests")}
            >
              Request Record
            </button>

            <button
              className={activeTab === "arrivals" ? "active" : ""}
              onClick={() => setActiveTab("arrivals")}
            >
              Arrival Record
            </button>
          </div>
        </div>

        <CooldownButton
          onClick={() =>
            exportReportsExcel({
              overview,
              requests,
              arrivals,
              from,
              to,
              filter,
            })
          }
          className="excel-download-btn"
        >
          <RiFileExcel2Line className="excel-download-icon" /> Download Table
        </CooldownButton>
      </div>

      {activeTab === "requests" ? (
        <table className="reports-table request">
          <thead>
            <tr>
              <th>#</th>
              <th
                onClick={() => handleSort("RequisitionNo")}
                className="sortable"
              >
                Req No {renderSortIcon("RequisitionNo")}
              </th>

              <th
                onClick={() => handleSort("EmployeeName")}
                className="sortable"
              >
                Requester {renderSortIcon("EmployeeName")}
              </th>

              <th onClick={() => handleSort("StockName")} className="sortable">
                Item {renderSortIcon("StockName")}
              </th>

              <th onClick={() => handleSort("Quantity")} className="sortable">
                Quantity {renderSortIcon("Quantity")}
              </th>
              <th>Unit</th>
              <th
                onClick={() => handleSort("TotalAmount")}
                className="sortable"
              >
                Total {renderSortIcon("TotalAmount")}
              </th>
              <th>Invoice</th>
              <th
                onClick={() => handleSort("ProcessedAt")}
                className="sortable"
              >
                Date {renderSortIcon("ProcessedAt")}
              </th>
            </tr>
          </thead>

          <tbody>
            {paginatedData.map((r, i) => (
              <tr key={i}>
                <td>{(currentPage - 1) * rowsPerPage + i + 1}</td>
                <td>{r.RequisitionNo}</td>

                <td>
                  {r.EmployeeName}
                  <br />
                  <small>{r.DepartmentName}</small>
                </td>

                <td>
                  {r.StockName}
                  <br />
                  <small>{r.Description}</small>
                </td>

                <td>{r.Quantity}</td>
                <td>{r.UnitName}</td>

                <td>
                  Php{" "}
                  {Number(r.TotalAmount).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>

                <td>{r.InvoiceNumber}</td>

                <td>{formatDateTime(r.ProcessedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="reports-table invoice">
          <thead>
            <tr>
              <th>#</th>
              <th
                onClick={() => handleSort("InvoiceNumber")}
                className="sortable"
              >
                Invoice {renderSortIcon("InvoiceNumber")}
              </th>

              <th onClick={() => handleSort("StockName")} className="sortable">
                Item {renderSortIcon("StockName")}
              </th>

              <th onClick={() => handleSort("Quantity")} className="sortable">
                Qty {renderSortIcon("Quantity")}
              </th>
              <th>Unit</th>
              <th
                onClick={() => handleSort("TotalAmount")}
                className="sortable"
              >
                Total {renderSortIcon("TotalAmount")}
              </th>

              <th
                onClick={() => handleSort("InvoiceDate")}
                className="sortable"
              >
                Arrived At {renderSortIcon("InvoiceDate")}
              </th>
            </tr>
          </thead>

          <tbody>
            {paginatedData.map((a, i) => (
              <tr key={i}>
                <td>{(currentPage - 1) * rowsPerPage + i + 1}</td>

                <td>{a.InvoiceNumber}</td>

                <td>
                  {a.StockName}
                  <br />
                  <small>{a.Description}</small>
                </td>

                <td>{a.Quantity}</td>
                <td>{a.UnitName}</td>

                <td>
                  Php{" "}
                  {Number(a.TotalAmount).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>

                <td>{formatDateTime(a.InvoiceDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="pagination">
        <button
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((p) => p - 1)}
        >
          Prev
        </button>

        {[...Array(totalPages)].map((_, i) => (
          <button
            key={i}
            className={currentPage === i + 1 ? "active-page" : ""}
            onClick={() => setCurrentPage(i + 1)}
          >
            {i + 1}
          </button>
        ))}

        <button
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
