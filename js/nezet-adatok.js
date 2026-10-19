/* ==================================================================
   nezet-adatok.js – mentés, betöltés, szinkron, Excel import/export,
   Google Naptár (ICS), sablonok, telepítés
   (a régi "MENTÉS Drive-ra" és "Naptár import google-ban" gombok helyett)
   ================================================================== */
const AdatokNezet = { cim: "Adatok" };

AdatokNezet.render = async function (el) {
    const a = S.adat;
    const utolsoFajl = await S.dbGet("utolsoFajlMentes").catch(function () { return null; });
    const utolsoExport = await S.dbGet("utolsoExport").catch(function () { return null; });

    // Google Drive szinkron blokk
    let driveBlokk;
    if (!D.beallitas.be) {
        driveBlokk = "<p>Az app közvetlenül a Google Drive-odba szinkronizál, egy rejtett, csak neki fenntartott helyre " +
            "(a Drive-ban fájlként nem látszik, más fájljaidhoz nem fér hozzá). Kapcsold be mindkét eszközön ugyanazzal a Google fiókkal.</p>" +
            "<div class='gomb-sor'><button class='btn btn-elsodleges' id='ad-drive-be'>Bejelentkezés Google-lel és szinkron bekapcsolása</button></div>";
    } else {
        const cimke = {
            ok: "<span class='cimke cimke-ok'>szinkronban</span>",
            folyamatban: "<span class='cimke cimke-ma'>folyamatban…</span>",
            bejelentkezes: "<span class='cimke cimke-figy'>bejelentkezés kell</span>",
            offline: "<span class='cimke cimke-figy'>nincs internet</span>",
            hiba: "<span class='cimke cimke-hiba'>hiba</span>"
        }[D.allapotKod] || "";
        driveBlokk = "<p>Google Drive szinkron: " + cimke + "</p>" +
            (D.allapotKod === "hiba" && D.hibaUzenet ? "<p class='figyelmeztetes'>" + U.esc(D.hibaUzenet) + "</p>" : "") +
            "<p class='halvany kicsi'>Utolsó szinkron: " + (D.utolso ? U.idopontHu(D.utolso) : "még nem volt") +
            ". Módosítás után pár másodperccel magától feltölt, induláskor és visszatéréskor letölti az újabbat.</p>" +
            "<div class='gomb-sor'>" +
            (D.tokenErvenyes() ? "<button class='btn btn-elsodleges' id='ad-drive-most'>Szinkronizálás most</button>"
                : "<button class='btn btn-elsodleges' id='ad-drive-be'>Bejelentkezés Google-lel</button>") +
            "<button class='btn btn-masodlagos' id='ad-drive-ki'>Szinkron kikapcsolása</button></div>";
    }

    const sablonok = a.sablonok.map(function (s, i) {
        return "<tr data-sablon='" + s.id + "'><td><b>" + U.esc(s.kat) + "</b></td><td>" + U.esc(s.nev) + "</td><td class='jobbra'>" + U.ft(s.osszeg) + "</td>" +
            "<td>" + (s.mod === "ma" ? "fizetve ma" : "határidőt kér") + "</td>" +
            "<td class='nowrap'><button class='btn btn-ikon btn-kicsi' data-fel='" + i + "' aria-label='Feljebb'" + (i === 0 ? " disabled" : "") + ">▲</button>" +
            "<button class='btn btn-ikon btn-kicsi' data-le='" + i + "' aria-label='Lejjebb'" + (i === a.sablonok.length - 1 ? " disabled" : "") + ">▼</button></td></tr>";
    }).join("");

    el.innerHTML =
        "<div class='adatok-racs'>" +
        "<section class='kartya'><div class='kartya-fej'><h3>Állapot</h3></div>" +
        "<ul class='allapot-lista'>" +
        "<li><span>Kiadás tétel</span><b>" + U.szam(a.kiadasok.length) + "</b></li>" +
        "<li><span>Esemény</span><b>" + U.szam(a.esemenyek.length) + "</b></li>" +
        "<li><span>Mérőóra leolvasás</span><b>" + a.merok.reduce(function (s, m) { return s + m.leolvasasok.length; }, 0) + "</b></li>" +
        "<li><span>Restancia / autó bejegyzés</span><b>" + a.restancia.length + " / " + a.auto.length + "</b></li>" +
        "<li><span>Utolsó módosítás</span><b>" + U.idopontHu(a.modositva) + "</b></li>" +
        "<li><span>Utolsó kézi mentés</span><b>" + (utolsoExport ? U.idopontHu(utolsoExport) : "még nem volt") + "</b></li>" +
        "</ul></section>" +

        "<section class='kartya'><div class='kartya-fej'><h3>Szinkron és mentés</h3></div>" +
        "<h4 class='alcim'>Szinkron a másik eszközzel (Quick Share)</h4>" +
        "<p>Szerver és internet nélkül: amelyik eszközön utoljára szerkesztettél, onnan küldd át a másikra Quick Share-rel. " +
        "Ugyanez a fejléc <b>⇄ Szinkron</b> gombjával is elérhető; a narancs pötty jelzi, ha van el nem küldött módosítás.</p>" +
        "<div class='gomb-sor'><button class='btn btn-elsodleges' id='ad-q-kuld'>📤 Küldés</button>" +
        "<button class='btn btn-masodlagos' id='ad-q-fogad'>📥 Fogadás</button></div>" +
        "<h4 class='alcim'>Tartalék: Google Drive szinkron (nem kötelező)</h4>" + driveBlokk +
        "<h4 class='alcim'>Teljes biztonsági mentés</h4>" +
        "<p class='halvany kicsi'>Egy .zip fájl a Letöltésekbe: benne a teljes program és az adataid. Kicsomagolva Windowson az " +
        "<b>index.html</b> megnyitásával GitHub és internet nélkül is elindul. Visszatöltés: „Betöltés fájlból…” (a .zip-et is elfogadja).</p>" +
        "<div class='gomb-sor'>" +
        "<button class='btn btn-masodlagos' id='ad-letolt'>Teljes mentés (.zip)</button>" +
        "<button class='btn btn-masodlagos' id='ad-betolt'>Betöltés fájlból…</button>" +
        "</div></section>" +

        "<section class='kartya'><div class='kartya-fej'><h3>Google Naptár (ICS)</h3></div>" +
        "<p>Elkészíti a <b>H_naplo.ics</b> fájlt (2026-tól). Utána: calendar.google.com → Beállítások → Importálás és exportálás → " +
        "válaszd ki a fájlt és a „H_napló” naptárat → Importálás. Asztali böngészőben kell csinálni.</p>" +
        "<div class='gomb-sor'><button class='btn btn-elsodleges' id='ad-ics'>ICS export</button>" +
        "<a class='btn btn-masodlagos' href='https://calendar.google.com/calendar/u/0/r/settings/export' target='_blank' rel='noopener'>Google Naptár importálás ↗</a></div></section>" +

        "<section class='kartya'><div class='kartya-fej'><h3>Excel</h3></div>" +
        "<p>Az <b>S_KIADOK.xlsm</b> beolvasása lecseréli az itteni adatokat (a sablonok megmaradnak). Az export ugyanazokkal a lapokkal készít .xlsx fájlt.</p>" +
        "<div class='gomb-sor'><button class='btn btn-masodlagos' id='ad-xlsx-be'>Excel beolvasása…</button>" +
        "<button class='btn btn-masodlagos' id='ad-xlsx-ki'>Excel export (.xlsx)</button></div></section>" +

        "<section class='kartya szeles-kartya'><div class='kartya-fej'><h3>Gyors rögzítés sablonok</h3>" +
        "<button class='btn btn-elsodleges' id='ad-sablon-uj'>+ Új sablon</button></div>" +
        "<p class='halvany kicsi'>Ezek a Kiadások oldal gombjai (a régi I_VILL, I_GÁZ … makrók). Kattints egy sorra a szerkesztéshez.</p>" +
        "<div class='tabla-keret'><table class='adat-tabla'><thead><tr><th>kat</th><th>Megnevezés</th><th class='jobbra'>Összeg</th><th>Mód</th><th></th></tr></thead><tbody>" +
        (sablonok || "<tr><td colspan='5' class='ures-uzenet'>Nincs sablon.</td></tr>") + "</tbody></table></div></section>" +

        "<section class='kartya'><div class='kartya-fej'><h3>Telepítés</h3></div>" +
        (A.telepitett() ? "<p><span class='cimke cimke-ok'>telepítve</span> Az alkalmazás telepített módban fut.</p>" :
            "<p><b>Windows</b> (Chrome/Edge): a címsor jobb szélén a telepítés ikon, vagy a lenti gomb.<br>" +
            "<b>Android</b> (Chrome): ⋮ menü → „Alkalmazás telepítése” / „Hozzáadás a kezdőképernyőhöz”.</p>" +
            (A.telepitoPrompt ? "<button class='btn btn-elsodleges' id='ad-telepit'>Telepítés most</button>" : "")) +
        "</section>" +

        "<section class='kartya'><div class='kartya-fej'><h3>Veszélyes műveletek</h3></div>" +
        "<p class='halvany kicsi'>Törlés előtt ments!</p>" +
        "<button class='btn btn-veszely' id='ad-torol'>Minden adat törlése erről az eszközről</button></section>" +
        "</div>";

    // --- Gombok ---
    const on = function (id, fn) { const b = U.$("#" + id, el); if (b) b.onclick = fn; };
    on("ad-q-kuld", Q.kuld);
    on("ad-q-fogad", Q.fogad);
    on("ad-letolt", AdatokNezet.letolt);
    on("ad-betolt", AdatokNezet.betoltFajlbol);
    on("ad-drive-be", function () { D.bekapcsol(); });
    on("ad-drive-most", function () { D.szinkron({ kezi: true }); });
    on("ad-drive-ki", async function () {
        if (!(await U.megerosit("Kikapcsolod a szinkront ezen az eszközön? Az adatok itt és a felhőben is megmaradnak.", { igen: "Kikapcsolás" }))) return;
        await D.kijelentkezes();
        U.toast("Szinkron kikapcsolva.");
        A.frissit();
    });
    on("ad-ics", function () { const db = ICS.export(); U.toast("H_naplo.ics elkészült (" + db + " esemény)."); });
    on("ad-xlsx-be", AdatokNezet.excelBe);
    on("ad-xlsx-ki", async function () {
        if (S.adat.szef.titkos && S.szefSzoveg === null &&
            !(await U.megerosit("A széf zárolva van, ezért a HF lap tartalma nem kerül az exportba. Folytatod?"))) return;
        try { await X.exportal(); } catch (e) { U.uzenet("Hiba", e.message); }
    });
    on("ad-sablon-uj", function () { AdatokNezet.sablonSzerk(); });
    on("ad-telepit", A.telepit);
    on("ad-torol", async function () {
        if (!(await U.megerosit("Biztosan törlöd az ÖSSZES adatot erről az eszközről? Ez nem vonható vissza.", { veszelyes: true, igen: "Mindent törlök" }))) return;
        if (!(await U.megerosit("Utolsó figyelmeztetés: készült mentés?", { veszelyes: true, igen: "Igen, törlés" }))) return;
        await S.torolMindent();
        U.toast("Minden adat törölve.");
        location.hash = "#udvozlo";
        A.frissit();
    });
    U.$$("tr[data-sablon]", el).forEach(function (tr) {
        tr.onclick = function (ev) {
            const fel = ev.target.closest("[data-fel]"), le = ev.target.closest("[data-le]");
            if (fel || le) {
                const i = +(fel ? fel.dataset.fel : le.dataset.le), j = fel ? i - 1 : i + 1;
                S.modosit(function (x) { const t = x.sablonok[i]; x.sablonok[i] = x.sablonok[j]; x.sablonok[j] = t; });
                return;
            }
            AdatokNezet.sablonSzerk(tr.dataset.sablon);
        };
    });
};

