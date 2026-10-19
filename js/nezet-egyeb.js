/* ==================================================================
   nezet-egyeb.js – Mérőórák (Gáz, Vill lapok), Autó (ASX lap),
   Restancia, Súgó (HELP lap) és a mobilos "Több" menü
   ================================================================== */

/* ================= MÉRŐÓRÁK ================= */
const MeroNezet = { cim: "Mérőórák" };

/* Számított oszlopok, mint a Gáz/Vill lapon:
   - bázis (elszámolás) sor: éves fogyasztás = állás − előző bázis állása
   - többi sor: fogyasztás az utolsó elszámolás óta
   - havi átlag = fogyasztás / eltelt napok × 30,44 */
MeroNezet.szamol = function (m) {
    const l = m.leolvasasok.slice().sort(function (a, b) { return (a.datum || "") < (b.datum || "") ? -1 : 1; });
    let bazis = null;
    return l.map(function (r) {
        const x = { r: r, fogy: null, eves: null, havi: null };
        if (bazis && r.allas !== null && bazis.allas !== null) {
            const f = r.allas - bazis.allas;
            const nap = r.datum && bazis.datum ? U.napKulonbseg(bazis.datum, r.datum) : 0;
            if (r.bazis) x.eves = f; else x.fogy = f;
            if (nap > 0) x.havi = f / nap * 30.44;
        } else if (r.bazis && r.eves !== null && r.eves !== undefined) {
            x.eves = r.eves;     // első elszámolás: a régi, kézzel beírt érték
        }
        if (r.bazis) bazis = r;
        return x;
    });
};

MeroNezet.render = function (el) {
    let h = "<div class='gomb-sor'><button class='btn btn-masodlagos' id='mero-uj'>+ Új mérőóra</button></div>";
    S.adat.merok.forEach(function (m) {
        const sorok = MeroNezet.szamol(m);
        const utolso = sorok[sorok.length - 1];
        let osszefog = "";
        if (utolso) {
            const f = utolso.r.bazis ? 0 : utolso.fogy;
            osszefog = "<div class='mero-osszefog'>" +
                "<div><small>Utolsó leolvasás</small><b>" + U.szam(utolso.r.allas) + " " + U.esc(m.egyseg) + "</b><span>" + U.datumHu(utolso.r.datum) + "</span></div>" +
                "<div><small>Elszámolás óta</small><b>" + (f === null ? "–" : U.szam(f) + " " + U.esc(m.egyseg)) + "</b></div>" +
                "<div><small>Havi átlag</small><b>" + (utolso.havi === null ? "–" : U.szam(utolso.havi, 0) + " " + U.esc(m.egyseg)) + "</b></div>" +
                "<div><small>Becsült éves</small><b>" + (utolso.havi === null ? "–" : U.szam(utolso.havi * 12, 0) + " " + U.esc(m.egyseg)) + "</b></div>" +
                "</div>";
        }
        let t = "";
        sorok.slice().reverse().forEach(function (x) {
            const r = x.r;
            t += "<tr data-mero='" + m.id + "' data-id='" + r.id + "' class='" + (r.bazis ? "sor-bazis" : "") + "'>" +
                "<td>" + U.datumHu(r.datum) + "</td>" +
                "<td class='jobbra'>" + U.szam(r.allas) + "</td>" +
                "<td>" + (r.bazis ? "<span class='cimke cimke-ma'>elszámolás</span> " : "") + U.esc(r.elszamolas) + "</td>" +
                "<td class='jobbra'>" + (x.fogy === null ? "" : U.szam(x.fogy)) + "</td>" +
                "<td class='jobbra'>" + (x.eves === null ? "" : U.szam(x.eves)) + "</td>" +
                "<td class='jobbra'>" + (x.havi === null ? "" : U.szam(x.havi, 0)) + "</td>" +
                "<td>" + U.esc(r.megj) + "</td></tr>";
        });
        h += "<section class='kartya'>" +
            "<div class='kartya-fej'><h3>" + U.esc(m.nev) + " <span class='halvany'>(" + U.esc(m.egyseg) + ")</span></h3>" +
            "<div class='gomb-sor'><button class='btn btn-elsodleges' data-uj-leolv='" + m.id + "'>+ Leolvasás</button>" +
            "<button class='btn btn-kicsi btn-masodlagos' data-mero-szerk='" + m.id + "'>Átnevezés</button></div></div>" +
            osszefog +
            "<div class='tabla-keret'><table class='adat-tabla mero-tabla'><thead><tr>" +
            "<th>Dátum</th><th class='jobbra'>Óra állás</th><th>Elszámolás</th><th class='jobbra'>Fogyasztás az elszámolás óta</th>" +
            "<th class='jobbra'>Éves fogyasztás</th><th class='jobbra'>Havi átlag</th><th>Megjegyzés</th></tr></thead>" +
            "<tbody>" + (t || "<tr><td colspan='7' class='ures-uzenet'>Még nincs leolvasás.</td></tr>") + "</tbody></table></div>" +
            "</section>";
    });
    el.innerHTML = h;

    U.$("#mero-uj", el).onclick = MeroNezet.ujMero;
    U.$$("[data-uj-leolv]", el).forEach(function (b) { b.onclick = function () { MeroNezet.leolvasas(b.dataset.ujLeolv); }; });
    U.$$("[data-mero-szerk]", el).forEach(function (b) { b.onclick = function () { MeroNezet.meroSzerk(b.dataset.meroSzerk); }; });
    U.$$("tr[data-mero]", el).forEach(function (tr) { tr.onclick = function () { MeroNezet.leolvasas(tr.dataset.mero, tr.dataset.id); }; });
};

