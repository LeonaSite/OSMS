import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import "./AnnualBudget.css";
import { FaSort, FaSortUp, FaSortDown, FaSearch } from "react-icons/fa";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import AnnualBudgetModal from "./AnnualBudgetModal";

export default function AnnualBudget() {
  const API = import.meta.env.VITE_API_URL;

  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear);
  const [budget, setBudget] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [allBudgets, setAllBudgets] = useState([]);

  //  FETCH DATA
  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/api/annual-budget?year=${year}`);

      setBudget(res.data.budget); // allow null

      // normalize null values from LEFT JOIN
      const normalized = res.data.departments.map((d) => ({
        ...d,
        AllocatedAmount: d.AllocatedAmount || 0,
        RemainingCredit: d.RemainingCredit || 0,
      }));

      setDepartments(normalized);
    } catch (err) {
      console.error(err);

      // fallback so UI doesn't break
      setBudget({ Amount: 0 });
      setDepartments([]);
    }
  };
  useEffect(() => {
    fetchData();
  }, [year]);

  //  SEARCH
  const filteredDepartments = useMemo(() => {
    return departments.filter((d) =>
      d.DepartmentName?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [departments, searchTerm]);

  //  SORT
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

  const sortedDepartments = useMemo(() => {
    const data = [...filteredDepartments];

    if (sortConfig.key) {
      data.sort((a, b) => {
        let aVal = a[sortConfig.key] ?? 0;
        let bVal = b[sortConfig.key] ?? 0;

        if (typeof aVal === "string") {
          return sortConfig.direction === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      });
    }

    return data;
  }, [filteredDepartments, sortConfig]);

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return <FaSort />;
    if (sortConfig.direction === "asc") return <FaSortUp />;
    if (sortConfig.direction === "desc") return <FaSortDown />;
    return <FaSort />;
  };

  //  TOTAL REMAINING
  const totalRemaining = departments.reduce((sum, d) => {
    const value = Number(d.RemainingCredit);
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

  const fetchBudgets = async () => {
    const res = await axios.get(`${API}/api/annual-budget/all`);
    setAllBudgets(res.data);
  };

  useEffect(() => {
    fetchBudgets();
  }, []);

  const openCreate = () => {
    setModalMode("create");
    setSelectedBudget(null);
    setModalOpen(true);
  };

  const openEdit = () => {
    setModalMode("edit");
    setSelectedBudget({
      FiscalYear: year,
      Amount: budget?.Amount,
      RemainingCredit: totalRemaining,
    });
    setModalOpen(true);
  };

  const hasBudget = !!budget && !!budget.Amount;

  return (
    <div className="annual-budget">
      {/* HEADER */}
      <div className="budget-header">
        {/*  YEAR PICKER */}
        <div className="budget-year-filter">
          <span>Year:</span>
          <DatePicker
            selected={new Date(year, 0)}
            onChange={(date) => setYear(date.getFullYear())}
            showYearPicker
            dateFormat="yyyy"
            className="year-picker"
          />
        </div>
        <h1>Annual Budget {year}</h1>

        <div className="budget-amount">
          <span>PHP</span>
          <h2>
            {budget?.Amount
              ? Number(budget.Amount).toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : "Unallocated"}
          </h2>
        </div>

        <div className="remaining">
          Remaining: Php{" "}
          {Number(totalRemaining).toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>

        {!hasBudget ? (
          <button onClick={openCreate} className="edit-budget-btn">
            Set Annual Budget
          </button>
        ) : (
          <button onClick={openEdit} className="edit-budget-btn">
            Edit Budget
          </button>
        )}
      </div>

      {/* TOOLBAR */}
      <div className="budget-toolbar">
        <div className="search-wrapper">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search Division..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="department-search"
          />
        </div>
      </div>

      {/*  REAL TABLE */}
      <div className="budget-table-container">
        <table className="budget-table">
          <thead>
            <tr>
              <th>#</th>

              <th
                className="sortable"
                onClick={() => handleSort("DepartmentName")}
              >
                Division {renderSortIcon("DepartmentName")}
              </th>

              <th
                className="sortable"
                onClick={() => handleSort("AllocatedAmount")}
              >
                Allocated Amount {renderSortIcon("AllocatedAmount")}
              </th>

              <th
                className="sortable"
                onClick={() => handleSort("RemainingCredit")}
              >
                Remaining Credit {renderSortIcon("RemainingCredit")}
              </th>
            </tr>
          </thead>

          <tbody>
            {sortedDepartments.map((d, i) => (
              <tr key={d.DepartmentID}>
                <td>{i + 1}</td>
                <td>{d.DepartmentName}</td>
                <td>
                  Php{" "}
                  {Number(d.AllocatedAmount).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td>
                  Php{" "}
                  {Number(d.RemainingCredit).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnnualBudgetModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        mode={modalMode}
        API={API}
        selectedBudget={selectedBudget}
        existingYears={allBudgets.map((b) => b.FiscalYear)}
        refreshData={fetchData}
        selectedYear={year}
      />
    </div>
  );
}
