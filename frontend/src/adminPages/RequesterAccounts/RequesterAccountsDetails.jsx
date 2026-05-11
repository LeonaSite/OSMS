import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { formatDateTime } from "../../Utilities/FormatDateTime";
import "./RequesterAccountsDetails.css";
import BeatLoader from "react-spinners/BeatLoader";
import { FaUserAlt } from "react-icons/fa";
import { LuPencilLine } from "react-icons/lu";
import RequesterItemsTable from "./RequesterItemsTable";
import Swal from "sweetalert2";
import { TbCancel } from "react-icons/tb";
import { GrSave } from "react-icons/gr";
import { TbLockPassword } from "react-icons/tb";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";

const API = import.meta.env.VITE_API_URL;

export default function RequesterAccountsDetails() {
  const { username } = useParams();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);

  const [isEdit, setIsEdit] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [showPassModal, setShowPassModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [form, setForm] = useState({
    username: "",
    firstName: "",
    lastName: "",
    departmentID: "",
  });

  useEffect(() => {
    fetchDetails();
  }, [username]);

  const fetchDetails = async () => {
    try {
      const resPromise = axios.get(`${API}/api/requesterAccounts/${username}`);

      // ⏳ 2-second delay
      const delay = new Promise((resolve) => setTimeout(resolve, 500));

      const [res] = await Promise.all([resPromise, delay]);

      setEmployee(res.data.employee);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    const res = await axios.get(`${API}/api/requesterAccounts/departments`);
    setDepartments(res.data);
  };

  useEffect(() => {
    if (employee) {
      setForm({
        username: employee.username,
        firstName: employee.firstname,
        lastName: employee.lastname,
        departmentID:
          departments.find((d) => d.DepartmentName === employee.department)
            ?.DepartmentID || "",
      });
    }
  }, [employee, departments]);

  const handleSave = async () => {
    // 🔐 VALIDATION
    if (
      !form.username.trim() ||
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !form.departmentID
    ) {
      return Swal.fire("Incomplete", "Please fill all fields.", "warning");
    }

    // ✅ CONFIRM
    const confirm = await Swal.fire({
      title: "Save changes?",
      text: "This will update the account details.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, save",
    });

    if (!confirm.isConfirmed) return;

    try {
      await axios.put(`${API}/api/requesterAccounts/${username}`, {
        newUsername: form.username,
        firstName: form.firstName,
        lastName: form.lastName,
        departmentID: form.departmentID,
      });

      await Swal.fire({
        title: "Success",
        text: "Account updated successfully!",
        icon: "success",
      });

      setIsEdit(false);

      // ✅ redirect to new username in URL
      navigate(`/admin/requester-accounts/${form.username}?year=2026`, {
        replace: true,
      });

      fetchDetails();
    } catch (err) {
      console.error(err);

      Swal.fire(
        "Error",
        err?.response?.data?.message || "Failed to update account",
        "error",
      );
    }
  };

  const handleCancel = async () => {
    const confirm = await Swal.fire({
      title: "Cancel changes?",
      text: "All unsaved changes will be lost.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, cancel",
      cancelButtonText: "No",
    });

    if (!confirm.isConfirmed) return;

    // 🔄 reset form back to original
    setForm({
      username: employee.username,
      firstName: employee.firstname,
      lastName: employee.lastname,
      departmentID:
        departments.find((d) => d.DepartmentName === employee.department)
          ?.DepartmentID || "",
    });

    setIsEdit(false);
  };
  if (!employee)
    return (
      <div className="spinner-container">
        <BeatLoader size={15} color="#1e3a8a" />
      </div>
    );

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      return Swal.fire("Incomplete", "Fill all fields", "warning");
    }

    if (newPassword !== confirmPassword) {
      return Swal.fire("Mismatch", "Passwords do not match", "error");
    }

    const confirm = await Swal.fire({
      title: "Change password?",
      text: "This will update the user's password.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, change",
    });

    if (!confirm.isConfirmed) return;

    try {
      await axios.put(`${API}/api/requesterAccounts/${username}/password`, {
        password: newPassword,
      });

      Swal.fire("Success", "Password updated successfully!", "success");

      setShowPassModal(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      Swal.fire(
        "Error",
        err?.response?.data?.message || "Failed to update password",
        "error",
      );
    }
  };

  return (
    <div className="req-acc-container">
      <button onClick={() => navigate(-1)} className="back-btn">
        {"< BACK"}
      </button>

      <div className="stock-title-row">
        <h2 className="req-acc-header">Requester Accounts &gt; Details</h2>
        {!isEdit ? (
          <div className="edit-actions">
            <button
              className="change-pass-btn"
              onClick={() => setShowPassModal(true)}
            >
              <TbLockPassword className="change-pass-icon" />
              Change Password
            </button>
            <button className="edit-btn" onClick={() => setIsEdit(true)}>
              <LuPencilLine className="edit-icon" />
              Edit
            </button>
          </div>
        ) : (
          <div className="edit-actions">
            <button className="edit-cancel-btn" onClick={handleCancel}>
              <TbCancel className="edit-cancel-icon" />
              Cancel
            </button>

            <button className="edit-save-btn" onClick={handleSave}>
              <GrSave className="edit-save-icon" />
              Save
            </button>
          </div>
        )}
      </div>

      {/* HEADER */}
      <div className="req-details-header-card">
        <div className="header-left">
          <div className="requester-icon-box">
            <FaUserAlt className="stock-icon" />
          </div>
          <div>
            <p className="label">Username</p>
            {isEdit ? (
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            ) : (
              <h3>{employee.username}</h3>
            )}
          </div>
        </div>

        <div>
          <p className="label">Department</p>
          {isEdit ? (
            <select
              value={form.departmentID}
              onChange={(e) =>
                setForm({ ...form, departmentID: e.target.value })
              }
            >
              <option value="">Select Department</option>
              {departments.map((d) => (
                <option key={d.DepartmentID} value={d.DepartmentID}>
                  {d.DepartmentName}
                </option>
              ))}
            </select>
          ) : (
            <h3>{employee.department}</h3>
          )}
        </div>
      </div>

      {/* PERSONAL INFO */}
      <div className="req-details-body-card">
        <h2 className="req-details-body-header">Personal Info</h2>

        <div className="req-grid">
          <div>
            <p className="label">First Name</p>
            {isEdit ? (
              <input
                value={form.firstName}
                onChange={(e) =>
                  setForm({ ...form, firstName: e.target.value })
                }
              />
            ) : (
              <p>{employee.firstname}</p>
            )}
          </div>

          <div>
            <p className="label">Last Name</p>
            {isEdit ? (
              <input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            ) : (
              <p>{employee.lastname}</p>
            )}
          </div>

          <div>
            <p className="label">Created</p>
            <p>{formatDateTime(employee.createdAt)}</p>
          </div>

          <div>
            <p className="label">Modified</p>
            <p>
              {employee.modifiedAt
                ? formatDateTime(employee.modifiedAt)
                : "---"}
            </p>
          </div>
        </div>
      </div>

      {/* ✅ SEPARATE COMPONENT */}
      <div className="req-acc-table-container">
        <RequesterItemsTable username={username} />
      </div>

      {showPassModal && (
        <div className="modal-overlay">
          <div className="req-pass-modal-box">
            <div className="req-pass-modal-header">Change Password</div>

            <div className="req-pass-modal-body">
              <form autoComplete="off">
                <div className="req-pass-section">
                  <div className="req-pass-form-grid">
                    {/* NEW PASSWORD */}
                    <div className="form-input">
                      <div className="password-label">
                        <label>New Password</label>
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
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>

                    {/* CONFIRM PASSWORD */}
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
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </form>
            </div>

            <div className="requester-modal-footer">
              <button
                className="cancel-btn"
                onClick={() => setShowPassModal(false)}
              >
                Cancel
              </button>

              <button className="confirm-btn" onClick={handleChangePassword}>
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
