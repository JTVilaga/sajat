/* ==================================================================
   nezet-naptar.js – a FrmNaptar megfelelője (ez nyílik meg induláskor)
   Színek, mint az Excelben:
     mai nap: sárga | adatos nap: narancs | mai nap + adat: piros
   "Adatos" = van esemény, vagy ki nem fizetett számla határideje.
   Kattintás: a nap tartalma (H_napló) | jobb klikk / hosszan nyomva /
   dupla klikk: új esemény (frmEvent)
   ================================================================== */
const NaptarNezet = {
    cim: "Naptár",
    honap: null,          // a megjelenített hónap első napja
    kivalasztott: null    // a kiválasztott nap
};

NaptarNezet.render = function (el) {
    const ma = U.ma();
    if (!NaptarNezet.honap) NaptarNezet.honap = ma.slice(0, 8) + "01";
    if (!NaptarNezet.kivalasztott) NaptarNezet.kivalasztott = ma;
    const honap = NaptarNezet.honap;
    const elso = U.parse(honap);
    const kezdNap = (elso.getDay() + 6) % 7;            // hétfő = 0
    const napokSzama = new Date(elso.getFullYear(), elso.getMonth() + 1, 0).getDate();
    const sorok = Math.ceil((kezdNap + napokSzama) / 7);

    let racs = "";
    U.NAPOK_ROVID.forEach(function (n, i) { racs += "<div class='nt-fej" + (i > 4 ? " hetvege" : "") + "'>" + n + "</div>"; });
    for (let i = 0; i < sorok * 7; i++) {
        const napSzam = i - kezdNap + 1;
        if (napSzam < 1 || napSzam > napokSzama) { racs += "<div class='nt-nap ures'></div>"; continue; }
        const d = honap.slice(0, 8) + U.ketJegy(napSzam);
        const jelolt = N.jelolt(d);
        const n = N.nap(d);
        let oszt = "nt-nap";
        if (d === ma && jelolt) oszt += " ma-adat";
        else if (d === ma) oszt += " ma";
        else if (jelolt) oszt += " adat";
        if (d === NaptarNezet.kivalasztott) oszt += " kivalasztva";
        if (i % 7 > 4) oszt += " hetvege";
        // rövid előnézet széles képernyőn
        const elonezet = [];
        n.esemenyek.forEach(function (e) { elonezet.push("<span class='nt-e'>" + U.esc(e.szoveg.split("\n")[0]) + "</span>"); });
        n.kiadasok.forEach(function (k) { elonezet.push("<span class='nt-k" + (k.fiz ? " fizetve" : "") + "'>" + U.esc(k.nev || k.kat) + "</span>"); });
        if (n.megj) elonezet.push("<span class='nt-m'>" + U.esc(n.megj.split("\n")[0]) + "</span>");
        const db = n.esemenyek.length + n.kiadasok.length + (n.megj ? 1 : 0);
        racs += "<button class='" + oszt + "' data-nap='" + d + "' aria-label='" + U.datumHuHosszu(d) + (db ? ", " + db + " bejegyzés" : "") + "'>" +
            "<span class='nt-szam'>" + napSzam + "</span>" +
            (db ? "<span class='nt-db'>" + db + "</span>" : "") +
            "<span class='nt-elonezet'>" + elonezet.slice(0, 3).join("") + (elonezet.length > 3 ? "<span class='nt-tobb'>+" + (elonezet.length - 3) + "</span>" : "") + "</span>" +
            "</button>";
    }

    // Közelgő / lejárt tételek
    const kozel = N.kozelgo(30);
    let kozelHtml = "";
    if (!kozel.length) kozelHtml = "<p class='ures-uzenet'>A következő 30 napban nincs teendő.</p>";
    else {
        kozelHtml = "<ul class='kozelgo-lista'>";
        kozel.slice(0, 40).forEach(function (x) {
            const nap = U.parse(x.datum);
            const szoveg = x.tipus === "e" ? U.esc(x.t.szoveg.split("\n")[0]) : "<b>" + U.esc(x.t.nev || x.t.kat) + "</b> · " + U.ft(x.t.osszeg);
            kozelHtml += "<li class='" + (x.lejart ? "lejart" : "") + "' data-ugras='" + x.datum + "'>" +
                "<span class='kozel-datum'>" + U.ketJegy(nap.getMonth() + 1) + "." + U.ketJegy(nap.getDate()) + ". <small>" + U.NAPOK_ROVID[(nap.getDay() + 6) % 7] + "</small></span>" +
                "<span class='kozel-jel " + (x.tipus === "e" ? "jel-e" : "jel-k") + "'></span>" +
                "<span class='kozel-szoveg'>" + szoveg + (x.lejart ? " <span class='cimke cimke-hiba'>lejárt</span>" : "") + "</span></li>";
        });
        kozelHtml += "</ul>";
    }

    el.innerHTML =
        "<div class='naptar-elrendezes'>" +
        "<section class='kartya naptar-kartya'>" +
        "<div class='naptar-fej'>" +
        "<button class='btn btn-ikon' id='nt-elozo' aria-label='Előző hónap'>‹</button>" +
        "<h2 id='nt-honap'>" + elso.getFullYear() + ". " + U.HONAPOK[elso.getMonth()] + "</h2>" +
        "<button class='btn btn-ikon' id='nt-kov' aria-label='Következő hónap'>›</button>" +
        "<button class='btn btn-kicsi btn-masodlagos' id='nt-ma'>Ma</button>" +
        "</div>" +
        "<div class='naptar-racs' id='nt-racs'>" + racs + "</div>" +
        "<p class='halvany kicsi naptar-tipp'>Kattintás: nap megnyitása · Jobb klikk, dupla klikk vagy hosszan nyomva: új esemény</p>" +
        "</section>" +
        "<div class='naptar-oldal'>" +
        "<section class='kartya' id='nt-nap-panel'></section>" +
        "<section class='kartya'>" +
        "<div class='kartya-fej'><h3>Közelgő 30 nap</h3><span class='halvany kicsi'>+ lejárt, fizetetlen</span></div>" +
        kozelHtml +
        "</section>" +
        "</div></div>";

    // --- Események ---
    U.$("#nt-elozo", el).onclick = function () { NaptarNezet.lapoz(-1); };
    U.$("#nt-kov", el).onclick = function () { NaptarNezet.lapoz(1); };
    U.$("#nt-ma", el).onclick = function () { NaptarNezet.ugras(U.ma()); };
    NaptarNezet.napPanel();

    U.$$(".kozelgo-lista li", el).forEach(function (li) {
        li.onclick = function () { NaptarNezet.ugras(li.dataset.ugras, true); };
    });

    const racsEl = U.$("#nt-racs", el);
    racsEl.addEventListener("click", function (ev) {
        const b = ev.target.closest("[data-nap]");
        if (!b) return;
        NaptarNezet.kivalasztott = b.dataset.nap;
        U.$$(".nt-nap.kivalasztva", racsEl).forEach(function (x) { x.classList.remove("kivalasztva"); });
        b.classList.add("kivalasztva");
        NaptarNezet.napPanel();
        // mobilon görgessünk a nap paneljéhez
        if (window.innerWidth < 900) {
            const p = document.getElementById("nt-nap-panel");
            if (p) p.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    });
    racsEl.addEventListener("dblclick", function (ev) {
        const b = ev.target.closest("[data-nap]");
        if (b) N.ujEsemeny(b.dataset.nap);
    });
    racsEl.addEventListener("contextmenu", function (ev) {     // jobb klikk = új esemény (mint az Excelben)
        const b = ev.target.closest("[data-nap]");
        if (!b) return;
        ev.preventDefault();
        N.ujEsemeny(b.dataset.nap);
    });

    // Hosszú nyomás (érintőképernyő) = új esemény; söprés = hónapváltás
    let tartas = null, kezdX = 0, kezdY = 0;
    racsEl.addEventListener("touchstart", function (ev) {
        const t = ev.touches[0]; kezdX = t.clientX; kezdY = t.clientY;
        const b = ev.target.closest("[data-nap]");
        if (b) tartas = setTimeout(function () { tartas = "kesz"; N.ujEsemeny(b.dataset.nap); }, 600);
    }, { passive: true });
    racsEl.addEventListener("touchmove", function (ev) {
        const t = ev.touches[0];
        if (Math.abs(t.clientX - kezdX) > 10 || Math.abs(t.clientY - kezdY) > 10) { clearTimeout(tartas); tartas = null; }
    }, { passive: true });
    racsEl.addEventListener("touchend", function (ev) {
        if (tartas === "kesz") { ev.preventDefault(); tartas = null; return; }
        clearTimeout(tartas); tartas = null;
        const t = ev.changedTouches[0];
        const dx = t.clientX - kezdX, dy = t.clientY - kezdY;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) NaptarNezet.lapoz(dx < 0 ? 1 : -1);
    });
};

