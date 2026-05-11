import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { formatDateTime } from "../../Utilities/FormatDateTime";
import RegisterInvoiceModal from "./RegisterInvoiceModal";
import { useInvoices } from "../../hooks/Invoices/useInvoices";
import BeatLoader from "react-spinners/BeatLoader";

import Swal from "sweetalert2";
import "./InvoiceManagement.css";

import { FaSearch, FaSortUp, FaSortDown, FaSort } from "react-icons/fa";

export default function InvoiceManagement() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const status = searchParams.get("status") || "Active";

  useEffect(() => {
    setCurrentPage(1);
  }, [status, dateRange, search]);

  const { data: invoices = [], isLoading } = useInvoices({
    status,
    from: dateRange.from,
    to: dateRange.to,
  });

  // SORT CONFIG
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
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

  // SEARCH + SORT
  const filteredInvoices = useMemo(() => {
    let data = invoices.filter((inv) =>
      `${inv.InvoiceNumber} ${inv.AdminName} ${inv.StockItems}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );

    if (sortConfig.key) {
      data.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (typeof aVal === "number")
          return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;

        return sortConfig.direction === "asc"
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
    }
    return data;
  }, [invoices, search, sortConfig]);

  const totalPages = Math.ceil(filteredInvoices.length / rowsPerPage);
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredInvoices.slice(start, start + rowsPerPage);
  }, [filteredInvoices, currentPage]);

  const resetDateRange = () => {
    setDateRange({ from: "", to: "" });
  };

  if (isLoading) {
    return (
      <div className="spinner-container">
        <BeatLoader size={15} color="#1e3a8a" />
      </div>
    );
  }

  return (
    <div className="invoice-container">
      <div className="invoice-top">
        <h2 className="invoice-header">Invoice Management</h2>
        <div className="date-range">
          <span className="date-range-label">From</span>
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) =>
              setDateRange({ ...dateRange, from: e.target.value })
            }
          />
          <span className="date-range-label">to</span>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
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

      {/* FILTERS */}
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

          <select
            value={status}
            onChange={(e) =>
              navigate(`/admin/invoice-management?status=${e.target.value}`)
            }
            className="status-filter"
          >
            <option value="All">All Invoices</option>
            <option value="Active">Active</option>
            <option value="Empty">Empty</option>
          </select>
        </div>

        <button className="add-btn" onClick={() => setShowRegisterModal(true)}>
          Register New Invoice
        </button>
      </div>

      {/* TABLE */}
      <table className="invoice-table">
        <thead>
          <tr>
            <th>#</th>
            <th
              onClick={() => handleSort("InvoiceNumber")}
              className="sortable"
            >
              Sales Invoice# {renderSortIcon("InvoiceNumber")}
            </th>
            <th onClick={() => handleSort("StockItems")} className="sortable">
              Stock Items {renderSortIcon("StockItems")}
            </th>
            <th onClick={() => handleSort("Quantity")} className="sortable">
              Quantity {renderSortIcon("Quantity")}
            </th>
            <th onClick={() => handleSort("TotalAmount")} className="sortable">
              Total Amount {renderSortIcon("TotalAmount")}
            </th>
            <th onClick={() => handleSort("InvoiceDate")} className="sortable">
              Arrive At {renderSortIcon("InvoiceDate")}
            </th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedInvoices.map((inv, idx) => (
            <tr
              key={inv.InvoiceID}
              onClick={() =>
                navigate(`/admin/invoice-management/${inv.InvoiceNumber}`)
              }
            >
              <td>{(currentPage - 1) * rowsPerPage + idx + 1}</td>
              <td>{inv.InvoiceNumber}</td>
              <td>{inv.StockItems}</td>
              <td>{inv.Quantity}</td>
              <td>
                Php.{" "}
                {Number(inv.TotalAmount).toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
              <td>{formatDateTime(inv.InvoiceDate)}</td>
              <td>
                <button
                  className="view-btn"
                  onClick={() =>
                    navigate(`/admin/invoice-management/${inv.InvoiceNumber}`)
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

      {showRegisterModal && (
        <RegisterInvoiceModal
          close={() => setShowRegisterModal(false)}
          refresh={() => {
            queryClient.invalidateQueries(["invoices"]);
          }}
        />
      )}
    </div>
  );
}
