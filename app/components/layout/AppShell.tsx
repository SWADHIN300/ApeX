"use client";
import { useState } from "react";
import TopBar from "../TopBar";
import SideNav from "../SideNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isNavOpen, setIsNavOpen] = useState(true);

  return (
    <>
      <TopBar
        isSideNavOpen={isNavOpen}
        onToggleSideNav={() => setIsNavOpen((v) => !v)}
      />
      <SideNav isOpen={isNavOpen} />
      <main
        className={`mt-14 h-[calc(100vh-56px)] min-w-0 overflow-auto bg-bg-base transition-[margin-left] duration-300 ${
          isNavOpen ? "ml-16" : "ml-0"
        }`}
      >
        {children}
      </main>
    </>
  );
}
