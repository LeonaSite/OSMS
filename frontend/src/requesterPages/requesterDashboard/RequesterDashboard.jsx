import { useState, useMemo } from "react";
import { useProducts } from "../../hooks/Products/useProducts";
import { FaSearch } from "react-icons/fa";
import { RiSortAlphabetAsc, RiSortAlphabetDesc } from "react-icons/ri";
import SelectedProducts from "./SelectedProducts";
import RequestConfirmationModal from "./RequestConfirmationModal";
import BeatLoader from "react-spinners/BeatLoader";
import "./RequesterDashboard.css";
import { useSelectedItems } from "../../requesterComponents/Context/SelectedItemsContext";

export default function RequesterDashboard() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 60;

  const { selectedItems, setSelectedItems } = useSelectedItems();
  const [showModal, setShowModal] = useState(false);

  const [sortConfig, setSortConfig] = useState({
    key: "StockName",
    direction: "asc",
  });

  const isSelected = (stockId) => {
    return selectedItems.some((item) => item.StockID === stockId);
  };

  const { data, isLoading } = useProducts({
    page: 1,
    limit: 100,
    sortKey: sortConfig.key,
    sortDir: sortConfig.direction,
  });

  const stocks = data?.data || [];

  const filteredStocks = useMemo(() => {
    let filtered = stocks.filter((item) =>
      `${item.StockName} ${item.Description}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );

    filtered.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      return sortConfig.direction === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

    return filtered;
  }, [stocks, search, sortConfig]);

  const totalPages = Math.ceil(filteredStocks.length / limit);

  const paginatedStocks = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredStocks.slice(start, start + limit);
  }, [filteredStocks, page]);

  const toggleSort = () => {
    setSortConfig((prev) => ({
      key: "StockName",
      direction: prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const MAX_SELECTION = 10;

  /* -------------------------------------------------------------
     CREDITS DISABLE
     Force values or bypass check flags so users aren't locked out.
  ------------------------------------------------------------- */
  // const baseCredit = stocks[0]?.RemainingCredit || 0;

  // const totalSelectedCost = useMemo(() => {
  //   return selectedItems.reduce(
  //     (sum, item) => sum + item.Price * item.quantity,
  //     0,
  //   );
  // }, [selectedItems]);

  // const remainingAfterSelection = baseCredit - totalSelectedCost;

  // Modified to safely allow any item pricing threshold
  const exceedsCredit = (item) => {
    // if (!baseCredit) return true;
    // return item.Price > remainingAfterSelection;
    return false;
  };

  const handleSelectItem = (item) => {
    setSelectedItems((prev) => {
      const exists = prev.find((p) => p.StockID === item.StockID);

      if (exists) {
        return prev.filter((p) => p.StockID !== item.StockID);
      }

      if (prev.length >= MAX_SELECTION) {
        alert("You can only select up to 10 items.");
        return prev;
      }

      // CREDITS DISABLE
      // if (item.Price > remainingAfterSelection) {
      //   return prev;
      // }

      return [
        ...prev,
        {
          ...item,
          quantity: 1,
        },
      ];
    });
  };

  const handleSuccess = () => {
    setSelectedItems([]);
  };

  if (isLoading)
    return (
      <div className="spinner-container">
        <BeatLoader />
      </div>
    );

  return (
    <div className="requester-dashboard-container">
      <div className="requester-dashboard-left-content">
        <div className="requester-dashboard-header">
          <h2 className="desktop-only-title">Available Products</h2>

          <div className="requester-dashboard-tools">
            {sortConfig.direction === "asc" ? (
              <RiSortAlphabetAsc
                className="requester-dashboard-sort"
                onClick={toggleSort}
              />
            ) : (
              <RiSortAlphabetDesc
                className="requester-dashboard-sort"
                onClick={toggleSort}
              />
            )}

            <div className="requester-dashboard-search-wrapper">
              <FaSearch className="requester-dashboard-search-icon" />
              <input
                type="text"
                placeholder="Search Name or Description"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="requester-dashboard-search"
              />
            </div>
          </div>
        </div>

        <div className="stocks-grid">
          {paginatedStocks.length === 0 ? (
            <p>No available stocks.</p>
          ) : (
            paginatedStocks.map((item) => {
              const disabled =
                (!isSelected(item.StockID) &&
                  selectedItems.length >= MAX_SELECTION) ||
                exceedsCredit(item);

              return (
                <div
                  key={item.StockID}
                  className={`stock-card 
                    ${isSelected(item.StockID) ? "selected" : ""} 
                    ${disabled ? "disabled" : ""}
                  `}
                  onClick={() => {
                    if (disabled) return;
                    handleSelectItem(item);
                  }}
                >
                  <h3>{item.StockName}</h3>
                  <p className="desc">{item.Description}</p>

                  <div className="stock-footer">
                    {/* -------------------------------------------------------------
                       CREDITS DISABLE
                       UI WARNING 
                       Hiding the indicator warning message block from cards.
                    ------------------------------------------------------------- */}
                    {/* {exceedsCredit(item) && (
                      <span className="pending-indication">
                        exceeds remaining credit
                      </span>
                    )} */}

                    {item.HasPendingRequest === 1 ? (
                      <span className="pending-indication">
                        have Pending req..
                      </span>
                    ) : (
                      <span></span>
                    )}

                    <span className="unit">{item.UnitName}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="pagination">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
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
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>

      <SelectedProducts onSend={() => setShowModal(true)} />

      {showModal && (
        <RequestConfirmationModal
          selectedItems={selectedItems}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
