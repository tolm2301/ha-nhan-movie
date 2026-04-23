param(
  [ValidateSet('pin', 'unpin')]
  [string]$Mode = 'pin',

  [string]$WindowTitleContains = 'Hanhan Mini Popup',

  [int]$PollMs = 350
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class WinApi {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

  public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
  public static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);
}
"@

$SWP_NOMOVE = 0x0002
$SWP_NOSIZE = 0x0001
$SWP_NOACTIVATE = 0x0010
$Flags = $SWP_NOMOVE -bor $SWP_NOSIZE -bor $SWP_NOACTIVATE

function Get-MatchingWindows([string]$titlePart) {
  $results = New-Object System.Collections.Generic.List[System.IntPtr]

  $callback = [WinApi+EnumWindowsProc]{
    param([IntPtr]$hWnd, [IntPtr]$lParam)

    if (-not [WinApi]::IsWindowVisible($hWnd)) {
      return $true
    }

    $sb = New-Object System.Text.StringBuilder 512
    [void][WinApi]::GetWindowText($hWnd, $sb, $sb.Capacity)
    $title = $sb.ToString()

    if (-not [string]::IsNullOrWhiteSpace($title) -and $title.Contains($titlePart)) {
      $results.Add($hWnd)
    }

    return $true
  }

  [void][WinApi]::EnumWindows($callback, [IntPtr]::Zero)
  return $results
}

Write-Host "[Hanhan Pin Tool] Mode: $Mode | Match: '$WindowTitleContains'"
Write-Host "Press Ctrl+C to stop."

while ($true) {
  $windows = Get-MatchingWindows -titlePart $WindowTitleContains
  foreach ($hWnd in $windows) {
    if ($Mode -eq 'pin') {
      [void][WinApi]::SetWindowPos($hWnd, [WinApi]::HWND_TOPMOST, 0, 0, 0, 0, $Flags)
    } else {
      [void][WinApi]::SetWindowPos($hWnd, [WinApi]::HWND_NOTOPMOST, 0, 0, 0, 0, $Flags)
    }
  }

  Start-Sleep -Milliseconds $PollMs
}
