/* ==================================================================
   xlsx-io.js – Excel import (S_KIADOK.xlsm) és export (.xlsx)
   A SheetJS könyvtárat (vendor/xlsx.full.min.js) csak akkor tölti be,
   amikor szükség van rá.
   ================================================================== */
const X = {};

X.betolt = function () {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise(function (resolve, reject) {
        const s = document.createElement("script");
        s.src = "vendor/xlsx.full.min.js";
        s.onload = function () { resolve(window.XLSX); };
        s.onerror = function () { reject(new Error("Az Excel-kezelő nem tölthető be.")); };
        document.head.appendChild(s);
    });
};

/* Excel dátum-sorszám ↔ "ÉÉÉÉ-HH-NN" */
X.serialbol = function (v) {
    if (typeof v === "number") {
        const p = XLSX.SSF.parse_date_code(v);
        if (!p) return null;
        return p.y + "-" + U.ketJegy(p.m) + "-" + U.ketJegy(p.d);
    }
    if (typeof v === "string") {
        const m = v.trim().match(/^(\d{4})\.(\d{2})\.(\d{2})/);
        if (m) return m[1] + "-" + m[2] + "-" + m[3];
    }
    return null;
};
X.idopontbol = function (v) {
    if (typeof v !== "number") return null;
    const p = XLSX.SSF.parse_date_code(v);
    return p.y + "-" + U.ketJegy(p.m) + "-" + U.ketJegy(p.d) + "T" + U.ketJegy(p.H) + ":" + U.ketJegy(p.M) + ":" + U.ketJegy(Math.floor(p.S));
};
X.serialba = function (s) {
    if (!s) return null;
    const p = s.split("-");
    return (Date.UTC(+p[0], +p[1] - 1, +p[2]) - Date.UTC(1899, 11, 30)) / 86400000;
};
X.idopontSerial = function (iso) {
    if (!iso) return null;
    const t = iso.slice(11).split(":");
    return X.serialba(iso.slice(0, 10)) + ((+t[0] || 0) * 3600 + (+t[1] || 0) * 60 + (+t[2] || 0)) / 86400;
};
X.txt = function (v) {
    if (v === null || v === undefined) return "";
    // Az Excel a cellán belüli sortörést "_x000D_" + "\n" formában tárolja; a SheetJS ezt "\r\r\n"-ként adja vissza
    return String(v).replace(/_x000D_/g, "\r").replace(/\r+\n/g, "\n").replace(/\r/g, "\n").trim();
};
X.szam = function (v) { return typeof v === "number" ? v : null; };

