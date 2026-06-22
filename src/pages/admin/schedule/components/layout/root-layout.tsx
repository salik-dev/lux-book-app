import { Outlet } from "react-router-dom";

import { Header } from "./header";

export function RootLayout() {
  return (
    <>
      <Header />
      <Outlet />
    </>
  );
}
