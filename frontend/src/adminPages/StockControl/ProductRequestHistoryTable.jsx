import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import BeatLoader from "react-spinners/BeatLoader";
import { useNavigate, useSearchParams } from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FaSort, FaSortUp, FaSortDown, FaSearch } from "react-icons/fa";
import { formatDateTime } from "../../Utilities/FormatDateTime";
import "./ProductRequestHistoryTable.css";

const API = import.meta.env.VITE_API_URL;

export default function ProductRequestHistoryTable({ stockID, stockName }) {
  const navigate = useNavigate();

  const currentYear = new Date().getFullYear();

  const [data, setData] = useState(null);

  const [status, setStatus] = useState("Accepted");
  const [search, setSearch] = useState("");

  const [searchParams, setSearchParams] = useSearchParams();
  const urlYear = searchParams.get("year");

  const [year, setYear] = useState(urlYear || currentYear);
  const [yearOptions, setYearOptions] = useState([]);

  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: null,
  });

  const [currentPage, setCurrentPage] = useState(1);

  const rowsPerPage = 15;

  useEffect(() => {
    fetchYears();
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [stockID, status, search, year]);

  useEffect(() => {
    const urlYear = searchParams.get("year");

    if (!urlYear) {
      setSearchParams({ year: currentYear }, { replace: true });
      setYear(currentYear);
    } else {
      setYear(urlYear === "ALL" ? "ALL" : Number(urlYear));
    }
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [status, search, year]);

  const fetchYears = async () => {
    try {
      const res = await axios.get(`${API}/api/stocks/reqyears`);
      setYearOptions(res.data.map(Number));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRequests = async () => {
    try {
      setData(null);

      const delay = new Promise((resolve) => setTimeout(resolve, 500));

      const request = axios.get(`${API}/api/stocks/${stockID}/requests`, {
        params: {
          status,
          search,
          year,
        },
        withCredentials: true,
      });

      const [res] = await Promise.all([request, delay]);

      setData(res.data);
    } catch (err) {
      console.error(err);

      setData({
        items: [],
        counts: {},
      });
    }
  };

  const availableYears = useMemo(() => {
    return new Set(yearOptions.map(Number));
  }, [yearOptions]);

  const items = data?.items || [];

  const counts = data?.counts || {
    ALL: 0,
    Pending: 0,
    Accepted: 0,
    Rejected: 0,
  };

  const filtered = useMemo(() => {
    let temp = [...items];

    if (sortConfig.key) {
      temp.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (sortConfig.key.includes("At") || sortConfig.key.includes("Date")) {
          aVal = new Date(aVal);
          bVal = new Date(bVal);
        }

        if (typeof aVal === "string") {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }

        return sortConfig.direction === "asc"
          ? aVal > bVal
            ? 1
            : -1
          : aVal < bVal
            ? 1
            : -1;
      });
    }

    return temp;
  }, [items, sortConfig]);

  const totalPages = Math.ceil(filtered.length / rowsPerPage);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;

    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, currentPage]);

  const handleSort = (key) => {
    let direction = "asc";

    if (sortConfig.key === key) {
      if (sortConfig.direction === "asc") {
        direction = "desc";
      } else if (sortConfig.direction === "desc") {
        direction = null;
      }
    }

    setSortConfig({
      key: direction ? key : null,
      direction,
    });
  };

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <FaSort className="sort-icon" />;
    }

    if (sortConfig.direction === "asc") {
      return <FaSortUp className="sort-icon" />;
    }

    if (sortConfig.direction === "desc") {
      return <FaSortDown className="sort-icon" />;
    }

    return <FaSort className="sort-icon" />;
  };

  if (!data) {
    return (
      <div className="spinner-container">
        <BeatLoader size={15} color="#1e3a8a" />
      </div>
    );
  }

  const cardStyles = {
    ALL: "requisition-summary-card all",
    Pending: "requisition-summary-card pending",
    Accepted: "requisition-summary-card accepted",
    Rejected: "requisition-summary-card rejected",
  };

  return (
    <div className="product-request-history-container">
      {/* HEADER */}
      <div className="req-details-item-between">
        <h1 className="req-details-item-header">
          Product Requests{" "}
          <span className="req-acc-grandtotal">({stockName})</span>
        </h1>

        <div className="requisition-control-status-tabs">
          {["ALL", "Pending", "Accepted", "Rejected"].map((s) => (
            <div key={s} className={cardStyles[s]} onClick={() => setStatus(s)}>
              <span>{s === "ALL" ? "ALL REQUESTS" : s.toUpperCase()}</span>

              <h2>{counts[s]}</h2>
            </div>
          ))}
        </div>
      </div>

      {/* FILTER */}
      <div className="requisition-control-top">
        <div className="requisition-control-search-filter">
          <div className="search-wrapper">
            <FaSearch className="search-icon" />

            <input
              type="text"
              placeholder="Search Req No, Requester, Division"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="stock-search"
            />
          </div>
        </div>

        <div className="year-filter">
          <p className="date-range-label">Year:</p>

          <DatePicker
            className="year-range"
            selected={typeof year === "number" ? new Date(year, 0) : null}
            onChange={(date) => {
              const selectedYear = date.getFullYear();

              setYear(selectedYear);

              setSearchParams({ year: selectedYear }, { replace: true });
            }}
            showYearPicker
            dateFormat="yyyy"
            placeholderText="Select Year"
            filterDate={(date) => {
              const y = date.getFullYear();

              return availableYears.has(y);
            }}
          />

          <button
            className="year-overall"
            onClick={() => {
              setYear("ALL");

              setSearchParams({ year: "ALL" }, { replace: true });
            }}
          >
            Overall
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="req-acc-table-wrapper">
        <table className="req-acc-table">
          <thead>
            <tr>
              <th>#</th>

              <th>Req No.</th>

              <th
                onClick={() => handleSort("RequesterName")}
                className="sortable"
              >
                Requester {renderSortIcon("RequesterName")}
              </th>

              <th
                onClick={() => handleSort("TotalAmount")}
                className="sortable"
              >
                Total Amount {renderSortIcon("TotalAmount")}
              </th>

              <th onClick={() => handleSort("Quantity")} className="sortable">
                Quantity {renderSortIcon("Quantity")}
              </th>

              <th
                onClick={() => handleSort("RequestedAt")}
                className="sortable"
              >
                Request Date {renderSortIcon("RequestedAt")}
              </th>

              <th>Status</th>

              <th
                onClick={() => handleSort("ProcessedAt")}
                className="sortable"
              >
                Processed {renderSortIcon("ProcessedAt")}
              </th>

              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan="9" className="no-data">
                  No requests found
                </td>
              </tr>
            ) : (
              paginated.map((item, index) => (
                <tr
                  key={item.RequestDetailsID}
                  onClick={() =>
                    navigate(`/admin/requisition-control/${item.RequisitionNo}`)
                  }
                >
                  <td>{(currentPage - 1) * rowsPerPage + index + 1}</td>

                  <td>{item.RequisitionNo}</td>

                  <td>
                    <div className="stock-item-name">{item.RequesterName}</div>
                    <div className="stock-item-desc">{item.DepartmentName}</div>
                  </td>

                  <td>
                    Php.{" "}
                    {Number(item.TotalAmount).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>

                  <td>{item.Quantity}</td>

                  <td>{formatDateTime(item.RequestedAt)}</td>

                  <td>
                    <span className={`status ${item.StatusName}`}>
                      {item.StatusName}
                    </span>
                  </td>

                  <td>
                    {item.ProcessedAt ? formatDateTime(item.ProcessedAt) : "-"}
                  </td>

                  <td>
                    <button
                      className="view-btn"
                      onClick={(e) => {
                        e.stopPropagation();

                        navigate(
                          `/admin/requisition-control/${item.RequisitionNo}`,
                        );
                      }}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
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
      )}
    </div>
  );
}
