import { AdminLayout } from "@/components/AdminLayout";
import { BookOpen, ChevronDown, Printer } from "lucide-react";
import { useState } from "react";

const sections = [
  { id: "sign-in", title: "How to sign in" },
  { id: "sidebar-map", title: "Admin sidebar map" },
  { id: "normal-day", title: "A normal day at Saiko" },
  { id: "counter-mode", title: "Counter mode in detail" },
  { id: "receipts", title: "Receipts" },
  { id: "settings", title: "Settings page" },
  { id: "products", title: "Products page" },
  { id: "promos", title: "Promos page" },
  { id: "dashboard", title: "Dashboard" },
  { id: "orders-page", title: "Orders page" },
  { id: "order-detail", title: "Order detail page" },
  { id: "daily-report", title: "Daily Report" },
  { id: "common-situations", title: "Common situations" },
  { id: "do-not-do", title: "Things to NOT do" },
  { id: "glossary", title: "Glossary" },
  { id: "when-broken", title: "When something is broken" },
  { id: "quick-card", title: "Quick reference card" },
];

export default function Help() {
  const [tocOpen, setTocOpen] = useState(false);

  return (
    <AdminLayout>
      <style>{`
        .manual-content h2 { font-family: 'Poppins', sans-serif; font-weight: 700; font-size: 1.5rem; line-height: 1.15; color: #0d0f13; margin-top: 2rem; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.02em; }
        .manual-content h2:first-child { margin-top: 0; }
        .manual-content h3 { font-family: 'Poppins', sans-serif; font-weight: 700; font-size: 1.125rem; color: #0d0f13; margin-top: 1.25rem; margin-bottom: 0.5rem; }
        .manual-content p { color: #0d0f13; margin: 0.5rem 0; line-height: 1.55; }
        .manual-content ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; color: #0d0f13; }
        .manual-content ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; color: #0d0f13; }
        .manual-content li { margin: 0.2rem 0; line-height: 1.5; }
        .manual-content code { background: #ebe9e6; color: #0d0f13; padding: 0.1em 0.35em; border-radius: 4px; font-size: 0.9em; font-family: 'Courier New', monospace; }
        .manual-content pre { background: #0d0f13; color: #f5f4f2; padding: 1rem; border-radius: 8px; overflow-x: auto; margin: 0.75rem 0; line-height: 1.45; font-family: 'Courier New', monospace; font-size: 0.8rem; }
        .manual-content table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; font-size: 0.9rem; }
        .manual-content thead { background: #ebe9e6; }
        .manual-content th { text-align: left; padding: 0.5rem 0.75rem; font-weight: 700; font-family: 'Poppins', sans-serif; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.75rem; color: #0d0f13; border-bottom: 1px solid #d8d2cb; }
        .manual-content td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #ebe9e6; vertical-align: top; color: #0d0f13; }
        .manual-content tr:last-child td { border-bottom: none; }
        .manual-content blockquote { border-left: 3px solid #c08643; padding: 0.25rem 0.75rem; color: #705d48; margin: 0.75rem 0; font-style: italic; }
        .manual-content strong { font-weight: 700; }
        .manual-content hr { border: none; border-top: 1px solid #d8d2cb; margin: 1.5rem 0; }
        .manual-content section { scroll-margin-top: 1rem; }
        @media print {
          body { background: white !important; }
          .print-hide { display: none !important; }
          .admin-print-scope > *:not(.manual-content-print) { display: none !important; }
          .manual-content-print { box-shadow: none !important; padding: 0 !important; margin: 0 !important; max-width: none !important; }
          .manual-content table, .manual-content pre, .manual-content section { page-break-inside: avoid; }
          .manual-content h2 { page-break-after: avoid; }
        }
      `}</style>

      <section className="admin-print-scope space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3 print-hide">
          <div>
            <h1 className="text-2xl font-bold text-[#0d0f13]">Admin Manual</h1>
            <p className="text-sm text-[#705d48]">Read once. Print the quick card. Keep this open the first week.</p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0d0f13] text-white rounded-lg text-sm font-bold uppercase tracking-wide hover:bg-black"
          >
            <Printer size={16} /> Print Manual
          </button>
        </header>

        <div className="md:hidden print-hide">
          <button
            type="button"
            onClick={() => setTocOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-white border border-[#d8d2cb] rounded-lg text-[#0d0f13] font-semibold"
          >
            <span className="inline-flex items-center gap-2"><BookOpen size={16} /> Table of contents</span>
            <ChevronDown size={16} className={tocOpen ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
          {tocOpen && (
            <nav className="mt-2 bg-white border border-[#d8d2cb] rounded-lg p-3">
              <ul className="space-y-1 text-sm">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} onClick={() => setTocOpen(false)} className="block px-2 py-1 rounded hover:bg-[#ebe9e6] text-[#0d0f13]">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="hidden md:block self-start sticky top-4 print-hide">
            <nav className="bg-white border border-[#d8d2cb] rounded-lg p-3">
              <h2 className="text-xs font-bold uppercase tracking-wide text-[#705d48] mb-2">Contents</h2>
              <ul className="space-y-0.5 text-sm">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="block px-2 py-1 rounded hover:bg-[#ebe9e6] text-[#0d0f13]">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <article className="bg-white border border-[#d8d2cb] rounded-lg p-6 md:p-8 manual-content manual-content-print max-w-3xl">
            <p>A simple guide for the Saiko team. Read this once and keep the page open near the counter for the first week.</p>

            <section id="sign-in">
              <h2>How to sign in</h2>
              <ol>
                <li>Open the website on a phone, tablet, or laptop.</li>
                <li>Go to the address bar and type your site address followed by <code>/admin/login</code>. Example: <code>saiko-web.vercel.app/admin/login</code>.</li>
                <li>Type the username (or email) and password.</li>
                <li>Tap <strong>Sign In</strong>.</li>
              </ol>
              <p>If you forget the password, ask whoever set up the system to reset it in Supabase.</p>
              <p><strong>Tip:</strong> Bookmark the login page on the counter tablet so staff can open it with one tap.</p>
            </section>

            <section id="sidebar-map">
              <h2>The admin menu</h2>
              <p>After signing in, you see a sidebar (or a top bar on small screens) with these sections.</p>
              <table>
                <thead><tr><th>Section</th><th>What it is for</th></tr></thead>
                <tbody>
                  <tr><td><strong>Dashboard</strong></td><td>The big picture: today's orders, sales, charts, and the AI report button.</td></tr>
                  <tr><td><strong>Orders</strong></td><td>List of all orders, online and walk-in. Filter by date, change status, export CSV.</td></tr>
                  <tr><td><strong>Counter</strong></td><td>Take walk-in orders, accept payment, print receipts.</td></tr>
                  <tr><td><strong>Products</strong></td><td>Mark items as Available, Sold Out, or Best Seller.</td></tr>
                  <tr><td><strong>Promos</strong></td><td>Create discount codes for customers.</td></tr>
                  <tr><td><strong>Settings</strong></td><td>Business info, TIN, VAT settings, OR receipt prefix.</td></tr>
                  <tr><td><strong>Daily Report</strong></td><td>End-of-day summary you can print or save as PDF.</td></tr>
                  <tr><td><strong>Help</strong></td><td>This manual.</td></tr>
                  <tr><td><strong>Sign Out</strong></td><td>Logs you out. Always sign out when leaving the tablet unattended.</td></tr>
                </tbody>
              </table>
            </section>

            <section id="normal-day">
              <h2>A normal day at Saiko</h2>
              <h3>1. Open the store</h3>
              <ul>
                <li>Sign in to the admin.</li>
                <li>Go to <strong>Dashboard</strong> to see if any pre-orders came in overnight.</li>
                <li>Go to <strong>Counter</strong> if you will take walk-ins from the start.</li>
              </ul>
              <h3>2. Customer comes in</h3>
              <ul>
                <li>Open <strong>Counter</strong>.</li>
                <li>Tap menu items to add them to the order on the right.</li>
                <li>Tap again or use <strong>+</strong> to add more of the same item.</li>
                <li>Type the customer's name (optional). Leave blank if they don't want to give it.</li>
                <li>Pick payment method: <strong>CASH</strong>, <strong>GCASH</strong>, or <strong>CARD</strong>.</li>
                <li>If cash, type how much they handed you. The system shows change due automatically.</li>
                <li>If senior or PWD, tick the box and type their ID and name.</li>
                <li>Tap <strong>Submit and Print</strong>. The receipt prints.</li>
              </ul>
              <h3>3. Customer orders online</h3>
              <ul>
                <li>The dashboard makes a sound when a new online order arrives.</li>
                <li>Click the notification or go to <strong>Orders</strong>.</li>
                <li>Open the order, tap <strong>Mark Preparing</strong> when you start cooking.</li>
                <li>Tap <strong>Mark Ready</strong> when packed. The customer gets a Messenger notification automatically.</li>
                <li>Tap <strong>Mark Completed</strong> when they pick it up.</li>
              </ul>
              <h3>4. Item runs out</h3>
              <ul>
                <li>Go to <strong>Products</strong>.</li>
                <li>Toggle <strong>Available</strong> off. Customers see "Sold Out" within seconds.</li>
                <li>Toggle on again when back in stock.</li>
              </ul>
              <h3>5. End of day</h3>
              <ul>
                <li>Go to <strong>Daily Report</strong>.</li>
                <li>Today's date is selected automatically.</li>
                <li>Compare the <strong>Cash</strong> total to the actual cash in the drawer.</li>
                <li>Tap <strong>Print</strong> to save as PDF for records, or <strong>Export CSV</strong> for the accountant.</li>
                <li>Sign out.</li>
              </ul>
            </section>

            <section id="counter-mode">
              <h2>Counter mode in detail</h2>
              <h3>Left side: the menu</h3>
              <ul>
                <li>Tap a category chip to filter (Ramen, Sushi, Drinks, etc.).</li>
                <li>Type in the search box to find a dish by name.</li>
                <li>Tap a dish card to add it.</li>
                <li>Tap again to add another (qty goes up).</li>
              </ul>
              <h3>Right side: the current order</h3>
              <ul>
                <li>Each line shows item, qty, and price.</li>
                <li>Use <strong>+</strong> and <strong>-</strong> to change qty.</li>
                <li>Trash icon removes a line.</li>
                <li>Customer Name, Phone, and Notes are optional.</li>
                <li>Senior Citizen / PWD checkbox: when ticked, two more fields appear (ID Number, Full Name). Gives 20% off the whole order and removes VAT. This is the law.</li>
                <li>Payment Method buttons: CASH / GCASH / CARD.</li>
                <li>For Cash, type the amount handed. Change is shown.</li>
                <li>For GCash or Card, the amount received equals the total automatically.</li>
                <li><strong>Submit and Print</strong> is disabled until the order has at least one item.</li>
                <li><strong>Cancel / Reset</strong> clears everything. Confirms first if the cart has items.</li>
              </ul>
            </section>

            <section id="receipts">
              <h2>Receipts</h2>
              <p>A printed receipt has these sections:</p>
              <pre>{`SAIKO RAMEN & SUSHI
TIN: <your TIN>
<your address>
Tel: <your contact>

PROVISIONAL RECEIPT       <- or "OFFICIAL RECEIPT" if BIR-accredited
OR No: SAIKO-OR-0001
Order: SAIKO-0010
Date: 2026-04-26 14:30
Customer: Walk-in / Juan Dela Cruz

Items list
2x Wagyu Teppan @ 504    1,008
3x Pork Gyoza @ 157        471

VAT-able sales / VAT (12%) / Total
or
Senior/PWD discount (20%) / VAT-Exempt Sales / Total

Payment / Change

Salamat at bumalik kayo!`}</pre>
              <h3>Important</h3>
              <ul>
                <li>It says <strong>PROVISIONAL RECEIPT</strong> by default. This means it is for tracking, not yet a legal BIR receipt.</li>
                <li>It says <strong>OFFICIAL RECEIPT</strong> only when Saiko has been approved by BIR (the owner or accountant marks this in Settings; do NOT do it yourself).</li>
                <li>The OR number goes up by 1 every time. Never restart it. The accountant uses this number for audits.</li>
              </ul>
            </section>

            <section id="settings">
              <h2>Settings page</h2>
              <p>You probably set this up once. Leave it alone unless something changes.</p>
              <table>
                <thead><tr><th>Field</th><th>What to type</th></tr></thead>
                <tbody>
                  <tr><td>Business Name</td><td>SAIKO RAMEN & SUSHI</td></tr>
                  <tr><td>TIN</td><td>Your business tax ID (format 123-456-789-000)</td></tr>
                  <tr><td>Address</td><td>Full address printed on receipts</td></tr>
                  <tr><td>Contact</td><td>Phone or email</td></tr>
                  <tr><td>VAT Registered</td><td>Tick if Saiko is a VAT-registered business</td></tr>
                  <tr><td>VAT Rate</td><td>Default 12.00 (Philippines standard)</td></tr>
                  <tr><td>OR Prefix</td><td>Default <code>SAIKO-OR</code>. Don't change after issuing receipts</td></tr>
                  <tr><td>OR Next Number</td><td>The next OR number that will be issued</td></tr>
                  <tr><td>Receipt Footer</td><td>Optional. Custom thank you or store note</td></tr>
                  <tr><td>BIR Accredited</td><td>Tick ONLY if Saiko has the BIR accreditation paper</td></tr>
                </tbody>
              </table>
              <p><strong>Warning:</strong> Changing OR Next Number while orders have been issued can break your audit trail. The accountant needs OR numbers to be in clean sequence.</p>
            </section>

            <section id="products">
              <h2>Products page</h2>
              <ul>
                <li>Lists every dish from the menu.</li>
                <li>Two toggles per item: <strong>Available</strong> and <strong>Best Seller</strong>.</li>
                <li><strong>Available off</strong>: item shows up on the public menu as "Sold Out" with grey image.</li>
                <li><strong>Best Seller on</strong>: item gets a "Best Seller" badge on the public menu.</li>
                <li>Top 3 sellers in the date range are shown at the top.</li>
                <li>Pick a date range to see how each item is selling.</li>
              </ul>
              <p>Customers see the change within seconds. No refresh needed.</p>
            </section>

            <section id="promos">
              <h2>Promos page</h2>
              <p>Promo codes give customers a discount when they type the code at checkout (online only).</p>
              <h3>Creating a promo</h3>
              <ul>
                <li><strong>Code:</strong> short, ALL CAPS. Example: <code>WELCOME10</code> or <code>BIRTHDAY50</code>.</li>
                <li><strong>Description:</strong> optional. Helpful for staff.</li>
                <li><strong>Discount Type:</strong> Percent or Fixed peso amount.</li>
                <li><strong>Discount Value:</strong> 10 means 10% (if percent) or 10 pesos (if fixed).</li>
                <li><strong>Min Order Amount:</strong> optional minimum spend.</li>
                <li><strong>Max Discount:</strong> optional cap for percent promos.</li>
                <li><strong>Valid From / Valid Until:</strong> optional active window.</li>
                <li><strong>Usage Limit:</strong> optional total uses across all customers.</li>
                <li><strong>Active:</strong> untick to disable temporarily without deleting.</li>
              </ul>
              <h3>Editing or deleting</h3>
              <ul>
                <li>Edit: all fields except the code itself.</li>
                <li>Delete: only when never used. Otherwise deactivate.</li>
              </ul>
            </section>

            <section id="dashboard">
              <h2>Dashboard</h2>
              <h3>KPI cards</h3>
              <ul>
                <li><strong>Orders</strong>: total in the date range.</li>
                <li><strong>Gross Sales</strong>: total peso amount before discounts.</li>
                <li><strong>Completed Sales</strong>: only orders marked completed.</li>
                <li><strong>Avg Order Value</strong>: average ticket size.</li>
              </ul>
              <h3>Charts</h3>
              <ul>
                <li>Revenue per day (bar).</li>
                <li>Orders by status (donut).</li>
              </ul>
              <h3>AI Report button</h3>
              <p>Asks the AI for a written summary covering sales, best dishes, weak items, peak hours and days, promo effectiveness, and three concrete recommendations. The report appears below the charts. You can print or save as PDF.</p>
            </section>

            <section id="orders-page">
              <h2>Orders page</h2>
              <p>The full list of orders, online and walk-in.</p>
              <h3>Filters</h3>
              <ul>
                <li>Date chips: Today, Yesterday, Last 7 Days, This Month, Custom.</li>
                <li>Status chips: All, Pending, Preparing, Ready, Completed, Cancelled.</li>
              </ul>
              <h3>Per-row info</h3>
              <table>
                <thead><tr><th>Column</th><th>Meaning</th></tr></thead>
                <tbody>
                  <tr><td>Order #</td><td>Auto-generated, e.g., SAIKO-0042.</td></tr>
                  <tr><td>Customer</td><td>Name or "Walk-in".</td></tr>
                  <tr><td>Phone</td><td>Customer phone (or "walk-in").</td></tr>
                  <tr><td>Pickup</td><td>When the customer wants to pick up.</td></tr>
                  <tr><td>Total</td><td>Final amount after discounts.</td></tr>
                  <tr><td>Status</td><td>Where in the kitchen flow it is.</td></tr>
                  <tr><td>Created</td><td>Date and time the order was placed.</td></tr>
                </tbody>
              </table>
              <p><strong>Export CSV</strong> downloads the visible filtered orders as a CSV.</p>
            </section>

            <section id="order-detail">
              <h2>Order detail page</h2>
              <p>Click any order to see all the info: customer, items, total, status timeline, payment, and notes.</p>
              <h3>Status flow</h3>
              <p><code>pending -&gt; preparing -&gt; ready -&gt; completed</code>. Cancelled is also possible at any point.</p>
              <ul>
                <li><strong>Mark Preparing</strong>: kitchen has the order.</li>
                <li><strong>Mark Ready</strong>: food packed; customer can pick up. Customer gets a Messenger notification automatically.</li>
                <li><strong>Mark Completed</strong>: customer picked up.</li>
                <li><strong>Cancel</strong>: customer didn't show, payment problem, or other reason. Use sparingly.</li>
              </ul>
              <p><strong>Print Pickup Slip</strong> opens a printer-friendly page with just the order info. Use this for the kitchen ticket.</p>
            </section>

            <section id="daily-report">
              <h2>Daily Report (Z-reading)</h2>
              <p>End of every shift. The daily report aggregates everything for the chosen date.</p>
              <h3>Shows</h3>
              <ul>
                <li>Sales totals: gross, discounts (promo and senior/PWD), net.</li>
                <li>VAT breakdown (only if VAT-registered).</li>
                <li>Payment method breakdown: Cash, GCash, Card, Online.</li>
                <li>Order count: completed plus a separate cancelled count.</li>
                <li>Top 10 items.</li>
                <li>OR range: first OR number issued, last one, total count.</li>
                <li>Cashier and Manager signature lines for paper sign-off.</li>
              </ul>
              <h3>Channel filter</h3>
              <ul>
                <li><strong>Counter only</strong> (default): walk-ins.</li>
                <li><strong>Both</strong>: walk-in and online combined.</li>
                <li><strong>Web only</strong>: just online.</li>
              </ul>
              <p><strong>Print</strong> chooses A4 or thermal 80mm. <strong>Export CSV</strong> emails to the accountant.</p>
            </section>

            <section id="common-situations">
              <h2>Common situations</h2>
              <h3>Mistake on a counter order</h3>
              <p>The system has no void or refund flow yet. Tell the customer, give cash back, write the order number on the receipt as cancelled with your initials, and tell the manager to update daily totals manually.</p>
              <h3>Wi-Fi is down</h3>
              <p>Take a paper note, get the customer paid, and enter it later when Wi-Fi is back. The admin needs internet to save orders.</p>
              <h3>Receipt printer jammed</h3>
              <p>Submit anyway. The order is saved. Use <strong>Print Again</strong> on the success message after the jam is cleared. Or open the order from <strong>Orders</strong> and use Print Pickup Slip.</p>
              <h3>Customer asks for a copy of their receipt later</h3>
              <p>Open <strong>Orders</strong>, find the order by name or phone. Open detail. Tap <strong>Print Pickup Slip</strong>. Or send the tracking link.</p>
              <h3>Order stuck in Preparing</h3>
              <p>Open the order, tap <strong>Mark Ready</strong> when done. The customer gets the notification.</p>
              <h3>Cash drawer doesn't match</h3>
              <p>Print today's <strong>Daily Report</strong>. The Cash total should equal the drawer minus the starting float. If short, look for orders marked Cash that should have been GCash, missing receipts, or unrecorded orders. Note discrepancies before closing.</p>
              <h3>Customer wants to use a promo at the counter</h3>
              <p>The counter does NOT support promo codes yet. Only online checkout does. Use the senior/PWD field if applicable. For other promos, honor manually with manager approval.</p>
            </section>

            <section id="do-not-do">
              <h2>Things to NOT do</h2>
              <ul>
                <li><strong>Don't</strong> mark <strong>BIR Accredited</strong> in Settings unless Saiko has the certificate. The flag only changes the receipt header text.</li>
                <li><strong>Don't</strong> change <strong>OR Next Number</strong> in Settings without the accountant's approval.</li>
                <li><strong>Don't</strong> delete a promo that has been used. Deactivate it.</li>
                <li><strong>Don't</strong> edit orders directly in the database. Use the order detail page.</li>
                <li><strong>Don't</strong> share the admin password.</li>
                <li><strong>Don't</strong> use the customer self-tracking link to take action. It is read-only.</li>
                <li><strong>Don't</strong> sign out and back in repeatedly during a shift.</li>
              </ul>
            </section>

            <section id="glossary">
              <h2>Glossary</h2>
              <table>
                <thead><tr><th>Term</th><th>Meaning</th></tr></thead>
                <tbody>
                  <tr><td><strong>OR Number</strong></td><td>Official Receipt number. Sequential, never repeats. BIR audits use this.</td></tr>
                  <tr><td><strong>TIN</strong></td><td>Tax Identification Number. The business's tax ID.</td></tr>
                  <tr><td><strong>VAT</strong></td><td>Value-Added Tax. 12% in the Philippines.</td></tr>
                  <tr><td><strong>Senior/PWD discount</strong></td><td>20% off plus no VAT on the whole order. Required by law.</td></tr>
                  <tr><td><strong>Provisional Receipt</strong></td><td>Receipt for tracking. Not yet a legal BIR receipt.</td></tr>
                  <tr><td><strong>Z-reading</strong></td><td>End-of-day cumulative sales report.</td></tr>
                  <tr><td><strong>Tracking link</strong></td><td>Unique link customers use to check their order status.</td></tr>
                  <tr><td><strong>Channel</strong></td><td><code>web</code> = online, <code>counter</code> = walk-in.</td></tr>
                  <tr><td><strong>Pickup time</strong></td><td>When the customer wants to collect their food.</td></tr>
                </tbody>
              </table>
            </section>

            <section id="when-broken">
              <h2>When something is broken</h2>
              <ol>
                <li>Refresh the page (Cmd+R, Ctrl+R, or pull down on tablet).</li>
                <li>Sign out and sign back in.</li>
                <li>Check internet connection.</li>
                <li>Try a different device.</li>
                <li>If still broken, message the developer with: page name, action you took, screenshot of any error, time it happened.</li>
              </ol>
              <p>The system logs every order and every status change. Even if the screen looks broken, your data is safe.</p>
            </section>

            <section id="quick-card">
              <h2>Quick reference card</h2>
              <p>Print this and pin near the counter.</p>
              <pre>{`SIGN IN: <site>/admin/login
COUNTER: <site>/admin/counter

NEW WALK-IN:
  1. Tap items on left
  2. Confirm qty on right
  3. Pick CASH / GCASH / CARD
  4. If cash, type amount received
  5. Senior/PWD? Tick + ID + Name
  6. Submit and Print

WHEN ORDER IS READY (online):
  1. Open Orders
  2. Click the order
  3. Mark Ready (auto-pings customer)

WHEN CUSTOMER PICKS UP:
  Mark Completed

ITEM RUNS OUT:
  Products -> Available off

CLOSE SHIFT:
  Daily Report -> Print -> Sign out`}</pre>
            </section>
          </article>
        </div>
      </section>
    </AdminLayout>
  );
}
