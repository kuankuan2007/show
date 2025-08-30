# Adobe Creative Cloud 进程终止脚本
# 用于结束所有Creative Cloud的进程

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-NOT (Test-Administrator)) {
    Write-Host "检测到当前没有管理员权限" -ForegroundColor Yellow
    Write-Host "按下任意键以管理员权限重新启动脚本..." -ForegroundColor Gray

    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

    $psExecutable = if ($PSVersionTable.PSVersion.Major -ge 6) { "pwsh" } else { "powershell" }

    $scriptPath = $MyInvocation.MyCommand.Path

    Start-Process $psExecutable -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File `"$scriptPath`""

    exit
}
Write-Host "正在搜索 Creative Cloud 相关进程..." -ForegroundColor Yellow


$creativeCloudProcesses = Get-Process | Where-Object { $_.ProcessName -like "Creative Cloud*" -or $_.MainWindowTitle -like "Creative Cloud*" -or $_.ProcessName -like "Adobe*" -or $_.ProcessName -like "CCLibrary*" -or $_.ProcessName -like "CCLibraryUI*" -or $_.ProcessName -like "CCXProcess*" }

if ($creativeCloudProcesses.Count -eq 0) {
    Write-Host "未找到任何 Creative Cloud 相关进程。" -ForegroundColor Green

    Write-Host "`n按任意键退出..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

    exit
}

Write-Host "找到以下 Creative Cloud 进程：" -ForegroundColor Cyan
$creativeCloudProcesses | ForEach-Object {
    Write-Host "  - $($_.ProcessName) (PID: $($_.Id))" -ForegroundColor White
}

# 询问用户是否确认终止这些进程
$confirmation = Read-Host "`n是否要终止这些进程？(Y/N)"

if ($confirmation -eq 'Y' -or $confirmation -eq 'y' -or $confirmation -eq 'yes' -or $confirmation -eq '是') {
    Write-Host "`n正在终止 Creative Cloud 进程..." -ForegroundColor Yellow

    $successCount = 0
    $failCount = 0

    foreach ($process in $creativeCloudProcesses) {
        try {
            Stop-Process -Id $process.Id -Force
            Write-Host "✓ 成功终止: $($process.ProcessName) (PID: $($process.Id))" -ForegroundColor Green
            $successCount++
        }
        catch {
            Write-Host "✗ 终止失败: $($process.ProcessName) (PID: $($process.Id)) - $($_.Exception.Message)" -ForegroundColor Red
            $failCount++
        }
    }

    Write-Host "`n操作完成！" -ForegroundColor Cyan
    Write-Host "成功终止: $successCount 个进程" -ForegroundColor Green
    if ($failCount -gt 0) {
        Write-Host "终止失败: $failCount 个进程" -ForegroundColor Red
    }
}
else {
    Write-Host "操作已取消。" -ForegroundColor Yellow
}

Write-Host "`n按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
