import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { formatDateTime } from "../../Utilities/FormatDateTime";
import { useAuditLogs } from "../../hooks/AuditLogs/useAuditlogs";
import { FaSearch, FaSort, FaSortUp, FaSortDown } from "react-icons/fa";
import BeatLoader from "react-spinners/BeatLoader";
import "./AuditLogs.css";

export default function AuditLogs() {
  const [locations, setLocations] = useState([]);
  const [actions, setActions] = useState([]);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 100;

  const API_URL = import.meta.env.VITE_API_URL;

  //  REMOVE search from backend call
  const { data, isLoading } = useAuditLogs({
    location: locationFilter,
    action: actionFilter,
    from: dateRange.from,
    to: dateRange.to,
    page: currentPage,
    limit: rowsPerPage,
  });

  const logs = data?.data || [];

  //  RESET PAGE ONLY WHEN FILTERS CHANGE (NOT SEARCH)
  useEffect(() => {
    setCurrentPage(1);
  }, [locationFilter, actionFilter, dateRange]);

  // Fetch locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const locRes = await axios.get(`${API_URL}/api/audit-logs/locations`);
        setLocations(locRes.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchLocations();
  }, []);

  // Fetch actions based on location
  useEffect(() => {
    const fetchActions = async () => {
      try {
        const actRes = await axios.get(`${API_URL}/api/audit-logs/actions`, {
          params: { location: locationFilter },
        });
        setActions(actRes.data);
        setActionFilter("");
      } catch (err) {
        console.error(err);
      }
    };
    fetchActions();
  }, [locationFilter]);

  //  FRONTEND SEARCH FILTER
  const filteredLogs = useMemo(() => {
    const searchLower = search.toLowerCase();

    return logs.filter((log) => {
      return (
        log.Details?.toLowerCase().includes(searchLower) ||
        log.Firstname?.toLowerCase().includes(searchLower) ||
        log.Lastname?.toLowerCase().includes(searchLower) ||
        log.Location?.toLowerCase().includes(searchLower) ||
        log.Action?.toLowerCase().includes(searchLower)
      );
    });
  }, [logs, search]);

  // Sorting
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key) {
      if (sortConfig.direction === "asc") direction = "desc";
      else if (sortConfig.direction === "desc") direction = null;
    }
    setSortConfig({ key: direction ? key : null, direction });
  };

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return <FaSort className="sort-icon" />;
    if (sortConfig.direction === "asc")
      return <FaSortUp className="sort-icon" />;
    if (sortConfig.direction === "desc")
      return <FaSortDown className="sort-icon" />;
    return <FaSort className="sort-icon" />;
  };

  //  SORT AFTER FILTER
  const sortedLogs = useMemo(() => {
    let data = [...filteredLogs];

    if (sortConfig.key) {
      data.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (typeof aVal === "string") {
          return sortConfig.direction === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        return sortConfig.direction === "asc"
          ? new Date(aVal) - new Date(bVal)
          : new Date(bVal) - new Date(aVal);
      });
    }

    return data;
  }, [filteredLogs, sortConfig]);

  //  TOTAL BASED ON FRONTEND FILTER
  const totalPages = data?.totalPages || 1;

  const resetDateRange = () => {
    setDateRange({ from: "", to: "" });
  };

  if (isLoading)
    return (
      <div className="spinner-container">
        <BeatLoader size={15} color="#1e3a8a" />
      </div>
    );

  return (
    <div className="audit-container">
      <div className="audit-top">
        <h2 className="audit-header">Audit Logs</h2>

        <div className="date-range">
          <span className="date-range-label">From</span>
          <input
            className="date-range-type"
            type="date"
            value={dateRange.from}
            onChange={(e) =>
              setDateRange({ ...dateRange, from: e.target.value })
            }
          />

          <span className="date-range-label">to</span>
          <input
            className="date-range-type"
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
          />

          <button className="clear-date-btn" onClick={resetDateRange}>
            Clear
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="invoice-top-bar">
        <div className="filter-group">
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

          <div className="audit-filters">
            <div className="audit-label-item">
              <p className="filter-label">Filter by Locations:</p>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              >
                <option value="">All</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            <div className="audit-label-item">
              <p className="filter-label">Filter by Actions:</p>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              >
                <option value="">All</option>
                {actions.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <table className="audit-table">
        <thead>
          <tr>
            <th>#</th>
            <th onClick={() => handleSort("Location")} className="sortable">
              Location {renderSortIcon("Location")}
            </th>
            <th onClick={() => handleSort("Action")} className="sortable">
              Action {renderSortIcon("Action")}
            </th>
            <th>Details</th>
            <th onClick={() => handleSort("Firstname")} className="sortable">
              Modified By {renderSortIcon("Firstname")}
            </th>
            <th onClick={() => handleSort("RecordedAt")} className="sortable">
              Date Recorded {renderSortIcon("RecordedAt")}
            </th>
          </tr>
        </thead>

        <tbody>
          {sortedLogs.map((log, idx) => (
            <tr key={log.AuditID}>
              <td>{(currentPage - 1) * rowsPerPage + idx + 1}</td>
              <td>{log.Location}</td>
              <td>{log.Action}</td>
              <td>{log.Details}</td>
              <td>{`${log.Firstname} ${log.Lastname}`}</td>
              <td>{formatDateTime(log.RecordedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
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