/* Teljes mentés: a program összes fájlja + az adatok egy .zip-ben.
   A program fájljainak listáját a sw.js-ből olvassa (ott van az offline lista),
   így új fájlnál nem kell két helyen karbantartani. */
AdatokNezet.letolt = async function () {
    U.toast("Mentés készül…", { ido: 10000 });
    try {
        await X.betolt();                     // a SheetJS-ben lévő CFB tud zip-et írni
        const CFB = XLSX.CFB;
        const zip = CFB.utils.cfb_new({ root: "R" });
        const sw = await (await fetch("sw.js", { cache: "no-store" })).text();
        const lista = (sw.match(/ASSETS_TO_CACHE\s*=\s*\[([\s\S]*?)\]/) || [, ""])[1]
            .match(/"([^"]+)"/g).map(function (x) { return x.slice(1, -1); })
            .filter(function (x) { return x !== "./"; })
            .concat(["sw.js", "README.md"]);
        const hiany = [];
        for (const ut of lista) {
            try {
                const v = await fetch(ut, { cache: "no-store" });
                if (!v.ok) throw new Error(v.status);
                CFB.utils.cfb_add(zip, "KIADOK/" + ut, new Uint8Array(await v.arrayBuffer()));
            } catch (e) { hiany.push(ut); }
        }
        const enc = new TextEncoder();
        CFB.utils.cfb_add(zip, "KIADOK/adatok/kiadok-adatok.json", enc.encode(S.exportJson()));
        CFB.utils.cfb_add(zip, "KIADOK/OLVASSEL.txt", enc.encode(
            "KIADOK teljes mentés – " + U.idopontHu(U.most()) + "\r\n\r\n" +
            "adatok\\kiadok-adatok.json  = az adataid (ezt lehet betölteni az appba)\r\n" +
            "index.html                 = a program; kicsomagolás után Chrome-ban/Edge-ben megnyitva\r\n" +
            "                             internet és GitHub nélkül is fut (Windowson).\r\n\r\n" +
            "Visszaállítás: nyisd meg az index.html-t (vagy a telepített appot) → „Mentési fájl” /\r\n" +
            "Adatok → „Betöltés fájlból…” → adatok\\kiadok-adatok.json (vagy maga a .zip).\r\n\r\n" +
            "Figyelem: ha a Széf nincs jelszóval titkosítva, a jelszavaid olvashatóan vannak a json-ban!\r\n"));
        const d = new Date();
        const nev = "KIADOK_teljes_mentes_" + U.ma() + "_" + U.ketJegy(d.getHours()) + U.ketJegy(d.getMinutes()) + ".zip";
        U.letolt(nev, new Blob([CFB.write(zip, { type: "array", fileType: "zip" })], { type: "application/zip" }));
        S.dbSet("utolsoExport", U.most());
        U.toast("Teljes mentés letöltve: " + nev + (hiany.length ? " (hiányzott: " + hiany.join(", ") + ")" : ""), { ido: 5000 });
    } catch (e) {
        console.error(e);
        U.uzenet("Mentés", "Nem sikerült a teljes mentés: " + e.message + "\nAz adatokat a Küldés gombbal akkor is el tudod menteni.");
    }
};

