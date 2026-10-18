/* ==================================================================
   nezet-szef.js – a "HF" lap (jelszavak, fiókadatok)
   - Alapból rejtett, gombnyomásra jelenik meg.
   - Opcionálisan jelszóval titkosítható (AES-GCM). Ekkor a mentési
     fájlban és az Excel exportban sem olvasható a tartalom.
   - Ha elhagyod az oldalt, automatikusan bezáródik.
   ================================================================== */
const SzefNezet = { cim: "Széf", lathato: false, kereses: "" };

SzefNezet.elhagy = function () { SzefNezet.lathato = false; SzefNezet.kereses = ""; S.szefZar(); };

SzefNezet.szoveg = function () {
    return S.adat.szef.titkos ? S.szefSzoveg : S.adat.szef.szoveg;
};

SzefNezet.render = function (el) {
    const titkos = S.adat.szef.titkos;
    const zarva = titkos && S.szefSzoveg === null;

    if (zarva) {
        el.innerHTML = "<section class='kartya keskeny-kartya kozep-szoveg'>" +
            "<div class='szef-ikon'>🔒</div><h3>A széf zárolva van</h3>" +
            "<form id='szef-felold' class='inline-urlap'><input type='password' id='szef-jelszo' placeholder='Jelszó' autocomplete='current-password' autofocus>" +
            "<button class='btn btn-elsodleges'>Feloldás</button></form><p class='urlap-hiba hidden' id='szef-hiba'></p></section>";
        U.$("#szef-felold", el).onsubmit = async function (ev) {
            ev.preventDefault();
            const j = U.$("#szef-jelszo", el).value;
            const ok = await S.szefFelold(j);
            if (ok) { SzefNezet.lathato = true; A.frissit(); }
            else { const h = U.$("#szef-hiba", el); h.textContent = "Hibás jelszó."; h.classList.remove("hidden"); }
        };
        setTimeout(function () { const i = U.$("#szef-jelszo"); if (i) i.focus(); }, 50);
        return;
    }

    const szoveg = SzefNezet.szoveg() || "";
    let tartalom;
    if (!SzefNezet.lathato) {
        tartalom = "<div class='kozep-szoveg'><p class='halvany'>A tartalom rejtve van.</p>" +
            "<button class='btn btn-elsodleges' id='szef-mutat'>Megjelenítés</button></div>";
    } else {
        const q = U.ekezetNelkul(SzefNezet.kereses);
        const sorok = szoveg.split("\n");
        let h = "<input type='search' id='szef-kereses' placeholder='Keresés…' value='" + U.esc(SzefNezet.kereses) + "'>" +
            "<p class='halvany kicsi'>Egy sorra kattintva a vágólapra másolod.</p><div class='szef-sorok'>";
        sorok.forEach(function (s, i) {
            if (q && U.ekezetNelkul(s).indexOf(q) < 0) return;
            if (!s.trim()) { if (!q) h += "<div class='szef-ures'></div>"; return; }
            h += "<div class='szef-sor' data-sor='" + i + "' tabindex='0'>" + U.linkesit(s) + "</div>";
        });
        h += "</div>";
        tartalom = h;
    }

    el.innerHTML = "<section class='kartya'>" +
        "<div class='kartya-fej'><h3>" + (titkos ? "🔓 Széf (titkosítva)" : "Széf") + "</h3><div class='gomb-sor'>" +
        (SzefNezet.lathato ? "<button class='btn btn-masodlagos' id='szef-szerk'>Szerkesztés</button>" : "") +
        (titkos ? "<button class='btn btn-masodlagos' id='szef-zar'>Zárolás</button>" : "") +
        "<button class='btn btn-kicsi btn-masodlagos' id='szef-jelszo-gomb'>" + (titkos ? "Jelszó módosítása / kikapcsolása" : "Jelszavas védelem") + "</button>" +
        "</div></div>" +
        (!titkos ? "<p class='figyelmeztetes'>A széf most nincs titkosítva – a mentési fájlban is olvasható. Javasolt jelszót beállítani.</p>" : "") +
        tartalom + "</section>";

    const mutat = U.$("#szef-mutat", el);
    if (mutat) mutat.onclick = function () { SzefNezet.lathato = true; A.frissit(); };
    const zar = U.$("#szef-zar", el);
    if (zar) zar.onclick = function () { SzefNezet.elhagy(); A.frissit(); };
    const szerk = U.$("#szef-szerk", el);
    if (szerk) szerk.onclick = SzefNezet.szerkeszt;
    U.$("#szef-jelszo-gomb", el).onclick = SzefNezet.jelszoKezeles;

    const k = U.$("#szef-kereses", el);
    if (k) k.addEventListener("input", U.debounce(function () {
        SzefNezet.kereses = k.value; A.frissit();
        const uj = U.$("#szef-kereses"); if (uj) { uj.focus(); uj.setSelectionRange(uj.value.length, uj.value.length); }
    }, 200));
    U.$$(".szef-sor", el).forEach(function (d) {
        d.onclick = function (ev) {
            if (ev.target.closest("a")) return;
            const s = szoveg.split("\n")[+d.dataset.sor];
            if (navigator.clipboard) navigator.clipboard.writeText(s).then(function () { U.toast("Vágólapra másolva."); });
        };
    });
};

SzefNezet.szerkeszt = async function () {
    const e = await U.urlap({
        cim: "Széf szerkesztése", szeles: true,
        mezok: [{ nev: "szoveg", felirat: "Tartalom (soronként)", tipus: "textarea", ertek: SzefNezet.szoveg(), sorok: 20, attr: " spellcheck='false'" }]
    });
    if (!e) return;
    await S.szefMent(e.szoveg);
    U.toast("Széf mentve.");
};

SzefNezet.jelszoKezeles = async function () {
    const titkos = S.adat.szef.titkos;
    if (titkos && S.szefSzoveg === null) { U.toast("Előbb oldd fel a széfet."); return; }
    const mezok = [
        { nev: "j1", felirat: titkos ? "Új jelszó" : "Jelszó", tipus: "password", attr: " autocomplete='new-password'" },
        { nev: "j2", felirat: "Jelszó még egyszer", tipus: "password", attr: " autocomplete='new-password'" }
    ];
    const e = await U.urlap({
        cim: titkos ? "Széf jelszó" : "Jelszavas védelem bekapcsolása",
        mezok: mezok,
        torles: titkos, torlesFelirat: "Titkosítás kikapcsolása",
        lablec: "<p class='figyelmeztetes'>Ha elfelejted a jelszót, a széf tartalma <b>nem állítható vissza</b>. Írd fel biztonságos helyre!</p>",
        ellenoriz: function (v) {
            if (v.j1.length < 4) return "A jelszó legalább 4 karakter legyen.";
            if (v.j1 !== v.j2) return "A két jelszó nem egyezik.";
            return null;
        }
    });
    if (!e) return;
    if (e._torles) {
        if (!(await U.megerosit("Kikapcsolod a titkosítást? A széf tartalma ezután titkosítatlanul kerül a mentésekbe.", { igen: "Kikapcsolás", veszelyes: true }))) return;
        const sz = S.szefSzoveg;
        S.szefZar();
        S.modosit(function (a) { a.szef = { titkos: false, szoveg: sz }; });
        SzefNezet.lathato = true;
        U.toast("Titkosítás kikapcsolva.");
        A.frissit();
        return;
    }
    await S.szefJelszoBeallit(e.j1, SzefNezet.szoveg() || "");
    SzefNezet.lathato = true;
    U.toast("A széf titkosítva.");
    A.frissit();
};
