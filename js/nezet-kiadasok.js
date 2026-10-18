/* ==================================================================
   nezet-kiadasok.js – az "s_kiadok" lap
   Oszlopok: kat | MEGNEVEZÉS | fiz_hat | fizetve | összeg | megjegyzés
   - Gyors rögzítés sablonokkal (a régi I_VILL, I_GÁZ, … gombok)
   - "Fizetve ma" gomb (a régi dupla klikk a D oszlopon)
   - Szűrés, keresés, rendezés, összesítés
   ================================================================== */
const K = {
    cim: "Kiadások",
    kereses: "", kat: "", ev: "", allapot: "",
    rendez: "datum", irany: -1,
    limit: 150
};

/* Rendezéshez/évhez használt dátum: fizetés napja, ha nincs, a határidő */
K.datum = function (k) { return k.fiz || k.hat || ""; };

K.kategoriak = function () {
    const m = {};
    S.adat.kiadasok.forEach(function (k) { if (k.kat) m[k.kat] = (m[k.kat] || 0) + 1; });
    return Object.keys(m).sort(function (a, b) { return a.localeCompare(b, "hu"); });
};
K.evek = function () {
    const m = {};
    S.adat.kiadasok.forEach(function (k) { const d = K.datum(k); if (d) m[d.slice(0, 4)] = 1; });
    return Object.keys(m).sort().reverse();
};

K.szurt = function () {
    const q = U.ekezetNelkul(K.kereses);
    const ma = U.ma();
    let l = S.adat.kiadasok.filter(function (k) {
        if (K.kat && k.kat !== K.kat) return false;
        if (K.ev && K.datum(k).slice(0, 4) !== K.ev) return false;
        if (K.allapot === "fizetetlen" && k.fiz) return false;
        if (K.allapot === "fizetett" && !k.fiz) return false;
        if (K.allapot === "lejart" && (k.fiz || !k.hat || k.hat >= ma)) return false;
        if (q && U.ekezetNelkul(k.kat + " " + k.nev + " " + k.megj + " " + (k.osszeg || "")).indexOf(q) < 0) return false;
        return true;
    });
    const r = K.rendez, ir = K.irany;
    const kulcs = {
        datum: K.datum, kat: function (k) { return U.ekezetNelkul(k.kat); }, nev: function (k) { return U.ekezetNelkul(k.nev); },
        hat: function (k) { return k.hat || ""; }, fiz: function (k) { return k.fiz || ""; },
        osszeg: function (k) { return k.osszeg || 0; }
    }[r];
    // stabil rendezés: azonos kulcsnál az eredeti (felviteli) sorrend dönt
    l = l.map(function (k, i) { return [kulcs(k), i, k]; })
        .sort(function (a, b) { return a[0] < b[0] ? -ir : a[0] > b[0] ? ir : (a[1] - b[1]) * ir; })
        .map(function (x) { return x[2]; });
    return l;
};