/* A kiválasztott nap panelje (H_napló sora) */
NaptarNezet.napPanel = function () {
    const p = document.getElementById("nt-nap-panel");
    if (!p) return;
    const k = NaptarNezet.kivalasztott, ma = U.ma();
    p.innerHTML =
        "<div class='kartya-fej'><h3>" + U.datumHuHosszu(k) + "</h3>" +
        (k !== ma ? "<button class='btn btn-kicsi btn-masodlagos' id='nt-mara'>Ugrás mára</button>" : "<span class='cimke cimke-ma'>ma</span>") +
        "</div><div id='nt-nap-tartalom'>" + N.napHtml(k) + "</div>";
    const mara = U.$("#nt-mara", p);
    if (mara) mara.onclick = function () { NaptarNezet.ugras(U.ma()); };
    N.napKezelo(U.$("#nt-nap-tartalom", p), k);
};

NaptarNezet.lapoz = function (n) {
    NaptarNezet.honap = U.honapHozzaad(NaptarNezet.honap, n);
    A.frissit();
};
NaptarNezet.ugras = function (datum, gorget) {
    NaptarNezet.honap = datum.slice(0, 8) + "01";
    NaptarNezet.kivalasztott = datum;
    A.frissit();
    if (gorget && window.innerWidth < 900) {
        const p = document.getElementById("nt-nap-panel");
        if (p) p.scrollIntoView({ behavior: "smooth", block: "start" });
    }
};
