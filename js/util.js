/* ==================================================================
   util.js – közös segédfüggvények (dátum, formázás, ablakok, toast)
   A dátumokat mindenhol "ÉÉÉÉ-HH-NN" szövegként tároljuk.
   ================================================================== */
const U = {};

U.NAPOK = ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"];
U.NAPOK_ROVID = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];   // hétfővel kezdve
U.HONAPOK = ["január", "február", "március", "április", "május", "június",
    "július", "augusztus", "szeptember", "október", "november", "december"];

/* ---------- Dátum ---------- */
U.ketJegy = function (n) { return (n < 10 ? "0" : "") + n; };

U.datumStr = function (d) {           // Date → "ÉÉÉÉ-HH-NN" (helyi idő)
    return d.getFullYear() + "-" + U.ketJegy(d.getMonth() + 1) + "-" + U.ketJegy(d.getDate());
};
U.ma = function () { return U.datumStr(new Date()); };
U.most = function () {               // helyi idő "ÉÉÉÉ-HH-NNTÓÓ:PP:MM"
    const d = new Date();
    return U.datumStr(d) + "T" + U.ketJegy(d.getHours()) + ":" + U.ketJegy(d.getMinutes()) + ":" + U.ketJegy(d.getSeconds());
};
U.parse = function (s) {             // "ÉÉÉÉ-HH-NN" → Date (helyi éjfél)
    if (!s) return null;
    const p = s.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
};
U.napHozzaad = function (s, n) {
    const d = U.parse(s); d.setDate(d.getDate() + n); return U.datumStr(d);
};
U.honapHozzaad = function (s, n) {   // mint a VBA DateAdd("m", n, …): hónap végén levág
    const d = U.parse(s);
    const nap = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    const utolso = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(nap, utolso));
    return U.datumStr(d);
};
U.napKulonbseg = function (a, b) {   // b - a napokban
    return Math.round((U.parse(b) - U.parse(a)) / 86400000);
};
U.hetNapja = function (s) { return U.NAPOK[U.parse(s).getDay()]; };
U.datumHu = function (s) {           // "2026.10.18."
    if (!s) return "";
    return s.slice(0, 4) + "." + s.slice(5, 7) + "." + s.slice(8, 10) + ".";
};
U.datumHuHosszu = function (s) {     // "2026. október 18., vasárnap"
    if (!s) return "";
    const d = U.parse(s);
    return d.getFullYear() + ". " + U.HONAPOK[d.getMonth()] + " " + d.getDate() + "., " + U.NAPOK[d.getDay()];
};
U.idopontHu = function (iso) {
    if (!iso) return "";
    return U.datumHu(iso.slice(0, 10)) + " " + iso.slice(11, 16);
};

/* Rugalmas dátum-értelmezés kézi beíráshoz: "2026-10-18", "2026.10.18", "10.18", "18" */
U.datumErtelmez = function (txt, alap) {
    if (!txt) return null;
    txt = String(txt).trim().replace(/\.$/, "");
    let m = txt.match(/^(\d{4})[.\-\/ ]+(\d{1,2})[.\-\/ ]+(\d{1,2})$/);
    let ev, ho, nap;
    const ref = U.parse(alap || U.ma());
    if (m) { ev = +m[1]; ho = +m[2]; nap = +m[3]; }
    else if ((m = txt.match(/^(\d{1,2})[.\-\/ ]+(\d{1,2})$/))) { ev = ref.getFullYear(); ho = +m[1]; nap = +m[2]; }
    else if ((m = txt.match(/^(\d{1,2})$/))) { ev = ref.getFullYear(); ho = ref.getMonth() + 1; nap = +m[1]; }
    else return null;
    const d = new Date(ev, ho - 1, nap);
    if (d.getMonth() !== ho - 1 || d.getDate() !== nap) return null;
    return U.datumStr(d);
};

