/* ==================================================================
   kuldes.js – szinkron a gép és a telefon között, szerver nélkül
   Küldés: az adatok egy fájlba kerülnek, amit Quick Share-rel (Bluetooth /
   közvetlen WiFi) átküldesz a másik eszközre.
   Fogadás: a kapott fájl betöltése – előtte megmutatja, melyik az újabb.

   A fájl neve pl.: KIADOK_PC_2026-10-19_1345.json (telefonon .txt, mert az
   Android megosztás .json-t nem enged – a tartalom ugyanaz).
   ================================================================== */
const Q = {};

Q.android = /Android/i.test(navigator.userAgent);
Q.eszkoz = Q.android ? "Telefon" : "PC";

/* Van-e még el nem küldött módosítás? (a ⇄ gomb pöttyéhez) */
Q.kuldetlen = async function () {
    if (!S.adat) return false;
    const k = await S.dbGet("kuldottVerzio").catch(function () { return null; });
    const f = await S.dbGet("fogadottVerzio").catch(function () { return null; });
    const v = S.adat.verzio || S.adat.modositva;
    // első alkalommal (új telepítés / első betöltés) a mostani állapot a kiindulás – ne mutasson rögtön pöttyöt
    if (!k && !f) { await S.dbSet("fogadottVerzio", v); return false; }
    return v !== k && v !== f;
};

Q.gombFrissit = async function () {
    const g = document.getElementById("btn-kuldes");
    if (!g) return;
    g.classList.toggle("hidden", !S.adat);
    const van = await Q.kuldetlen();
    g.classList.toggle("van-kuldetlen", van);
    g.title = van ? "Szinkron a másik eszközzel – van el nem küldött módosítás" : "Szinkron a másik eszközzel (Quick Share)";
};

Q.fajlnev = function () {
    const d = new Date();
    return "KIADOK_" + Q.eszkoz + "_" + U.ma() + "_" + U.ketJegy(d.getHours()) + U.ketJegy(d.getMinutes()) +
        (Q.android ? ".txt" : ".json");
};

Q.tartalom = function () {
    // a küldés adatait is beleírjuk, hogy a fogadó lássa, honnan és mikor jött
    const masolat = Object.assign({}, S.adat, { kuldes: { eszkoz: Q.eszkoz, ido: U.most() } });
    return JSON.stringify(masolat, null, 1);
};

Q._kuldesKesz = async function () {
    await S.dbSet("kuldottVerzio", S.adat.verzio || S.adat.modositva);
    await S.dbSet("utolsoKuldes", U.most());
    Q.gombFrissit();
};

/* ---------- Küldés ---------- */
Q.kuld = async function () {
    const nev = Q.fajlnev();
    if (Q.android) {
        // telefonon: megosztás menü → Quick Share → a laptop
        const f = new File([Q.tartalom()], nev, { type: "text/plain" });
        if (navigator.canShare && navigator.canShare({ files: [f] })) {
            try {
                await navigator.share({ files: [f], title: "KIADOK adatok" });
                await Q._kuldesKesz();
                U.toast("Elküldve. A gépen: ⇄ → Fogadás.");
            } catch (e) {
                if (e.name !== "AbortError") U.uzenet("Küldés", "A megosztás nem sikerült: " + e.message);
            }
            return;
        }
    }
    // Windowson: a fájl a Letöltések mappába kerül, onnan Quick Share-rel küldöd
    U.letolt(nev, Q.tartalom(), "application/json");
    await Q._kuldesKesz();
    U.modal({
        cim: "Küldés a telefonra",
        html: "<p class='modal-szoveg'>A fájl elkészült a <b>Letöltések</b> mappában:</p>" +
            "<p class='kod-sor'>" + U.esc(nev) + "</p>" +
            "<ol class='lepes-lista'>" +
            "<li>Nyisd meg a Letöltések mappát (Chrome-ban: Ctrl+J → „Megjelenítés mappában”).</li>" +
            "<li>Jobb klikk a fájlon → <b>Küldés Quick Share-rel</b> (vagy húzd rá a Quick Share ablakára) → válaszd a telefont.</li>" +
            "<li>A telefonon a KIADOK appban: <b>⇄ → Fogadás</b>, és válaszd ki a kapott fájlt.</li>" +
            "</ol>",
        gombok: [{ felirat: "Rendben", osztaly: "btn-elsodleges" }]
    });
};

