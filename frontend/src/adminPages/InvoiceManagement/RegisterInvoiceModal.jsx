  import { useState } from "react";
  import axios from "axios";
  import Swal from "sweetalert2";
  import StockSelectorModal from "./StockSelectorModal";
  import "./RegisterInvoiceModal.css"
  import QuantityInput from "../../Utilities/QuantityInput";
  import { MdDeleteForever } from "react-icons/md";
  import {RiAddLargeLine} from "react-icons/ri";

export default function RegisterInvoiceModal({ close, refresh }) {

    const [invoiceNumber, setInvoiceNumber] = useState("");
    const [stocks, setStocks] = useState([]);
    const [showStockModal, setShowStockModal] = useState(false);

    // ADD STOCK
    const addStock = (stock) => {

      const exist = stocks.find(s => s.StockID === stock.StockID);

      if (exist) {
        setStocks(stocks.map(s =>
          s.StockID === stock.StockID
            ? { ...s, Quantity: s.Quantity + 1 }
            : s
        ));
      } else {
        setStocks([
          ...stocks,
          { ...stock, Quantity: 1 }
        ]);
      }
    };

    const changeQty = (id, type) => {

      setStocks(stocks.map(s => {

        if (s.StockID !== id) return s;

        let qty = s.Quantity;

        if (type === "plus") qty++;
        if (type === "minus" && qty > 1) qty--;

        return { ...s, Quantity: qty };

      }));

    };

    const removeStock = (id) => {
      setStocks(stocks.filter(s => s.StockID !== id));
    };

    const submitInvoice = async () => {

      if (!invoiceNumber) {
        return Swal.fire({
          title: "Enter Invoice Number",
          icon: "error",
        });
      }

      if (!stocks.length) {
        return Swal.fire("Add at least 1 item");
      }

      const confirm = await Swal.fire({
        title: "Create Invoice?",
        text: "Stocks will be added to inventory.",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Yes, Add",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#4c66d6"
      });

      if (!confirm.isConfirmed) return;

      try {

        await axios.post(
          `${import.meta.env.VITE_API_URL}/api/invoices/create`,
          {
            invoiceNumber,
            items: stocks
          },
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`
            }
          }
        );

        Swal.fire({
          icon: "success",
          title: "Invoice Created",
          timer: 1500,
          showConfirmButton: false
        });

        refresh();
        close();

      } catch (err) {

        Swal.fire({
          icon: "error",
          title: "Error creating invoice"
        });

      }

    };

    const handleCancel = async () => {

    if (!invoiceNumber && stocks.length === 0) {
      return close();
    }

    const confirm = await Swal.fire({
      title: "Discard changes?",
      text: "Invoice information will be lost.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Close",
      cancelButtonText: "Stay",
      confirmButtonColor: "#d33"
    });

    if (confirm.isConfirmed) {
      close();
    }

  };

    return (
      <div className="modal-overlay">

        <div className="register-invoice-modal">
          <div className="register-invoice-modal-header">
            Register new Sale Invoice / Receipt Number
          </div>

          <div className="register-invoice-modal-body">

            <input
              className="register-invoice-modal-input"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Sale Invoice Number / Delivery Receipt"
            />

            <div className="register-invoice-table-wrapper">
              <table className="register-invoice-table">

                <thead>
                  <tr>
                    <th>Stock card #</th>
                    <th>Item</th>
                    <th>Qnty.</th>
                    <th>Unit</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>

                  {stocks.map(stock => (

                    <tr key={stock.StockID}>

                      <td>{stock.StockCardID}</td>

                      <td>
                        <div className="select-item-name">{stock.StockName} </div>
                        <div className="select-item-desc">{stock.Description}</div>
                      </td>

                      <td>
                        <QuantityInput
                          value={stock.Quantity}
                          onChange={(newQty) =>
                            setStocks(stocks.map(s =>
                              s.StockID === stock.StockID
                                ? { ...s, Quantity: newQty }
                                : s
                            ))
                          }
                          min={1}
                        />
                      </td>

                      <td>{stock.UnitName}</td>

                      <td>
                        <button onClick={() => removeStock(stock.StockID)} className="register-invoice-delete-row">
                            <MdDeleteForever/>
                        </button>
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

              <div className="add-register-invoice" onClick={() => setShowStockModal(true)}>
                <button
                  className="add-register-invoice-btn"
                  
                >
                  + Add Item...
                </button>
              </div>
            </div>

            

            <div className="modal-footer">

              <button onClick={handleCancel} className="cancel-btn">  
                Cancel
              </button>

              <button onClick={submitInvoice} className="confirm-btn">
                Add now
              </button>

            </div>
          </div>
        </div>

        {showStockModal && (
          <StockSelectorModal
            close={() => setShowStockModal(false)}
            addStock={addStock}
          />
        )}

      </div>
    );

}