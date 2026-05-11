import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { formatDateTime } from "../../Utilities/FormatDateTime";
import BeatLoader from "react-spinners/BeatLoader";
import { FaUserAlt } from "react-icons/fa";
import { LuPencilLine } from "react-icons/lu";
import Swal from "sweetalert2";
import { TbCancel } from "react-icons/tb";
import { GrSave } from "react-icons/gr";
import { TbLockPassword } from "react-icons/tb";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";

const API = import.meta.env.VITE_API_URL;

export default function AdminAccountDetails() {
  const { username } = useParams();
  const navigate = useNavigate();

  const [admin, setAdmin] = useState(null);
  const [isEdit, setIsEdit] = useState(false);

  const [form, setForm] = useState({
    username: "",
    firstName: "",
    lastName: "",
  });

  // PASSWORD MODAL
  const [showPassModal, setShowPassModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    fetchDetails();
  }, [username]);

  const fetchDetails = async () => {
    try {
      const res = await axios.get(`${API}/api/adminAccounts/${username}`);
      setAdmin(res.data.admin);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (admin) {
      setForm({
        username: admin.username,
        firstName: admin.firstname,
        lastName: admin.lastname,
      });
    }
  }, [admin]);

  /* ================= SAVE ================= */
  const handleSave = async () => {
    if (!form.username || !form.firstName || !form.lastName) {
      return Swal.fire("Incomplete", "Fill all fields", "warning");
    }

    const confirm = await Swal.fire({
      title: "Save changes?",
      icon: "question",
      showCancelButton: true,
    });

    if (!confirm.isConfirmed) return;

    try {
      await axios.put(`${API}/api/adminAccounts/${username}`, {
        newUsername: form.username,
        firstName: form.firstName,
        lastName: form.lastName,
      });

      Swal.fire("Success", "Updated!", "success");

      setIsEdit(false);

      // ✅ IMPORTANT FIX HERE
      if (form.username !== username) {
        // change URL and reload data
        navigate(`/admin/admin-accounts/${form.username}`, { replace: true });
      } else {
        // just refresh data if username didn't change
        fetchDetails();
      }
    } catch (err) {
      Swal.fire("Error", "Update failed", "error");
    }
  };

  const handleCancel = () => {
    setForm({
      username: admin.username,
      firstName: admin.firstname,
      lastName: admin.lastname,
    });
    setIsEdit(false);
  };

  /* ================= PASSWORD ================= */
  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      return Swal.fire("Incomplete", "Fill all fields", "warning");
    }

    if (newPassword !== confirmPassword) {
      return Swal.fire("Mismatch", "Passwords do not match", "error");
    }

    const confirm = await Swal.fire({
      title: "Change password?",
      icon: "question",
      showCancelButton: true,
    });

    if (!confirm.isConfirmed) return;

    try {
      await axios.put(`${API}/api/adminAccounts/${username}/password`, {
        password: newPassword,
      });

      Swal.fire("Success", "Password updated!", "success");

      setShowPassModal(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      Swal.fire("Error", "Failed", "error");
    }
  };

  if (!admin)
    return (
      <div className="spinner-container">
        <BeatLoader />
      </div>
    );

  return (
    <div className="req-acc-container">
      <button onClick={() => navigate(-1)} className="back-btn">
        {"< BACK"}
      </button>

      <div className="stock-title-row">
        <h2 className="req-acc-header">Admin Accounts &gt; Details</h2>

        {!isEdit ? (
          <div className="edit-actions">
            <button
              className="change-pass-btn"
              onClick={() => setShowPassModal(true)}
            >
              <TbLockPassword className="change-pass-icon" /> Change Password
            </button>

            <button className="edit-btn" onClick={() => setIsEdit(true)}>
              <LuPencilLine className="edit-icon" /> Edit
            </button>
          </div>
        ) : (
          <div className="edit-actions">
            <button className="edit-cancel-btn" onClick={handleCancel}>
              <TbCancel /> Cancel
            </button>

            <button className="edit-save-btn" onClick={handleSave}>
              <GrSave /> Save
            </button>
          </div>
        )}
      </div>

      {/* HEADER */}
      <div className="req-details-header-card">
        <div className="header-left">
          <div className="requester-icon-box">
            <FaUserAlt />
          </div>

          <div>
            <p className="label">Username</p>
            {isEdit ? (
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            ) : (
              <h3>{admin.username}</h3>
            )}
          </div>
        </div>
      </div>

      {/* PERSONAL */}
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
              <p>{admin.firstname}</p>
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
              <p>{admin.lastname}</p>
            )}
          </div>

          <div>
            <p className="label">Created</p>
            <p>{formatDateTime(admin.createdAt)}</p>
          </div>

          <div>
            <p className="label">Modified</p>
            <p>{admin.modifiedAt ? formatDateTime(admin.modifiedAt) : "---"}</p>
          </div>
        </div>
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
