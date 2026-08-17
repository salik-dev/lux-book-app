
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { CriiptoVerifyProvider } from '@criipto/verify-react'
import App from "./App";
import "./styles/globals.css";
import { Toaster } from './components/ui/toaster';
import {Toaster as Sonner} from './components/ui/sonner';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
       <Toaster />
       <Sonner />
      <CriiptoVerifyProvider
        domain={import.meta.env.VITE_IDURA_DOMAIN}
        clientID={import.meta.env.VITE_IDURA_CLIENT_ID}
        redirectUri={`${window.location.origin}/auth/success`}
      >
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </CriiptoVerifyProvider>
    </React.StrictMode>
  )