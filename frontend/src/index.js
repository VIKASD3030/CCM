import "regenerator-runtime/runtime";
import React from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import App from "./app";
import registerServiceWorker from "./registerServiceWorker";
import { Provider } from "react-redux";
import { basicReduxStore } from "./reduxStore";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from "./theme";

// Create root container
const container = document.getElementById("root");
const root = createRoot(container); // <-- createRoot

// Render the app
root.render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <Provider store={basicReduxStore}>
      <App />
    </Provider>
  </ThemeProvider>
);

registerServiceWorker();