MeroNezet.leolvasas = async function (meroId, id) {
    const m = S.adat.merok.find(function (x) { return x.id === meroId; });
    const r = id ? m.leolvasasok.find(function (x) { return x.id === id; }) : { datum: U.ma(), allas: null, bazis: false, elszamolas: "", megj: "" };
    const e = await U.urlap({
        cim: m.nev + (id ? " – leolvasás szerkesztése" : " – új leolvasás"),
        mezok: [
            { nev: "datum", felirat: "Dátum", tipus: "date", ertek: r.datum, kotelezo: true, fel: true },
            { nev: "allas", felirat: "Óra állás (" + m.egyseg + ")", tipus: "number", ertek: r.allas, kotelezo: true, fel: true },
            { nev: "bazis", felirat: "Ez elszámolás (innentől számol újra a fogyasztás)", tipus: "checkbox", ertek: r.bazis },
            { nev: "elszamolas", felirat: "Elszámolási időszak", ertek: r.elszamolas, segitseg: "Pl. 2024.11.27 - 2025.11.21" },
            { nev: "megj", felirat: "Megjegyzés", ertek: r.megj }
        ],
        torles: !!id
    });
    if (!e) return;
    if (e._torles) {
        const v = S.modosit(function (a) {
            const mm = a.merok.find(function (x) { return x.id === meroId; });
            mm.leolvasasok = mm.leolvasasok.filter(function (x) { return x.id !== id; });
        });
        U.toast("Leolvasás törölve.", { visszavon: v });
        return;
    }
    S.modosit(function (a) {
        const mm = a.merok.find(function (x) { return x.id === meroId; });
        if (id) {
            const x = mm.leolvasasok.find(function (y) { return y.id === id; });
            Object.assign(x, { datum: e.datum, allas: e.allas, bazis: e.bazis, elszamolas: e.elszamolas, megj: e.megj });
        } else {
            mm.leolvasasok.push({ id: S.ujId("m"), datum: e.datum, allas: e.allas, bazis: e.bazis, elszamolas: e.elszamolas, eves: null, megj: e.megj });
        }
    });
};

