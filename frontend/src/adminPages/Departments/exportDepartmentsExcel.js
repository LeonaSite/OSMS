import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import axios from "axios";

export const exportDepartmentsExcel = async (year) => {
  try {
    const API = import.meta.env.VITE_API_URL;

    const workbook = new ExcelJS.Workbook();

    // =========================
    // FETCH DATA
    // =========================
    const deptRes = await axios.get(
      `${API}/api/department-manager/stats?year=${year}`,
    );

    const departments = deptRes.data;

    const sortedDepartments = [...departments].sort(
      (a, b) => b.TotalAmount - a.TotalAmount,
    );

    // =========================
    // SHEET 1: DIVISIONS
    // =========================
    const ws1 = workbook.addWorksheet("Divisions", {
      views: [{ state: "frozen", ySplit: 1 }], // ✅ Freeze header
    });

    ws1.columns = [
      { header: "Rank", key: "rank", width: 8 },
      { header: "Division", key: "division", width: 20 },
      { header: "Floor", key: "floor", width: 10 },
      { header: "Users", key: "users", width: 10 },
      { header: "Item Released", key: "itemReleased", width: 15 },
      { header: "Released Quantity", key: "quantity", width: 18 },
      { header: "Total Amount", key: "totalAmount", width: 18 },
    ];

    sortedDepartments.forEach((d, i) => {
      ws1.addRow({
        rank: i + 1,
        division: d.DepartmentName,
        floor: d.Floor,
        users: d.TotalUsers,
        itemReleased: d.TotalIssued,
        quantity: d.Quantity,
        totalAmount: d.TotalAmount || 0,
      });
    });

    // =========================
    // SHEET 2: USERS
    // =========================
    const ws2 = workbook.addWorksheet("Department Users", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    ws2.columns = [
      { header: "Division", key: "division", width: 20 },
      { header: "Username", key: "username", width: 20 },
      { header: "Name", key: "name", width: 25 },
      { header: "Total Quantity", key: "totalQty", width: 15 },
      { header: "Accepted (Item)", key: "accepted", width: 18 },
      { header: "Accepted (Qty)", key: "acceptedQty", width: 18 },
      { header: "Rejected (Item)", key: "rejected", width: 18 },
      { header: "Rejected (Qty)", key: "rejectedQty", width: 18 },
      { header: "Total Amount", key: "totalAmount", width: 18 },
    ];

    for (const dept of sortedDepartments) {
      const res = await axios.get(
        `${API}/api/department-manager/stats/${dept.DepartmentID}/users?year=${year}`,
      );

      const users = res.data;

      users.forEach((u) => {
        ws2.addRow({
          division: dept.DepartmentName,
          username: u.UserName,
          name: `${u.Firstname} ${u.Lastname}`,
          totalQty: u.TotalQuantity,
          accepted: u.Accepted,
          acceptedQty: u.AcceptedQty,
          rejected: u.Rejected,
          rejectedQty: u.RejectedQty,
          totalAmount: u.TotalAmount || 0,
        });
      });
    }

    // =========================
    // HEADER STYLE
    // =========================
    const styleHeader = (ws) => {
      ws.getRow(1).eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFEDEDED" },
        };

        cell.font = { bold: true };

        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
        };
      });
    };

    styleHeader(ws1);
    styleHeader(ws2);

    // =========================
    // APPLY BORDERS + STRIPES
    // =========================
    const styleTable = (ws) => {
      ws.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          // Borders
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };

          // Zebra striping (skip header)
          if (rowNumber > 1 && rowNumber % 2 === 0) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF9F9F9" },
            };
          }
        });
      });
    };

    styleTable(ws1);
    styleTable(ws2);

    // =========================
    // AUTO FILTER
    // =========================
    ws1.autoFilter = {
      from: "A1",
      to: "G1",
    };

    ws2.autoFilter = {
      from: "A1",
      to: "I1",
    };

    // =========================
    // CURRENCY FORMAT
    // =========================
    const formatCurrency = (ws, key) => {
      ws.getColumn(key).numFmt = '"Php. "#,##0.00';
    };

    formatCurrency(ws1, "totalAmount");
    formatCurrency(ws2, "totalAmount");

    // =========================
    // EXPORT
    // =========================
    const buffer = await workbook.xlsx.writeBuffer();

    saveAs(
      new Blob([buffer]),
      `Department_Report_${year === "ALL" ? "All" : year}.xlsx`,
    );
  } catch (err) {
    console.error("Export Error:", err);
    alert("Failed to export Excel");
  }
};
