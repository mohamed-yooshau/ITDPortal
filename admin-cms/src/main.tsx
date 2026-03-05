import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";

const savedTheme = localStorage.getItem("itportal_theme");
document.body.dataset.theme = savedTheme === "dark" ? "dark" : "light";

const adminPath = import.meta.env.VITE_ADMIN_PATH || "secure-admin";
const adminBase = adminPath.startsWith("/") ? adminPath : `/${adminPath}`;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={adminBase}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