MeroNezet.ujMero = async function () {
    const e = await U.urlap({ cim: "Új mérőóra", mezok: [
        { nev: "nev", felirat: "Megnevezés", kotelezo: true, ertek: "Víz", fel: true },
        { nev: "egyseg", felirat: "Mértékegység", kotelezo: true, ertek: "m³", fel: true }] });
    if (!e) return;
    S.modosit(function (a) { a.merok.push({ id: S.ujId("o"), nev: e.nev, egyseg: e.egyseg, leolvasasok: [] }); });
};

MeroNezet.meroSzerk = async function (id) {
    const m = S.adat.merok.find(function (x) { return x.id === id; });
    const e = await U.urlap({ cim: "Mérőóra", mezok: [
        { nev: "nev", felirat: "Megnevezés", kotelezo: true, ertek: m.nev, fel: true },
        { nev: "egyseg", felirat: "Mértékegység", kotelezo: true, ertek: m.egyseg, fel: true }],
        torles: true, torlesFelirat: "Mérőóra törlése" });
    if (!e) return;
    if (e._torles) {
        if (!(await U.megerosit("Biztosan törlöd a(z) " + m.nev + " mérőórát és mind a " + m.leolvasasok.length + " leolvasását?", { veszelyes: true, igen: "Törlés" }))) return;
        const v = S.modosit(function (a) { a.merok = a.merok.filter(function (x) { return x.id !== id; }); });
        U.toast("Mérőóra törölve.", { visszavon: v });
        return;
    }
    S.modosit(function (a) { const x = a.merok.find(function (y) { return y.id === id; }); x.nev = e.nev; x.egyseg = e.egyseg; });
};

/* ================= AUTÓ (ASX lap) ================= */
const AutoNezet = { cim: "Autó" };

AutoNezet.render = function (el) {
    const l = S.adat.auto.slice().sort(function (a, b) { return (a.datum || "") < (b.datum || "") ? 1 : -1; });
    let t = "";
    l.forEach(function (x) {
        t += "<tr data-id='" + x.id + "'><td>" + U.datumHu(x.datum) + "</td><td class='o-hosszu'>" + U.nl2br(x.leiras) + "</td>" +
            "<td class='jobbra'>" + (x.km ? U.szam(x.km) + " km" : "") + "</td><td>" + U.nl2br(x.megj) + "</td></tr>";
    });
    el.innerHTML = "<section class='kartya'><div class='kartya-fej'><h3>Autó napló – " + U.esc(S.adat.autoNev || "ASX") + "</h3>" +
        "<div class='gomb-sor'><button class='btn btn-elsodleges' id='auto-uj'>+ Új bejegyzés</button>" +
        "<button class='btn btn-kicsi btn-masodlagos' id='auto-nev'>Átnevezés</button></div></div>" +
        "<div class='tabla-keret'><table class='adat-tabla'><thead><tr><th>Dátum</th><th>Leírás</th><th class='jobbra'>Km-óra</th><th>Megjegyzés</th></tr></thead><tbody>" +
        (t || "<tr><td colspan='4' class='ures-uzenet'>Még nincs bejegyzés.</td></tr>") + "</tbody></table></div></section>";
    U.$("#auto-uj", el).onclick = function () { AutoNezet.szerk(); };
    U.$("#auto-nev", el).onclick = async function () {
        const e = await U.urlap({ cim: "Autó neve", mezok: [{ nev: "nev", felirat: "Név", ertek: S.adat.autoNev || "ASX", kotelezo: true }] });
        if (e) S.modosit(function (a) { a.autoNev = e.nev; });
    };
    U.$$("tr[data-id]", el).forEach(function (tr) { tr.onclick = function () { AutoNezet.szerk(tr.dataset.id); }; });
};

