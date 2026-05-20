import { useState, useMemo, useEffect } from "react";
import BeatLoader from "react-spinners/BeatLoader";
import { formatDateTime } from "../../Utilities/FormatDateTime";
import { FaSort, FaSortUp, FaSortDown, FaSearch } from "react-icons/fa";
import { useRequestList } from "../../hooks/RequestList/useRequestList";
import "./RequestedList.css";

export default function RequestedList() {
  const { data, isLoading } = useRequestList();

  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");

  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: null,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  // DATE FILTER
  const [dateType, setDateType] = useState("RequestedAt");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  // State to toggle date filters on mobile
  const [showDateFilters, setShowDateFilters] = useState(false);

  const items = data || [];

  // COUNTS
  const counts = {
    ALL: items.length,
    Pending: items.filter((i) => i.StatusName === "Pending").length,
    Accepted: items.filter((i) => i.StatusName === "Accepted").length,
    Rejected: items.filter((i) => i.StatusName === "Rejected").length,
  };

  // FILTER + SORT + DATE
  const filtered = useMemo(() => {
    let temp = [...items];

    if (status !== "ALL") {
      temp = temp.filter((i) => i.StatusName === status);
    }

    if (search) {
      temp = temp.filter((i) =>
        `${i.RequisitionNo} ${i.StockName} ${i.Description}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      );
    }

    // DATE FILTER
    if (dateFrom || dateTo) {
      temp = temp.filter((i) => {
        const rawDate = i[dateType];
        if (!rawDate) return false;

        const rowDate = new Date(rawDate);
        let valid = true;

        if (dateFrom) valid = valid && rowDate >= new Date(dateFrom);
        if (dateTo) valid = valid && rowDate <= new Date(dateTo);

        return valid;
      });
    }

    // SORT
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
  }, [items, status, search, sortConfig, dateFrom, dateTo, dateType]);

  // PAGINATION
  const totalPages = Math.ceil(filtered.length / rowsPerPage);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [status, search, dateFrom, dateTo]);

  // SORT
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

  const resetDateRange = () => {
    setDateFrom("");
    setDateTo("");
  };

  if (isLoading) {
    return (
      <div className="spinner-container">
        <BeatLoader size={12} color="#1e3a8a" />
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
    <div className="req-list-container">
      <div className="req-list-header">
        <div className="req-list-header-filter">
          <h2 className="req-list-title">My Requests</h2>
          {/* STATUS */}
          <div className="requisition-control-status-tabs">
            {["ALL", "Pending", "Accepted", "Rejected"].map((s) => (
              <div
                key={s}
                className={cardStyles[s]}
                onClick={() => setStatus(s)}
              >
                <span>{s}</span>
                <h2>{counts[s]}</h2>
              </div>
            ))}
          </div>
        </div>

        {/* DATE FILTERS */}
        <div className="date-filter-section">
          <button
            className="mobile-date-toggle"
            onClick={() => setShowDateFilters(!showDateFilters)}
          >
            {showDateFilters ? "Hide Date Filters" : "Filter by Date"}
          </button>

          <div className={`date-range ${showDateFilters ? "show" : ""}`}>
            <select
              className="date-range-type"
              value={dateType}
              onChange={(e) => setDateType(e.target.value)}
            >
              <option value="RequestedAt">Request Date</option>
              <option value="ProcessedAt">Processed Date</option>
            </select>

            <div className="date-inputs-row">
              <div className="date-input-group">
                <span>From</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>

              <div className="date-input-group">
                <span>To</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            <button className="clear-date-btn" onClick={resetDateRange}>
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="req-list-control-top">
        <div className="search-wrapper">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search Req No., Items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="stock-search"
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="req-list-table-wrapper">
        <table className="req-list-table">
          <thead>
            <tr>
              <th>#</th>
              <th
                onClick={() => handleSort("RequisitionNo")}
                className="sortable"
              >
                Req No. {renderSortIcon("RequisitionNo")}
              </th>
              <th>Item</th>
              <th onClick={() => handleSort("Quantity")} className="sortable">
                Quantity {renderSortIcon("Quantity")}
              </th>
              <th
                onClick={() => handleSort("RequestedAt")}
                className="sortable"
              >
                Requested At {renderSortIcon("RequestedAt")}
              </th>
              <th>Status</th>
              <th
                onClick={() => handleSort("ProcessedAt")}
                className="sortable"
              >
                Processed At {renderSortIcon("ProcessedAt")}
              </th>
              <th>Remarks</th>
            </tr>
          </thead>

          <tbody>
            {paginated.map((item, index) => (
              <tr key={item.RequestDetailsID}>
                <td data-label="#">
                  {(currentPage - 1) * rowsPerPage + index + 1}
                </td>
                <td data-label="Req No.">{item.RequisitionNo}</td>
                <td data-label="Item">
                  <div className="item-details-wrapper">
                    <div className="select-item-name">{item.StockName}</div>
                    <div className="select-item-desc">{item.Description}</div>
                  </div>
                </td>
                <td data-label="Quantity">{item.Quantity}</td>
                <td data-label="Requested At">
                  {formatDateTime(item.RequestedAt)}
                </td>
                <td data-label="Status">
                  <span className={`status ${item.StatusName}`}>
                    {item.StatusName}
                  </span>
                </td>
                <td data-label="Processed At">
                  {item.ProcessedAt ? formatDateTime(item.ProcessedAt) : "-"}
                </td>
                <td data-label="Remarks">{item.Remarks || "-"}</td>
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
