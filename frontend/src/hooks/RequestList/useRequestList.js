import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

const fetchRequests = async () => {
  const token = localStorage.getItem("token");

  const res = await axios.get(`${API}/api/requester/request-list`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
};

export const useRequestList = () => {
  return useQuery({
    queryKey: ["requesterList"],
    queryFn: fetchRequests,

    // 🔥 REALTIME SETTINGS
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    staleTime: 0,

    // UX improvement
    keepPreviousData: true,
  });
};
