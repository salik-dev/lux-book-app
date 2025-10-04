
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from "./App";
import "./styles/globals.css";
import { Toaster } from './components/ui/toaster';
import {Toaster as Sonner} from './components/ui/sonner';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
       <Toaster />
       <Sonner />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  )  