// Native bits for the iOS app (Capacitor). On the website every helper falls back to the web version or does nothing.
// Plugins come from the native side (npm @capacitor/haptics, share, browser, splash-screen, status-bar + cap sync),
// so this file reaches them through window.Capacitor.Plugins and needs no bundler.
(function () {
  const cap = window.Capacitor;
  const isApp = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  if (isApp) document.documentElement.classList.add("in-app");
  const plugin = name => (isApp && cap.isPluginAvailable && cap.isPluginAvailable(name) && cap.Plugins[name]) || null;
  const quiet = p => { if (p && p.catch) p.catch(() => {}); };

  // Links that open in the in-app Safari sheet: other sites, plus Terms and Privacy (standalone pages with no way back)
  const HOME_HOSTS = new Set(["parcade.golf", "www.parcade.golf"]);
  const SHEET_PATHS = /^\/(terms|privacy)(\.html)?$/;
  function opensInSheet(url) {
    let u;
    try { u = new URL(url, location.href); } catch (e) { return false; }
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;   // mailto: and tel: go to iOS as usual
    if (!HOME_HOSTS.has(u.hostname) && u.hostname !== location.hostname) return true;
    return SHEET_PATHS.test(u.pathname);
  }

  const Native = {
    isApp,
    // kind: "light" | "medium" | "heavy" | "success" | "warning" | "error"
    haptic(kind) {
      const h = plugin("Haptics");
      if (!h) return;
      if (kind === "success" || kind === "warning" || kind === "error") quiet(h.notification({ type: kind.toUpperCase() }));
      else quiet(h.impact({ style: (kind || "light").toUpperCase() }));
    },
    // Share sheet. Resolves true if shared (or handed to the OS), false if cancelled or unavailable.
    async share({ title, text, url }) {
      const s = plugin("Share");
      if (s) {
        try { await s.share({ title, text, url, dialogTitle: title }); return true; }
        catch (e) { return false; }   // cancelled
      }
      if (navigator.share) {
        try { await navigator.share({ title, text, url }); return true; }
        catch (e) { if (e && e.name === "AbortError") return false; }
      }
      return null;   // nothing to share with: caller copies instead
    },
    canShare() { return !!(plugin("Share") || navigator.share); },
    // Go to a URL: other sites (Stripe, Terms...) in the in-app browser, Parcade pages in the app itself
    open(url) {
      const b = plugin("Browser");
      if (b && opensInSheet(url)) {
        quiet(b.open({ url: new URL(url, location.href).href, presentationStyle: "popover" }));
        return;
      }
      location.href = url;
    }
  };
  window.Native = Native;
  if (!isApp) return;

  // Tapped links: same rule as Native.open
  document.addEventListener("click", e => {
    if (e.defaultPrevented || e.button) return;
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || !opensInSheet(a.href)) return;
    e.preventDefault();
    Native.open(a.href);
  }, true);
  const winOpen = window.open;
  window.open = function (url) {
    if (url && opensInSheet(url)) { Native.open(url); return null; }
    return winOpen.apply(window, arguments);
  };

  // Status bar text follows the theme: light text on dark, dark text in light mode
  const syncBar = () => {
    const sb = plugin("StatusBar");
    if (sb) quiet(sb.setStyle({ style: document.documentElement.getAttribute("data-theme") === "light" ? "LIGHT" : "DARK" }));
  };
  syncBar();
  document.addEventListener("parcade-theme", syncBar);
  new MutationObserver(syncBar).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // Splash goes as soon as the page is up
  const hideSplash = () => { const s = plugin("SplashScreen"); if (s) quiet(s.hide({ fadeOutDuration: 200 })); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hideSplash, { once: true });
  else hideSplash();
})();
