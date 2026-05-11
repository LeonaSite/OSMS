import { MdMarkEmailRead } from "react-icons/md";
import { useNavigate, useLocation } from "react-router-dom";
import { formatDateTime } from "../../Utilities/FormatDateTime";
import { IoReturnDownBack } from "react-icons/io5";
import "./RequestSuccessful.css";

export default function RequestSuccessful() {
  const navigate = useNavigate();
  const location = useLocation();

  // 🔥 data passed from navigate()
  const { requestData } = location.state || {};

  if (!requestData) {
    return (
      <div className="request-success-container">
        <h2>No request data found</h2>
        <button onClick={() => navigate("/requester/dashboard")}>
          Go Back
        </button>
      </div>
    );
  }

  const { requisitionNo, requestedAt, items } = requestData;

  return (
    <div className="request-success-container">
      {/* ICON */}
      <div className="request-success-icon">
        <MdMarkEmailRead />
      </div>

      {/* TITLE */}
      <h1 className="request-success-title">REQUEST SENT</h1>

      {/* DETAILS */}
      <div className="request-success-info">
        <p>
          <strong>Req No:</strong> {requisitionNo}
        </p>
        <p>
          <strong>Req Date:</strong> {formatDateTime(requestedAt)}
        </p>
      </div>

      {/* TABLE */}
      <div className="request-success-table-wrapper">
        <table className="request-success-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Description</th>
              <th>Quantity</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx}>
                <td>{item.StockName}</td>
                <td>{item.Description}</td>
                <td>{item.Quantity}</td>
                <td>{item.UnitName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* BUTTON */}
      <button
        className="request-success-btn"
        onClick={() => navigate("/requester/dashboard")}
      >
        <IoReturnDownBack className="request-success-btn-icon" /> Go to
        Dashboard
      </button>
    </div>
  );
}