/* ---------- IMPORT: S_KIADOK.xlsm → app adat ---------- */
X.importal = async function (file) {
    await X.betolt();
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
    function lap(nev) {
        const n = wb.SheetNames.find(function (x) { return x.toLowerCase() === nev.toLowerCase(); });
        if (!n) return [];
        return XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: true });
    }
    const s_kiadok = lap("s_kiadok");
    if (!s_kiadok.length) throw new Error("A fájlban nincs „s_kiadok” lap – ez nem az S_KIADOK munkafüzet?");

    const a = S.URES_ADAT();
    a.forras = file.name;
    a.merok = [];

    s_kiadok.slice(2).forEach(function (r) {
        if (!r.some(function (x) { return x !== null && x !== ""; })) return;
        a.kiadasok.push({ id: S.ujId("k"), kat: X.txt(r[0]), nev: X.txt(r[1]), hat: X.serialbol(r[2]), fiz: X.serialbol(r[3]),
            osszeg: X.szam(r[4]), megj: X.txt(r[5]) });
    });
    lap("event").slice(2).forEach(function (r) {
        if (r[0] === null || r[0] === undefined) return;
        const d = X.serialbol(r[0]);
        if (!d) return;
        a.esemenyek.push({ id: S.ujId("e"), datum: d, szoveg: X.txt(r[1]), rogzitve: X.idopontbol(r[2]) });
    });
    lap("H_napló").slice(2).forEach(function (r) {
        const d = X.serialbol(r[0]);
        if (d && r[3]) a.naploMegj[d] = X.txt(r[3]);
    });
    lap("Restancia").forEach(function (r) {
        if (r[0]) a.restancia.push({ id: S.ujId("r"), szoveg: X.txt(r[0]), kesz: false });
    });
    [["Gáz", "Gáz", "m³"], ["Vill", "Villany", "kWh"]].forEach(function (m) {
        const sorok = lap(m[0]).slice(2);
        const mero = { id: S.ujId("o"), nev: m[1], egyseg: m[2], leolvasasok: [] };
        let i = 0;
        sorok.forEach(function (r) {
            if ((r[0] === null || r[0] === undefined) && (r[1] === null || r[1] === undefined)) return;
            const elsz = X.txt(r[2]);
            mero.leolvasasok.push({ id: S.ujId("m"), datum: X.serialbol(r[0]), allas: X.szam(r[1]), bazis: !!elsz || i === 0,
                elszamolas: elsz, eves: X.szam(r[4]),
                megj: typeof r[0] === "string" && r[0].trim().slice(-1) === "?" ? "bizonytalan dátum (" + r[0].trim() + ")" : "" });
            i++;
        });
        a.merok.push(mero);
    });
    lap("ASX").forEach(function (r) {
        if (!r.some(function (x) { return x !== null && x !== ""; })) return;
        a.auto.push({ id: S.ujId("a"), datum: X.serialbol(r[0]), leiras: X.txt(r[1]), km: X.szam(r[2]), megj: X.txt(r[3]) });
    });
    const hf = lap("HF").map(function (r) {
        const x = X.txt(r[0]), y = X.txt(r[1]);
        return x + (y ? "  |  " + y : "");
    });
    while (hf.length && !hf[hf.length - 1]) hf.pop();
    a.szef = { titkos: false, szoveg: hf.join("\n") };
    a.sugo = lap("HELP").map(function (r) { return X.txt(r[0]); }).join("\n");

    // sablonok: a jelenlegieket megtartjuk, ha nincs, az Excel makrók alapértékei
    a.sablonok = (S.adat && S.adat.sablonok && S.adat.sablonok.length) ? S.adat.sablonok : X.alapSablonok();
    N.esemenyRendez(a);
    return a;
};

X.alapSablonok = function () {
    return [["I_VILL", "Villanyszámla", 5441, "kerdez"], ["I_GÁZ", "Gázszámla", 10056, "kerdez"],
        ["I_VÍZ", "Vízdíjszámla", 16951, "kerdez"], ["ONE", "ONE, Vodafone", 24570, "kerdez"],
        ["Anna", "Anna ASX", 40000, "ma"], ["I_BIZT", "Lakás biztosítás", 12189, "kerdez"],
        ["GK_BIZT", "GK Biztosítás", 12432, "kerdez"], ["I_SZEMÉT", "Szemét szállítás", 5014, "kerdez"]]
        .map(function (s) { return { id: S.ujId("s"), kat: s[0], nev: s[1], osszeg: s[2], mod: s[3] }; });
};

