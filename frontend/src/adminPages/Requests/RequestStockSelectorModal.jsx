import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { FaSearch } from "react-icons/fa";
import "./RequestStockSelectorModal.css";
import { FaSort, FaSortUp, FaSortDown } from "react-icons/fa";

export default function StockSelectorModal({
  close,
  onSelectStock,
  mode = "create",
}) {
  const [stocks, setStocks] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("OnStock");

  const [type, setType] = useState("");
  // PAGINATION
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  // SORT
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: null,
  });

  const fetchStocks = async () => {
    const res = await axios.get(
      `${import.meta.env.VITE_API_URL}/api/requests/request-stock-selector`,
      { params: { search, status, type } },
    );

    setStocks(res.data);
  };

  useEffect(() => {
    fetchStocks();
  }, [search, status, type]);

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

  const processedStocks = useMemo(() => {
    let data = [...stocks];

    // SORT
    if (sortConfig.key) {
      data.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

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
  }, [stocks, sortConfig]);

  const totalPages = Math.ceil(processedStocks.length / rowsPerPage);

  const paginatedStocks = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return processedStocks.slice(start, start + rowsPerPage);
  }, [processedStocks, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, status, type]);

  return (
    <div className="modal-overlay">
      <div className="request-stock-selector-modal">
        <div className="request-stock-selector-header">Select Stock Item</div>

        <div className="request-stock-selector-body">
          <div className="request-stock-selector-tool">
            <div className="request-stock-selector-right">
              {/* SEARCH */}
              <div className="search-wrapper">
                <FaSearch className="search-icon" />

                <input
                  placeholder="Search Items, Specification, Unit"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="stock-search"
                />
              </div>

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="status-filter"
              >
                <option value="">All</option>
                <option value="OnStock">On Stock</option>
                <option value="Critical">Critical</option>
                <option value="OutOfStock">Out of Stock</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="status-filter"
            >
              <option value="">All Types</option>
              <option value="PS">Procurement System (PS)</option>
              <option value="CA">Cash Advance (CA)</option>
              <option value="PO">Purchase Order (PO)</option>
              <option value="AF">Accountable Form (AF)</option>
            </select>
          </div>

          {/* TABLE */}

          <div className="request-stock-selector-table-wrapper">
            <table className="request-stock-selector-table">
              <thead>
                <tr>
                  <th>#</th>

                  <th
                    onClick={() => handleSort("StockCardID")}
                    className="sortable"
                  >
                    Stock Card# {renderSortIcon("StockCardID")}
                  </th>

                  <th
                    onClick={() => handleSort("StockName")}
                    className="sortable"
                  >
                    Item {renderSortIcon("StockName")}
                  </th>

                  <th
                    onClick={() => handleSort("Quantity")}
                    className="sortable"
                  >
                    Quantity {renderSortIcon("Quantity")}
                  </th>

                  <th
                    onClick={() => handleSort("UnitName")}
                    className="sortable"
                  >
                    Unit {renderSortIcon("UnitName")}
                  </th>

                  <th
                    onClick={() => handleSort("Threshold")}
                    className="sortable"
                  >
                    Threshold {renderSortIcon("Threshold")}
                  </th>

                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {paginatedStocks.map((stock, i) => (
                  <tr
                    key={stock.StockID}
                    className={
                      stock.StockStatus === "OutOfStock" ||
                      stock.StockStatus === "Critical"
                        ? "disabled-row"
                        : "enable-row"
                    }
                    onClick={async () => {
                      if (
                        stock.StockStatus === "OutOfStock" ||
                        stock.StockStatus === "Critical"
                      )
                        return;

                      await onSelectStock(stock); // wait for confirmation inside
                      close(); // close AFTER success
                    }}
                  >
                    <td>{(currentPage - 1) * rowsPerPage + i + 1}</td>

                    <td>{stock.StockCardID}</td>

                    <td>
                      <div className="item-name">{stock.StockName}</div>

                      <div className="item-desc">{stock.Description}</div>
                    </td>

                    <td>{stock.Quantity}</td>

                    <td>{stock.UnitName}</td>

                    <td>{stock.Threshold}</td>

                    <td>
                      {stock.IsArchived ? (
                        <>
                          <span className="archived-badge">Archived</span>
                          <span className={`status ${stock.StockStatus}`}>
                            {stock.StockStatus}
                          </span>
                        </>
                      ) : (
                        <span className={`status ${stock.StockStatus}`}>
                          {stock.StockStatus}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
