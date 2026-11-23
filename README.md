# Dogfeed Sweeper

A phone app that checks Australian pet stores for one dog food and tells you when it drops to your target price. Runs free on GitHub.

## How it works

1. **GitHub Actions** runs `checker/check.mjs` three times a day (6am, 12pm, 6pm Brisbane time).
2. The checker opens each store link in `watchlist.json`, reads the price from the page, and saves it to `docs/prices.json`.
3. When a store newly drops to or below `targetPrice`, it sends a push notification through **ntfy** (free app for iPhone and Android).
4. **GitHub Pages** hosts the app in `docs/`. Open it on your phone and use "Add to Home Screen" to install it like an app.

Cost: $0. GitHub Actions and Pages are free for this amount of use, and so is ntfy.

## Setup (about 10 minutes)

1. Create a new GitHub repository and upload everything in this folder.
2. Edit `watchlist.json`: set the product name, your target price, and the exact product page link for each store. Delete stores that don't sell it.
3. Pick a hard-to-guess ntfy topic name (for example `dave-dogfood-7k2q`). In the repo go to Settings → Secrets and variables → Actions, and add a secret called `NTFY_TOPIC` with that name. Install the ntfy app on your phone and subscribe to the same topic.
4. Settings → Pages: choose "Deploy from a branch", branch `main`, folder `/docs`.
5. Actions tab → "Check dog food prices" → Run workflow, to do the first check right away.
6. Open the Pages link on your phone, then Share → Add to Home Screen.

## Known limits

- Some stores (Coles, Woolworths, Amazon) sometimes block automated checks. The app shows "Couldn't read a price" for that store rather than a wrong number.
- Prices are read from the product page's structured data, which most big retailers publish. If a store changes its site, its row may stop updating until the checker is adjusted.
- Member-only prices (e.g. Pet Circle autoship, Petbarn Friends) may not show, since the checker isn't logged in.
