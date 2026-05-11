import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

// ✅ FETCH STOCKS
const fetchStocks = async ({ queryKey }) => {
  const [_key, { status, type }] = queryKey;

  let url = `${API}/api/stocks?`;

  if (status) url += `status=${status}&`;
  if (type) url += `type=${type}&`;

  const res = await axios.get(url);
  return res.data;
};

// ✅ HOOK
export const useStocks = ({ status, type }) => {
  return useQuery({
    queryKey: ["stocks", { status, type }],
    queryFn: fetchStocks,

    keepPreviousData: true,

    // ✅ REAL-TIME SETTINGS
    refetchInterval: 3000, // every 3 seconds
    refetchOnWindowFocus: true, // when tab is focused
    refetchOnMount: true,
    staleTime: 0, // always considered stale
  });
};
