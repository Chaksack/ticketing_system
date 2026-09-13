<script setup lang="ts">
const faqs = [
  {
    q: 'What\'s the difference between a reply and an internal note?',
    a: 'A reply is sent to the customer by email and appears in the customer\'s inbox. An internal note (toggle the "Internal note" switch in the reply box) is only ever visible to staff — customers never see it. Use notes to coordinate with teammates on a ticket without notifying the requester.',
  },
  {
    q: 'How does a ticket get assigned?',
    a: 'If an automation rule matches the ticket and sets an assignee, that assignee is used. Otherwise, the system automatically assigns the ticket to whichever active staff member currently has the fewest open or in-progress tickets — so the queue self-balances without anyone having to hand-triage it. You can always reassign manually from the ticket detail view.',
  },
  {
    q: 'How is the SLA due date calculated?',
    a: 'When a ticket is created, its priority looks up the matching SLA policy (Admin → SLA Policies) and the ticket\'s first-response and resolution deadlines are set to "created at + that policy\'s target minutes." Changing a policy only affects tickets created afterward, not tickets already in flight.',
  },
  {
    q: 'What happens when a ticket breaches its SLA?',
    a: 'A background check runs every 5 minutes. Any open or in-progress ticket past its resolution deadline that hasn\'t already been escalated gets flagged, and every on-call staff member is paged via push notification — the same paging that fires when a new ticket is created. Each ticket is only escalated once.',
  },
  {
    q: 'Do resolved tickets close automatically?',
    a: 'Yes — a ticket left in "Resolved" for 72 hours with no further action is automatically moved to "Closed" by the same background sweep that handles SLA escalation.',
  },
  {
    q: 'Can I create a tag on the fly?',
    a: 'Yes. In the ticket detail view, click the "Tag" button, type a name that doesn\'t exist yet, and it\'s created and attached in one step. Any staff member can create tags; only admins can delete them.',
  },
  {
    q: 'What does applying a macro do?',
    a: 'A macro (Admin → Macros) posts its body text to the customer as a reply, and can optionally also set the ticket\'s status, priority, and/or add a tag — all in one click from the Macros button next to the reply box.',
  },
  {
    q: 'Who can see the Reports and Admin pages?',
    a: 'Reports, Admin, SLA Policies, Macros, and Automations are all admin-only. Agents can work tickets, reply, tag, and reassign, but can\'t change SLA targets, manage staff, or edit automation rules.',
  },
  {
    q: 'Can a customer reply to a ticket by email?',
    a: 'If inbound email is configured (ask an admin), yes — replying to any ticket-reply email adds that reply directly to the ticket, and reopens it automatically if it was resolved or closed. If it isn\'t configured, customers can only continue the conversation by submitting a new request through the portal.',
  },
  {
    q: 'How do I add or change my profile picture?',
    a: 'Go to Settings → Profile, click "Change photo" under your name, and choose a PNG, JPEG, WEBP, or GIF up to 2MB. It updates everywhere your name appears — the sidebar, activity timelines, and assignee pickers. Click "Remove" to go back to your initials.',
  },
  {
    q: 'What\'s the difference between a Chat group and a Chat channel?',
    a: 'A group is invite-only — you explicitly add the people in it, like a DM but with more than one other person. A channel is linked to a Project and is self-service: anyone can browse and join one from the hash icon in Chat, no invite needed.',
  },
  {
    q: 'Why doesn\'t the AI suggestion on a lead show a percentage?',
    a: 'The win-probability model needs at least 20 of your own decided (won or lost) leads and tenders before it trains — below that, showing a number would just be noise. Until then the card still shows the simpler "going cold" signal based on days since last contact, which doesn\'t need any training data, plus how many more decided deals are needed before the score turns on.',
  },
  {
    q: 'How is an invoice\'s balance calculated?',
    a: 'You never set it directly — it\'s recalculated automatically every time a receipt (payment) is recorded or removed: balance = total minus the sum of receipts. The status (Unpaid/Partial/Paid) follows the same recalculation, and every payment posts a matching entry to the general ledger behind the scenes.',
  },
  {
    q: 'Does marking a Quote as "Invoiced" create a real invoice?',
    a: 'No — Quotes and Invoices are separate, unconnected records. "Invoiced" is just a status label on the quote for your own tracking; create the actual Invoice separately from the client\'s Finance section once the deal is billable.',
  },
  {
    q: 'Can I connect Slack or Gmail on someone else\'s behalf?',
    a: 'No — Settings → Integrations and the Mail page\'s Gmail connection are both per-person. Each staff member connects their own account and only ever sees notifications or mail addressed to them.',
  },
]
</script>