/* ---------- Szám / szöveg ---------- */
U.ft = function (n) {
    if (n === null || n === undefined || n === "") return "";
    return Math.round(n).toLocaleString("hu-HU").replace(/ /g, " ") + " Ft";
};
U.szam = function (n, tized) {
    if (n === null || n === undefined || n === "" || isNaN(n)) return "";
    return Number(n).toLocaleString("hu-HU", { maximumFractionDigits: tized || 0 }).replace(/ /g, " ");
};
U.esc = function (s) {
    return String(s === null || s === undefined ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
};
U.nl2br = function (s) { return U.esc(s).replace(/\n/g, "<br>"); };
/* URL-ek és e-mail címek kattinthatóvá tétele (escape után) */
U.linkesit = function (s) {
    return U.esc(s)
        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
        .replace(/(^|[\s(])([\w.+-]+@[\w-]+\.[\w.-]+)/g, '$1<a href="mailto:$2">$2</a>')
        .replace(/\n/g, "<br>");
};
U.ekezetNelkul = function (s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
};
U.$ = function (sel, gyoker) { return (gyoker || document).querySelector(sel); };
U.$$ = function (sel, gyoker) { return Array.prototype.slice.call((gyoker || document).querySelectorAll(sel)); };

/* ---------- Toast ---------- */
U._toastTimer = null;
U.toast = function (szoveg, opciok) {
    opciok = opciok || {};
    const el = document.getElementById("toast");
    el.innerHTML = "<span>" + U.esc(szoveg) + "</span>";
    if (opciok.visszavon) {
        const b = document.createElement("button");
        b.textContent = "Visszavonás";
        b.className = "btn btn-kicsi btn-vilagos";
        b.onclick = function () { opciok.visszavon(); el.classList.add("hidden"); };
        el.appendChild(b);
    }
    el.classList.remove("hidden");
    clearTimeout(U._toastTimer);
    U._toastTimer = setTimeout(function () { el.classList.add("hidden"); }, opciok.ido || (opciok.visszavon ? 6000 : 2800));
};

/* ---------- Modal ablak ---------- */
U._modalZaro = null;
U.modal = function (opciok) {
    // Ha már nyitva van egy ablak, annak lezáró függvényét lefuttatjuk
    if (U._modalZaro) { const z = U._modalZaro; U._modalZaro = null; z(); }
    const hatter = document.getElementById("modal-hatter");
    const tart = document.getElementById("modal-tartalom");
    document.getElementById("modal-cim").textContent = opciok.cim || "";
    tart.innerHTML = opciok.html || "";
    const modal = document.getElementById("modal");
    modal.className = opciok.szeles ? "szeles" : "";

    if (opciok.gombok && opciok.gombok.length) {
        const sav = document.createElement("div");
        sav.className = "modal-gombok";
        opciok.gombok.forEach(function (g) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "btn " + (g.osztaly || "");
            b.textContent = g.felirat;
            b.onclick = function () {
                const r = g.kattint ? g.kattint(tart) : undefined;
                if (r !== false) U.modalBezar();
            };
            sav.appendChild(b);
        });
        tart.appendChild(sav);
    }
    hatter.classList.remove("hidden");
    U._modalZaro = opciok.bezaraskor || null;
    if (opciok.megnyitaskor) opciok.megnyitaskor(tart);
    const elso = tart.querySelector("[autofocus]") || null;
    if (elso) setTimeout(function () { elso.focus(); }, 30);
    return tart;
};
U.modalBezar = function () {
    document.getElementById("modal-hatter").classList.add("hidden");
    document.getElementById("modal-tartalom").innerHTML = "";
    const z = U._modalZaro; U._modalZaro = null;
    if (z) z();
};
U.modalNyitva = function () { return !document.getElementById("modal-hatter").classList.contains("hidden"); };

U.megerosit = function (szoveg, opciok) {
    opciok = opciok || {};
    return new Promise(function (resolve) {
        let valasz = false;
        U.modal({
            cim: opciok.cim || "Megerősítés",
            html: "<p class='modal-szoveg'>" + U.nl2br(szoveg) + "</p>",
            gombok: [
                { felirat: "Mégsem", osztaly: "btn-masodlagos" },
                { felirat: opciok.igen || "Igen", osztaly: opciok.veszelyes ? "btn-veszely" : "btn-elsodleges", kattint: function () { valasz = true; } }
            ],
            bezaraskor: function () { resolve(valasz); }
        });
    });
};

U.uzenet = function (cim, szoveg) {
    return new Promise(function (resolve) {
        U.modal({ cim: cim, html: "<p class='modal-szoveg'>" + U.nl2br(szoveg) + "</p>",
            gombok: [{ felirat: "Rendben", osztaly: "btn-elsodleges" }], bezaraskor: resolve });
    });
};

/* ---------- Űrlap felugró ablakban ----------
   mezok: [{nev, felirat, tipus: text|number|date|textarea|checkbox|select|password,
            ertek, opciok:[[ertek,felirat]], lista:[...javaslatok], kotelezo, segitseg, attr}]
   ellenoriz(ertekek) → hibaüzenet vagy null
   Visszatér: Promise<ertekek | null>  (null = mégsem). Törlés esetén {_torles:true}.
*/
U.urlap = function (opciok) {
    return new Promise(function (resolve) {
        let eredmeny = null;
        let html = "<form class='urlap' autocomplete='off' onsubmit='return false'>";
        opciok.mezok.forEach(function (m, i) {
            const id = "m_" + m.nev;
            const ert = m.ertek === null || m.ertek === undefined ? "" : m.ertek;
            const af = i === 0 && opciok.fokusz !== false ? " autofocus" : "";
            const attr = m.attr || "";
            html += "<div class='mezo mezo-" + (m.tipus || "text") + (m.fel ? " mezo-fel" : "") + "'>";
            if (m.tipus === "checkbox") {
                html += "<label class='jelolo'><input type='checkbox' id='" + id + "' name='" + m.nev + "'" + (ert ? " checked" : "") + attr + "> " + U.esc(m.felirat) + "</label>";
            } else {
                html += "<label for='" + id + "'>" + U.esc(m.felirat) + (m.kotelezo ? " *" : "") + "</label>";
                if (m.tipus === "textarea") {
                    html += "<textarea id='" + id + "' name='" + m.nev + "' rows='" + (m.sorok || 3) + "'" + af + attr + ">" + U.esc(ert) + "</textarea>";
                } else if (m.tipus === "select") {
                    html += "<select id='" + id + "' name='" + m.nev + "'" + af + attr + ">";
                    m.opciok.forEach(function (o) {
                        html += "<option value='" + U.esc(o[0]) + "'" + (String(o[0]) === String(ert) ? " selected" : "") + ">" + U.esc(o[1]) + "</option>";
                    });
                    html += "</select>";
                } else {
                    const tipus = m.tipus === "number" ? "text' inputmode='decimal" : (m.tipus || "text");
                    html += "<input type='" + tipus + "' id='" + id + "' name='" + m.nev + "' value='" + U.esc(ert) + "'" +
                        (m.lista ? " list='l_" + m.nev + "'" : "") + af + attr + ">";
                    if (m.lista) {
                        html += "<datalist id='l_" + m.nev + "'>" + m.lista.map(function (x) { return "<option value='" + U.esc(x) + "'>"; }).join("") + "</datalist>";
                    }
                }
            }
            if (m.segitseg) html += "<small>" + m.segitseg + "</small>";
            html += "</div>";
        });
        html += "<p class='urlap-hiba hidden'></p></form>";
        if (opciok.lablec) html += opciok.lablec;

        function olvas(tart) {
            const e = {};
            opciok.mezok.forEach(function (m) {
                const el = tart.querySelector("[name='" + m.nev + "']");
                if (m.tipus === "checkbox") e[m.nev] = el.checked;
                else if (m.tipus === "number") {
                    const t = el.value.replace(/\s/g, "").replace(",", ".");
                    e[m.nev] = t === "" ? null : Number(t);
                } else e[m.nev] = el.value.trim();
            });
            return e;
        }
        function hiba(tart, uz) {
            const p = tart.querySelector(".urlap-hiba");
            p.textContent = uz; p.classList.remove("hidden");
        }

        const gombok = [];
        if (opciok.torles) {
            gombok.push({ felirat: opciok.torlesFelirat || "Törlés", osztaly: "btn-veszely btn-bal", kattint: function () { eredmeny = { _torles: true }; } });
        }
        (opciok.extraGombok || []).forEach(function (g) {
            gombok.push({ felirat: g.felirat, osztaly: g.osztaly || "btn-masodlagos", kattint: function (tart) { eredmeny = { _extra: g.kod, ertekek: olvas(tart) }; } });
        });
        gombok.push({ felirat: "Mégsem", osztaly: "btn-masodlagos" });
        gombok.push({
            felirat: opciok.mentFelirat || "Mentés", osztaly: "btn-elsodleges",
            kattint: function (tart) {
                const e = olvas(tart);
                for (const m of opciok.mezok) {
                    if (m.kotelezo && (e[m.nev] === "" || e[m.nev] === null)) { hiba(tart, "Kötelező mező: " + m.felirat); return false; }
                    if (m.tipus === "number" && e[m.nev] !== null && isNaN(e[m.nev])) { hiba(tart, "Nem szám: " + m.felirat); return false; }
                }
                const uz = opciok.ellenoriz ? opciok.ellenoriz(e) : null;
                if (uz) { hiba(tart, uz); return false; }
                eredmeny = e;
            }
        });

        U.modal({
            cim: opciok.cim, html: html, gombok: gombok, szeles: opciok.szeles,
            megnyitaskor: function (tart) {
                // Enter = mentés (textarea kivételével)
                tart.querySelector("form").addEventListener("keydown", function (ev) {
                    if (ev.key === "Enter" && ev.target.tagName !== "TEXTAREA" && !ev.isComposing) {
                        ev.preventDefault();
                        U.$(".modal-gombok .btn-elsodleges", tart).click();
                    }
                });
                if (opciok.megnyitaskor) opciok.megnyitaskor(tart);
            },
            bezaraskor: function () { resolve(eredmeny); }
        });
    });
};

/* Fájl letöltése (Blob) */
U.letolt = function (nev, tartalom, tipus) {
    const blob = tartalom instanceof Blob ? tartalom : new Blob([tartalom], { type: tipus || "application/octet-stream" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nev;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
};

/* Fájl kiválasztása (Promise<File|null>) */
U.fajlValaszt = function (accept) {
    return new Promise(function (resolve) {
        const inp = document.createElement("input");
        inp.type = "file"; inp.accept = accept || "";
        inp.onchange = function () { resolve(inp.files[0] || null); };
        inp.click();
    });
};

U.debounce = function (fn, ms) {
    let t = null;
    return function () {
        const args = arguments;
        clearTimeout(t);
        t = setTimeout(function () { fn.apply(null, args); }, ms);
    };
};
