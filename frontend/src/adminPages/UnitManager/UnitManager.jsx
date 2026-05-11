import { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import "./UnitManager.css";

import { FaSort, FaSortUp, FaSortDown } from "react-icons/fa";
import { FaSearch } from "react-icons/fa";
import { FaEdit } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import { RiAddLargeLine } from "react-icons/ri";

export default function UnitManager() {
  const [units, setUnits] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [unitName, setUnitName] = useState("");
  const [editId, setEditId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState(null);

  const filteredUnits = units.filter((unit) =>
    unit.UnitName.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleSort = () => {
    let order = "asc";

    if (sortOrder === "asc") order = "desc";
    if (sortOrder === "desc") order = "asc";

    setSortOrder(order);

    const sorted = [...units].sort((a, b) => {
      if (order === "asc") {
        return a.UnitName.localeCompare(b.UnitName);
      } else {
        return b.UnitName.localeCompare(a.UnitName);
      }
    });

    setUnits(sorted);
  };

  const fetchUnits = async () => {
    const res = await axios.get(
      `${import.meta.env.VITE_API_URL}/api/unit-manager`,
    );
    setUnits(res.data);
  };

  useEffect(() => {
    fetchUnits();
  }, []);

  const handleSave = async () => {
    if (!unitName.trim()) {
      Swal.fire("Validation", "Unit name is required", "warning");
      return;
    }

    const result = await Swal.fire({
      title: editId ? "Confirm Edit?" : "Confirm Add?",
      text: editId
        ? "Are you sure you want to update this unit?"
        : "Are you sure you want to add this unit?",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, proceed",
    });

    if (!result.isConfirmed) return;

    try {
      if (editId) {
        await axios.put(
          `${import.meta.env.VITE_API_URL}/api/unit-manager/${editId}`,
          {
            UnitName: unitName,
          },
        );

        // Auto-closing success alert
        Swal.fire({
          title: "Updated!",
          text: "Unit has been updated.",
          icon: "success",
          showConfirmButton: false, // Removes the OK button
          timer: 1500, // Closes after 1.5 seconds
        });
      } else {
        await axios.post(`${import.meta.env.VITE_API_URL}/api/unit-manager`, {
          UnitName: unitName,
        });

        // Auto-closing success alert
        Swal.fire({
          title: "Added!",
          text: "Unit has been added.",
          icon: "success",
          showConfirmButton: false,
          timer: 1500,
        });
      }

      setUnitName("");
      setEditId(null);
      setShowModal(false);
      fetchUnits();
    } catch (error) {
      Swal.fire("Error", "Something went wrong.", "error");
    }
  };

  const handleEdit = (unit) => {
    setEditId(unit.UnitID);
    setUnitName(unit.UnitName);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This action cannot be undone!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    });

    if (!result.isConfirmed) return;

    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/unit-manager/${id}`,
      );

      // Auto-closing success alert
      Swal.fire({
        title: "Deleted!",
        text: "Unit has been deleted.",
        icon: "success",
        showConfirmButton: false,
        timer: 1500,
      });

      fetchUnits();
    } catch (error) {
      Swal.fire("Error", "Failed to delete unit.", "error");
    }
  };

  return (
    <div className="unit-container">
      <div className="unit-header">
        <h2>Unit Management</h2>
        <p className="unit-count">
          Total Units: <span>{filteredUnits.length}</span>
        </p>
      </div>

      <div className="unit-toolbar">
        <div className="search-wrapper">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search unit name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="unit-search"
          />
        </div>

        <button
          className="add-btn"
          onClick={() => {
            setEditId(null);
            setUnitName("");
            setShowModal(true);
          }}
        >
          <RiAddLargeLine className="add-icon" /> Add New Unit
        </button>
      </div>

      <div className="unit-table-container">
        <table className="unit-table">
          <thead>
            <tr>
              <th className="unit-index">#</th>
              <th
                onClick={handleSort}
                style={{ cursor: "pointer" }}
                className="unit-name"
              >
                Unit Name {sortOrder === null && <FaSort />}
                {sortOrder === "asc" && <FaSortUp />}
                {sortOrder === "desc" && <FaSortDown />}
              </th>
              <th className="unit-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUnits.map((unit, index) => (
              <tr key={unit.UnitID}>
                <td className="unit-index">{index + 1}</td>
                <td>{unit.UnitName}</td>
                <td className="unit-actions">
                  <button onClick={() => handleEdit(unit)} className="edit">
                    <FaEdit className="unit-action-icons" /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(unit.UnitID)}
                    className="delete"
                  >
                    <MdDelete className="unit-action-icons" /> Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="custom-modal">
            <div className="custom-modal-header">
              {editId ? "Edit Unit Name" : "Register Unit Name"}
            </div>

            <div className="custom-modal-body">
              <input
                type="text"
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                placeholder="Enter unit name"
                className="custom-input"
                style={{ textTransform: "uppercase" }}
              />

              <div className="custom-modal-actions">
                <button
                  className="cancel-btn"
                  onClick={() => {
                    setShowModal(false);
                    setEditId(null);
                    setUnitName("");
                  }}
                >
                  Cancel
                </button>

                <button className="confirm-btn" onClick={handleSave}>
                  {editId ? "Update now" : "Add now"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
