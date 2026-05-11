import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import "./Department.css";
import { FaSort, FaSortUp, FaSortDown, FaSearch, FaEdit } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import { RiAddLargeLine } from "react-icons/ri";
import { exportDepartmentsExcel } from "./exportDepartmentsExcel";
import { RiFileExcel2Line } from "react-icons/ri";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export default function Departments() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const [departments, setDepartments] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const urlYear = searchParams.get("year");

  const [year, setYear] = useState(urlYear || currentYear);
  const [yearOptions, setYearOptions] = useState([]);

  const [selectedDeptUsers, setSelectedDeptUsers] = useState([]);
  const [showUsersModal, setShowUsersModal] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [departmentName, setDepartmentName] = useState("");
  const [floor, setFloor] = useState("");
  const [editId, setEditId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const fetchDepartments = async () => {
    const res = await axios.get(
      `${import.meta.env.VITE_API_URL}/api/department-manager/stats?year=${year}`,
    );
    setDepartments(res.data);
  };

  const fetchYears = async () => {
    const res = await axios.get(
      `${import.meta.env.VITE_API_URL}/api/department-manager/years`,
    );
    setYearOptions(res.data);
  };

  const availableYears = useMemo(() => {
    return new Set(yearOptions);
  }, [yearOptions]);

  useEffect(() => {
    fetchDepartments();
  }, [year]);

  useEffect(() => {
    fetchYears();
  }, []);

  useEffect(() => {
    const urlYear = searchParams.get("year");

    if (urlYear) {
      setYear(urlYear);
    } else {
      setYear(currentYear);
      setSearchParams({ year: currentYear });
    }
  }, []);

  useEffect(() => {
    const urlYear = searchParams.get("year");
    if (urlYear && urlYear !== year) {
      setYear(urlYear);
    }
  }, [searchParams]);

  const filteredDepartments = departments.filter(
    (d) =>
      d.DepartmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.Floor.toString().includes(searchTerm),
  );

  const handleSort = (key) => {
    let direction = "asc";

    if (sortConfig.key === key) {
      if (sortConfig.direction === "asc") direction = "desc";
      else if (sortConfig.direction === "desc") direction = null;
    }

    setSortConfig({
      key: direction ? key : null,
      direction,
    });
  };

  const getRankClass = (i) => {
    if (i === 0) return "rank-gold";
    if (i === 1) return "rank-silver";
    if (i === 2) return "rank-bronze";
    return "";
  };

  const handleRowClick = async (deptId) => {
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/department-manager/stats/${deptId}/users?year=${year}`,
      );

      setSelectedDeptUsers(res.data);
      setShowUsersModal(true);
    } catch {
      Swal.fire("Error", "Failed to load users", "error");
    }
  };

  const handleSave = async () => {
    if (!departmentName.trim()) {
      Swal.fire("Validation", "Department name is required", "warning");
      return;
    }

    const result = await Swal.fire({
      title: editId ? "Confirm Edit?" : "Confirm Add?",
      text: "This action will save the changes to the Division.",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, save it!",
    });

    if (!result.isConfirmed) return;

    try {
      if (editId) {
        await axios.put(
          `${import.meta.env.VITE_API_URL}/api/department-manager/${editId}`,
          { DepartmentName: departmentName, Floor: floor },
        );
      } else {
        await axios.post(
          `${import.meta.env.VITE_API_URL}/api/department-manager`,
          { DepartmentName: departmentName, Floor: floor },
        );
      }

      // SUCCESS MESSAGE
      Swal.fire({
        title: "Success!",
        text: editId
          ? "Division updated successfully."
          : "Division added successfully.",
        icon: "success",
      });

      fetchDepartments();
      setShowModal(false);
    } catch (error) {
      Swal.fire("Error", "Something went wrong while saving.", "error");
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "Delete this Division?",
      text: "This Division will be removed unless it's not empty.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    });

    if (!result.isConfirmed) return;

    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/department-manager/${id}`,
      );

      // SUCCESS MESSAGE
      Swal.fire({
        title: "Deleted!",
        text: "The division has been deleted.",
        icon: "success",
      });

      fetchDepartments();
    } catch (error) {
      Swal.fire(
        "Error",
        "Failed to delete division. Ensure it is empty first.",
        "error",
      );
    }
  };

  const handleEdit = (d) => {
    setEditId(d.DepartmentID);
    setDepartmentName(d.DepartmentName);
    setFloor(d.Floor);
    setShowModal(true);
  };

  const sortedDepartments = [...filteredDepartments];

  if (sortConfig.key) {
    sortedDepartments.sort((a, b) => {
      let aValue = a[sortConfig.key] ?? 0;
      let bValue = b[sortConfig.key] ?? 0;

      if (typeof aValue === "string") {
        return sortConfig.direction === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
    });
  }

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return <FaSort />;
    if (sortConfig.direction === "asc") return <FaSortUp />;
    if (sortConfig.direction === "desc") return <FaSortDown />;
    return <FaSort />;
  };

  return (
    <div className="department-container">
      <div className="department-header">
        <h2>
          Division Management{" "}
          <span className="dept-count">{sortedDepartments.length}</span>
        </h2>

        <div className="year-filter">
          <p className="date-range-label">Year: </p>

          <DatePicker
            className="year-range"
            selected={year === "ALL" ? null : new Date(year, 0)}
            onChange={(date) => {
              const selectedYear = date.getFullYear();

              setYear(selectedYear);
              setSearchParams({ year: selectedYear });
            }}
            showYearPicker
            dateFormat="yyyy"
            placeholderText="Select Year"
            filterDate={(date) => {
              const y = date.getFullYear();
              return availableYears.has(y); // disable empty years
            }}
          />

          {/* OVERALL BUTTON */}
          <button
            className="year-overall"
            onClick={() => {
              setYear("ALL");
              setSearchParams({ year: "ALL" });
            }}
          >
            Overall
          </button>
        </div>
      </div>

      <div className="department-toolbar">
        <div className="department-filter-download">
          <div className="search-wrapper">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search department or floor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="department-search"
            />
          </div>
          <button
            onClick={() => exportDepartmentsExcel(year)}
            className="excel-download-btn"
          >
            <RiFileExcel2Line className="excel-download-icon" /> Download Table
          </button>
        </div>
        <button
          className="add-btn"
          onClick={() => {
            setShowModal(true);
            setEditId(null);
            setDepartmentName("");
            setFloor("");
          }}
        >
          <RiAddLargeLine className="add-icon" /> Add Division
        </button>
      </div>

      <div className="department-table-container">
        <table className="department-table">
          <thead>
            <tr>
              <th>#</th>
              <th
                onClick={() => handleSort("DepartmentName")}
                className="sortable"
              >
                Division Name {renderSortIcon("DepartmentName")}
              </th>
              <th>Users</th>

              <th
                onClick={() => handleSort("TotalIssued")}
                className="sortable"
              >
                Item Released {renderSortIcon("TotalIssued")}
              </th>
              <th onClick={() => handleSort("Quantity")} className="sortable">
                Released Quantity {renderSortIcon("Quantity")}
              </th>
              <th
                onClick={() => handleSort("TotalAmount")}
                className="sortable"
              >
                Total Amount {renderSortIcon("TotalAmount")}
              </th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {sortedDepartments.map((d, i) => (
              <tr
                key={d.DepartmentID}
                className={getRankClass(i)}
                onClick={() => handleRowClick(d.DepartmentID)}
              >
                <td>{i + 1}</td>

                <td>
                  <div className="requester-fullname">{d.DepartmentName}</div>
                  <div className="requester-department">{d.Floor} FLOOR</div>
                </td>

                <td>{d.TotalUsers}</td>

                <td>{d.TotalIssued}</td>

                <td>{d.Quantity}</td>
                <td>
                  Php{" "}
                  {Number(d.TotalAmount).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>

                <td
                  className="department-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button className="edit" onClick={() => handleEdit(d)}>
                    <FaEdit /> Edit
                  </button>
                  <button
                    className="delete"
                    onClick={() => handleDelete(d.DepartmentID)}
                  >
                    <MdDelete /> Delete
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
              {editId ? "Edit Department" : "Add Department"}
            </div>

            <div className="custom-modal-body">
              <input
                type="text"
                value={departmentName}
                onChange={(e) => setDepartmentName(e.target.value)}
                placeholder="Enter Division name"
                className="custom-input"
                style={{ textTransform: "uppercase" }}
              />

              <input
                type="number"
                value={floor}
                onChange={(e) => setFloor(Number(e.target.value))}
                placeholder="Enter floor number"
                className="custom-input"
              />

              <div className="custom-modal-actions">
                <button
                  className="cancel-btn"
                  onClick={() => {
                    setShowModal(false);
                    setEditId(null);
                    setDepartmentName("");
                    setFloor("");
                  }}
                >
                  Cancel
                </button>

                <button className="confirm-btn" onClick={handleSave}>
                  {editId ? "Update" : "Add"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUsersModal && (
        <div className="modal-overlay">
          <div className="user-division-modal">
            <div className="user-division-header">Department Users</div>

            <div className="user-division-body">
              <div className="user-division-table-wrapper">
                <table className="user-division-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Username</th>
                      <th>Name</th>
                      <th>Total (Qnty)</th>
                      <th>Accepted (Qnty)</th>
                      <th>Rejected (Qnty)</th>
                      <th>Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDeptUsers.map((u, index) => (
                      <tr
                        key={u.EmployeeID}
                        onClick={() =>
                          navigate(`/admin/requester-accounts/${u.UserName}`)
                        }
                      >
                        <td>{index + 1}</td>
                        <td>{u.UserName}</td>
                        <td>
                          {u.Firstname} {u.Lastname}
                        </td>

                        {/* TOTAL QUANTITY */}
                        <td>
                          {u.Accepted + u.Rejected}
                          <span>({u.TotalQuantity})</span>
                        </td>

                        {/* COUNT + QUANTITY */}
                        <td>
                          {u.Accepted} <span>({u.AcceptedQty})</span>
                        </td>
                        <td>
                          {u.Rejected} <span>({u.RejectedQty})</span>
                        </td>
                        <td>
                          Php{" "}
                          {Number(u.TotalAmount).toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="modal-footer">
                <button
                  className="cancel-btn"
                  onClick={() => setShowUsersModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
