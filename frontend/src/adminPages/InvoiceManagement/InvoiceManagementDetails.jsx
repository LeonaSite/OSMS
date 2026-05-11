import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import BeatLoader from "react-spinners/BeatLoader";
import { formatDateTime } from "../../Utilities/FormatDateTime";
import QuantityInput from "../../Utilities/QuantityInput";

import "./InvoiceManagementDetails.css";
import { FaSearch } from "react-icons/fa";
import { RiReceiptFill } from "react-icons/ri";
import { MdHistory } from "react-icons/md";
import { FiMoreVertical } from "react-icons/fi";

export default function InvoiceManagementDetails() {
  const navigate = useNavigate();
  const { invoiceNo } = useParams();

  const [invoice, setInvoice] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [grandTotal, setGrandTotal] = useState(null);
  const [search, setSearch] = useState("");
  const [openMenu, setOpenMenu] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [history, setHistory] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDetails();
  }, [invoiceNo]);

  useEffect(() => {
    const closeMenu = () => setOpenMenu(null);

    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const fetchDetails = async () => {
    try {
      setLoading(true);

      const delay = new Promise((resolve) => setTimeout(resolve, 500));

      const fetchRes = axios.get(
        `${import.meta.env.VITE_API_URL}/api/invoices/details/${invoiceNo}`,
      );

      const [res] = await Promise.all([fetchRes, delay]);

      setInvoice(res.data.invoice);
      setStocks(res.data.stocks);
      setGrandTotal(res.data.grandTotal);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredStocks = useMemo(() => {
    return stocks.filter((s) =>
      `${s.StockCardID} ${s.StockName} ${s.Description}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  }, [stocks, search]);

  const totalQuantity = useMemo(() => {
    return filteredStocks.reduce((sum, s) => sum + Number(s.Quantity || 0), 0);
  }, [filteredStocks]);

  if (loading) {
    return (
      <div className="spinner-container">
        <BeatLoader size={15} color="#1e3a8a" />
      </div>
    );
  }

  if (!invoice) return null;

  const startEdit = (row) => {
    if (editingRow !== null) return;

    setEditingRow(row.StockInvoiceID);
    setEditQuantity(row.Quantity);
    setOpenMenu(null);
  };

  const cancelEdit = () => {
    setEditingRow(null);
    setEditQuantity("");
  };

  const saveEdit = async (row) => {
    const oldQty = Number(row.Quantity);
    const newQty = Number(editQuantity);
    const diff = newQty - oldQty;

    if (diff === 0) {
      Swal.fire("No changes", "Quantity is the same.", "info");
      return;
    }

    const action = diff > 0 ? "add" : "remove";
    const itemCount = Math.abs(diff);

    const confirm = await Swal.fire({
      title: diff > 0 ? "Add items?" : "Remove items?",
      text:
        diff > 0
          ? `You are about to add ${itemCount} item(s) to this invoice record.`
          : `You are about to remove ${itemCount} item(s) from this invoice record.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: diff > 0 ? "Yes, add items" : "Yes, remove items",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    try {
      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/invoices/update-quantity/${row.StockInvoiceID}`,
        { quantity: newQty },
      );

      await Swal.fire({
        icon: "success",
        title:
          diff > 0
            ? `${itemCount} item(s) added`
            : `${itemCount} item(s) removed`,
        timer: 1400,
        showConfirmButton: false,
      });

      setEditingRow(null);
      fetchDetails();
    } catch (err) {
      Swal.fire("Error", "Failed to update quantity", "error");
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/invoices/${invoice.InvoiceID}/restock-history`,
        {
          params: { startDate, endDate },
        },
      );

      setHistory(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="invoice-details-container">
      <button className="back-btn" onClick={() => navigate(-1)}>
        {"<"} BACK
      </button>

      <div className="invoice-details-title-container">
        <h2 className="invoice-details-title">
          <span onClick={() => navigate("/admin/invoice-management")}>
            Invoice Management
          </span>{" "}
          {">"} Details
        </h2>
        <button
          className="history-btn"
          title="Restock History"
          onClick={() => {
            setShowHistoryModal(true);
            fetchHistory();
          }}
        >
          <MdHistory className="history-icon" />
        </button>
      </div>

      {/* HEADER CARD */}
      <div className="invoice-header-card">
        <div className="invoice-header-left">
          <div className="invoice-icon-box">
            <RiReceiptFill className="invoice-icon" />
          </div>

          <div>
            <div className="invoice-label">Invoice Number</div>
            <div className="invoice-number">{invoice.InvoiceNumber}</div>
          </div>
        </div>

        <div>
          <div className="invoice-label">Total Amount</div>
          <div className="invoice-number">
            Php.{" "}
            {Number(grandTotal).toLocaleString("en-PH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>

        <div className="invoice-header-center">
          <div className="invoice-label">Status</div>

          <div className="invoice-status">
            {stocks.length > 0 ? "Active" : "Empty"}
          </div>
        </div>

        <div className="invoice-header-right">
          <div className="invoice-label">Arrived Date</div>
          <div className="invoice-date">
            {formatDateTime(invoice.InvoiceDate)}
          </div>
        </div>
      </div>

      {/* STOCK LIST */}
      <div className="invoice-stock-card">
        <div className="invoice-stock-header">
          <h3>Restocked Products</h3>

          <div>
            <div className="invoice-total-items">
              Total Quantity: {totalQuantity}
            </div>
            <div className="invoice-total-items">
              Items: {filteredStocks.length}
            </div>
          </div>
        </div>

        {/* SEARCH */}
        <div className="invoice-search-wrapper">
          <FaSearch className="invoice-search-icon" />
          <input
            type="text"
            placeholder="Search Stock card, Item name, Description"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* TABLE */}
        <table className="invoice-stock-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Stock Card #</th>
              <th>Item</th>
              <th>Quantity</th>
              <th>Total Amount</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredStocks.map((s, index) => {
              const isEditing = editingRow === s.StockInvoiceID;

              return (
                <tr key={`${s.StockInvoiceID}-${index}`}>
                  <td
                    onClick={() =>
                      navigate(`/admin/stock-control/${s.StockCardID}`)
                    }
                  >
                    {index + 1}
                  </td>

                  <td
                    onClick={() =>
                      navigate(`/admin/stock-control/${s.StockCardID}`)
                    }
                  >
                    {s.StockCardID}
                  </td>

                  <td
                    onClick={() =>
                      navigate(`/admin/stock-control/${s.StockCardID}`)
                    }
                  >
                    <div className="stock-item-name">{s.StockName}</div>
                    <div className="stock-item-desc">{s.Description}</div>
                  </td>

                  {/* QUANTITY */}
                  <td>
                    {isEditing ? (
                      <QuantityInput
                        value={editQuantity}
                        onChange={setEditQuantity}
                      />
                    ) : (
                      s.Quantity
                    )}
                  </td>
                  <td>
                    Php.{" "}
                    {Number(s.TotalAmount).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>

                  {/* ACTION */}
                  <td>
                    {isEditing ? (
                      <div className="invoice-actions">
                        <button
                          className="save-btn"
                          onClick={() => saveEdit(s)}
                        >
                          Save
                        </button>

                        <button className="cancel-btn" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="invoice-actions">
                        {/* DETAILS BUTTON */}
                        <button
                          className="view-btn"
                          onClick={() =>
                            navigate(`/admin/stock-control/${s.StockCardID}`)
                          }
                        >
                          Details
                        </button>

                        {/* MENU */}
                        <div className="menu-wrapper">
                          <FiMoreVertical
                            className="menu-icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenu(
                                openMenu === s.StockInvoiceID
                                  ? null
                                  : s.StockInvoiceID,
                              );
                            }}
                          />

                          {openMenu === s.StockInvoiceID && (
                            <div className="dropdown-menu">
                              <div
                                className="dropdown-item"
                                onClick={() => startEdit(s)}
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
              );
            })}
          </tbody>
        </table>
      </div>

      {showHistoryModal && (
        <div className="history-overlay">
          <div className="history-sidebar">
            <div className="history-header">
              <h3>Invoice Restock History</h3>
              <button
                className="close-btn"
                onClick={() => setShowHistoryModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="history-filter">
              <div className="history-form-group">
                <label>To</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="history-form-group">
                <label>From</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <button onClick={fetchHistory}>Filter</button>
            </div>

            <div className="history-list">
              {history.length === 0 ? (
                <p className="no-history">No history found</p>
              ) : (
                history.map((item) => (
                  <div key={item.RestockID} className="history-item">
                    <div>
                      {item.Action} <strong>{Math.abs(item.Quantity)}</strong>{" "}
                      Items to{" "}
                      <strong>
                        {item.StockName}
                        {" - "}
                        {item.Description}
                      </strong>
                    </div>

                    <div className="history-meta">
                      <span>{item.AdminName}</span>
                      <span>{formatDateTime(item.RestockDate)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
