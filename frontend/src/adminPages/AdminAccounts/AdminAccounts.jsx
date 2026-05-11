import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import Swal from "sweetalert2";
import { formatDateTime } from "../../Utilities/FormatDateTime";
import { FaSearch, FaSort, FaSortUp, FaSortDown } from "react-icons/fa";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";

const API = import.meta.env.VITE_API_URL;

export default function AdminAccounts() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: null,
  });

  /* ================= FETCH ================= */
  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await axios.get(`${API}/api/adminAccounts`);
      setAccounts(Array.isArray(res.data) ? res.data : []);
    } catch {
      setAccounts([]);
    }
  };

  /* ================= SORT ================= */
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

  /* ================= FILTER + SORT ================= */
  const filteredAccounts = useMemo(() => {
    let data = accounts.filter((acc) =>
      `${acc.username} ${acc.fullname}`
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

  /* ================= REGISTER ================= */
  const handleRegister = async () => {
    const { firstName, lastName, username, password, confirmPassword } = form;

    if (!firstName || !lastName || !username || !password || !confirmPassword) {
      return Swal.fire("Incomplete", "Fill all fields", "warning");
    }

    if (password !== confirmPassword) {
      return Swal.fire("Error", "Passwords do not match", "error");
    }

    const confirm = await Swal.fire({
      title: "Create Admin?",
      icon: "question",
      showCancelButton: true,
    });

    if (!confirm.isConfirmed) return;

    try {
      await axios.post(`${API}/api/adminAccounts`, {
        firstName,
        lastName,
        username,
        password,
      });

      Swal.fire("Success", "Admin created!", "success");

      setShowModal(false);
      setForm({
        firstName: "",
        lastName: "",
        username: "",
        password: "",
        confirmPassword: "",
      });

      fetchAccounts();
    } catch {
      Swal.fire("Error", "Failed to create admin", "error");
    }
  };

  return (
    <div className="requester-container">
      {/* HEADER */}
      <div className="requester-header">
        <h2>Admin Accounts</h2>
      </div>

      {/* TOP BAR */}
      <div className="requester-topbar">
        <div className="requester-search-wrapper">
          <FaSearch className="requester-search-icon" />
          <input
            type="text"
            placeholder="Search Name or Username"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="requester-search"
          />
        </div>

        <button className="add-btn" onClick={() => setShowModal(true)}>
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

            <th onClick={() => handleSort("createdAt")} className="sortable">
              Created On {renderSortIcon("createdAt")}
            </th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {filteredAccounts.map((acc, i) => (
            <tr
              key={i}
              onClick={() => navigate(`/admin/admin-accounts/${acc.username}`)}
            >
              <td>{i + 1}</td>
              <td>{acc.username}</td>
              <td>{acc.fullname}</td>
              <td>{formatDateTime(acc.createdAt)}</td>
              <td>
                <button
                  className="requester-details-btn"
                  onClick={() =>
                    navigate(`/admin/admin-accounts/${acc.username}`)
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
            <div className="requester-modal-header">Create Admin Account</div>

            <div className="requester-modal-body">
              <div className="requester-section">
                <h4 className="requester-section-header">PERSONAL INFO</h4>
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
                </div>

                <div className="requester-section">
                  <h4 className="requester-section-header">ACCOUNT</h4>
                  <div className="requester-form-grid">
                    <div className="form-input">
                      <label>Username</label>
                      <input
                        value={form.username}
                        onChange={(e) =>
                          setForm({ ...form, username: e.target.value })
                        }
                      />
                    </div>
                    {/* PASSWORD */}
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
                          setForm({
                            ...form,
                            confirmPassword: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="requester-modal-footer">
              <button
                className="cancel-btn"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>

              <button className="confirm-btn" onClick={handleRegister}>
                Create Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
