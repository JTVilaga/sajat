/* ==================================================================
   drive-sync.js – közvetlen szinkron a Google Drive-val
   - Egyetlen fájl: kiadok-adatok.json a Drive rejtett "appDataFolder"
     mappájában. Csak ez az app látja, nem keverhető össze más fájlokkal.
   - Bejelentkezés: Google Identity Services (GIS), csak a drive.appdata
     jogosultsággal (a Drive többi fájljához nem fér hozzá).
   - A Google hozzáférési kulcsa (token) kb. 1 óráig érvényes; utána egy
     kattintás kell a fejlécben lévő ☁ gombra.

   Szinkron szabály (minden eszköz megjegyzi, melyik állapotnál szinkronizált
   utoljára = "alap"):
     - csak itt változott          → feltölti
     - csak a felhőben változott   → letölti
     - mindkét helyen változott    → megkérdezi, melyik maradjon
   ================================================================== */
const D = {
    CLIENT_ID: "34774312699-a85i32hssmt7u9cf3bc3tvjgdlc8ase2.apps.googleusercontent.com",
    SCOPE: "https://www.googleapis.com/auth/drive.appdata",
    FAJLNEV: "kiadok-adatok.json",
    token: null,
    lejar: 0,
    allapotKod: "ki",       // ki | bejelentkezes | folyamatban | ok | hiba | offline
    utolso: null,           // utolsó sikeres szinkron ideje
    _fut: false, _ujra: false, _tokenKliens: null, _tokenVar: null
};

/* ---------- Beállítások tárolása ezen az eszközön ---------- */
// be: bekapcsolva-e; fajlId: a felhőbeli fájl; alap: az utoljára szinkronizált verziójel; utolso: mikor
D.beallitas = { be: false, fajlId: null, alap: null, utolso: null };

D.betolt = async function () {
    const b = await S.dbGet("driveSync").catch(function () { return null; });
    if (b) D.beallitas = Object.assign(D.beallitas, b);
    D.utolso = D.beallitas.utolso;
    // a token egy órán át újraindítás után is használható
    try {
        const t = JSON.parse(localStorage.getItem("kiadokDriveToken") || "null");
        if (t && t.lejar > Date.now() + 60000) { D.token = t.token; D.lejar = t.lejar; }
    } catch (e) { /* nincs localStorage – nem baj */ }
};
D.ment = function () { return S.dbSet("driveSync", D.beallitas); };

/* ---------- Google bejelentkezés (GIS) ---------- */
D._gisBetolt = function () {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (D._gisIgeret) return D._gisIgeret;
    D._gisIgeret = new Promise(function (resolve, reject) {
        const s = document.createElement("script");
        s.src = "https://accounts.google.com/gsi/client";
        s.async = true;
        s.onload = function () { resolve(); };
        s.onerror = function () { D._gisIgeret = null; reject(new Error("A Google bejelentkezés nem tölthető be (nincs internet?).")); };
        document.head.appendChild(s);
    });
    return D._gisIgeret;
};

D.tokenErvenyes = function () { return !!D.token && D.lejar > Date.now() + 60000; };

/* Bejelentkezés – csak felhasználói kattintásból hívható (különben a böngésző letiltja a felugró ablakot) */
D.bejelentkezes = async function () {
    await D._gisBetolt();
    if (!D._tokenKliens) {
        D._tokenKliens = google.accounts.oauth2.initTokenClient({
            client_id: D.CLIENT_ID,
            scope: D.SCOPE,
            callback: function (v) {
                const varo = D._tokenVar; D._tokenVar = null;
                if (v.error) { if (varo) varo.reject(new Error(v.error_description || v.error)); return; }
                D.token = v.access_token;
                D.lejar = Date.now() + (Number(v.expires_in) || 3600) * 1000;
                try { localStorage.setItem("kiadokDriveToken", JSON.stringify({ token: D.token, lejar: D.lejar })); } catch (e) { }
                if (varo) varo.resolve();
            },
            error_callback: function (e) {
                const varo = D._tokenVar; D._tokenVar = null;
                if (varo) varo.reject(new Error(e.type === "popup_closed" ? "A bejelentkezés ablakát bezártad." : (e.message || e.type)));
            }
        });
    }
    await new Promise(function (resolve, reject) {
        D._tokenVar = { resolve: resolve, reject: reject };
        // ha már egyszer engedélyezted, az ablak magától bezáródik
        D._tokenKliens.requestAccessToken({ prompt: D.beallitas.be ? "" : "consent" });
    });
};

