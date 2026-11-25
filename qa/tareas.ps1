# Programa los dos disparadores del equipo QA en el Programador de tareas de Windows (usuario actual).
#   KoreX-QA-diario : smoke test diario a las 09:00 (Probador + Regresión)
#   KoreX-QA-vigia  : cada 15 min mira si hubo merge a main y, tras el despliegue, corre la Regresión
# Uso:  powershell -ExecutionPolicy Bypass -File qa\tareas.ps1          (instalar / actualizar)
#       powershell -ExecutionPolicy Bypass -File qa\tareas.ps1 -Quitar  (desinstalar)
param([switch]$Quitar)
$qa = $PSScriptRoot
$node = (Get-Command node).Source
if ($Quitar) {
    'KoreX-QA-diario', 'KoreX-QA-vigia' | ForEach-Object { Unregister-ScheduledTask -TaskName $_ -Confirm:$false -ErrorAction SilentlyContinue }
    'Tareas QA quitadas.'; return
}
$log = Join-Path $qa '.estado'
New-Item -ItemType Directory -Force $log | Out-Null
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 45) -MultipleInstances IgnoreNew
$diario = New-ScheduledTaskAction -Execute 'cmd.exe' -WorkingDirectory $qa -Argument "/c `"$node`" run.mjs --regresion >> .estado\diario.log 2>&1"
$vigia  = New-ScheduledTaskAction -Execute 'cmd.exe' -WorkingDirectory $qa -Argument "/c `"$node`" vigia.mjs >> .estado\vigia.log 2>&1"
Register-ScheduledTask -TaskName 'KoreX-QA-diario' -Action $diario -Settings $ajustes -Force `
    -Trigger (New-ScheduledTaskTrigger -Daily -At 9:00am) -Description 'KoreX QA: smoke test diario contra producción (qa/README.md)' | Out-Null
$cada15 = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes 15)
Register-ScheduledTask -TaskName 'KoreX-QA-vigia' -Action $vigia -Settings $ajustes -Force `
    -Trigger $cada15 -Description 'KoreX QA: regresión tras cada merge a main (qa/README.md)' | Out-Null
Get-ScheduledTask -TaskName 'KoreX-QA-*' | Select-Object TaskName, State
