import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy · IFlow",
  description: "How IFlow by Imaginum handles your data, including Google Calendar access.",
};

// Static, public page (no session needed) — linked from the Google OAuth consent screen.
export const dynamic = "force-static";

const UPDATED = "November 5, 2026";
const CONTACT = "imaginum.org@gmail.com";

export default function PrivacyPage() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b border-surface-border">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/login" className="flex items-center gap-2">
            <img src="/logo-large.png" alt="" className="h-6 w-auto" />
            <span className="text-[15px] font-semibold tracking-[-0.01em]">IFlow</span>
          </Link>
          <span className="text-[12.5px] text-muted-foreground">by Imaginum</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-12 sm:py-16">
        <p className="text-[13px] text-muted-foreground">Last updated {UPDATED}</p>
        <h1 className="text-display text-[44px] sm:text-[52px] mt-2">Privacy Policy</h1>
        <p className="text-[15px] text-muted-foreground mt-4 leading-relaxed max-w-2xl">
          IFlow is an internal project-management workspace operated by Imaginum for its own team. Access is by
          invitation only. This page explains what data IFlow handles and how.
        </p>

        <div className="mt-12 space-y-10 text-[14.5px] leading-relaxed text-foreground/90">
          <Section title="Who can use IFlow">
            IFlow accounts are created by an Imaginum administrator. It is not offered to the public, and there is no
            self sign-up.
          </Section>

          <Section title="Data we store">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Account details: display name, username, role, and a securely hashed password.</li>
              <li>Work data you create: boards, tickets, comments, wiki pages, page-tracker items, expenses and meetings.</li>
              <li>Email addresses that team members add so they can receive meeting invitations.</li>
              <li>Basic activity information, such as when you were last active, used to show team presence.</li>
            </ul>
          </Section>

          <Section title="Google account data">
            <p>
              An IFlow administrator can connect one Imaginum team Google account so the team can schedule Google Meet
              calls from IFlow. With that connection, IFlow requests only:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-3">
              <li>
                <b className="font-medium text-foreground">Your Google account email</b> (<code className="text-[13px]">openid</code>,{" "}
                <code className="text-[13px]">email</code>) — to show which account is connected.
              </li>
              <li>
                <b className="font-medium text-foreground">Calendar events</b> (<code className="text-[13px]">calendar.events</code>) — to
                create, update and cancel the meetings scheduled in IFlow, including their Google Meet links, and to read
                back those same events to keep them in sync.
              </li>
              <li>
                <b className="font-medium text-foreground">Your calendar list</b> (<code className="text-[13px]">calendar.calendarlist.readonly</code>) —
                so the administrator can choose which calendar meetings are added to.
              </li>
            </ul>
            <p className="mt-3">
              IFlow does not read, store or modify any other events on the calendar. The access token Google issues is
              stored encrypted on our servers and is used only to perform the actions above. An administrator can
              disconnect at any time, which revokes the token with Google; you can also remove access from your{" "}
              <a className="underline underline-offset-2" href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
                Google account permissions
              </a>
              .
            </p>
            <p className="mt-3">
              IFlow&apos;s use and transfer of information received from Google APIs adheres to the{" "}
              <a
                className="underline underline-offset-2"
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </Section>

          <Section title="How data is used and shared">
            Data in IFlow is used only to run the workspace for the Imaginum team. We do not sell it, use it for
            advertising, or share it with third parties, except the infrastructure providers that host the service
            (database and hosting) and Google, when scheduling meetings as described above.
          </Section>

          <Section title="Retention and deletion">
            Work data is kept while it is useful to the team. An administrator can deactivate accounts and delete
            content. To request deletion of your data, contact us at the address below.
          </Section>

          <Section title="Security">
            Passwords are hashed, sensitive values such as Google tokens and environment secrets are encrypted at rest,
            and all traffic is served over HTTPS.
          </Section>

          <Section title="Contact">
            Questions about this policy or your data:{" "}
            <a className="underline underline-offset-2" href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>
            .
          </Section>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2.5">{title}</h2>
      <div className="text-muted-foreground [&_b]:text-foreground">{children}</div>
    </section>
  );
}
