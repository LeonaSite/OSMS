import { useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import EmployeeSelectorModal from "./EmployeeSelectorModal";
import StockSelectorModal from "./RequestStockSelectorModal";
import QuantityInput from "../../Utilities/QuantityInput";
import "./NewRequisitionModal.css";
import { MdDeleteForever } from "react-icons/md";

export default function NewRequisitionModal({ close, refresh }) {
  const [employee, setEmployee] = useState(null);
  const [items, setItems] = useState([]);

  const [showEmp, setShowEmp] = useState(false);
  const [showStock, setShowStock] = useState(false);
  const [purpose, setPurpose] = useState("FOR OFFICE");

  const addItem = (stock) => {
    const exist = items.find((i) => i.StockID === stock.StockID);

    if (exist) {
      if (exist.Quantity < stock.Quantity) {
        setItems(
          items.map((i) =>
            i.StockID === stock.StockID
              ? { ...i, Quantity: i.Quantity + 1 }
              : i,
          ),
        );
      }
    } else {
      setItems([
        ...items,
        {
          ...stock,
          Quantity: 1,
          QuantityAvailable: stock.Quantity,
        },
      ]);
    }
  };

  const submitRequest = async () => {
    if (!employee) {
      Swal.fire({
        icon: "warning",
        title: "Missing Requester",
        text: "Please select a requester before submitting.",
      });

      return;
    }

    if (items.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "No Items",
        text: "Please add at least one item to request.",
      });

      return;
    }

    const zeroItem = items.find((i) => i.Quantity === 0);

    if (zeroItem) {
      Swal.fire({
        icon: "warning",
        title: "Invalid Quantity",
        text: `Quantity of ${zeroItem.StockName} is 0`,
      });

      return;
    }

    const confirm = await Swal.fire({
      title: "Submit Requisition?",
      text: "Do you want to submit this request?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, submit",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    try {
      const payload = items.map((i) => ({
        StockID: i.StockID,
        Quantity: i.Quantity,
      }));

      await axios.post(`${import.meta.env.VITE_API_URL}/api/requests/create`, {
        EmployeeID: employee.EmployeeID,
        Purpose: purpose,
        items: payload,
      });

      Swal.fire({
        icon: "success",
        title: "Request Submitted",
        text: "The requisition has been created.",
      });

      refresh();
      close();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Submission Failed",
        text: "Could not create requisition.",
      });
    }
  };

  const hasZeroQty = items.some((i) => i.Quantity === 0);

  return (
    <div className="modal-overlay">
      <div className="new-req-modal">
        <div className="new-req-modal-header">New Requisition</div>

        <div className="new-req-modal-body">
          <div className="new-req-modal-inputs">
            <div>
              <label className="select-requester-label">Requester Name</label>

              <button
                className="select-requester"
                onClick={() => setShowEmp(true)}
              >
                {employee
                  ? `${employee.Firstname} ${employee.Lastname}`
                  : "-Select Requester Name-"}
              </button>
            </div>

            <div>
              <label className="select-requester-label">Purpose</label>
              <input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>
          </div>

          <div className="new-requisition-table-wrapper">
            <table className="new-requisition-table">
              <thead>
                <tr>
                  <th>Stock card #</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => (
                  <tr key={item.StockID}>
                    <td>{item.StockCardID}</td>

                    <td>
                      <div>{item.StockName}</div>
                      <small>{item.Description}</small>
                    </td>

                    <td>
                      <QuantityInput
                        value={item.Quantity}
                        min={0}
                        max={item.QuantityAvailable || item.Quantity}
                        onChange={(val) => {
                          setItems(
                            items.map((i) =>
                              i.StockID === item.StockID
                                ? { ...i, Quantity: val }
                                : i,
                            ),
                          );
                        }}
                      />
                    </td>

                    <td>{item.UnitName}</td>

                    <td>
                      <button
                        className="new-req-delete"
                        onClick={() =>
                          setItems(
                            items.filter((i) => i.StockID !== item.StockID),
                          )
                        }
                      >
                        <MdDeleteForever />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div
              className="add-new-requisition"
              onClick={() => setShowStock(true)}
            >
              <button className="add-new-requisition-btn">+ Add Item</button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={close} className="cancel-btn">
            Cancel
          </button>

          <button onClick={submitRequest} className="confirm-btn">
            Request Now
          </button>
        </div>
      </div>

      {showEmp && (
        <EmployeeSelectorModal
          close={() => setShowEmp(false)}
          select={setEmployee}
        />
      )}

      {showStock && (
        <StockSelectorModal
          close={() => setShowStock(false)}
          onSelectStock={addItem}
        />
      )}
    </div>
  );
}
