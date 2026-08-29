import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./App";

createRoot(document.querySelector<HTMLDivElement>("#root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
