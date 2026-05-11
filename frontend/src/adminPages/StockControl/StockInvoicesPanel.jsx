import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { FaSearch, FaSortUp, FaSortDown, FaSort } from "react-icons/fa";
import { FiMoreVertical } from "react-icons/fi";
import { formatDateTime } from "../../Utilities/FormatDateTime";
import QuantityInput from "../../Utilities/QuantityInput";
import "./StockInvoicesPanel.css";

import { FaChevronUp, FaChevronDown } from "react-icons/fa6";

export default function StockInvoicesPanel({ stockID }) {
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("active");
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState("InvoiceDate");
  const [sortDir, setSortDir] = useState("desc");
  const [openMenu, setOpenMenu] = useState(null);
  const [show, setShow] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingRow, setEditingRow] = useState(null);
  const [editQuantity, setEditQuantity] = useState("");

  const PAGE_SIZE = 50;

  useEffect(() => {
    fetchInvoices();
  }, [stockID]);

  useEffect(() => {
    setPage(1);
  }, [search, filter, dateFrom, dateTo]);

  useEffect(() => {
    const close = () => setOpenMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const fetchInvoices = async () => {
    const res = await axios.get(
      `${import.meta.env.VITE_API_URL}/api/stocks/${stockID}/invoices`,
    );
    setInvoices(res.data);
  };

  const filtered = useMemo(() => {
    let data = [...invoices];

    if (search) {
      data = data.filter((i) =>
        i.InvoiceNumber.toLowerCase().includes(search.toLowerCase()),
      );
    }

    if (filter === "active") {
      data = data.filter((i) => i.Quantity > 0);
    }

    if (filter === "empty") {
      data = data.filter((i) => i.Quantity === 0);
    }

    // DATE RANGE FILTER
    if (dateFrom) {
      data = data.filter((i) => new Date(i.InvoiceDate) >= new Date(dateFrom));
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      data = data.filter((i) => new Date(i.InvoiceDate) <= toDate);
    }

    if (sortField) {
      data.sort((a, b) => {
        let v1 = a[sortField];
        let v2 = b[sortField];

        if (sortField === "InvoiceDate") {
          v1 = new Date(v1);
          v2 = new Date(v2);
        }

        if (v1 > v2) return sortDir === "asc" ? 1 : -1;
        if (v1 < v2) return sortDir === "asc" ? -1 : 1;
        return 0;
      });
    }

    return data;
  }, [invoices, search, filter, sortField, sortDir, dateFrom, dateTo]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const toggleSort = (field) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDir("asc");
      return;
    }

    if (sortDir === "asc") {
      setSortDir("desc");
      return;
    }

    if (sortDir === "desc") {
      setSortField(null);
      setSortDir(null);
      return;
    }

    setSortField(field);
    setSortDir("asc");
  };

  const sortIcon = (field) => {
    if (sortField !== field || !sortDir) {
      return (
        <FaSort className="stock-invoice-pannel-sort-icon sip-sort-default" />
      );
    }

    if (sortDir === "asc") {
      return (
        <FaSortUp className="stock-invoice-pannel-sort-icon sip-sort-asc" />
      );
    }

    if (sortDir === "desc") {
      return (
        <FaSortDown className="stock-invoice-pannel-sort-icon sip-sort-desc" />
      );
    }
  };

  const handleEditQuantity = async (row) => {
    const { value: qty } = await Swal.fire({
      title: "Edit Invoice Quantity",
      text: `Current Quantity: ${row.Quantity}`,
      input: "number",
      inputValue: row.Quantity,
      inputAttributes: {
        min: 0,
      },
      showCancelButton: true,
      confirmButtonText: "Update",
      cancelButtonText: "Cancel",
    });

    if (qty === undefined) return;

    const newQty = Number(qty);
    const diff = newQty - row.Quantity;

    if (diff === 0) return;

    const confirm = await Swal.fire({
      title: "Confirm Quantity Change",
      text:
        diff > 0
          ? `Increase quantity by +${diff}?`
          : `Decrease quantity by ${diff}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, update",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    try {
      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/stocks/invoices/${row.StockInvoiceID}`,
        {
          quantity: newQty,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      await Swal.fire({
        icon: "success",
        title: "Updated!",
        timer: 1200,
        showConfirmButton: false,
      });

      fetchInvoices();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to update invoice quantity",
      });
    }
  };

  const startEdit = (row) => {
    setEditingRow(row.StockInvoiceID);
    setEditQuantity(row.Quantity);
    setOpenMenu(null);
  };

  const cancelEdit = () => {
    setEditingRow(null);
    setEditQuantity("");
  };

  const saveEdit = async (row) => {
    const newQty = Number(editQuantity);

    if (isNaN(newQty) || newQty < 0) {
      Swal.fire({
        icon: "error",
        title: "Invalid Quantity",
        text: "Quantity must be 0 or higher",
      });
      return;
    }

    const diff = newQty - row.Quantity;

    if (diff === 0) {
      cancelEdit();
      return;
    }

    const confirm = await Swal.fire({
      title: "Confirm Update",
      text:
        diff > 0
          ? `Add +${diff} items to inventory?`
          : `Remove ${Math.abs(diff)} items from inventory?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, update",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    try {
      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/stocks/invoices/${row.StockInvoiceID}`,
        { quantity: newQty },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      await Swal.fire({
        icon: "success",
        title: "Invoice Updated",
        text:
          diff > 0
            ? `+${diff} items added to inventory`
            : `${Math.abs(diff)} items removed from inventory`,
        timer: 1500,
        showConfirmButton: false,
      });

      cancelEdit();
      fetchInvoices();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: "Server error updating invoice",
      });
    }
  };

  return (
    <div className="stock-invoice-pannel-section">
      <div
        className="stock-invoice-pannel-toggle"
        onClick={() => setShow(!show)}
      >
        Sales Invoice
        <span>{show ? <FaChevronUp /> : <FaChevronDown />}</span>
      </div>

      {show && (
        <div className="stock-invoice-pannel-card">
          <div className="stock-invoice-pannel-toolbar">
            <div className="stock-invoice-pannel-toolbar-left">
              <div className="search-wrapper">
                <FaSearch className="search-icon" />
                <input
                  placeholder="Search invoice number"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="stock-invoice-pannel-search"
                />
              </div>

              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="empty">Empty</option>
              </select>
            </div>

            <div className="date-range">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />

              <span>to</span>

              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <table className="stock-invoice-pannel-table">
            <thead>
              <tr>
                <th>#</th>
                <th
                  onClick={() => toggleSort("InvoiceNumber")}
                  className="sortable"
                >
                  Sales Invoice #{sortIcon("InvoiceNumber")}
                </th>
                <th onClick={() => toggleSort("Quantity")} className="sortable">
                  Quantity
                  {sortIcon("Quantity")}
                </th>

                <th>Total Amount</th>
                <th
                  onClick={() => toggleSort("InvoiceDate")}
                  className="sortable"
                >
                  Arrived At
                  {sortIcon("InvoiceDate")}
                </th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {paginated.map((row, i) => (
                <tr key={row.StockInvoiceID}>
                  <td
                    onClick={() =>
                      navigate(`/admin/invoice-management/${row.InvoiceNumber}`)
                    }
                  >
                    {(page - 1) * PAGE_SIZE + i + 1}
                  </td>
                  <td
                    onClick={() =>
                      navigate(`/admin/invoice-management/${row.InvoiceNumber}`)
                    }
                  >
                    {row.InvoiceNumber}
                  </td>
                  <td>
                    {editingRow === row.StockInvoiceID ? (
                      <QuantityInput
                        className="invoice-edit-input"
                        value={editQuantity}
                        onChange={setEditQuantity}
                      />
                    ) : (
                      row.Quantity
                    )}
                  </td>
                  <td>
                    Php.{" "}
                    {Number(row.TotalAmount).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td>{formatDateTime(row.InvoiceDate)}</td>
                  <td>
                    {editingRow === row.StockInvoiceID ? (
                      <div className="invoice-actions">
                        <button
                          className="save-btn"
                          onClick={() => saveEdit(row)}
                        >
                          Save
                        </button>

                        <button className="cancel-btn" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="invoice-actions">
                        <button
                          className="view-btn"
                          onClick={() =>
                            navigate(
                              `/admin/invoice-management/${row.InvoiceNumber}`,
                            )
                          }
                        >
                          Details
                        </button>

                        <div className="menu-wrapper">
                          <FiMoreVertical
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenu(
                                openMenu === row.StockInvoiceID
                                  ? null
                                  : row.StockInvoiceID,
                              );
                            }}
                          />

                          {openMenu === row.StockInvoiceID && (
                            <div className="dropdown-menu">
                              <div
                                className="dropdown-item"
                                onClick={() => startEdit(row)}
                              >
                                Edit
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <button
              disabled={page === 1}
              onClick={() => setPage((prev) => prev - 1)}
            >
              Prev
            </button>

            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                className={page === i + 1 ? "active-page" : ""}
                onClick={() => setPage(i + 1)}
              >
                {i + 1}
              </button>
            ))}

            <button
              disabled={page === totalPages}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
