import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import axios from "axios";
import "./App.css";

axios.defaults.withCredentials = true;

//ADMIN PAGES
import Login from "./adminPages/Login/Login.jsx";
import Navigation from "./adminComponents/Navigation/Navigation.jsx";
import Dashboard from "./adminPages/Dashboard/Dashboard.jsx";
import Reports from "./adminPages/Reports/Reports.jsx";
import { ReportsProvider } from "./adminComponents/Context/ReportsContext.jsx";
import TopProducts from "./adminPages/TopProducts/TopProducts.jsx";
import TopProductsDetails from "./adminPages/TopProducts/TopProductsDetails.jsx";
import StockControl from "./adminPages/StockControl/StockControl.jsx";
import StockControlDetails from "./adminPages/StockControl/StockControlDetails.jsx";
import InvoiceManagement from "./adminPages/InvoiceManagement/InvoiceManagement.jsx";
import InvoiceManagementDetails from "./adminPages/InvoiceManagement/InvoiceManagementDetails.jsx";
import UnitManager from "./adminPages/UnitManager/UnitManager.jsx";
import RequisitionControl from "./adminPages/Requests/RequisitionControl.jsx";
import RequisitionControlDetails from "./adminPages/Requests/RequisitionControlDetails.jsx";
import RequesterAccounts from "./adminPages/RequesterAccounts/RequesterAccounts.jsx";
import RequesterAccountDetails from "./adminPages/RequesterAccounts/RequesterAccountsDetails.jsx";
import AdminAccounts from "./adminPages/AdminAccounts/AdminAccounts.jsx";
import AdminAccountDetails from "./adminPages/AdminAccounts/AdminAccountsDetails.jsx";
import Departments from "./adminPages/Departments/Departments.jsx";
import AuditLogs from "./adminPages/AuditLogs/AuditLogs.jsx";
import AnnualBudget from "./adminPages/AnnualBudget/AnnualBudget.jsx";

import AdminPrivateRoute from "./adminComponents/Security/AdminPrivateRoute.jsx";
import { AdminNotificationProvider } from "./adminComponents/Context/AdminNotificationContext.jsx";

//EMPLOYEE PAGES (REQUESTER)
import RequesterLogin from "./requesterPages/requesterLogin/requesterLogin.jsx";
import RequesterNavigation from "./requesterComponents/Navigation/RequesterNavigation.jsx";
import RequesterDashboard from "./requesterPages/requesterDashboard/RequesterDashboard.jsx";
import RequestedList from "./requesterPages/RequestedList/RequestedList.jsx";
import RequestSuccessful from "./requesterPages/requesterDashboard/RequestSucessful.jsx";

import RequesterPrivateRoute from "./requesterComponents/Security/RequesterPrivateRoute.jsx";
import { SelectedItemsProvider } from "./requesterComponents/Context/SelectedItemsContext.jsx";
import { RequesterNotificationProvider } from "./requesterComponents/Context/RequesterNotificationContext.jsx";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RequesterLogin />} />
        {/* ================= ADMIN ================= */}
        <Route path="/admin/login" element={<Login />} />
        <Route
          path="/admin"
          element={
            <AdminPrivateRoute>
              <ReportsProvider>
                <AdminNotificationProvider>
                  <Navigation />
                </AdminNotificationProvider>
              </ReportsProvider>
            </AdminPrivateRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="reports" element={<Reports />} />
          <Route path="top-products" element={<TopProducts />} />
          <Route
            path="top-products/:stockcard"
            element={<TopProductsDetails />}
          />
          <Route path="stock-control" element={<StockControl />} />
          <Route
            path="stock-control/:stockcard"
            element={<StockControlDetails />}
          />
          <Route path="invoice-management" element={<InvoiceManagement />} />
          <Route
            path="invoice-management/:invoiceNo"
            element={<InvoiceManagementDetails />}
          />
          <Route path="unit-manager" element={<UnitManager />} />
          <Route path="requisition-control" element={<RequisitionControl />} />
          <Route
            path="requisition-control/:requisitionNo"
            element={<RequisitionControlDetails />}
          />
          <Route path="requester-accounts" element={<RequesterAccounts />} />
          <Route
            path="requester-accounts/:username"
            element={<RequesterAccountDetails />}
          />
          <Route path="admin-accounts" element={<AdminAccounts />} />
          <Route
            path="/admin/admin-accounts/:username"
            element={<AdminAccountDetails />}
          />
          <Route path="departments" element={<Departments />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="annual-budget" element={<AnnualBudget />} />
        </Route>

        {/* ================= REQUESTER ================= */}
        <Route path="/requester/login" element={<RequesterLogin />} />

        <Route
          path="/requester"
          element={
            <RequesterPrivateRoute>
              <SelectedItemsProvider>
                <RequesterNotificationProvider>
                  <RequesterNavigation />
                </RequesterNotificationProvider>
              </SelectedItemsProvider>
            </RequesterPrivateRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<RequesterDashboard />} />
          <Route path="requests" element={<RequestedList />} />
          <Route
            path="dashboard/request-success"
            element={<RequestSuccessful />}
          />
        </Route>

        {/* ================= FALLBACK ================= */}
        <Route path="*" element={<div>Page Not Found</div>} />
      </Routes>
    </Router>
  );
}

export default App;
