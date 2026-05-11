import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { useRequisitions } from "../../hooks/requisition/useRequisitions";
import { formatDateTime } from "../../Utilities/FormatDateTime";
import NewRequisitionModal from "./NewRequisitionModal";
import "./RequisitionControl.css";
import BeatLoader from "react-spinners/BeatLoader";

import { FaSearch, FaSort, FaSortUp, FaSortDown } from "react-icons/fa";

export default function RequisitionControl() {
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");

  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const formatStatus = (s) => {
    if (!s) return "ALL";
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  };

  const initialStatus = formatStatus(searchParams.get("status"));
  const [status, setStatus] = useState(initialStatus);

  // PAGINATION
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  // SORT
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: null,
  });

  // DATE FILTER
  const [dateType, setDateType] = useState("RequestedAt");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (status === "ALL") {
      searchParams.delete("status");
    } else {
      searchParams.set("status", status.toLowerCase());
    }
    setSearchParams(searchParams, { replace: true });
  }, [status]);

  useEffect(() => {
    const urlStatus = formatStatus(searchParams.get("status"));
    setStatus(urlStatus);
  }, [searchParams]);

  // SORT HANDLER
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

  const { data: requests = [], isLoading } = useRequisitions({
    status,
    from: dateFrom,
    to: dateTo,
    dateType,
  });

  // FILTER + SORT
  const filtered = useMemo(() => {
    let data = requests.filter((r) => {
      const text =
        `${r.RequisitionNo} ${r.Firstname} ${r.Lastname}`.toLowerCase();
      const matchSearch = text.includes(search.toLowerCase());

      const matchStatus = status === "ALL" || r.StatusName === status;

      let matchDate = true;

      if (dateFrom || dateTo) {
        const rowDate = new Date(r[dateType]);

        if (dateFrom) {
          matchDate = matchDate && rowDate >= new Date(dateFrom);
        }

        if (dateTo) {
          matchDate = matchDate && rowDate <= new Date(dateTo);
        }
      }

      return matchSearch && matchStatus && matchDate;
    });

    // SORT
    if (sortConfig.key) {
      data.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (sortConfig.key === "Requester") {
          aValue = `${a.Firstname} ${a.Lastname}`;
          bValue = `${b.Firstname} ${b.Lastname}`;
        }

        if (
          sortConfig.key === "RequestedAt" ||
          sortConfig.key === "ProcessedAt"
        ) {
          aValue = new Date(aValue);
          bValue = new Date(bValue);
        }

        if (typeof aValue === "number") {
          return sortConfig.direction === "asc"
            ? aValue - bValue
            : bValue - aValue;
        }

        return sortConfig.direction === "asc"
          ? String(aValue).localeCompare(String(bValue))
          : String(bValue).localeCompare(String(aValue));
      });
    }

    return data;
  }, [requests, search, status, sortConfig, dateFrom, dateTo, dateType]);

  // PAGINATION
  const totalPages = Math.ceil(filtered.length / rowsPerPage);

  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, status, dateFrom, dateTo]);

  // COUNTS
  const counts = {
    ALL: requests.length,
    Pending: requests.filter((r) => r.StatusName === "Pending").length,
    Accepted: requests.filter((r) => r.StatusName === "Accepted").length,
    Rejected: requests.filter((r) => r.StatusName === "Rejected").length,
  };

  const cardStyles = {
    ALL: "requisition-summary-card all",
    Pending: "requisition-summary-card pending",
    Accepted: "requisition-summary-card accepted",
    Rejected: "requisition-summary-card rejected",
  };

  const resetDateRange = () => {
    setDateFrom(""); // Reset to empty string
    setDateTo(""); // Reset to empty string
  };

  if (isLoading) {
    return (
      <div className="spinner-container">
        <BeatLoader size={15} color="#1e3a8a" />
      </div>
    );
  }

  return (
    <div className="requisition-control-container">
      <div className="requisition-control-top">
        <div className="requisition-control-header-left">
          <h1 className="stock-header">Requisition Control</h1>

          <div className="requisition-control-status-tabs">
            {["ALL", "Pending", "Accepted", "Rejected"].map((s) => (
              <div
                key={s}
                className={cardStyles[s]}
                onClick={() => setStatus(s)}
              >
                <span>{s === "ALL" ? "ALL REQUEST" : s.toUpperCase()}</span>
                <h2>{counts[s]}</h2>
              </div>
            ))}
          </div>
        </div>
        {/* DATE RANGE */}
        <div className="date-range">
          <select
            className="date-range-type"
            value={dateType}
            onChange={(e) => setDateType(e.target.value)}
          >
            <option value="RequestedAt">Request Date</option>
            <option value="ProcessedAt">Processed Date</option>
          </select>

          <span>From</span>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />

          <span>To</span>

          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />

          <button
            className="clear-date-btn"
            onClick={resetDateRange}
            title="Clear Dates"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="requisition-control-top">
        <div className="search-wrapper">
          <FaSearch className="search-icon" />
          <input
            placeholder="Search req number, requester"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="stock-search"
          />
        </div>

        <button className="add-btn" onClick={() => setShowModal(true)}>
          Create New Requisition
        </button>
      </div>

      <table className="req-table">
        <thead>
          <tr>
            <th>#</th>

            <th>Req No.</th>

            <th onClick={() => handleSort("Requester")} className="sortable">
              Requester {renderSortIcon("Requester")}
            </th>

            <th onClick={() => handleSort("ItemCount")} className="sortable">
              Items {renderSortIcon("ItemCount")}
            </th>

            <th
              onClick={() => handleSort("TotalQuantity")}
              className="sortable"
            >
              Quantity {renderSortIcon("TotalQuantity")}
            </th>
            <th>Total Amount</th>

            <th onClick={() => handleSort("RequestedAt")} className="sortable">
              Request Date {renderSortIcon("RequestedAt")}
            </th>

            <th>Status</th>

            <th onClick={() => handleSort("ProcessedAt")} className="sortable">
              Processed Date {renderSortIcon("ProcessedAt")}
            </th>

            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {paginatedRequests.map((r, index) => (
            <tr
              key={r.RequestID}
              onClick={() =>
                navigate(`/admin/requisition-control/${r.RequisitionNo}`)
              }
            >
              <td>{(currentPage - 1) * rowsPerPage + index + 1}</td>

              <td>{r.RequisitionNo}</td>

              <td>
                <div className="employee-name">
                  {r.Firstname} {r.Lastname}
                </div>
                <small>{r.DepartmentName}</small>
              </td>

              <td>{r.ItemCount}</td>
              <td>{r.TotalQuantity}</td>
              <td>
                PHP.{" "}
                {Number(r.TotalAmount).toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>

              <td>{formatDateTime(r.RequestedAt)}</td>

              <td>
                <span className={`status ${r.StatusName}`}>{r.StatusName}</span>
              </td>

              <td>{r.ProcessedAt ? formatDateTime(r.ProcessedAt) : "-"}</td>

              <td>
                <button
                  onClick={() =>
                    navigate(`/admin/requisition-control/${r.RequisitionNo}`)
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

      {/* PAGINATION */}

      <div className="pagination">
        <button
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((prev) => prev - 1)}
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
          onClick={() => setCurrentPage((prev) => prev + 1)}
        >
          Next
        </button>
      </div>

      {showModal && (
        <NewRequisitionModal
          close={() => setShowModal(false)}
          refresh={() => queryClient.invalidateQueries(["requisitions"])}
        />
      )}
    </div>
  );
}
