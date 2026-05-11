import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

const fetchInvoices = async ({ queryKey }) => {
  const [_key, { status, from, to }] = queryKey;

  let url = `${API}/api/invoices?status=${status}`;

  if (from && to) {
    url += `&from=${from}&to=${to}`;
  }

  const res = await axios.get(url);
  return res.data;
};

export const useInvoices = ({ status, from, to }) => {
  return useQuery({
    queryKey: ["invoices", { status, from, to }],
    queryFn: fetchInvoices,

    keepPreviousData: true,

    // 🔥 REAL-TIME
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
};