import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

const fetchProducts = async ({ queryKey }) => {
  const [_key, params] = queryKey;

  const res = await axios.get(`${API}/api/requester/products`, {
    params,
    withCredentials: true,
  });

  return res.data;
};

export const useProducts = (params) => {
  return useQuery({
    queryKey: ["products", params],
    queryFn: fetchProducts,
    keepPreviousData: true,

    // 🔥 REALTIME
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
};
