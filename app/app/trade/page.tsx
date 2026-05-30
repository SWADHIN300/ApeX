import TopBar from "@/components/TopBar";
import SideNav from "@/components/SideNav";
import ChartPanel from "@/components/ChartPanel";
import OrderBook from "@/components/OrderBook";
import OrderForm from "@/components/OrderForm";
import PositionPanel from "@/components/PositionPanel";

export default function TradePage() {
  return (
    <>
      {/* Fixed header */}
      <TopBar />

      {/* Fixed collapsible sidebar */}
      <SideNav />

      {/* Main grid — offset by header (56px) and sidebar (64px) */}
      <main className="mt-14 ml-16 h-[calc(100vh-56px)] grid grid-cols-12 overflow-hidden">
        {/* Chart (7/12) */}
        <ChartPanel />

        {/* Order Book (2/12) */}
        <OrderBook />

        {/* Order Entry (3/12) */}
        <OrderForm />

        {/* Positions Table (full width) */}
        <PositionPanel />
      </main>
    </>
  );
}
