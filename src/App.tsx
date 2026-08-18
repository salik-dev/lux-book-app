import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { Header } from "./components/header";
import { Footer } from "./components/footer";
import { AuthProvider, useAuth } from "./context/auth-context";

// Pages
import HomePage from "./pages/home-page";
import OmOssPage from "./pages/om-oss";
import Arrangementer from "./pages/arrangementer";
import GallerietVart from "./pages/galleriet-vart";
import VareBildetaljer from "./pages/vare-bildetaljer";
import KontaktOss from "./pages/kontakt-oss";
import NotFound from "./pages/not-found";
import Admin from "./pages/admin/admin";
import Bookings from "./pages/bookings/booking";
import BookingSuccess from "./pages/booking-success";
import BookingCancelled from "./pages/booking-cancelled";
import AuthSuccessPage from "./pages/auth-success";
import AuthAbortPage from "./pages/auth-abort";
import AuthErrorPage from "./pages/auth-error";
import { RootLayout } from "./pages/admin/schedule/components/layout/root-layout";
import { CalendarLayout } from "./pages/admin/schedule/calendar/components/calendar-layout";
import { ClientContainer } from "./pages/admin/schedule/calendar/components/client-container";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">{children}</main>
      <Footer />
    </div>
  );
}

function BlockAdminFromPublic({ children }: { children: React.ReactNode }) {
  const { loading, user, isAdmin } = useAuth();

  if (loading) return null;
  if (user && isAdmin) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster />
      <Routes>
        {/* Home Page */}
        <Route path="/" element={
          <BlockAdminFromPublic>
            <Layout>
              <HomePage />
            </Layout>
          </BlockAdminFromPublic>
        } />

        {/* Booking Routes */}
        <Route path="/bookings" element={
          <BlockAdminFromPublic>
            <Layout>
              <Bookings />
            </Layout>
          </BlockAdminFromPublic>
        } />

        {/* Admin Routes */}
        <Route path="/admin" element={
            <Admin />
        } />
      {/* 
         <Route element={<RootLayout />}>
          <Route element={<CalendarLayout />}>
            <Route index element={<Navigate to="/admin" replace />} />
            <Route path="day-view" element={<ClientContainer view="day" />} />
            <Route path="week-view" element={<ClientContainer view="week" />} />
            <Route path="month-view" element={<ClientContainer view="month" />} />
            <Route path="year-view" element={<ClientContainer view="year" />} />
            <Route path="agenda-view" element={<ClientContainer view="agenda" />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Route> */}

        {/* Other Pages */}
        <Route path="/om-oss" element={
          <Layout>
            <OmOssPage />
          </Layout>
        } />
        
        <Route path="/arrangementer" element={
          <Layout>
            <Arrangementer />
          </Layout>
        } />
        
        <Route path="/galleriet-vart" element={
          <Layout>
            <GallerietVart />
          </Layout>
        } />
        
        <Route path="/vare-bildetaljer" element={
          <Layout>
            <VareBildetaljer />
          </Layout>
        } />
        
        <Route path="/kontakt-oss" element={
          <Layout>
            <KontaktOss />
          </Layout>
        } />

        <Route path="/booking-success" element={
          <Layout>
            <BookingSuccess />
          </Layout>
        } />
        <Route path="/booking-cancelled" element={
          <Layout>
            <BookingCancelled />
          </Layout>
        } />
        <Route path="/auth/success" element={
          <Layout>
            <AuthSuccessPage />
          </Layout>
        } />
        <Route path="/auth/abort" element={
          <Layout>
            <AuthAbortPage />
          </Layout>
        } />
        <Route path="/auth/error" element={
          <Layout>
            <AuthErrorPage />
          </Layout>
        } />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}