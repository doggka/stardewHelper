# home-tools

Локальные самоделки. Сейчас здесь одно: помощник по Stardew Valley.

| Папка | Что это |
|---|---|
| [stardew-helper](stardew-helper/) | Приложение на Electron: узелки Общественного центра, сводка дня, фестивали. Читает сейв, подсказывает по сезонам, погоде и состоянию фермы |
| [stardew-bridge](stardew-bridge/) | Мод для SMAPI: отдаёт приложению то, чего нет в сейве — ассортимент торговки, справочник узелков, иконки предметов, полив |

GitHub: `git@github.com:doggka/stardewHelper.git`, рабочая ветка
`feat/desktop-app`.

## Восстановление с нуля

Проверено на практике: после переустановки Windows по этим шагам всё
поднимается. В репозиторий не входят `node_modules` и `.toolchain` —
первое ставится из `package-lock.json`, второе качается заново.

### 1. Git

```powershell
winget install --id Git.Git -e --source winget
git config --global user.name "doggm"
git config --global user.email "doggm@localhost"
```

Имя и почта важны: вся история подписана именно так, и без них коммиты
разъедутся с прежними.

### 2. Код

```powershell
git clone git@github.com:doggka/stardewHelper.git C:\Users\doggm\projects\home-tools
cd C:\Users\doggm\projects\home-tools
git checkout feat/desktop-app
```

Нужен ключ SSH, добавленный в GitHub.

### 3. Node — портативно, в систему не ставится

```powershell
$root = "C:\Users\doggm\projects\home-tools\.toolchain"
New-Item -ItemType Directory -Force -Path $root
$idx = Invoke-RestMethod https://nodejs.org/dist/index.json
$v = ($idx | Where-Object { $_.lts -ne $false } | Select-Object -First 1).version
Invoke-WebRequest "https://nodejs.org/dist/$v/node-$v-win-x64.zip" -OutFile "$root\node.zip"
Expand-Archive "$root\node.zip" -DestinationPath $root -Force
Rename-Item "$root\node-$v-win-x64" "$root\node"
Remove-Item "$root\node.zip"
```

Проверялось на LTS 24 и 26, обе работают.

### 4. Зависимости

```powershell
$env:Path = "C:\Users\doggm\projects\home-tools\.toolchain\node;" + $env:Path
cd C:\Users\doggm\projects\home-tools\stardew-helper
npm.cmd install
npx.cmd tsc --noEmit
```

`npm.cmd` и `npx.cmd`, а не `npm` и `npx`: PowerShell по короткому имени
находит `.ps1`-обёртку, а выполнение сценариев в системе обычно запрещено.

### 5. .NET SDK 6 — тоже портативно, нужен только для мода

```powershell
$root = "C:\Users\doggm\projects\home-tools\.toolchain"
Invoke-WebRequest https://dot.net/v1/dotnet-install.ps1 -OutFile "$root\dotnet-install.ps1"
& "$root\dotnet-install.ps1" -Channel 6.0 -InstallDir "$root\dotnet" -NoPath
```

Приложение собирается и без него — .NET нужен только чтобы пересобрать
`stardew-bridge`.

### 6. Где лежит игра — если сборка мода её не находит

Пакет сборки модов ищет игру через Steam. Если Steam не установлен или
игра в нестандартной папке, сборка падает с `can't find your game folder`.

Лечится файлом в профиле пользователя, **не правкой проекта**: путь
машинный, и на другой системе он будет другим.

`%USERPROFILE%\stardewvalley.targets` (на macOS `~/stardewvalley.targets`):

```xml
<Project>
  <PropertyGroup>
    <GamePath>F:\SteamLibrary\steamapps\common\Stardew Valley</GamePath>
  </PropertyGroup>
</Project>
```

### Чего в репозитории нет и быть не должно

| Что | Откуда берётся |
|---|---|
| `node_modules` | `npm install` |
| `.toolchain` | шаги 3 и 5 |
| `release`, `dist` | сборкой |
| Иконки предметов | мод выгружает при загрузке сейва |
| Сейвы игры | `%APPDATA%\StardewValley`, отдельный бэкап |
| SSH-ключи | отдельный бэкап |

## Соглашения

Как ведём работу — в [CONTRIBUTING.md](CONTRIBUTING.md). Коротко: ветка на
задачу, пуш после каждого коммита, сборку запускает владелец.