/* ---------- EXPORT: app adat → .xlsx (az eredeti lapszerkezettel) ---------- */
X.exportal = async function () {
    await X.betolt();
    const a = S.adat;
    const wb = XLSX.utils.book_new();

    function lapHozzaad(nev, aoa, datumOszlopok, szelessegek, penzOszlop) {
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
        for (let R = range.s.r; R <= range.e.r; R++) {
            (datumOszlopok || []).forEach(function (C) {
                const c = ws[XLSX.utils.encode_cell({ r: R, c: C })];
                if (c && c.t === "n") c.z = "yyyy.mm.dd";
            });
            if (penzOszlop !== undefined) {
                const c = ws[XLSX.utils.encode_cell({ r: R, c: penzOszlop })];
                if (c && c.t === "n") c.z = '#,##0 "Ft"';
            }
        }
        if (szelessegek) ws["!cols"] = szelessegek.map(function (w) { return { wch: w }; });
        XLSX.utils.book_append_sheet(wb, ws, nev);
    }

    lapHozzaad("s_kiadok", [[], ["kat", "MEGNEVEZÉS", "fiz_hat", "fizetve", "összeg", ""]].concat(
        a.kiadasok.map(function (k) { return [k.kat, k.nev, X.serialba(k.hat), X.serialba(k.fiz), k.osszeg, k.megj || null]; })),
        [2, 3], [18, 35, 15, 14, 16, 56], 4);

    // H_napló: 2026.01.01-től legalább 2028 végéig, vagy az utolsó bejegyzésig
    const naplo = [[], ["Dátum", "Nap", "", ""]];
    let vege = "2028-12-31";
    Object.keys(N.index()).concat(Object.keys(a.naploMegj)).forEach(function (d) { if (d > vege) vege = d; });
    for (let d = ICS.KEZDO_DATUM; d <= vege; d = U.napHozzaad(d, 1)) {
        const n = N.nap(d);
        const c = n.esemenyek.map(function (e) { return e.szoveg; }).concat(n.kiadasok.map(function (k) { return k.nev; }))
            .filter(function (s) { return String(s).trim(); }).join("\n");
        naplo.push([X.serialba(d), U.hetNapja(d), c || null, n.megj || null]);
    }
    lapHozzaad("H_napló", naplo, [0], [12, 12, 50, 40]);

    lapHozzaad("event", [[], ["Dátum", "Esemény", "Rögzítve"]].concat(a.esemenyek.map(function (e) {
        return [X.serialba(e.datum), e.szoveg, X.idopontSerial(e.rogzitve)];
    })), [0], [12, 50, 20]);
    // a "Rögzítve" oszlop dátum + idő formátumú
    const ev = wb.Sheets["event"], er = XLSX.utils.decode_range(ev["!ref"]);
    for (let R = 2; R <= er.e.r; R++) { const c = ev[XLSX.utils.encode_cell({ r: R, c: 2 })]; if (c && c.t === "n") c.z = "yyyy.mm.dd hh:mm"; }

    lapHozzaad("Restancia", a.restancia.map(function (r) { return [r.szoveg, r.kesz ? "kész" : null]; }), [], [40, 8]);

    a.merok.forEach(function (m) {
        const sorok = MeroNezet.szamol(m);
        lapHozzaad(m.nev.slice(0, 28), [[m.nev.toUpperCase()],
            ["Dátum", "Óra állás", "Elszámolás", "Fogyasztás az utolsó elszámolástól", "Éves fogyasztás", "Havi átlag", "Megjegyzés"]]
            .concat(sorok.map(function (x) {
                return [X.serialba(x.r.datum), x.r.allas, x.r.elszamolas || (x.r.bazis ? "elszámolás" : null), x.fogy, x.eves,
                    x.havi === null ? null : Math.round(x.havi), x.r.megj || null];
            })), [0], [12, 10, 24, 18, 14, 10, 30]);
    });

    lapHozzaad((a.autoNev || "ASX").slice(0, 28), a.auto.map(function (x) { return [X.serialba(x.datum), x.leiras, x.km, x.megj || null]; }), [0], [12, 80, 10, 30]);

    const szef = a.szef.titkos ? S.szefSzoveg : a.szef.szoveg;
    if (szef !== null && szef !== undefined) {
        lapHozzaad("HF", szef.split("\n").map(function (s) { return [s]; }), [], [80]);
    } else {
        lapHozzaad("HF", [["A széf titkosítva és zárolva van, ezért nem került az exportba."]], [], [80]);
    }
    lapHozzaad("HELP", (a.sugo || "").split("\n").map(function (s) { return [s]; }), [], [120]);

    XLSX.writeFile(wb, "S_KIADOK_export_" + U.ma() + ".xlsx");
};
