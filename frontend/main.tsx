import "../vite.polyfills";
import "./index.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";

import App from "@/App.tsx";


const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AptosWalletAdapterProvider autoConnect={true}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </AptosWalletAdapterProvider>
  </React.StrictMode>,
);
