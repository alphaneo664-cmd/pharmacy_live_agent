Option Explicit

Dim shell, fso, appDir, logPath, serverCommand, attempt, nodeModulesPath

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

appDir = fso.GetParentFolderName(WScript.ScriptFullName)
logPath = fso.BuildPath(appDir, "mom-server.log")
nodeModulesPath = fso.BuildPath(appDir, "node_modules")
shell.CurrentDirectory = appDir

' Do not start a second copy if the application is already running.
If Not AppIsReady() Then
  ' Install only on the first run. The command remains hidden, which makes
  ' this launcher suitable for the Windows Startup folder.
  If Not fso.FolderExists(nodeModulesPath) Then
    serverCommand = "cmd.exe /d /c npm install --legacy-peer-deps > " & Quote(logPath) & " 2>&1"
    shell.Run serverCommand, 0, True
  End If

  serverCommand = "cmd.exe /d /c node node_modules\tsx\dist\cli.mjs server.ts >> " & Quote(logPath) & " 2>&1"
  shell.Run serverCommand, 0, False
End If

' Wait briefly for the server before opening the browser.
For attempt = 1 To 40
  If AppIsReady() Then
    shell.Run "http://localhost:3001", 1, False
    WScript.Quit 0
  End If
  WScript.Sleep 500
Next

' Open the browser even if the health check timed out; the server log has details.
shell.Run "http://localhost:3001", 1, False

Function AppIsReady()
  Dim http
  AppIsReady = False

  On Error Resume Next
  Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
  http.SetTimeouts 500, 500, 500, 500
  http.Open "GET", "http://127.0.0.1:3001/api/health", False
  http.Send
  AppIsReady = (Err.Number = 0 And http.Status = 200)
  Err.Clear
  On Error GoTo 0
End Function

Function Quote(value)
  Quote = Chr(34) & value & Chr(34)
End Function