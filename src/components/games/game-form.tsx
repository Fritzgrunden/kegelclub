import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Select, SubmitButton, Textarea } from "@/components/ui/fields";
import { saveGameAction } from "@/server/actions/games";
import type { GameWithRules } from "@/server/services/games";

export function GameForm({ game }: { game?: GameWithRules }) {
  return (
    <ActionForm action={saveGameAction} className="flex flex-col gap-4">
      {game && <input type="hidden" name="id" value={game.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" name="name"><Input name="name" defaultValue={game?.name} required /></Field>
        <Field label="Kurzadresse (URL)" name="slug" hint="z. B. fuchsjagd"><Input name="slug" defaultValue={game?.slug} required /></Field>
      </div>
      <Field label="Kurzbeschreibung" name="shortDescription"><Input name="shortDescription" defaultValue={game?.shortDescription} required /></Field>
      <Field label="Ziel des Spiels" name="goal"><Textarea name="goal" defaultValue={game?.goal} rows={3} /></Field>
      <Field label="Spieler" name="players" hint="z. B. ab 2 Spieler"><Input name="players" defaultValue={game?.players} /></Field>
      <Field label="Spielablauf" name="procedure"><Textarea name="procedure" defaultValue={game?.procedure} rows={6} /></Field>
      <Field label="Regeln" name="rules" hint="Eine Regel pro Zeile."><Textarea name="rules" defaultValue={game?.rules.join("\n")} rows={6} /></Field>
      <Field label="Wertung" name="scoring"><Textarea name="scoring" defaultValue={game?.scoring} rows={3} /></Field>
      <Field label="Beispiel" name="example"><Textarea name="example" defaultValue={game?.example} rows={4} /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Wer gewinnt?" name="scoringMode">
          <Select name="scoringMode" defaultValue={game?.scoringMode ?? "HOECHSTE_GEWINNT"}>
            <option value="HOECHSTE_GEWINNT">Höchster Wert</option>
            <option value="NIEDRIGSTE_GEWINNT">Niedrigster Wert</option>
          </Select>
        </Field>
        <Field label="Einheit" name="scoreLabel" hint="z. B. Holz, Punkte, Würfe"><Input name="scoreLabel" defaultValue={game?.scoreLabel ?? "Punkte"} /></Field>
        <Field label="Reihenfolge" name="sortOrder"><Input name="sortOrder" type="number" inputMode="numeric" defaultValue={game?.sortOrder ?? 50} /></Field>
      </div>
      <label className="flex min-h-12 items-center gap-3">
        <input type="checkbox" name="active" defaultChecked={game?.active ?? true} className="size-6 accent-[var(--color-messing)]" />
        Aktiv (in der Spielauswahl sichtbar)
      </label>
      <SubmitButton size="xl" className="w-full">Spiel speichern</SubmitButton>
    </ActionForm>
  );
}
