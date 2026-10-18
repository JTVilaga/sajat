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
    mappa: null,            // automatikus mentési mappa (csak asztali Chrome/Edge)
    fajlEngedely: false,
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
        auto: [], sablonok: [], szef: { titkos: false, szoveg: "" }, sugo: ""
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
        S.dbDel("fajlHandle");   // a régi (1.0-s) egyfájlos beállítás már nem használt
        return S.dbGet("mappaHandle").catch(function () { return null; });
    }).then(function (h) {
        S.mappa = h || null;
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
    S.mentes();
    if (!opciok.csendes) S.figyelok.forEach(function (f) { f(); });
    return function visszavon() {
        S.adat = JSON.parse(elotte);
        S.adat.modositva = U.most();
        S.mentes();
        S.figyelok.forEach(function (f) { f(); });
    };
};

S.mentes = function () {
    S.allapot("mentes");
    S._mentIdb();
    S._fajlbaIr();
};

/* Teljes csere (import / betöltés fájlból) */
S.csere = function (uj) {
    S.adat = S.normalizal(uj);
    S.szefKulcs = null; S.szefSzoveg = null;
    S.mentes();
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
    el.textContent = szoveg + (S.mappa && S.fajlEngedely && a === "mentve" ? " + mappa" : "");
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

/* ---------- Automatikus mentés egy MAPPÁBA (File System Access API) ----------
   Windowson (Chrome/Edge) egy mappát választasz, pl. a Google Drive for desktop
   meghajtóján (G:\Saját meghajtó\KIADOK). Az app:
   - minden módosítás után kiírja a mappába a kiadok-adatok.json fájlt,
   - indításkor és visszatéréskor megnézi, van-e a mappában ÚJABB mentés
     (pl. a telefonról megosztott kiadok-adatok_ÉÉÉÉ-HH-NN.txt), és felajánlja. */
S.MENTES_NEV = "kiadok-adatok.json";
S.MENTES_MINTA = /^kiadok-adatok.*\.(json|txt)$/i;   // ezeket a fájlokat nézi meg a mappában

S.mappaApiVan = function () { return "showDirectoryPicker" in window; };

S.mappaBeallit = async function () {
    const h = await window.showDirectoryPicker({ id: "kiadok-mentes", mode: "readwrite" });
    S.mappa = h; S.fajlEngedely = true;
    await S.dbSet("mappaHandle", h);
    return h;
};

S.mappaLeallit = async function () {
    S.mappa = null; S.fajlEngedely = false;
    await S.dbDel("mappaHandle");
};

/* Indításkor: megvan-e még az engedély? Ha nem, kattintás kell hozzá. */
S.fajlEngedelyEllenoriz = async function () {
    if (!S.mappa || !S.mappa.queryPermission) return false;
    try {
        const p = await S.mappa.queryPermission({ mode: "readwrite" });
        S.fajlEngedely = p === "granted";
    } catch (e) { S.fajlEngedely = false; }
    return S.fajlEngedely;
};
S.fajlEngedelyKer = async function () {
    if (!S.mappa) return false;
    const p = await S.mappa.requestPermission({ mode: "readwrite" });
    S.fajlEngedely = p === "granted";
    return S.fajlEngedely;
};

S._fajlbaIrMost = async function () {
    if (!S.mappa || !S.fajlEngedely || !S.adat) return;
    try {
        const fh = await S.mappa.getFileHandle(S.MENTES_NEV, { create: true });
        const w = await fh.createWritable();
        await w.write(S.exportJson());
        await w.close();
        await S.dbSet("utolsoFajlMentes", U.most());
    } catch (e) {
        console.error(e);
        S.fajlEngedely = false;
        U.toast("Nem sikerült a mappába menteni: " + e.message);
    }
};
S._fajlbaIr = U.debounce(function () { S._fajlbaIrMost(); }, 1500);

/* A mappában lévő mentések közül a legújabb, ha újabb az itteninél.
   Visszaad: { obj, nev } vagy null */
S.mappabolUjabb = async function () {
    if (!S.mappa || !S.fajlEngedely || !S.adat) return null;
    const jeloltek = [];
    try {
        for await (const [nev, h] of S.mappa.entries()) {
            if (h.kind !== "file" || !S.MENTES_MINTA.test(nev)) continue;
            const f = await h.getFile();
            jeloltek.push({ nev: nev, f: f });
        }
    } catch (e) { console.warn("Mappa olvasás:", e); return null; }

    // a legutóbb módosult fájlokat nézzük meg (max. 10), a tartalmuk dönt
    jeloltek.sort(function (a, b) { return b.f.lastModified - a.f.lastModified; });
    let legjobb = null;
    for (const j of jeloltek.slice(0, 10)) {
        try {
            const obj = S.jsonEllenoriz(JSON.parse(await j.f.text()));
            if (obj.modositva && (!legjobb || obj.modositva > legjobb.obj.modositva)) legjobb = { obj: obj, nev: j.nev };
        } catch (e) { /* nem KIADOK mentés vagy sérült – kihagyjuk */ }
    }
    if (legjobb && legjobb.obj.modositva > S.adat.modositva) return legjobb;
    return null;
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
