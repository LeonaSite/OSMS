import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { formatDateTime } from "../../Utilities/FormatDateTime";

export const exportReportsExcel = async ({
  overview = [],
  requests = [],
  arrivals = [],
  from,
  to,
  filter = "monthly", // 🔥 PASS THIS FROM COMPONENT
}) => {
  try {
    const workbook = new ExcelJS.Workbook();

    // ==========================================
    // 🔥 SAME FORMAT LABEL AS UI
    // ==========================================
    const formatLabel = (period) => {
      if (!period) return "";

      const val = String(period);

      if (filter === "daily") {
        const date = new Date(val);
        return isNaN(date)
          ? val
          : date.toLocaleDateString("en-US", {
              month: "short",
              day: "2-digit",
              year: "numeric",
            });
      }

      if (filter === "weekly") {
        if (!val.includes("-W")) return val;

        const [year, week] = val.split("-W");
        return `Week ${week} ${year}`;
      }

      if (filter === "monthly") {
        const date = new Date(val + "-01");
        return isNaN(date)
          ? val
          : date.toLocaleString("en-US", {
              month: "short",
              year: "numeric",
            });
      }

      return val;
    };

    // ==========================================
    // 🏷 TITLE + FILE NAME
    // ==========================================
    const year = from ? new Date(from).getFullYear() : "ALL";
    const filterTitle = filter.charAt(0).toUpperCase() + filter.slice(1);

    const mainTitle = `${filterTitle} Supply Report ${year}`;

    // ==========================================
    // 📊 CHART IMAGE
    // ==========================================
    const labels = overview.map((o) => formatLabel(o.period));
    const arrived = overview.map((o) => o.ArrivedQty || 0);
    const released = overview.map((o) => o.ReleasedQty || 0);

    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 400;

    const ctx = canvas.getContext("2d");
    const { Chart } = await import("chart.js/auto");

    const chart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Arrived",
            data: arrived,
            borderColor: "#f59e0b",
            backgroundColor: "rgba(245,158,11,0.2)",
            tension: 0.4,
          },
          {
            label: "Released",
            data: released,
            borderColor: "#2563eb",
            backgroundColor: "rgba(37,99,235,0.2)",
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: false,
        animation: false,
        plugins: { legend: { position: "top" } },
        scales: { y: { beginAtZero: true } },
      },
    });

    await new Promise((r) => setTimeout(r, 500));

    const base64 = canvas.toDataURL("image/png");
    chart.destroy();

    const imageId = workbook.addImage({
      base64,
      extension: "png",
    });

    // ==========================================
    // 🟦 SHEET 1: REQUESTS
    // ==========================================
    const ws1 = workbook.addWorksheet("Requests Report", {
      views: [{ state: "frozen", ySplit: 24 }],
    });

    ws1.mergeCells("A1:H1");
    ws1.getCell("A1").value = mainTitle;
    ws1.getCell("A1").font = { size: 16, bold: true };
    ws1.getCell("A1").alignment = { horizontal: "center" };

    ws1.addImage(imageId, {
      tl: { col: 0, row: 2 },
      br: { col: 8, row: 22 },
    });

    const startRow1 = 24;

    ws1.columns = [
      { header: "#", key: "idx", width: 6 },
      { header: "Req No", key: "req", width: 18 },
      { header: "Requester", key: "emp", width: 25 },
      { header: "Item", key: "item", width: 35 },
      { header: "Qty", key: "qty", width: 10 },
      { header: "Unit", key: "unit", width: 10 },
      { header: "Total", key: "amount", width: 18 },
      { header: "Date", key: "date", width: 20 },
    ];

    ws1.getRow(startRow1).values = ws1.columns.map((c) => c.header);

    requests.forEach((r, i) => {
      ws1.addRow({
        idx: i + 1,
        req: r.RequisitionNo,
        emp: r.EmployeeName,
        item: `${r.StockName} - ${r.Description}`,
        qty: r.Quantity,
        unit: r.UnitName,
        amount: r.TotalAmount,
        date: formatDateTime(r.ProcessedAt), // 🔥 FIXED
      });
    });

    // ==========================================
    // 🟩 SHEET 2: ARRIVALS
    // ==========================================
    const ws2 = workbook.addWorksheet("Arrivals Report", {
      views: [{ state: "frozen", ySplit: 24 }],
    });

    ws2.mergeCells("A1:G1");
    ws2.getCell("A1").value = mainTitle;
    ws2.getCell("A1").font = { size: 16, bold: true };
    ws2.getCell("A1").alignment = { horizontal: "center" };

    ws2.addImage(imageId, {
      tl: { col: 0, row: 2 },
      br: { col: 7, row: 22 },
    });

    const startRow2 = 24;

    ws2.columns = [
      { header: "#", key: "idx", width: 6 },
      { header: "Invoice", key: "inv", width: 18 },
      { header: "Item", key: "item", width: 35 },
      { header: "Qty", key: "qty", width: 10 },
      { header: "Unit", key: "unit", width: 10 },
      { header: "Total", key: "amount", width: 18 },
      { header: "Date", key: "date", width: 20 },
    ];

    ws2.getRow(startRow2).values = ws2.columns.map((c) => c.header);

    arrivals.forEach((a, i) => {
      ws2.addRow({
        idx: i + 1,
        inv: a.InvoiceNumber,
        item: `${a.StockName} - ${a.Description}`,
        qty: a.Quantity,
        unit: a.UnitName,
        amount: a.TotalAmount,
        date: formatDateTime(a.InvoiceDate), // 🔥 FIXED
      });
    });

    // ==========================================
    // 🎨 STYLING
    // ==========================================
    const styleSheet = (ws, startRow, lastCol) => {
      const headerRow = ws.getRow(startRow);

      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFEDEDED" },
        };
        cell.font = { bold: true };
        cell.alignment = { horizontal: "center" };
      });

      ws.eachRow((row, rowNumber) => {
        if (rowNumber < startRow) return;
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      });

      ws.autoFilter = {
        from: `A${startRow}`,
        to: `${lastCol}${startRow}`,
      };

      ws.getColumn("amount").numFmt = '"Php "#,##0.00';
    };

    styleSheet(ws1, startRow1, "H");
    styleSheet(ws2, startRow2, "G");

    // ==========================================
    // 💾 SAVE FILE
    // ==========================================
    const buffer = await workbook.xlsx.writeBuffer();

    saveAs(
      new Blob([buffer]),
      `${filterTitle}_Supply_Report_${year}.xlsx`, // 🔥 FIXED NAME
    );
  } catch (err) {
    console.error(err);
    alert("Export failed");
  }
};
