/* ==================================================================
   ics.js – a HNaplo_ExportICS makró megfelelője
   Ugyanaz az UID-séma (hnaplo-ÉÉÉÉHHNN-n@hnaplo.local), így a Google
   Naptárba újraimportáláskor a meglévő események frissülnek, nem duplázódnak.
   Mint az Excelben: csak a 2026-tól kezdődő napokat exportálja.
   ================================================================== */
const ICS = {};
ICS.KEZDO_DATUM = "2026-01-01";

ICS.escape = function (s) {
    return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,")
        .replace(/\r\n/g, "\\n").replace(/\n/g, "\\n").replace(/\r/g, "\\n");
};
ICS.rovid = function (s) { return s.length > 50 ? s.slice(0, 47) + "..." : s; };
/* 75 karakteres sortörés (folding), mint az ICSFoldLine */
ICS.fold = function (cimke, ertek) {
    const teljes = cimke + ":" + ertek;
    let er = teljes.slice(0, 75), pos = 75;
    while (pos < teljes.length) { er += "\r\n " + teljes.slice(pos, pos + 74); pos += 74; }
    return er + "\r\n";
};

ICS.keszit = function () {
    const most = new Date();
    const stamp = most.getUTCFullYear() + U.ketJegy(most.getUTCMonth() + 1) + U.ketJegy(most.getUTCDate()) + "T" +
        U.ketJegy(most.getUTCHours()) + U.ketJegy(most.getUTCMinutes()) + U.ketJegy(most.getUTCSeconds()) + "Z";
    let sb = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//H_naplo//HU\r\nCALSCALE:GREGORIAN\r\n";
    let db = 0;

    const datumok = {};
    Object.keys(N.index()).forEach(function (d) { datumok[d] = 1; });
    Object.keys(S.adat.naploMegj).forEach(function (d) { datumok[d] = 1; });

    Object.keys(datumok).sort().forEach(function (d) {
        if (d < ICS.KEZDO_DATUM) return;
        const tartalom = N.szovegSorok(d);
        if (!tartalom) return;
        const ymd = d.replace(/-/g, "");
        const kov = U.napHozzaad(d, 1).replace(/-/g, "");
        tartalom.split("\n").forEach(function (sor, j) {
            sor = sor.trim();
            if (!sor) return;
            sb += "BEGIN:VEVENT\r\n" +
                "UID:hnaplo-" + ymd + "-" + (j + 1) + "@hnaplo.local\r\n" +
                "DTSTAMP:" + stamp + "\r\n" +
                "DTSTART;VALUE=DATE:" + ymd + "\r\n" +
                "DTEND;VALUE=DATE:" + kov + "\r\n" +
                ICS.fold("SUMMARY", ICS.escape(ICS.rovid(sor))) +
                ICS.fold("DESCRIPTION", ICS.escape(sor)) +
                "END:VEVENT\r\n";
            db++;
        });
    });
    sb += "END:VCALENDAR\r\n";
    return { szoveg: sb, db: db };
};

ICS.export = function () {
    const r = ICS.keszit();
    U.letolt("H_naplo.ics", r.szoveg, "text/calendar;charset=utf-8");
    return r.db;
};
