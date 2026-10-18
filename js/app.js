/* ==================================================================
   app.js – indítás, nézetváltás (#naptar, #kiadasok, …), telepítés
   ================================================================== */
const A = {
    nezetek: {
        naptar: NaptarNezet, kiadasok: K, naplo: NaploNezet,
        merok: MeroNezet, auto: AutoNezet, restancia: RestanciaNezet,
        szef: SzefNezet, sugo: SugoNezet, adatok: AdatokNezet,
        tobb: TobbNezet, udvozlo: UdvozloNezet
    },
    aktualis: null,
    telepitoPrompt: null
};

A.nezetNev = function () {
    const h = (location.hash || "").replace("#", "");
    if (!S.adat) return "udvozlo";
    if (h === "udvozlo") return "naptar";
    return A.nezetek[h] ? h : "naptar";      // alapértelmezett: naptár (mint az Auto_Open)
};

A.frissit = function () {
    const nev = A.nezetNev();
    const nezet = A.nezetek[nev];
    // előző nézet elhagyása (pl. széf zárolása)
    if (A.aktualis && A.aktualis !== nev && A.nezetek[A.aktualis].elhagy) A.nezetek[A.aktualis].elhagy();
    const ujNezet = A.aktualis !== nev;
    A.aktualis = nev;

    const el = document.getElementById("nezet");
    const gorgetes = ujNezet ? 0 : window.scrollY;
    document.getElementById("nezet-cim").textContent = nezet.cim;
    document.title = nezet.cim + " – KIADOK";
    el.className = "nezet-" + nev;
    const r = nezet.render(el);
    const vissza = function () { window.scrollTo(0, gorgetes); };
    if (r && r.then) r.then(vissza); else vissza();

    U.$$("#nav a").forEach(function (a) {
        const n = a.dataset.nezet;
        const aktiv = n === nev || (n === "tobb" && ["merok", "auto", "restancia", "szef", "sugo", "adatok"].indexOf(nev) >= 0);
        a.classList.toggle("aktiv", aktiv);
        if (aktiv) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    document.body.classList.toggle("nincs-adat", !S.adat);
};

/* ---------- Telepítés (mint a JTKviz-ben) ---------- */
A.telepitett = function () {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
};
A.telepit = function () {
    if (!A.telepitoPrompt) return;
    A.telepitoPrompt.prompt();
    A.telepitoPrompt.userChoice.then(function () {
        A.telepitoPrompt = null;
        document.getElementById("btn-telepit").classList.add("hidden");
        if (A.aktualis === "adatok") A.frissit();
    });
};
window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    A.telepitoPrompt = e;
    document.getElementById("btn-telepit").classList.remove("hidden");
});
window.addEventListener("appinstalled", function () {
    document.getElementById("btn-telepit").classList.add("hidden");
    U.toast("Telepítve! Mostantól a Start menüből / kezdőképernyőről is indíthatod.");
});

/* ---------- Automatikus fájlmentés engedély sáv ---------- */
A.fajlSav = function () {
    const sav = document.getElementById("fajlmentes-sav");
    sav.classList.toggle("hidden", !(S.mappa && !S.fajlEngedely));
};

/* Újabb mentés a mentési mappában (pl. a telefonról, Drive-on át)? */
A.fajlEllenoriz = async function () {
    if (A._ellenoriz) return;
    A._ellenoriz = true;
    try {
        const ujabb = await S.mappabolUjabb();
        // ha egyszer már nemet mondtál ugyanerre a mentésre, nem kérdezünk újra
        if (ujabb && ujabb.obj.modositva !== A._elutasitott) {
            const o = ujabb.obj;
            const ok = await U.megerosit("A mentési mappában (" + S.mappa.name + ") újabb mentés van, mint itt:\n\n" +
                "fájl: " + ujabb.nev + "\n" +
                "abban: " + o.kiadasok.length + " kiadás, " + o.esemenyek.length + " esemény, módosítva " + U.idopontHu(o.modositva) + "\n" +
                "itt: " + S.adat.kiadasok.length + " kiadás, " + S.adat.esemenyek.length + " esemény, módosítva " + U.idopontHu(S.adat.modositva) +
                "\n\nValószínűleg a másik eszközön módosítottál. Betöltöd?", { cim: "Újabb mentés a mappában", igen: "Betöltés" });
            if (ok) {
                S.csere(o);
                S._fajlbaIrMost();   // a kiadok-adatok.json is legyen naprakész
                U.toast("Az újabb adat betöltve.");
            } else {
                A._elutasitott = o.modositva;
            }
        }
    } finally { A._ellenoriz = false; }
};

/* ---------- Indítás ---------- */
A.indit = async function () {
    try {
        await S.betolt();
    } catch (e) {
        document.getElementById("nezet").innerHTML = "<section class='kartya'><h3>Hiba</h3><p>Az adattár nem nyitható meg: " +
            U.esc(e.message) + "</p><p>Privát/inkognitó ablakban ez előfordulhat.</p></section>";
        return;
    }
    S.figyel(A.frissit);
    window.addEventListener("hashchange", function () { if (U.modalNyitva()) U.modalBezar(); A.frissit(); window.scrollTo(0, 0); });
    A.frissit();
    S.allapot(S.adat ? "mentve" : "");

    // Modal bezárása: X gomb, háttérre kattintás, Esc
    document.querySelector(".modal-x").onclick = U.modalBezar;
    document.getElementById("modal-hatter").addEventListener("mousedown", function (ev) {
        if (ev.target.id === "modal-hatter") U.modalBezar();
    });
    document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape" && U.modalNyitva()) U.modalBezar();
    });
    document.getElementById("btn-telepit").onclick = A.telepit;

    // Automatikus fájlmentés
    if (S.mappa) {
        await S.fajlEngedelyEllenoriz();
        A.fajlSav();
        if (S.fajlEngedely) A.fajlEllenoriz();
    }
    document.getElementById("btn-fajlmentes-folytat").onclick = async function () {
        await S.fajlEngedelyKer();
        A.fajlSav();
        if (S.fajlEngedely) { await A.fajlEllenoriz(); S._fajlbaIrMost(); }
    };
    // Ha visszatérsz az ablakba, megnézzük, nem változott-e a fájl
    document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible" && S.fajlEngedely && !U.modalNyitva()) A.fajlEllenoriz();
        // napváltáskor a "ma" jelölés frissüljön
        if (document.visibilityState === "visible" && A._utolsoNap && A._utolsoNap !== U.ma() && !U.modalNyitva()) A.frissit();
        A._utolsoNap = U.ma();
    });
    A._utolsoNap = U.ma();
};

document.addEventListener("DOMContentLoaded", A.indit);
