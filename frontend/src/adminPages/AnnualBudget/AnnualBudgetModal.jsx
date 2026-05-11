import { useEffect, useState, useMemo } from "react";
import Swal from "sweetalert2";
import axios from "axios";
import "./AnnualBudgetModal.css";
import DatePicker from "react-datepicker";

export default function AnnualBudgetModal({
  isOpen,
  onClose,
  mode,
  API,
  selectedBudget,
  existingYears = [],
  refreshData,
  selectedYear,
}) {
  const [year, setYear] = useState("");
  const [amount, setAmount] = useState("");
  const [departments, setDepartments] = useState([]);
  const [allocations, setAllocations] = useState({});

  const to2 = (num) => Number(parseFloat(num || 0).toFixed(2));

  const getUsedCredit = (dept) => {
    return to2(
      Number(dept.AllocatedAmount || 0) - Number(dept.RemainingCredit || 0),
    );
  };

  useEffect(() => {
    const fetchData = async () => {
      if (mode === "edit" && selectedBudget) {
        const res = await axios.get(
          `${API}/api/annual-budget?year=${selectedBudget.FiscalYear}`,
        );

        const deptList = res.data.departments;

        setDepartments(deptList);

        const initial = {};
        deptList.forEach((d) => {
          initial[d.DepartmentID] = to2(d.AllocatedAmount || 0);
        });

        setAllocations(initial);
      } else {
        const res = await axios.get(`${API}/api/annual-budget/departments`);

        const deptList = res.data;

        setDepartments(deptList);

        const initial = {};
        deptList.forEach((d) => {
          initial[d.DepartmentID] = 0;
        });

        setAllocations(initial);
      }
    };

    if (isOpen) fetchData();
  }, [isOpen, mode, selectedBudget]);

  useEffect(() => {
    if (mode === "edit" && selectedBudget) {
      setYear(selectedBudget.FiscalYear);
      setAmount(selectedBudget.Amount);
    } else {
      setYear(selectedYear);
      setAmount("");
    }
  }, [mode, selectedBudget, selectedYear]);

  const totalAllocated = useMemo(() => {
    return to2(
      Object.values(allocations).reduce((a, b) => a + Number(b || 0), 0),
    );
  }, [allocations]);

  const remaining = to2(Number(amount || 0) - totalAllocated);

  const format = (val) =>
    to2(val).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  if (!isOpen) return null;

  const handleChange = (dept, value) => {
    let val = parseFloat(value);
    if (isNaN(val)) val = 0;

    const used = getUsedCredit(dept);

    if (mode === "edit" && val < used) {
      val = used;
    }

    setAllocations((prev) => ({
      ...prev,
      [dept.DepartmentID]: to2(val),
    }));
  };

  const autoDistribute = () => {
    if (!amount || amount <= 0) {
      return Swal.fire("Enter amount first", "", "warning");
    }

    const total = to2(amount);

    // total weights
    const totalWeight = departments.reduce((sum, d) => {
      return sum + (1 + Number(d.DistributionPercentage || 0) / 100);
    }, 0);

    let runningTotal = 0;
    const newAlloc = {};

    departments.forEach((d, index) => {
      const weight = 1 + Number(d.DistributionPercentage || 0) / 100;

      let value;

      // last row gets remainder fix
      if (index === departments.length - 1) {
        value = to2(total - runningTotal);
      } else {
        value = to2((total * weight) / totalWeight);
        runningTotal += value;
      }

      if (mode === "edit") {
        const used = getUsedCredit(d);

        if (value < used) {
          value = used;
        }
      }

      newAlloc[d.DepartmentID] = to2(value);
    });

    setAllocations(newAlloc);
  };

  const handleSave = async () => {
    const numericAmount = to2(amount);

    if (!numericAmount || numericAmount <= 0) {
      return Swal.fire("Invalid", "Amount must be > 0", "warning");
    }

    if (remaining !== 0) {
      return Swal.fire(
        "Invalid Allocation",
        `You still have remaining Php ${format(remaining)}`,
        "error",
      );
    }

    if (mode === "create" && existingYears.includes(Number(year))) {
      return Swal.fire("Duplicate Year", "Already exists", "error");
    }

    try {
      if (mode === "edit") {
        await axios.put(`${API}/api/annual-budget/${year}`, {
          amount: numericAmount,
          allocations,
          departments,
        });
      } else {
        await axios.post(`${API}/api/annual-budget`, {
          year,
          amount: numericAmount,
          allocations,
          departments,
        });
      }

      Swal.fire("Success", "Budget saved", "success");

      refreshData();
      onClose();
    } catch (err) {
      console.error(err);
      Swal.fire(
        "Error",
        err.response?.data?.error || "Something went wrong",
        "error",
      );
    }
  };

  return (
    <div className="modal-overlay">
      <div className="budget-modal">
        <div className="budget-modal-header">
          {mode === "edit"
            ? `Edit Annual Budget for ${year}`
            : `Set Annual Budget for ${year}`}
        </div>

        <div className="budget-modal-body">
          <div className="budget-input-group">
            <h1>Total Budget</h1>
            <div className="budget-input-row">
              <p>Php. </p>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(to2(e.target.value))}
              />
            </div>
          </div>

          <div className="budget-distribute-section">
            <div className="remaining-box">
              Remaining: <strong>Php {format(remaining)}</strong>
            </div>

            <button className="auto-dis-btn" onClick={autoDistribute}>
              Auto Distribute
            </button>
          </div>

          <div className="dept-table-wrapper">
            <table className="dept-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Division</th>
                  <th>Distribution %</th>
                  {mode === "edit" && <th>Used</th>}
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d, index) => (
                  <tr key={d.DepartmentID}>
                    <td>{index + 1}</td>
                    <td>{d.DepartmentName}</td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={d.DistributionPercentage || 0}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;

                          setDepartments((prev) =>
                            prev.map((dept) =>
                              dept.DepartmentID === d.DepartmentID
                                ? {
                                    ...dept,
                                    DistributionPercentage: value,
                                  }
                                : dept,
                            ),
                          );
                        }}
                        className="dist-input"
                      />
                    </td>
                    {mode === "edit" && (
                      <td className="used-amount">
                        Php {format(getUsedCredit(d))}
                      </td>
                    )}
                    <td>
                      <div className="dept-input-container">
                        <p>Php.</p> {""}
                        <input
                          type="number"
                          step="0.01"
                          min={mode === "edit" ? getUsedCredit(d) : 0}
                          value={allocations[d.DepartmentID] || 0}
                          onChange={(e) => handleChange(d, e.target.value)}
                          className="dept-input"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">
            Cancel
          </button>
          <button onClick={handleSave} className="confirm-btn">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
