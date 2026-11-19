/* ==========================================================================
   SnowDay Class — progressive UI enhancements (no dependencies)
   - Lesson bottom tab bar scroll-spy (mobile)
   - Glossary "self-test" mode (hide definitions, tap to reveal)
   - Workspace account menu auto-close + tablist orientation
   - Header elevation on scroll
   Everything here is optional: the app works if this file fails to load.
   ========================================================================== */
(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // 1. Lesson bottom tab bar: highlight the section currently on screen
  // ---------------------------------------------------------------------
  function setupLessonTabbar() {
    const bar = document.getElementById("lesson-tabbar");
    if (!bar || typeof IntersectionObserver === "undefined") return;

    const links = Array.from(bar.querySelectorAll("[data-tabbar-target]"));
    const byId = new Map(links.map((a) => [a.getAttribute("data-tabbar-target"), a]));

    const setCurrent = (id) => {
      links.forEach((a) => {
        if (a.getAttribute("data-tabbar-target") === id) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && byId.has(entry.target.id)) setCurrent(entry.target.id);
        });
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: 0 }
    );

    byId.forEach((_a, id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });

    links.forEach((a) =>
      a.addEventListener("click", () => setCurrent(a.getAttribute("data-tabbar-target")))
    );
  }

  // ---------------------------------------------------------------------
  // 2. Glossary self-test mode
  // ---------------------------------------------------------------------
  function setupGlossarySelfTest() {
    const btn = document.getElementById("glossary-selftest-btn");
    const section = document.getElementById("glossary-section");
    const grid = document.getElementById("glossary-grid");
    const hint = document.getElementById("glossary-selftest-hint");
    if (!btn || !section || !grid) return;

    const isOn = () => section.classList.contains("is-selftest");

    const prepareItems = () => {
      grid.querySelectorAll(".glossary-item").forEach((item) => {
        if (isOn()) {
          item.tabIndex = 0;
          item.setAttribute("aria-expanded", item.classList.contains("is-revealed") ? "true" : "false");
        } else {
          item.removeAttribute("tabindex");
          item.removeAttribute("aria-expanded");
          item.classList.remove("is-revealed");
        }
      });
    };

    btn.addEventListener("click", () => {
      const next = !isOn();
      section.classList.toggle("is-selftest", next);
      btn.setAttribute("aria-pressed", next ? "true" : "false");
      if (hint) hint.hidden = !next;
      prepareItems();
    });

    const reveal = (item) => {
      if (!isOn() || !item) return;
      const open = item.classList.toggle("is-revealed");
      item.setAttribute("aria-expanded", open ? "true" : "false");
    };

    grid.addEventListener("click", (e) => reveal(e.target.closest(".glossary-item")));
    grid.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const item = e.target.closest(".glossary-item");
      if (!item || !isOn()) return;
      e.preventDefault();
      reveal(item);
    });

    // Glossary is re-rendered on language switch / new lesson
    new MutationObserver(prepareItems).observe(grid, { childList: true });
  }

  // ---------------------------------------------------------------------
  // 3. Workspace: account menu + tablist orientation
  // ---------------------------------------------------------------------
  function setupWorkspaceChrome() {
    const menu = document.getElementById("ws-account-menu");
    if (menu) {
      menu.addEventListener("click", (e) => {
        if (!e.target.closest(".ws-menu-item")) return;
        if (typeof menu.hidePopover === "function") {
          try {
            menu.hidePopover();
          } catch (_e) {}
        }
      });
    }

    const tablist = document.getElementById("ws-tablist");
    if (tablist && window.matchMedia) {
      const mq = window.matchMedia("(min-width: 64rem)");
      const sync = () =>
        tablist.setAttribute("aria-orientation", mq.matches ? "vertical" : "horizontal");
      sync();
      if (mq.addEventListener) mq.addEventListener("change", sync);
    }

    // Close any open doc-card overflow menu when clicking elsewhere
    document.addEventListener("click", (e) => {
      document.querySelectorAll("details.ws-doc-more[open]").forEach((d) => {
        if (!d.contains(e.target)) d.open = false;
      });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      document.querySelectorAll("details.ws-doc-more[open]").forEach((d) => {
        d.open = false;
        const s = d.querySelector("summary");
        if (s) s.focus();
      });
    });
  }

  // ---------------------------------------------------------------------
  // 4. Header elevation once the page scrolls
  // ---------------------------------------------------------------------
  function setupHeaderElevation() {
    const header = document.getElementById("site-header");
    if (!header) return;
    let ticking = false;
    const update = () => {
      header.classList.toggle("is-scrolled", window.scrollY > 4);
      ticking = false;
    };
    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
    update();
  }

  // ---------------------------------------------------------------------
  // 5. Theme switch (light / auto / dark), remembered per device
  // ---------------------------------------------------------------------
  function setupThemeSwitch() {
    const btns = Array.from(document.querySelectorAll("[data-theme-btn]"));
    if (!btns.length) return;
    const root = document.documentElement;

    const apply = (mode) => {
      if (mode === "light" || mode === "dark") root.dataset.theme = mode;
      else delete root.dataset.theme;
      btns.forEach((b) => {
        const active = b.getAttribute("data-theme-btn") === (mode || "auto");
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", active ? "true" : "false");
      });
    };

    apply(root.dataset.theme || "auto");

    btns.forEach((b) =>
      b.addEventListener("click", () => {
        const mode = b.getAttribute("data-theme-btn");
        apply(mode);
        try {
          if (mode === "auto") localStorage.removeItem("snowday_theme");
          else localStorage.setItem("snowday_theme", mode);
        } catch (_e) {}
      })
    );
  }

  function init() {
    setupThemeSwitch();
    setupLessonTabbar();
    setupGlossarySelfTest();
    setupWorkspaceChrome();
    setupHeaderElevation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
