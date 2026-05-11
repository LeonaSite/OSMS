import { AiOutlineQuestionCircle } from "react-icons/ai";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

export default function RequestConfirmationModal({
  selectedItems,
  onClose,
  onSuccess,
}) {
  const navigate = useNavigate();
  const [purpose, setPurpose] = useState("FOR OFFICE USE");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const res = await axios.post(
        `${API}/api/requester/products/send-request`,
        {
          items: selectedItems,
          Purpose: purpose,
        },
        { withCredentials: true },
      );

      //  CLEAR CONTEXT
      onSuccess();

      //  NAVIGATE TO SUCCESS PAGE
      navigate("/requester/dashboard/request-success", {
        state: {
          requestData: {
            requisitionNo: res.data.RequisitionNo,
            requestedAt: new Date(), // or res.data.RequestedAt if backend returns
            items: selectedItems.map((item) => ({
              StockName: item.StockName,
              Description: item.Description,
              Quantity: item.quantity,
              UnitName: item.UnitName,
            })),
          },
        },
      });

      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to send request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="req-selected-modal-overlay">
      <div className="req-selected-modal-container">
        <div className="req-selected-modal-icon">
          <AiOutlineQuestionCircle />
        </div>

        <h2 className="req-selected-modal-title">
          Do you want to Send this Request?
        </h2>

        <div className="req-selected-modal-table-wrapper">
          <table className="req-selected-modal-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Specification</th>
                <th>Quantity</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {selectedItems.map((item) => (
                <tr key={item.StockID}>
                  <td>{item.StockName}</td>
                  <td>{item.Description}</td>
                  <td>{item.quantity}</td>
                  <td>{item.UnitName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="req-selected-modal-purpose">
          <label>What’s the plan for these items?</label>
          <input
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="req-selected-modal-input"
          />
        </div>

        <div className="req-selected-modal-actions">
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>

          <button
            className="confirm-btn"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Sending..." : "Send Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
