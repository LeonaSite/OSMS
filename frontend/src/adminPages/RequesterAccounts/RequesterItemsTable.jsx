import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { formatDateTime } from "../../Utilities/FormatDateTime";
import BeatLoader from "react-spinners/BeatLoader";
import { useNavigate, useSearchParams } from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FaSort, FaSortUp, FaSortDown, FaSearch } from "react-icons/fa";

const API = import.meta.env.VITE_API_URL;

export default function RequesterItemsTable({ username }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");

  const currentYear = new Date().getFullYear();

  const [type, setType] = useState("DIVISION");
  const [searchParams, setSearchParams] = useSearchParams();
  const urlYear = searchParams.get("year");

  const [year, setYear] = useState(urlYear || currentYear);
  const [yearOptions, setYearOptions] = useState([]);

  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: null,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  const navigate = useNavigate();

  useEffect(() => {
    fetchItems();
  }, [username, status, search, type, year]);

  const fetchYears = async () => {
    try {
      const res = await axios.get(`${API}/api/requesterAccounts/reqyears`);
      setYearOptions(res.data.map(Number));
    } catch (err) {
      console.error(err);
    }
  };

  const availableYears = useMemo(() => {
    return new Set(yearOptions.map(Number));
  }, [yearOptions]);

  useEffect(() => {
    fetchYears();
  }, []);

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
    const urlYear = searchParams.get("year");

    if (!urlYear) return;

    const parsed = urlYear === "ALL" ? "ALL" : Number(urlYear);

    if (parsed !== year) {
      setYear(parsed); // ✅ FIX
    }
  }, [searchParams]);

  const fetchItems = async () => {
    try {
      const res = await axios.get(
        `${API}/api/requesterAccounts/${username}/items`,
        {
          params: {
            status,
            search,
            type,
            year,
          },
        },
      );
      setData(res.data);
    } catch (err) {
      console.error(err);
      setData({ items: [], counts: {} });
    }
  };

  const items = data?.items || [];
  const counts = data?.counts || {
    ALL: 0,
    Pending: 0,
    Accepted: 0,
    Rejected: 0,
  };

  // 🔍 FILTER + SORT
  const filtered = useMemo(() => {
    let temp = [...items];

    if (sortConfig.key) {
      temp.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (sortConfig.key.includes("At")) {
          aVal = new Date(aVal);
          bVal = new Date(bVal);
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
  }, [items, status, search, sortConfig]);

  // 📄 PAGINATION
  const totalPages = Math.ceil(filtered.length / rowsPerPage);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [status, search]);

  // 🔃 SORT
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
    if (sortConfig.key !== key) return <FaSort className="sort-icon" />;
    if (sortConfig.direction === "asc")
      return <FaSortUp className="sort-icon" />;
    if (sortConfig.direction === "desc")
      return <FaSortDown className="sort-icon" />;
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
    <div>
      {/* TOP SECTION */}
      <div className="req-details-item-between">
        <h1 className="req-details-item-header">
          Requested Items{" "}
          <span className="req-acc-grandtotal">
            {"( "}Php.{" "}
            {items
              .reduce((sum, item) => sum + Number(item.TotalAmount || 0), 0)
              .toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            {" )"}
          </span>
        </h1>

        {/* STATUS TABS */}
        <div className="requisition-control-status-tabs">
          {["ALL", "Pending", "Accepted", "Rejected"].map((s) => (
            <div key={s} className={cardStyles[s]} onClick={() => setStatus(s)}>
              <span>{s === "ALL" ? "ALL ITEMS" : s.toUpperCase()}</span>
              <h2>{counts[s]}</h2>
            </div>
          ))}
        </div>
      </div>

      {/* SEARCH BAR (MATCHED) */}
      <div className="requisition-control-top">
        <div className="requisition-control-search-filter">
          <div className="search-wrapper">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search Invoice Number, Stock Items, Admin"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="stock-search"
            />
          </div>
          <div className="req-filtered">
            <p>Filtered by: </p>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="PERSONAL">Personal</option>
              <option value="DIVISION">Division</option>
            </select>
          </div>
        </div>

        <div className="year-filter">
          <p className="date-range-label">Year: </p>
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
              <th>Item</th>

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
            {paginated.map((item, index) => (
              <tr
                key={item.RequestDetailsID}
                onClick={() =>
                  navigate(`/admin/requisition-control/${item.RequisitionNo}`)
                }
              >
                <td>{(currentPage - 1) * rowsPerPage + index + 1}</td>

                <td>{item.RequisitionNo}</td>

                <td>
                  <strong>{item.StockName}</strong>
                  <br />
                  <small>{item.Description}</small>
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
                    onClick={() =>
                      navigate(
                        `/admin/requisition-control/${item.RequisitionNo}`,
                      )
                    }
                    className="view-btn"
                  >
                    Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
}