K.render = function (el) {
    const lista = K.szurt();
    const ossz = lista.reduce(function (s, k) { return s + (k.osszeg || 0); }, 0);
    const fizetetlen = S.adat.kiadasok.filter(function (k) { return !k.fiz; }).length;
    const ma = U.ma();

    function fejlec(kod, felirat, oszt) {
        const nyil = K.rendez === kod ? (K.irany > 0 ? " ▲" : " ▼") : "";
        return "<th class='" + (oszt || "") + "'><button class='rendez-gomb' data-rendez='" + kod + "'>" + felirat + nyil + "</button></th>";
    }

    let sorok = "";
    lista.slice(0, K.limit).forEach(function (k) {
        const lejart = !k.fiz && k.hat && k.hat < ma;
        sorok += "<tr data-id='" + k.id + "' class='" + (k.fiz ? "" : (lejart ? "sor-lejart" : "sor-nyitott")) + "'>" +
            "<td class='o-kat'>" + U.esc(k.kat) + "</td>" +
            "<td class='o-nev'>" + U.esc(k.nev) + "</td>" +
            "<td class='o-hat'><span class='mobil-cimke'>Határidő: </span>" + U.datumHu(k.hat) + "</td>" +
            "<td class='o-fiz'>" + (k.fiz ? "<span class='mobil-cimke'>Fizetve: </span>" + U.datumHu(k.fiz)
                : "<button class='btn btn-kicsi btn-siker' data-fizet='" + k.id + "'>Fizetve ma</button>") + "</td>" +
            "<td class='o-osszeg'>" + U.ft(k.osszeg) + "</td>" +
            "<td class='o-megj'>" + U.esc(k.megj) + "</td>" +
            "</tr>";
    });

    const sablonGombok = S.adat.sablonok.map(function (s) {
        return "<button class='btn sablon-gomb' data-sablon='" + s.id + "' title='" + U.esc(s.nev + " – " + U.ft(s.osszeg)) + "'>" +
            U.esc(s.kat) + "<small>" + U.ft(s.osszeg) + "</small></button>";
    }).join("");

    el.innerHTML =
        "<section class='kartya'>" +
        "<div class='kartya-fej'><h3>Gyors rögzítés</h3>" +
        "<div class='gomb-sor'><button class='btn btn-elsodleges' id='k-uj'>+ Új tétel</button>" +
        "<button class='btn btn-masodlagos' id='k-osszesites'>Összesítés</button></div></div>" +
        "<div class='sablon-sor'>" + (sablonGombok || "<span class='halvany'>Nincs sablon. Az Adatok oldalon vehetsz fel.</span>") + "</div>" +
        "</section>" +

        "<section class='kartya'>" +
        "<div class='szuro-sor'>" +
        "<input type='search' id='k-kereses' placeholder='Keresés (kat, név, megjegyzés, összeg)…' value='" + U.esc(K.kereses) + "'>" +
        "<select id='k-kat'><option value=''>Minden kategória</option>" +
        K.kategoriak().map(function (c) { return "<option" + (c === K.kat ? " selected" : "") + ">" + U.esc(c) + "</option>"; }).join("") + "</select>" +
        "<select id='k-ev'><option value=''>Minden év</option>" +
        K.evek().map(function (c) { return "<option" + (c === K.ev ? " selected" : "") + ">" + c + "</option>"; }).join("") + "</select>" +
        "<select id='k-allapot'>" +
        [["", "Mind"], ["fizetetlen", "Fizetetlen (" + fizetetlen + ")"], ["lejart", "Lejárt, fizetetlen"], ["fizetett", "Fizetett"]]
            .map(function (o) { return "<option value='" + o[0] + "'" + (o[0] === K.allapot ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") +
        "</select>" +
        (K.kereses || K.kat || K.ev || K.allapot ? "<button class='btn btn-kicsi btn-masodlagos' id='k-torol'>Szűrők törlése</button>" : "") +
        "</div>" +
        "<p class='osszegzo'><b>" + U.szam(lista.length) + "</b> tétel · összesen <b>" + U.ft(ossz) + "</b></p>" +
        "<div class='tabla-keret'><table class='adat-tabla kiadas-tabla'>" +
        "<thead><tr>" + fejlec("kat", "kat") + fejlec("nev", "Megnevezés") + fejlec("hat", "Fiz. határidő") +
        fejlec("fiz", "Fizetve") + fejlec("osszeg", "Összeg", "jobbra") + "<th>Megjegyzés</th></tr></thead>" +
        "<tbody>" + (sorok || "<tr><td colspan='6' class='ures-uzenet'>Nincs a szűrésnek megfelelő tétel.</td></tr>") + "</tbody></table></div>" +
        (lista.length > K.limit ? "<div class='gomb-sor kozep'><button class='btn btn-masodlagos' id='k-tobb'>További " +
            Math.min(300, lista.length - K.limit) + " tétel (" + (lista.length - K.limit) + " van még)</button></div>" : "") +
        "</section>";

    // --- Események ---
    const keres = U.$("#k-kereses", el);
    keres.addEventListener("input", U.debounce(function () {
        K.kereses = keres.value; K.limit = 150;
        const pos = keres.selectionStart;
        A.frissit();
        const uj = U.$("#k-kereses"); if (uj) { uj.focus(); uj.setSelectionRange(pos, pos); }
    }, 250));
    U.$("#k-kat", el).onchange = function () { K.kat = this.value; K.limit = 150; A.frissit(); };
    U.$("#k-ev", el).onchange = function () { K.ev = this.value; K.limit = 150; A.frissit(); };
    U.$("#k-allapot", el).onchange = function () { K.allapot = this.value; K.limit = 150; A.frissit(); };
    const torol = U.$("#k-torol", el);
    if (torol) torol.onclick = function () { K.kereses = K.kat = K.ev = K.allapot = ""; A.frissit(); };
    const tobb = U.$("#k-tobb", el);
    if (tobb) tobb.onclick = function () { K.limit += 300; A.frissit(); };
    U.$("#k-uj", el).onclick = function () { K.uj(); };
    U.$("#k-osszesites", el).onclick = function () { K.osszesites(); };

    U.$$("[data-rendez]", el).forEach(function (b) {
        b.onclick = function () {
            const r = b.dataset.rendez;
            if (K.rendez === r) K.irany = -K.irany; else { K.rendez = r; K.irany = (r === "kat" || r === "nev") ? 1 : -1; }
            A.frissit();
        };
    });
    U.$$("[data-sablon]", el).forEach(function (b) {
        b.onclick = function () { K.sablonFuttat(b.dataset.sablon); };
    });
    U.$(".kiadas-tabla tbody", el).addEventListener("click", function (ev) {
        const f = ev.target.closest("[data-fizet]");
        if (f) { K.fizetveMa(f.dataset.fizet); return; }
        const tr = ev.target.closest("tr[data-id]");
        if (tr) K.szerkeszt(tr.dataset.id);
    });
};

/* ---------- Műveletek ---------- */

K.fizetveMa = function (id) {
    const vissza = S.modosit(function (a) {
        const k = a.kiadasok.find(function (x) { return x.id === id; });
        if (k) k.fiz = U.ma();
    });
    U.toast("Fizetve: " + U.datumHu(U.ma()), { visszavon: vissza });
};

K._mezok = function (k) {
    const nevek = {};
    S.adat.kiadasok.forEach(function (x) { if (x.nev) nevek[x.nev] = 1; });
    return [
        { nev: "kat", felirat: "Kategória (kat)", ertek: k.kat, kotelezo: true, lista: K.kategoriak(), fel: true },
        { nev: "osszeg", felirat: "Összeg (Ft)", tipus: "number", ertek: k.osszeg, fel: true },
        { nev: "nev", felirat: "Megnevezés", ertek: k.nev, lista: Object.keys(nevek).slice(0, 500) },
        { nev: "hat", felirat: "Fizetési határidő", tipus: "date", ertek: k.hat, fel: true },
        { nev: "fiz", felirat: "Fizetve", tipus: "date", ertek: k.fiz, fel: true, segitseg: "Üresen hagyva: még nincs fizetve." },
        { nev: "megj", felirat: "Megjegyzés", tipus: "textarea", ertek: k.megj, sorok: 2 }
    ];
};

/* Új kategória beírásakor a legutóbbi azonos kategóriájú tétel adatainak felajánlása */
K._katKitolt = function (tart) {
    const kat = U.$("[name=kat]", tart), nev = U.$("[name=nev]", tart), ossz = U.$("[name=osszeg]", tart);
    kat.addEventListener("change", function () {
        let utolso = null;
        for (let i = S.adat.kiadasok.length - 1; i >= 0; i--) {
            if (S.adat.kiadasok[i].kat === kat.value) { utolso = S.adat.kiadasok[i]; break; }
        }
        if (!utolso) return;
        if (!nev.value) nev.value = utolso.nev || "";
        if (!ossz.value && utolso.osszeg) ossz.value = utolso.osszeg;
    });
};

K.uj = async function (elotolt) {
    const k = Object.assign({ kat: "", nev: "", hat: U.ma(), fiz: "", osszeg: null, megj: "" }, elotolt || {});
    const e = await U.urlap({ cim: "Új kiadás", mezok: K._mezok(k), megnyitaskor: K._katKitolt });
    if (!e) return;
    S.modosit(function (a) {
        a.kiadasok.push({ id: S.ujId("k"), kat: e.kat, nev: e.nev, hat: e.hat || null, fiz: e.fiz || null, osszeg: e.osszeg, megj: e.megj });
    });
    U.toast("Tétel rögzítve.");
};

K.szerkeszt = async function (id) {
    const k = S.adat.kiadasok.find(function (x) { return x.id === id; });
    if (!k) return;
    const e = await U.urlap({
        cim: "Kiadás szerkesztése", mezok: K._mezok(k), torles: true,
        extraGombok: [{ felirat: "Másolat új tételként", kod: "masol" }]
    });
    if (!e) return;
    if (e._torles) {
        const v = S.modosit(function (a) { a.kiadasok = a.kiadasok.filter(function (x) { return x.id !== id; }); });
        U.toast("Tétel törölve.", { visszavon: v });
        return;
    }
    if (e._extra === "masol") {
        K.uj({ kat: k.kat, nev: k.nev, osszeg: k.osszeg, hat: U.honapHozzaad(k.hat || U.ma(), 1), fiz: "" });
        return;
    }
    S.modosit(function (a) {
        const x = a.kiadasok.find(function (y) { return y.id === id; });
        x.kat = e.kat; x.nev = e.nev; x.hat = e.hat || null; x.fiz = e.fiz || null; x.osszeg = e.osszeg; x.megj = e.megj;
    });
};

/* Sablon gomb – mint a Module1 makrói:
   "kerdez": határidőt kér (alapból a jövő hónap ugyanazon napja)
   "ma":     határidő = fizetve = ma (mint az "Anna" makró) */
K.sablonFuttat = async function (sid) {
    const s = S.adat.sablonok.find(function (x) { return x.id === sid; });
    if (!s) return;
    if (s.mod === "ma") {
        const v = S.modosit(function (a) {
            a.kiadasok.push({ id: S.ujId("k"), kat: s.kat, nev: s.nev, hat: U.ma(), fiz: U.ma(), osszeg: s.osszeg, megj: "" });
        });
        U.toast(s.kat + " rögzítve, fizetve ma (" + U.ft(s.osszeg) + ").", { visszavon: v });
        return;
    }
    const e = await U.urlap({
        cim: s.kat + " – " + s.nev,
        mezok: [
            { nev: "hat", felirat: "Fizetési határidő", tipus: "date", ertek: U.honapHozzaad(U.ma(), 1), kotelezo: true, fel: true },
            { nev: "osszeg", felirat: "Összeg (Ft)", tipus: "number", ertek: s.osszeg, fel: true },
            { nev: "fizetve", felirat: "Már ki is fizettem (ma)", tipus: "checkbox", ertek: false },
            { nev: "megj", felirat: "Megjegyzés", ertek: "" }
        ],
        mentFelirat: "Rögzít"
    });
    if (!e) return;
    S.modosit(function (a) {
        a.kiadasok.push({ id: S.ujId("k"), kat: s.kat, nev: s.nev, hat: e.hat, fiz: e.fizetve ? U.ma() : null, osszeg: e.osszeg, megj: e.megj });
    });
    U.toast(s.kat + " rögzítve: határidő " + U.datumHu(e.hat));
};

/* Összesítés: évenként havi bontás + kategóriák */
K.osszesites = function () {
    const evek = K.evek();
    let ev = K.ev || evek[0] || String(new Date().getFullYear());

    function html() {
        const havi = new Array(12).fill(0), kat = {};
        let ossz = 0;
        S.adat.kiadasok.forEach(function (k) {
            const d = K.datum(k);
            if (d.slice(0, 4) !== ev || !k.osszeg) return;
            havi[+d.slice(5, 7) - 1] += k.osszeg;
            kat[k.kat] = (kat[k.kat] || 0) + k.osszeg;
            ossz += k.osszeg;
        });
        const max = Math.max.apply(null, havi.concat([1]));
        let h = "<div class='szuro-sor'><label>Év: <select id='ossz-ev'>" +
            evek.map(function (e) { return "<option" + (e === ev ? " selected" : "") + ">" + e + "</option>"; }).join("") +
            "</select></label><span class='osszegzo'>Összesen: <b>" + U.ft(ossz) + "</b></span></div>";
        h += "<h4 class='alcim'>Havonta</h4><table class='adat-tabla kompakt'><tbody>";
        havi.forEach(function (v, i) {
            h += "<tr><td>" + U.HONAPOK[i] + "</td><td class='sav-cella'><span class='sav' style='width:" + (v / max * 100).toFixed(1) + "%'></span></td><td class='jobbra'>" + U.ft(v) + "</td></tr>";
        });
        h += "</tbody></table><h4 class='alcim'>Kategóriánként</h4><table class='adat-tabla kompakt'><tbody>";
        Object.keys(kat).sort(function (a, b) { return kat[b] - kat[a]; }).forEach(function (c) {
            h += "<tr><td>" + U.esc(c) + "</td><td class='jobbra'>" + U.ft(kat[c]) + "</td></tr>";
        });
        h += "</tbody></table><p class='halvany kicsi'>Az év a fizetés dátuma szerint (ha nincs, a határidő szerint) számít.</p>";
        return h;
    }
    function kot(t) {
        U.$("#ossz-ev", t).onchange = function () {
            ev = this.value;
            const tart = document.getElementById("modal-tartalom");
            const gombok = U.$(".modal-gombok", tart);
            tart.innerHTML = html(); tart.appendChild(gombok); kot(tart);
        };
    }
    U.modal({ cim: "Összesítés", html: html(), szeles: true, gombok: [{ felirat: "Bezár", osztaly: "btn-elsodleges" }], megnyitaskor: kot });
};
