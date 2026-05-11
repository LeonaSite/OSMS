import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Swal from "sweetalert2";
import "./StockControl.css";
import { useStocks } from "../../hooks/StockControl/useStocks";
import { useStockSummary } from "../../hooks/StockControl/useStockSummary";
import BeatLoader from "react-spinners/BeatLoader";

import { FiMoreVertical } from "react-icons/fi";
import { FaSearch } from "react-icons/fa";
import { RiAddLargeLine } from "react-icons/ri";
import { FaSortUp, FaSortDown, FaSort } from "react-icons/fa";

export default function StockControl() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50; // change if you want 20, 25, etc.

  const status = searchParams.get("status");
  const type = searchParams.get("type");

  const [openMenu, setOpenMenu] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    stockType: "PS",
    stockName: "",
    description: "",
    price: "",
    quantity: "",
    invoiceNumber: "",
    unitID: "",
    priorityID: 2,
    threshold: "",
  });

  const [units, setUnits] = useState([]);

  const { data: stocks = [], isLoading: stocksLoading } = useStocks({
    status,
    type,
  });

  const {
    data: summary = {
      OnStockCount: 0,
      CriticalCount: 0,
      OutOfStockCount: 0,
      ArchivedCount: 0,
    },
    isLoading: summaryLoading,
  } = useStockSummary();

  //ASC AND DESC SORTING
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: null,
  });

  const handleSort = (key) => {
    let direction = "asc";

    if (sortConfig.key === key) {
      if (sortConfig.direction === "asc") {
        direction = "desc";
      } else if (sortConfig.direction === "desc") {
        direction = null; // reset
      }
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

  // ✅ SEARCH FILTER (frontend only)
  const filteredStocks = useMemo(() => {
    let data = stocks.filter((s) =>
      `${s.StockName} ${s.Description} ${s.StockCardID}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );

    // ✅ ALWAYS PRIORITIZE HIGH FIRST
    data.sort((a, b) => {
      // Higher PriorityID should come first (3 > 2 > 1)
      if (a.PriorityID !== b.PriorityID) {
        return b.PriorityID - a.PriorityID;
      }
      return 0;
    });

    // ✅ THEN APPLY COLUMN SORT (if selected)
    if (sortConfig.key) {
      data.sort((a, b) => {
        // Keep priority always first
        if (a.PriorityID !== b.PriorityID) {
          return b.PriorityID - a.PriorityID;
        }

        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

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
  }, [stocks, search, sortConfig]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredStocks.length / rowsPerPage);

  const paginatedStocks = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredStocks.slice(start, start + rowsPerPage);
  }, [filteredStocks, currentPage]);

  const toggleArchive = async (stock) => {
    const action = stock.IsArchived ? "Unarchive" : "Archive";

    const confirm = await Swal.fire({
      title: `${action} this item?`,
      text: stock.IsArchived
        ? "Item will be restored to active stock."
        : "Item will be moved to archived list.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: `Yes, ${action.toLowerCase()}`,
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    await axios.put(
      `${import.meta.env.VITE_API_URL}/api/stocks/${stock.StockID}/archive`,
      { isArchived: stock.IsArchived ? 0 : 1 },
    );

    await Swal.fire({
      title: `${action}d!`,
      icon: "success",
      timer: 1200,
      showConfirmButton: false,
    });

    setOpenMenu(null);
    queryClient.invalidateQueries(["stocks"]);
    queryClient.invalidateQueries(["stock-summary"]);
  };

  useEffect(() => {
    fetchUnits();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, status, type]);

  const fetchUnits = async () => {
    const res = await axios.get(
      `${import.meta.env.VITE_API_URL}/api/unit-manager`,
    );
    setUnits(res.data);
  };

  const hasFormContent = () => {
    return Object.values(form).some((v) => v !== "" && v !== null);
  };

  const token = localStorage.getItem("token");

  const handleAddStock = async () => {
    const confirm = await Swal.fire({
      title: "Add new item?",
      text: "This will be added to stock inventory.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, add",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/stocks`, form, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      await Swal.fire({
        title: "Added!",
        text: "Stock item added successfully.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });

      setShowModal(false);

      setForm({
        stockType: "PS",
        stockName: "",
        description: "",
        price: "",
        quantity: "",
        invoiceNumber: "",
        unitID: "",
        priorityID: 2,
        threshold: "",
      });

      queryClient.invalidateQueries(["stocks"]);
      queryClient.invalidateQueries(["stock-summary"]);
    } catch (err) {
      if (err.response?.data?.message === "ITEM_ALREADY_EXISTS") {
        Swal.fire({
          icon: "warning",
          title: "Item already exists",
          text: "This item with the same specification already exists. If you want to restock it, please go to Stock Details.",
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Failed to add item",
        });
      }
    }
  };

  if (stocksLoading || summaryLoading) {
    return (
      <div className="spinner-container">
        <BeatLoader size={15} color="#1e3a8a" />
      </div>
    );
  }

  return (
    <div className="stock-container">
      <div className="stock-top">
        <div className="stock-header-left">
          <h2 className="stock-header">Stock Control</h2>

          <div className="summary-flex">
            <div
              className="summary-card all"
              onClick={() => navigate("/admin/stock-control")}
            >
              <span>ALL STOCKS</span>
              <h2>
                {Number(summary.OnStockCount) +
                  Number(summary.CriticalCount) +
                  Number(summary.OutOfStockCount)}
              </h2>
            </div>

            <div
              className="summary-card onstock"
              onClick={() => navigate("/admin/stock-control?status=OnStock")}
            >
              <span>ON STOCK</span>
              <h2>{summary.OnStockCount}</h2>
            </div>

            <div
              className="summary-card critical"
              onClick={() => navigate("/admin/stock-control?status=Critical")}
            >
              <span>CRITICAL</span>
              <h2>{summary.CriticalCount}</h2>
            </div>

            <div
              className="summary-card outofstock"
              onClick={() => navigate("/admin/stock-control?status=OutOfStock")}
            >
              <span>OUT OF STOCK</span>
              <h2>{summary.OutOfStockCount}</h2>
            </div>

            <div
              className="summary-card archived"
              onClick={() => navigate("/admin/stock-control?status=Archived")}
            >
              <span>ARCHIVED</span>
              <h2>{summary.ArchivedCount}</h2>
            </div>
          </div>
        </div>
        <div className="priority-guide">
          <span>Priorities:</span>

          <div className="priority low">
            <span className="triangle down"></span> Low
          </div>

          <div className="priority mid">
            <span className="circle"></span> Mid
          </div>

          <div className="priority high">
            <span className="triangle up"></span> High
          </div>
        </div>
      </div>

      {/* SEARCH + FILTER + PRIORITY GUIDE */}
      <div className="top-bar">
        <div className="left-controls">
          {/* Search Wrapper */}
          <div className="search-wrapper">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search Items, Specification, Unit"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="stock-search"
            />
          </div>

          <div className="stockcard-filter">
            <p className="filter-label">Filter by Type:</p>
            <select
              value={type || ""}
              onChange={(e) => {
                const selected = e.target.value;

                let query = "";

                if (status) query += `status=${status}&`;
                if (selected) query += `type=${selected}`;

                navigate(`/admin/stock-control?${query}`);
              }}
              className="status-filter"
            >
              <option value="">All Types</option>
              <option value="PS">Procurement System (PS)</option>
              <option value="CA">Cash Advance (CA)</option>
              <option value="PO">Purchase Order (PO)</option>
              <option value="AF">Accountable Form (AF)</option>
            </select>
          </div>
        </div>

        <button className="add-btn" onClick={() => setShowModal(true)}>
          <RiAddLargeLine className="add-icon" /> Add New Item
        </button>
      </div>

      {/* TABLE */}
      <table className="stock-control-table">
        <thead>
          <tr>
            <th className="stock-index">#</th>

            <th onClick={() => handleSort("StockCardID")} className="sortable">
              Stock Card# {renderSortIcon("StockCardID")}
            </th>

            <th onClick={() => handleSort("StockName")} className="sortable">
              Stock Name {renderSortIcon("StockName")}
            </th>

            <th onClick={() => handleSort("Quantity")} className="sortable">
              Quantity {renderSortIcon("Quantity")}
            </th>

            <th onClick={() => handleSort("UnitName")} className="sortable">
              Unit {renderSortIcon("UnitName")}
            </th>

            <th onClick={() => handleSort("Price")} className="sortable">
              Price {renderSortIcon("Price")}
            </th>

            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {paginatedStocks.map((stock, index) => (
            <tr key={stock.StockID}>
              <td
                className="stock-index"
                onClick={() =>
                  navigate(`/admin/stock-control/${stock.StockCardID}`)
                }
              >
                {(currentPage - 1) * rowsPerPage + index + 1}
              </td>
              <td>{stock.StockCardID}</td>

              <td
                onClick={() =>
                  navigate(`/admin/stock-control/${stock.StockCardID}`)
                }
              >
                <div className="item-cell">
                  <div className="priority-indicator">
                    {stock.PriorityID === 1 && (
                      <span className="triangle down green"></span>
                    )}
                    {stock.PriorityID === 2 && (
                      <span className="circle orange"></span>
                    )}
                    {stock.PriorityID === 3 && (
                      <span className="triangle up red"></span>
                    )}
                  </div>

                  <div>
                    <div className="item-name">{stock.StockName}</div>
                    <div className="item-desc">{stock.Description}</div>
                  </div>
                </div>
              </td>

              <td
                onClick={() =>
                  navigate(`/admin/stock-control/${stock.StockCardID}`)
                }
              >
                {stock.Quantity}
              </td>
              <td
                onClick={() =>
                  navigate(`/admin/stock-control/${stock.StockCardID}`)
                }
              >
                {stock.UnitName}
              </td>
              <td
                onClick={() =>
                  navigate(`/admin/stock-control/${stock.StockCardID}`)
                }
              >
                Php.{" "}
                {Number(stock.Price).toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>

              <td
                onClick={() =>
                  navigate(`/admin/stock-control/${stock.StockCardID}`)
                }
              >
                <div className="status-wrapper">
                  {stock.IsArchived ? (
                    <span className="archived-badge">Archived</span>
                  ) : (
                    ""
                  )}

                  <span className={`status ${stock.StockStatus}`}>
                    {stock.StockStatus}
                  </span>
                </div>
              </td>

              <td>
                <div className="stock-actions">
                  <button
                    className="view-btn"
                    onClick={() =>
                      navigate(`/admin/stock-control/${stock.StockCardID}`)
                    }
                  >
                    Details
                  </button>

                  <div className="menu-wrapper">
                    <FiMoreVertical
                      className="menu-icon"
                      onClick={() =>
                        setOpenMenu(
                          openMenu === stock.StockID ? null : stock.StockID,
                        )
                      }
                    />

                    {openMenu === stock.StockID && (
                      <div className="dropdown-menu">
                        <div
                          className="dropdown-item"
                          onClick={() => toggleArchive(stock)}
                        >
                          {stock.IsArchived ? "Unarchive" : "Archive"}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

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
        <div className="stock-modal-overlay">
          <div className="stock-modal-box">
            <div className="stock-modal-header">Create Stock Entry</div>

            <div className="stock-modal-body">
              <div className="stock-form-grid">
                <div className="stock-left-forms">
                  <div className="stock-form-input">
                    <label>Stock Type</label>
                    <span className="stock-type-select">
                      <select
                        value={form.stockType}
                        onChange={(e) =>
                          setForm({ ...form, stockType: e.target.value })
                        }
                      >
                        <option value="PS">Procurement System (PS)</option>
                        <option value="CA">Cash Advance (CA)</option>
                        <option value="PO">Purchase Order (PO)</option>
                        <option value="AF">Accountable Form (AF)</option>
                      </select>
                    </span>
                  </div>

                  <div className="stock-form-input">
                    <label>Item Name</label>
                    <input
                      value={form.stockName}
                      onChange={(e) =>
                        setForm({ ...form, stockName: e.target.value })
                      }
                    />
                  </div>

                  <div className="stock-form-input">
                    <label>Item Specification</label>
                    <textarea
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="right-forms">
                  <div className="right-forms-content">
                    <div className="stock-form-input">
                      <label>Price</label>
                      <input
                        type="number"
                        value={form.price}
                        onChange={(e) =>
                          setForm({ ...form, price: e.target.value })
                        }
                      />
                    </div>

                    <div className="stock-form-input">
                      <label>Priority</label>
                      <select
                        value={form.priorityID}
                        onChange={(e) =>
                          setForm({ ...form, priorityID: e.target.value })
                        }
                      >
                        <option value={1}>Low</option>
                        <option value={2}>Mid</option>
                        <option value={3}>High</option>
                      </select>
                    </div>
                  </div>

                  <div className="right-forms-content">
                    <div className="stock-form-input">
                      <label>Sale Invoice Number/ Delivery Receipt</label>
                      <span className="invoice-form-input">
                        <input
                          value={form.invoiceNumber}
                          onChange={(e) =>
                            setForm({ ...form, invoiceNumber: e.target.value })
                          }
                        />
                      </span>
                    </div>
                  </div>

                  <div className="right-forms-content">
                    <div className="stock-form-input">
                      <label>Quantity</label>
                      <input
                        type="number"
                        value={form.quantity}
                        onChange={(e) =>
                          setForm({ ...form, quantity: e.target.value })
                        }
                      />
                    </div>

                    <div className="stock-form-input">
                      <label>Unit</label>
                      <select
                        value={form.unitID}
                        onChange={(e) =>
                          setForm({ ...form, unitID: Number(e.target.value) })
                        }
                      >
                        <option value="">-Select Unit-</option>
                        {units.map((u) => (
                          <option key={u.UnitID} value={u.UnitID}>
                            {u.UnitName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="right-forms-content">
                    <div className="stock-form-input">
                      <label>Threshold</label>
                      <input
                        type="number"
                        value={form.threshold}
                        onChange={(e) =>
                          setForm({ ...form, threshold: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="cancel-btn"
                onClick={async () => {
                  if (hasFormContent()) {
                    const result = await Swal.fire({
                      title: "Discard changes?",
                      text: "You have unsaved data. This will be lost.",
                      icon: "warning",
                      showCancelButton: true,
                      confirmButtonText: "Yes, discard",
                      cancelButtonText: "Keep editing",
                    });

                    if (!result.isConfirmed) return;
                  }

                  setShowModal(false);
                  setForm({
                    stockType: "PS",
                    stockName: "",
                    description: "",
                    price: "",
                    quantity: "",
                    invoiceNumber: "",
                    unitID: "",
                    priorityID: 2,
                    threshold: "",
                  });
                }}
              >
                Cancel
              </button>
              <button className="confirm-btn" onClick={handleAddStock}>
                Add Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
