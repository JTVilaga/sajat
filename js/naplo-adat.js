/* ==================================================================
   naplo-adat.js – a régi "H_napló" lap logikája (HNaplo_Feltoltes)
   Nem kell külön frissíteni: minden napra kiszámolja, mi tartozik hozzá.
   - event lap: dátum szerint
   - s_kiadok: a fizetési határidő (fiz_hat) szerint
   - + a naphoz írt kézi megjegyzés (régi H_napló D oszlop)
   ================================================================== */
const N = { _index: null };

/* Dátum → { e: [események], k: [kiadások] } */
N.index = function () {
    if (N._index) return N._index;
    const ix = {};
    function hely(d) { return ix[d] || (ix[d] = { e: [], k: [] }); }
    S.adat.esemenyek.forEach(function (e) { if (e.datum) hely(e.datum).e.push(e); });
    S.adat.kiadasok.forEach(function (k) { if (k.hat) hely(k.hat).k.push(k); });
    N._index = ix;
    return ix;
};
N.ervenytelenit = function () { N._index = null; };
S.figyel(N.ervenytelenit);   // minden módosítás után újraépül

N.nap = function (datum) {
    const x = N.index()[datum] || { e: [], k: [] };
    return { esemenyek: x.e, kiadasok: x.k, megj: (S.adat.naploMegj || {})[datum] || "" };
};

/* Van-e "adat" a napon a naptár színezéséhez (mint a FrmNaptar-ban):
   esemény VAGY még ki nem fizetett számla az adott határidővel */
N.jelolt = function (datum) {
    const x = N.index()[datum];
    if (!x) return false;
    if (x.e.length) return true;
    return x.k.some(function (k) { return !k.fiz; });
};

/* A H_napló C oszlopának megfelelő szöveg (sortöréssel), majd D oszlop */
N.szovegSorok = function (datum) {
    const n = N.nap(datum);
    const c = [];
    n.esemenyek.forEach(function (e) { if (String(e.szoveg).trim()) c.push(e.szoveg); });
    n.kiadasok.forEach(function (k) { if (String(k.nev).trim()) c.push(k.nev); });
    let t = c.join("\n").trim();
    if (n.megj.trim()) t = (t ? t + "\n" : "") + n.megj;
    return t;
};

/* Közelgő tételek (ma-tól n napig) */
N.kozelgo = function (napok) {
    const ma = U.ma(), vege = U.napHozzaad(ma, napok);
    const lista = [];
    S.adat.esemenyek.forEach(function (e) {
        if (e.datum >= ma && e.datum <= vege) lista.push({ datum: e.datum, tipus: "e", t: e });
    });
    S.adat.kiadasok.forEach(function (k) {
        if (k.hat && !k.fiz && k.hat <= vege) lista.push({ datum: k.hat, tipus: "k", t: k, lejart: k.hat < ma });
    });
    lista.sort(function (a, b) { return a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0; });
    return lista;
};

/* Események rendezése dátum szerint (stabil), mint a frmEvent végén */
N.esemenyRendez = function (a) {
    a.esemenyek = a.esemenyek
        .map(function (e, i) { return [e, i]; })
        .sort(function (x, y) { return x[0].datum < y[0].datum ? -1 : x[0].datum > y[0].datum ? 1 : x[1] - y[1]; })
        .map(function (x) { return x[0]; });
};

/* ---------- Közös felugró ablakok (naptárból és naplóból is) ---------- */

/* Új esemény – a frmEvent megfelelője: kezdő és záró dátum, naponként külön sor */
N.ujEsemeny = async function (datum) {
    datum = datum || U.ma();
    const e = await U.urlap({
        cim: "Új esemény",
        mezok: [
            { nev: "szoveg", felirat: "Esemény", tipus: "textarea", kotelezo: true, sorok: 3 },
            { nev: "tol", felirat: "Kezdő dátum", tipus: "date", ertek: datum, kotelezo: true, fel: true },
            { nev: "ig", felirat: "Záró dátum", tipus: "date", ertek: datum, kotelezo: true, fel: true,
              segitseg: "Több napos eseménynél minden napra külön bejegyzés készül." }
        ],
        mentFelirat: "Rögzít",
        megnyitaskor: function (t) {
            // ha a kezdő dátum változik és a záró korábbi lenne, igazítjuk
            const tol = U.$("[name=tol]", t), ig = U.$("[name=ig]", t);
            tol.addEventListener("change", function () { if (ig.value < tol.value) ig.value = tol.value; });
        },
        ellenoriz: function (v) {
            if (v.ig < v.tol) return "A záró dátum nem lehet kisebb a kezdő dátumnál.";
            if (U.napKulonbseg(v.tol, v.ig) > 366) return "Legfeljebb egy évet lehet egyszerre rögzíteni.";
            return null;
        }
    });
    if (!e) return null;
    const rTime = U.most();
    const csoport = S.ujId("g");
    let d = e.tol, db = 0;
    S.modosit(function (a) {
        while (d <= e.ig) {
            a.esemenyek.push({ id: S.ujId("e"), datum: d, szoveg: e.szoveg, rogzitve: rTime, csoport: csoport });
            d = U.napHozzaad(d, 1); db++;
        }
        N.esemenyRendez(a);
    });
    U.toast(db > 1 ? db + " napra rögzítve." : "Esemény rögzítve.");
    return e.tol;
};