/* ---------- Fogadás ---------- */
Q.fogad = async function () {
    const f = await U.fajlValaszt(".json,.txt,application/json,text/plain");
    if (!f) return;
    let obj;
    try { obj = S.jsonEllenoriz(JSON.parse(await f.text())); }
    catch (e) { U.uzenet("Hibás fájl", "Ez nem KIADOK adatfájl.\n" + e.message); return; }

    const kuld = obj.kuldes || null;
    delete obj.kuldes;
    const a = S.adat;
    const azonos = a && (obj.verzio || obj.modositva) === (a.verzio || a.modositva);
    const regebbi = a && obj.modositva < a.modositva;
    const sor = function (x) {
        return x.kiadasok.length + " kiadás, " + x.esemenyek.length + " esemény, " + x.restancia.length + " restancia";
    };
    const html =
        "<p class='modal-szoveg'><b>" + U.esc(f.name) + "</b>" +
        (kuld ? "<br><span class='halvany'>Küldte: " + U.esc(kuld.eszkoz) + ", " + U.idopontHu(kuld.ido) + "</span>" : "") + "</p>" +
        "<table class='adat-tabla kompakt'><thead><tr><th></th><th>Kapott fájl</th><th>Itt most</th></tr></thead><tbody>" +
        "<tr><td>Módosítva</td><td><b>" + U.idopontHu(obj.modositva) + "</b></td><td>" + (a ? U.idopontHu(a.modositva) : "–") + "</td></tr>" +
        "<tr><td>Tartalom</td><td>" + sor(obj) + "</td><td>" + (a ? sor(a) : "–") + "</td></tr>" +
        "</tbody></table>" +
        (azonos ? "<p class='figyelmeztetes'>A kapott fájl ugyanaz, mint ami itt van – nincs mit betölteni.</p>"
            : regebbi ? "<p class='figyelmeztetes'>⚠ A kapott fájl <b>RÉGEBBI</b>, mint az itteni adat! Betöltés után az itteni újabb módosítások elvesznek.</p>"
                : "<p class='modal-szoveg'>A kapott fájl az újabb. A betöltés lecseréli az itteni adatokat.</p>");

    let ok = false;
    await new Promise(function (resolve) {
        U.modal({
            cim: "Fogadás",
            html: html,
            gombok: azonos ? [{ felirat: "Bezár", osztaly: "btn-elsodleges" }] : [
                { felirat: "Mégsem", osztaly: "btn-masodlagos" },
                { felirat: regebbi ? "Mégis betöltöm" : "Betöltés", osztaly: regebbi ? "btn-veszely" : "btn-elsodleges", kattint: function () { ok = true; } }
            ],
            bezaraskor: resolve
        });
    });
    if (!ok) return;
    S.csere(obj);
    await S.dbSet("fogadottVerzio", S.adat.verzio || S.adat.modositva);
    await S.dbSet("utolsoFogadas", U.most());
    Q.gombFrissit();
    U.toast("Adatok betöltve" + (kuld ? " (" + kuld.eszkoz + ", " + U.idopontHu(kuld.ido) + ")" : "") + ".");
};

/* ---------- A ⇄ gomb ablaka ---------- */
Q.ablak = async function () {
    const uk = await S.dbGet("utolsoKuldes").catch(function () { return null; });
    const uf = await S.dbGet("utolsoFogadas").catch(function () { return null; });
    const van = await Q.kuldetlen();
    const masik = Q.android ? "gépre" : "telefonra";
    U.modal({
        cim: "Szinkron a " + masik,
        html:
            "<p class='modal-szoveg'>Quick Share-rel (Bluetooth / WiFi), szerver és internet nélkül. " +
            "Amelyik eszközön utoljára szerkesztettél, onnan <b>küldj</b>; a másikon <b>fogadj</b>.</p>" +
            (van ? "<p class='figyelmeztetes'>Ezen az eszközön van el nem küldött módosítás (utolsó: " + U.idopontHu(S.adat.modositva) + ").</p>" : "") +
            "<div class='kuldes-gombok'>" +
            "<button class='btn btn-elsodleges btn-nagy' id='q-kuld'>📤 Küldés a " + masik + "</button>" +
            "<button class='btn btn-masodlagos btn-nagy' id='q-fogad'>📥 Fogadás</button>" +
            "</div>" +
            "<p class='halvany kicsi'>Utoljára küldve innen: " + (uk ? U.idopontHu(uk) : "még nem") +
            " · fogadva ide: " + (uf ? U.idopontHu(uf) : "még nem") + "</p>",
        gombok: [{ felirat: "Bezár", osztaly: "btn-masodlagos" }],
        megnyitaskor: function (t) {
            U.$("#q-kuld", t).onclick = function () { U.modalBezar(); Q.kuld(); };
            U.$("#q-fogad", t).onclick = function () { U.modalBezar(); Q.fogad(); };
        }
    });
};

Q.indit = function () {
    const g = document.getElementById("btn-kuldes");
    if (g) g.onclick = Q.ablak;

    S.figyel(Q.gombFrissit);
    Q.gombFrissit();
};
