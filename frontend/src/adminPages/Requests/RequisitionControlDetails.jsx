import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import RequestInvoiceSelectorModal from "./RequestInvoiceSelectorModal";
import StockSelectorModal from "./RequestStockSelectorModal";
import { formatDateTime } from "../../Utilities/FormatDateTime";
import QuantityInput from "../../Utilities/QuantityInput";
import "./RequisitionControlDetails.css";
import { TbArrowsExchange } from "react-icons/tb";
import { RiEdit2Fill } from "react-icons/ri";
import { MdDeleteForever } from "react-icons/md";
import Swal from "sweetalert2";
import BeatLoader from "react-spinners/BeatLoader";
import { useRequisitionDetails } from "../../hooks/Requests/useRequisitionDetails";
import { PDFDownloadLink } from "@react-pdf/renderer";
import RequisitionSlip from "../../Utilities/RequisitionSlip";
import { pdf } from "@react-pdf/renderer";

export default function RequisitionControlDetails() {
  const { requisitionNo } = useParams();
  const navigate = useNavigate();
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [newQty, setNewQty] = useState(0);
  const [maxQty, setMaxQty] = useState(null);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectRemarks, setRejectRemarks] = useState("");
  const [showEditRemarks, setShowEditRemarks] = useState(false);
  const [editRemarksValue, setEditRemarksValue] = useState("");
  const [receivedBy, setReceivedBy] = useState("");

  const { request, items, isLoading, validation, isInvalidInvoice, refresh } =
    useRequisitionDetails(requisitionNo);

  const safeItems = items || [];

  const totalRequestAmount = safeItems.reduce(
    (sum, item) => sum + Number(item.TotalAmount || 0),
    0,
  );

  /* === CREDITS DISABLE ===
  const remainingCredit = Number(request?.RemainingCredit || 0);
  const isOverCredit = totalRequestAmount > remainingCredit;
  */
  // Temporary fallback so checks don't break
  const isOverCredit = false;

  const isPending = request?.StatusName === "Pending";

  useEffect(() => {
    if (isInvalidInvoice && showAcceptModal) {
      setShowAcceptModal(false);

      Swal.fire({
        icon: "warning",
        title: "Invalid Invoice",
        text: "Some invoice quantities are invalid. Please fix them first.",
      });
    }
  }, [isInvalidInvoice, showAcceptModal]);

  useEffect(() => {
    if (!request) return;

    /* === CREDITS DISABLE ===
    if (isOverCredit) {
      setRejectRemarks("Request exceeds available credit.");
    } else {
      setRejectRemarks("Requested Item Out of Stock.");
    }
    */
    setRejectRemarks("Requested Item Out of Stock.");
  }, [request, isOverCredit]);

  const openInvoiceModal = (item) => {
    if (!isPending) return;
    setSelectedStock(item);
    setShowInvoiceModal(true);
  };

  const openEditModal = async (item) => {
    if (!isPending) return;
    setEditItem(item);
    setNewQty(item.Quantity);

    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/requests/by-stock/${item.StockID}`,
      );

      const totalStockQty = res.data.reduce(
        (sum, inv) => sum + Number(inv.Quantity || 0),
        0,
      );

      setMaxQty(totalStockQty);
    } catch (err) {
      console.error(err);
      setMaxQty(null);
    }

    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    const confirm = await Swal.fire({
      title: "Confirm Update",
      text: "This will clear invoice mapping and update quantity.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, save it!",
    });

    if (!confirm.isConfirmed) return;

    try {
      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/requests/update/${editItem.RequestDetailsID}`,
        { quantity: newQty },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      Swal.fire("Updated!", "Item updated successfully.", "success");

      setShowEditModal(false);
      refresh();
    } catch (err) {
      Swal.fire("Error", "Failed to update item", "error");
    }
  };

  const handleAddItemToRequest = async (stock) => {
    if (!isPending) return;

    const exists = safeItems.find((i) => i.StockID === stock.StockID);

    if (exists) {
      Swal.fire("Warning", "Item already exists in request", "warning");
      return;
    }

    const confirm = await Swal.fire({
      title: "Add Item?",
      text: `Add "${stock.StockName}" to this request?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, add it!",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/requests/request-details/add`,
        {
          RequestID: request.RequestID,
          StockID: stock.StockID,
          Quantity: 1,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      Swal.fire("Added!", "Item added successfully", "success");

      refresh();
    } catch (err) {
      Swal.fire("Error", "Failed to add item", "error");
    }
  };

  const handleDeleteItem = async (item) => {
    if (!isPending) return;

    const confirm = await Swal.fire({
      title: "Remove Item?",
      text: `This will permanently remove "${item.StockName}" from the request.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, remove it",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/requests/request-details/delete/${item.RequestDetailsID}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      Swal.fire("Removed!", "Item has been removed.", "success");

      refresh();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to remove item", "error");
    }
  };

  const isIncomplete = safeItems.some((item) => {
    const totalInvoiceQty = item.invoices
      ? item.invoices.reduce((sum, inv) => sum + inv.Quantity, 0)
      : 0;

    return totalInvoiceQty !== item.Quantity;
  });

  const handleOpenAccept = async () => {
    /* === CREDITS DISABLE ===
    if (isOverCredit) {
      Swal.fire(
        "Insufficient Credit",
        "Request exceeds available department credit.",
        "error",
      );
      return;
    }
    */

    if (isInvalidInvoice) {
      Swal.fire("Invalid", "Fix invoice quantities first", "warning");
      return;
    }

    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/requests/history-summary/${request.RequestID}`,
      );

      setRemarks(res.data.text);
      setShowAcceptModal(true);
    } catch (err) {
      console.error(err);
      setRemarks("");
      setShowAcceptModal(true);
    }
  };

  const handleConfirmAccept = async () => {
    try {
      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/requests/accept/${request.RequestID}`,
        { remarks },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      Swal.fire("Success", "Request accepted", "success");
      setShowAcceptModal(false);
      refresh();
    } catch (err) {
      Swal.fire("Error", "Failed to accept request", "error");
    }
  };

  const handleOpenReject = () => {
    if (!isPending) return;

    /* === CREDITS DISABLE ===
    if (isOverCredit) {
      setRejectRemarks("Request exceeds available credit.");
    } else {
      setRejectRemarks("Requested Item Out of Stock.");
    }
    */
    setRejectRemarks("Requested Item Out of Stock.");

    setShowRejectModal(true);
  };

  const handleConfirmReject = async () => {
    const confirm = await Swal.fire({
      title: "Reject Request?",
      text: "This will reject the request and clear its history.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, reject it!",
    });

    if (!confirm.isConfirmed) return;

    try {
      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/requests/reject/${request.RequestID}`,
        { remarks: rejectRemarks },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      Swal.fire("Rejected", "Request has been rejected.", "success");

      setShowRejectModal(false);
      refresh();
    } catch (err) {
      Swal.fire("Error", "Failed to reject request", "error");
    }
  };

  const handleSaveRemarks = async () => {
    const confirm = await Swal.fire({
      title: "Update Remarks?",
      text: "This will overwrite the current remarks.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, update it!",
    });

    if (!confirm.isConfirmed) return;

    try {
      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/requests/remarks/${request.RequestID}`,
        { remarks: editRemarksValue },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      Swal.fire("Updated!", "Remarks updated successfully.", "success");

      setShowEditRemarks(false);
      refresh();
    } catch (err) {
      Swal.fire("Error", "Failed to update remarks", "error");
    }
  };

  const handleDownloadPDF = async () => {
    const defaultName = `${request.Firstname} ${request.Lastname}`;

    const { value: inputName } = await Swal.fire({
      title: "Received By",
      input: "text",
      inputLabel: "Enter receiver name",
      inputValue: defaultName,
      showCancelButton: true,
      confirmButtonText: "Download",
      inputValidator: (value) => {
        if (!value) return "Receiver name is required!";
      },
    });

    if (!inputName) return;

    setReceivedBy(inputName);

    const blob = await pdf(
      <RequisitionSlip
        request={request}
        items={safeItems}
        receivedBy={inputName}
      />,
    ).toBlob();

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `Requisition-${request.RequisitionNo}.pdf`;
    link.click();

    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="spinner-container">
        <BeatLoader size={15} color="#1e3a8a" />
      </div>
    );
  }

  if (!request) return null;

  return (
    <div className="req-details-container">
      <button
        className="back-btn"
        onClick={() => {
          Swal.close();

          if (window.history.length > 1) {
            navigate(-1);
          } else {
            navigate("/admin/requisition-control");
          }
        }}
      >
        {"< BACK"}
      </button>

      <h2 className="details-title">
        <span onClick={() => navigate("/admin/requisition-control")}>
          Requisition Control{" "}
        </span>{" "}
        &gt; Details
      </h2>

      {/* BASIC DETAILS */}

      <div className="req-basic-details">
        <h2>Basic Details</h2>
        <div className="req-basic-details-grid">
          <div>
            <p className="req-basic-label">Request No.</p>
            <h2>{request.RequisitionNo}</h2>
          </div>

          <div>
            <p className="req-basic-label">Request Date</p>
            <h3>{formatDateTime(request.RequestedAt)}</h3>
          </div>

          <div className="req-basic-status">
            <p className="req-basic-label">Status</p>
            <span className={`status ${request.StatusName}`}>
              {request.StatusName}
            </span>
          </div>

          <div>
            <p className="req-basic-label">Processed Date</p>
            <h3>
              {request.ProcessedAt
                ? formatDateTime(request.ProcessedAt)
                : "---"}
            </h3>
          </div>
        </div>
      </div>

      <div className="req-details-grid">
        {/* ITEMS */}

        <div className="req-details-items">
          <div className="req-details-items-header">
            <div className="req-details-items-header-left">
              <h2>Item Requested</h2>
              {isPending && (
                <button onClick={() => setIsEditingItems((prev) => !prev)}>
                  <p>{isEditingItems ? "Add Invoices" : "Edit Mode"}</p>
                  <TbArrowsExchange className="change-icon" />
                </button>
              )}
            </div>
            <p>
              Grand Total:{" "}
              <span className="req-grandtotal">
                Php.{" "}
                {items
                  .reduce((sum, item) => sum + Number(item.TotalAmount || 0), 0)
                  .toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
              </span>
            </p>
          </div>

          <div className="req-details-table-wrapper">
            <table className="req-details-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Stock card #</th>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Unit</th>
                  <th>Total Amount</th>
                  <th>{isEditingItems ? "Actions" : "Sale Invoice #"}</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item, index) => (
                  <tr key={item.RequestDetailsID}>
                    <td>{index + 1}</td>

                    <td>{item.StockCardID}</td>

                    <td>
                      <div className="item-name">{item.StockName}</div>
                      <div className="item-desc">{item.Description}</div>
                    </td>

                    <td>{item.Quantity}</td>

                    <td>{item.UnitName}</td>
                    <td>
                      Php.{" "}
                      {Number(item.TotalAmount).toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>

                    <td>
                      {/* ✅ EDIT MODE (ONLY PENDING) */}
                      {isEditingItems && isPending ? (
                        <div className="action-buttons">
                          <button
                            className="req-edit-btn"
                            onClick={() => openEditModal(item)}
                          >
                            <RiEdit2Fill />
                          </button>

                          <button
                            className="req-delete-btn"
                            onClick={() => handleDeleteItem(item)}
                            disabled={items.length === 1}
                          >
                            <MdDeleteForever />
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* ✅ SHOW INVOICE WHEN STATUS IS NOT PENDING */}
                          {item.invoices && item.invoices.length > 0 ? (
                            <div className="invoice-display">
                              {item.invoices.map((inv, idx) => (
                                <span key={idx}>
                                  {inv.InvoiceNo} [{inv.Quantity}]
                                  {idx !== item.invoices.length - 1 && ", "}
                                </span>
                              ))}
                            </div>
                          ) : (
                            !isPending && (
                              <span className="no-invoice">No Invoice</span>
                            )
                          )}

                          {/* ✅ ONLY ALLOW EDIT WHEN PENDING */}
                          {isPending && (
                            <button
                              className="link-btn"
                              onClick={() => openInvoiceModal(item)}
                            >
                              {item.invoices?.length > 0
                                ? "Change Invoice #"
                                : "+ Add Invoice #"}
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {isEditingItems ? (
              <div
                className="add-req-details"
                onClick={() => setShowStockModal(true)}
              >
                <button className="add-req-details-btn">+ Add Item</button>
              </div>
            ) : (
              <></>
            )}
          </div>

          {!isPending && (
            <div className="req-remarks-container">
              <h3>
                Remarks
                <RiEdit2Fill
                  className="edit-remarks"
                  title="Edit Remarks"
                  onClick={() => {
                    setEditRemarksValue(request.Remarks || "");
                    setShowEditRemarks(true);
                  }}
                />
              </h3>
              <div className="remarks-box">
                {showEditRemarks ? (
                  <div className="remarks-edit-container">
                    <textarea
                      value={editRemarksValue}
                      onChange={(e) => setEditRemarksValue(e.target.value)}
                    />
                    <div className="modal-footer">
                      <button
                        className="cancel-btn"
                        onClick={() => setShowEditRemarks(false)}
                      >
                        Cancel
                      </button>

                      <button
                        className="confirm-btn"
                        onClick={handleSaveRemarks}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p>{request.Remarks || "---"}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* REQUESTER */}

        <div className="req-details-requester">
          <h2>Requester Details</h2>

          <div className="info-block">
            <label>Name</label>
            <p>
              {request.Firstname} {request.Lastname}
            </p>
          </div>

          <div className="info-block">
            <label>Division</label>
            <p>{request.DepartmentName}</p>
          </div>

          {/* === CREDITS DISABLE  === */}
          {/* <div className="info-block">
            <label>Remaining Credit</label>

            <p>
              Php{" "}
              {Number(request.RemainingCredit || 0).toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>

            <p style={{ fontSize: "12px", color: "#888" }}>
              Budget Year: {request.CreditYear || "N/A"}
            </p>
          </div> */}

          <div className="info-block">
            <label>Request Purpose</label>
            <p>{request.Purpose}</p>
          </div>

          <div className="decision-box">
            {isPending ? (
              <>
                <h3>Would you Accept the Request?</h3>
                <div className="button-container">
                  <button
                    className="accept-btn"
                    onClick={handleOpenAccept}
                    /* Credits condition omitted from disabled state */
                    disabled={isIncomplete || isInvalidInvoice}
                  >
                    Accept
                  </button>

                  <button className="reject-btn" onClick={handleOpenReject}>
                    Reject
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>Request Completed</h3>
                <div className="button-container">
                  {request.StatusName === "Accepted" && (
                    <button className="print-btn" onClick={handleDownloadPDF}>
                      Download Requisition Slip
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* INVOICE MODAL */}

      {showInvoiceModal && (
        <RequestInvoiceSelectorModal
          stock={selectedStock}
          onClose={(shouldRefresh) => {
            setShowInvoiceModal(false);

            if (shouldRefresh) {
              refresh();
            }
          }}
        />
      )}

      {showEditModal && (
        <div className="modal-overlay">
          <div className="req-edt-quantity-modal">
            <div className="req-edt-quantity-modal-header">
              Edit Item Quantity
            </div>
            <div className="req-edt-quantity-modal-body">
              <div className="req-edt-quantity-modal-header-container">
                <h3 className="req-edt-quantity-modal-header-list">
                  Stock Item:{" "}
                  <span>
                    {editItem.StockName} - {editItem.Description}
                  </span>
                </h3>
                <p className="req-max">
                  Max allowed: <span>{maxQty}</span>
                </p>
              </div>

              <div className="req-edt-quantity-modal-input">
                <label>Quantity :</label>
                <QuantityInput
                  value={newQty}
                  onChange={setNewQty}
                  min={1}
                  max={Number.isFinite(maxQty) ? maxQty : undefined}
                />
              </div>

              <div className="modal-footer">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="cancel-btn"
                >
                  Cancel
                </button>

                <button onClick={handleSaveEdit} className="confirm-btn">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAcceptModal && (
        <div className="modal-overlay">
          <div className="accept-modal">
            <div className="accept-modal-header">Accept Request</div>

            <div className="accept-modal-body">
              <p>Remarks (Optional)</p>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter remarks..."
                rows={5}
              />
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setShowAcceptModal(false)}
                className="cancel-btn"
              >
                Cancel
              </button>

              <button onClick={handleConfirmAccept} className="confirm-btn">
                Confirm Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="modal-overlay">
          <div className="accept-modal">
            <div className="reject-modal-header">Reject Request</div>

            <div className="accept-modal-body">
              <p>Remarks</p>
              <textarea
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
                rows={5}
              />
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setShowRejectModal(false)}
                className="cancel-btn"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmReject}
                className="confirm-nega-btn"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {showStockModal && (
        <StockSelectorModal
          close={() => setShowStockModal(false)}
          onSelectStock={handleAddItemToRequest}
          mode="edit"
        />
      )}
    </div>
  );
}
