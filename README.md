# Money Pots

A static private ledger for managing virtual savings pots over one Tagesgeldkonto.

## Features

- Create, edit, target, color-code, and delete virtual money pots.
- Configure a monthly incoming transfer and split it across pots with absolute amounts.
- Overflow from reached targets, missing destinations, and posted interest goes to Unallocated.
- Overdue monthly splits and estimated interest are applied automatically when the app opens.
- Customize the app theme and individual pot colors.
- Starts with an empty dark-mode ledger by default.
- Process scheduled transfers automatically when the app opens after the arrival date.
- Record additions, withdrawals, balance corrections, and moves between pots.
- Filter transaction history by pot and transaction type.
- Export and import a JSON backup.
- Reset local app data from Settings back to a blank ledger.
- Installable PWA metadata and offline cache for GitHub Pages hosting.

All data is stored locally in the browser with `localStorage`. No bank connection or server sync is included.

## GitHub Pages

1. Push this folder to a GitHub repository.
2. In GitHub, open `Settings` -> `Pages`.
3. Set the source to `Deploy from a branch`.
4. Select the branch and `/root` folder.
5. Open the published URL on iPhone Safari and use `Share` -> `Add to Home Screen`.

## Local Preview

Serve the folder with any static server, for example:

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173`.
