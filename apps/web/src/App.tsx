import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation
} from "react-router-dom";
import { Shell } from "./features/shell/Shell";
import { BuildPage } from "./features/build/BuildPage";
import { ComparePage } from "./features/compare/ComparePage";
import { PvpPage } from "./features/pvp/PvpPage";
import { AccountPage } from "./features/account/AccountPage";

const LegacyApp = lazy(() => import("./legacy/LegacyApp"));
const TalentsPage = lazy(() =>
  import("./features/talents/TalentsPage").then((module) => ({ default: module.TalentsPage }))
);
const SimulationPage = lazy(() =>
  import("./features/simulation/SimulationPage").then((module) => ({ default: module.SimulationPage }))
);
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 }
  }
});

function V3Redirect() {
  const { pathname, search, hash } = useLocation();
  return <Navigate replace to={`${pathname.replace(/^\/v3/, "") || "/build"}${search}${hash}`} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/legacy/*" element={<Suspense fallback={null}><LegacyApp /></Suspense>} />
          <Route path="/v3/*" element={<V3Redirect />} />
          <Route element={<Shell />}>
            <Route path="/build" element={<BuildPage />} />
            <Route path="/build/talents" element={<Suspense fallback={null}><TalentsPage /></Suspense>} />
            <Route path="/simulate" element={<Suspense fallback={null}><SimulationPage /></Suspense>} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/pvp" element={<PvpPage />} />
            <Route path="/account" element={<AccountPage />} />
          </Route>
          <Route path="/" element={<Navigate replace to="/build" />} />
          <Route path="*" element={<Navigate replace to="/build" />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
