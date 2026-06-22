import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";

import Index from "./pages/Index";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Tenders from "./pages/Tenders";
import CreateTender from "./pages/CreateTender";
import TenderDetail from "./pages/TenderDetail";
import Portfolio from "./pages/Portfolio";
import SupplierDirectory from "./pages/SupplierDirectory";
import Stats from "./pages/Stats";
import ContractPage from "./pages/Contract";
import { NIP19Page } from "./pages/NIP19Page";
import NotFound from "./pages/NotFound";

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/tenders" element={<Tenders />} />
        <Route path="/tenders/new" element={<CreateTender />} />
        <Route path="/tenders/:id" element={<TenderDetail />} />
        <Route path="/suppliers" element={<SupplierDirectory />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/contracts/:id" element={<ContractPage />} />
        {/* NIP-19 route for npub1, note1, naddr1, nevent1, nprofile1 */}
        <Route path="/:nip19" element={<NIP19Page />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;
