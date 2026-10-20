/* ==================================================================
   store.js – adattárolás
   - Az összes adat egy JSON objektum (S.adat), a böngésző IndexedDB-jében.
   - Minden módosítás S.modosit(...)-on keresztül megy: ment, frissíti a
     nézetet, és (ha be van állítva) automatikusan kiírja a mentési fájlba.
   - Széf titkosítás: PBKDF2 + AES-GCM (Web Crypto).
   ================================================================== */
const S = {
    adat: null,
    figyelok: [],
    szefKulcs: null,        // feloldott széf kulcsa (csak memóriában)
    szefSzoveg: null        // feloldott széf tartalma (csak memóriában)
};

S.URES_ADAT = function () {
    return {
        app: "KIADOK", verzio: 1, modositva: U.most(), forras: "",
        kiadasok: [], esemenyek: [], naploMegj: {}, restancia: [],
        merok: [
            { id: S.ujId("o"), nev: "Gáz", egyseg: "m³", leolvasasok: [] },
            { id: S.ujId("o"), nev: "Villany", egyseg: "kWh", leolvasasok: [] }
        ],
        auto: [], sablonok: [], szef: { titkos: false, szoveg: "" }, sugo: "",
        jegyzet: ""          // általános, dátumtól független jegyzet (naptár oldalsáv)
    };
};

S.ujId = function (elotag) {
    return (elotag || "x") + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
};

/* ---------- IndexedDB (kulcs-érték) ---------- */
S._db = null;
S.dbNyit = function () {
    if (S._db) return Promise.resolve(S._db);
    return new Promise(function (resolve, reject) {
        const req = indexedDB.open("kiadok", 1);
        req.onupgradeneeded = function () { req.result.createObjectStore("kv"); };
        req.onsuccess = function () { S._db = req.result; resolve(S._db); };
        req.onerror = function () { reject(req.error); };
    });
};
S.dbGet = function (kulcs) {
    return S.dbNyit().then(function (db) {
        return new Promise(function (resolve, reject) {
            const r = db.transaction("kv").objectStore("kv").get(kulcs);
            r.onsuccess = function () { resolve(r.result); };
            r.onerror = function () { reject(r.error); };
        });
    });
};
S.dbSet = function (kulcs, ertek) {
    return S.dbNyit().then(function (db) {
        return new Promise(function (resolve, reject) {
            const tx = db.transaction("kv", "readwrite");
            tx.objectStore("kv").put(ertek, kulcs);
            tx.oncomplete = function () { resolve(); };
            tx.onerror = function () { reject(tx.error); };
        });
    });
};
S.dbDel = function (kulcs) {
    return S.dbNyit().then(function (db) {
        return new Promise(function (resolve) {
            const tx = db.transaction("kv", "readwrite");
            tx.objectStore("kv").delete(kulcs);
            tx.oncomplete = function () { resolve(); };
        });
    });
};

/* ---------- Betöltés indításkor ---------- */
S.betolt = function () {
    return S.dbGet("adat").then(function (a) {
        S.adat = a || null;
        if (S.adat) S.normalizal(S.adat);
        // a régi (1.0 / 2.0) fájlos-mappás mentés beállításai már nem kellenek
        S.dbDel("fajlHandle"); S.dbDel("mappaHandle");
        // Tartós tárolás kérése, hogy a böngésző ne törölje az adatokat
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
        return S.adat;
    });
};

/* Hiányzó mezők pótlása (régebbi / kézzel szerkesztett mentésekhez) */
S.normalizal = function (a) {
    const ures = S.URES_ADAT();
    Object.keys(ures).forEach(function (k) { if (a[k] === undefined) a[k] = ures[k]; });
    a.merok.forEach(function (m) { if (!m.leolvasasok) m.leolvasasok = []; });
    return a;
};

/* ---------- Módosítás + mentés ---------- */
S.figyel = function (fn) { S.figyelok.push(fn); };

S._mentIdb = U.debounce(function () {
    S.dbSet("adat", S.adat).then(function () {
        S.allapot("mentve");
    }).catch(function (e) {
        console.error(e); S.allapot("hiba");
        U.toast("Mentési hiba: " + e.message);
    });
}, 300);

