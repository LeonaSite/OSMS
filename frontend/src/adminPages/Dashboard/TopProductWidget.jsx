// TopProductWidget.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import { IoArrowForwardOutline } from "react-icons/io5";

export default function TopProductWidget() {
  const currentYear = new Date().getFullYear();
  const [items, setItems] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTopItems();
  }, []);

  const fetchTopItems = async () => {
    try {
      const API = import.meta.env.VITE_API_URL;
      const res = await axios.get(`${API}/api/adminDashboard/top-items`, {
        params: {
          year: currentYear,
        },
      });

      setItems(res.data || []);
    } catch (err) {
      console.error("Failed to load top items:", err);
    }
  };

  const truncate = (text, max = 28) => {
    if (!text) return "";
    return text.length > max ? text.slice(0, max) + "..." : text;
  };

  return (
    <div className="dashboard-widget top-product-widget">
      <div className="widget-header">
        <h3>Top Item Requested {currentYear}</h3>

        <button
          className="widget-view-btn"
          onClick={() => navigate("/admin/top-products")}
        >
          View All <IoArrowForwardOutline className="widget-view-icon" />
        </button>
      </div>

      <div className="top-product-list">
        {items.length > 0 ? (
          items.slice(0, 5).map((item, index) => (
            <div className="top-product-item" key={index}>
              <div className="rank-number">{index + 1}</div>

              <div className="top-product-info">
                <div className="top-product-name">{item.name}</div>
                <div className="top-product-desc">
                  {truncate(item.description)}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="widget-empty">No data available</div>
        )}
      </div>
    </div>
  );
}
