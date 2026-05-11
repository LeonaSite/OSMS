import { createContext, useContext, useState } from "react";

const ReportsContext = createContext();

export const ReportsProvider = ({ children }) => {
  const [filter, setFilter] = useState("monthly");

  const now = new Date();
  const year = now.getFullYear();

  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(`${year}-12-31`);

  const [searchTerm, setSearchTerm] = useState("");

  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: null,
  });

  const [currentPage, setCurrentPage] = useState(1);

  const [activeTab, setActiveTab] = useState("requests");

  // 🔥 OPTIONAL: persist fetched data too (prevents refetch)
  const [overview, setOverview] = useState([]);
  const [requests, setRequests] = useState([]);
  const [arrivals, setArrivals] = useState([]);

  return (
    <ReportsContext.Provider
      value={{
        filter,
        setFilter,
        from,
        setFrom,
        to,
        setTo,
        searchTerm,
        setSearchTerm,
        sortConfig,
        setSortConfig,
        currentPage,
        setCurrentPage,
        activeTab,
        setActiveTab,
        overview,
        setOverview,
        requests,
        setRequests,
        arrivals,
        setArrivals,
      }}
    >
      {children}
    </ReportsContext.Provider>
  );
};

export const useReports = () => useContext(ReportsContext);
