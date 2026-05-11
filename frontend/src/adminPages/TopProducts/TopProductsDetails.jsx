import { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import BeatLoader from "react-spinners/BeatLoader";
import { formatDateTime } from "../../Utilities/FormatDateTime";
import { BiSolidBarChartAlt2 } from "react-icons/bi";
import { FaSort, FaSortUp, FaSortDown, FaSearch } from "react-icons/fa";

import "./TopProductsDetails.css";

export default function TopProductDetails() {
  const { stockcard } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [rows, setRows] = useState([]);

  const [searchParams, setSearchParams] = useSearchParams();

  const currentYear = new Date().getFullYear();
  const urlYear = searchParams.get("year");

  const [year, setYear] = useState(urlYear || currentYear);
  const [yearOptions, setYearOptions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [sortConfig, setSortConfig] = useState({
    key: "TotalQuantity",
    direction: "desc",
  });

  useEffect(() => {
    fetchDetails();
  }, [stockcard, year]);

  const fetchDetails = async () => {
    try {
      setLoading(true);

      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/top-products/details/${stockcard}?year=${year}`,
      );

      setData(res.data.summary);
      setRows(res.data.breakdown);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    axios
      .get(
        `${import.meta.env.VITE_API_URL}/api/top-products/details/${stockcard}/years`,
      )
      .then((res) => {
        setYearOptions(res.data);

        //  FIX: if current year not in list, fallback to latest available
        if (!res.data.includes(Number(year)) && res.data.length > 0) {
          const fallbackYear = res.data[0];
          setYear(fallbackYear);
          setSearchParams({ year: fallbackYear });
        }
      });
  }, [stockcard]);

  useEffect(() => {
    const urlYear = searchParams.get("year");

    if (urlYear) {
      setYear(urlYear);
    } else {
      setSearchParams({ year: currentYear });
    }
  }, []);

  useEffect(() => {
    const urlYear = searchParams.get("year");
    if (urlYear && urlYear !== year) {
      setYear(urlYear);
    }
  }, [searchParams]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) =>
      `${r.DepartmentName}`.toLowerCase().includes(search.toLowerCase()),
    );
  }, [rows, search]);

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];

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
  }, [filteredRows, sortConfig]);

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

  if (loading) {
    return (
      <div className="spinner-container">
        <BeatLoader size={15} color="#1e3a8a" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="top-products-details-container">
      {/* BACK */}
      <button className="back-btn" onClick={() => navigate(-1)}>
        {"<"} BACK
      </button>

      <div className="top-products-header-row">
        {/* TITLE */}
        <div className="top-products-details-title-container">
          <h2 className="top-products-details-title">
            <span onClick={() => navigate("/admin/top-products")}>
              Top Items
            </span>{" "}
            {">"} Details
          </h2>
        </div>

        <div className="year-filter">
          <p className="date-range-label">Year:</p>
          <select
            className="year-range"
            value={year}
            onChange={(e) => {
              const selected = e.target.value;

              setYear(selected);

              //  update URL
              setSearchParams({ year: selected });
            }}
          >
            <option value="ALL">All</option>
            {yearOptions.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* HEADER CARD */}
      <div
        className="top-products-header-card"
        onClick={() => navigate(`/admin/stock-control//${data.StockCardID}`)}
      >
        <div className="top-products-header-card-left">
          <div className="top-products-icon-box">
            <BiSolidBarChartAlt2 className="top-products-icon" />
          </div>

          <div>
            <div className="top-products-label">Stock Card No.</div>
            <div className="top-products-number">{data.StockCardID}</div>
          </div>
        </div>

        <div>
          <div className="top-products-label">Requests</div>
          <div className="top-products-number">{data.TotalRequests}</div>
        </div>

        <div>
          <div className="top-products-label">Request Quantity</div>
          <div className="top-products-number">{data.QuantityReleased}</div>
        </div>

        <div>
          <div className="top-products-label">Total Amount</div>
          <div className="top-products-number">
            Php.{" "}
            {Number(data.TotalAmount).toLocaleString("en-PH", {
              minimumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>
      <div className="top-products-details-body-card">
        <div className="top-products-details-grid">
          <div>
            <div className="top-products-details-label">Item Name</div>
            <div className="top-products-details-number">{data.StockName}</div>
          </div>

          <div>
            <div className="top-products-details-label">Unit</div>
            <div className="top-products-details-number">{data.UnitName}</div>
          </div>

          <div>
            <div className="top-products-details-label">Price Cost</div>
            <div className="top-products-details-number">
              Php.{" "}
              {Number(data.Price).toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}
            </div>
          </div>

          <div>
            <div className="top-products-details-label">Specification</div>
            <div className="top-products-details-number">
              {data.Description}
            </div>
          </div>

          <div>
            <div className="top-products-details-label">Accepted Requests</div>
            <div className="top-products-details-number">
              {data.AcceptedRequests}
            </div>
          </div>

          <div>
            <div className="top-products-details-label">Rejected Requests</div>
            <div className="top-products-details-number">
              {data.RejectedRequests}
            </div>
          </div>
        </div>
      </div>
      {/* TABLE */}
      <div className="top-products-req-table-card">
        <div className="top-products-req-table-header">
          <h3>Request Breakdown</h3>
        </div>

        <div className="top-products-tools">
          <div className="search-wrapper">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search division..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="department-search"
            />
          </div>
        </div>

        <table className="top-products-req-table">
          <thead>
            <tr>
              <th>#</th>

              <th
                onClick={() => handleSort("DepartmentName")}
                className="sortable"
              >
                Division {renderSortIcon("DepartmentName")}
              </th>

              <th
                onClick={() => handleSort("TotalRequests")}
                className="sortable"
              >
                Requests {renderSortIcon("TotalRequests")}
              </th>

              <th
                onClick={() => handleSort("TotalQuantity")}
                className="sortable"
              >
                Request Quantity {renderSortIcon("TotalQuantity")}
              </th>

              <th
                onClick={() => handleSort("TotalAmount")}
                className="sortable"
              >
                Total Amount {renderSortIcon("TotalAmount")}
              </th>

              <th
                onClick={() => handleSort("LastRequestDate")}
                className="sortable"
              >
                Last Request {renderSortIcon("LastRequestDate")}
              </th>
            </tr>
          </thead>

          <tbody>
            {sortedRows.map((r, index) => (
              <tr key={index}>
                <td>{index + 1}</td>

                <td>{r.DepartmentName}</td>

                <td>{r.TotalRequests}</td>

                <td>{r.TotalQuantity}</td>

                <td>
                  ₱{" "}
                  {Number(r.TotalAmount).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                  })}
                </td>

                <td>{formatDateTime(r.LastRequestDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
