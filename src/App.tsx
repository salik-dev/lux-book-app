import React, { useState } from "react";
import { Routes, Route } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { BookingDialog } from "./components/booking/booking-dialog";
import { Header } from "./components/header";
import { Footer } from "./components/footer";

import HomePage from "./pages/home-page";
import OmOssPage from "./pages/om-oss"
import Arrangementer from "./pages/arrangementer";
import GallerietVart from "./pages/galleriet-vart";
import VareBildetaljer from "./pages/vare-bildetaljer";
import KontaktOss from "./pages/kontakt-oss";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">{children}</main>
      <Footer />
    </div>
  );
}

export default function App() {
 

  return (
    <>
      <Toaster />
      <Routes>

        {/* Home Page */}
        <Route 
          path="/" 
          element={
            <Layout> 
              {/* <HomePage onNavigateToBooking={openBookingDialog} onCarSelect={handleCarSelect} />
              <BookingDialog isOpen={isBookingDialogOpen} onClose={() => setIsBookingDialogOpen(false)} selectedCar={carData} /> */}
              <HomePage />
            </Layout>
          } 
        />

        {/* Other Pages */}
        <Route path="/om-oss" element={<Layout><OmOssPage /></Layout>} />
        <Route path="/arrangementer" element={<Layout><Arrangementer /></Layout>} />
        <Route path="/galleriet-vart" element={<Layout><GallerietVart /></Layout>} />
        <Route path="/vare-bildetaljer" element={<Layout><VareBildetaljer /></Layout>} />
        <Route path="/kontakt-oss" element={<Layout><KontaktOss /></Layout>} />
        
      </Routes>
    </>
  );
}