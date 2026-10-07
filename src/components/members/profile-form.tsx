import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, SubmitButton } from "@/components/ui/fields";
import { updateProfileAction } from "@/server/actions/profile";
import type { Member } from "@/server/services/users";

export function ProfileForm({ member, adminMode = false }: { member: Member; adminMode?: boolean }) {
  return (
    <ActionForm action={updateProfileAction} className="flex flex-col gap-4">
      {adminMode && <input type="hidden" name="userId" value={member.id} />}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Vorname" name="firstName"><Input name="firstName" defaultValue={member.firstName} autoComplete="given-name" /></Field>
        <Field label="Nachname" name="lastName"><Input name="lastName" defaultValue={member.lastName} autoComplete="family-name" /></Field>
      </div>
      <Field label="Spitzname" name="nickname" hint="Wird in Listen und Ranglisten angezeigt."><Input name="nickname" defaultValue={member.nickname ?? ""} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Geburtstag" name="birthday"><Input name="birthday" type="date" defaultValue={member.birthday ?? ""} /></Field>
        <Field label="Telefon (optional)" name="phone"><Input name="phone" type="tel" inputMode="tel" defaultValue={member.phone ?? ""} autoComplete="tel" /></Field>
      </div>
      {adminMode ? (
        <Field label="E-Mail" name="email"><Input name="email" type="email" defaultValue={member.email} /></Field>
      ) : (
        <Field label="E-Mail" name="emailReadonly" hint="Änderungen der E-Mail-Adresse nimmt ein Admin vor.">
          <Input name="emailReadonly" value={member.email} readOnly disabled />
        </Field>
      )}
      <SubmitButton className="w-full sm:w-auto">Profil speichern</SubmitButton>
    </ActionForm>
  );
}
