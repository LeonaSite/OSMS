import { createContext, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import logo from "../../assets/nmis_logo.png";

const API = import.meta.env.VITE_API_URL;

// 👇 IMPORTANT: export context itself
export const NotificationContext = createContext();

export const RequesterNotificationProvider = ({ children }) => {
  const notifiedProcessed = useRef(
    new Set(JSON.parse(localStorage.getItem("req_notifiedProcessed")) || []),
  );

  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  const { data: processed = [] } = useQuery({
    queryKey: ["requester-processed"],
    queryFn: async () => {
      const res = await axios.get(
        `${API}/api/requesterNotification/processed`,
        { withCredentials: true },
      );
      return Array.isArray(res.data) ? res.data : [];
    },
    refetchInterval: 500,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!Array.isArray(processed)) return;
    if (Notification.permission !== "granted") return;

    let updated = false;

    processed.forEach((req) => {
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
          window.location.href = "/requester/requests";
        };
      }
    });

    if (updated) {
      localStorage.setItem(
        "req_notifiedProcessed",
        JSON.stringify([...notifiedProcessed.current]),
      );
    }
  }, [processed]);

  return (
    <NotificationContext.Provider value={{}}>
      {children}
    </NotificationContext.Provider>
  );
};
