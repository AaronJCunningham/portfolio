// pages/_app.tsx
import { AppProps } from "next/app";
import { Inter, JetBrains_Mono } from "next/font/google";
import PortalMenu from "@/components/layout/PortalMenu";
import ShopLayout from "@/components/shop/ShopLayout";
import "../styles/index.scss";

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["100", "200", "300", "400"],
});

const display = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

const portfolioRoutes = new Set(["/", "/work", "/about-me", "/contact", "/[slug]"]);

function MyApp({ Component, pageProps, router }: AppProps) {
  const isCommunity = router.pathname === "/community" || router.pathname.startsWith("/community/");
  const isShop = router.pathname === "/community/shop" || router.pathname.startsWith("/community/shop/");
  return (
    <div className={`${jetbrains.className} ${display.variable}${isCommunity ? " community-theme" : ""}`}>
      {portfolioRoutes.has(router.pathname) && <PortalMenu />}
      {isShop ? (
        <ShopLayout><Component {...pageProps} /></ShopLayout>
      ) : <Component {...pageProps} />}
    </div>
  );
}

export default MyApp;
