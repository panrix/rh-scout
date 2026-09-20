/* SCOUT costume demo v2 - hard-coded lookups only. No live APIs. */

(function () {
  "use strict";

  /** Demo catalogue. Keys are tickers; also matchable via short CA suffixes. */
  const DEMOS = {
    DEED: {
      ticker: "DEED",
      ca: "0xdeed00000000000000000000000000000000a1",
      verdict: "soft",
      verdictLabel: "soft",
      fact: "Partial hook. Bond lag ~4h behind official.",
    },
    SUPER: {
      ticker: "SUPER",
      ca: "0x5upe20000000000000000000000000000000b2",
      verdict: "hooked",
      verdictLabel: "hooked",
      fact: "Matched official CA. Bond live.",
    },
    SKIP: {
      ticker: "SKIP",
      ca: "0x5k1p00000000000000000000000000000000c3",
      verdict: "skip",
      verdictLabel: "skip",
      fact: "No hook. Not on the official list.",
    },
  };

  const form = document.getElementById("scout-form");
  const input = document.getElementById("ca");
  const receipt = document.getElementById("receipt");
  const tickerEl = document.getElementById("receipt-ticker");
  const verdictEl = document.getElementById("receipt-verdict");
  const factEl = document.getElementById("receipt-fact");
  const awakeToggle = document.getElementById("awake-toggle");
  const awakeLabel = document.getElementById("awake-label");

  function normalize(raw) {
    return String(raw || "")
      .trim()
      .replace(/^\$/, "")
      .toUpperCase();
  }

  function resolve(raw) {
    const n = normalize(raw);
    if (!n) return null;

    if (DEMOS[n]) return DEMOS[n];

    // Accept pasted demo CAs (full or truncated)
    for (const key of Object.keys(DEMOS)) {
      const d = DEMOS[key];
      const ca = d.ca.toUpperCase();
      if (n === ca || ca.startsWith(n) || n.startsWith(ca.slice(0, 10))) {
        return d;
      }
    }

    // Free-text containing ticker token
    for (const key of Object.keys(DEMOS)) {
      if (n.includes(key)) return DEMOS[key];
    }

    return null;
  }

  function showReceipt(demo) {
    tickerEl.textContent = "$" + demo.ticker;
    verdictEl.textContent = demo.verdictLabel;
    verdictEl.className = "receipt-verdict is-" + demo.verdict;
    factEl.textContent = demo.fact;
    receipt.hidden = false;
  }

  function showUnknown(raw) {
    const short = String(raw || "").trim();
    tickerEl.textContent = short ? truncate(short) : "-";
    verdictEl.textContent = "unknown";
    verdictEl.className = "receipt-verdict";
    verdictEl.style.color = "var(--fg-4)";
    factEl.textContent = "Try DEED, SUPER, or SKIP. This demo has three lookups.";
    receipt.hidden = false;
  }

  function truncate(s) {
    if (s.length <= 14) return s;
    return s.slice(0, 6) + "..." + s.slice(-4);
  }

  function scout() {
    const raw = input.value;
    const demo = resolve(raw);
    // reset unknown color override
    verdictEl.style.color = "";
    if (demo) {
      showReceipt(demo);
    } else if (normalize(raw)) {
      showUnknown(raw);
    } else {
      receipt.hidden = true;
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    scout();
  });

  document.querySelectorAll(".try-link").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const key = btn.getAttribute("data-demo");
      const demo = DEMOS[key];
      if (!demo) return;
      input.value = demo.ca;
      input.focus();
      showReceipt(demo);
    });
  });


  // Deep-link: #DEED | #SUPER | #SKIP
  function applyHash() {
    const key = normalize((location.hash || "").replace(/^#/, ""));
    if (DEMOS[key]) {
      input.value = DEMOS[key].ca;
      showReceipt(DEMOS[key]);
    }
  }
  window.addEventListener("hashchange", applyHash);
  applyHash();

  awakeToggle.addEventListener("click", function () {
    const on = awakeToggle.getAttribute("aria-pressed") === "true";
    const next = !on;
    awakeToggle.setAttribute("aria-pressed", String(next));
    awakeLabel.textContent = next ? "on" : "off";
  });
})();
