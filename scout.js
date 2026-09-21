/* SCOUT — live book lookup via same-origin prefix shards. */

(function () {
  "use strict";

  /** Demo catalogue kept as fallback for costume keys only. */
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

  const HOLE = "Not in book yet — not seen since book start.";

  const form = document.getElementById("scout-form");
  const input = document.getElementById("ca");
  const receipt = document.getElementById("receipt");
  const tickerEl = document.getElementById("receipt-ticker");
  const verdictEl = document.getElementById("receipt-verdict");
  const factEl = document.getElementById("receipt-fact");
  const awakeToggle = document.getElementById("awake-toggle");
  const awakeLabel = document.getElementById("awake-label");

  let metaBuiltAt = "";
  let metaPromise = null;
  const shardCache = Object.create(null);

  function ensureMeta() {
    if (metaPromise) return metaPromise;
    metaPromise = fetch("/data/meta.json", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("meta " + r.status);
        return r.json();
      })
      .then(function (m) {
        metaBuiltAt = (m && m.built_at) || String(Date.now());
        return metaBuiltAt;
      })
      .catch(function () {
        metaBuiltAt = String(Date.now());
        metaPromise = null;
        return metaBuiltAt;
      });
    return metaPromise;
  }

  function normalizeCa(raw) {
    var s = String(raw || "").trim().toLowerCase();
    if (!s) return null;
    if (!s.startsWith("0x")) s = "0x" + s;
    if (!/^0x[0-9a-f]{40}$/.test(s)) return null;
    return s;
  }

  function demoKey(raw) {
    var n = String(raw || "")
      .trim()
      .replace(/^\$/, "")
      .toUpperCase();
    if (DEMOS[n]) return n;
    for (var key of Object.keys(DEMOS)) {
      var ca = DEMOS[key].ca.toUpperCase();
      if (n === ca || (n.length >= 10 && (ca.startsWith(n) || n.startsWith(ca.slice(0, 10))))) {
        return key;
      }
      if (n.includes(key)) return key;
    }
    return null;
  }

  function verdictFromRow(row) {
    var look = String((row && row.official_ca_look) || "")
      .trim()
      .toUpperCase();
    var real = String((row && row.real_look) || "")
      .trim()
      .toUpperCase();
    if (look === "MATCH") return { verdict: "hooked", label: "hooked" };
    if (look === "MISMATCH") return { verdict: "skip", label: "skip" };
    if (look === "ABSENT" || look === "NONE" || !look) {
      if (real === "YES") return { verdict: "soft", label: "soft" };
      return { verdict: "skip", label: "skip" };
    }
    return { verdict: "soft", label: "soft" };
  }

  function labelFromRow(row, ca) {
    var d = (row && row.domain) || "";
    var x = (row && row.x_handle) || "";
    if (d && d !== "pbs.twimg.com" && d !== "x.com" && d !== "twitter.com") {
      return d.replace(/^www\./, "");
    }
    if (x) return "@" + String(x).replace(/^@/, "");
    return truncate(ca);
  }

  function fmtUsd(n) {
    if (n == null || n === "" || isNaN(Number(n))) return null;
    var v = Number(n);
    if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
    if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "k";
    return "$" + v.toFixed(0);
  }

  function factFromRow(row) {
    var parts = [];
    var fdv = fmtUsd(row.fdv_usd);
    if (fdv) parts.push("FDV " + fdv);
    if (row.distinct_buyers != null) parts.push(row.distinct_buyers + " buyers");
    var vol = fmtUsd(row.minute1_usd_volume);
    if (vol) parts.push("1m " + vol);
    var links = [];
    if (row.domain) links.push(row.domain);
    if (row.x_handle) links.push("@" + String(row.x_handle).replace(/^@/, ""));
    if (links.length) parts.push(links.join(" · "));
    if (row.real_why) parts.push(String(row.real_why));
    else if (Array.isArray(row.reasons) && row.reasons.length) {
      parts.push(String(row.reasons[0]));
    }
    if (row.official_ca_look) {
      parts.push("official: " + String(row.official_ca_look));
    }
    return parts.length ? parts.join(" · ") : "In book. Limited public fields.";
  }

  function truncate(s) {
    s = String(s || "");
    if (s.length <= 14) return s;
    return s.slice(0, 6) + "..." + s.slice(-4);
  }

  function showReceipt(card) {
    tickerEl.textContent = card.ticker;
    verdictEl.textContent = card.verdictLabel;
    verdictEl.className = "receipt-verdict is-" + card.verdict;
    verdictEl.style.color = "";
    factEl.textContent = card.fact;
    receipt.hidden = false;
  }

  function showHole(ca) {
    tickerEl.textContent = truncate(ca);
    verdictEl.textContent = "unknown";
    verdictEl.className = "receipt-verdict";
    verdictEl.style.color = "var(--fg-4)";
    factEl.textContent = HOLE;
    receipt.hidden = false;
  }

  function showInvalid() {
    tickerEl.textContent = "-";
    verdictEl.textContent = "invalid";
    verdictEl.className = "receipt-verdict";
    verdictEl.style.color = "var(--fg-4)";
    factEl.textContent = "Paste a 0x + 40 hex CA (or try DEED / SUPER / SKIP).";
    receipt.hidden = false;
  }

  function fetchShard(prefix, bust) {
    var key = prefix + "|" + bust;
    if (shardCache[key]) return shardCache[key];
    var url = "/data/ca/" + prefix + ".json?t=" + encodeURIComponent(bust);
    shardCache[key] = fetch(url, { cache: "no-store" })
      .then(function (r) {
        if (r.status === 404) return {};
        if (!r.ok) throw new Error("shard " + r.status);
        return r.json();
      })
      .catch(function (err) {
        delete shardCache[key];
        throw err;
      });
    return shardCache[key];
  }

  function scoutBook(ca) {
    var prefix = ca.slice(2, 4);
    factEl.textContent = "Looking up…";
    receipt.hidden = false;
    tickerEl.textContent = truncate(ca);
    verdictEl.textContent = "…";
    verdictEl.className = "receipt-verdict";
    verdictEl.style.color = "var(--fg-4)";

    return ensureMeta()
      .then(function (bust) {
        return fetchShard(prefix, bust);
      })
      .then(function (map) {
        var row = map && map[ca];
        if (!row) {
          showHole(ca);
          return;
        }
        var v = verdictFromRow(row);
        showReceipt({
          ticker: labelFromRow(row, ca),
          verdict: v.verdict,
          verdictLabel: v.label,
          fact: factFromRow(row),
        });
      })
      .catch(function () {
        tickerEl.textContent = truncate(ca);
        verdictEl.textContent = "error";
        verdictEl.className = "receipt-verdict";
        verdictEl.style.color = "var(--fg-4)";
        factEl.textContent = "Index unavailable — try again in a moment.";
        receipt.hidden = false;
      });
  }

  function scout() {
    var raw = input.value;
    var ca = normalizeCa(raw);
    if (ca) {
      scoutBook(ca);
      return;
    }
    var key = demoKey(raw);
    verdictEl.style.color = "";
    if (key) {
      showReceipt(DEMOS[key]);
      return;
    }
    if (String(raw || "").trim()) {
      showInvalid();
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
      var key = btn.getAttribute("data-demo");
      var demo = DEMOS[key];
      if (!demo) return;
      input.value = demo.ca;
      input.focus();
      showReceipt(demo);
    });
  });

  function applyHash() {
    var h = (location.hash || "").replace(/^#/, "");
    var ca = normalizeCa(h);
    if (ca) {
      input.value = ca;
      scoutBook(ca);
      return;
    }
    var key = demoKey(h);
    if (key) {
      input.value = DEMOS[key].ca;
      showReceipt(DEMOS[key]);
    }
  }
  window.addEventListener("hashchange", applyHash);
  applyHash();
  ensureMeta();

  awakeToggle.addEventListener("click", function () {
    var on = awakeToggle.getAttribute("aria-pressed") === "true";
    var next = !on;
    awakeToggle.setAttribute("aria-pressed", String(next));
    awakeLabel.textContent = next ? "on" : "off";
  });
})();
