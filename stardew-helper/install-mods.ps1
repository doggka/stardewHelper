# Бутстрап модов Stardew Valley.
#
# Два режима:
#   - запуск руками: задаёт вопросы, как обычный установщик
#   - запуск из приложения (-Yes / -DryRun): вопросов не задаёт, пишет лог в stdout
#
# Что делает сам:
#   - находит игру через библиотеки Steam
#   - ставит SMAPI и UI Info Suite 2 с GitHub
#   - раскладывает по Mods всё, что лежит в папке drop
#
# Чего НЕ делает: не качает с Nexus. Там нужен логин и премиум-аккаунт,
# обойти это нельзя. Скрипт откроет страницы — скачиваешь руками в drop.
#
# Прав администратора не требует. Повторный запуск безопасен.

param(
    [string]$GamePath,
    [switch]$Yes,
    [switch]$OpenNexus,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# Приложение читает наш вывод как UTF-8, поэтому фиксируем кодировку.
try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
} catch { }

# В неинтерактивном режиме вывод идёт через Write-Output: Write-Host завязан
# на консоль, и при перехвате потока его можно не увидеть.
$script:Quiet = $Yes -or $DryRun

function Say($text, $color = 'Gray') {
    if ($script:Quiet) { Write-Output $text }
    else { Write-Host $text -ForegroundColor $color }
}
function Head($text) {
    if ($script:Quiet) { Write-Output ''; Write-Output "=== $text ===" }
    else { Write-Host ''; Write-Host "=== $text ===" -ForegroundColor Yellow }
}
function Ask($text) {
    if ($script:Quiet) { return $true }
    $a = Read-Host $text
    return ($a -match '^[yYдД]')
}

if ($DryRun) { Say 'РЕЖИМ ПРОВЕРКИ: ничего не скачивается и не устанавливается.' Yellow }

Head 'Поиск игры'

