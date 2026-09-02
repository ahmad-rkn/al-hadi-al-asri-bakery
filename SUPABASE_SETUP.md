# Supabase + Admin Panel — Setup Guide

This adds a database and a private admin panel (`/admin`) to your website, so
you (or the bakery owner) can add/edit/delete products, mark things Sold Out,
and manage the homepage Special Offer — all without touching code.

**Orders still work exactly as before: Website → Cart → WhatsApp.** There is
no orders database, and nothing about the customer-facing checkout changed.

If you never set any of this up, the website keeps working exactly as it
always has, using the built-in menu in `js/config.js`. Supabase is entirely
optional — the site only tries to use it if it's configured.

---

## 0. What you're setting up, in one sentence

A Supabase project (free tier is plenty) holds your `products` and
`special_offers` tables; the public website reads from it; the private
`/admin` page (protected by a login) is the only thing allowed to write to
it — enforced by the database itself (Row Level Security), not just by the
admin page's login screen.

---

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → sign in → **New project**.
2. Pick any name/region, set a database password (save it somewhere), and
   create the project. Wait ~2 minutes for it to finish provisioning.

---

## 2. Run the SQL

1. In your Supabase project, open **SQL Editor** (left sidebar) → **New query**.
2. Open `supabase/schema.sql` from this project, copy the **entire file**,
   paste it into the SQL Editor, and click **Run**.

**What to expect:** it should finish with "Success. No rows returned" (the
`insert` statements at the bottom do add rows, but the editor still just
reports success). If you check **Table Editor**, you should now see:
- a `products` table with the 15 menu items from your current site pre-loaded
- a `special_offers` table with your current "1 Lotus Crepe + 1 Kinder
  Crepe + 18 Pancakes — $10" offer, already marked active

If you'd rather start with an empty menu and add everything by hand from the
admin panel instead, delete the two `insert into ...` blocks at the bottom of
the file before running it — everything else works the same either way.

> I wrote and carefully checked this SQL against standard, well-documented
> Supabase/Postgres patterns, but I don't have the ability to run it against
> a live Supabase project from where I'm working. If any single statement
> errors, copy the exact error back to me and I'll fix that line — the
> statements are independent enough that this is very unlikely to require
> starting over.

---

## 3. Create the image storage bucket (manual — can't be done from SQL)

1. In Supabase: **Storage** (left sidebar) → **New bucket**.
2. Name it **exactly** `product-images` (the code refers to this exact name).
3. Toggle **Public bucket** ON. Create it.

That's it — the SQL you already ran added the upload/edit/delete permission
policies for this bucket (only logged-in admins can write to it; anyone can
view the images, same as any product photo on a normal website).

---

## 4. Turn off public sign-ups (important)

By default Supabase lets anyone sign up for an account. You don't want
random visitors creating accounts that could log into `/admin`.

1. **Authentication** → **Providers** → **Email**.
2. Turn **OFF** "Allow new users to sign up".

Only accounts you create by hand (next step) will ever be able to log in.

---

## 5. Create the first (and only) admin account

1. **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter the bakery owner's email and a password. You can leave "Auto
   Confirm User" checked so it's ready to use immediately.
3. That's the login for `/admin` — no separate "admin table" or role needed
   for a single-owner bakery like this.

Want a second admin later (e.g. a manager)? Repeat this step — every user
you create this way can log into `/admin` with full access.

---

## 6. Get your API keys

**Project Settings** (gear icon) → **API**. You need two values:

- **Project URL** — looks like `https://xxxxxxxxxxxx.supabase.co`
- **anon / public key** — a long string starting with `eyJ...`

Do **not** copy the `service_role` key anywhere in this project — it must
never be used in a browser. Everything here uses only the public anon key,
which is safe to expose (your data is protected by the RLS policies from
step 2, not by hiding this key).

---

## 7. Set the Netlify environment variables

In Netlify: your site → **Site configuration** → **Environment variables** →
**Add a variable**, and add both:

| Key | Value |
|---|---|
| `SUPABASE_URL` | your Project URL from step 6 |
| `SUPABASE_ANON_KEY` | your anon/public key from step 6 |

Then **trigger a new deploy** (Deploys → Trigger deploy → Deploy site).

**Why a deploy is needed:** this site has no build tool, so `netlify.toml`
runs a tiny script (`build.js`) at deploy time that writes those two values
into `js/supabase-config.js`. That's what lets the live site (and `/admin`)
actually connect — until you redeploy after adding the variables, the site
keeps running on the built-in menu, harmlessly.

---

## 8. Where the admin panel lives

Once deployed: **`https://your-site.netlify.app/admin/`**

Log in with the email/password you created in step 5. The page is set to
`noindex` and not linked from anywhere on the public site, but it is not
"secret" — the login screen (backed by Supabase Auth + RLS) is what actually
protects it, exactly as intended.

---

## 9. Testing checklist

**Local, before you even touch Supabase:**
- [ ] Open `index.html` directly — site should look and work exactly as before.

**After steps 1–7 are done and the site has redeployed:**
- [ ] Visit `/admin/`, confirm you see a login screen (not the dashboard).
- [ ] Try logging in with a wrong password → see an error, stay on login.
- [ ] Log in with your real admin account → you land on the Dashboard.
- [ ] **Products:** add a new product, confirm it appears in the list.
- [ ] Edit that product's price/description, confirm the change sticks after
      refreshing `/admin/`.
- [ ] Toggle it to 🔴 **Sold Out**, then open the public site (in a new tab)
      and refresh — the product should show a "Sold Out" badge and be
      impossible to add to the cart, but still viewable.
- [ ] Toggle it back to 🟢 **Available** — refresh the public site again,
      confirm it can be added to the cart normally.
- [ ] Delete the test product — confirm it disappears from both `/admin/`
      and the public menu.
- [ ] Upload a photo on a product — confirm it appears both in `/admin/`
      and on the public product card/modal.
- [ ] **Special Offer:** edit the offer text/price, refresh the homepage,
      confirm the poster updated.
- [ ] Toggle the offer to Inactive — confirm the poster section disappears
      from the homepage entirely. Toggle it back on — confirm it returns.
- [ ] Log out of `/admin/`, confirm you're returned to the login screen and
      can't see any admin content without logging back in.
- [ ] Open `/admin/` in an incognito window without logging in — confirm you
      only ever see the login screen.
- [ ] Place a normal test order on the public site through checkout →
      WhatsApp, exactly as before, to confirm nothing about ordering changed.
- [ ] Check `/admin/` on your phone — sidebar should collapse into a "☰ Menu"
      button.

---

## 10. Everyday use — no redeploys needed

Once this is set up, adding a product, changing a price, or marking
something Sold Out from `/admin/` shows up on the live website immediately
(customers just need to refresh the page) — you never need to touch Netlify,
environment variables, or redeploy again for day-to-day menu changes. You'd
only revisit this guide if you rotate your Supabase keys or move to a new
Supabase project.

---

## Files this added/changed

| File | Purpose |
|---|---|
| `supabase/schema.sql` | Run once in Supabase SQL Editor (step 2) |
| `js/supabase-config.js` | Auto-generated at deploy time — don't edit by hand |
| `js/supabase-data.js` | Loads live menu/offer into the public site |
| `build.js` / `netlify.toml` | Injects your env vars at deploy time |
| `admin/index.html`, `admin/admin.css`, `admin/admin.js` | The admin panel |
| `js/config.js`, `js/app.js` | Unchanged in spirit — `config.js` is still the
  offline fallback menu; `app.js` gained the Sold Out UI and one small hook
  (`window.__bakeryRerender`) so `supabase-data.js` can redraw the page. |