/* Egy .zip mentésből kiveszi a kiadok-adatok.json tartalmát */
AdatokNezet.zipbolAdat = async function (file) {
    await X.betolt();
    const cfb = XLSX.CFB.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
    const i = cfb.FullPaths.findIndex(function (p) { return /kiadok-adatok[^\/]*\.json$/i.test(p); });
    if (i < 0) throw new Error("A .zip-ben nincs kiadok-adatok.json.");
    return new TextDecoder().decode(cfb.FileIndex[i].content);
};

/* Betöltés mentésből (.json / .txt / teljes mentés .zip) – összehasonlítással */
AdatokNezet.betoltFajlbol = async function () {
    const f = await U.fajlValaszt(".json,.txt,.zip,application/json,text/plain,application/zip");
    if (!f) return;
    let obj;
    try {
        const szoveg = /\.zip$/i.test(f.name) ? await AdatokNezet.zipbolAdat(f) : await f.text();
        obj = JSON.parse(szoveg);
        delete obj.kuldes;
        obj = S.jsonEllenoriz(obj);
    }
    catch (e) { U.uzenet("Hibás fájl", e.message); return; }
    await AdatokNezet.csereMegerositessel(obj, f.name);
};

AdatokNezet.csereMegerositessel = async function (obj, forras) {
    const regebbi = S.adat && S.adat.modositva && obj.modositva < S.adat.modositva;
    const szoveg = "Forrás: " + forras + "\n\n" +
        "A fájlban: " + obj.kiadasok.length + " kiadás, " + obj.esemenyek.length + " esemény, módosítva " + U.idopontHu(obj.modositva) + "\n" +
        (S.adat ? "Itt most: " + S.adat.kiadasok.length + " kiadás, " + S.adat.esemenyek.length + " esemény, módosítva " + U.idopontHu(S.adat.modositva) + "\n" : "") +
        (regebbi ? "\n⚠ A fájl RÉGEBBI, mint az itteni adat!\n" : "") +
        "\nA betöltés lecseréli az itteni adatokat.";
    if (!(await U.megerosit(szoveg, { cim: "Adatok betöltése", igen: "Betöltés", veszelyes: regebbi }))) return false;
    S.csere(obj);
    U.toast("Adatok betöltve.");
    return true;
};

