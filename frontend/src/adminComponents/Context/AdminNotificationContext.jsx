import { createContext, useContext, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import logo from "../../assets/nmis_logo.png";

const API = import.meta.env.VITE_API_URL;

const NotificationContext = createContext();

export const useAdminNotifications = () => useContext(NotificationContext);

export const AdminNotificationProvider = ({ children }) => {
  //  CACHE (LOCAL STORAGE)
  const notifiedRequests = useRef(
    new Set(JSON.parse(localStorage.getItem("notifiedRequests")) || []),
  );

  const notifiedProcessed = useRef(
    new Set(JSON.parse(localStorage.getItem("notifiedProcessed")) || []),
  );

  const notifiedLowStocks = useRef(
    new Set(JSON.parse(localStorage.getItem("notifiedLowStocks")) || []),
  );

  //  REQUEST PERMISSION
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  //  FETCH: NEW REQUESTS
  const { data: requests = [] } = useQuery({
    queryKey: ["admin-new-requests"],
    queryFn: async () => {
      const res = await axios.get(`${API}/api/adminNotification/new-requests`);

      if (Array.isArray(res.data)) return res.data;
      if (Array.isArray(res.data?.data)) return res.data.data;

      console.warn("Unexpected API response:", res.data);
      return [];
    },
    refetchInterval: 500, // faster (0.5 sec)
    refetchIntervalInBackground: true,
  });

  // FETCH: PROCESSED REQUEST
  const { data: processed = [] } = useQuery({
    queryKey: ["processed-requests"],
    queryFn: async () => {
      const res = await axios.get(
        `${API}/api/adminNotification/processed-requests`,
      );
      return Array.isArray(res.data) ? res.data : [];
    },
    refetchInterval: 500,
    refetchIntervalInBackground: true,
  });

  //  FETCH: LOW STOCK ALERTS
  const { data: lowStocks = [], isLoading: isLowStockLoading } = useQuery({
    queryKey: ["low-stock-alerts"],
    queryFn: async () => {
      const res = await axios.get(
        `${API}/api/adminNotification/low-stock-alerts`,
      );
      return Array.isArray(res.data) ? res.data : [];
    },
    refetchInterval: 500, // faster (0.5 sec)
    refetchIntervalInBackground: true,
  });

  //  REQUEST NOTIFICATIONS
  useEffect(() => {
    if (!Array.isArray(requests)) return;
    if (Notification.permission !== "granted") return;

    let updated = false;

    requests.forEach((req) => {
      if (!req?.requestId) return;

      if (!notifiedRequests.current.has(req.requestId)) {
        notifiedRequests.current.add(req.requestId);
        updated = true;

        const notification = new Notification(req.title || "New Request", {
          body: req.body || "New request received",
          icon: logo,
        });

        notification.onclick = () => {
          window.focus();
          window.location.href = "/admin/requisition-control?status=pending";
        };
      }
    });

    if (updated) {
      localStorage.setItem(
        "notifiedRequests",
        JSON.stringify([...notifiedRequests.current]),
      );
    }
  }, [requests]);

  // PROCESSED REQUEST NOTIFICATION
  useEffect(() => {
    if (!Array.isArray(processed)) return;
    if (Notification.permission !== "granted") return;

    let updated = false;

    processed.forEach((req) => {
      if (!req?.requestId) return;

      const key = `${req.requestId}-${req.statusId}`;

      if (!notifiedProcessed.current.has(key)) {
        notifiedProcessed.current.add(key);
        updated = true;

        const notification = new Notification(req.title, {
          body: req.body,
          icon: logo,
        });

        notification.onclick = () => {
          window.focus();
          window.location.href = `/admin/requisition-control?status=${
            req.statusId === 2 ? "accepted" : "rejected"
          }`;
        };
      }
    });

    if (updated) {
      localStorage.setItem(
        "notifiedProcessed",
        JSON.stringify([...notifiedProcessed.current]),
      );
    }
  }, [processed]);

  //  LOW STOCK NOTIFICATIONS
  useEffect(() => {
    //  VERY IMPORTANT: wait for real data
    if (isLowStockLoading) return;
    if (!Array.isArray(lowStocks)) return;
    if (Notification.permission !== "granted") return;

    //  CURRENT CRITICAL STOCK IDs
    const currentCriticalIds = new Set(lowStocks.map((item) => item.stockId));

    //  REMOVE RECOVERED STOCKS

    notifiedLowStocks.current.forEach((stockId) => {
      if (!currentCriticalIds.has(stockId)) {
        notifiedLowStocks.current.delete(stockId);
      }
    });

    //  ADD NEW CRITICAL STOCKS

    lowStocks.forEach((item) => {
      if (!item?.stockId) return;

      if (!notifiedLowStocks.current.has(item.stockId)) {
        notifiedLowStocks.current.add(item.stockId);

        const notification = new Notification(
          item.title || "Low Stock Alert!",
          {
            body: item.body || "Item is running low on stock.",
            icon: logo,
          },
        );

        notification.onclick = () => {
          window.focus();
          window.location.href = "/admin/stock-control?status=Critical";
        };
      }
    });

    //  SAVE CACHE

    localStorage.setItem(
      "notifiedLowStocks",
      JSON.stringify([...notifiedLowStocks.current]),
    );
  }, [lowStocks, isLowStockLoading]);

  // PROVIDER
  return (
    <NotificationContext.Provider value={{}}>
      {children}
    </NotificationContext.Provider>
  );
};
