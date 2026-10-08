import { StrictMode, Suspense, lazy, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes, useLocation } from "react-router-dom";
import "./styles.css";
import "./screens.css";
import { installTextures } from "./textures";
import { Desk } from "./ui/Desk";
import { Empty, Loading, Masthead } from "./ui/Parts";

installTextures();
const Home = lazy(() => import("./pages/Home"));
const PromisePage = lazy(() => import("./pages/Promise"));
const Builder = lazy(() => import("./pages/Builder"));
const Officer = lazy(() => import("./pages/Officer"));
const How = lazy(() => import("./pages/How"));

function NotFound() {
  return <Desk><Masthead /><Empty title="This page is not on the desk."><Link className="btn" to="/">Go to the search</Link></Empty></Desk>;
}

/** The sheet stays put on route changes; only its content fades (SPEC 6.5). */
function Routed() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="route" key={pathname}>
      <Suspense fallback={<Desk><Loading /></Desk>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/p/:id" element={<PromisePage />} />
          <Route path="/b/:slug" element={<Builder />} />
          <Route path="/officer" element={<Officer />} />
          <Route path="/how" element={<How />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><BrowserRouter><Routed /></BrowserRouter></StrictMode>,
);
