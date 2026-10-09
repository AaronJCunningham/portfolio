import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";

const menuItems = [
  { label: "HOME", href: "/" },
  { label: "WORK", href: "/work" },
  { label: "ABOUT", href: "/about-me" },
  { label: "COMMUNITY", href: "/community" },
  { label: "CONTACT", href: "/contact" },
];

type MenuPhase = "closed" | "open" | "closing" | "fading";

const ITEM_EXIT_DURATION = 180;
const OVERLAY_FADE_DURATION = 380;

export default function PortalMenu() {
  const router = useRouter();
  const [phase, setPhase] = useState<MenuPhase>("closed");
  const [navigationError, setNavigationError] = useState("");
  const phaseRef = useRef<MenuPhase>("closed");
  const mountedRef = useRef(true);
  const itemExitTimerRef = useRef<number>();
  const closeTimerRef = useRef<number>();
  const revealFrameRef = useRef<number>();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const isVisible = phase !== "closed";
  const isInteractive = phase === "open";

  const setMenuPhase = useCallback((nextPhase: MenuPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const openMenu = useCallback(() => {
    if (phaseRef.current !== "closed") return;
    setNavigationError("");
    setMenuPhase("open");
  }, [setMenuPhase]);

  const closeMenu = useCallback(
    async (navigate?: () => Promise<boolean>) => {
      if (phaseRef.current !== "open") return;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setNavigationError("");
      setMenuPhase("closing");

      // Navigate beneath the persistent overlay. A slow route must not reveal
      // the previous page after the menu links finish animating out.
      const itemsExited = new Promise<void>((resolve) => {
        itemExitTimerRef.current = window.setTimeout(resolve, reducedMotion ? 0 : ITEM_EXIT_DURATION);
      });

      try {
        const [completed] = await Promise.all([navigate?.() ?? true, itemsExited]);
        if (!mountedRef.current) return;
        if (!completed) {
          setMenuPhase("open");
          firstLinkRef.current?.focus();
          return;
        }

        // Next's navigation promise resolves after the new page has committed.
        revealFrameRef.current = window.requestAnimationFrame(() => {
          if (reducedMotion) {
            setMenuPhase("closed");
            return;
          }
          setMenuPhase("fading");
          closeTimerRef.current = window.setTimeout(() => {
            setMenuPhase("closed");
          }, OVERLAY_FADE_DURATION);
        });
      } catch {
        if (!mountedRef.current) return;
        setNavigationError("That page could not be loaded. Please try again.");
        setMenuPhase("open");
        firstLinkRef.current?.focus();
      }
    },
    [setMenuPhase],
  );

  const handleItemClick = (
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();

    void closeMenu(router.asPath !== href ? () => router.push(href) : undefined);
  };

  useEffect(() => {
    if (!isVisible) return;

    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      firstLinkRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
        return;
      }

      if (event.key !== "Tab" || !menuRef.current) return;

      const focusable = Array.from(
        menuRef.current.querySelectorAll<HTMLElement>('button, a[href]'),
      ).filter((element) => element.tabIndex !== -1);
      if (focusable.length === 0) return;

      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.shiftKey
        ? currentIndex <= 0
          ? focusable.length - 1
          : currentIndex - 1
        : currentIndex === focusable.length - 1
          ? 0
          : currentIndex + 1;

      event.preventDefault();
      focusable[nextIndex].focus();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [closeMenu, isVisible]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      window.clearTimeout(itemExitTimerRef.current);
      window.clearTimeout(closeTimerRef.current);
      window.cancelAnimationFrame(revealFrameRef.current ?? 0);
    };
  }, []);

  return (
    <div
      ref={menuRef}
      className={`portal-menu ${
        phase !== "closed" ? "portal-menu--open" : ""
      } ${phase === "closing" || phase === "fading" ? "portal-menu--closing" : ""} ${
        phase === "fading" ? "portal-menu--fading" : ""
      }`}
    >
      <span className="portal-menu__label" aria-hidden="true">
        {isVisible ? "CLOSE" : "MENU"}
      </span>
      <button
        ref={triggerRef}
        className="portal-menu__trigger"
        type="button"
        aria-label={isVisible ? "Close menu" : "Open menu"}
        aria-expanded={isVisible}
        aria-controls="portal-menu-overlay"
        onClick={() => {
          if (phaseRef.current === "closed") {
            openMenu();
          } else if (phaseRef.current === "open") {
            closeMenu();
          }
        }}
      >
        <span className="portal-menu__trigger-core" />
      </button>

      <div
        id="portal-menu-overlay"
        className="portal-menu__overlay"
        role="dialog"
        aria-modal={isVisible ? "true" : undefined}
        aria-hidden={!isVisible}
        aria-busy={phase === "closing"}
        aria-label="Site navigation"
      >
        <nav className="portal-menu__panel" aria-label="Primary navigation">
          <div className="portal-menu__meta" aria-hidden="true">
            <span>{"// NAVIGATION"}</span>
            <span>AARON J. CUNNINGHAM / 2026</span>
          </div>

          <div className="portal-menu__links">
            {menuItems.map((item, index) => {
              const isActive =
                router.pathname === item.href ||
                (item.href.includes("#") && router.asPath === item.href);
              const className = `portal-menu__link ${
                isActive ? "portal-menu__link--active" : ""
              }`;

              return (
                <Link
                  ref={index === 0 ? firstLinkRef : undefined}
                  key={item.href}
                  className={className}
                  href={item.href}
                  tabIndex={isInteractive ? undefined : -1}
                  onClick={(event) => handleItemClick(event, item.href)}
                >
                  <span className="portal-menu__index">
                    {`//${String(index + 1).padStart(2, "0")}`}
                  </span>
                  <span className="portal-menu__name">{item.label}</span>
                  <span className="portal-menu__action">
                    <span>
                      {isActive ? "CURRENT" : "OPEN"}
                    </span>
                    <i aria-hidden="true">↗</i>
                  </span>
                </Link>
              );
            })}
          </div>

          {navigationError && <p role="alert">{navigationError}</p>}

          <div className="portal-menu__footer" aria-hidden="true">
            <span>LEAD FULL-STACK DEVELOPER / CREATIVE TECHNOLOGIST</span>
            <span>BERLIN / REMOTE</span>
          </div>
        </nav>
      </div>
    </div>
  );
}
