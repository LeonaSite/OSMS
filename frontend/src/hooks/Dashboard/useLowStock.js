import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export const useLowStock = () => {
  return useQuery({
    queryKey: ["lowStock"],

    queryFn: async () => {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/adminDashboard/low-stock`,
      );
      return res.data;
    },

    // realtime auto refresh
    refetchInterval: 5000,
    refetchIntervalInBackground: true,

    // always revalidate
    staleTime: 0,

    retry: 2,
    refetchOnWindowFocus: true,
  });
};
