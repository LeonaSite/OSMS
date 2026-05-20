import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import "./Navigation.css";
import AdminGuide from "../AdminGuide/AdminGuide";

import { PiSquaresFour } from "react-icons/pi";
import { IoBarChartSharp } from "react-icons/io5";
import { BiBarChartSquare, BiSolidPyramid, BiCabinet } from "react-icons/bi";
import { TbRulerMeasure2 } from "react-icons/tb";
import { LuMails } from "react-icons/lu";
import { PiUsersFourLight } from "react-icons/pi";
import { GrUserAdmin } from "react-icons/gr";
import { RiBuilding2Line } from "react-icons/ri";
import { IoFootstepsOutline } from "react-icons/io5";
import { IoReceiptOutline } from "react-icons/io5";
import { HiMiniUserCircle } from "react-icons/hi2";
import { PiMoney } from "react-icons/pi";
import { MdOutlineArrowForwardIos } from "react-icons/md";
import { GrCircleQuestion } from "react-icons/gr";
import { MdExitToApp } from "react-icons/md";

import NmisLogo from "../../assets/nmis_logo.png";
const API = import.meta.env.VITE_API_URL;

export default function Navigation() {
  const navigate = useNavigate();
  const [adminName, setAdminName] = useState("");
  const [username, setUsername] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const userRef = useRef(null);

  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const name = localStorage.getItem("adminName");
    if (name) setAdminName(name);

    const fetchUser = async () => {
      try {
        const res = await axios.get(`${API}/api/login/dashboard`, {
          withCredentials: true,
        });
        setUsername(res.data.username);
      } catch (err) {
        console.error(err);
      }
    };

    fetchUser();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userRef.current && !userRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);

      await axios.post(
        `${API}/api/login/logout`,
        {},
        { withCredentials: true },
      );

      localStorage.removeItem("adminName");

      setTimeout(() => {
        navigate("/admin/login", { replace: true });
      }, 500);
    } catch (error) {
      console.error("Logout failed:", error);
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="layout">
      <div className="sidebar">
        <div className="nav-logo-container">
          <img src={NmisLogo} alt="NMIS Logo" className="sidebar-logo" />
          <h2 className="logo">NMIS OSMS ADMIN</h2>
        </div>

        <nav>
          <br />
          <p className="nav-divider-title">Insights</p>

          <NavLink to="/admin/dashboard" className="nav-item">
            <PiSquaresFour className="nav-icons" /> Dashboard
          </NavLink>

          <NavLink to="/admin/reports" className="nav-item">
            <BiBarChartSquare className="nav-icons" /> Reports
          </NavLink>

          <NavLink to="/admin/top-products" className="nav-item">
            <BiSolidPyramid className="nav-icons" /> Top Items
          </NavLink>

          <div className="nav-divider" />
          <p className="nav-divider-title">Operations</p>
          {/* CREDITS DISABLE 
          <NavLink to="/admin/annual-budget" className="nav-item">
            <PiMoney className="nav-icons" /> Budget Ceiling
          </NavLink>
          */}
          <NavLink to="/admin/stock-control" className="nav-item" title="Add, ">
            <BiCabinet className="nav-icons" /> Stock Control
          </NavLink>

          <NavLink to="/admin/invoice-management" className="nav-item">
            <IoReceiptOutline className="nav-icons" /> Stock Invoices
          </NavLink>

          <NavLink to="/admin/requisition-control" className="nav-item">
            <LuMails className="nav-icons" /> Requests
          </NavLink>

          <NavLink to="/admin/unit-manager" className="nav-item">
            <TbRulerMeasure2 className="nav-icons" /> Unit Manager
          </NavLink>

          <div className="nav-divider" />
          <p className="nav-divider-title">Accounts</p>

          <NavLink to="/admin/departments" className="nav-item">
            <RiBuilding2Line className="nav-icons" /> Divisions
          </NavLink>

          <NavLink to="/admin/requester-accounts" className="nav-item">
            <PiUsersFourLight className="nav-icons" /> Requester Accounts
          </NavLink>

          <NavLink to="/admin/admin-accounts" className="nav-item">
            <GrUserAdmin className="nav-icons" /> Admin Accounts
          </NavLink>

          <NavLink to="/admin/audit-logs" className="nav-item">
            <IoFootstepsOutline className="nav-icons" /> Audit Logs
          </NavLink>
        </nav>

        <div className="admin-info" ref={userRef}>
          <div
            className="admin-name-wrapper"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <HiMiniUserCircle className="admin-icon" />
            <div className="admin-name-arrow">
              <p className="admin-name">{username}</p>
              <MdOutlineArrowForwardIos />
            </div>
          </div>
          {showDropdown && (
            <div
              className="admin-dropdown"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="nav-profile">
                <p className="nav-admin-username">{username}</p>
                <p>{adminName}</p>
              </div>
              <button className="admin-btn" onClick={() => setShowGuide(true)}>
                <GrCircleQuestion className="admin-icon-btn" /> User Guide
              </button>

              <button
                className="admin-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLogout();
                }}
                disabled={isLoggingOut}
              >
                <MdExitToApp className="admin-icon-btn" />
                {isLoggingOut ? "Signing out..." : "Sign Out"}
              </button>
            </div>
          )}
        </div>
      </div>

      <AdminGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />

      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
}
