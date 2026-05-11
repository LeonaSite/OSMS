import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import axios from "axios";

export const exportTopProductsExcel = async (year) => {
  try {
    const API = import.meta.env.VITE_API_URL;
    const workbook = new ExcelJS.Workbook();

    const res = await axios.get(`${API}/api/top-products?year=${year}`);
    let data = res.data;

    data = data.filter(
      (d) => (d.TotalRequests ?? 0) > 0 || (d.QuantityReleased ?? 0) > 0,
    );

    data.sort((a, b) => b.QuantityReleased - a.QuantityReleased);
    const top10 = data.slice(0, 10);

    // ✅ ONLY ADD THIS (label formatter from TopProducts.js)
    const formatLabel = (name, desc) => {
      const fullText = `${name} - ${desc || ""}`;
      const MAX_TOTAL = 100;
      const LINE_LIMIT = 12;

      const truncated =
        fullText.length > MAX_TOTAL
          ? fullText.substring(0, MAX_TOTAL).trim() + "..."
          : fullText;

      const words = truncated.split(" ");
      const lines = [];
      let currentLine = "";

      words.forEach((word) => {
        if ((currentLine + word).length > LINE_LIMIT) {
          if (currentLine.length > 0) {
            lines.push(currentLine.trim());
            currentLine = word + " ";
          } else {
            lines.push(word);
            currentLine = "";
          }
        } else {
          currentLine += word + " ";
        }
      });

      if (currentLine.trim().length > 0) {
        lines.push(currentLine.trim());
      }

      return lines; // ⚠️ keep as array for Chart.js
    };

    const ws = workbook.addWorksheet("Top Products Report", {
      views: [{ state: "frozen", ySplit: 24 }],
    });

    // ==========================================
    // HEADER (UNCHANGED)
    // ==========================================
    ws.mergeCells("A1:G1");
    ws.mergeCells("A2:G2");

    ws.getCell("A1").value = "TOP PRODUCTS REPORT";
    ws.getCell("A2").value = `(${year === "ALL" ? "All Years" : year})`;

    ws.getCell("A1").font = { size: 16, bold: true };
    ws.getCell("A1").alignment = { horizontal: "center" };
    ws.getCell("A2").alignment = { horizontal: "center" };

    // ==========================================
    // CHART (ONLY LABEL CHANGED)
    // ==========================================
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 400;

    const ctx = canvas.getContext("2d");
    const { Chart } = await import("chart.js/auto");

    const chart = new Chart(ctx, {
      type: "bar",
      data: {
        // ✅ CHANGED HERE ONLY
        labels: top10.map((i) => formatLabel(i.StockName, i.Description)),
        datasets: [
          {
            label: "Requests",
            data: top10.map((i) => i.TotalRequests),
            backgroundColor: "#14b8a6",
          },
          {
            label: "Released Quantity",
            data: top10.map((i) => i.QuantityReleased),
            backgroundColor: "#1e3a8a",
          },
        ],
      },
      options: {
        responsive: false,
        animation: false,
        plugins: { legend: { position: "top" } },
        scales: {
          x: {
            ticks: {
              maxRotation: 0,
              minRotation: 0,
              font: {
                size: 8,
              },
            },
          },
          y: { beginAtZero: true },
        },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
    const base64Image = canvas.toDataURL("image/png");
    chart.destroy();

    const imageId = workbook.addImage({
      base64: base64Image,
      extension: "png",
    });

    ws.addImage(imageId, {
      tl: { col: 0, row: 3 },
      br: { col: 7, row: 23 },
      editAs: "oneCell",
    });

    // ==========================================
    // TABLE (UNCHANGED)
    // ==========================================
    const startRow = 25;

    ws.columns = [
      { header: "#", key: "rank", width: 6 },
      { header: "StockCard#", key: "stockCard", width: 15 },
      { header: "Item", key: "item", width: 30 },
      { header: "Requests", key: "req", width: 15 },
      { header: "Released Qty", key: "rel", width: 18 },
      { header: "Unit", key: "unit", width: 10 },
      { header: "Top Products", key: "amount", width: 18 },
    ];

    const headerRow = ws.getRow(startRow);
    headerRow.values = ws.columns.map((c) => c.header);

    data.forEach((item, i) => {
      ws.addRow({
        rank: i + 1,
        stockCard: item.StockCardID,
        item: `${item.StockName} - ${item.Description}`,
        req: item.TotalRequests,
        rel: item.QuantityReleased,
        unit: item.UnitName,
        amount: item.TotalAmount || 0,
      });
    });

    // ==========================================
    // STYLING (UNCHANGED)
    // ==========================================
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

    ws.autoFilter = { from: `A${startRow}`, to: `G${startRow}` };
    ws.getColumn("amount").numFmt = '"Php. "#,##0.00';

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Top_Products_Report_${year}.xlsx`);
  } catch (err) {
    console.error(err);
    alert("Export failed");
  }
};