D.kijelentkezes = async function () {
    if (D.token && window.google && google.accounts) google.accounts.oauth2.revoke(D.token, function () { });
    D.token = null; D.lejar = 0;
    try { localStorage.removeItem("kiadokDriveToken"); } catch (e) { }
    D.beallitas = { be: false, fajlId: null, alap: null, utolso: null };
    await D.ment();
    D.allapot("ki");
};

/* ---------- Drive API hívások ---------- */
D._api = async function (url, opciok) {
    opciok = opciok || {};
    opciok.headers = Object.assign({ Authorization: "Bearer " + D.token }, opciok.headers || {});
    const v = await fetch(url, opciok);
    if (v.status === 401) {
        D.token = null; D.lejar = 0;
        try { localStorage.removeItem("kiadokDriveToken"); } catch (e) { }
        const h = new Error("Lejárt a bejelentkezés."); h.kod = 401; throw h;
    }
    if (!v.ok) {
        let uz = v.status + " " + v.statusText;
        try { const j = await v.json(); if (j.error && j.error.message) uz = j.error.message; } catch (e) { }
        throw new Error("Drive hiba: " + uz);
    }
    return v;
};

/* A felhőben lévő fájl adatai (vagy null, ha még nincs) */
D._felhoFajl = async function () {
    const q = encodeURIComponent("name='" + D.FAJLNEV + "' and trashed=false");
    const v = await D._api("https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=" + q +
        "&fields=files(id,modifiedTime,appProperties)&orderBy=modifiedTime desc");
    const j = await v.json();
    return j.files && j.files.length ? j.files[0] : null;
};

D._letolt = async function (id) {
    const v = await D._api("https://www.googleapis.com/drive/v3/files/" + id + "?alt=media");
    return S.jsonEllenoriz(await v.json());
};

D._feltolt = async function (id) {
    const meta = { appProperties: { verzio: D._ver(S.adat), modositva: S.adat.modositva } };
    if (!id) { meta.name = D.FAJLNEV; meta.parents = ["appDataFolder"]; }
    const hatar = "kiadok" + Math.random().toString(36).slice(2);
    const torzs = "--" + hatar + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(meta) +
        "\r\n--" + hatar + "\r\nContent-Type: application/json\r\n\r\n" + S.exportJson() + "\r\n--" + hatar + "--";
    const url = id
        ? "https://www.googleapis.com/upload/drive/v3/files/" + id + "?uploadType=multipart&fields=id"
        : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id";
    const v = await D._api(url, {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "multipart/related; boundary=" + hatar },
        body: torzs
    });
    return (await v.json()).id;
};

/* Egy adatállapot azonosítója: az egyedi verziójel (régebbi adatnál a módosítás ideje) */
D._ver = function (a) { return (a && (a.verzio || a.modositva)) || null; };

