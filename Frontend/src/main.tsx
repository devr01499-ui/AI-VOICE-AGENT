import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import ErrorBoundary from "./app/components/common/ErrorBoundary.tsx";
import "./styles/index.css";

if (typeof window !== "undefined") {
  (window as any).React = React;
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);