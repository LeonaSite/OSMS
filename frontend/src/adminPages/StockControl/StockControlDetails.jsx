import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import "./StockControlDetails.css";
import Swal from "sweetalert2";
import BeatLoader from "react-spinners/BeatLoader";
import { formatDateTime } from "../../Utilities/FormatDateTime";
import StockInvoicesPanel from "../StockControl/StockInvoicesPanel";
import QuantityInput from "../../Utilities/QuantityInput";
import ProductRequestHistoryTable from "./ProductRequestHistoryTable";
import { MdHistory } from "react-icons/md";
import { IoAdd } from "react-icons/io5";

import { LuPencilLine } from "react-icons/lu";
import { BsFillInboxesFill } from "react-icons/bs";
import { GrSave } from "react-icons/gr";
import { TbCancel } from "react-icons/tb";

const API = import.meta.env.VITE_API_URL;

export default function StockControlDetails() {
  const navigate = useNavigate();
  const { stockcard } = useParams();
  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [form, setForm] = useState(null);
  const [units, setUnits] = useState([]);

  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockQty, setRestockQty] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [history, setHistory] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    fetchDetails();
  }, [stockcard]);

  const fetchDetails = async () => {
    try {
      setLoading(true);

      // Create a 2-second delay promise
      const delay = new Promise((resolve) => setTimeout(resolve, 500));

      // Fetch the data
      const fetchRes = axios.get(`${API}/api/stocks/details/${stockcard}`);

      // Wait for BOTH the delay and the request to finish
      const [res] = await Promise.all([fetchRes, delay]);

      setStock(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/api/unit-manager`)
      .then((res) => setUnits(res.data));
  }, []);

  useEffect(() => {
    if (stock) {
      setForm({
        stockType: stock.StockCardID?.substring(0, 2),
        stockName: stock.StockName,
        description: stock.Description,
        quantity: stock.Quantity,
        unitID: stock.UnitID,
        threshold: stock.Threshold,
        price: stock.Price,
        isArchived: Number(stock.IsArchived),
        priorityID: stock.PriorityID,
      });
    }
  }, [stock]);

  const resetForm = () => {
    if (!stock) return;

    setForm({
      stockType: stock.StockCardID?.substring(0, 2),
      stockName: stock.StockName,
      description: stock.Description,
      quantity: stock.Quantity,
      unitID: stock.UnitID,
      threshold: stock.Threshold,
      price: stock.Price,
      isArchived: stock.IsArchived,
      priorityID: stock.PriorityID,
    });
  };

  const handleEdit = () => {
    setIsEditMode(true);
  };

  const handleCancel = async () => {
    const confirm = await Swal.fire({
      title: "Discard changes?",
      text: "Unsaved changes will be lost.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, discard",
    });

    if (!confirm.isConfirmed) return;

    resetForm();
    setIsEditMode(false);
  };

  const handleSave = async () => {
    const confirm = await Swal.fire({
      title: "Save changes?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, save",
    });

    if (!confirm.isConfirmed) return;

    // If stockType changed
    if (form.stockType !== stock.StockCardID.substring(0, 2)) {
      const res = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/stocks/${stock.StockID}/change-type`,
        { stockType: form.stockType },
      );

      const newStockCardID = res.data.newStockCardID;

      await Swal.fire({
        icon: "success",
        title: "Stock type updated",
        timer: 1200,
        showConfirmButton: false,
      });

      // 🔥 Redirect to new URL with updated stock number
      navigate(`/admin/stock-control/${newStockCardID}`, { replace: true });
      window.location.reload();

      return; // ❗ important: stop further execution
    }

    await axios.put(
      `${import.meta.env.VITE_API_URL}/api/stocks/${stock.StockID}`,
      form,
    );

    await Swal.fire({
      icon: "success",
      title: "Updated successfully",
      timer: 1200,
      showConfirmButton: false,
    });

    setIsEditMode(false);
    fetchDetails();
  };

  if (loading) {
    return (
      <div className="spinner-container">
        <BeatLoader size={15} color="#1e3a8a" />
      </div>
    );
  }

  const handleAddUnit = async () => {
    const confirm = await Swal.fire({
      title: "Go to Unit Manager?",
      text: "Unsaved changes will be lost.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, continue",
    });

    if (!confirm.isConfirmed) return;

    navigate("/admin/unit-manager");
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleRestock = async () => {
    if (!restockQty || !invoiceNumber) {
      Swal.fire("Error", "All fields are required", "error");
      return;
    }

    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/stocks/${stock.StockID}/restock`,
        {
          quantity: Number(restockQty),
          invoiceNumber,
        },
        { withCredentials: true },
      );

      await Swal.fire({
        icon: "success",
        title: "Stock added successfully",
        timer: 1200,
        showConfirmButton: false,
      });

      setShowRestockModal(false);
      setRestockQty("");
      setInvoiceNumber("");
      fetchDetails();
    } catch (err) {
      Swal.fire("Error", "Failed to restock", "error");
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/stocks/${stock.StockID}/restock-history`,
        {
          params: {
            startDate,
            endDate,
          },
          withCredentials: true,
        },
      );

      setHistory(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="stock-details-container">
      {/* BACK */}
      <button className="back-btn" onClick={() => navigate(-1)}>
        &lt; BACK
      </button>

      <div className="stock-title-row">
        <h2 className="details-title">
          <span onClick={() => navigate("/admin/stock-control")}>
            Stock Control
          </span>{" "}
          &gt; Details
        </h2>

        {!isEditMode ? (
          <div className="edit-actions">
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
            <button
              className="restock-btn"
              onClick={() => setShowRestockModal(true)}
            >
              <IoAdd className="edit-icon" />
              Restock
            </button>
            <button className="edit-btn" onClick={handleEdit}>
              <LuPencilLine className="edit-icon" />
              Edit
            </button>
          </div>
        ) : (
          <div className="edit-actions">
            <button className="edit-cancel-btn" onClick={handleCancel}>
              <TbCancel className="edit-cancel-icon" />
              Cancel
            </button>
            <button className="edit-save-btn" onClick={handleSave}>
              <GrSave className="edit-save-icon" />
              Save
            </button>
          </div>
        )}
      </div>

      {/* HEADER CARD */}
      <div className="details-header-card">
        <div className="header-left">
          <div className="stock-icon-box">
            <BsFillInboxesFill className="stock-icon" />
          </div>

          <div>
            <div className="label">Stock No.</div>
            <div>
              <div className="stock-number">{stock.StockCardID}</div>
              {!isEditMode ? (
                <div></div>
              ) : (
                <select
                  className="stock-edit-stock-type"
                  value={form.stockType}
                  onChange={(e) => handleChange("stockType", e.target.value)}
                >
                  <option value="PS">Procurement System (PS)</option>
                  <option value="CA">Cash Advance (CA)</option>
                  <option value="PO">Purchase Order (PO)</option>
                  <option value="AF">Accountable Form (AF)</option>
                </select>
              )}
            </div>
          </div>
        </div>

        <div className="header-center">
          <div className="label">Status</div>

          <div className="status-wrapper">
            {stock.IsArchived === 1 && (
              <span className="archived-badge">Archived</span>
            )}

            <span className={`status ${stock.StockStatus}`}>
              {stock.StockStatus}
            </span>
          </div>
        </div>

        <div className="header-right">
          <div className="label">Total Released</div>
          <div className="issued-number">{stock.TotalIssued}</div>
        </div>
      </div>

      {/* BODY CARD */}
      <div className="details-body-card">
        <div className="grid">
          <div>
            <div className="label">Item</div>
            {!isEditMode ? (
              <div>{stock.StockName}</div>
            ) : (
              <input
                className="stock-edit-input"
                value={form.stockName}
                onChange={(e) => handleChange("stockName", e.target.value)}
              />
            )}
          </div>

          <div>
            <div className="label">Total Stocks</div>

            <div>{stock.Quantity}</div>
          </div>

          <div>
            <div className="label">Unit</div>
            {!isEditMode ? (
              <div>{stock.UnitName}</div>
            ) : (
              <select
                className="stock-edit-select"
                value={form.unitID}
                onChange={(e) => {
                  const val = e.target.value;

                  if (val === "ADD_NEW") {
                    handleAddUnit();
                    return;
                  }

                  handleChange("unitID", Number(val));
                }}
              >
                {/* Current unit already selected automatically */}
                {units.map((u) => (
                  <option key={u.UnitID} value={u.UnitID}>
                    {u.UnitName}
                  </option>
                ))}

                <option disabled>──────────</option>

                <option
                  value="ADD_NEW"
                  style={{ fontWeight: "bold", color: "#007bff" }}
                >
                  + Add New Unit
                </option>
              </select>
            )}
          </div>

          <div>
            <div className="label">Specification</div>
            {!isEditMode ? (
              <div>{stock.Description}</div>
            ) : (
              <textarea
                className="stock-edit-textarea"
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
              />
            )}
          </div>

          <div>
            <div className="label">Threshold</div>
            {!isEditMode ? (
              <div>{stock.Threshold}</div>
            ) : (
              <QuantityInput
                value={form.threshold}
                min={0}
                onChange={(val) => handleChange("threshold", val)}
              />
            )}
          </div>

          <div>
            <div className="label" style={{ color: "white" }}>
              Unit
            </div>
            {!isEditMode ? <div>{stock.UnitName}</div> : <div>---</div>}
          </div>

          <div>
            <div className="label">Price Cost</div>
            {!isEditMode ? (
              <div>
                Php.{" "}
                {Number(stock.Price).toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            ) : (
              <input
                className="stock-edit-price-input"
                type="number"
                value={form.price}
                onChange={(e) => handleChange("price", e.target.value)}
              />
            )}
          </div>

          <div>
            <div className="label">Total Amount</div>
            <div>
              Php.{" "}
              {Number(stock.TotalAmount).toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>

          <div>
            <div className="label">Availability</div>
            <div>
              {!isEditMode ? (
                stock.IsArchived ? (
                  "Archived"
                ) : (
                  "Available"
                )
              ) : (
                <select
                  className="stock-edit-select"
                  value={form.isArchived}
                  onChange={(e) =>
                    handleChange("isArchived", Number(e.target.value))
                  }
                >
                  <option value={0}>Available</option>
                  <option value={1}>Archived</option>
                </select>
              )}
            </div>
          </div>

          <div>
            <div className="label">Priority</div>
            {!isEditMode ? (
              <div className={`priority-text p${stock.PriorityID}`}>
                {stock.PriorityID === 1 && "Low"}
                {stock.PriorityID === 2 && "Mid"}
                {stock.PriorityID === 3 && "High"}
              </div>
            ) : (
              <select
                className="stock-edit-select"
                value={form.priorityID}
                onChange={(e) =>
                  handleChange("priorityID", Number(e.target.value))
                }
              >
                <option value={1}>Low</option>
                <option value={2}>Mid</option>
                <option value={3}>High</option>
              </select>
            )}
          </div>

          <div>
            <div className="label">Created At</div>
            <div>{formatDateTime(stock.CreatedAt)}</div>
          </div>

          <div>
            <div className="label">Last Modified At</div>
            <div>{formatDateTime(stock.ModifiedAt)}</div>
          </div>
        </div>
      </div>

      <StockInvoicesPanel stockID={stock.StockID} />

      <ProductRequestHistoryTable
        stockID={stock.StockID}
        stockName={stock.StockName}
      />

      {showRestockModal && (
        <div className="restock-modal-overlay">
          <div className="restock-modal">
            <div className="restock-modal-header">Restock Items</div>

            <div className="restock-modal-body">
              <div className="restock-form-group quantity-input">
                <label>Quantity:</label>
                <input
                  type="number"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                />
              </div>

              <div className="restock-form-group">
                <label>Sale Invoice Number / Delivery Receipt:</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) =>
                    setInvoiceNumber(e.target.value.toUpperCase())
                  }
                />
              </div>
            </div>

            <div className="restock-modal-footer">
              <button
                className="cancel-btn"
                onClick={() => setShowRestockModal(false)}
              >
                Cancel
              </button>

              <button className="confirm-btn" onClick={handleRestock}>
                Add now
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="history-overlay">
          <div className="history-sidebar">
            <div className="history-header">
              <h3>Restock History</h3>
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
                      {item.Action} <strong>{item.Quantity}</strong> items to
                      inventory from Invoice{" "}
                      <strong>#{item.InvoiceNumber}</strong>
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