AdatokNezet.excelBe = async function () {
    const f = await U.fajlValaszt(".xlsm,.xlsx,.xls");
    if (!f) return;
    U.toast("Excel beolvasása…", { ido: 10000 });
    try {
        const obj = await X.importal(f);
        obj.modositva = U.most();
        await AdatokNezet.csereMegerositessel(obj, f.name);
    } catch (e) {
        console.error(e);
        U.uzenet("Nem sikerült beolvasni", e.message);
    }
};

AdatokNezet.sablonSzerk = async function (id) {
    const s = id ? S.adat.sablonok.find(function (x) { return x.id === id; }) : { kat: "", nev: "", osszeg: null, mod: "kerdez" };
    const e = await U.urlap({
        cim: id ? "Sablon szerkesztése" : "Új sablon",
        mezok: [
            { nev: "kat", felirat: "Kategória (kat) – ez a gomb felirata", ertek: s.kat, kotelezo: true, lista: K.kategoriak(), fel: true },
            { nev: "osszeg", felirat: "Összeg (Ft)", tipus: "number", ertek: s.osszeg, fel: true },
            { nev: "nev", felirat: "Megnevezés", ertek: s.nev, kotelezo: true },
            { nev: "mod", felirat: "Mit csináljon a gomb?", tipus: "select", ertek: s.mod,
              opciok: [["kerdez", "Kérdezze meg a fizetési határidőt (alap: jövő hónap)"], ["ma", "Rögzítse fizetettként a mai nappal"]] }
        ],
        torles: !!id
    });
    if (!e) return;
    if (e._torles) {
        const v = S.modosit(function (a) { a.sablonok = a.sablonok.filter(function (x) { return x.id !== id; }); });
        U.toast("Sablon törölve.", { visszavon: v });
        return;
    }
    S.modosit(function (a) {
        if (id) Object.assign(a.sablonok.find(function (x) { return x.id === id; }), { kat: e.kat, nev: e.nev, osszeg: e.osszeg, mod: e.mod });
        else a.sablonok.push({ id: S.ujId("s"), kat: e.kat, nev: e.nev, osszeg: e.osszeg, mod: e.mod });
    });
};

