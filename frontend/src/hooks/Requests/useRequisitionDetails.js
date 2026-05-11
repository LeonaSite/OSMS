import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

export const useRequisitionDetails = (requisitionNo) => {
  const queryClient = useQueryClient();

  //  MAIN DATA
  const detailsQuery = useQuery({
    queryKey: ["request-details", requisitionNo],
    queryFn: async () => {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/requests/${requisitionNo}`,
      );
      return res.data;
    },
    refetchInterval: 3000, // realtime
  });

  //  VALIDATION
  const validationQuery = useQuery({
    queryKey: ["validate-invoices", requisitionNo],
    queryFn: async () => {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/requests/validate-invoices/${requisitionNo}`,
      );
      return res.data;
    },
    refetchInterval: 3000,
  });

  //  helper to refresh manually
  const refresh = () => {
    queryClient.invalidateQueries(["request-details", requisitionNo]);
    queryClient.invalidateQueries(["validate-invoices", requisitionNo]);
  };

  return {
    request: detailsQuery.data?.request,
    items: detailsQuery.data?.items || [],
    isLoading: detailsQuery.isLoading,
    isError: detailsQuery.isError,

    validation: validationQuery.data,
    isInvalidInvoice: validationQuery.data && !validationQuery.data.isValid,

    refresh,
  };
};
