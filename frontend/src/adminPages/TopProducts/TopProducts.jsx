import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import "./TopProducts.css";
import BeatLoader from "react-spinners/BeatLoader";
import { exportTopProductsExcel } from "./exportTopProductsExcel";
import CooldownButton from "../../adminComponents/Button/CooldownButton";
import { RiFileExcel2Line } from "react-icons/ri";
import { FaSort, FaSortUp, FaSortDown, FaSearch } from "react-icons/fa";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";

import { Bar } from "react-chartjs-2";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const TopProducts = () => {
  const navigate = useNavigate();

  const rowsPerPage = 50;
  const currentYear = new Date().getFullYear();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchParams, setSearchParams] = useSearchParams();

  const urlYear = searchParams.get("year");

  const [year, setYear] = useState(urlYear ? urlYear : currentYear);
  const [yearOptions, setYearOptions] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");

  const [sortConfig, setSortConfig] = useState({
    key: "QuantityReleased",
    direction: "desc",
  });

  const [currentPage, setCurrentPage] = useState(1);

  //  FETCH YEARS
  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/api/top-products/years`)
      .then((res) => setYearOptions(res.data));
  }, []);

  const availableYears = useMemo(() => {
    return new Set(yearOptions); // fast lookup
  }, [yearOptions]);

  //  FETCH DATA
  const fetchTopProducts = async () => {
    try {
      setLoading(true);

      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/top-products?year=${year}`,
      );

      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopProducts();
    setCurrentPage(1);
  }, [year]);

  useEffect(() => {
    const urlYear = searchParams.get("year");

    if (urlYear) {
      setYear(urlYear);
    } else {
      //  Default: set URL to current year
      setSearchParams({ year: currentYear });
    }
  }, []);

  useEffect(() => {
    const urlYear = searchParams.get("year");
    if (urlYear && urlYear !== year) {
      setYear(urlYear);
    }
  }, [searchParams]);

  //  SEARCH (LIKE DEPARTMENT)
  const filteredData = useMemo(() => {
    return data.filter((item) =>
      `${item.StockName} ${item.Description} ${item.StockCardID}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase()),
    );
  }, [data, searchTerm]);

  //  SORT (LIKE DEPARTMENT)
  const sortedData = useMemo(() => {
    const sorted = [...filteredData];

    if (sortConfig.key) {
      sorted.sort((a, b) => {
        let aValue = a[sortConfig.key] ?? 0;
        let bValue = b[sortConfig.key] ?? 0;

        if (typeof aValue === "string") {
          return sortConfig.direction === "asc"
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        return sortConfig.direction === "asc"
          ? aValue - bValue
          : bValue - aValue;
      });
    }

    return sorted;
  }, [filteredData, sortConfig]);

  //  PAGINATION (LIKE STOCK CONTROL)
  const totalPages = Math.ceil(sortedData.length / rowsPerPage);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, currentPage]);

  //  SORT HANDLER
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

  //BARCHART TOP 10
  const chartData = useMemo(() => {
    const filtered = sortedData.filter(
      (item) =>
        (item.TotalRequests ?? 0) > 0 || (item.QuantityReleased ?? 0) > 0,
    );

    const topItems = filtered.slice(0, 10);

    const formatLabel = (name, desc) => {
      const fullText = `${name} - ${desc || ""}`;
      const MAX_TOTAL = 100;
      const LINE_LIMIT = 12;

      // 1. Truncate total string to 30 characters
      const truncated =
        fullText.length > MAX_TOTAL
          ? fullText.substring(0, MAX_TOTAL).trim() + "..."
          : fullText;

      // 2. Split into whole words
      const words = truncated.split(" ");
      const lines = [];
      let currentLine = "";

      words.forEach((word) => {
        // Check if adding the next word exceeds the 12-char limit
        if ((currentLine + word).length > LINE_LIMIT) {
          if (currentLine.length > 0) {
            lines.push(currentLine.trim());
            currentLine = word + " ";
          } else {
            // If a single word is longer than 12, we have to push it anyway
            lines.push(word);
            currentLine = "";
          }
        } else {
          currentLine += word + " ";
        }
      });

      if (currentLine.trim().length > 0) {
        lines.push(currentLine.trim());
      }

      return lines;
    };

    const createGradient = (ctx, area, colorStart, colorEnd) => {
      const gradient = ctx.createLinearGradient(0, area.bottom, 0, area.top);
      gradient.addColorStop(0, colorEnd);
      gradient.addColorStop(1, colorStart);
      return gradient;
    };

    return {
      labels: topItems.map((item) =>
        formatLabel(item.StockName, item.Description),
      ),
      datasets: [
        {
          label: "Requests",
          data: topItems.map((item) => item.TotalRequests),
          backgroundColor: (context) => {
            const { ctx, chartArea } = context.chart;
            if (!chartArea) return "#14b8a6";
            return createGradient(ctx, chartArea, "#15ccb7", "#14b8a6");
          },
          borderRadius: 5,
        },
        {
          label: "Released Quantity",
          data: topItems.map((item) => item.QuantityReleased),
          backgroundColor: (context) => {
            const { ctx, chartArea } = context.chart;
            if (!chartArea) return "#1e3a8a";
            return createGradient(ctx, chartArea, "#3d60bf", "#1e3a8a");
          },
          borderRadius: 5,
        },
      ],
    };
  }, [sortedData]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
      },
    },
    scales: {
      x: {
        stacked: false,
        ticks: {
          maxRotation: 0, //  NO SLANT
          minRotation: 0, //  NO SLANT
          autoSkip: true, // skip crowded labels
          maxTicksLimit: 10, // prevent overcrowding
        },
      },
      y: {
        beginAtZero: true,
      },
    },
  };

  if (loading) {
    return (
      <div className="spinner-container">
        <BeatLoader size={15} color="#1e3a8a" />
      </div>
    );
  }

  return (
    <div className="top-products-container">
      <div className="top-products-header-row">
        <h2 className="top-products-header">
          Top Items <span>{sortedData.length}</span>
        </h2>

        {/* YEAR */}
        <div className="year-filter">
          <p className="date-range-label">Year:</p>

          {/* YEAR PICKER */}
          <DatePicker
            className="year-range"
            selected={year === "ALL" ? null : new Date(year, 0)}
            onChange={(date) => {
              const selectedYear = date.getFullYear();

              setYear(selectedYear);
              setSearchParams({ year: selectedYear });
              setCurrentPage(1);
            }}
            showYearPicker
            dateFormat="yyyy"
            placeholderText="Select Year"
            filterDate={(date) => {
              const y = date.getFullYear();
              return availableYears.has(y); // disable years without records
            }}
          />

          {/* OVERALL BUTTON */}
          <button
            className="year-overall"
            onClick={() => {
              setYear("ALL");
              setSearchParams({ year: "ALL" });
            }}
          >
            Overall
          </button>
        </div>
      </div>

      {/* BAR CHART */}
      <div className="top-products-chart">
        <Bar data={chartData} options={chartOptions} />
      </div>

      {/* SEARCH */}
      <div className="top-products-tools">
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

        <CooldownButton
          onClick={() => exportTopProductsExcel(year)}
          className="excel-download-btn"
        >
          <RiFileExcel2Line className="excel-download-icon" /> Download Table
        </CooldownButton>
      </div>

      <table className="top-products-table">
        <thead>
          <tr>
            <th>#</th>
            <th>StockCard#</th>
            <th>Item</th>

            <th
              onClick={() => handleSort("TotalRequests")}
              className="sortable"
            >
              Requests {renderSortIcon("TotalRequests")}
            </th>

            <th
              onClick={() => handleSort("QuantityReleased")}
              className="sortable"
            >
              Released Qty {renderSortIcon("QuantityReleased")}
            </th>

            <th>Unit</th>

            <th onClick={() => handleSort("TotalAmount")} className="sortable">
              Total Amount {renderSortIcon("TotalAmount")}
            </th>

            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {paginatedData.map((item, index) => (
            <tr
              key={item.StockID}
              onClick={() =>
                navigate(`/admin/top-products/${item.StockCardID}?year=${year}`)
              }
            >
              <td>{(currentPage - 1) * rowsPerPage + index + 1}</td>

              <td>{item.StockCardID}</td>

              <td>
                <div>{item.StockName}</div>
                <small>{item.Description}</small>
              </td>

              <td>{item.TotalRequests}</td>
              <td>{item.QuantityReleased}</td>

              <td>{item.UnitName}</td>

              <td>
                ₱{" "}
                {Number(item.TotalAmount).toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                })}
              </td>

              <td>
                <button
                  className="view-btn"
                  onClick={() =>
                    navigate(
                      `/admin/top-products/${item.StockCardID}?year=${year}`,
                    )
                  }
                >
                  Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* PAGINATION */}
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
};

export default TopProducts;
