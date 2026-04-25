import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CartProvider } from "./lib/cart";
import { MenuOverridesProvider } from "./lib/itemOverrides";
import { CartDrawer } from "./components/CartDrawer";
import { CartButton } from "./components/CartButton";
import { AdminGuard } from "./components/AdminGuard";
import Home from "./pages/Home";
import Menu from "./pages/Menu";
import Checkout from "./pages/Checkout";
import OrderConfirmed from "./pages/OrderConfirmed";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminLogin from "./pages/admin/Login";
import AdminOrderDetail from "./pages/admin/OrderDetail";
import AdminOrders from "./pages/admin/Orders";
import AdminPrintSlip from "./pages/admin/PrintSlip";
import AdminProducts from "./pages/admin/Products";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      // Wait for target to render, then scroll to it.
      setTimeout(() => {
        const el = document.querySelector(hash);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
        }
      }, 120);
    } else {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  }, [location]);
  return null;
}

function Router() {
  return (
    <>
      <ScrollToTop />
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/menu"} component={Menu} />
        <Route path={"/checkout"} component={Checkout} />
        <Route path={"/order-confirmed"} component={OrderConfirmed} />
        <Route path={"/admin/login"} component={AdminLogin} />
        <Route path={"/admin"}>
          <AdminGuard>
            <AdminDashboard />
          </AdminGuard>
        </Route>
        <Route path={"/admin/orders"}>
          <AdminGuard>
            <AdminOrders />
          </AdminGuard>
        </Route>
        <Route path={"/admin/products"}>
          <AdminGuard>
            <AdminProducts />
          </AdminGuard>
        </Route>
        <Route path={"/admin/orders/:id/print"}>
          {(params) => (
            <AdminGuard>
              <AdminPrintSlip id={params.id} />
            </AdminGuard>
          )}
        </Route>
        <Route path={"/admin/orders/:id"}>
          {(params) => (
            <AdminGuard>
              <AdminOrderDetail id={params.id} />
            </AdminGuard>
          )}
        </Route>
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <CartProvider>
            <MenuOverridesProvider>
              <Toaster />
              <Router />
              <CartButton />
              <CartDrawer />
            </MenuOverridesProvider>
          </CartProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
