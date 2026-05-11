import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import "./EmployeeSelectorModal.css";
import { FaSearch, FaSort, FaSortUp, FaSortDown } from "react-icons/fa";

export default function EmployeeSelectorModal({ close, select }) {

    const [employees, setEmployees] = useState([]);
    const [search, setSearch] = useState("");
    const [department, setDepartment] = useState("ALL");

    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10;
    const [total, setTotal] = useState(0);
    const [departments, setDepartments] = useState([]);

    const [sortConfig, setSortConfig] = useState({
        key: null,
        direction: null
    });
    

    const fetchEmployees = async () => {

        const res = await axios.get(
            `${import.meta.env.VITE_API_URL}/api/requests/employee-selector`,
            {
                params: {
                    search,
                    department,
                    page: currentPage,
                    pageSize: rowsPerPage
                }
            }
        );

        setEmployees(res.data.data);
        setTotal(res.data.total);
    };

    const fetchDepartments = async () => {
        const res = await axios.get(
            `${import.meta.env.VITE_API_URL}/api/requests/departments`
        );
        setDepartments(res.data);
    };

    useEffect(() => {
        fetchDepartments();
    }, []);

    useEffect(() => {
        fetchEmployees();
    }, [search, department, currentPage]);

    // reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [search, department]);

    const totalPages = Math.ceil(total / rowsPerPage);

    const handleSort = (key) => {
        let direction = "asc";

        if (sortConfig.key === key) {
            if (sortConfig.direction === "asc") direction = "desc";
            else if (sortConfig.direction === "desc") direction = null;
        }

        setSortConfig({
            key: direction ? key : null,
            direction
        });
    };

    const renderSortIcon = (key) => {
        if (sortConfig.key !== key) return <FaSort className="sort-icon" />;
        if (sortConfig.direction === "asc") return <FaSortUp className="sort-icon" />;
        if (sortConfig.direction === "desc") return <FaSortDown className="sort-icon" />;
        return <FaSort className="sort-icon" />;
    };

    const sortedEmployees = useMemo(() => {
        let data = [...employees];

        if (sortConfig.key) {
            data.sort((a, b) => {

                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                if (sortConfig.key === "Name") {
                    aValue = `${a.Firstname} ${a.Lastname}`;
                    bValue = `${b.Firstname} ${b.Lastname}`;
                }

                return sortConfig.direction === "asc"
                    ? String(aValue).localeCompare(String(bValue))
                    : String(bValue).localeCompare(String(aValue));
            });
        }

        return data;

    }, [employees, sortConfig]);

    return (

        <div className="modal-overlay">

            <div className="employee-selector-modal">

                <div className="employee-selector-header">
                    Search for Requester Name
                </div>

                <div className="employee-selector-body">
                    <div className="employee-selector-tool">

                        {/* SEARCH + FILTER */}
                        <div className="search-wrapper">
                            <FaSearch className="search-icon"/>
                            <input
                                placeholder="Search Account Name, Department"
                                value={search}
                                onChange={(e)=>setSearch(e.target.value)}
                                className="requester-search"
                            />
                        </div>
                        <select
                            value={department}
                            onChange={(e)=>setDepartment(e.target.value)}
                            className="department-filter"
                        >
                            <option value="ALL">All Departments</option>

                            {departments.map(dep => (
                                <option key={dep.DepartmentID} value={dep.DepartmentName}>
                                    {dep.DepartmentName}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* TABLE */}
                    <div className="employee-selector-table-wrapper">

                        <table className="employee-selector-table">

                            <thead>
                                <tr>
                                    <th>#</th>

                                    <th
                                        onClick={() => handleSort("Username")}
                                        className="sortable"
                                    >
                                        Username {renderSortIcon("Username")}
                                    </th>

                                    <th
                                        onClick={() => handleSort("Name")}
                                        className="sortable"
                                    >
                                        Name {renderSortIcon("Name")}
                                    </th>
                                </tr>
                            </thead>

                            <tbody>

                                {sortedEmployees.map((emp, i) => (

                                    <tr
                                        key={emp.EmployeeID}
                                        onClick={()=>{
                                            select(emp);
                                            close();
                                        }}
                                    >
                                        <td>
                                            {(currentPage - 1) * rowsPerPage + i + 1}
                                        </td>

                                        <td>{emp.Username}</td>

                                        <td>
                                            <div className="emp-name">
                                                {emp.Firstname} {emp.Lastname}
                                            </div>

                                            <div className="emp-dept">
                                                {emp.DepartmentName}
                                            </div>
                                        </td>

                                    </tr>

                                ))}

                            </tbody>

                        </table>

                    </div>

                    {/* PAGINATION */}
                    <div className="pagination">

                        <button
                            disabled={currentPage === 1}
                            onClick={()=>setCurrentPage(prev=>prev-1)}
                        >
                            Prev
                        </button>

                        {[...Array(totalPages)].map((_, i) => (

                            <button
                                key={i}
                                className={currentPage === i + 1 ? "active-page" : ""}
                                onClick={()=>setCurrentPage(i+1)}
                            >
                                {i+1}
                            </button>

                        ))}

                        <button
                            disabled={currentPage === totalPages}
                            onClick={()=>setCurrentPage(prev=>prev+1)}
                        >
                            Next
                        </button>

                    </div>

                    <div className="modal-footer">
                        <button onClick={close} className="cancel-btn">
                            Cancel
                        </button>
                    </div>

                </div>

            </div>

        </div>
    );
}