/* ---------- A szinkron maga ---------- */
D.szinkron = async function (opciok) {
    opciok = opciok || {};
    if (!D.beallitas.be || !S.adat) return;
    if (!navigator.onLine) { D.allapot("offline"); return; }
    if (!D.tokenErvenyes()) { D.allapot("bejelentkezes"); return; }
    if (D._fut) { D._ujra = true; return; }
    // ha épp egy ablak (pl. szerkesztés) van nyitva, nem zavarjuk – kicsit később újra
    if (U.modalNyitva() && !opciok.kezi) { setTimeout(D.szinkron, 3000); return; }
    D._fut = true;
    D.allapot("folyamatban");
    try {
        const felho = await D._felhoFajl();
        const helyi = D._ver(S.adat);
        const alap = D.beallitas.alap;

        if (!felho) {
            // még nincs a felhőben → feltöltjük az itteni adatot
            D.beallitas.fajlId = await D._feltolt(null);
            D.beallitas.alap = helyi;
        } else {
            D.beallitas.fajlId = felho.id;
            const ap = felho.appProperties || {};
            const felhoMod = ap.verzio || ap.modositva || null;

            if (felhoMod === helyi) {
                D.beallitas.alap = helyi;                       // egyformák
            } else if (alap && felhoMod === alap) {
                await D._feltolt(felho.id);                      // csak itt változott
                D.beallitas.alap = helyi;
            } else if (alap && helyi === alap) {
                const obj = await D._letolt(felho.id);           // csak a felhőben változott
                S.csere(obj, { szinkronbol: true });
                D.beallitas.alap = D._ver(S.adat);
                U.toast("Frissítve a felhőből (" + U.idopontHu(S.adat.modositva) + ").");
            } else {
                // mindkét helyen változott, vagy ezen az eszközön ez az első szinkron
                const obj = await D._letolt(felho.id);
                const dontes = await D._utkozes(obj);
                if (dontes === "felho") {
                    S.csere(obj, { szinkronbol: true });
                    D.beallitas.alap = D._ver(S.adat);
                    U.toast("A felhőben lévő adat betöltve.");
                } else if (dontes === "helyi") {
                    await D._feltolt(felho.id);
                    D.beallitas.alap = D._ver(S.adat);
                    U.toast("Az itteni adat feltöltve a felhőbe.");
                } else {
                    D.allapot("hiba", "Szinkron felfüggesztve – döntésre vár");
                    return;
                }
            }
        }
        D.beallitas.utolso = D.utolso = U.most();
        await D.ment();
        D.allapot("ok");
    } catch (e) {
        console.error(e);
        if (e.kod === 401) D.allapot("bejelentkezes");
        else D.allapot("hiba", e.message);
        if (opciok.kezi && e.kod !== 401) U.uzenet("Szinkron hiba", e.message);
    } finally {
        D._fut = false;
        if (D._ujra) { D._ujra = false; setTimeout(D.szinkron, 200); }
    }
};

/* Ütközés: mindkét helyen változott – a felhasználó dönt */
D._utkozes = function (felhoAdat) {
    return new Promise(function (resolve) {
        let dontes = null;
        const a = S.adat;
        U.modal({
            cim: "Melyik adat maradjon?",
            html: "<p class='modal-szoveg'>Ezen az eszközön és a felhőben (a másik eszközről) is van olyan módosítás, ami a másikon nincs meg.</p>" +
                "<table class='adat-tabla kompakt'><thead><tr><th></th><th>Felhő</th><th>Itt</th></tr></thead><tbody>" +
                "<tr><td>Módosítva</td><td>" + U.idopontHu(felhoAdat.modositva) + "</td><td>" + U.idopontHu(a.modositva) + "</td></tr>" +
                "<tr><td>Kiadás</td><td>" + felhoAdat.kiadasok.length + "</td><td>" + a.kiadasok.length + "</td></tr>" +
                "<tr><td>Esemény</td><td>" + felhoAdat.esemenyek.length + "</td><td>" + a.esemenyek.length + "</td></tr>" +
                "<tr><td>Restancia</td><td>" + felhoAdat.restancia.length + "</td><td>" + a.restancia.length + "</td></tr>" +
                "</tbody></table>" +
                "<p class='halvany kicsi'>Amelyiket nem választod, az elvész. Ha bizonytalan vagy, előbb az Adatok oldalon ments le egy példányt.</p>",
            gombok: [
                { felirat: "Később", osztaly: "btn-masodlagos" },
                { felirat: "Az itteni marad", osztaly: "btn-masodlagos", kattint: function () { dontes = "helyi"; } },
                { felirat: "Felhőből betöltöm", osztaly: "btn-elsodleges", kattint: function () { dontes = "felho"; } }
            ],
            bezaraskor: function () { resolve(dontes); }
        });
    });
};

