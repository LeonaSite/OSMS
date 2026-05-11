import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

// ================= OVERVIEW =================
const fetchOverview = async ({ queryKey }) => {
  const [_key, { filter, from, to }] = queryKey;

  const res = await axios.get(`${API}/api/reports/overview`, {
    params: { filter, from, to },
  });

  return Array.isArray(res.data) ? res.data : [];
};

export const useOverview = ({ filter, from, to }) => {
  return useQuery({
    queryKey: ["overview", { filter, from, to }],
    queryFn: fetchOverview,

    keepPreviousData: true,

    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 0,
  });
};

// ================= REQUESTS =================
const fetchRequests = async ({ queryKey }) => {
  const [_key, { from, to }] = queryKey;

  const res = await axios.get(`${API}/api/reports/requests`, {
    params: { from, to },
  });

  return Array.isArray(res.data) ? res.data : [];
};

export const useRequests = ({ from, to }) => {
  return useQuery({
    queryKey: ["requests", { from, to }],
    queryFn: fetchRequests,

    keepPreviousData: true,
    refetchInterval: 3000,
    staleTime: 0,
  });
};

// ================= ARRIVALS =================
const fetchArrivals = async ({ queryKey }) => {
  const [_key, { from, to }] = queryKey;

  const res = await axios.get(`${API}/api/reports/arrivals`, {
    params: { from, to },
  });

  return Array.isArray(res.data) ? res.data : [];
};

export const useArrivals = ({ from, to }) => {
  return useQuery({
    queryKey: ["arrivals", { from, to }],
    queryFn: fetchArrivals,

    keepPreviousData: true,
    refetchInterval: 3000,
    staleTime: 0,
  });
};
