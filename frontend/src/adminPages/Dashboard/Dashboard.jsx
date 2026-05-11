import { useEffect, useState } from "react";
import axios from "axios";
import ReportsWidget from "./ReportsWidget";
import LowStockWidget from "./LowStockWidget";
import PendingRequestWidget from "./PendingRequestWidget";
import TopProductWidget from "./TopProductWidget";
import DivisionWidget from "./DivisionWidget";

import "./Dashboard.css";

export default function Dashboard() {
  return (
    <div className="admin-dashboard-container">
      <div className="dashboard-header">
        <h2>Admin Dashboard</h2>
      </div>

      <div className="dashboard-grid1">
        <PendingRequestWidget />
        <TopProductWidget />
      </div>
      <div className="dashboard-grid2">
        <ReportsWidget />
        <div>
          <DivisionWidget />
          <LowStockWidget />
        </div>
      </div>
    </div>
  );
}