AutoNezet.szerk = async function (id) {
    const x = id ? S.adat.auto.find(function (y) { return y.id === id; }) : { datum: U.ma(), leiras: "", km: null, megj: "" };
    const e = await U.urlap({
        cim: id ? "Bejegyzés szerkesztése" : "Új autós bejegyzés",
        mezok: [
            { nev: "datum", felirat: "Dátum", tipus: "date", ertek: x.datum, kotelezo: true, fel: true },
            { nev: "km", felirat: "Km-óra állás", tipus: "number", ertek: x.km, fel: true },
            { nev: "leiras", felirat: "Leírás", tipus: "textarea", ertek: x.leiras, kotelezo: true, sorok: 4 },
            { nev: "megj", felirat: "Megjegyzés", tipus: "textarea", ertek: x.megj, sorok: 2 }
        ],
        torles: !!id
    });
    if (!e) return;
    if (e._torles) {
        const v = S.modosit(function (a) { a.auto = a.auto.filter(function (y) { return y.id !== id; }); });
        U.toast("Bejegyzés törölve.", { visszavon: v });
        return;
    }
    S.modosit(function (a) {
        if (id) Object.assign(a.auto.find(function (y) { return y.id === id; }), { datum: e.datum, km: e.km, leiras: e.leiras, megj: e.megj });
        else a.auto.push({ id: S.ujId("a"), datum: e.datum, km: e.km, leiras: e.leiras, megj: e.megj });
    });
};

/* ================= RESTANCIA ================= */
const RestanciaNezet = { cim: "Restancia" };

RestanciaNezet.render = function (el) {
    const nyitott = S.adat.restancia.filter(function (r) { return !r.kesz; });
    const kesz = S.adat.restancia.filter(function (r) { return r.kesz; });
    function li(r) {
        return "<li class='" + (r.kesz ? "kesz" : "") + "' data-id='" + r.id + "'>" +
            "<label class='jelolo'><input type='checkbox' data-pipa='" + r.id + "'" + (r.kesz ? " checked" : "") + "></label>" +
            "<span class='rest-szoveg' data-szerk='" + r.id + "'>" + U.esc(r.szoveg) + "</span>" +
            "<button class='btn btn-ikon btn-kicsi' data-torol='" + r.id + "' aria-label='Törlés'>✕</button></li>";
    }
    el.innerHTML = "<section class='kartya keskeny-kartya'><div class='kartya-fej'><h3>Restancia – elvégzendő</h3>" +
        "<span class='halvany'>" + nyitott.length + " nyitott</span></div>" +
        "<form id='rest-urlap' class='inline-urlap'><input id='rest-uj' placeholder='Új tétel…' autocomplete='off'>" +
        "<button class='btn btn-elsodleges'>Hozzáad</button></form>" +
        "<ul class='rest-lista'>" + nyitott.map(li).join("") + "</ul>" +
        (kesz.length ? "<h4 class='alcim'>Elvégezve</h4><ul class='rest-lista'>" + kesz.map(li).join("") + "</ul>" : "") +
        "</section>";

    U.$("#rest-urlap", el).onsubmit = function (ev) {
        ev.preventDefault();
        const v = U.$("#rest-uj", el).value.trim();
        if (!v) return;
        S.modosit(function (a) { a.restancia.push({ id: S.ujId("r"), szoveg: v, kesz: false }); });
        setTimeout(function () { const i = U.$("#rest-uj"); if (i) i.focus(); }, 0);
    };
    const sec = U.$("section", el);   // a belső elemre kötünk, mert az el (main) megmarad újrarajzoláskor
    sec.addEventListener("change", function (ev) {
        const id = ev.target.dataset.pipa;
        if (!id) return;
        S.modosit(function (a) { const r = a.restancia.find(function (x) { return x.id === id; }); r.kesz = ev.target.checked; });
    });
    sec.addEventListener("click", async function (ev) {
        const t = ev.target.closest("[data-torol]");
        if (t) {
            const id = t.dataset.torol;
            const v = S.modosit(function (a) { a.restancia = a.restancia.filter(function (x) { return x.id !== id; }); });
            U.toast("Tétel törölve.", { visszavon: v });
            return;
        }
        const s = ev.target.closest("[data-szerk]");
        if (s) {
            const id = s.dataset.szerk;
            const r = S.adat.restancia.find(function (x) { return x.id === id; });
            const e = await U.urlap({ cim: "Tétel szerkesztése", mezok: [{ nev: "szoveg", felirat: "Szöveg", ertek: r.szoveg, kotelezo: true }] });
            if (e) S.modosit(function (a) { a.restancia.find(function (x) { return x.id === id; }).szoveg = e.szoveg; });
        }
    });
};

