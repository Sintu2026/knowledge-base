import type { ReactNode } from "react";
import { FileText, Film, Library, ListChecks, Workflow } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Row, RowLink, RowList } from "@/components/ui/Row";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  ChipDemo,
  ComboboxDemo,
  ModalDemo,
  TabsDemo,
  ToastDemo,
} from "./demos";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="section-label">{title}</h2>
      {children}
    </section>
  );
}

const tokens = [
  ["canvas", "bg-canvas border border-hairline"],
  ["surface", "bg-surface border border-hairline"],
  ["sunken", "bg-sunken border border-hairline"],
  ["hairline", "bg-hairline"],
  ["hairline-strong", "bg-hairline-strong"],
  ["ink", "bg-ink"],
  ["ink-muted", "bg-ink-muted"],
  ["ink-faint", "bg-ink-faint"],
  ["accent", "bg-accent"],
  ["accent-tint", "bg-accent-tint"],
  ["warning", "bg-warning"],
  ["warning-tint", "bg-warning-tint"],
  ["danger", "bg-danger"],
  ["danger-tint", "bg-danger-tint"],
] as const;

export default function KitchenSinkPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-8">
      <header className="flex items-center justify-between border-b border-hairline pb-4">
        <div className="flex items-center gap-2">
          <Library size={18} className="text-accent" aria-hidden />
          <span className="font-medium">Kitchen sink</span>
        </div>
        <ThemeToggle />
      </header>

      <Section title="Tokens">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
          {tokens.map(([name, cls]) => (
            <div key={name} className="flex flex-col gap-1">
              <div className={`h-10 rounded-control ${cls}`} />
              <span className="text-xs text-ink-muted">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type">
        <div className="flex flex-col gap-2">
          <p className="text-page-title font-medium">
            Page title — 22px, weight 500
          </p>
          <p className="text-section-head font-medium">
            Section head — 16px, weight 500
          </p>
          <p className="text-sm">
            Body — 14px, weight 400. Two weights only, and{" "}
            <strong>emphasis stays at 500</strong>.
          </p>
          <p className="text-sm text-ink-muted">
            Muted body — metadata, counts, and hints.
          </p>
          <p className="section-label">Section label — the uppercase exception</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary">Add knowledge</Button>
          <Button>Save draft</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger">Delete entry</Button>
          <Button variant="primary" disabled>
            Publish
          </Button>
          <Button size="sm">Mark reviewed</Button>
          <LinkButton href="/kitchen-sink" variant="ghost" size="sm">
            Open module
          </LinkButton>
        </div>
      </Section>

      <Section title="Inputs">
        <div className="flex max-w-md flex-col gap-3">
          <Input placeholder="Search the knowledge base" />
          <Input
            variant="bare"
            placeholder="Untitled entry"
            className="text-[22px] font-medium"
          />
          <Textarea placeholder="The thing itself, in one paragraph" autoGrow />
          <Select defaultValue="90">
            <option value="30">Review every 30 days</option>
            <option value="90">Review every 90 days</option>
            <option value="180">Review every 180 days</option>
            <option value="365">Review every year</option>
          </Select>
          <ComboboxDemo />
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Process</Badge>
          <Badge>Feature</Badge>
          <Badge variant="accent">Beginner</Badge>
          <Badge variant="warning">Review overdue</Badge>
        </div>
      </Section>

      <Section title="Chips">
        <ChipDemo />
      </Section>

      <Section title="Card and rows">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-4">
            <p className="font-medium">Raise a purchase order</p>
            <p className="mt-1 text-sm text-ink-muted">
              How purchases over $500 get approved before money moves.
            </p>
          </Card>
          <RowList>
            <RowLink
              href="/kitchen-sink"
              leading={<Film size={16} />}
              trailing={<span className="text-xs">2:14</span>}
            >
              Reconcile a bank feed
            </RowLink>
            <RowLink
              href="/kitchen-sink"
              leading={<FileText size={16} />}
              trailing={<span className="text-xs">1.2 MB</span>}
            >
              Supplier onboarding form
            </RowLink>
            <Row leading={<Workflow size={16} />}>Approval chain</Row>
            <Row leading={<ListChecks size={16} />} trailing={<span className="text-xs">3 of 7 done</span>}>
              Month-end checklist
            </Row>
          </RowList>
        </div>
      </Section>

      <Section title="Section rail">
        <div className="flex flex-col gap-4">
          <div className="border-l-2 border-accent pl-4">
            <p className="section-label">What</p>
            <p className="mt-1 text-sm">
              A filled section carries the accent rail.
            </p>
          </div>
          <div className="border-l-2 border-hairline pl-4">
            <p className="section-label">Why</p>
            <p className="mt-1 text-sm text-ink-faint">
              An empty section stays muted until someone writes it.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Breadcrumbs">
        <Breadcrumbs
          items={[
            { label: "Xero", href: "/kitchen-sink" },
            { label: "Invoices", href: "/kitchen-sink" },
            { label: "Send a recurring invoice" },
          ]}
        />
      </Section>

      <Section title="Avatar">
        <div className="flex items-center gap-2">
          <Avatar name="Manpreet Kaur" />
          <Avatar name="Dev User" size="sm" />
        </div>
      </Section>

      <Section title="Tabs">
        <TabsDemo />
      </Section>

      <Section title="Modal">
        <div>
          <ModalDemo />
        </div>
      </Section>

      <Section title="Toast">
        <ToastDemo />
      </Section>

      <Section title="Empty state">
        <EmptyState
          title="Add what your team keeps re-explaining"
          description="One entry, five questions: what, why, how, who, when."
          action={<Button variant="primary">Add knowledge</Button>}
        />
      </Section>
    </main>
  );
}
