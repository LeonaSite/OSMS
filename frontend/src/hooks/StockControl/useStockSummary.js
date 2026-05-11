import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

const fetchSummary = async () => {
  const res = await axios.get(`${API}/api/stocks/summary`);
  return res.data;
};

export const useStockSummary = () => {
  return useQuery({
    queryKey: ["stock-summary"],
    queryFn: fetchSummary,

    staleTime: 0,
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });
};
