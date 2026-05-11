import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

const fetchRequisitions = async ({ queryKey }) => {
  const [_key, { status, from, to, dateType }] = queryKey;

  let url = `${API}/api/requests?status=${status}`;
  if (from && to) {
    url += `&from=${from}&to=${to}&dateType=${dateType}`;
  }

  const res = await axios.get(url);
  return res.data;
};

export const useRequisitions = ({ status, from, to, dateType }) => {
  return useQuery({
    queryKey: ["requisitions", { status, from, to, dateType }],
    queryFn: fetchRequisitions,
    keepPreviousData: true,

    // 🔥 Real-time auto refetch
    refetchInterval: 3000, // every 3 seconds
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
};