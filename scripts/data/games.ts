import type { GameInput } from "../../src/lib/validation";

/**
 * Standard-Kegelspiele. Begriffe: „Holz“ = Anzahl umgeworfener Kegel,
 * „Pudel“ = Fehlwurf ohne Treffer (Kugel in der Rinne), „König“ = mittlerer Kegel,
 * „in die Vollen“ = nach jedem Wurf werden alle 9 Kegel wieder aufgestellt,
 * „Abräumen“ = gefallene Kegel bleiben liegen, bis alle 9 gefallen sind.
 * Hausregeln weichen oft ab – Admins können alle Texte in der App anpassen.
 */
export const DEFAULT_GAMES: GameInput[] = [
  {
    name: "Neuner (9er-Kegeln)",
    slug: "neuner",
    shortDescription: "Der Klassiker: So viel Holz wie möglich in die Vollen.",
    goal: "Mit einer festen Anzahl Würfe möglichst viele Kegel („Holz“) umwerfen.",
    players: "ab 2 Spieler, beliebig viele",
    procedure:
      "Jeder Spieler hat pro Runde 5 Würfe „in die Vollen“: Nach jedem Wurf werden alle 9 Kegel wieder aufgestellt.\n" +
      "Gespielt wird reihum, damit niemand lange warten muss. Nach jedem Wurf wird das Holz notiert und zusammengezählt.",
    rules: [
      "Jeder Wurf wird auf ein vollständig aufgestelltes Kegelbild gespielt.",
      "Ein Pudel (Kugel in der Rinne, kein Kegel fällt) zählt 0 Holz.",
      "Fallen alle 9 Kegel („Alle Neune“), zählt der Wurf 9 Holz – viele Clubs geben eine Runde aus.",
      "Übertritt über die Wurflinie: Der Wurf zählt 0 Holz.",
      "Die Anzahl der Würfe kann vor Spielbeginn vereinbart werden (z. B. 3, 5 oder 10).",
    ],
    scoring: "Das gesamte Holz aller Würfe wird addiert. Die höchste Summe gewinnt.",
    example: "Max wirft 7, 5, 9, 0 (Pudel) und 6 = 27 Holz.\nPeter wirft 6, 6, 8, 4 und 5 = 29 Holz → Peter gewinnt.",
    scoringMode: "HOECHSTE_GEWINNT",
    scoreLabel: "Holz",
    active: true,
    sortOrder: 10,
  },
  {
    name: "Abräumen",
    slug: "abraeumen",
    shortDescription: "Alle 9 Kegel abräumen – mit so wenig Würfen wie möglich.",
    goal: "Alle 9 Kegel mit möglichst wenigen Würfen umwerfen.",
    players: "ab 2 Spieler",
    procedure:
      "Ein Spieler beginnt auf das volle Kegelbild. Gefallene Kegel werden NICHT wieder aufgestellt – " +
      "der Spieler wirft so lange auf die stehenden Kegel, bis alle 9 gefallen sind. Die benötigten Würfe werden gezählt.\n" +
      "Danach wird neu aufgestellt und der nächste Spieler ist dran.",
    rules: [
      "Gefallene Kegel bleiben liegen, bis das Bild komplett abgeräumt ist.",
      "Jeder Wurf zählt – auch ein Pudel.",
      "Als Obergrenze gelten 15 Würfe; wer dann noch nicht fertig ist, wird mit 15 gewertet.",
      "Alternative Variante: feste Anzahl Würfe (z. B. 5) und das abgeräumte Holz zählen – dann im Spiel „höchster Wert gewinnt“ einstellen.",
    ],
    scoring: "Gezählt werden die Würfe bis zum Abräumen. Die wenigsten Würfe gewinnen.",
    example: "Klaus räumt mit 7, 1, 1 Holz in 3 Würfen ab.\nMax braucht 4 Würfe (5, 2, 0, 2) → Klaus gewinnt mit 3 Würfen.",
    scoringMode: "NIEDRIGSTE_GEWINNT",
    scoreLabel: "Würfe",
    active: true,
    sortOrder: 20,
  },
  {
    name: "Tannenbaum",
    slug: "tannenbaum",
    shortDescription: "Genau 1, dann 2, dann 3 … bis 9 Holz treffen.",
    goal: "Als Erster die „Tannenbaum-Leiter“ von 1 bis 9 Holz hinaufsteigen.",
    players: "2 bis 10 Spieler",
    procedure:
      "Alle starten auf Stufe 1. Reihum hat jeder Spieler einen Wurf in die Vollen. " +
      "Wer genau so viel Holz trifft, wie seine aktuelle Stufe verlangt, steigt eine Stufe höher (1 → 2 → 3 … → 9).\n" +
      "Trifft man mehr oder weniger, bleibt man auf seiner Stufe. Wer Stufe 9 („Alle Neune“) schafft, hat den Baum geschmückt.",
    rules: [
      "Es zählt nur exakt die geforderte Anzahl Holz.",
      "Pro Runde hat jeder genau einen Wurf.",
      "Das Spiel endet, sobald ein Spieler Stufe 9 geschafft hat; die laufende Runde wird noch zu Ende gespielt.",
      "Für ein kürzeres Spiel kann man nur bis Stufe 5 spielen.",
    ],
    scoring: "Eingetragen wird die zuletzt geschaffte Stufe (0–9). Die höchste Stufe gewinnt.",
    example: "Runde 1: Max trifft 1 → Stufe 1 geschafft. Peter trifft 4 → bleibt bei 0.\nAm Ende: Max 9, Peter 6, Klaus 7 → Max gewinnt.",
    scoringMode: "HOECHSTE_GEWINNT",
    scoreLabel: "Stufe",
    active: true,
    sortOrder: 30,
  },
  {
    name: "Hausnummern",
    slug: "hausnummern",
    shortDescription: "Drei Würfe – Hunderter, Zehner, Einer. Wer baut die höchste Hausnummer?",
    goal: "Aus drei Würfen die höchstmögliche dreistellige Zahl („Hausnummer“) bilden.",
    players: "ab 2 Spieler",
    procedure:
      "Jeder Spieler hat 3 Würfe in die Vollen. Direkt nach jedem Wurf muss er ansagen, " +
      "an welche Stelle das Ergebnis kommt: Hunderter, Zehner oder Einer. Jede Stelle darf nur einmal belegt werden.\n" +
      "Der Reiz: Eine 5 im ersten Wurf – lieber gleich als Hunderter nehmen oder auf eine 9 hoffen?",
    rules: [
      "Die Stelle muss sofort nach dem Wurf festgelegt werden und ist danach nicht mehr änderbar.",
      "Ein Pudel ergibt eine 0 an der gewählten Stelle.",
      "Variante „Kleine Hausnummer“: Die niedrigste Zahl gewinnt – im Spiel dann „niedrigster Wert gewinnt“ einstellen.",
    ],
    scoring: "Die gebildete Zahl wird eingetragen. Die höchste Hausnummer gewinnt.",
    example: "Peter wirft 8 → Hunderter. Dann 3 → Einer. Dann 6 → Zehner. Hausnummer: 863.\nMax wirft 5 → Zehner, 9 → Hunderter, 7 → Einer = 957 → Max gewinnt.",
    scoringMode: "HOECHSTE_GEWINNT",
    scoreLabel: "Hausnummer",
    active: true,
    sortOrder: 40,
  },
  {
    name: "Fuchsjagd",
    slug: "fuchsjagd",
    shortDescription: "Ein Fuchs mit Vorsprung, alle anderen jagen ihn.",
    goal: "Als Jäger den Fuchs einholen – oder als Fuchs entkommen.",
    players: "ab 3 Spieler",
    procedure:
      "Ein Spieler ist der Fuchs und bekommt 10 Holz Vorsprung. Er wirft 3 Würfe in die Vollen; sein Holz wird zum Vorsprung addiert.\n" +
      "Danach werfen alle Jäger reihum ebenfalls je 3 Würfe. Jeder Jäger, dessen Holz den Gesamtwert des Fuchses erreicht oder übertrifft, hat ihn „erlegt“.\n" +
      "Anschließend ist der nächste Spieler in der Reihe der Fuchs. Gespielt wird, bis jeder einmal Fuchs war.",
    rules: [
      "Der Vorsprung des Fuchses beträgt 10 Holz (bei geübten Gruppen 15).",
      "Jeder Jäger, der den Fuchs erreicht oder übertrifft, bekommt 1 Punkt.",
      "Wird der Fuchs von keinem Jäger erreicht, bekommt der Fuchs 3 Punkte.",
      "Am Ende werden alle Punkte zusammengezählt.",
    ],
    scoring: "Punkte aus allen Fuchs-Runden zusammenzählen. Die meisten Punkte gewinnen.",
    example:
      "Klaus ist Fuchs: 10 Vorsprung + 7 + 8 + 6 = 31. Max wirft 8 + 9 + 9 = 26, Peter 9 + 9 + 9 = 27 → keiner erreicht 31, Klaus bekommt 3 Punkte.\n" +
      "Nächste Runde ist Max der Fuchs …",
    scoringMode: "HOECHSTE_GEWINNT",
    scoreLabel: "Punkte",
    active: true,
    sortOrder: 50,
  },
  {
    name: "Kranzkegeln",
    slug: "kranzkegeln",
    shortDescription: "Holz zählt – aber ein Kranz ist Gold wert.",
    goal: "Möglichst viele Punkte sammeln, besonders durch einen „Kranz“.",
    players: "ab 2 Spieler",
    procedure:
      "Jeder Spieler hat 5 Würfe in die Vollen. Normales Holz zählt einfach.\n" +
      "Fallen alle 8 äußeren Kegel und bleibt nur der König in der Mitte stehen, ist das ein „Kranz“ – der zählt 20 Punkte.",
    rules: [
      "Normaler Wurf: Punkte = Holz.",
      "Kranz (8 Kegel, nur der König steht): 20 Punkte.",
      "Alle Neune: 12 Punkte.",
      "Nur der König fällt allein: 5 Punkte.",
    ],
    scoring: "Alle Punkte addieren. Die höchste Summe gewinnt.",
    example: "Max wirft 6, Kranz (20), 4, 9 (Alle Neune = 12), 3 → 45 Punkte.",
    scoringMode: "HOECHSTE_GEWINNT",
    scoreLabel: "Punkte",
    active: true,
    sortOrder: 60,
  },
  {
    name: "Plus-Minus",
    slug: "plus-minus",
    shortDescription: "Gerade oder ungerade ansagen – richtig gibt Plus, falsch gibt Minus.",
    goal: "Durch richtige Ansagen den höchsten Punktestand erreichen.",
    players: "ab 2 Spieler",
    procedure:
      "Vor jedem Wurf sagt der Spieler an: „gerade“ oder „ungerade“. Dann wirft er in die Vollen.\n" +
      "Stimmt die Ansage, wird das Holz addiert, sonst abgezogen. Jeder hat 6 Würfe.",
    rules: [
      "Die Ansage muss vor dem Wurf laut erfolgen.",
      "Ein Pudel (0) gilt als gerade – bringt aber weder Plus noch Minus.",
      "Der Punktestand kann nicht unter 0 fallen.",
    ],
    scoring: "Endstand nach allen Würfen. Der höchste Punktestand gewinnt.",
    example: "Peter: „gerade“ → 6 Holz (+6). „ungerade“ → 4 Holz (−4). „ungerade“ → 9 (+9). Stand: 11.",
    scoringMode: "HOECHSTE_GEWINNT",
    scoreLabel: "Punkte",
    active: true,
    sortOrder: 70,
  },
  {
    name: "Einunddreißig",
    slug: "einunddreissig",
    shortDescription: "Genau auf 31 Holz kommen – wer überwirft, fällt zurück.",
    goal: "Mit möglichst wenigen Würfen exakt 31 Holz erreichen.",
    players: "ab 2 Spieler",
    procedure:
      "Reihum wirft jeder in die Vollen und addiert sein Holz. Ziel ist exakt 31.\n" +
      "Wer über 31 kommt, fällt auf 21 zurück und muss sich wieder herantasten.",
    rules: [
      "Überwerfen: Stand wird auf 21 gesetzt.",
      "Jeder Wurf wird gezählt, auch Pudel.",
      "Wer nach 15 Würfen nicht bei 31 ist, wird mit 15 Würfen gewertet.",
    ],
    scoring: "Eingetragen wird die Anzahl der Würfe bis zur 31. Die wenigsten Würfe gewinnen.",
    example: "Klaus: 9, 8, 7 (=24), dann 9 (=33 → zurück auf 21), dann 1, dann 9 (=31) → 6 Würfe.",
    scoringMode: "NIEDRIGSTE_GEWINNT",
    scoreLabel: "Würfe",
    active: true,
    sortOrder: 80,
  },
];
