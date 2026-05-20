import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { AiFillProduct } from "react-icons/ai";
import { IoIosMail, IoMdClose } from "react-icons/io";
import { HiMiniUserCircle } from "react-icons/hi2";
import { GiHamburgerMenu } from "react-icons/gi";
import "./RequesterNavigation.css";

const API = import.meta.env.VITE_API_URL;
import NmisLogo from "../../assets/nmis_logo.png";

export default function RequesterNavigation() {
  const navigate = useNavigate();
  const userRef = useRef(null);
  const menuRef = useRef(null); // Ref to catch clicks outside mobile menu
  const [user, setUser] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  // Closes dropdowns if clicking anywhere outside of them
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userRef.current && !userRef.current.contains(event.target)) {
        setShowTooltip(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
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

        {/* Hamburger trigger for mobile displays */}
        <button
          className="hamburger-btn"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle navigation"
        >
          {isMenuOpen ? <IoMdClose /> : <GiHamburgerMenu />}
        </button>

        <div className={`nav-right ${isMenuOpen ? "open" : ""}`} ref={menuRef}>
          <div className="nav-links">
            <NavLink
              to="/requester/dashboard"
              className={({ isActive }) => (isActive ? "active" : "")}
              onClick={() => setIsMenuOpen(false)}
            >
              <AiFillProduct className="top-nav-icon" />
              Dashboard
            </NavLink>

            <NavLink
              to="/requester/requests"
              className={({ isActive }) => (isActive ? "active" : "")}
              onClick={() => setIsMenuOpen(false)}
            >
              <IoIosMail className="top-nav-icon" />
              My Requests
            </NavLink>
          </div>

          <div
            className="user-section"
            ref={userRef}
            onClick={(e) => {
              e.stopPropagation(); // Avoid triggering outside click checks
              setShowTooltip(!showTooltip);
            }}
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
              <div
                className="user-tooltip"
                onClick={(e) => e.stopPropagation()}
              >
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
