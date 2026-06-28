import { createRoot } from "react-dom/client";
import { registerServiceWorker } from "@/swRegister";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
registerServiceWorker();