/* ================= SÚGÓ (HELP lap) ================= */
const SugoNezet = { cim: "Súgó" };

SugoNezet.render = function (el) {
    el.innerHTML =
        "<section class='kartya'><div class='kartya-fej'><h3>Saját jegyzetek</h3>" +
        "<button class='btn btn-masodlagos' id='sugo-szerk'>Szerkesztés</button></div>" +
        "<div class='szabad-szoveg'>" + (S.adat.sugo ? U.linkesit(S.adat.sugo) : "<p class='ures-uzenet'>Üres.</p>") + "</div></section>" +

        "<section class='kartya'><div class='kartya-fej'><h3>Az alkalmazás használata</h3></div><div class='szabad-szoveg'>" +
        "<p><b>Naptár</b> – induláskor ez nyílik meg. Sárga: ma. Narancs: esemény vagy fizetetlen számla. Piros: ma + van teendő. " +
        "Napra kattintva látod a napló tartalmát; <b>jobb klikk / dupla klikk / hosszan nyomva</b>: új esemény (több napra is).</p>" +
        "<p><b>Kiadások</b> – a sablongombok (I_VILL, I_GÁZ, …) a régi makrók megfelelői; a „Fizetve ma” gomb a régi dupla klikk. " +
        "A sablonok összegét az Adatok oldalon írhatod át.</p>" +
        "<p><b>Napló</b> – a régi H_napló: magától frissül, nem kell „Feltöltés” gomb.</p>" +
        "<p><b>Google Naptár</b> – Adatok → „ICS export”, majd calendar.google.com → Beállítások → Importálás és exportálás → a H_naplo.ics fájl → „H_napló” naptár. " +
        "Az azonosítók ugyanazok, mint az Excel makróé, így nem duplázódnak.</p>" +
        "<p><b>Szinkron</b> – Adatok → „Bejelentkezés Google-lel és szinkron bekapcsolása” mindkét eszközön, ugyanazzal a Google fiókkal. " +
        "Az app egy rejtett, csak neki fenntartott helyre ment a Google Drive-on; módosítás után magától feltölt, indításkor és visszatéréskor letölti az újabbat. " +
        "A fejlécben a ☁ gomb mutatja az állapotot: zöld = szinkronban, narancs = kattints a bejelentkezéshez (kb. óránként kellhet), piros = hiba. " +
        "Ha mindkét eszközön módosítottál, mielőtt szinkronizált volna, megkérdezi, melyik maradjon.</p>" +
        "</div></section>";
    U.$("#sugo-szerk", el).onclick = async function () {
        const e = await U.urlap({ cim: "Jegyzetek szerkesztése", szeles: true,
            mezok: [{ nev: "sugo", felirat: "Szöveg", tipus: "textarea", ertek: S.adat.sugo, sorok: 18 }] });
        if (e) S.modosit(function (a) { a.sugo = e.sugo; });
    };
};

/* ================= "TÖBB" MENÜ (mobilon) ================= */
const TobbNezet = { cim: "Továbbiak" };
TobbNezet.render = function (el) {
    const lapok = [["merok", "⚡", "Mérőórák", "Gáz, villany leolvasás"], ["auto", "🚗", "Autó", "ASX napló"],
        ["restancia", "📝", "Restancia", "Elvégzendők"], ["szef", "🔒", "Széf", "Jelszavak, adatok"],
        ["sugo", "❔", "Súgó", "Jegyzetek, használat"], ["adatok", "💾", "Adatok", "Mentés, import, ICS, sablonok"]];
    el.innerHTML = "<div class='csempe-racs'>" + lapok.map(function (l) {
        return "<a class='csempe' href='#" + l[0] + "'><span class='csempe-ikon'>" + l[1] + "</span><b>" + l[2] + "</b><small>" + l[3] + "</small></a>";
    }).join("") + "</div>";
};
