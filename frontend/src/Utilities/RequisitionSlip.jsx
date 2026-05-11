import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatDateTime } from "./FormatDateTime";

// 🔥 STYLES
const styles = StyleSheet.create({
  page: {
    padding: 10,
    fontSize: 7, // ✅ shrink everything
    fontFamily: "Helvetica",
  },

  // ✅ GRID 2x2
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  slip: {
    width: "50%",
    height: "50%",
    padding: 8,
    borderWidth: 1,
  },

  formatyContainer: {
    alignItems: "flex-end",
    marginBottom: 5,
  },

  formaty: {
    fontFamily: "Times-Roman",
    borderWidth: 1,
    padding: 3,
  },

  header: {
    textAlign: "center",
    marginBottom: 5,
  },

  companyTitle: {
    fontSize: 7.5,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 10,
  },

  title: {
    fontSize: 7,
    fontStyle: "italic",
  },

  dateSection: {
    alignItems: "flex-end",
    marginBottom: 5,
  },

  underline: {
    textDecoration: "underline",
  },

  to: {
    marginBottom: 3,
  },

  table: {
    borderWidth: 1,
    marginBottom: 5,
  },

  tableRow: {
    flexDirection: "row",
    minHeight: 12,
  },

  tableHeader: {
    backgroundColor: "#eee",
    borderBottomWidth: 1,
  },

  cell: {
    padding: 2,
    borderRightWidth: 1,
  },

  lastCell: {
    padding: 2,
  },

  colQty: { width: "15%" },
  colUnit: { width: "15%" },
  colParticular: { width: "70%" },

  footer: {
    marginTop: 5,
    marginBottom: 30,
  },

  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    marginRight: 20,
  },
});

// ✅ SINGLE SLIP (FULL FEATURES PRESERVED)
const Slip = ({
  request,
  paddedItems,
  fullName,
  adminFullName,
  receivedBy,
  toLabel,
}) => (
  <View style={styles.slip}>
    {/* ✅ FORMATY STILL HERE */}
    <View style={styles.formatyContainer}>
      <View style={styles.formaty}>
        <Text>NMIS-AMD-PT-F-001</Text>
        <Text>Version. 01</Text>
        <Text>Eff. Date: August 15, 24</Text>
      </View>
    </View>

    {/* HEADER */}
    <View style={styles.header}>
      <Text style={styles.companyTitle}>National Meat Inspection Service</Text>
    </View>

    <View style={styles.dateSection}>
      <View style={{ alignItems: "center" }}>
        <Text style={styles.underline}>
          {formatDateTime(request.ProcessedAt)}
        </Text>
        <Text style={{ marginTop: 2 }}>Date</Text>
      </View>
    </View>

    <View style={styles.header}>
      <Text style={styles.title}>REQUISITION SLIP</Text>
    </View>

    <Text style={styles.to}>TO : {toLabel}</Text>
    <Text>Please furnish the following items:</Text>

    {/* TABLE */}
    <View style={styles.table}>
      <View style={[styles.tableRow, styles.tableHeader]}>
        <Text style={[styles.cell, styles.colQty]}>QTY.</Text>
        <Text style={[styles.cell, styles.colUnit]}>UNIT</Text>
        <Text style={[styles.lastCell, styles.colParticular]}>PARTICULAR</Text>
      </View>

      {paddedItems.map((item, index) => (
        <View
          key={index}
          style={[
            styles.tableRow,
            { borderBottomWidth: index === paddedItems.length - 1 ? 0 : 1 },
          ]}
        >
          <Text style={[styles.cell, styles.colQty]}>{item.Quantity}</Text>

          <Text style={[styles.cell, styles.colUnit]}>{item.UnitName}</Text>

          <Text style={[styles.lastCell, styles.colParticular]}>
            {item.StockName ? `${item.StockName} - ${item.Description}` : ""}
          </Text>
        </View>
      ))}
    </View>

    <Text>PURPOSE: {request.Purpose || "N/A"}</Text>

    {/* FOOTER */}
    <View style={styles.footer}>
      <View style={styles.signatureRow}>
        <View>
          <Text style={{ marginBottom: 10 }}>Requested By:</Text>
          <Text style={styles.underline}>{fullName}</Text>
        </View>

        <View>
          <Text style={{ marginBottom: 10 }}>Released By:</Text>
          <Text style={styles.underline}>{adminFullName}</Text>
        </View>
      </View>

      <View style={styles.signatureRow}>
        <View>
          <Text style={{ marginBottom: 10 }}>Received By:</Text>
          <Text style={styles.underline}>{receivedBy || fullName}</Text>
        </View>
      </View>
    </View>
  </View>
);

const RequisitionSlip = ({ request, items, receivedBy }) => {
  const fullName = `${request.Firstname} ${request.Lastname}`;
  const adminFullName = request.AdminFirstname
    ? `${request.AdminFirstname} ${request.AdminLastname}`
    : "Admin";

  const copyRecipients = [
    "Property Officer",
    "Recording",
    "COA",
    request.DepartmentName || "Department", // safe fallback
  ];

  // ✅ KEEP 10 ROWS MINIMUM
  const minRows = 10;
  const paddedItems = [...items];

  while (paddedItems.length < minRows) {
    paddedItems.push({
      Quantity: "",
      UnitName: "",
      StockName: "",
      Description: "",
    });
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.grid}>
          {/* ✅ 4 COPIES */}
          {copyRecipients.map((recipient, i) => (
            <Slip
              key={i}
              request={request}
              paddedItems={paddedItems}
              fullName={fullName}
              adminFullName={adminFullName}
              receivedBy={receivedBy}
              toLabel={recipient}
            />
          ))}
        </View>
      </Page>
    </Document>
  );
};

export default RequisitionSlip;
