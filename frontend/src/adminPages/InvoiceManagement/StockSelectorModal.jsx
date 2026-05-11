import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import "./StockSelectorModal.css";
import { FaSearch } from "react-icons/fa";

export default function StockSelectorModal({ close, addStock }) {
  const [stocks, setStocks] = useState([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  const fetchStocks = async () => {
    let url = `${import.meta.env.VITE_API_URL}/api/stocks?`;

    if (type) url += `type=${type}`;

    const res = await axios.get(url);

    setStocks(res.data);
  };

  useEffect(() => {
    fetchStocks();
  }, [type]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, type]);

  const filtered = useMemo(() => {
    return stocks.filter((s) =>
      `${s.StockCardID} ${s.StockName} ${s.Description}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  }, [stocks, search]);

  const totalPages = Math.ceil(filtered.length / rowsPerPage);

  const paginatedStocks = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, currentPage]);

  return (
    <div className="modal-overlay">
      <div className="stock-selector-modal">
        <div className="stock-selector-modal-header">
          Select Available Stocks
        </div>

        <div className="stock-selector-modal-body">
          {/* SEARCH */}
          <div className="stock-selector-top-bar">
            <div className="stock-selector-search-wrapper">
              <FaSearch className="search-icon" />
              <input
                placeholder="Search Stockcard, Item Name, Description.."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* FILTER BY TYPE */}
            <div className="stock-selector-filters">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="stock-selector-filter"
              >
                <option value="">All Types</option>
                <option value="PS">Procurement System (PS)</option>
                <option value="CA">Cash Advance (CA)</option>
                <option value="PO">Purchase Order (PO)</option>
                <option value="AF">Accountable Form (AF)</option>
              </select>
            </div>
          </div>

          {/* TABLE */}
          <div className="stock-selector-table-wrapper">
            <table className="stock-selector-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Stock Card</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {paginatedStocks.map((s, i) => (
                  <tr
                    key={s.StockID}
                    onClick={() => {
                      addStock(s);
                      close();
                    }}
                  >
                    <td>{(currentPage - 1) * rowsPerPage + i + 1}</td>

                    <td>{s.StockCardID}</td>

                    <td>
                      <div className="select-item-name">{s.StockName}</div>
                      <div className="select-item-desc">{s.Description}</div>
                    </td>

                    <td>{s.Quantity}</td>

                    <td>{s.UnitName}</td>

                    <td>
                      <div className="status-wrapper">
                        {s.IsArchived === 1 && (
                          <span className="archived-badge">Archived</span>
                        )}

                        <span className={`status ${s.StockStatus}`}>
                          {s.StockStatus}
                        </span>
                      </div>
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

          <div className="modal-footer">
            <button onClick={close} className="cancel-btn">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
