import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { FaSearch } from "react-icons/fa";
import QuantityInput from "../../Utilities/QuantityInput";
import "./RequestInvoiceSelectorModal.css";
import { formatDateTime } from "../../Utilities/FormatDateTime";
import { FaSort, FaSortUp, FaSortDown } from "react-icons/fa";
import Swal from "sweetalert2";

export default function RequestInvoiceSelectorModal({ stock, onClose }) {
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // SORT
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: null,
  });

  const fetchAssignedInvoices = async () => {
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/requests/assigned-invoices/${stock.RequestDetailsID}`,
      );

      const mapped = res.data.map((ai) => ({
        StockInvoiceID: ai.StockInvoiceID,
        InvoiceNo: ai.InvoiceNo,

        Quantity: Number(ai.AssignedQty || 0),
        MaxQty: Number(ai.ActualQty || 0),
      }));

      setSelected(mapped);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchInvoices = async () => {
    const res = await axios.get(
      `${import.meta.env.VITE_API_URL}/api/requests/by-stock/${stock.StockID}`,
    );

    setInvoices(res.data);
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  useEffect(() => {
    if (invoices.length > 0) {
      fetchAssignedInvoices();
    }
  }, [invoices]);

  const totalSelected = selected.reduce((sum, i) => sum + i.Quantity, 0);
  const remaining = stock.Quantity - totalSelected;

  const toggleInvoice = (invoice) => {
    const exists = selected.find(
      (i) => i.StockInvoiceID === invoice.StockInvoiceID,
    );

    if (exists) {
      setSelected(
        selected.filter((i) => i.StockInvoiceID !== invoice.StockInvoiceID),
      );
    } else {
      // ❌ BLOCK if no remaining
      if (remaining <= 0) return;

      setSelected([
        ...selected,
        {
          ...invoice,
          Quantity: 1,
          MaxQty: Number(invoice.Quantity || 0), // 🔥 store raw invoice qty
        },
      ]);
    }
  };

  const updateQty = (index, value) => {
    const copy = [...selected];

    const currentTotal = copy.reduce((sum, i) => sum + i.Quantity, 0);
    const currentItemQty = copy[index].Quantity;

    const totalWithoutCurrent = currentTotal - currentItemQty;

    const maxAllowed = Math.min(
      copy[index].MaxQty,
      stock.Quantity - totalWithoutCurrent,
    );

    copy[index].Quantity = Math.min(value, maxAllowed);

    setSelected(copy);
  };

  const filtered = invoices.filter((i) =>
    i.InvoiceNo.toLowerCase().includes(search.toLowerCase()),
  );

  const isSelected = (invoice) => {
    return selected.some((i) => i.StockInvoiceID === invoice.StockInvoiceID);
  };

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

  const processedInvoices = useMemo(() => {
    let data = [...invoices];

    // SEARCH
    if (search) {
      data = data.filter((i) =>
        i.InvoiceNo.toLowerCase().includes(search.toLowerCase()),
      );
    }

    // DATE RANGE FILTER
    if (dateFrom) {
      data = data.filter((i) => new Date(i.ArrivedDate) >= new Date(dateFrom));
    }

    if (dateTo) {
      data = data.filter((i) => new Date(i.ArrivedDate) <= new Date(dateTo));
    }

    // SORT
    if (sortConfig.key) {
      data.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // date sorting fix
        if (sortConfig.key === "ArrivedDate") {
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
  }, [invoices, search, dateFrom, dateTo, sortConfig]);

  const handleConfirm = async () => {
    // NOTHING SELECTED
    if (selected.length === 0) {
      Swal.fire(
        "No selection",
        "Please select at least one invoice",
        "warning",
      );
      return;
    }

    // ❌ STRICT: MUST MATCH EXACT QUANTITY
    if (remaining !== 0) {
      Swal.fire(
        "Incomplete Stock",
        `You must fully allocate the required stock.\nMissing: ${remaining}`,
        "error",
      );
      return;
    }

    // FINAL CONFIRMATION
    const confirm = await Swal.fire({
      title: "Confirm Selection",
      text: "This will replace existing invoice assignments.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Confirm",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/requests/assign-invoices`,
        {
          RequestDetailsID: stock.RequestDetailsID,
          invoices: selected.map((i) => ({
            StockInvoiceID: i.StockInvoiceID,
            Quantity: i.Quantity,
          })),
        },
      );

      await Swal.fire("Success", "Invoices assigned successfully", "success");

      onClose(true);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to assign invoices", "error");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="req-invoice-selector-modal">
        <div className="req-invoice-selector-header">
          Select Available Invoice #
        </div>

        <div className="req-invoice-selector-body">
          {/* LEFT */}

          <div className="invoice-list">
            <h3 className="req-invoice-header-list">
              Stock Item:{" "}
              <span>
                {stock.StockName} - {stock.Description}
              </span>
            </h3>

            <div className="req-invoice-tool">
              <div className="search-wrapper">
                <FaSearch className="search-icon" />

                <input
                  placeholder="Search Invoice number"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="stock-search"
                />
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

            <div className="req-invoice-table-wrapper">
              <table className="req-invoice-table">
                <thead>
                  <tr>
                    <th></th>

                    <th
                      onClick={() => handleSort("InvoiceNo")}
                      className="sortable"
                    >
                      Sales Invoice # {renderSortIcon("InvoiceNo")}
                    </th>

                    <th
                      onClick={() => handleSort("Quantity")}
                      className="sortable"
                    >
                      Qnty. {renderSortIcon("Quantity")}
                    </th>

                    <th
                      onClick={() => handleSort("ArrivedDate")}
                      className="sortable"
                    >
                      Arrived Date {renderSortIcon("ArrivedDate")}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {processedInvoices.map((i) => {
                    const active = isSelected(i);

                    const disabled = !active && remaining <= 0;

                    return (
                      <tr
                        key={i.StockInvoiceID}
                        onClick={() => {
                          if (disabled) return;
                          toggleInvoice(i);
                        }}
                        className={`${active ? "row-active" : ""} ${disabled ? "row-disabled" : ""}`}
                      >
                        <td>
                          <input
                            className="req-invoice-checkbox"
                            type="checkbox"
                            checked={active}
                            disabled={disabled}
                            onChange={() => toggleInvoice(i)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>

                        <td>{i.InvoiceNo}</td>
                        <td>{i.Quantity}</td>
                        <td>{formatDateTime(i.ArrivedDate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT */}

          <div className="selected-invoices">
            <div className="selected-invoice-header">
              <h3>Selected Invoice</h3>
              <p>
                Stock needed: <span>{stock.Quantity}</span>
              </p>
            </div>
            <div className="selected-invoice-table-wrapper">
              <table className="selected-invoice-table">
                <thead>
                  <tr>
                    <th>Invoice Number</th>
                    <th>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.map((s, index) => (
                    <tr>
                      <td>{s.InvoiceNo}</td>
                      <td>
                        <div className="qty-box">
                          <QuantityInput
                            value={s.Quantity}
                            min={1}
                            max={Math.min(
                              s.MaxQty, // 🔥 invoice limit
                              stock.Quantity - (totalSelected - s.Quantity), // 🔥 remaining stock
                            )}
                            onChange={(val) => updateQty(index, val)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="selected-invoice-footer">
              <h4>
                Total Selected: {totalSelected} / {stock.Quantity}
              </h4>
              <div className="selected-invoice-buttons">
                <button
                  className="cancel-btn"
                  onClick={async () => {
                    if (selected.length === 0) return onClose(true);

                    const res = await Swal.fire({
                      title: "Discard changes?",
                      text: "Selected invoices will be lost",
                      icon: "warning",
                      showCancelButton: true,
                      confirmButtonText: "Yes, discard",
                      cancelButtonText: "Keep editing",
                    });

                    if (res.isConfirmed) onClose(true);
                  }}
                >
                  Cancel
                </button>
                <button className="confirm-btn" onClick={handleConfirm}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
