import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

const fetchAuditLogs = async ({ queryKey }) => {
  const [_key, params] = queryKey;

  const res = await axios.get(`${API}/api/audit-logs`, {
    params,
  });

  return res.data;
};

export const useAuditLogs = (params) => {
  return useQuery({
    queryKey: ["auditLogs", params],
    queryFn: fetchAuditLogs,

    keepPreviousData: true,

    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
};