/* Esemény szerkesztése / törlése */
N.esemenySzerkeszt = async function (id) {
    const ev = S.adat.esemenyek.find(function (x) { return x.id === id; });
    if (!ev) return;
    // azonos rögzítésből (több napos) származó társai
    const tarsak = S.adat.esemenyek.filter(function (x) {
        return x !== ev && ((ev.csoport && x.csoport === ev.csoport) ||
            (!ev.csoport && ev.rogzitve && x.rogzitve === ev.rogzitve && x.szoveg === ev.szoveg));
    });
    const extra = tarsak.length ? [{ felirat: "Mind a " + (tarsak.length + 1) + " nap törlése", kod: "mindtorol", osztaly: "btn-veszely" }] : [];
    const e = await U.urlap({
        cim: "Esemény szerkesztése",
        mezok: [
            { nev: "szoveg", felirat: "Esemény", tipus: "textarea", ertek: ev.szoveg, kotelezo: true },
            { nev: "datum", felirat: "Dátum", tipus: "date", ertek: ev.datum, kotelezo: true }
        ],
        torles: true, extraGombok: extra,
        lablec: ev.rogzitve ? "<p class='halvany kicsi'>Rögzítve: " + U.idopontHu(ev.rogzitve) + "</p>" : ""
    });
    if (!e) return;
    let vissza;
    if (e._torles) {
        vissza = S.modosit(function (a) { a.esemenyek = a.esemenyek.filter(function (x) { return x.id !== id; }); });
        U.toast("Esemény törölve.", { visszavon: vissza });
    } else if (e._extra === "mindtorol") {
        const ids = [ev.id].concat(tarsak.map(function (x) { return x.id; }));
        vissza = S.modosit(function (a) { a.esemenyek = a.esemenyek.filter(function (x) { return ids.indexOf(x.id) < 0; }); });
        U.toast(ids.length + " bejegyzés törölve.", { visszavon: vissza });
    } else {
        S.modosit(function (a) {
            const x = a.esemenyek.find(function (y) { return y.id === id; });
            x.szoveg = e.szoveg; x.datum = e.datum;
            N.esemenyRendez(a);
        });
    }
};

/* Napi megjegyzés (régi H_napló D oszlop) */
N.megjSzerkeszt = async function (datum) {
    const e = await U.urlap({
        cim: "Napló megjegyzés – " + U.datumHu(datum),
        mezok: [{ nev: "megj", felirat: "Megjegyzés ehhez a naphoz", tipus: "textarea", ertek: N.nap(datum).megj, sorok: 4 }]
    });
    if (!e) return;
    S.modosit(function (a) {
        if (e.megj) a.naploMegj[datum] = e.megj; else delete a.naploMegj[datum];
    });
};

/* Egy nap tartalmának HTML-je (naptár oldalpanel és napló felugró ablak) */
N.napHtml = function (datum, opciok) {
    opciok = opciok || {};
    const n = N.nap(datum);
    const ma = U.ma();
    let h = "";
    if (!n.esemenyek.length && !n.kiadasok.length && !n.megj) {
        h += "<p class='ures-uzenet'>Erre a napra nincs bejegyzés.</p>";
    }
    if (n.esemenyek.length) {
        h += "<h4 class='alcim'>Események</h4><ul class='tetel-lista'>";
        n.esemenyek.forEach(function (e) {
            h += "<li class='tetel tetel-esemeny' data-esemeny='" + e.id + "' tabindex='0'>" +
                "<span class='tetel-jel'>●</span><span class='tetel-szoveg'>" + U.nl2br(e.szoveg) + "</span></li>";
        });
        h += "</ul>";
    }
    if (n.kiadasok.length) {
        h += "<h4 class='alcim'>Fizetési határidő</h4><ul class='tetel-lista'>";
        n.kiadasok.forEach(function (k) {
            const allapot = k.fiz ? "<span class='cimke cimke-ok'>fizetve " + U.datumHu(k.fiz) + "</span>"
                : "<span class='cimke " + (datum < ma ? "cimke-hiba" : "cimke-figy") + "'>" + (datum < ma ? "lejárt" : "fizetendő") + "</span>";
            h += "<li class='tetel tetel-kiadas' data-kiadas='" + k.id + "' tabindex='0'>" +
                "<span class='tetel-szoveg'><b>" + U.esc(k.nev || k.kat) + "</b> <span class='halvany'>" + U.esc(k.kat) + "</span><br>" +
                U.ft(k.osszeg) + " " + allapot + "</span>" +
                (k.fiz ? "" : "<button class='btn btn-kicsi btn-siker' data-fizet='" + k.id + "'>Fizetve ma</button>") +
                "</li>";
        });
        h += "</ul>";
    }
    if (n.megj) {
        h += "<h4 class='alcim'>Megjegyzés</h4><div class='napi-megj' data-megj='1' tabindex='0'>" + U.linkesit(n.megj) + "</div>";
    }
    h += "<div class='gomb-sor'>" +
        "<button class='btn btn-elsodleges' data-uj-esemeny='" + datum + "'>+ Új esemény</button>" +
        "<button class='btn btn-masodlagos' data-megj-szerk='" + datum + "'>" + (n.megj ? "Megjegyzés szerkesztése" : "+ Megjegyzés") + "</button>" +
        "</div>";
    return h;
};

/* A napHtml-ben lévő gombok kezelése (eseménydelegálás) */
N.napKezelo = function (gyoker, datum) {
    gyoker.addEventListener("click", function (ev) {
        const t = ev.target;
        const fizet = t.closest("[data-fizet]");
        if (fizet) { ev.stopPropagation(); K.fizetveMa(fizet.dataset.fizet); return; }
        const es = t.closest("[data-esemeny]");
        if (es) { N.esemenySzerkeszt(es.dataset.esemeny); return; }
        const ki = t.closest("[data-kiadas]");
        if (ki) { K.szerkeszt(ki.dataset.kiadas); return; }
        if (t.closest("[data-uj-esemeny]")) { N.ujEsemeny(datum); return; }
        if (t.closest("[data-megj-szerk]") || t.closest("[data-megj]")) { N.megjSzerkeszt(datum); return; }
    });
};
