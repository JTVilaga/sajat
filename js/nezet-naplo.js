/* ==================================================================
   nezet-naplo.js – a "H_napló" lap: napról napra, dátum + nap neve +
   a naphoz tartozó események és számlák (automatikusan összefűzve).
   Kattintásra a nap kinyílik, ott szerkeszthető.
   ================================================================== */
const NaploNezet = {
    cim: "Napló",
    honap: null,
    nyitott: null,       // kinyitott nap
    csakTartalmas: false,
    kereses: ""
};

NaploNezet.render = function (el) {
    const ma = U.ma();
    if (!NaploNezet.honap) NaploNezet.honap = ma.slice(0, 8) + "01";
    const h = NaploNezet.honap;
    const elso = U.parse(h);
    const napok = new Date(elso.getFullYear(), elso.getMonth() + 1, 0).getDate();

    let lista = "";
    if (NaploNezet.kereses.trim()) {
        // Keresés az egész naplóban
        const q = U.ekezetNelkul(NaploNezet.kereses.trim());
        const ix = N.index();
        const datumok = {};
        Object.keys(ix).forEach(function (d) { datumok[d] = 1; });
        Object.keys(S.adat.naploMegj).forEach(function (d) { datumok[d] = 1; });
        const talalat = Object.keys(datumok).sort().reverse().filter(function (d) {
            return U.ekezetNelkul(N.szovegSorok(d)).indexOf(q) >= 0;
        });
        lista = talalat.slice(0, 300).map(function (d) { return NaploNezet.sor(d, ma); }).join("");
        lista = "<p class='osszegzo'>" + talalat.length + " találat" + (talalat.length > 300 ? " (az első 300)" : "") + "</p>" +
            (lista || "<p class='ures-uzenet'>Nincs találat.</p>");
    } else {
        for (let i = 1; i <= napok; i++) {
            const d = h.slice(0, 8) + U.ketJegy(i);
            if (NaploNezet.csakTartalmas && !N.szovegSorok(d) && d !== ma) continue;
            lista += NaploNezet.sor(d, ma);
        }
    }

    el.innerHTML =
        "<section class='kartya'>" +
        "<div class='naptar-fej'>" +
        "<button class='btn btn-ikon' id='nl-elozo' aria-label='Előző hónap'>‹</button>" +
        "<h2>" + elso.getFullYear() + ". " + U.HONAPOK[elso.getMonth()] + "</h2>" +
        "<button class='btn btn-ikon' id='nl-kov' aria-label='Következő hónap'>›</button>" +
        "<button class='btn btn-kicsi btn-masodlagos' id='nl-ma'>Ma</button>" +
        "</div>" +
        "<div class='szuro-sor'>" +
        "<input type='search' id='nl-kereses' placeholder='Keresés a teljes naplóban…' value='" + U.esc(NaploNezet.kereses) + "'>" +
        "<label class='jelolo'><input type='checkbox' id='nl-csak'" + (NaploNezet.csakTartalmas ? " checked" : "") + "> Csak a bejegyzéses napok</label>" +
        "<button class='btn btn-elsodleges' id='nl-uj'>+ Új esemény</button>" +
        "</div>" +
        "<div class='naplo-lista' id='nl-lista'>" + lista + "</div>" +
        "</section>";

    U.$("#nl-elozo", el).onclick = function () { NaploNezet.honap = U.honapHozzaad(h, -1); NaploNezet.nyitott = null; A.frissit(); };
    U.$("#nl-kov", el).onclick = function () { NaploNezet.honap = U.honapHozzaad(h, 1); NaploNezet.nyitott = null; A.frissit(); };
    U.$("#nl-ma", el).onclick = function () {
        NaploNezet.honap = ma.slice(0, 8) + "01"; NaploNezet.nyitott = ma; NaploNezet.kereses = ""; A.frissit();
        NaploNezet.gorgetMahoz();
    };
    U.$("#nl-csak", el).onchange = function () { NaploNezet.csakTartalmas = this.checked; A.frissit(); };
    U.$("#nl-uj", el).onclick = function () { N.ujEsemeny(NaploNezet.nyitott || ma); };
    const k = U.$("#nl-kereses", el);
    k.addEventListener("input", U.debounce(function () {
        NaploNezet.kereses = k.value;
        A.frissit();
        const uj = U.$("#nl-kereses"); if (uj) { uj.focus(); uj.setSelectionRange(uj.value.length, uj.value.length); }
    }, 300));

    const listaEl = U.$("#nl-lista", el);
    listaEl.addEventListener("click", function (ev) {
        const fej = ev.target.closest("[data-napfej]");
        if (!fej) return;
        const d = fej.dataset.napfej;
        NaploNezet.nyitott = NaploNezet.nyitott === d ? null : d;
        A.frissit();
    });
    // A kinyitott nap belső gombjai
    const nyitott = U.$(".naplo-nap.nyitva .naplo-reszlet", el);
    if (nyitott) N.napKezelo(nyitott, NaploNezet.nyitott);
};

NaploNezet.sor = function (d, ma) {
    const t = N.szovegSorok(d);
    const nap = U.parse(d).getDay();
    const nyitva = NaploNezet.nyitott === d;
    let oszt = "naplo-nap";
    if (t) oszt += " van";
    if (d === ma) oszt += " ma";
    if (nap === 0 || nap === 6) oszt += " hetvege";
    if (nyitva) oszt += " nyitva";
    const vanFizetetlen = N.nap(d).kiadasok.some(function (k) { return !k.fiz; });
    return "<div class='" + oszt + "' id='nl-" + d + "'>" +
        "<button class='naplo-fej' data-napfej='" + d + "' aria-expanded='" + nyitva + "'>" +
        "<span class='naplo-datum'>" + U.datumHu(d) + "</span>" +
        "<span class='naplo-napnev'>" + U.NAPOK[nap] + "</span>" +
        "<span class='naplo-szoveg'>" + (t ? U.nl2br(t) : "") + (vanFizetetlen ? " <span class='cimke cimke-figy'>fizetendő</span>" : "") + "</span>" +
        "</button>" +
        (nyitva ? "<div class='naplo-reszlet'>" + N.napHtml(d) + "</div>" : "") +
        "</div>";
};

NaploNezet.gorgetMahoz = function () {
    setTimeout(function () {
        const e = document.getElementById("nl-" + (NaploNezet.nyitott || U.ma()));
        if (e) e.scrollIntoView({ block: "center" });
    }, 50);
};