/* ---------- Első indítás: üdvözlő képernyő ---------- */
const UdvozloNezet = { cim: "Üdvözöllek" };
UdvozloNezet.render = function (el) {
    el.innerHTML = "<section class='kartya keskeny-kartya kozep-szoveg udvozlo'>" +
        "<img src='ikon/ikon-192.png' alt='' width='96' height='96'>" +
        "<h2>KIADOK</h2><p>Kiadások, naptár, napló és előjegyzés – Excel nélkül.</p>" +
        "<p class='halvany'>Még nincs adat ezen az eszközön. Honnan töltsem be?</p>" +
        "<div class='gomb-oszlop'>" +
        "<button class='btn btn-elsodleges' id='u-drive'>☁ Google Drive-ról (szinkron)</button>" +
        "<button class='btn btn-masodlagos' id='u-json'>Mentési fájl (.json vagy teljes mentés .zip)</button>" +
        "<button class='btn btn-masodlagos' id='u-xlsx'>Excel: S_KIADOK.xlsm</button>" +
        "<button class='btn btn-masodlagos' id='u-ures'>Üres kezdés</button>" +
        "</div></section>";
    U.$("#u-drive", el).onclick = async function () {
        try {
            const ok = await D.elsoLetoltes();
            if (ok) { location.hash = "#naptar"; U.toast("Adatok betöltve a Google Drive-ról. A szinkron be van kapcsolva."); }
            else U.uzenet("Nincs adat a felhőben", "A Google Drive-on még nincs KIADOK adat. Előbb azon az eszközön kapcsold be a szinkront, ahol az adataid vannak (Adatok → Google Drive szinkron), utána itt próbáld újra.");
        } catch (e) { U.uzenet("Bejelentkezés", e.message); }
    };
    U.$("#u-json", el).onclick = async function () {
        const f = await U.fajlValaszt(".json,.txt,.zip,application/json,text/plain,application/zip");
        if (!f) return;
        try {
            const obj = JSON.parse(/\.zip$/i.test(f.name) ? await AdatokNezet.zipbolAdat(f) : await f.text());
            delete obj.kuldes;
            S.csere(S.jsonEllenoriz(obj)); location.hash = "#naptar"; U.toast("Adatok betöltve.");
        }
        catch (e) { U.uzenet("Hibás fájl", e.message); }
    };
    U.$("#u-xlsx", el).onclick = async function () {
        const f = await U.fajlValaszt(".xlsm,.xlsx,.xls");
        if (!f) return;
        U.toast("Excel beolvasása…", { ido: 10000 });
        try { const o = await X.importal(f); o.modositva = U.most(); S.csere(o); location.hash = "#naptar"; U.toast("Excel beolvasva."); }
        catch (e) { U.uzenet("Nem sikerült beolvasni", e.message); }
    };
    U.$("#u-ures", el).onclick = function () {
        const a = S.URES_ADAT(); a.sablonok = X.alapSablonok();
        S.csere(a); location.hash = "#naptar";
    };
};
