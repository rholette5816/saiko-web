# Saiko Admin Manual

A simple guide for the Saiko team. Read this once and keep the page open near the counter for the first week.

---

## What is the admin side?

The admin side is the staff-only part of the website. Customers never see it. You go there to:

- Take walk-in orders at the counter
- See and manage online orders
- Update what's available on the menu
- Create promo codes
- Print receipts and reports
- See how the day is going (sales, popular items)

You sign in with a username (or email) and password. Only people you trust should know the password.

---

## How to sign in

1. Open the website on a phone, tablet, or laptop
2. Go to the address bar and type your site address followed by `/admin/login`
   - Example: `saiko-web.vercel.app/admin/login`
3. Type the username (or email) and password
4. Tap **Sign In**

If you forget the password, ask whoever set up the system to reset it in Supabase.

**Tip:** Bookmark the login page on the counter tablet so staff can open it with one tap.

---

## The admin menu (sidebar)

After signing in, you see a sidebar (or a top bar on small screens) with these sections. Each one has its own page.

| Section | What it's for |
|---|---|
| **Dashboard** | The big picture: today's orders, sales, charts, and the AI report button |
| **Orders** | List of all orders, online and walk-in. Filter by date, change status, export CSV |
| **Counter** | Take walk-in orders, accept payment, print receipts |
| **Products** | Mark items as Available, Sold Out, or Best Seller |
| **Promos** | Create discount codes for customers |
| **Settings** | Business info, TIN, VAT settings, OR receipt prefix |
| **Daily Report** | End-of-day summary you can print or save as PDF |
| **Sign Out** | Logs you out. Always sign out when leaving the tablet unattended |

---

## A normal day at Saiko (step by step)

### 1. Open the store

- Sign in to the admin
- Go to **Dashboard** to see if any pre-orders came in overnight
- Go to **Counter** if you'll take walk-ins from the start

### 2. Customer comes in

- Open **Counter**
- Tap menu items to add them to the order on the right
- If they want to add more of the same item, tap it again or use the **+** button on the right
- Type the customer's name (optional). Leave blank if they don't want to give it.
- Pick payment method: **CASH**, **GCASH**, or **CARD**
- If cash, type how much they handed you. The system shows change due automatically.
- If senior or PWD, tick the box and type their ID and name (this is required by law).
- Tap **Submit & Print**. The receipt prints.
- A green message says "Order #SAIKO-XXXX completed". You can print again from there if needed.

### 3. Customer orders online

- The dashboard makes a sound and shows a notification when a new online order arrives
- Click the notification or go to **Orders**
- Find the order, tap it to open
- Tap **Mark Preparing** when you start cooking
- Tap **Mark Ready** when it's ready for pickup. The customer gets a Messenger notification automatically.
- Tap **Mark Completed** when they pick it up

### 4. Item runs out

- Go to **Products**
- Find the item
- Toggle **Available** off
- Customers will see "Sold Out" on the menu within seconds
- When it's back in stock, toggle **Available** on again

### 5. End of day

- Go to **Daily Report**
- Today's date is selected automatically
- See: total sales, VAT, payment breakdown (Cash / GCash / Card)
- Compare the **Cash** total to the actual cash in the drawer
- Tap **Print** to save as PDF for the records, or **Export CSV** to email to the accountant
- Sign out

---

## Counter mode in detail

The counter page has two halves:

**Left side: the menu**
- Tap a category chip at the top to filter (Ramen, Sushi, Drinks, etc.)
- Type in the search box to find a dish by name
- Tap a dish card to add it to the current order
- Tap again to add another one (qty goes up)

**Right side: the current order**
- See each item with its qty and price
- Use the **+** and **-** buttons to change qty
- Use the **trash icon** to remove a line entirely
- Customer Name field (optional, leave blank for walk-in)
- Customer Phone field (optional)
- Notes field for things like "no spicy" or "extra sauce"
- Senior Citizen / PWD checkbox
  - When checked, two more fields appear: ID Number and Full Name
  - The system gives 20% off and removes VAT on the whole order. This is the law.
