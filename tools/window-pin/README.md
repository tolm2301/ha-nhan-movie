# Hanhan Popup Pin Tool (Windows)

This helper keeps the **mini popup window** always-on-top at OS level.

## Why this exists
Web code cannot force a browser popup to stay always-on-top across all apps/windows.
This script applies OS-level topmost behavior for matching window titles.

## Usage
1. Open watch page popup (`Popup nổi (pin trên màn hình)`).
2. Run PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File ".\tools\window-pin\PinHanhanPopup.ps1" -Mode pin
```

3. Stop with `Ctrl+C` when you are done.

## Unpin

```powershell
powershell -ExecutionPolicy Bypass -File ".\tools\window-pin\PinHanhanPopup.ps1" -Mode unpin
```

## Notes
- Default title match is `Hanhan Mini Popup`.
- If title text changes, pass `-WindowTitleContains "<part of title>"`.
- This tool is Windows-only.
