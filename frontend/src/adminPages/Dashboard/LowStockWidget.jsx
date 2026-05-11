import { useLowStock } from "../../hooks/Dashboard/useLowStock";
import BeatLoader from "react-spinners/BeatLoader";
import { useNavigate } from "react-router-dom";
import { IoArrowForwardOutline } from "react-icons/io5";

export default function LowStockWidget() {
  const { data, isLoading } = useLowStock();
  const navigate = useNavigate();

  const items = data?.items || [];
  const summary = data?.summary || {
    total: 0,
    critical: 0,
    outOfStock: 0,
  };

  return (
    <div className="low-stock-widget">
      <div>
        <div className="low-stock-widget-header">
          <h2 className="low-stock-title">
            Low Stock <span>{summary.critical + summary.outOfStock}</span>
          </h2>
          <div>
            <span className="low-stock-critical-count">
              Crt: {summary.critical}
            </span>{" "}
            <span className="low-stock-out-count">
              Out Stck: {summary.outOfStock}
            </span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="spinner-container">
          <BeatLoader size={15} color="#1e3a8a" />
        </div>
      ) : (
        <div className="low-stock-table-wrapper">
          <table className="low-stock-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
              </tr>
            </thead>

            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan="2" className="no-data">
                    No critical stock.
                  </td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr
                    key={index}
                    style={{ cursor: "pointer" }} // ✅ UX
                    onClick={() =>
                      navigate(`/admin/stock-control/${item.StockCardID}`)
                    }
                  >
                    <td>
                      <p className="low-stock-name">{item.StockName}</p>
                      <p className="low-stock-desc">
                        {item.Description.length > 25
                          ? `${item.Description.substring(0, 25)}...`
                          : item.Description}
                      </p>
                    </td>

                    <td>
                      {item.Quantity}{" "}
                      <span className="low-stock-unit">{item.UnitName}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="widget-view-container">
        <button
          onClick={() => navigate(`/admin/stock-control?status=Critical`)}
          className="widget-view-btn"
        >
          View All <IoArrowForwardOutline className="widget-view-icon" />
        </button>
      </div>
    </div>
  );
}
