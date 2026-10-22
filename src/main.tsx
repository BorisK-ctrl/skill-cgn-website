import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/index.css";
import { initGads } from "./lib/gads";

initGads();

const root = document.getElementById("root")!;
const tree = <React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>;
// Vorgerenderte Seiten werden hydriert, sonst normal gerendert
if (root.hasChildNodes()) ReactDOM.hydrateRoot(root, tree); else ReactDOM.createRoot(root).render(tree);
