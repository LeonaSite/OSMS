import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

export default function AdminPrivateRoute({ children }) {
  const [authorized, setAuthorized] = useState(null);

  useEffect(() => {
    axios
      .get(`${API}/api/login/dashboard`, {
        withCredentials: true,
      })
      .then(() => setAuthorized(true))
      .catch(() => setAuthorized(false));
  }, []);

  if (authorized === null) return <div>Loading...</div>;

  return authorized ? children : <Navigate to="/admin/login" />;
}