/* Módosítás után kis késleltetéssel feltölt */
D.modositasUtan = U.debounce(function () { D.szinkron(); }, 2500);

/* ---------- Bekapcsolás (Adatok oldal / fejléc gomb) ---------- */
D.bekapcsol = async function () {
    try {
        await D.bejelentkezes();
        const elso = !D.beallitas.be;
        D.beallitas.be = true;
        if (elso) D.beallitas.alap = null;   // első alkalommal az ütközés-ellenőrzés dönt
        await D.ment();
        await D.szinkron({ kezi: true });
    } catch (e) {
        U.uzenet("Bejelentkezés", e.message);
        D.allapot(D.beallitas.be ? "bejelentkezes" : "ki");
    }
};

/* Új (üres) eszközön: bejelentkezés és letöltés a felhőből. true = sikerült, false = nincs a felhőben adat */
D.elsoLetoltes = async function () {
    await D.bejelentkezes();
    const felho = await D._felhoFajl();
    if (!felho) return false;
    const obj = await D._letolt(felho.id);
    S.csere(obj, { szinkronbol: true });
    D.beallitas = { be: true, fajlId: felho.id, alap: D._ver(S.adat), utolso: U.most() };
    D.utolso = D.beallitas.utolso;
    await D.ment();
    D.allapot("ok");
    return true;
};

/* Fejléc ☁ gomb: ha kell, bejelentkezik, egyébként szinkronizál */
D.gombKattintas = function () {
    if (!D.beallitas.be) { location.hash = "#adatok"; return; }
    if (!D.tokenErvenyes()) { D.bekapcsol(); return; }
    D.szinkron({ kezi: true });
};

/* ---------- Állapotjelző a fejlécben ---------- */
D.allapot = function (kod, uzenet) {
    D.allapotKod = kod;
    D.hibaUzenet = uzenet || "";
    const g = document.getElementById("btn-szinkron");
    if (!g) return;
    const szoveg = {
        ki: "☁ Szinkron ki",
        bejelentkezes: "☁ Bejelentkezés",
        folyamatban: "☁ Szinkron…",
        ok: "☁ " + (D.utolso ? D.utolso.slice(11, 16) : "OK"),
        hiba: "☁ Hiba",
        offline: "☁ Offline"
    }[kod];
    g.textContent = szoveg;
    g.className = "btn btn-kicsi szinkron-gomb sz-" + kod + (kod === "ki" ? " hidden" : "");   // kikapcsolva nem látszik
    g.title = {
        ki: "A Google Drive szinkron nincs bekapcsolva (Adatok oldal)",
        bejelentkezes: "Kattints a Google bejelentkezéshez – utána szinkronizál",
        folyamatban: "Szinkronizálás folyamatban",
        ok: "Szinkronban a Google Drive-val – utoljára: " + U.idopontHu(D.utolso) + ". Kattints az azonnali szinkronhoz.",
        hiba: "Szinkron hiba: " + (uzenet || "") + " – kattints az újrapróbáláshoz",
        offline: "Nincs internet – a módosítások itt megmaradnak, és később feltöltődnek"
    }[kod];
    if (A.aktualis === "adatok" && !U.modalNyitva() && kod !== "folyamatban") A.frissit();
    if (kod === "ok" || kod === "ki") Q.gombFrissit();   // a ⇄ gomb pöttye a Drive szinkront is figyelembe veszi
};

/* ---------- Indítás ---------- */
D.indit = async function () {
    await D.betolt();
    const g = document.getElementById("btn-szinkron");
    if (g) g.onclick = D.gombKattintas;
    // visszatéréskor (pl. telefonon újra előtérbe kerül) ellenőriz, elhagyáskor feltölt
    document.addEventListener("visibilitychange", function () {
        if (!U.modalNyitva()) D.szinkron();
    });
    window.addEventListener("online", function () { D.szinkron(); });

    if (!D.beallitas.be) { D.allapot("ki"); return; }
    D.allapot(D.tokenErvenyes() ? "ok" : "bejelentkezes");
    D.szinkron();
};
