import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import { formatDateTime } from "../../Utilities/FormatDateTime";
import { FaSearch, FaSort, FaSortUp, FaSortDown } from "react-icons/fa";
import "./RequesterAccounts.css";

import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";

const API = import.meta.env.VITE_API_URL;

export default function RequesterAccounts() {
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [deptFull, setDeptFull] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState("");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    password: "",
    confirmPassword: "",
    departmentID: "",
  });

  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: null,
  });

  /* ================= FETCH ================= */
  useEffect(() => {
    fetchAccounts();
    fetchDepartments();
  }, []);

  const fetchAccounts = async (departmentName = "") => {
    try {
      let url = `${API}/api/requesterAccounts`;
      if (departmentName) url += `?department=${departmentName}`;

      const res = await axios.get(url);
      setAccounts(Array.isArray(res.data) ? res.data : []);
    } catch {
      setAccounts([]);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await axios.get(`${API}/api/requesterAccounts/departments`);
      setDepartments(Array.isArray(res.data) ? res.data : []);
    } catch {
      setDepartments([]);
    }
  };

  /* ================= SORTING ================= */
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

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return <FaSort />;
    if (sortConfig.direction === "asc") return <FaSortUp />;
    if (sortConfig.direction === "desc") return <FaSortDown />;
    return <FaSort />;
  };

  /* ================= SEARCH + SORT ================= */
  const filteredAccounts = useMemo(() => {
    let data = accounts.filter((acc) =>
      `${acc.username} ${acc.fullname} ${acc.department}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );

    if (sortConfig.key) {
      data.sort((a, b) => {
        if (sortConfig.key === "createdAt") {
          return sortConfig.direction === "asc"
            ? new Date(a.createdAt) - new Date(b.createdAt)
            : new Date(b.createdAt) - new Date(a.createdAt);
        }

        return sortConfig.direction === "asc"
          ? String(a[sortConfig.key]).localeCompare(String(b[sortConfig.key]))
          : String(b[sortConfig.key]).localeCompare(String(a[sortConfig.key]));
      });
    }

    return data;
  }, [accounts, search, sortConfig]);

  const handleDeptChange = async (value) => {
    setForm({ ...form, departmentID: value });

    if (!value) return setDeptFull(false);

    const res = await axios.get(
      `${API}/api/requesterAccounts/department-count/${value}`,
    );

    setDeptFull(res.data.count >= 2);
  };

  const handleRegister = async () => {
    // 🔐 REQUIRED FIELDS CHECK
    const {
      firstName,
      lastName,
      username,
      password,
      confirmPassword,
      departmentID,
    } = form;

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !username.trim() ||
      !password ||
      !confirmPassword ||
      !departmentID
    ) {
      return Swal.fire(
        "Incomplete Form",
        "Please fill out all required fields.",
        "warning",
      );
    }

    // 🔐 PASSWORD MATCH
    if (password !== confirmPassword) {
      return Swal.fire("Password Mismatch", "Passwords do not match.", "error");
    }

    // 🔐 DEPARTMENT FULL (FRONTEND CONTROL)
    if (deptFull) {
      return Swal.fire(
        "Department Full",
        "This department already has the maximum of 2 requesters.",
        "error",
      );
    }

    const confirm = await Swal.fire({
      title: "Register account?",
      text: "Please confirm before creating this account.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, register",
    });

    if (!confirm.isConfirmed) return;

    try {
      await axios.post(`${API}/api/requesterAccounts`, {
        firstName,
        lastName,
        username,
        password,
        departmentID,
      });

      Swal.fire("Success", "Account created successfully!", "success");

      setShowModal(false);
      setForm({
        firstName: "",
        lastName: "",
        username: "",
        password: "",
        confirmPassword: "",
        departmentID: "",
      });

      setDeptFull(false);
      fetchAccounts();
    } catch {
      Swal.fire(
        "Error",
        "Unable to create account. Please try again.",
        "error",
      );
    }
  };

  const handleDepartmentFilter = (deptName) => {
    setSelectedDepartment(deptName);

    // Update URL
    const url = new URL(window.location.href);
    if (deptName) url.searchParams.set("department", deptName);
    else url.searchParams.delete("department");
    window.history.replaceState({}, "", url);

    // FETCH ACCOUNTS BY DEPARTMENT
    fetchAccounts(deptName);
  };

  let data = accounts.filter((acc) =>
    `${acc.username} ${acc.fullname} ${acc.department}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  // Filter by department if selected
  if (selectedDepartment) {
    data = data.filter((acc) => acc.department === selectedDepartment);
  }

  // 🥇🥈🥉 RANK COLORS
  const getRankClass = (i) => {
    if (i === 0) return "rank-gold";
    if (i === 1) return "rank-silver";
    if (i === 2) return "rank-bronze";
    return "";
  };

  return (
    <div className="requester-container">
      {/* HEADER */}
      <div className="requester-header">
        <h2>Requester Accounts</h2>
      </div>

      {/* SEARCH + CREATE */}
      <div className="requester-topbar">
        <div className="requester-filters">
          <div className="requester-search-wrapper">
            <FaSearch className="requester-search-icon" />
            <input
              type="text"
              placeholder="Search Name, Username, Department"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="requester-search"
              autoComplete="off"
            />
          </div>

          {/* DEPARTMENT FILTER */}
          <div className="requester-department-filter">
            <select
              value={selectedDepartment}
              onChange={(e) => handleDepartmentFilter(e.target.value)}
            >
              <option value="">All Division</option>
              {departments.map((d) => (
                <option key={d.DepartmentID} value={d.DepartmentName}>
                  {d.DepartmentName} (Floor {d.Floor})
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          className="add-btn"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowModal(true);
          }}
        >
          Create Account
        </button>
      </div>

      {/* TABLE */}
      <table className="requester-table">
        <thead>
          <tr>
            <th>#</th>
            <th onClick={() => handleSort("username")} className="sortable">
              Username {renderSortIcon("username")}
            </th>
            <th onClick={() => handleSort("fullname")} className="sortable">
              Name {renderSortIcon("fullname")}
            </th>
            <th onClick={() => handleSort("totalAmount")} className="sortable">
              Total Amount {renderSortIcon("totalAmount")}
            </th>
            <th
              onClick={() => handleSort("totalReleased")}
              className="sortable"
            >
              Item Released {renderSortIcon("totalReleased")}
            </th>
            <th onClick={() => handleSort("quantity")} className="sortable">
              Quantity {renderSortIcon("quantity")}
            </th>
            <th onClick={() => handleSort("createdAt")} className="sortable">
              Created On {renderSortIcon("createdAt")}
            </th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {filteredAccounts.map((acc, i) => (
            <tr
              key={acc.username}
              className={getRankClass(i)}
              onClick={() =>
                navigate(`/admin/requester-accounts/${acc.username}`)
              }
            >
              <td>{i + 1}</td>
              <td>{acc.username}</td>
              <td>
                <div className="requester-fullname">{acc.fullname}</div>
                <div className="requester-department">{acc.department}</div>
              </td>
              <td>
                Php.{" "}
                {Number(acc.totalAmount).toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
              <td>{acc.totalReleased}</td>
              <td>{acc.totalQuantity}</td>
              <td>{formatDateTime(acc.createdAt)}</td>
              <td>
                <button
                  className="requester-details-btn"
                  onClick={() =>
                    navigate(`/admin/requester-accounts/${acc.username}`)
                  }
                >
                  Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* MODAL */}
      {showModal && (
        <div className="requester-modal-overlay">
          <div className="requester-modal-box">
            <div className="requester-modal-header">
              Register Employee Account
            </div>

            <div className="requester-modal-body">
              <form autoComplete="off">
                <div className="requester-section">
                  <h4>
                    PERSONAL INFO <span>(2 Requester per Division)</span>
                  </h4>

                  <div className="requester-form-grid">
                    <div className="form-input">
                      <label>First Name</label>
                      <input
                        value={form.firstName}
                        onChange={(e) =>
                          setForm({ ...form, firstName: e.target.value })
                        }
                      />
                    </div>

                    <div className="form-input">
                      <label>Last Name</label>
                      <input
                        value={form.lastName}
                        onChange={(e) =>
                          setForm({ ...form, lastName: e.target.value })
                        }
                      />
                    </div>

                    <div className="form-input">
                      <label>Division</label>
                      <select
                        value={form.departmentID}
                        onChange={(e) => handleDeptChange(e.target.value)}
                      >
                        <option value="">-- Select Division --</option>
                        {departments.map((d) => (
                          <option key={d.DepartmentID} value={d.DepartmentID}>
                            {d.DepartmentName} (Floor {d.Floor})
                          </option>
                        ))}
                      </select>

                      {deptFull && (
                        <p className="error-text">
                          This department already has 2 requesters.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="requester-section">
                  <h4>ACCOUNT</h4>

                  <div className="requester-form-grid">
                    <div className="form-input">
                      <label>Username</label>
                      <input
                        autoComplete="off"
                        value={form.username}
                        onChange={(e) =>
                          setForm({ ...form, username: e.target.value })
                        }
                      />
                    </div>

                    <div className="form-input">
                      <div className="password-label">
                        <label>Password</label>
                        <span
                          className="toggle-password"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <>
                              <AiOutlineEyeInvisible /> Hide
                            </>
                          ) : (
                            <>
                              <AiOutlineEye /> Show
                            </>
                          )}
                        </span>
                      </div>

                      <input
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={form.password}
                        onChange={(e) =>
                          setForm({ ...form, password: e.target.value })
                        }
                      />
                    </div>

                    <div className="form-input">
                      <div className="password-label">
                        <label>Confirm Password</label>
                        <span
                          className="toggle-password"
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                        >
                          {showConfirmPassword ? (
                            <>
                              <AiOutlineEyeInvisible /> Hide
                            </>
                          ) : (
                            <>
                              <AiOutlineEye /> Show
                            </>
                          )}
                        </span>
                      </div>

                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={form.confirmPassword}
                        onChange={(e) =>
                          setForm({ ...form, confirmPassword: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
              </form>
            </div>

            <div className="requester-modal-footer">
              <button
                className="cancel-btn"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>

              <button
                className="confirm-btn"
                onClick={handleRegister}
                disabled={deptFull}
              >
                Register Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
