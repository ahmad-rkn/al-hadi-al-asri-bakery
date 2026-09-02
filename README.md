# Al Hadi Al Asri Bakery — Website

A complete, mobile-friendly bakery website. Customers can browse the menu,
build an order, and send it straight to your WhatsApp with one tap.

No programming knowledge is needed to run or update this site.

**Want an admin panel** so you can add/edit products and mark items Sold Out
from a web page instead of editing code? See **`SUPABASE_SETUP.md`** — it's
optional and the site works fine without it.

---

## 1. What's in this folder

```
index.html          → the whole website (structure/content)
css/style.css        → all colors, fonts, spacing (visual design)
js/config.js          → ⭐ EDIT THIS — your bakery info & menu items
js/app.js             → the site's logic (cart, WhatsApp message, etc.)
images/               → put your real product photos here
admin/                → optional admin panel (see SUPABASE_SETUP.md)
supabase/schema.sql    → optional database setup (see SUPABASE_SETUP.md)
```

You will almost always only need to touch **`js/config.js`**.

---

## 2. Where to put your bakery information

Open `js/config.js` in any text editor (even Notepad or TextEdit works,
though a free tool like [VS Code](https://code.visualstudio.com/) is nicer).

At the top you'll find:

```js
const BAKERY_INFO = {
  BAKERY_WHATSAPP_NUMBER: "REPLACE_ME",
  BAKERY_PHONE: "REPLACE_ME",
  BAKERY_ADDRESS: "REPLACE_ME",
  BAKERY_INSTAGRAM: "REPLACE_ME",
  GOOGLE_MAPS_URL: "REPLACE_ME",
  OPENING_HOURS: "REPLACE_ME",
};
```

Replace every `"REPLACE_ME"` with your real details.

### ⭐ The WhatsApp number (most important step)

```js
BAKERY_WHATSAPP_NUMBER: "REPLACE_ME",
```

Change this to your bakery's WhatsApp number in **full international
format, digits only** — no `+`, no spaces, no dashes.

Example, if your Lebanese number is `03 123 456`:
```js
BAKERY_WHATSAPP_NUMBER: "9613123456",
```

Until this is filled in, the site will politely tell customers that
online ordering isn't set up yet instead of sending a broken order —
it will never let a broken WhatsApp order go through.

---

## 3. Editing the menu

Still in `js/config.js`, scroll down to the `PRODUCTS` list. Each product
looks like this:

```js
{
  id: "donut-kinder",
  name: "Kinder Donut",
  category: "donuts",
  price: 2.75,
  description: "Fluffy donut topped and filled with Kinder chocolate.",
  image: "",
  icon: "🍩",
},
```

- **Change the price** — just edit the number, e.g. `price: 3.25,`
- **Add a new product** — copy an existing block, paste it, and change
  `id` (must be unique), `name`, `category`, `price`, and `description`.
  `category` must be one of: `croissants`, `donuts`, `crepes`, `pancakes`, `buns`.
- **Remove a product** — delete its whole `{ ... },` block.

That's it — the menu, the popular-products section, and the order form
all update automatically.

---

## 4. Adding real photos

Every product currently shows a simple emoji placeholder instead of a
photo, so the site looks good even before you have professional photos.

To add a real photo for a product:

1. Save the photo inside the `images` folder, e.g. `images/kinder-donut.jpg`.
2. In `js/config.js`, find that product and set:
   ```js
   image: "images/kinder-donut.jpg",
   ```
3. Save the file. Done — no other changes needed.

If you leave `image: ""` empty, the emoji placeholder is used automatically.

---

## 5. How to preview the website on your computer

You don't need to install anything complicated.

**Easiest way:** double-click `index.html` — it will open in your browser.
(A couple of animations behave slightly better through a local server,
but everything works fine this way too.)

---

## 6. How to publish it online for free

The simplest free option is **Netlify Drop**:

1. Go to **https://app.netlify.com/drop**
2. Drag the whole bakery website folder (the one containing `index.html`)
   onto the page.
3. Netlify gives you a live web address in a few seconds — that's your
   website, live on the internet, for $0.
4. Whenever you edit `js/config.js` later (new prices, new items), just
   drag the folder onto the same Netlify Drop page again to update it.

Other equally good free options if you prefer: **GitHub Pages**,
**Vercel**, or **Cloudflare Pages** — all work the same way, drag-and-drop
or connect a folder, no payment required.

---

## 7. Testing checklist (already verified for you)

This site has already been tested end-to-end: browsing the menu, opening
a product, changing quantity, adding multiple items, editing the cart,
removing an item, filling in customer details, switching between pickup
and delivery, and generating the final WhatsApp message — including all
the error messages (empty name, empty cart, missing delivery address,
WhatsApp number not set up). It was also checked at 320px, 375px, 414px,
768px, 1024px and 1440px screen widths with no layout issues.

If you ever want to double-check after making edits, just walk through
that same flow once in your browser.

---

## 8. Quick summary of every placeholder

| Placeholder | Found in | What it controls |
|---|---|---|
| `BAKERY_WHATSAPP_NUMBER` | `js/config.js` | Where WhatsApp orders are sent |
| `BAKERY_PHONE` | `js/config.js` | Phone number shown in Contact section |
| `BAKERY_ADDRESS` | `js/config.js` | Address shown in Contact section |
| `BAKERY_INSTAGRAM` | `js/config.js` | Instagram link (no `@`) |
| `GOOGLE_MAPS_URL` | `js/config.js` | "Open in Google Maps" button |
| `OPENING_HOURS` | `js/config.js` | Opening hours text |
| `PRODUCTS` (prices/images) | `js/config.js` | Full menu, prices and photos |

Enjoy the new website! 🥐
