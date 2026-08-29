Option Explicit

Dim shell, command, exitCode
Set shell = CreateObject("WScript.Shell")

command = """C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe""" & _
  " -NoProfile -NonInteractive -ExecutionPolicy Bypass -File " & _
  """C:\Users\sgdie\Documents\Claude\Scheduled\aiasap_failure_watch.ps1"""

' Window style 0 is hidden. Wait for completion so Task Scheduler keeps the
' watcher's real exit status instead of reporting success before it finishes.
exitCode = shell.Run(command, 0, True)
WScript.Quit exitCode