- Payment Method buttons: CASH / GCASH / CARD
- For Cash, type the amount the customer handed you. Change is shown.
- For GCash or Card, the amount received equals the total automatically.
- **Submit & Print** button at the bottom. Disabled until the order has at least one item.
- **Cancel / Reset** clears everything if you want to start over.

After submitting, the receipt prints. The page is ready for the next customer.

---

## Receipts: what gets printed

The receipt has these sections:

```
SAIKO RAMEN & SUSHI
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

Salamat at bumalik kayo!
```

### Important about the receipt

- It says **PROVISIONAL RECEIPT** by default. This means it's for tracking, not yet a legal BIR receipt.
- It says **OFFICIAL RECEIPT** only when Saiko has been approved by BIR (your owner or accountant marks this in Settings, do NOT do it yourself).
- The OR number goes up by 1 every time. Never restart it. The accountant uses this number for audits.

---

## Settings page

You probably set this up once. After that, leave it alone unless something changes.

| Field | What to type |
|---|---|
| Business Name | SAIKO RAMEN & SUSHI |
| TIN | Your business tax ID (format: 123-456-789-000) |
| Address | Full address printed on receipts |
| Contact | Phone or email |
| VAT Registered | Tick if Saiko is a VAT-registered business |
| VAT Rate | Default 12.00 (Philippines standard) |
| OR Prefix | Default `SAIKO-OR`. Don't change after you start issuing receipts |
| OR Next Number | The next OR number that will be issued. Change with great care |
| Receipt Footer | Optional. Custom thank you message or store note |
| BIR Accredited | Tick ONLY if Saiko has the BIR accreditation paper. Otherwise leave unticked |

**Warning:** Changing OR Next Number while orders have been issued can break your audit trail. The accountant needs OR numbers to be in clean sequence. Only change this with their permission.

---

## Products page

- Lists every dish from the menu
- Two toggles per item: **Available** and **Best Seller**
- **Available off** = item shows up on the public menu as "Sold Out" with grey image
- **Best Seller on** = item gets a "Best Seller" badge on the public menu
- Top 3 sellers in the date range are shown at the top
- Pick a date range to see how each item is selling

When to use this:
- Run out of an ingredient? Toggle Available off.
- Got a hit dish? Toggle Best Seller on.
- New dish becomes a regular favorite? Toggle Best Seller on.

You don't need to refresh the public menu. Customers see the change within seconds.

---

## Promos page

Promo codes give customers a discount when they type the code at checkout (online only for now, not at the counter).

### Creating a promo

