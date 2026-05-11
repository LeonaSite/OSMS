// AdminGuide.jsx
import { useState } from "react";
import "./AdminGuide.css";

import { IoClose } from "react-icons/io5";
import { PiSquaresFour } from "react-icons/pi";
import { BiBarChartSquare, BiSolidPyramid, BiCabinet } from "react-icons/bi";
import { PiMoney, PiUsersFourLight } from "react-icons/pi";
import { LuMails } from "react-icons/lu";
import { TbRulerMeasure2 } from "react-icons/tb";
import { RiBuilding2Line } from "react-icons/ri";
import { GrUserAdmin } from "react-icons/gr";
import { IoFootstepsOutline, IoReceiptOutline } from "react-icons/io5";

const tabs = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: <PiSquaresFour />,
    content: {
      title: "Dashboard Overview",
      description:
        "The Dashboard provides a quick overview of system activity, stock movement, requests, and inventory insights.",
      features: [
        "Track recent transactions (Pending Request)",
        "Top 5 of most requested items",
        "View graphs of Arrived and Released items(Accepted Request)",
        "Monitor stock availability",
      ],
    },
  },

  {
    key: "reports",
    label: "Reports",
    icon: <BiBarChartSquare />,
    content: {
      title: "Reports Module",
      description:
        "Generate and analyze reports for inventory, requests, and stock movement.",
      features: [
        "Generate monthly reports",
        "Filter by date range",
        "Export reports",
        "Analyze Requests and Arrival records",
        "Downloadable as Excel",
      ],
    },
  },

  {
    key: "top-items",
    label: "Top Items",
    icon: <BiSolidPyramid />,
    content: {
      title: "Top Items",
      description:
        "Displays the most requested and most issued inventory items.",
      features: [
        "Monitor frequently requested items",
        "Track high-demand stocks",
        "View usage analytics",
        "Downloadable as Excel",
      ],
    },
  },

  {
    key: "budget",
    label: "Budget Ceiling",
    icon: <PiMoney />,
    content: {
      title: "Budget Ceiling",
      description:
        "Manage annual departmental funding and allocations to define and maintain ideal expenditure thresholds.",
      features: [
        "Set ideal annual budget for year",
        "Track remaining budget",
        "Monitor department allocation",
      ],
    },
  },

  {
    key: "stock-control",
    label: "Stock Control",
    icon: <BiCabinet />,
    content: {
      title: "Stock Control",
      description: "Manage all inventory items, stock levels, and categories.",
      features: [
        "Add and edit stocks",
        "Monitor stock quantity",
        "Manage item categories",
        "Restock single Item",
        "Track who request the item",
        "Track inventory status",
      ],
    },
  },

  {
    key: "stock-invoices",
    label: "Stock Invoices",
    icon: <IoReceiptOutline />,
    content: {
      title: "Stock Invoices",
      description:
        "Manage incoming invoices and stock deliveries from suppliers. Best for Batch Restock",
      features: [
        "Create invoice records",
        "Add delivered items",
        "Batch Restock",
        "Track invoice history",
      ],
    },
  },

  {
    key: "requests",
    label: "Requests",
    icon: <LuMails />,
    content: {
      title: "Request Management",
      description:
        "Review and process supply requisition requests from departments.",
      features: [
        "Approve requests",
        "Reject requests",
        "Track request status",
        "Remarked stocks",
        "Print Requisition Slip",
      ],
    },
  },

  {
    key: "unit-manager",
    label: "Unit Manager",
    icon: <TbRulerMeasure2 />,
    content: {
      title: "Unit Manager",
      description: "Manage measurement units used by inventory items.",
      features: ["Add units", "Edit units", "Standardize measurements"],
    },
  },

  {
    key: "divisions",
    label: "Divisions",
    icon: <RiBuilding2Line />,
    content: {
      title: "Divisions",
      description: "Manage departments/divisions within the organization.",
      features: [
        "Add divisions",
        "Track what division has most request",
        "Manage department data",
        "Downloadable as Excel",
      ],
    },
  },

  {
    key: "requesters",
    label: "Requester Accounts",
    icon: <PiUsersFourLight />,
    content: {
      title: "Requester Accounts",
      description: "Manage requester user accounts and permissions.",
      features: [
        "Create requester accounts",
        "Edit accounts",
        "Reset passwords",
      ],
    },
  },

  {
    key: "admins",
    label: "Admin Accounts",
    icon: <GrUserAdmin />,
    content: {
      title: "Admin Accounts",
      description: "Manage administrator accounts and access control.",
      features: ["Create admin users", "Edit admin accounts"],
    },
  },

  {
    key: "audit",
    label: "Audit Logs",
    icon: <IoFootstepsOutline />,
    content: {
      title: "Audit Logs",
      description: "Track all important system activities and user operations.",
      features: [
        "View activity history",
        "Monitor account actions",
        "Track system changes",
      ],
    },
  },
];

export default function AdminGuide({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("dashboard");

  const activeContent = tabs.find((tab) => tab.key === activeTab);

  if (!isOpen) return null;

  return (
    <div className="admin-guide-overlay">
      <div className="admin-guide-modal">
        {/* HEADER */}
        <div className="admin-guide-header">
          <div>
            <h2>User Guide</h2>
            <p>NMIS OSMS Administrator Manual</p>
          </div>

          <button className="admin-guide-close" onClick={onClose}>
            <IoClose />
          </button>
        </div>

        {/* BODY */}
        <div className="admin-guide-body">
          {/* SIDEBAR */}
          <div className="admin-guide-sidebar">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`guide-tab ${activeTab === tab.key ? "active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span className="guide-tab-icon">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* CONTENT */}
          <div className="admin-guide-content">
            <h1>{activeContent.content.title}</h1>

            <p className="guide-description">
              {activeContent.content.description}
            </p>

            <div className="guide-section">
              <h3>Main Features</h3>

              <ul>
                {activeContent.content.features.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </div>

            <div className="guide-note">
              <strong>Note:</strong> This section serves as a system guide for
              administrators.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
