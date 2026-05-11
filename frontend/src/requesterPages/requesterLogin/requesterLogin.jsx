import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import "./requesterLogin.css";
import nmis_logo from "../../assets/nmis_logo.png";

const API = import.meta.env.VITE_API_URL;

export default function RequesterLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const [cooldown, setCooldown] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    //  prevent spam
    if (cooldown > 0 || isSubmitting) return;

    setError("");
    setIsSubmitting(true);
    setCooldown(5); // start 5s cooldown

    try {
      const response = await axios.post(
        `${API}/api/requester/login`,
        { username, password },
        { withCredentials: true },
      );

      console.log("Requester login response:", response.data);

      await axios.get(`${API}/api/requester/login/dashboard`, {
        withCredentials: true,
      });

      navigate("/requester/dashboard");
    } catch (err) {
      console.error("Requester login error:", err);

      if (err.response && err.response.data) {
        setError(err.response.data.message);
      } else {
        setError("Server error. Please try again later.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <img src={nmis_logo} alt="Logo" className="login-logo" />
        <h2>OSMS REQUESTER LOG IN</h2>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Username</label>
            <input
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <div className="password-label">
              <label>Password:</label>
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
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="error-message">{error}</p>}

          <button
            type="submit"
            className="login-btn"
            disabled={cooldown > 0 || isSubmitting}
          >
            {isSubmitting
              ? "Logging in..."
              : cooldown > 0
                ? `Login (${cooldown}s)`
                : "LOGIN"}
          </button>
        </form>
      </div>
    </div>
  );
}
