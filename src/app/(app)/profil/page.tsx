import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ROLE_LABELS } from "@/lib/permissions";
import { USER_STATUS_LABELS } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getMember } from "@/server/services/users";
import { changePasswordAction } from "@/server/actions/profile";
import { AvatarUpload } from "@/components/members/avatar-upload";
import { ProfileForm } from "@/components/members/profile-form";
import { PushSettings } from "@/components/members/push-settings";
import { getVapidPublicKey } from "@/server/services/push";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, SubmitButton } from "@/components/ui/fields";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Mein Profil" };

export default async function ProfilePage() {
  const user = await requireUser();
  const member = await getMember(user.id);
  if (!member) notFound();
  return (
    <>
      <PageHeader title="Mein Profil" actions={<LinkButton href={`/mitglieder/${user.id}`} variant="ghost">Meine Statistik</LinkButton>} />
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <Card className="flex flex-col items-center gap-4">
          <AvatarUpload person={member} />
          <div className="flex flex-wrap justify-center gap-1.5">
            {member.roles.map((r) => <Badge key={r} tone={r === "MITGLIED" ? "neutral" : "messing"}>{ROLE_LABELS[r]}</Badge>)}
            <Badge tone="zusage">{USER_STATUS_LABELS[member.status]}</Badge>
          </div>
        </Card>
        <div className="flex flex-col gap-5">
          <Card>
            <CardTitle>Persönliche Daten</CardTitle>
            <ProfileForm member={member} />
          </Card>
          <Card>
            <CardTitle>Benachrichtigungen</CardTitle>
            <PushSettings vapidPublicKey={getVapidPublicKey()} />
          </Card>
          <Card>
            <CardTitle>Passwort ändern</CardTitle>
            <ActionForm action={changePasswordAction} resetOnSuccess className="flex flex-col gap-4">
              <Field label="Aktuelles Passwort" name="currentPassword"><Input name="currentPassword" type="password" autoComplete="current-password" /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Neues Passwort" name="newPassword" hint="Mindestens 10 Zeichen."><Input name="newPassword" type="password" autoComplete="new-password" /></Field>
                <Field label="Wiederholen" name="confirmPassword"><Input name="confirmPassword" type="password" autoComplete="new-password" /></Field>
              </div>
              <SubmitButton variant="secondary" className="w-full sm:w-auto">Passwort ändern</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
