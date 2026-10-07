# 🎳 Kegelclub – Vereins-App

Mobile-first Web-App für den Alltag eines Kegelclubs: Kegelabende mit Zu-/Absagen, wiederkehrende Termine, Events, Kalender, Kegelspiele mit Regeln, Ergebniserfassung direkt an der Bahn, Rangliste, Strafkatalog und Kassenwart-Bereich.

---

## Inhalt

1. [Voraussetzungen](#1-voraussetzungen)
2. [Installation](#2-installation)
3. [Umgebungsvariablen](#3-umgebungsvariablen)
4. [Datenbank einrichten](#4-datenbank-einrichten)
5. [Migrationen](#5-migrationen)
6. [Seed-Daten](#6-seed-daten)
7. [Lokaler Start](#7-lokaler-start)
8. [Testen](#8-testen)
9. [Ersten Admin anlegen](#9-ersten-admin-anlegen)
10. [Deployment](#10-deployment)
11. [Architektur](#11-architektur)
12. [Wichtige Entscheidungen](#12-wichtige-entscheidungen)

---

## 1. Voraussetzungen

- **Node.js ≥ 20.9** (empfohlen: 22 LTS) und npm
- **PostgreSQL ≥ 14** – *optional für die lokale Entwicklung*: Die App bringt mit PGlite ein eingebettetes PostgreSQL mit, sodass lokal keine Datenbank installiert werden muss.

## 2. Installation

```bash
npm install
cp .env.example .env      # danach Werte anpassen (siehe unten)
```

## 3. Umgebungsvariablen

Alle Variablen stehen mit Kommentaren in `.env.example`. Es gibt **keine** Zugangsdaten im Quellcode.

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `DATABASE_URL` | ja | PostgreSQL-Verbindung, z. B. `postgres://user:pw@host:5432/db?sslmode=require`. Lokal alternativ `pglite://./.data/kegelclub` (eingebettet, Daten im Ordner `.data`). |
| `APP_URL` | ja (Prod.) | Öffentliche URL der App, wird für Links in E-Mails (Passwort-Reset) verwendet. |
| `CLUB_NAME` | nein | Standard-Vereinsname, kann im Admin-Bereich überschrieben werden. |
| `RESEND_API_KEY` | nein | API-Key für den E-Mail-Versand über [Resend](https://resend.com). Ohne Key werden Mails in der Entwicklung nur in der Server-Konsole ausgegeben. |
| `MAIL_FROM` | mit Resend | Absender, z. B. `Kegelclub <kegelclub@deine-domain.de>` (Domain muss bei Resend verifiziert sein). |
| `SEED_DEMO_PASSWORD` | nur Seed | Passwort für alle Demo-Konten (mind. 10 Zeichen). |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME` | nein | Nur für `npm run admin:create` ohne interaktive Eingabe (z. B. in CI). |

## 4. Datenbank einrichten

**Variante A – ohne Installation (empfohlen für den Start):**

```env
DATABASE_URL="pglite://./.data/kegelclub"
```

**Variante B – lokales PostgreSQL (z. B. per Docker):**

```bash
docker run -d --name kegelclub-db -e POSTGRES_PASSWORD=kegeln -e POSTGRES_DB=kegelclub -p 5432:5432 postgres:16
```
```env
DATABASE_URL="postgres://postgres:kegeln@localhost:5432/kegelclub"
```

**Variante C – gehostet (Supabase / Neon):** Verbindungs-URL aus dem Dashboard kopieren (`?sslmode=require` anhängen).
Bei Supabase für Vercel den **Transaction-Pooler** (Port 6543) verwenden.

## 5. Migrationen

Das Schema liegt in `src/server/db/schema.ts`, die generierten SQL-Migrationen in `drizzle/`.

```bash
npm run db:migrate        # wendet alle Migrationen an
```

Nach Änderungen am Schema:

```bash
npm run db:generate       # erzeugt eine neue SQL-Migration in drizzle/
npm run db:migrate
```

## 6. Seed-Daten

```bash
npm run db:seed           # nur in eine leere Datenbank
npm run db:seed -- --reset   # ⚠️ löscht vorher ALLE Daten
```

Angelegt werden u. a.:

- 10 Demo-Mitglieder (`…@demo.kegelclub.test`) mit allen Rollen und Status – inkl. einer passiven und einer noch nicht freigeschalteten Registrierung
- eine Kegelabend-Serie „alle 2 Wochen“ (vergangene + kommende Termine), ein einzeln verschobener Serientermin
- Kegeltour, Weihnachtsfeier, Sommerfest
- 8 Kegelspiele mit Regeln und Beispielen
- Zu-/Absagen, abgeschlossene Spielrunden mit Ergebnissen
- Strafkatalog und vergebene (teils bezahlte) Strafen

Demo-Logins (Passwort = `SEED_DEMO_PASSWORD`):

| Rolle | E-Mail |
|---|---|
| Admin | `max@demo.kegelclub.test` |
| Kassenwart | `erika@demo.kegelclub.test` |
| Mitglied | `peter@demo.kegelclub.test` |

In Produktion verweigert der Seed den Start (außer mit `ALLOW_SEED=1`).

## 7. Lokaler Start

```bash
npm run dev               # http://localhost:3000
```

Kurzfassung für den allerersten Start:

```bash
npm install && cp .env.example .env   # SEED_DEMO_PASSWORD setzen
npm run setup                          # = db:migrate + db:seed
npm run dev
```

Auf dem Handy im selben WLAN testen: `npm run dev -- -H 0.0.0.0` und `http://<IP-des-Rechners>:3000` öffnen.

Produktions-Build lokal: `npm run build && npm start`.

## 8. Testen

```bash
npm test                  # alle Tests (Vitest)
npm run typecheck         # TypeScript-Prüfung
```

Die Tests laufen gegen ein **echtes PostgreSQL im Arbeitsspeicher** (PGlite) – inklusive Migrationen, Constraints und Transaktionen. Es wird keine externe Datenbank benötigt.

| Datei | Prüft |
|---|---|
| `tests/auth.test.ts` | Registrierung, Login, Rate-Limit, gesperrte Konten, Passwort-Reset (Hash-Speicherung, Ablauf, Einmaligkeit), Passwort ändern |
| `tests/permissions.test.ts` | Rollen-Rechte-Matrix, Mitglieder können keine Admin-Funktionen ausführen, letzter Admin bleibt erhalten |
| `tests/events.test.ts` | Serien anlegen, Einzeltermin verschieben, Serie ändern/verlängern/kürzen, „alle folgenden löschen“, An-/Abmeldung, Event-Anmeldung, abgesagte Termine |
| `tests/recurrence.test.ts` | Wiederholungsregeln, Monatsende, Sommer-/Winterzeit |
| `tests/penalties.test.ts` | Strafen nur durch Kassenwart (nicht Admin, nicht Mitglied), Sichtbarkeit nur eigener Strafen, Katalogschutz |
| `tests/results.test.ts` | Ergebniserfassung, Rechte bei abgeschlossenen Runden, Rangliste & persönliche Statistik |
| `tests/scoring.test.ts` | Platzierungen, Gleichstand, „niedrigster Wert gewinnt“, Ranglistenpunkte |

## 9. Ersten Admin anlegen

Es gibt **keine** fest eingebauten Zugangsdaten. Den ersten Admin legst du per Skript direkt in der Datenbank an:

```bash
npm run admin:create
```

Das Skript fragt E-Mail, Name und Passwort (mind. 10 Zeichen, verdeckte Eingabe) ab.

- Existiert die E-Mail bereits (z. B. weil du dich über die App registriert hast), wird dieses Konto freigeschaltet und zum Admin befördert – das Passwort bleibt unverändert.
- Nicht-interaktiv (z. B. für den Server):
  ```bash
  ADMIN_EMAIL=vorstand@example.org ADMIN_PASSWORD='…' ADMIN_FIRST_NAME=Vorname ADMIN_LAST_NAME=Nachname npm run admin:create
  ```

Für die Produktionsdatenbank führst du das Skript lokal mit der Produktions-`DATABASE_URL` aus.

Danach werden alle weiteren Mitglieder so aufgenommen: Mitglied registriert sich in der App → Admin schaltet unter **Verwaltung** frei → Admin vergibt ggf. Rollen (z. B. Kassenwart).

## 10. Deployment

### Vercel + Neon/Supabase (empfohlen)

1. **Datenbank** bei [Neon](https://neon.tech) oder [Supabase](https://supabase.com) anlegen, Verbindungs-URL kopieren.
2. **Migrationen** einmalig von deinem Rechner ausführen:
   ```bash
   DATABASE_URL="postgres://…" npm run db:migrate
   DATABASE_URL="postgres://…" npm run admin:create
   ```
3. Repository bei **Vercel** importieren (Framework wird automatisch erkannt).
4. Unter *Settings → Environment Variables* setzen: `DATABASE_URL`, `APP_URL` (z. B. `https://kegelclub.vercel.app`), optional `CLUB_NAME`, `RESEND_API_KEY`, `MAIL_FROM`.
5. Deploy. Bei späteren Schemaänderungen vor dem Deploy `npm run db:migrate` gegen die Produktions-DB ausführen.

Hinweise:
- Die App braucht kein persistentes Dateisystem – Profilbilder liegen in der Datenbank.
- Der Datenbank-Client nutzt auf Vercel automatisch nur eine Verbindung pro Funktion (`max: 1`) und ist mit Poolern (PgBouncer/Supabase-Pooler) kompatibel (`prepare: false`).

### Alternative: eigener Server / VPS (Docker, Node)

```bash
npm ci && npm run build
DATABASE_URL=… APP_URL=… npm start      # Port 3000, hinter einen Reverse Proxy mit HTTPS (z. B. Caddy)
```

Wichtig: Ohne HTTPS werden Session-Cookies in Produktion nicht gesetzt (`secure`-Flag).

## 11. Architektur

```
src/
├── app/                      Next.js App Router (nur Seiten & Routing)
│   ├── (auth)/               Login, Registrierung, Passwort vergessen/zurücksetzen
│   ├── (app)/                geschützter Bereich mit App-Shell (Navigation)
│   │   ├── page.tsx          Dashboard
│   │   ├── kegelabende/ events/ termine/[id]/ kalender/
│   │   ├── spiele/ spielrunden/[id]/ statistik/
│   │   ├── mitglieder/ profil/ strafen/ verwaltung/
│   └── api/bilder/[id]/      Auslieferung hochgeladener Bilder (nur angemeldet)
├── components/               UI-Komponenten (ui/, layout/, events/, games/, members/, penalties/)
├── lib/                      reine, testbare Logik ohne Datenbank
│   ├── permissions.ts        Rollen → Rechte
│   ├── recurrence.ts         Wiederholungsregeln
│   ├── scoring.ts            Platzierungsberechnung (Strategien)
│   ├── leaderboard.ts        Ranglistenformel
│   ├── dates.ts              Zeitzone Europe/Berlin, Formatierung DD.MM.YYYY / 24 h
│   └── validation.ts         Zod-Schemas (Eingabevalidierung)
└── server/
    ├── db/                   Drizzle-Schema, Client, Migrator
    ├── auth/                 Hashing, Sessions/Cookies, Rate-Limit, Rechteprüfung
    ├── services/             Geschäftslogik – jede Funktion prüft die Rechte des Akteurs
    └── actions/              Server Actions (dünne Schicht: Formular → Service)
```

**Ablauf einer Aktion:** Formular (Client) → Server Action (`server/actions`) → `requireActor()` liest die Session aus dem Cookie → Service (`server/services`) prüft mit `assertCan(actor, "…")` die Berechtigung und validiert die Eingabe mit Zod → Drizzle (parametrisierte Queries) → `revalidatePath`.
Die Rechteprüfung sitzt im Service-Layer und greift damit unabhängig davon, von wo die Funktion aufgerufen wird. Die UI blendet Buttons nur zusätzlich aus.

### Datenmodell

| Tabelle | Inhalt |
|---|---|
| `users` | Konto: E-Mail, Passwort-Hash, Status (`AUSSTEHEND`, `AKTIV`, `PASSIV`, `INAKTIV`) |
| `profiles` | Vor-/Nachname, Spitzname, Geburtstag, Telefon, Profilbild |
| `user_roles` | Rollen je Benutzer (mehrere möglich): `MITGLIED`, `KASSENWART`, `ADMIN` |
| `sessions` | Sitzungen (nur SHA-256-Hash des Tokens) |
| `password_reset_tokens` | Reset-Tokens (gehasht, 60 min gültig, einmalig) |
| `rate_limits` | Zähler für Login/Reset/Registrierung |
| `images` | hochgeladene Bilder (Profil, Termin) |
| `event_series` | Regel einer wiederkehrenden Terminserie (RecurringEvent) |
| `events` | konkreter Termin – Kegelabend **oder** Event (`kind`), optional Teil einer Serie |
| `event_participations` | Zusage/Absage je Mitglied (kein Eintrag = keine Rückmeldung) |
| `games`, `game_rules` | Kegelspiele inkl. Erklärung, Wertungsart, Regeln |
| `game_sessions` | eine gespielte Runde an einem Termin |
| `game_results` | Teilnehmer + Ergebnis + berechneter Platz einer Runde |
| `penalty_types` | Strafkatalog |
| `penalties` | vergebene Strafen (Mitglied, Art, Betrag, Datum, Termin, Kommentar, erstellt von/am, bezahlt am) |
| `settings` | Vereinseinstellungen (Key/Value) |

### Rollen

| Recht | Mitglied | Kassenwart | Admin |
|---|:-:|:-:|:-:|
| Profil bearbeiten, Termine sehen, zu-/absagen, Spiele & Statistiken, Ergebnisse eintragen | ✔ | ✔ | ✔ |
| eigene Strafen sehen | ✔ | ✔ | ✔ |
| alle Strafen sehen | | ✔ | ✔ |
| Strafen vergeben/ändern/löschen, Strafkatalog pflegen | | ✔ | |
| Mitglieder, Rollen, Termine, Spiele, Einstellungen verwalten; abgeschlossene Runden korrigieren | | | ✔ |

Neue Rolle: Wert in `roleEnum` (`schema.ts`) ergänzen, Migration erzeugen, Rechte in `ROLE_PERMISSIONS` (`lib/permissions.ts`) eintragen.

### Erweiterbarkeit

- **Finanz-/Kassenmodul:** neue Tabellen (z. B. `ledger_entries`) können `penalties.id` referenzieren; `paid_at` lässt sich dann durch Buchungen ersetzen. Neue Rechte `finance:*` in `permissions.ts`.
- **Weitere Wertungslogiken:** neue Strategie in `lib/scoring.ts` registrieren.
- **Benachrichtigungen:** `server/services/mail.ts` ist der zentrale Versandpunkt; Push/WhatsApp als weitere Kanäle daneben.
- **Turniere/Jahresmeisterschaft:** bauen auf `game_sessions`/`game_results` und `lib/leaderboard.ts` auf.

## 12. Wichtige Entscheidungen

| Entscheidung | Begründung |
|---|---|
| **Drizzle ORM statt Prisma** | Reines TypeScript ohne nachgeladene Engine-Binaries, SQL-nahe Abfragen, sehr gut für Serverless/Vercel; Migrationen als lesbares SQL. |
| **PGlite für lokal & Tests** | Echtes PostgreSQL ohne Installation; Tests prüfen damit die echte Datenbanklogik statt Mocks. |
| **Eigene Session-Authentifizierung statt Auth-Bibliothek** | Wenige, gut überschaubare Zeilen; volle Kontrolle über Freischaltung, Status, Rate-Limits und Reset-Flow. Sessions sind serverseitig widerrufbar (Sperren, Passwortwechsel). |
| **Freischaltung neuer Registrierungen** | Vereinsdaten (Geburtstage, Strafen) sollen nicht für Fremde zugänglich sein. |
| **Kegelabende und Events in einer Tabelle** | Teilnahme, Kalender, Strafen und Spiele funktionieren für beide gleich – keine Duplikate. |
| **Serien werden als Einzeltermine gespeichert** | Jeder Termin hat eigene Zusagen und kann einzeln verschoben/abgesagt werden. Ohne Enddatum werden 12 Monate im Voraus angelegt; „Serie bearbeiten“ verlängert bei Bedarf. Der Wiederholungsrhythmus selbst ist nach dem Anlegen fest (für einen neuen Rhythmus: Serie beenden, neue anlegen). |
| **Zeitzone Europe/Berlin fest** | Alle Uhrzeiten werden in Vereinszeit eingegeben/angezeigt, sommerzeitsicher – auch wenn der Server (Vercel) in UTC läuft. |
| **Platzierung bei Gleichstand: 1-2-2-4** | Übliche Wettkampfregel; gleicher Wert = gleicher Platz. |
| **Rangliste über Platzierungspunkte** | Spiele haben unterschiedliche Skalen (Holz, Würfe, Hausnummern) – Rohpunkte wären nicht vergleichbar. |
| **Ergebnisse darf jedes Mitglied eintragen** | An der Bahn hat irgendwer das Handy in der Hand. Nach „Abschließen“ kann nur noch ein Admin ändern. |
| **Strafen vergibt ausschließlich der Kassenwart** | Wie gefordert – auch Admins nicht. Ein Admin, der auch Kassenwart ist, bekommt beide Rollen. |
| **„Bezahlt“-Markierung bei Strafen** | Minimal, damit „offene Strafen“ sinnvoll sind – ohne Kassenbuch (folgt im Finanzmodul). |
| **Bilder in der Datenbank** | Kein zusätzlicher Speicherdienst nötig, funktioniert auf Vercel. Typprüfung über Datei-Signatur (kein SVG), max. 2 MB, Verkleinerung im Browser. Für viele Bilder später auf Objekt-Speicher (S3/Supabase Storage) umstellen – nur `services/images.ts` betroffen. |
| **Keine externen Webfonts** | Datenschutz (DSGVO, keine Google-Fonts-Abrufe) und Ladezeit; Slab-Serif-Systemschriften für den Kneipen-Look. |
| **E-Mail über Resend-HTTP-API** | Keine zusätzliche Abhängigkeit; leicht austauschbar in `mail.ts`. |

### Sicherheit im Überblick

- Passwörter: bcrypt (Kostenfaktor 12); Login-Fehler sind für unbekannte E-Mails und falsche Passwörter identisch (inkl. gleicher Laufzeit).
- Sessions: 256-Bit-Zufallstoken im `httpOnly`-, `SameSite=Lax`-, in Produktion `Secure`-Cookie; in der DB nur der Hash; 30 Tage gültig.
- Rate-Limits: Login (8 / 15 min), Passwort-Reset (3 / h), Registrierung (5 / h).
- Autorisierung: ausschließlich serverseitig im Service-Layer; Rollen werden nur aus der Datenbank gelesen.
- SQL-Injection: nur parametrisierte Queries über Drizzle. XSS: React-Escaping, kein `dangerouslySetInnerHTML`, Bilder mit `nosniff` und eigener CSP.
- CSRF: Server Actions prüfen den `Origin`-Header (Next.js), Cookies sind `SameSite=Lax`.
- Sicherheits-Header: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- Logs enthalten keine Passwörter, Tokens oder E-Mail-Inhalte (außer der Mail-Ausgabe im lokalen Entwicklungsmodus).

### Bekannte Einschränkungen

- Keine Push-Benachrichtigungen oder E-Mail-Erinnerungen an Termine.
- Termine ohne Serienende werden 12 Monate im Voraus angelegt; danach Serie über „Bearbeiten → Serienende“ verlängern.
- Der Wiederholungsrhythmus einer bestehenden Serie kann nicht geändert werden.
- Kein Offline-Modus; die App benötigt an der Bahn eine Internetverbindung.
