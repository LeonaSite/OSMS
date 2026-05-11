import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { AiFillProduct } from "react-icons/ai";
import { IoIosMail } from "react-icons/io";
import { HiMiniUserCircle } from "react-icons/hi2";
import "./RequesterNavigation.css";

const API = import.meta.env.VITE_API_URL;
import NmisLogo from "../../assets/nmis_logo.png";

export default function RequesterNavigation() {
  const navigate = useNavigate();
  const userRef = useRef(null);
  const [user, setUser] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get(`${API}/api/requester/login/dashboard`, {
          withCredentials: true,
        });
        setUser(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchUser();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userRef.current && !userRef.current.contains(event.target)) {
        setShowTooltip(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);

      await axios.post(
        `${API}/api/requester/login/logout`,
        {},
        { withCredentials: true },
      );

      // 🔥 force full reload
      setTimeout(() => {
        window.location.href = "/requester/login";
      }, 500);
    } catch (err) {
      console.error("Logout error:", err);
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="requester-layout">
      <nav className="top-nav">
        <div className="nav-left">
          <img src={NmisLogo} alt="NMIS Logo" className="req-nav-logo" />
          <h2>OSMS NMIS</h2>
        </div>

        <div className="nav-right">
          <div className="nav-links">
            <NavLink
              to="/requester/dashboard"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <AiFillProduct className="top-nav-icon" />
              Dashboard
            </NavLink>

            <NavLink
              to="/requester/requests"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <IoIosMail className="top-nav-icon" />
              My Requests
            </NavLink>
          </div>
          <div
            className="user-section"
            ref={userRef}
            onClick={() => setShowTooltip(!showTooltip)}
            title="Show Profile and Signout"
          >
            <HiMiniUserCircle className="user-icon" />
            {user && (
              <div className="nav-user-warpper">
                <p className="nav-username">
                  {user.firstname} {user.lastname}
                </p>
                <p className="nav-division">{user.division}</p>
              </div>
            )}

            {showTooltip && user && (
              <div className="user-tooltip">
                <p>
                  <strong>Name:</strong> {user.firstname} {user.lastname}
                </p>
                <p>
                  <strong>Username:</strong> {user.username}
                </p>
                <p>
                  <strong>Division:</strong> {user.division}
                </p>

                <button onClick={handleLogout} disabled={isLoggingOut}>
                  {isLoggingOut ? "Signing out..." : "Sign out"}
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="page-content">
        <Outlet />
      </div>
    </div>
  );
}
