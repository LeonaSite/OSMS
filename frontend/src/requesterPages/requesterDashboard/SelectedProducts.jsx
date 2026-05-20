import QuantityInput from "../../Utilities/QuantityInput";
import { useSelectedItems } from "../../requesterComponents/Context/SelectedItemsContext";
import "./SelectedProducts.css";

export default function SelectedProducts({ onSend }) {
  const { selectedItems, setSelectedItems } = useSelectedItems();

  const updateQty = (stockId, qty) => {
    setSelectedItems((prev) =>
      prev.map((item) =>
        item.StockID === stockId ? { ...item, quantity: qty } : item,
      ),
    );
  };

  const removeItem = (stockId) => {
    setSelectedItems((prev) => prev.filter((item) => item.StockID !== stockId));
  };

  const getMaxQty = (item) => {
    const price = item.Price || 1;
    const maxByCredit = Math.floor(item.RemainingCredit / price);
    return Math.min(item.Quantity, maxByCredit);
  };

  return (
    <div className="selected-products">
      <h3 className="selected-title">Selected Items</h3>
      <div className="selected-requested-items">
        {selectedItems.length === 0 ? (
          <p className="empty-text">No items selected</p>
        ) : (
          selectedItems.map((item) => (
            <div key={item.StockID} className="selected-card">
              <div className="selected-info">
                <h4>{item.StockName}</h4>
                <p>{item.Description}</p>

                <span
                  className="selected-delete-btn"
                  onClick={() => removeItem(item.StockID)}
                >
                  Delete
                </span>
              </div>

              <QuantityInput
                value={item.quantity}
                onChange={(val) => updateQty(item.StockID, val)}
                min={1}
                max={getMaxQty(item)}
              />
            </div>
          ))
        )}
      </div>

      <button
        className="send-btn"
        disabled={selectedItems.length === 0}
        onClick={onSend}
      >
        SEND REQUEST
      </button>
    </div>
  );
}