function Find-Game {
    $candidates = @()
    foreach ($base in @("${env:ProgramFiles(x86)}\Steam", "$env:ProgramFiles\Steam")) {
        $vdf = Join-Path $base 'steamapps\libraryfolders.vdf'
        if (-not (Test-Path $vdf)) { continue }
        $text = Get-Content $vdf -Raw
        foreach ($block in ($text -split '"\d+"\s*\{') | Select-Object -Skip 1) {
            if ($block -notmatch '"413150"') { continue }
            if ($block -match '"path"\s*"([^"]+)"') {
                $candidates += (Join-Path ($matches[1] -replace '\\\\', '\') 'steamapps\common\Stardew Valley')
            }
        }
    }
    $candidates += "${env:ProgramFiles(x86)}\Steam\steamapps\common\Stardew Valley"
    $candidates += "$env:ProgramFiles\Steam\steamapps\common\Stardew Valley"
    $candidates += 'C:\GOG Games\Stardew Valley'
    foreach ($c in $candidates) {
        if (Test-Path (Join-Path $c 'Stardew Valley.exe')) { return $c }
    }
    return $null
}

$game = if ($GamePath) { $GamePath } else { Find-Game }

if (-not $game -or -not (Test-Path (Join-Path $game 'Stardew Valley.exe'))) {
    Say 'Игру найти не удалось.' Red
    if ($script:Quiet) {
        Say 'Укажи путь к папке с Stardew Valley.exe и запусти ещё раз.' Yellow
        exit 2
    }
    $game = Read-Host 'Укажи папку с Stardew Valley.exe'
    if (-not (Test-Path (Join-Path $game 'Stardew Valley.exe'))) {
        Say 'В этой папке нет Stardew Valley.exe. Выходим.' Red
        Read-Host 'Enter для выхода'; exit 1
    }
}
Say "Игра: $game" Green

if (-not (Ask 'Продолжить? (y/n)')) { Say 'Отменено.'; exit 0 }

$mods = Join-Path $game 'Mods'
$work = Join-Path $PSScriptRoot 'bootstrap-temp'
$drop = Join-Path $PSScriptRoot 'drop'
if (-not $DryRun) {
    New-Item -ItemType Directory -Force $work | Out-Null
    New-Item -ItemType Directory -Force $drop | Out-Null
}

function Get-LatestAsset($repo, $pattern) {
    $rel = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest" -Headers @{ 'User-Agent' = 'stardew-helper' }
    $asset = $rel.assets | Where-Object { $_.name -like $pattern } | Select-Object -First 1
    if (-not $asset) { throw "в релизе $repo нет файла по шаблону $pattern" }
    return [pscustomobject]@{ Url = $asset.browser_download_url; Name = $asset.name; Tag = $rel.tag_name }
}

# ---------------------------------------------------------------- SMAPI
Head 'SMAPI'
if (Test-Path (Join-Path $game 'StardewModdingAPI.exe')) {
    Say 'Уже установлен — пропускаю.' Green
} else {
    try {
        $a = Get-LatestAsset 'Pathoschild/SMAPI' 'SMAPI-*-installer.zip'
        if ($DryRun) {
            Say "Скачал бы $($a.Name) ($($a.Tag)) и запустил установщик с --game-path." Yellow
        } elseif ($script:Quiet) {
            # Установщику SMAPI нужна настоящая консоль: он чистит экран через
            # Console.Clear(). Без консоли он падает, поэтому даже не пробуем.
            Say 'SMAPI ставится только из окна PowerShell — его установщику нужна консоль.' Yellow
            Say 'Нажми «Установить» в приложении: откроется окно, и там он отработает.' Yellow
        } else {
            Say "Качаю $($a.Name) ($($a.Tag))"
            $zip = Join-Path $work $a.Name
            Invoke-WebRequest $a.Url -OutFile $zip -UseBasicParsing
            $out = Join-Path $work 'smapi'
            Remove-Item $out -Recurse -Force -ErrorAction SilentlyContinue
            Expand-Archive $zip -DestinationPath $out -Force
            $inst = Get-ChildItem $out -Recurse -Filter 'SMAPI*installer*.exe' | Select-Object -First 1
            if (-not $inst) { $inst = Get-ChildItem $out -Recurse -Filter 'install*.exe' | Select-Object -First 1 }
            if (-not $inst) { throw 'не нашёл установщик внутри архива' }
            Say 'Запускаю установщик SMAPI...'
            # Запуск строго без конвейера и без 2>&1: любое перенаправление
            # отбирает у установщика буфер консоли, и Console.Clear() падает
            # с «Неверный дескриптор». Вывод он пишет сам в это же окно.
            & $inst.FullName --install --game-path $game --no-prompt
            $rc = $LASTEXITCODE
            if (Test-Path (Join-Path $game 'StardewModdingAPI.exe')) {
                Say 'SMAPI установлен.' Green
            } else {
                Say "SMAPI не установился (код установщика: $rc)." Red
                Say 'Поставь вручную: скачай архив с https://smapi.io/ и запусти' Yellow
                Say '«install on Windows.bat» двойным кликом.' Yellow
            }
        }
    } catch {
        Say "Не получилось: $_" Red
        Say 'Можно поставить вручную: https://smapi.io/' Yellow
    }
}

if (-not $DryRun) { New-Item -ItemType Directory -Force $mods | Out-Null }

# ---------------------------------------------------- Распаковка в Mods
function Install-ModZip($zipPath) {
    $tmp = Join-Path $work ('x_' + [IO.Path]::GetFileNameWithoutExtension($zipPath))
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    Expand-Archive $zipPath -DestinationPath $tmp -Force
    # манифест может лежать на любой глубине; берём его папку, чтобы
    # не получилось Mods\Мод\Мод\manifest.json
    $manifests = Get-ChildItem $tmp -Recurse -Filter 'manifest.json'
    if (-not $manifests) { Say "  в $(Split-Path $zipPath -Leaf) нет manifest.json — пропускаю" Red; return $false }
    foreach ($m in $manifests) {
        $src = $m.Directory.FullName
        $dst = Join-Path $mods $m.Directory.Name
        Copy-Item $src $dst -Recurse -Force
        Say "  -> Mods\$($m.Directory.Name)" Green
    }
    return $true
}

Head 'UI Info Suite 2'
try {
    $a = Get-LatestAsset 'Annosz/UIInfoSuite2' '*.zip'
    if ($DryRun) {
        Say "Скачал бы $($a.Name) ($($a.Tag)) и распаковал в Mods." Yellow
    } else {
        Say "Качаю $($a.Name) ($($a.Tag))"
        $zip = Join-Path $work $a.Name
        Invoke-WebRequest $a.Url -OutFile $zip -UseBasicParsing
        Install-ModZip $zip | Out-Null
    }
} catch {
    Say "Не получилось: $_" Red
}

# ------------------------------------------------------------ С Nexus
Head 'Эти скачай руками'
$nexus = @(
    @{ n = 'NPC Map Locations'; u = 'https://www.nexusmods.com/stardewvalley/mods/239' },
    @{ n = 'UI Info Suite 2 Alternative (иконка торговки под узелки)'; u = 'https://www.nexusmods.com/stardewvalley/mods/43127' },
    @{ n = 'Lookup Anything'; u = 'https://www.nexusmods.com/stardewvalley/mods/541' },
    @{ n = 'Data Layers'; u = 'https://www.nexusmods.com/stardewvalley/mods/1691' }
)
Say "Скачанные zip клади сюда: $drop" Yellow
Say 'Потом запусти установку ещё раз — скрипт их разложит.' Yellow
foreach ($m in $nexus) { Say "  $($m.n)"; Say "    $($m.u)" DarkGray }

$doOpen = if ($script:Quiet) { [bool]$OpenNexus } else { Ask 'Открыть эти страницы в браузере? (y/n)' }
if ($doOpen) {
    if ($DryRun) { Say 'Открыл бы эти страницы в браузере.' Yellow }
    else { foreach ($m in $nexus) { Start-Process $m.u } }
}

# --------------------------------------------------- Разбор папки drop
Head 'Папка drop'
$zips = Get-ChildItem $drop -Filter '*.zip' -ErrorAction SilentlyContinue
if (-not $zips) {
    Say 'Пусто — нечего раскладывать.'
} else {
    foreach ($z in $zips) {
        if ($DryRun) { Say "Распаковал бы $($z.Name) в Mods." Yellow; continue }
        Say "Распаковываю $($z.Name)"
        if (Install-ModZip $z.FullName) { Remove-Item $z.FullName -Force }
    }
}

# ------------------------------------------------------------- Итог
Head 'Что стоит сейчас'
$smapi = Test-Path (Join-Path $game 'StardewModdingAPI.exe')
Say ("  SMAPI: " + $(if ($smapi) { 'есть' } else { 'НЕТ' })) $(if ($smapi) { 'Green' } else { 'Red' })
if (Test-Path $mods) {
    Get-ChildItem $mods -Directory | ForEach-Object {
        $man = Join-Path $_.FullName 'manifest.json'
        $ver = ''
        if (Test-Path $man) {
            try { $ver = ' ' + (Get-Content $man -Raw | ConvertFrom-Json).Version } catch { }
        }
        Say "  $($_.Name)$ver" Green
    }
} else {
    Say '  папки Mods пока нет'
}

if (-not $DryRun) { Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue }

Say ''
if ($DryRun) {
    Say 'Это была проверка. Ничего не изменилось.' Yellow
} else {
    Say 'Запускать игру теперь надо через SMAPI, а не напрямую.' Yellow
    Say 'В Steam: свойства игры -> параметры запуска -> путь к StardewModdingAPI.exe,'
    Say 'либо просто запусти StardewModdingAPI.exe из папки игры.'
}

if (-not $script:Quiet) { Read-Host 'Enter для выхода' }
exit 0