<template>
  <div class="w-full flex flex-col gap-6">
    <div>
      <h2 class="text-2xl font-bold tracking-tight">
        Help &amp; Support
      </h2>
      <p class="text-muted-foreground">
        How the IBS Ticketing System works, and how to get the most out of it.
      </p>
    </div>

    <Tabs default-value="overview">
      <TabsList class="flex-wrap h-auto">
        <TabsTrigger value="overview">
          Overview
        </TabsTrigger>
        <TabsTrigger value="bdsm">
          BD &amp; SM
        </TabsTrigger>
        <TabsTrigger value="finance">
          Finance
        </TabsTrigger>
        <TabsTrigger value="calchat">
          Calendar &amp; Chat
        </TabsTrigger>
        <TabsTrigger value="portal">
          Submitting a Ticket
        </TabsTrigger>
        <TabsTrigger value="agents">
          Working a Ticket
        </TabsTrigger>
        <TabsTrigger value="automation">
          Automation &amp; SLA
        </TabsTrigger>
        <TabsTrigger value="admin">
          Admin &amp; Reports
        </TabsTrigger>
        <TabsTrigger value="faq">
          FAQ
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" class="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>What is this?</CardTitle>
            <CardDescription>
              One system covering support tickets, BD/sales pipeline, finance, and team
              tools — tracking everything automatically instead of relying on someone to
              chase it by hand.
            </CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-4 text-sm">
            <p>
              Customers submit requests through a public portal — no account required. Each
              submission becomes a <strong>ticket</strong>: it's automatically assigned to a
              support agent, given an SLA deadline based on its priority, and on-call staff
              are paged. From there, agents work the ticket until it's resolved and
              eventually closed. Alongside that, BD/SM staff run the sales pipeline (Leads,
              Tenders, Clients, Projects, Quotes), Finance tracks invoices and the general
              ledger, and everyone shares Calendar, Chat, and Tasks/Sprints.
            </p>
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="rounded-md border p-3">
                <p class="font-medium">
                  Roles
                </p>
                <p class="text-muted-foreground">
                  A staff member can hold one or more roles — Admin, Agent, BD, Sales &amp;
                  Marketing, Finance, Engineer, Engineering Coordinator, Engineering Lead —
                  and the sidebar only shows what your roles unlock. Admins see everything.
                </p>
              </div>
              <div class="rounded-md border p-3">
                <p class="font-medium">
                  Ticket statuses
                </p>
                <p class="text-muted-foreground">
                  Open → In Progress → Resolved → Closed. Resolved tickets auto-close after
                  72 hours of inactivity.
                </p>
              </div>
              <div class="rounded-md border p-3">
                <p class="font-medium">
                  Priorities
                </p>
                <p class="text-muted-foreground">
                  Low, Medium, High, Urgent — each has its own SLA response and resolution
                  targets.
                </p>
              </div>
              <div class="rounded-md border p-3">
                <p class="font-medium">
                  Where to work
                </p>
                <p class="text-muted-foreground">
                  <NuxtLink to="/tickets" class="underline">
                    Tickets
                  </NuxtLink>
                  is the support queue,
                  <NuxtLink to="/" class="underline">
                    Overview
                  </NuxtLink>
                  is the BD/SM dashboard, and
                  <NuxtLink to="/chat" class="underline">
                    Chat
                  </NuxtLink>
                  and
                  <NuxtLink to="/calendar" class="underline">
                    Calendar
                  </NuxtLink>
                  are shared by everyone. Admin- and Finance-only tools live under their own
                  sidebar sections.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="bdsm" class="mt-4">
        <div class="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Leads</CardTitle>
              <CardDescription>
                Track prospects before there's a signed deal.
              </CardDescription>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              Each lead moves through New → Contacted → Qualified → Proposal Sent → Won/Lost.
              Assign one or more staff, set a next step with a reminder date/time (you'll get
              a push and in-app notification when it's due), and log multiple emails/phone
              numbers for the same contact. When the deal is ready, click
              <strong>Convert to Client</strong> — this creates a real client record carrying
              over the lead's assignees and marks the lead "Won."
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tenders</CardTitle>
              <CardDescription>
                Track competitive/public bids from submission through award.
              </CardDescription>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              A tender moves through Identified → Registered → Preparing → Submitted →
              Evaluation → Won/Lost, alongside the issuing authority, a reference number,
              a submission deadline (with its own reminder as it nears), and one or more
              assignees. A Won tender can be <strong>Converted to Client</strong> the same
              way a Won lead can.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Clients</CardTitle>
              <CardDescription>
                Everything about a client lives in one place.
              </CardDescription>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              Clients move through their own stage pipeline (Lead → Contacted → Proposal Sent
              → Negotiation → Active → Lost), support multiple assignees, and can have several
              contact emails/phones for the same person. A client's Projects and legacy AMC
              contracts are nested right in its detail view, alongside an activity timeline of
              every stage/assignee/AMC change.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              A project belongs to one client and is where AMC contracts get assigned going
              forward — open a client and use "New Project," or manage all projects from the
              <NuxtLink to="/projects" class="underline">
                Projects
              </NuxtLink> page.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AMC Plans &amp; Contracts</CardTitle>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              <p>
                AMC Plans (default duration + currency) are the templates you assign to a
                project as a contract. Each contract has its own status pipeline — Submitted →
                Negotiating → Active → Lost, or Cancelled/Expired — plus a follow-up field with
                its own reminder, separate from the pipeline status.
              </p>
              <p class="mt-2">
                Active contracts get an automatic renewal-reminder push 30 and 7 days before
                their end date, and flip to "Expiring soon" in the UI during that window.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tasks &amp; Sprints</CardTitle>
              <CardDescription>
                A Jira-style kanban board, with sprint planning built in.
              </CardDescription>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              Epics group Tasks, and Tasks can have Subtasks. A Task either sits in the
              Backlog or belongs to a Sprint — create a sprint, drag tasks into it (or use a
              card's "Move to sprint" menu), then click <strong>Start Sprint</strong> to make
              it active (starting one automatically completes whichever sprint was already
              active — only one runs at a time). Drag cards between status columns as work
              progresses, assign one or more staff per task, and set a "remind me at" time to
              get paged before something's due. Click <strong>Complete Sprint</strong> when
              it's done.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quotes</CardTitle>
              <CardDescription>
                A pre-sale proposal, attached directly to a Lead or Tender.
              </CardDescription>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              Open a Lead or Tender and look for its Quotes section — build line items from
              the shared Products catalog (Admin → Products), track the quote's status
              through Quoted → Ordered → Invoiced, and download a branded PDF to send to the
              prospect. Marking a quote "Invoiced" is just a label for your own tracking — it
              doesn't create a real Invoice; do that from the client's Finance section once
              the deal is billable.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Finding things fast</CardTitle>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              Every list (Leads, Tenders, Clients, Projects, Tasks) has a search box, sortable
              columns, and dropdown filters — click a column header to sort, or the filter
              chips above the table to narrow by stage/status/assignee.
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="finance" class="mt-4">
        <div class="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Invoices &amp; Receipts</CardTitle>
              <CardDescription>
                Bill a client and track what they still owe.
              </CardDescription>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              An invoice belongs to a project, with its own line items, an optional tax rate
              and discount, and a currency. Recording a receipt (a payment) against an
              invoice automatically recalculates its amount paid, balance, and status
              (Unpaid → Partial → Paid) — you never set those by hand.
              <NuxtLink to="/invoices" class="underline">
                Invoices
              </NuxtLink>
              (Finance section) lists every invoice across every client with an
              outstanding-balance summary by currency; open a client's own detail view to
              see just theirs.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>General Ledger</CardTitle>
              <CardDescription>
                A real double-entry ledger behind the numbers. Finance role only.
              </CardDescription>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              Every invoice payment automatically posts a balanced journal entry (Debit Cash
              / Credit Accounts Receivable) — nothing here needs manual bookkeeping unless
              you're recording something outside of client receipts. Finance staff maintain
              the <strong>Chart of Accounts</strong> (asset/liability/equity/revenue/expense
              accounts, each with a live balance computed from the ledger, never stored),
              post manual <strong>Journal Entries</strong> (total debits must equal total
              credits, or it's rejected), and open/close monthly
              <strong>Fiscal Periods</strong> to lock the books once a month is finalized —
              you can't post into a closed period.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Conversion Suggestions</CardTitle>
              <CardDescription>
                A model trained on your own won/lost history — not a third-party AI.
              </CardDescription>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              Every lead, tender, and client detail view shows an "AI Suggestion" card
              combining two signals: a win-probability score from a small model trained on
              your own decided (won/lost) leads and tenders, and a "going cold" flag based on
              how long it's been since the last logged interaction. The model needs at least
              20 decided deals before it'll show a probability — below that, the card just
              shows how many more it needs and falls back to the contact-recency signal
              alone. BD/SM staff can retrain it on demand from the
              <NuxtLink to="/bd-reports" class="underline">
                BD &amp; SM Reports
              </NuxtLink> page (it also retrains automatically overnight).
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="calchat" class="mt-4">
        <div class="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Calendar</CardTitle>
              <CardDescription>
                Meetings, site visits, and other scheduled activities.
              </CardDescription>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              Every event has a free-text activity type (Meeting, Site Visit, Client Visit,
              Scouting, or anything else you type) shown as a colored badge. Click any day to
              open its full agenda instead of jumping straight into a new event — from there
              you can add an activity for that day or open an existing one. Export a month
              (or a single day, from the day view) as a branded PDF report.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Chat</CardTitle>
              <CardDescription>
                Direct messages, private groups, and project channels.
              </CardDescription>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              Chat has two kinds of conversations: <strong>Direct Messages/Groups</strong>
              (invite-only — you add people explicitly) and <strong>Channels</strong> (linked
              to a Project, self-service — anyone can browse and join one from the hash icon
              next to the new-message buttons). React to any message with an emoji, and use
              the @ button to mention a ticket, lead, client, task, or project inline — it
              becomes a clickable link in the message. Your joined channels and conversations
              also show in a "Chat" dropdown in the main sidebar for quick access without
              opening the full page.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Integrations &amp; Personal Email</CardTitle>
              <CardDescription>
                Connect your own accounts — per person, not shared.
              </CardDescription>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              Settings → Integrations lets you connect your own Slack account — once
              connected, you'll get a Slack DM for the same things that already trigger an
              in-app or push notification (assignments, mentions, reminders); send yourself a
              test message from the same screen to confirm it's working. Separately, the
              Mail page lets you connect your own Gmail account to read and send personal
              email from inside the app — distinct from the shared support inbox that handles
              ticket replies.
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="portal" class="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>How customers submit a ticket</CardTitle>
            <CardDescription>
              The public support portal, no login required.
            </CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-3 text-sm">
            <ol class="list-decimal list-inside flex flex-col gap-2">
              <li>The customer goes to <code class="text-xs bg-muted px-1 py-0.5 rounded">/portal</code> and fills in their name, email, a summary, priority, category, a description, and optionally attaches files or adds their own reference number.</li>
              <li>On submit, the ticket is created and shown a confirmation with its ticket ID (e.g. <code class="text-xs bg-muted px-1 py-0.5 rounded">TICKET-1042</code>).</li>
              <li>Behind the scenes: any matching automation rule is applied, the ticket is auto-assigned to the least-loaded active staff member, its SLA deadlines are set from the priority's policy, and on-call staff are paged.</li>
              <li>The customer is emailed whenever a staff member posts a public reply on their ticket — internal notes are never emailed.</li>
              <li>If inbound email is configured for this deployment, the customer can simply hit "reply" on that email — their reply is added to the ticket automatically, and reopens it if it had been resolved or closed.</li>
            </ol>
            <p class="text-muted-foreground">
              This portal can also be embedded elsewhere — the submission endpoint is a public,
              rate-limited API that can be called directly from another site (e.g. a marketing
              site's contact form), not just this app's own portal page.
            </p>
            <p class="text-muted-foreground">
              Staff can also report a ticket on a customer's behalf from the
              <NuxtLink to="/tickets" class="underline">
                Tickets
              </NuxtLink>
              page using the "Report Ticket" button — the same flow, plus the option to
              pick an assignee up front.
            </p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="agents" class="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Working a ticket</CardTitle>
            <CardDescription>
              Everything available from the ticket detail view.
            </CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-4 text-sm">
            <div>
              <p class="font-medium">
                1. Find it
              </p>
              <p class="text-muted-foreground">
                The <NuxtLink to="/tickets" class="underline">
                  Tickets
                </NuxtLink> table can be filtered by status, priority, assignee, and tags, and searched by subject. Click any row to open the detail view.
              </p>
            </div>
            <div>
              <p class="font-medium">
                2. Triage
              </p>
              <p class="text-muted-foreground">
                From the header of the detail view you can change status, priority, and
                assignee, and add or remove tags — every change is recorded in the
                activity timeline underneath the conversation.
              </p>
            </div>
            <div>
              <p class="font-medium">
                3. Respond
              </p>
              <p class="text-muted-foreground">
                Type in the reply box and send — this emails the customer and, if it's the
                first response, stops the first-response SLA clock. Flip the "Internal
                note" switch first if the message is only for other staff; it's never
                emailed and is highlighted in the timeline so it's easy to tell apart from
                a real reply.
              </p>
            </div>
            <div>
              <p class="font-medium">
                4. Use a macro
              </p>
              <p class="text-muted-foreground">
                Click "Macros" next to the reply box to instantly post a canned response —
                it can also update status/priority/tags at the same time, in one click.
              </p>
            </div>
            <div>
              <p class="font-medium">
                5. Resolve
              </p>
              <p class="text-muted-foreground">
                Set the status to Resolved once you're done. If nothing else happens on the
                ticket for 72 hours, it closes automatically.
              </p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="automation" class="mt-4">
        <div class="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>SLA badges</CardTitle>
              <CardDescription>
                Shown on every ticket row and in the detail view.
              </CardDescription>
            </CardHeader>
            <CardContent class="flex flex-col gap-2 text-sm">
              <div class="flex items-center gap-2">
                <span class="size-2 rounded-full bg-emerald-500" />
                <span><strong>On track</strong> — plenty of time left before the resolution deadline.</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="size-2 rounded-full bg-amber-500" />
                <span><strong>At risk</strong> — less than 20% of the resolution window remains.</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="size-2 rounded-full bg-destructive" />
                <span><strong>Breached</strong> — past the deadline. On-call staff are paged automatically the first time this happens.</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Automation rules</CardTitle>
              <CardDescription>
                Admin → Automations. Run once, when a ticket is created.
              </CardDescription>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              Each rule matches on a ticket's <strong>category</strong> or <strong>subject</strong>
              (equals or contains a value) and, on match, can set priority, status,
              assignee, and/or add a tag. The first matching enabled rule wins. Rules only
              run at creation time — they never re-evaluate an existing ticket — so
              reordering or editing a rule has no effect on tickets already in the queue.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Auto-assignment, on-call paging &amp; escalation</CardTitle>
            </CardHeader>
            <CardContent class="flex flex-col gap-2 text-sm text-muted-foreground">
              <p>
                If no rule sets an assignee, the ticket goes to whichever active staff member
                currently holds the fewest open/in-progress tickets. Separately, every active
                on-call staff member (Admin → toggle "On-call" per staff member) gets a push
                notification the moment a ticket is created, and again — once — the first
                time it breaches its SLA.
              </p>
              <p>
                <strong>Paging and escalation are different things that happen to fire
                  together.</strong> Paging just notifies on-call staff; it doesn't reassign
                anything. Escalating actually moves ownership of the ticket up a fixed chain
                — Engineer → Engineering Coordinator → Engineering Lead — reassigning it to
                the least-loaded active person at that next level. A ticket's first SLA
                breach triggers both a page and (if it hasn't been escalated yet) a one-level
                escalation; after that, anyone can also escalate a ticket manually at any
                time from its detail view, independent of SLA status.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>BD Automations (Admin)</CardTitle>
              <CardDescription>
                The same idea as ticket automations, applied to Leads and Tenders.
              </CardDescription>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              Two triggers instead of one: <strong>Created</strong> (matches the new
              lead/tender's source) and <strong>Stage Changed</strong> (fires when a record
              enters a specific stage — e.g. notify someone whenever a tender hits
              "Evaluation"). Actions are also different from ticket rules: set an assignee
              (only if the record doesn't already have one) and/or notify a staff member —
              there's no status/priority/tag action here. New leads also always
              auto-assign to the least-loaded active BD staff member, independent of any rule.
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="admin" class="mt-4">
        <div class="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Staff (Admin)</CardTitle>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              Invite staff and assign one or more roles — Admin, Agent, BD, Sales &amp;
              Marketing, Finance, Engineer, Engineering Coordinator, Engineering Lead — each
              unlocking a different slice of the sidebar. Enable/disable accounts and toggle
              on-call status from the same screen. New staff get an emailed invite link to
              set their password.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>SLA Policies (Admin)</CardTitle>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              Edit the first-response and resolution time targets, in minutes, for each of
              the four priorities. Changes apply to tickets created from that point on.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Macros (Admin)</CardTitle>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              Create canned responses agents can apply from any ticket, optionally bundling
              in a status/priority change or a tag.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Automations &amp; BD Automations (Admin)</CardTitle>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              Build condition → action rules that fire on ticket creation, or on a lead/tender
              being created or changing stage. See "Automation &amp; SLA" for how matching
              works for each.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>BD Quotas (Admin)</CardTitle>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              Set a monthly target value per BD/SM staff member. Progress is the value of
              their leads and tenders that moved to Won during that calendar month — shown
              as a progress bar on the
              <NuxtLink to="/bd-reports" class="underline">
                BD &amp; SM Reports
              </NuxtLink> page, independent of whatever date range is set there.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Products (Admin)</CardTitle>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              The shared catalog (name, description, unit price, currency) that BD/SM staff
              pick from when building Quote line items, rather than typing them freehand.
              Maintaining the catalog itself is admin-only.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Reports (Admin)</CardTitle>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              Ticket volume over the last 30 days, breakdowns by status and priority, SLA
              compliance rate, average first-response and resolution time, and a
              per-agent table of tickets resolved and average resolution time.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Activity Log (Admin)</CardTitle>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              A merged, filterable feed of activity across tickets, clients, and leads — filter
              by staff member to audit what a specific person has been doing.
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="faq" class="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Frequently asked questions</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible>
              <AccordionItem v-for="(item, index) in faqs" :key="index" :value="`faq-${index}`">
                <AccordionTrigger>
                  {{ item.q }}
                </AccordionTrigger>
                <AccordionContent class="text-muted-foreground">
                  {{ item.a }}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  </div>
</template>
