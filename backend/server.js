const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const e = require("express");

//Routes
const loginRouter = require("./adminRoutes/login.js");
const unitManagerRouter = require("./adminRoutes/unitManager.js");
const stocksRouter = require("./adminRoutes/stocks.js");
const invoicesRouter = require("./adminRoutes/invoices.js");
const departmentManagerRouter = require("./adminRoutes/departmentManager.js");
const requesterAccountsRouter = require("./adminRoutes/requesterAccounts.js");
const requestsRouter = require("./adminRoutes/requests.js");
const auditLogsRouter = require("./adminRoutes/auditLogs.js");
const adminAccountsRouter = require("./adminRoutes/adminAccounts.js");
const topProductsRouter = require("./adminRoutes/topProducts.js");
const reportsRouter = require("./adminRoutes/reports.js");
const adminDashboardRouter = require("./adminRoutes/adminDashboard.js");
const adminNotificationRouter = require("./adminRoutes/adminNotification.js");
const annualBudgetRoutes = require("./adminRoutes/annualBudget.js");

//REQUESTER
const requesterLoginRouter = require("./requesterRoutes/requesterLogin.js");
const productsRouter = require("./requesterRoutes/products.js");
const requestListRouter = require("./requesterRoutes/requestList.js");
const requesterNotificationRouter = require("./requesterRoutes/requesterNotification.js");

const app = express();
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

app.use("/api/login", loginRouter);
app.use("/api/unit-manager", unitManagerRouter);
app.use("/api/stocks", stocksRouter);
app.use("/api/invoices", invoicesRouter);
app.use("/api/department-manager", departmentManagerRouter);
app.use("/api/requesterAccounts", requesterAccountsRouter);
app.use("/api/requests", requestsRouter);
app.use("/api/audit-logs", auditLogsRouter);
app.use("/api/adminAccounts", adminAccountsRouter);
app.use("/api/top-products", topProductsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/adminDashboard", adminDashboardRouter);
app.use("/api/adminNotification", adminNotificationRouter);
app.use("/api/annual-budget", annualBudgetRoutes);

//Requester
app.use("/api/requester/login", requesterLoginRouter);
app.use("/api/requester/products", productsRouter);
app.use("/api/requester/request-list", requestListRouter);
app.use("/api/requesterNotification", requesterNotificationRouter);

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});