/* fn(adat) végzi a módosítást. Visszaad egy visszavonó függvényt. */
S.modosit = function (fn, opciok) {
    opciok = opciok || {};
    const elotte = JSON.stringify(S.adat);
    fn(S.adat);
    S.adat.modositva = U.most();
    S.adat.verzio = S.ujId("v");   // egyedi verziójel – a szinkron ezzel hasonlít (a másodperc nem elég pontos)
    S.mentes();
    D.modositasUtan();      // Google Drive szinkron (ha be van kapcsolva)
    if (!opciok.csendes) S.figyelok.forEach(function (f) { f(); });
    return function visszavon() {
        S.adat = JSON.parse(elotte);
        S.adat.modositva = U.most();
        S.adat.verzio = S.ujId("v");
        S.mentes();
        D.modositasUtan();
        S.figyelok.forEach(function (f) { f(); });
    };
};

S.mentes = function () {
    S.allapot("mentes");
    S._mentIdb();
};

/* Teljes csere (import / betöltés fájlból / letöltés a felhőből) */
S.csere = function (uj, opciok) {
    S.adat = S.normalizal(uj);
    S.szefKulcs = null; S.szefSzoveg = null;
    S.mentes();
    // kézi betöltés/import után a felhőbe is felkerül (a szinkron ütközésnél rákérdez)
    if (!(opciok && opciok.szinkronbol)) D.modositasUtan();
    S.figyelok.forEach(function (f) { f(); });
};

S.torolMindent = async function () {
    S.adat = null; S.szefZar();
    await S.dbDel("adat");
};

S.allapot = function (a) {
    const el = document.getElementById("mentes-allapot");
    if (!el) return;
    const szoveg = { mentes: "Mentés…", mentve: "✓ Mentve", hiba: "⚠ Mentési hiba" }[a] || "";
    el.textContent = szoveg;
    el.className = "mentes-allapot " + a;
};

/* ---------- Exportálható JSON ---------- */
S.exportJson = function () {
    return JSON.stringify(S.adat, null, 1);
};

S.jsonEllenoriz = function (obj) {
    if (!obj || obj.app !== "KIADOK" || !Array.isArray(obj.kiadasok)) {
        throw new Error("Ez nem KIADOK mentési fájl.");
    }
    return S.normalizal(obj);
};

/* ---------- Széf titkosítás ---------- */
S._b64 = function (buf) {
    const b = new Uint8Array(buf); let s = "";
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
};
S._unb64 = function (s) {
    const bin = atob(s); const b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
};
S._kulcsKeszit = async function (jelszo, salt) {
    const alap = await crypto.subtle.importKey("raw", new TextEncoder().encode(jelszo), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt, iterations: 250000, hash: "SHA-256" },
        alap, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
};
S.szefTitkosit = async function (szoveg, kulcs, salt) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const titkos = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, kulcs, new TextEncoder().encode(szoveg));
    return { titkos: true, salt: S._b64(salt), iv: S._b64(iv), adat: S._b64(titkos) };
};
S.szefFelold = async function (jelszo) {
    const sz = S.adat.szef;
    const salt = S._unb64(sz.salt);
    const kulcs = await S._kulcsKeszit(jelszo, salt);
    try {
        const nyers = await crypto.subtle.decrypt({ name: "AES-GCM", iv: S._unb64(sz.iv) }, kulcs, S._unb64(sz.adat));
        S.szefKulcs = kulcs;
        S.szefSzoveg = new TextDecoder().decode(nyers);
        return true;
    } catch (e) {
        return false;   // rossz jelszó
    }
};
S.szefJelszoBeallit = async function (jelszo, szoveg) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const kulcs = await S._kulcsKeszit(jelszo, salt);
    const t = await S.szefTitkosit(szoveg, kulcs, salt);
    S.szefKulcs = kulcs; S.szefSzoveg = szoveg;
    S.modosit(function (a) { a.szef = t; });
};
S.szefMent = async function (szoveg) {
    if (S.adat.szef.titkos) {
        const t = await S.szefTitkosit(szoveg, S.szefKulcs, S._unb64(S.adat.szef.salt));
        S.szefSzoveg = szoveg;
        S.modosit(function (a) { a.szef = t; });
    } else {
        S.modosit(function (a) { a.szef = { titkos: false, szoveg: szoveg }; });
    }
};
S.szefZar = function () { S.szefKulcs = null; S.szefSzoveg = null; };
