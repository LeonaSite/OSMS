import { formatDateTime } from "../../Utilities/FormatDateTime";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import "./Dashboard.css";
import { IoTimerOutline, IoArrowForwardOutline } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import BeatLoader from "react-spinners/BeatLoader";

export default function PendingRequestWidget() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["pendingRequestsSummary"],
    queryFn: async () => {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/adminDashboard/pending-requests-summary`,
      );
      return res.data;
    },

    // real time auto refresh
    refetchInterval: 5000,
    refetchIntervalInBackground: true,

    // always fresh enough
    staleTime: 0,
  });

  const pending = data?.totalPending || 0;
  const firstPendingDate = data?.firstPendingDate;

  return (
    <div className="pending-widget-card">
      <div className="pending-widget-icon-box">
        <IoTimerOutline className="pending-widget-icon" />
      </div>

      <div className="pending-widget-right">
        <h4>Pending Requests</h4>

        <div className="pending-widget-no-view">
          {isLoading ? (
            <div className="spinner-container">
              <BeatLoader size={15} color="#1e3a8a" />
            </div>
          ) : isError ? (
            <p>Failed to load</p>
          ) : (
            <div className="pending-count">
              <h1>{pending}</h1>

              <p>
                {firstPendingDate
                  ? formatDateTime(firstPendingDate)
                  : "No pending requests"}
              </p>
            </div>
          )}

          <div className="widget-view-container">
            <button
              className="widget-view-btn"
              onClick={() => navigate(`/admin/requisition-control`)}
            >
              View <IoArrowForwardOutline className="widget-view-icon" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
