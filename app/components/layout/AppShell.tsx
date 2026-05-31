"use client";
import { useState } from "react";
import TopBar from "../TopBar";
import SideNav from "../SideNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isNavOpen, setIsNavOpen] = useState(true);
  const [isNavExpanded, setIsNavExpanded] = useState(false);

  return (
    <>
      <TopBar
        isSideNavOpen={isNavOpen}
        onToggleSideNav={() => setIsNavOpen((v) => !v)}
      />
      <SideNav
        isOpen={isNavOpen}
        isExpanded={isNavExpanded}
        onToggleExpand={() => setIsNavExpanded((v) => !v)}
      />
      <main
        className={`mt-14 h-[calc(100vh-56px)] min-w-0 overflow-auto bg-bg-base transition-[margin-left] duration-300 ${
          isNavOpen
            ? isNavExpanded
              ? "ml-52"
              : "ml-16"
            : "ml-0"
        }`}
      >
        {children}
      </main>
    </>
  );
}
