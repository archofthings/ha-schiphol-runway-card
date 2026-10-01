(function() {
  "use strict";

  var VERSION = "1.0.3";

  // Collapsible console banner (expand to see details)
  console.groupCollapsed(
    "%c \u2708 SCHIPHOL RUNWAY CARD %c v" + VERSION + " ",
    "color:#fff;background:#21d669;font-weight:700;padding:3px 8px;border-radius:6px 0 0 6px",
    "color:#fff;background:#3ba5ff;font-weight:700;padding:3px 8px;border-radius:0 6px 6px 0"
  );
  console.info("Live Schiphol runway usage map with peak indicators");
  console.info("https://github.com/archofthings/ha-schiphol-runway-card");
  console.info("https://github.com/archofthings/ha-schiphol-runway-monitor");
  console.groupEnd();

  // ---- Defaults (HA color tokens; every option has a default) ----
  var DEFAULTS = {
    title:              "Schiphol Runways",
    inbound_color:      "green",
    outbound_color:     "blue",
    background_image:   "https://cdn.jsdelivr.net/gh/archofthings/ha-Schiphol-Runway-card@main/www/schiphol_sat.png",
    background_opacity: 0.55,
    show_chips:         true,
  };

  var RUNWAYS = [
    { key: "18r_36l_polderbaan",      designator: "18R/36L", name: "Polderbaan",
      line: [23.0,13.0, 21.1,46.7], labels: [["18R",29.2,16.3],["36L",14.9,43.5]] },
    { key: "18c_36c_zwanenburgbaan",  designator: "18C/36C", name: "Zwanenburgbaan",
      line: [40.0,44.0, 38.3,73.2], labels: [["18C",46.2,47.2],["36C",32.1,70.0]] },
    // 09/27 and 04/22 were named the wrong way round before integration v1.7.0;
    // "legacy" is the old key / entity suffix, still accepted for existing installs.
    { key: "09_27_buitenveldertbaan", designator: "09/27",   name: "Buitenveldertbaan", legacy: "09_27_oostbaan",
      line: [43.7,58.6, 74.4,56.8], labels: [["09",46.3,52.1],["27",71.9,63.3]] },
    { key: "18l_36r_aalsmeerbaan",    designator: "18L/36R", name: "Aalsmeerbaan",
      line: [64.2,54.0, 62.5,84.1], labels: [["18L",70.4,57.2],["36R",56.3,80.9]] },
    { key: "06_24_kaagbaan",          designator: "06/24",   name: "Kaagbaan",
      line: [36.4,87.0, 62.6,70.5], labels: [["06",35.5,80.1],["24",63.6,77.4]] },
    { key: "04_22_oostbaan",          designator: "04/22",   name: "Oostbaan", legacy: "04_22_buitenveldertbaan",
      line: [66.2,74.6, 78.9,60.2], labels: [["04",63.4,68.2],["22",81.8,66.6]] },
  ];

  function defaultEntity(key) { return "sensor.schiphol_airport_eham_" + key; }

  // Explicit config (new or legacy key) wins; otherwise prefer the new default
  // entity ID and fall back to the legacy one if only that exists.
  function resolveEntity(rwy, ents, states) {
    if (ents[rwy.key]) return ents[rwy.key];
    if (rwy.legacy && ents[rwy.legacy]) return ents[rwy.legacy];
    var def = defaultEntity(rwy.key);
    if (rwy.legacy && states && !states[def] && states[defaultEntity(rwy.legacy)]) {
      return defaultEntity(rwy.legacy);
    }
    return def;
  }

  var DEFAULT_PEAK = {
    inbound:  "binary_sensor.schiphol_airport_eham_inbound_peak",
    outbound: "binary_sensor.schiphol_airport_eham_outbound_peak",
    peak:     "sensor.schiphol_airport_eham_peak_time",
  };

  var SPRITES = {
    "04":  { "in":[61.6,79.9,41.2],   "out":[83.5,54.9,41.2] },
    "22":  { "in":[83.5,54.9,-138.8], "out":[61.6,79.9,-138.8] },
    "06":  { "in":[30.5,90.7,57.8],   "out":[68.6,66.7,57.8] },
    "24":  { "in":[68.6,66.7,-122.2], "out":[30.5,90.7,-122.2] },
    "09":  { "in":[36.7,59.0,86.7],   "out":[81.4,56.4,86.7] },
    "27":  { "in":[81.4,56.4,-93.3],  "out":[36.7,59.0,-93.3] },
    "18C": { "in":[40.4,37.0,-176.8], "out":[37.9,80.2,-176.8] },
    "36C": { "in":[37.9,80.2,3.2],    "out":[40.4,37.0,3.2] },
    "18L": { "in":[64.6,47.0,-176.8], "out":[62.1,91.1,-176.8] },
    "36R": { "in":[62.1,91.1,3.2],    "out":[64.6,47.0,3.2] },
    "18R": { "in":[23.4,6.0,-176.8],  "out":[20.7,53.7,-176.8] },
    "36L": { "in":[20.7,53.7,3.2],    "out":[23.4,6.0,3.2] },
  };

  var AIRCRAFT_PATH = "M7.741,73.725l1.97-1.934l24.958-11.578l10.188-1.619v11.047c0,4.351,1.765,12.568,1.765,12.568"
    + "l-10.285,8.219c0,0-1.148,0.744-1.148,1.85v3.082l12.388-3.506v1.982c0,0.289,0.358,0.375,0.749,0.375"
    + "c0.568,1.922,1.68,5.789,1.68,5.789l1.667-5.789c0.406,0,0.763-0.098,0.763-0.375v-1.982l12.375,3.506v-3.082"
    + "c0-1.104-1.136-1.85-1.136-1.85l-10.298-8.219c0,0,1.766-8.219,1.766-12.568V58.594l10.188,1.619l24.958,11.578l1.97,1.934v-2.248"
    + "c0-1.727-1.445-4.004-2.345-4.797c-0.897-0.796-25.149-19.833-25.149-19.833s0.446-1.195,0.446-1.765c0-0.57,0-0.762,0-0.762h0.397"
    + "c0.328,0,0.363-1.16,0.363-1.16v-4.242c0-1.088-0.207-1.522-0.604-1.522h-3.929c-0.414,0-0.494,1.136-0.494,1.136v5.294"
    + "c0,0-5.851-3.742-5.851-5.427V16.22c0-3.415-2.368-16.22-5.101-16.22c-2.731,0-5.007,13.04-5.088,16.22v22.178"
    + "c0,1.685-5.85,5.33-5.85,5.33V38.53c0,0-0.081-1.136-0.496-1.136h-3.916c-0.397,0-0.604,0.435-0.604,1.522v4.242"
    + "c0,0,0.035,1.16,0.363,1.16h0.387c0,0,0,0.191,0,0.762c0,0.569,0.447,1.765,0.447,1.765S10.984,65.885,10.086,66.68"
    + "c-0.898,0.793-2.345,3.07-2.345,4.797V73.725z";

  // ---- color helpers (HA color token -> CSS) ----
  function colorVar(token) {
    if (!token) return "var(--primary-color)";
    if (token === "primary")  return "var(--primary-color)";
    if (token === "accent")   return "var(--accent-color)";
    if (token === "disabled") return "var(--disabled-color)";
    return "var(--" + token + "-color, var(--primary-color))";
  }
  function tint(cssColor, pct) {
    return "color-mix(in srgb, " + cssColor + " " + pct + "%, transparent)";
  }

  // ---- peak window helpers ----
  function hm(str) {
    var a = (str || "").trim().split(":");
    if (a.length !== 2) return null;
    return parseInt(a[0], 10) * 60 + parseInt(a[1], 10);
  }
  function currentWindowEnd(windows) {
    if (!windows || !windows.length) return null;
    var now = new Date();
    var cur = now.getHours() * 60 + now.getMinutes();
    for (var i = 0; i < windows.length; i++) {
      var p = (windows[i] || "").split(" - ");
      if (p.length !== 2) continue;
      var s = hm(p[0]), e = hm(p[1]);
      if (s === null || e === null) continue;
      var inWin = (e < s) ? (cur >= s || cur <= e) : (cur >= s && cur <= e);
      if (inWin) return p[1].trim();
    }
    return null;
  }
  function peakField(pkEnt, field) {
    if (!pkEnt || !pkEnt.attributes || !pkEnt.attributes.all_peaks) return [];
    return pkEnt.attributes.all_peaks
      .map(function(p) { return p && p[field] ? p[field] : ""; })
      .filter(function(s) { return s && s.trim(); });
  }

  // ============================================================
  // Card
  // ============================================================
  if (!customElements.get("schiphol-runway-card")) {
    class SchipholRunwayCard extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this._hass = null;
        this._rendered = false;
        this._config = {};
      }

      setConfig(config) {
        this._config = Object.assign({}, DEFAULTS, config || {});
        var ents = (config && config.entities) || {};
        this._ents = ents;
        this._resolveAll();
        this._peakIn  = this._config.inbound_peak_entity  || DEFAULT_PEAK.inbound;
        this._peakOut = this._config.outbound_peak_entity || DEFAULT_PEAK.outbound;
        this._peakAll = this._config.peak_entity          || DEFAULT_PEAK.peak;

        var inC = colorVar(this._config.inbound_color);
        var outC = colorVar(this._config.outbound_color);
        this._inC = inC; this._outC = outC;
        this._colors = {
          not_in_use: { line: "var(--disabled-text-color,#9aa5b1)", active:false, text:"not in use" },
          inbound:    { line: inC,  active:true, text:"landing" },
          outbound:   { line: outC, active:true, text:"takeoff" },
        };

        this._rendered = false;
        this._ensureRendered();
        this._safeUpdate();
      }

      set hass(hass) { this._hass = hass; this._ensureRendered(); this._safeUpdate(); }

      connectedCallback() {
        this._ensureRendered();
        this._safeUpdate();
        if (!this._timer) {
          var self = this;
          this._timer = setInterval(function(){ self._safeUpdate(); }, 5000);
        }
      }
      disconnectedCallback() { if (this._timer) { clearInterval(this._timer); this._timer = null; } }

      _ensureRendered() {
        if (this._rendered) return;
        try { this._render(); this._rendered = true; }
        catch(e) { console.error("[SchipholCard] render FAILED:", e); }
      }
      _safeUpdate() {
        if (!this._rendered || !this._hass) return;
        try { this._update(); } catch(e) { console.error("[SchipholCard] update FAILED:", e); }
      }

      getCardSize() { return 6; }

      _moreInfo(entityId) {
        if (!entityId) return;
        this.dispatchEvent(new CustomEvent("hass-more-info", {
          detail: { entityId: entityId }, bubbles: true, composed: true
        }));
      }

      _render() {
        var svgRunways = RUNWAYS.map(function(rwy) {
          var L = rwy.line;
          var labels = rwy.labels.map(function(lab, idx) {
            return '<text id="rl' + (idx === 0 ? "a" : "b") + '-' + rwy.key + '"'
              + ' x="' + lab[1] + '" y="' + lab[2] + '"'
              + ' style="fill:var(--secondary-text-color,#888)" font-family="monospace"'
              + ' font-size="3.2" font-weight="700" text-anchor="middle">' + lab[0] + '</text>';
          }).join("");
          return '<g>'
            + '<line id="rl-' + rwy.key + '"'
            + ' x1="' + L[0] + '" y1="' + L[1] + '" x2="' + L[2] + '" y2="' + L[3] + '"'
            + ' stroke-linecap="round"'
            + ' style="stroke:var(--disabled-text-color,#9aa5b1);stroke-width:1.4;transition:stroke .5s,stroke-width .5s,filter .5s"/>'
            + labels
            + '<use id="spin-' + rwy.key + '" href="#ac-sprite" style="display:none"/>'
            + '<use id="spout-' + rwy.key + '" href="#ac-sprite" style="display:none"/>'
            + '</g>';
        }).join("");

        var chipHTML = RUNWAYS.map(function(rwy) {
          return '<div class="chip" id="ch-' + rwy.key + '" title="Show details">'
            + '<div class="cdes">' + rwy.designator + '</div>'
            + '<div class="cnm">' + rwy.name + '</div>'
            + '<div class="cst" id="cs-' + rwy.key + '">--</div>'
            + '<div class="chdg" id="cd-' + rwy.key + '"></div>'
            + '</div>';
        }).join("");

        var bg = this._config.background_image;
        var bgEl = bg
          ? '<image href="' + bg + '" x="0" y="0" width="100" height="100"'
            + ' preserveAspectRatio="xMidYMid slice" opacity="' + this._config.background_opacity + '"/>'
          : '';

        this.shadowRoot.innerHTML = '<style>'
          + ':host{display:block;container-type:inline-size}'
          + '.card{background:var(--ha-card-background,var(--card-background-color,#fff));'
          +   'border-radius:var(--ha-card-border-radius,12px);'
          +   'border:1px solid var(--ha-card-border-color,var(--divider-color,#e0e0e0));'
          +   'box-shadow:var(--ha-card-box-shadow,none);'
          +   'overflow:hidden;font-family:var(--paper-font-body1_-_font-family,system-ui,sans-serif);'
          +   'color:var(--primary-text-color,#212121)}'
          + '.hdr{display:flex;justify-content:space-between;align-items:center;padding:10px 14px 4px}'
          + '.ttl{font-size:var(--ha-card-header-font-size,15px);font-weight:500}'
          + '.upd{font-size:11px;color:var(--secondary-text-color,#727272)}'
          + '.map{padding:2px 6px 0;background:transparent}'
          + 'svg{display:block;width:100%;height:auto;border-radius:8px}'
          + '.chips{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:6px 8px 4px}'
          + '.chip{background:var(--secondary-background-color,#f5f5f5);'
          +   'border:1px solid var(--divider-color,#e0e0e0);border-radius:8px;padding:6px 8px;'
          +   'cursor:pointer;transition:background .4s,border-color .4s}'
          + '.chip:hover{filter:brightness(1.08)}'
          + '.cdes{font-size:11px;font-weight:700;font-family:monospace;color:var(--primary-text-color,#212121)}'
          + '.cnm{font-size:8px;color:var(--secondary-text-color,#727272);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}'
          + '.cst{font-size:9px;font-weight:600;color:var(--secondary-text-color,#888);margin-top:2px}'
          + '.chdg{font-size:8px;font-family:monospace;color:var(--secondary-text-color,#999)}'
          + '@container (max-width:359px){.chips{grid-template-columns:repeat(2,1fr)}.cnm,.chdg{display:none}.peaks{flex-direction:column}}'
          + '.peaks{display:flex;gap:6px;padding:0 8px 8px}'
          + '.pb{flex:1;display:flex;align-items:center;gap:6px;background:var(--secondary-background-color,#f5f5f5);'
          +   'border:1px solid var(--divider-color,#e0e0e0);border-radius:8px;padding:6px 10px;cursor:pointer;transition:background .4s,border-color .4s}'
          + '.pb:hover{filter:brightness(1.08)}'
          + '.pi{font-size:16px;line-height:1}'
          + '.pt{flex:1}'
          + '.pl{font-size:10px;color:var(--secondary-text-color,#727272);display:block}'
          + '.pv{font-size:10px;font-weight:700;color:var(--secondary-text-color,#888)}'
          + '</style>'
          + '<div class="card">'
          +   '<div class="hdr"><span class="ttl">' + this._config.title + '</span><span class="upd" id="upd"></span></div>'
          +   '<div class="map"><svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'
          +     '<defs><g id="ac-sprite"><path transform="scale(0.085) translate(-50,-50)" d="' + AIRCRAFT_PATH + '"/></g></defs>'
          +     bgEl
          +     svgRunways
          +     '<g transform="translate(8,92)">'
          +       '<circle r="4" fill="none" stroke="var(--divider-color,#ccc)" stroke-width="0.4"/>'
          +       '<text x="0" y="-1" text-anchor="middle" font-size="2.6" fill="var(--secondary-text-color,#888)" font-weight="bold">N</text>'
          +       '<line x1="0" y1="-3.4" x2="0" y2="-1" stroke="var(--secondary-text-color,#888)" stroke-width="0.6"/>'
          +     '</g>'
          +   '</svg></div>'
          +   (this._config.show_chips !== false ? '<div class="chips">' + chipHTML + '</div>' : '')
          +   (this._config.show_chips !== false
              ? '<div class="peaks">'
              +   '<div class="pb" id="pb-in"><span class="pi">&#8595;</span><div class="pt"><span class="pl">Inbound peak</span><span class="pv" id="pv-in">--</span></div></div>'
              +   '<div class="pb" id="pb-out"><span class="pi">&#8593;</span><div class="pt"><span class="pl">Outbound peak</span><span class="pv" id="pv-out">--</span></div></div>'
              + '</div>'
              : '')
          + '</div>';

        // Click handlers: chips + peak badges open more-info
        var self = this;
        var chips = this.shadowRoot.querySelector(".chips");
        if (chips) {
          chips.addEventListener("click", function(e) {
            var chip = e.target.closest(".chip");
            if (!chip) return;
            self._moreInfo(self._resolved[chip.id.replace("ch-", "")]);
          });
        }
        var pbIn = this.shadowRoot.getElementById("pb-in");
        var pbOut = this.shadowRoot.getElementById("pb-out");
        if (pbIn)  pbIn.addEventListener("click",  function(){ self._moreInfo(self._peakIn); });
        if (pbOut) pbOut.addEventListener("click", function(){ self._moreInfo(self._peakOut); });
      }

      _resolveAll() {
        var states = this._hass ? this._hass.states : null;
        this._resolved = {};
        for (var i = 0; i < RUNWAYS.length; i++) {
          this._resolved[RUNWAYS[i].key] = resolveEntity(RUNWAYS[i], this._ents, states);
        }
      }

      _update() {
        var states = this._hass.states;
        this._resolveAll();
        var sr = this.shadowRoot;
        var C = this._colors;
        var inColor = this._inC, outColor = this._outC;

        var upd = sr.getElementById("upd");
        if (upd) { var t = new Date(); upd.textContent = ("0"+t.getHours()).slice(-2)+":"+("0"+t.getMinutes()).slice(-2); }

        for (var i = 0; i < RUNWAYS.length; i++) {
          var rwy = RUNWAYS[i];
          var entity = states[this._resolved[rwy.key]];
          var state = (entity && entity.state) ? entity.state : "not_in_use";
          var attrs = (entity && entity.attributes) ? entity.attributes : {};
          var col = C[state] || C.not_in_use;

          var line = sr.getElementById("rl-" + rwy.key);
          if (line) {
            line.style.stroke = col.line;
            line.style.strokeWidth = col.active ? "2" : "1.4";
            line.style.filter = col.active ? "drop-shadow(0 0 1.2px " + col.line + ")" : "none";
          }
          var labelFill = col.active ? col.line : "var(--secondary-text-color,#888)";
          var rla = sr.getElementById("rla-" + rwy.key);
          var rlb = sr.getElementById("rlb-" + rwy.key);
          if (rla) rla.style.fill = labelFill;
          if (rlb) rlb.style.fill = labelFill;

          var spin  = sr.getElementById("spin-" + rwy.key);
          var spout = sr.getElementById("spout-" + rwy.key);
          var lh = attrs.landing_heading, th = attrs.takeoff_heading;
          if (spin) {
            if (lh && SPRITES[lh] && SPRITES[lh]["in"]) {
              var t1 = SPRITES[lh]["in"];
              spin.setAttribute("transform", "translate(" + t1[0] + "," + t1[1] + ") rotate(" + t1[2] + ")");
              spin.style.fill = inColor;
              spin.style.display = "";
            } else spin.style.display = "none";
          }
          if (spout) {
            if (th && SPRITES[th] && SPRITES[th]["out"]) {
              var t2 = SPRITES[th]["out"];
              spout.setAttribute("transform", "translate(" + t2[0] + "," + t2[1] + ") rotate(" + t2[2] + ")");
              spout.style.fill = outColor;
              spout.style.display = "";
            } else spout.style.display = "none";
          }

          var chip = sr.getElementById("ch-" + rwy.key);
          if (chip) {
            if (col.active) {
              chip.style.background = tint(col.line, 16);
              chip.style.borderColor = tint(col.line, 55);
            } else { chip.style.background = ""; chip.style.borderColor = ""; }
          }
          var cs = sr.getElementById("cs-" + rwy.key);
          if (cs) { cs.textContent = col.text; cs.style.color = col.active ? col.line : "var(--secondary-text-color,#888)"; }

          var cd = sr.getElementById("cd-" + rwy.key);
          if (cd) {
            var parts = [];
            if (attrs.landing_heading) parts.push(attrs.landing_heading);
            if (attrs.takeoff_heading) parts.push(attrs.takeoff_heading);
            cd.textContent = parts.length ? "HDG " + parts.join("/") : "";
            cd.style.color = col.active ? col.line : "var(--secondary-text-color,#999)";
          }
        }

        var inEnt = states[this._peakIn], outEnt = states[this._peakOut], pkEnt = states[this._peakAll];
        var inOn  = inEnt  && inEnt.state  === "on";
        var outOn = outEnt && outEnt.state === "on";

        var pbIn = sr.getElementById("pb-in"), pbOut = sr.getElementById("pb-out");
        var pvIn = sr.getElementById("pv-in"), pvOut = sr.getElementById("pv-out");

        if (pbIn) {
          if (inOn) { pbIn.style.background = tint(inColor,16); pbIn.style.borderColor = tint(inColor,55); }
          else { pbIn.style.background = ""; pbIn.style.borderColor = ""; }
        }
        if (pbOut) {
          if (outOn) { pbOut.style.background = tint(outColor,16); pbOut.style.borderColor = tint(outColor,55); }
          else { pbOut.style.background = ""; pbOut.style.borderColor = ""; }
        }

        if (pvIn) {
          if (inOn) {
            var inList = (inEnt && inEnt.attributes && inEnt.attributes.all_inbound_peaks) || peakField(pkEnt, "inbound");
            var endIn = currentWindowEnd(inList);
            pvIn.textContent = endIn ? "until " + endIn : "active";
            pvIn.style.color = inColor;
          } else {
            var ni = (inEnt && inEnt.attributes && inEnt.attributes.next_inbound_peak)
                  || (pkEnt && pkEnt.attributes && pkEnt.attributes.next_inbound_peak);
            pvIn.textContent = ni ? "next " + ni : "no peak";
            pvIn.style.color = "";
          }
        }
        if (pvOut) {
          if (outOn) {
            var outList = (outEnt && outEnt.attributes && outEnt.attributes.all_outbound_peaks) || peakField(pkEnt, "outbound");
            var endOut = currentWindowEnd(outList);
            pvOut.textContent = endOut ? "until " + endOut : "active";
            pvOut.style.color = outColor;
          } else {
            var no = (outEnt && outEnt.attributes && outEnt.attributes.next_outbound_peak)
                  || (pkEnt && pkEnt.attributes && pkEnt.attributes.next_outbound_peak);
            pvOut.textContent = no ? "next " + no : "no peak";
            pvOut.style.color = "";
          }
        }
      }

      static getConfigElement() { return document.createElement("schiphol-runway-card-editor"); }
      static getStubConfig() {
        var ents = {};
        for (var i = 0; i < RUNWAYS.length; i++) ents[RUNWAYS[i].key] = defaultEntity(RUNWAYS[i].key);
        return Object.assign({ type: "custom:schiphol-runway-card", entities: ents }, DEFAULTS);
      }
    }
    customElements.define("schiphol-runway-card", SchipholRunwayCard);
  }

  // ============================================================
  // Editor (ha-form with native selectors incl. ui_color)
  // ============================================================
  var SCHEMA = [
    { name: "title",            selector: { text: {} } },
    { name: "background_image", selector: { text: {} } },
    { type: "grid", name: "", schema: [
      { name: "inbound_color",  selector: { ui_color: {} } },
      { name: "outbound_color", selector: { ui_color: {} } },
    ]},
    { type: "grid", name: "", schema: [
      { name: "background_opacity", selector: { number: { min: 0, max: 1, step: 0.05, mode: "slider" } } },
      { name: "show_chips",         selector: { boolean: {} } },
    ]},
  ];
  RUNWAYS.forEach(function(r) {
    SCHEMA.push({ name: "e_" + r.key, selector: { entity: { domain: ["sensor", "binary_sensor"] } } });
  });

  var LABELS = {
    title:              "Card title",
    background_image:   "Background image URL",
    inbound_color:      "Landing color",
    outbound_color:     "Takeoff color",
    background_opacity: "Background opacity",
    show_chips:         "Show runway chips",
  };

  function computeLabel(schema) {
    if (!schema.name) return "";
    if (LABELS[schema.name]) return LABELS[schema.name];
    for (var i = 0; i < RUNWAYS.length; i++) {
      if ("e_" + RUNWAYS[i].key === schema.name) {
        return RUNWAYS[i].designator + "  " + RUNWAYS[i].name;
      }
    }
    return schema.name;
  }

  if (!customElements.get("schiphol-runway-card-editor")) {
    class SchipholRunwayCardEditor extends HTMLElement {
      constructor() {
        super();
        this._config = {};
        this._hass = null;
        this._built = false;
        this._building = false;
      }

      setConfig(config) {
        this._config = Object.assign({}, DEFAULTS, config || {});
        if (!this._config.entities) this._config.entities = {};
        this._tryBuild();
      }
      set hass(hass) {
        this._hass = hass;
        if (this._form) this._form.hass = hass;
        this._tryBuild();
      }

      _tryBuild() {
        if (!this._hass) return;
        if (this._built) { this._refresh(); return; }
        if (this._building) return;
        this._building = true;
        var self = this;
        this._ensureComponents().then(function() { self._build(); self._building = false; });
      }

      _ensureComponents() {
        if (customElements.get("ha-form")) return Promise.resolve();
        if (window.loadCardHelpers) {
          return window.loadCardHelpers().then(function(h) {
            return h.createCardElement({ type: "entities", entities: [] });
          }).then(function(card) {
            if (card && card.constructor && card.constructor.getConfigElement) {
              return card.constructor.getConfigElement();
            }
          }).catch(function(){});
        }
        return Promise.resolve();
      }

      _data() {
        var d = {
          title:              this._config.title,
          background_image:   this._config.background_image,
          background_opacity: this._config.background_opacity,
          inbound_color:      this._config.inbound_color,
          outbound_color:     this._config.outbound_color,
          show_chips:         this._config.show_chips !== undefined ? this._config.show_chips : DEFAULTS.show_chips,
        };
        var ents = this._config.entities || {};
        var states = this._hass ? this._hass.states : null;
        RUNWAYS.forEach(function(r) { d["e_" + r.key] = resolveEntity(r, ents, states); });
        return d;
      }

      _build() {
        this._form = document.createElement("ha-form");
        this._form.hass = this._hass;
        this._form.schema = SCHEMA;
        this._form.computeLabel = computeLabel;
        this._form.data = this._data();
        this._form.addEventListener("value-changed", this._valueChanged.bind(this));
        this.innerHTML = "";
        this.appendChild(this._form);
        this._built = true;
      }

      _refresh() { if (this._form) this._form.data = this._data(); }

      _valueChanged(ev) {
        ev.stopPropagation();
        var v = ev.detail.value || {};
        var cfg = { type: "custom:schiphol-runway-card", entities: {} };

        RUNWAYS.forEach(function(r) {
          var val = v["e_" + r.key];
          if (val) cfg.entities[r.key] = val;
        });
        if (v.title && v.title !== DEFAULTS.title) cfg.title = v.title;
        if (v.background_image) cfg.background_image = v.background_image;
        if (v.background_opacity != null && v.background_opacity !== DEFAULTS.background_opacity) cfg.background_opacity = v.background_opacity;
        if (v.inbound_color && v.inbound_color !== DEFAULTS.inbound_color) cfg.inbound_color = v.inbound_color;
        if (v.outbound_color && v.outbound_color !== DEFAULTS.outbound_color) cfg.outbound_color = v.outbound_color;
        if (v.show_chips !== undefined && v.show_chips !== DEFAULTS.show_chips) cfg.show_chips = v.show_chips;

        this._config = Object.assign({}, DEFAULTS, cfg);
        this.dispatchEvent(new CustomEvent("config-changed", {
          detail: { config: cfg }, bubbles: true, composed: true
        }));
      }
    }
    customElements.define("schiphol-runway-card-editor", SchipholRunwayCardEditor);
  }

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "schiphol-runway-card",
    name: "Schiphol Runway Card",
    description: "Live SVG map of Schiphol runway usage with peak indicators",
    preview: false,
  });

})();