- Tap **+ New Promo Code**
- **Code:** SHORT, ALL CAPS. Example: `WELCOME10` or `BIRTHDAY50`
- **Description:** Optional, but helpful for staff (e.g., "10% off for first-time customers")
- **Discount Type:** Percent or Fixed peso amount
- **Discount Value:** The number. 10 means 10% (if percent) or 10 pesos (if fixed)
- **Min Order Amount:** Optional. Customer must spend at least this much for the promo to apply
- **Max Discount:** Optional. Caps a percent promo at a peso amount (so 50% off doesn't become 5000 pesos)
- **Valid From / Valid Until:** Optional. The window the promo can be used
- **Usage Limit:** Optional. Total times the promo can be used by anyone (not per customer)
- **Active:** Untick to disable temporarily without deleting

Tap **Save**. The code is now usable.

### When customers use a promo

- They type the code at checkout
- The system validates: still active? not expired? met the minimum? not exceeded usage limit?
- If yes, the discount is applied and shown on the order summary
- The order is recorded with the promo code so you can audit later

### Editing or deleting a promo

- **Edit:** all fields can change except the code itself (code is the unique ID)
- **Delete:** only allowed if the promo has never been used. Once used, deactivate instead (untick Active).

---

## Dashboard explained

The dashboard is for getting the daily picture at a glance.

### Top: KPI cards

- **Orders** — total orders in the date range
- **Gross Sales** — total peso amount before discounts
- **Completed Sales** — only orders marked "completed" (paid + delivered)
- **Avg Order Value** — average ticket size

### Charts

- **Revenue per day** — bar chart, peso amount per day
- **Orders by status** — donut: pending, preparing, ready, completed, cancelled

### Recent orders

The 5 most recent orders in the selected date range. Click any to open its detail page.

### Generate AI Report button

Tap this to ask the AI for a written summary of the date range. It analyzes:
- Sales performance
- Best-selling dishes
- Underperformers
- Peak ordering hours and days
- Promo effectiveness (if any)
- Three concrete recommendations

The report appears below the charts. You can print it (or save as PDF) for owner meetings.

---

## Orders page

The full list of orders, online and walk-in.

### Filters at the top

- Date range chips: Today, Yesterday, Last 7 Days, This Month, Custom
- Status chips: All, Pending, Preparing, Ready, Completed, Cancelled

### Per-row info

| Column | Meaning |
|---|---|
| Order # | Auto-generated, e.g., SAIKO-0042 |
| Customer | Name or "Walk-in" |
| Phone | Customer phone (or "walk-in") |
| Pickup | When the customer wants to pick up |
| Total | Final amount (after discounts) |
| Status | Where in the kitchen flow it is |
| Created | Date and time the order was placed |

### Export CSV

Top right of the list. Downloads the visible filtered orders as a CSV you can open in Excel.

---

## Order detail page

Click any order to see all the info: customer, items, total, status timeline, payment, and notes.

### Status buttons

The status flow goes:

`pending -> preparing -> ready -> completed`

You can also `cancelled` at any point.

- **Mark Preparing:** kitchen has the order
- **Mark Ready:** food is packed, customer can pick up. The customer gets a Messenger notification automatically (if they came from Messenger or have a tracking link).
- **Mark Completed:** customer picked up
- **Cancel:** customer didn't show, payment problem, or any reason. Use sparingly.

### Print Pickup Slip

Tap to open a printer-friendly page with just the order info. Use this for the kitchen ticket.

### Messenger link status

- If the customer came from Messenger, you'll see "Messenger link: Linked"
- "Ready alert sent: <time>" appears after you marked Ready and the notification went out

---

## Daily Report (Z-reading)

End of every shift, go here. The daily report aggregates everything for the chosen date.

### What it shows

- **Sales totals:** gross sales, discounts (promos and senior/PWD), net sales
- **VAT breakdown** (only if VAT-registered): VAT-able sales, VAT collected, VAT-exempt sales
- **Payment method breakdown:** Cash, GCash, Card, Online (each with count and total)
- **Order count:** total completed plus a separate cancelled count if any
- **Item summary:** top 10 items sold today
- **OR range:** first OR number issued today, last one, total count
- **Cashier signature** and **Manager signature** lines for paper sign-off

### Channel filter

- **Counter only** (default): just walk-in orders
- **Both:** walk-in and online combined
- **Web only:** just online orders

### Print

Tap **Print**. Choose A4 or thermal 80mm at the top.

### Export

Tap **Export CSV**. Email it to the accountant.

---

## Common situations

### "I made a mistake on a counter order"

- Don't reprint or alter the receipt for now. The system doesn't have a void/refund flow yet.
- Tell the customer, give cash back, and write the order number on the receipt as cancelled with your initials.
- Tell the manager so they can update the daily totals manually.

### "The Wi-Fi is down at the store"

- The admin needs internet to save orders. Without it, you can't issue an order.
- Take a paper note of the order, get the customer paid, and enter it later when Wi-Fi is back.

### "The receipt printer is jammed"

- Submit the order anyway. The order is saved.
- Use the **Print Again** button on the success message after submit.
- Or open the order from **Orders** and use the print pickup slip.

### "Customer asks for a copy of their receipt later"

- Open **Orders**, find their order by name, phone, or order number
- Open the order detail
- Tap **Print Pickup Slip** (it serves as a duplicate receipt)
- Or send them the tracking link if they want to see status online

### "An order is stuck in Preparing"

- Open the order detail
- Tap **Mark Ready** when it's done
- The customer gets the notification

### "I see two orders with the same time"

- Online and walk-in orders go through the same list. Counter orders are flagged with `channel: counter`. The order number is unique either way.

### "The cash drawer doesn't match the report"

- Print the **Daily Report** for today
- The Cash total should equal what's in the drawer minus the starting float
- If short, check for: orders marked Cash that should have been GCash, missing receipts, or unrecorded orders
- Note any discrepancy before closing the shift

### "Customer wants to use a promo at the counter"

- The counter does NOT support promo codes yet. Only online checkout uses promos.
- For walk-ins, give a manual discount via the senior/PWD field (if applicable) or honor the promo by typing a custom price (not yet supported either, future feature).

---

## Things to NOT do

- **Don't** mark **BIR Accredited** in Settings unless Saiko actually has a BIR accreditation certificate. The flag only changes the receipt header text. It doesn't make Saiko legally compliant.
- **Don't** change the **OR Next Number** in Settings without the accountant's approval. The audit trail depends on clean sequencing.
- **Don't** delete a promo that has been used. Deactivate it instead by unticking Active.
- **Don't** delete or edit orders directly in the database. Use the order detail page status buttons.
- **Don't** share the admin password. Each device that needs access can stay signed in, or sign in fresh each shift.
- **Don't** use the customer self-tracking link (`/track/...`) to take action. It's read-only for the customer.
- **Don't** sign out and back in repeatedly during a shift. Stay signed in. Sign out only at end of shift.

---

## Glossary (in plain Filipino-friendly terms)

| Term | What it means |
|---|---|
| **OR Number** | Official Receipt number. Sequential, never repeats. BIR audits use this. |
| **TIN** | Tax Identification Number. The business's tax ID. |
| **VAT** | Value-Added Tax. 12% in the Philippines. Saiko collects it from the customer if VAT-registered. |
| **Senior/PWD discount** | 20% off + no VAT on the whole order. Required by law for senior citizens and persons with disabilities with valid ID. |
| **Provisional Receipt** | A receipt for tracking. Not yet a legal BIR receipt. |
| **Z-reading** | End-of-day cumulative sales report. Used by the accountant. |
| **Tracking link** | A unique link customers use to check their order status. Format: `/track/<long random string>` |
| **Channel** | Where the order came from. `web` = online, `counter` = walk-in. |
| **Pickup time** | When the customer wants to collect their food. Walk-ins are "Walk-in (now)". |

---

## When something is broken

If the admin page itself is broken or missing data:

1. Refresh the page (Cmd+R or Ctrl+R or pull down on tablet)
2. Sign out and sign back in
3. Check internet connection
4. Try a different device
5. If still broken, message the developer with:
   - What page you're on
   - What you tapped
   - Screenshot of any error message
   - Time it happened

The system logs every order and every status change. Even if the screen looks broken, your data is safe.

---

## Quick reference card (print this for the counter)

```
SIGN IN: <site>/admin/login
COUNTER: <site>/admin/counter

NEW WALK-IN:
  1. Tap items on left
  2. Confirm qty on right
  3. Pick CASH / GCASH / CARD
  4. If cash, type amount received
  5. Senior/PWD? Tick + ID + Name
  6. Submit & Print

WHEN ORDER IS READY (online):
  1. Open Orders
  2. Click the order
  3. Mark Ready (auto-pings customer)

WHEN CUSTOMER PICKS UP:
  Mark Completed

ITEM RUNS OUT:
  Products -> Available off

CLOSE SHIFT:
  Daily Report -> Print -> Sign out
```

---

That's the whole admin side. Spend a quiet afternoon clicking through each section while no customers are around. After the third real shift, this will all feel normal.

Salamat at sabihin sa amin kung may nakalimutan o nakakalito ditto.
