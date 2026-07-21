local logger = require("logger")
local millennium = require("millennium")
local fs = require("fs")
local http = require("http")
local utils = require("utils")

local function resolve_plugin_dir()
    local source = debug.getinfo(1, "S").source or ""
    if source:sub(1, 1) == "@" then source = source:sub(2) end
    return source:match("^(.+)[/\\]backend[/\\][^/\\]+$")
        or millennium.steam_path() .. "/millennium/plugins/deck-shelves"
end

local PLUGIN_DIR = resolve_plugin_dir():gsub("/", "\\")
-- Millennium's JSON decoder represents both empty arrays and empty objects as
-- empty Lua tables. Settings writes therefore stay as raw JSON documents; Lua
-- only decodes them for validation and summaries, never for a normal save.
local json = require("json")
json.array = json.array or function(value) return value or {} end
json.object = json.object or function(value) return value or {} end
local SETTINGS_FILE = PLUGIN_DIR .. "\\settings.json"
local BACKUPS_DIR = PLUGIN_DIR .. "\\backups"
local USER_HOME = os.getenv("USERPROFILE") or os.getenv("HOME") or ""
local LEGACY_SETTINGS_FILE = USER_HOME .. "\\homebrew\\settings\\Deck-Shelves\\settings.json"

local DEFAULT_SETTINGS = {
    enabled = false,
    hideRecents = false,
    recentsReplaceSource = false,
    hideHomeTabs = false,
    shelfHeroBackground = false,
    keepShelvesStacked = true,
    fadeRecentsTitle = false,
    globalMatchNativeSize = true,
    globalHighlightFirst = false,
    globalHighlightAll = false,
    globalHideStatusLine = false,
    globalHideNewBadge = false,
    globalHideDiscountBadge = false,
    globalHideCompatIcons = false,
    globalHideNonSteamBadge = false,
    globalHideShelfTitle = false,
    globalHideGameNames = false,
    globalHideInstallIndicator = false,
    globalHideSeeMore = false,
    globalHideRefreshCard = false,
    shelves = json.array(),
    smartShelvesEnabled = false,
    smartShelvesAtBottom = false,
    smartShelves = json.array(),
    smartSurpriseMe = false,
    smartSurpriseMeCount = 0,
    profileTriggersEnabled = false,
    autoCollapseEnabled = false,
    notificationsDisabled = false,
    notificationsDisabledAreas = json.array(),
    showcaseSeen = false,
}

local function read_file(path)
    local file = io.open(tostring(path or ""), "rb")
    if not file then return nil end
    local body = file:read("*a")
    file:close()
    return body
end

local function write_file(path, body)
    local file = io.open(tostring(path or ""), "wb")
    if not file then return false end
    file:write(tostring(body or ""))
    file:close()
    return true
end

local function copy_file(source, destination)
    local body = read_file(source)
    return body ~= nil and write_file(destination, body)
end

local function trim(value)
    return tostring(value or ""):match("^%s*(.-)%s*$") or ""
end

local function normalize_separators(path)
    return tostring(path or ""):gsub("/", "\\"):gsub("\\+", "\\")
end

local function normalize_path(value)
    if type(value) == "table" then
        value = value.dest_path or value.src_path or value.path or value.file
    end
    if type(value) ~= "string" then return nil end
    local path = trim(value):gsub('^"(.*)"$', '%1'):gsub("^'(.*)'$", "%1")
    path = path:gsub("^file:///?", "")
    if path:sub(1, 1) == "~" then path = USER_HOME .. path:sub(2) end
    path = normalize_separators(path)
    if path == "" then return nil end
    local ok, absolute = pcall(fs.absolute, path)
    if ok and absolute then path = normalize_separators(absolute) end
    local home = normalize_separators(USER_HOME):lower():gsub("\\$", "")
    local lower = path:lower()
    if lower ~= home and lower:sub(1, #home + 1) ~= home .. "\\" then return nil end
    return path
end

local function ensure_parent(path)
    local parent = fs.parent_path(path)
    if parent and parent ~= "" then fs.create_directories(parent) end
end

local function decode(body)
    if not body or body == "" then return nil end
    local ok, value = pcall(json.decode, body)
    return ok and value or nil
end

local function run_powershell_json(script)
    local temp_dir = utils.getenv("TEMP") or utils.getenv("TMP") or PLUGIN_DIR
    local script_path = fs.join(temp_dir, "deck-shelves-" .. utils.uuid() .. ".ps1")
    if not write_file(script_path, script) then return nil end
    local command = 'powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' .. script_path .. '"'
    local ok, output, status = pcall(utils.exec, command)
    os.remove(script_path)
    if not ok or status ~= 0 or not output then return nil end
    return decode(trim(output))
end

local function clone(value)
    return decode(json.encode(value))
end

local function unwrap_state(value)
    if type(value) ~= "table" then return nil end
    if type(value.state) == "table" then return value.state end
    return value
end

local function normalize_state(value)
    local state = unwrap_state(value)
    if type(state) ~= "table" then state = clone(DEFAULT_SETTINGS) end
    for key, default in pairs(DEFAULT_SETTINGS) do
        if state[key] == nil then state[key] = clone(default) end
    end
    if type(state.shelves) ~= "table" then state.shelves = json.array() end
    if type(state.smartShelves) ~= "table" then state.smartShelves = json.array() end
    return state
end

local function encode_settings(value)
    local body = json.encode(value)
    for _, key in ipairs({
        "shelves", "smartShelves", "savedFilters", "savedSmartFilters",
        "qamHiddenToggles", "qamHiddenSections", "allShelvesOrder", "profiles",
        "buttonBindingsDisabled", "notificationsDisabledAreas", "backups",
    }) do
        body = body:gsub('"' .. key .. '":{}', '"' .. key .. '":[]')
    end
    return body
end

local function encode_array(value)
    if type(value) ~= "table" or #value == 0 then return "[]" end
    return json.encode(value)
end

local function atomic_write(path, body)
    ensure_parent(path)
    local tmp = path .. ".tmp"
    if not write_file(tmp, body) then return false end
    os.remove(path .. ".bak")
    os.rename(path, path .. ".bak")
    os.remove(path)
    if not os.rename(tmp, path) then
        os.rename(path .. ".bak", path)
        os.remove(tmp)
        return false
    end
    return true
end

local function safe_backup_name(name)
    name = tostring(name or "")
    return name:match("^settings%-%d%d%d%d%d%d%d%d%-%d%d%d%d%d%d[%w%-]*%.json$") ~= nil
end

local function is_auto_backup(name)
    return safe_backup_name(name) and not name:find("%-manual") and not name:find("%-import") and not name:find("%-pre%-restore")
end

local function backup_summary(state)
    local profiles = type(state.profiles) == "table" and #state.profiles or 0
    local filters = type(state.savedFilters) == "table" and #state.savedFilters or 0
    return {
        shelves = type(state.shelves) == "table" and #state.shelves or 0,
        smartShelves = type(state.smartShelves) == "table" and #state.smartShelves or 0,
        profiles = profiles,
        filters = filters,
    }
end

local function list_backup_entries()
    fs.create_directories(BACKUPS_DIR)
    local result = json.array()
    for _, entry in ipairs(fs.list(BACKUPS_DIR) or {}) do
        local name = tostring(entry.name or "")
        local path = tostring(entry.path or (BACKUPS_DIR .. "\\" .. name))
        if not entry.is_directory and safe_backup_name(name) then
            local state = normalize_state(decode(read_file(path)))
            local mtime = 0
            local size = 0
            pcall(function() mtime = tonumber(fs.last_write_time(path)) or tonumber(entry.modified or entry.mtime or 0) or 0 end)
            pcall(function() size = tonumber(fs.file_size(path)) or tonumber(entry.size or 0) or 0 end)
            result[#result + 1] = {
                name = name,
                mtime = mtime,
                size = size,
                summary = backup_summary(state),
            }
        end
    end
    table.sort(result, function(a, b) return a.name > b.name end)
    return result
end

local function prune_backups()
    local now = os.time()
    local entries = {}
    for _, entry in ipairs(fs.list(BACKUPS_DIR) or {}) do
        local name = tostring(entry.name or "")
        if not entry.is_directory and safe_backup_name(name) then
            local path = tostring(entry.path or (BACKUPS_DIR .. "\\" .. name))
            local ok, value = pcall(fs.last_write_time, path)
            local mtime = ok and tonumber(value) or 0
            if is_auto_backup(name) and mtime > 0 and (now - mtime) > (7 * 86400) then
                os.remove(path)
            else
                entries[#entries + 1] = { name = name, path = path, mtime = mtime, auto = is_auto_backup(name) }
            end
        end
    end
    table.sort(entries, function(a, b)
        if a.auto ~= b.auto then return a.auto end
        return a.mtime < b.mtime
    end)
    while #entries > 10 do
        local entry = table.remove(entries, 1)
        os.remove(entry.path)
    end
end

local function newest_auto_mtime()
    local newest = 0
    for _, entry in ipairs(fs.list(BACKUPS_DIR) or {}) do
        local name = tostring(entry.name or "")
        if not entry.is_directory and is_auto_backup(name) then
            local path = tostring(entry.path or (BACKUPS_DIR .. "\\" .. name))
            local ok, value = pcall(fs.last_write_time, path)
            local n = ok and tonumber(value) or 0
            if n and n > newest then newest = n end
        end
    end
    return newest
end

local function create_backup_file(tag, throttle_seconds)
    fs.create_directories(BACKUPS_DIR)
    local body = read_file(SETTINGS_FILE)
    if not body then return false, nil end
    if not tag and (tonumber(throttle_seconds) or 0) > 0 then
        local newest = newest_auto_mtime()
        if newest > 0 and (os.time() - newest) < throttle_seconds then return true, nil end
    end
    local suffix = tag and tag ~= "" and ("-" .. tostring(tag)) or ""
    local name = "settings-" .. os.date("%Y%m%d-%H%M%S") .. suffix .. ".json"
    local dest = BACKUPS_DIR .. "\\" .. name
    if read_file(dest) ~= nil then
        name = "settings-" .. os.date("%Y%m%d-%H%M%S") .. suffix .. "-" .. utils.uuid():sub(1, 6) .. ".json"
        dest = BACKUPS_DIR .. "\\" .. name
    end
    local ok = copy_file(SETTINGS_FILE, dest)
    if ok then prune_backups() end
    return ok, name
end


local function save_state(state)
    local clean = normalize_state(state)
    if read_file(SETTINGS_FILE) ~= nil then create_backup_file(nil, 86400) end
    return atomic_write(SETTINGS_FILE, encode_settings(json.object({ state = clean })))
end

local function settings_document(body)
    if type(body) ~= "string" or trim(body) == "" then return nil end
    local parsed = decode(body)
    local state = unwrap_state(parsed)
    if type(state) ~= "table" then return nil end
    if type(parsed) == "table" and type(parsed.state) == "table" then return body end
    return '{"state":' .. body .. '}'
end

local function state_json_from_document(body)
    local document = settings_document(body)
    if not document then return nil end
    return document:match('^%s*{%s*"state"%s*:%s*(.-)%s*}%s*$')
end

local function save_settings_document(body)
    local document = settings_document(body)
    if not document then return false end
    if read_file(SETTINGS_FILE) ~= nil then create_backup_file(nil, 86400) end
    return atomic_write(SETTINGS_FILE, document)
end

local function migrate_legacy_settings()
    if read_file(SETTINGS_FILE) ~= nil then return false end
    local legacy = decode(read_file(LEGACY_SETTINGS_FILE))
    local state = unwrap_state(legacy)
    if type(state) ~= "table" then return false end
    local ok = save_state(state)
    if ok then logger:info("Migrated Decky settings from " .. LEGACY_SETTINGS_FILE) end
    return ok
end

local function load_state()
    migrate_legacy_settings()
    return normalize_state(decode(read_file(SETTINGS_FILE)))
end

function get_settings()
    local body = read_file(SETTINGS_FILE)
    local state_json = state_json_from_document(body)
    if state_json then return state_json end
    save_state(load_state())
    return state_json_from_document(read_file(SETTINGS_FILE)) or encode_settings(clone(DEFAULT_SETTINGS))
end

local function coerce_settings(value)
    if type(value) == "string" then
        value = decode(value)
    end
    if type(value) ~= "table" then return nil end
    if value.settings ~= nil then return coerce_settings(value.settings) end
    if type(value.state) == "table" then return value.state end
    return value
end

function set_settings(settings)
    if type(settings) == "string" then
        return save_settings_document(settings) and "true" or "false"
    end
    local state = coerce_settings(settings)
    if type(state) ~= "table" then
        logger:warn("Rejected settings payload of type " .. type(settings))
        return "false"
    end
    return save_state(state) and "true" or "false"
end

function reset_settings()
    local state = clone(DEFAULT_SETTINGS)
    save_state(state)
    return encode_settings(state)
end

function list_backups()
    return encode_settings({ backups = list_backup_entries() })
end

function create_backup()
    local ok = create_backup_file("manual")
    return encode_settings({ ok = ok, backups = list_backup_entries() })
end

function restore_backup(name)
    if not safe_backup_name(name) then return json.encode({ ok = false, error = "invalid_name" }) end
    local body = read_file(BACKUPS_DIR .. "\\" .. name)
    if not settings_document(body) then return json.encode({ ok = false, error = "not_found" }) end
    create_backup_file("pre-restore")
    local document = settings_document(body)
    local ok = atomic_write(SETTINGS_FILE, document)
    local state_json = ok and state_json_from_document(document) or nil
    if state_json then return '{"ok":true,"state":' .. state_json .. '}' end
    return json.encode({ ok = false })
end

function delete_backup(name)
    if not safe_backup_name(name) then return json.encode({ ok = false, backups = list_backup_entries() }) end
    local ok = os.remove(BACKUPS_DIR .. "\\" .. name) ~= nil
    return encode_settings({ ok = ok, backups = list_backup_entries() })
end

function clear_backups()
    local removed = 0
    for _, entry in ipairs(fs.list(BACKUPS_DIR) or {}) do
        if not entry.is_directory and safe_backup_name(entry.name) then
            if os.remove(tostring(entry.path or (BACKUPS_DIR .. "\\" .. entry.name))) then removed = removed + 1 end
        end
    end
    return encode_settings({ ok = true, removed = removed, backups = json.array() })
end

function export_backup(payload, dest)
    if type(payload) == "string" and payload:match("^%s*{") then
        local decoded = decode(payload)
        if type(decoded) == "table" then payload, dest = decoded.name, decoded.dest or decoded.dest_path end
    end
    local name = payload
    local path = normalize_path(dest)
    if not safe_backup_name(name) or not path then return "false" end
    ensure_parent(path)
    return copy_file(BACKUPS_DIR .. "\\" .. name, path) and "true" or "false"
end

function import_backup(src_path)
    local path = normalize_path(src_path)
    local body = path and read_file(path) or nil
    local document = settings_document(body)
    if not document then return encode_settings({ ok = false, backups = list_backup_entries() }) end
    fs.create_directories(BACKUPS_DIR)
    local name = "settings-" .. os.date("%Y%m%d-%H%M%S") .. "-import.json"
    local ok = write_file(BACKUPS_DIR .. "\\" .. name, document)
    if ok then prune_backups() end
    return encode_settings({ ok = ok, backups = list_backup_entries() })
end

function export_settings(dest_path)
    local path = normalize_path(dest_path)
    if not path then return "false" end
    ensure_parent(path)
    local body = read_file(SETTINGS_FILE)
    return body and write_file(path, body) and "true" or "false"
end

function import_settings(src_path)
    local path = normalize_path(src_path)
    local body = path and read_file(path) or nil
    if settings_document(body) then save_settings_document(body) end
    return get_settings()
end

function write_json_file(payload, content)
    local path = payload
    if type(payload) == "string" and payload:match("^%s*{") then
        local decoded = decode(payload)
        if type(decoded) == "table" then path, content = decoded.path, decoded.content end
    end
    path = normalize_path(path)
    if not path or type(content) ~= "string" then return "false" end
    return atomic_write(path, content) and "true" or "false"
end

function read_json_file(path)
    path = normalize_path(path)
    local body = path and read_file(path) or nil
    return json.encode({ ok = body ~= nil, content = body })
end

function read_image_b64(path)
    path = normalize_path(path)
    if not path or not fs.exists(path) or not fs.is_file(path) then return json.encode({ ok = false }) end
    local ext = tostring(fs.extension(path) or ""):lower()
    local mime_by_ext = {
        [".png"] = "image/png", [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg",
        [".webp"] = "image/webp", [".gif"] = "image/gif", [".bmp"] = "image/bmp",
    }
    local mime = mime_by_ext[ext]
    local size = tonumber(fs.file_size(path)) or 0
    if not mime or size <= 0 or size > 8 * 1024 * 1024 then return json.encode({ ok = false }) end
    local raw = read_file(path)
    if not raw then return json.encode({ ok = false }) end
    local encoded = utils.base64_encode(raw)
    if not encoded or encoded == "" then return json.encode({ ok = false }) end
    return json.encode({ ok = true, dataUrl = "data:" .. mime .. ";base64," .. encoded })
end

function get_css_loader_themes()
    local decky_home = trim(utils.getenv("DECKY_HOME") or "")
    local root = decky_home ~= "" and fs.join(decky_home, "themes") or fs.join(USER_HOME, "homebrew", "themes")
    local active = json.array()
    local installed = 0
    for _, entry in ipairs(fs.list(root) or {}) do
        local folder = tostring(entry.name or "")
        if entry.is_directory and not folder:match("%.profile$") then
            installed = installed + 1
            local config = decode(read_file(fs.join(entry.path or fs.join(root, folder), "config_USER.json")))
            if type(config) == "table" and config.active == true then
                local theme = decode(read_file(fs.join(entry.path or fs.join(root, folder), "theme.json")))
                local name = type(theme) == "table" and trim(theme.name) or ""
                active[#active + 1] = name ~= "" and name:sub(1, 80) or folder:sub(1, 80)
            end
        end
    end
    table.sort(active, function(a, b) return a:lower() < b:lower() end)
    return json.encode({ active = active, installed = installed })
end

function get_display_state()
    local result = run_powershell_json([[
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$count = [System.Windows.Forms.Screen]::AllScreens.Count
[pscustomobject]@{ external = ($count -gt 1); supported = ($count -gt 0) } | ConvertTo-Json -Compress
]])
    if type(result) ~= "table" then result = { external = false, supported = false } end
    return json.encode(result)
end

function get_host_os()
    local result = run_powershell_json([[
$ErrorActionPreference = 'Stop'
$os = Get-CimInstance Win32_OperatingSystem
[pscustomobject]@{
  system = 'Windows'; name = 'Windows'; distroId = $null
  prettyName = [string]$os.Caption; version = [string]$os.Version
  machine = [string]$env:PROCESSOR_ARCHITECTURE; isSteamOS = $false
  steamosVersion = $null; supported = $true
} | ConvertTo-Json -Compress
]])
    if type(result) ~= "table" then
        result = { system = "Windows", name = "Windows", prettyName = "Windows", machine = utils.getenv("PROCESSOR_ARCHITECTURE"), isSteamOS = false, supported = true }
    end
    return json.encode(result)
end

function get_perf_snapshot()
    local result = run_powershell_json([[
$ErrorActionPreference = 'Stop'
$cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
$os = Get-CimInstance Win32_OperatingSystem
$mem = if ([double]$os.TotalVisibleMemorySize -gt 0) { [math]::Round(100.0 * [double]$os.FreePhysicalMemory / [double]$os.TotalVisibleMemorySize, 1) } else { $null }
[pscustomobject]@{
  cpuPercent = if ($null -eq $cpu) { $null } else { [math]::Round([double]$cpu, 1) }
  memAvailablePercent = $mem
  supported = ($null -ne $cpu -or $null -ne $mem)
} | ConvertTo-Json -Compress
]])
    if type(result) ~= "table" then result = { cpuPercent = nil, memAvailablePercent = nil, supported = false } end
    return json.encode(result)
end

-- Upstream's peripheral adapters use Linux bluetoothctl/wpctl. Windows has no
-- equivalent reliable connection-state API in the Millennium Lua runtime, so
-- these signals remain explicitly unsupported and therefore fail open.
function get_bluetooth_state()
    return json.encode({ paired = json.array(), connected = json.array(), supported = false })
end

function get_audio_state()
    return json.encode({ headphones = false, supported = false })
end

function get_user_home()
    return USER_HOME
end

function get_user_pictures()
    local candidates = {
        fs.join(USER_HOME, "Pictures"),
        fs.join(USER_HOME, "OneDrive", "Pictures"),
    }
    for _, path in ipairs(candidates) do
        if fs.exists(path) then return path end
    end
    return candidates[1]
end

function get_user_desktop()
    local downloads = USER_HOME .. "\\Downloads"
    if fs.exists and fs.exists(downloads) then return downloads end
    return USER_HOME .. "\\Desktop"
end

local function first_existing(paths)
    for _, path in ipairs(paths) do if path and fs.exists(path) then return path end end
    return nil
end

local function safe_json(path)
    return decode(read_file(path))
end

local function append_game(out, name, category, id)
    name = trim(name)
    if name == "" or #out >= 5000 then return end
    out[#out + 1] = { name = name, category = tostring(category or ""), id = tostring(id or name) }
end

local function rom_games(prefix, roots)
    local base = first_existing(roots)
    local out = json.array()
    if not base then return out end
    for _, system in ipairs(fs.list(base) or {}) do
        if system.is_directory then
            for _, entry in ipairs(fs.list(system.path) or {}) do
                local name = tostring(entry.name or "")
                if not entry.is_directory and name:sub(1, 1) ~= "." and not name:match("%.m3u%.txt$") and not name:match("%.bak$") then
                    local stem = tostring(fs.stem(name) or name)
                    append_game(out, stem, system.name, prefix .. ":" .. system.name .. ":" .. stem)
                end
            end
        end
    end
    return out
end

local function emudeck_games()
    return rom_games("emudeck", {
        fs.join(USER_HOME, "Emulation", "roms"),
        fs.join(USER_HOME, ".var", "app", "com.valvesoftware.Steam", "config", "EmuDeck", "roms"),
        "C:\\Emulation\\roms", "/run/media/mmcblk0p1/Emulation/roms",
    })
end

local function retrodeck_games()
    return rom_games("retrodeck", {
        fs.join(USER_HOME, "retrodeck", "roms"),
        fs.join(USER_HOME, ".var", "app", "net.retrodeck.retrodeck", "data", "retrodeck", "roms"),
        fs.join(USER_HOME, ".var", "app", "net.retrodeck.retrodeck", "config", "retrodeck", "roms"),
    })
end

local function heroic_games()
    local appdata = utils.getenv("APPDATA") or ""
    local base = first_existing({
        fs.join(USER_HOME, ".config", "heroic"),
        fs.join(USER_HOME, ".var", "app", "com.heroicgameslauncher.hgl", "config", "heroic"),
        appdata ~= "" and fs.join(appdata, "heroic") or nil,
    })
    local out = json.array()
    if not base then return out end
    local stores = {
        { "epic", "store_cache/legendary_library.json" },
        { "gog", "store_cache/gog_library.json" },
        { "amazon", "store_cache/nile_library.json" },
    }
    for _, spec in ipairs(stores) do
        local data = safe_json(fs.join(base, spec[2]))
        local library = type(data) == "table" and data.library or nil
        if type(library) == "table" then
            for _, game in ipairs(library) do
                if type(game) == "table" then
                    local title = game.title or game.app_title
                    local app_name = game.app_name or game.appName or title
                    append_game(out, title, spec[1], "heroic:" .. spec[1] .. ":" .. tostring(app_name or ""))
                end
            end
        end
    end
    return out
end

local function ini_named_hosts(paths, section_fragment, key_fragment, prefix, suffix)
    local path = first_existing(paths)
    local out = json.array()
    if not path then return out end
    local current = ""
    for line in (read_file(path) or ""):gmatch("[^\r\n]+") do
        local section = line:match("^%s*%[([^%]]+)%]")
        if section then current = section end
        local key, value = line:match("^%s*([^=]+)%s*=%s*(.-)%s*$")
        if current:lower():find(section_fragment, 1, true) and key and key:lower():find(key_fragment, 1, true) then
            value = trim(value)
            if value ~= "" then append_game(out, value .. suffix, "stream", prefix .. value) end
        end
    end
    return out
end

local function moonlight_games()
    local localapp = utils.getenv("LOCALAPPDATA") or ""
    return ini_named_hosts({
        fs.join(USER_HOME, ".config", "Moonlight Game Streaming Project", "Moonlight.conf"),
        fs.join(USER_HOME, ".var", "app", "com.moonlight_stream.Moonlight", "config", "Moonlight Game Streaming Project", "Moonlight.conf"),
        localapp ~= "" and fs.join(localapp, "Moonlight Game Streaming Project", "Moonlight.conf") or nil,
    }, "hosts_", "name", "moonlight:host:", " (Moonlight)")
end

local function chiaki_games()
    local appdata = utils.getenv("APPDATA") or ""
    local bases = {
        fs.join(USER_HOME, ".config", "Chiaki"),
        fs.join(USER_HOME, ".var", "app", "re.chiaki.Chiaki", "config", "Chiaki"),
        fs.join(USER_HOME, ".config", "chiaki-ng"),
        appdata ~= "" and fs.join(appdata, "Chiaki") or nil,
    }
    local paths = {}
    for _, base in ipairs(bases) do
        if base then
            paths[#paths + 1] = fs.join(base, "Chiaki.conf")
            paths[#paths + 1] = fs.join(base, "chiaki-ng.conf")
        end
    end
    return ini_named_hosts(paths, "registered_host", "nickname", "chiaki:host:", " (Chiaki)")
end

local function shell_quote(value)
    return '"' .. tostring(value or ""):gsub('"', '\\"') .. '"'
end

local function lutris_games()
    local db = first_existing({
        fs.join(USER_HOME, ".local", "share", "lutris", "pga.db"),
        fs.join(USER_HOME, ".var", "app", "net.lutris.Lutris", "data", "lutris", "pga.db"),
    })
    local out = json.array()
    if not db then return out end
    local command = "sqlite3 -json " .. shell_quote(db) .. " \"SELECT slug,name,runner FROM games WHERE hidden = 0 OR hidden IS NULL\""
    local ok, stdout, status = pcall(utils.exec, command)
    if not ok or tonumber(status) ~= 0 then return out end
    local rows = decode(stdout)
    if type(rows) ~= "table" then return out end
    for _, row in ipairs(rows) do append_game(out, row.name, row.runner or "lutris", "lutris:" .. tostring(row.slug or row.name or "")) end
    return out
end

local LAUNCHERS = {
    emudeck = emudeck_games, retrodeck = retrodeck_games, heroic = heroic_games,
    lutris = lutris_games, moonlight = moonlight_games, chiaki = chiaki_games,
}

local function decimal_add(a, b)
    local i, j, carry, out = #a, #b, 0, {}
    while i > 0 or j > 0 or carry > 0 do
        local da = i > 0 and tonumber(a:sub(i, i)) or 0
        local db = j > 0 and tonumber(b:sub(j, j)) or 0
        local sum = da + db + carry
        table.insert(out, 1, tostring(sum % 10))
        carry = math.floor(sum / 10)
        i, j = i - 1, j - 1
    end
    return table.concat(out)
end

local function steam_id64_from_local(community_url)
    local direct = tostring(community_url or ""):match("/profiles/(%d+)")
    if direct then return direct end
    local login = read_file(fs.join(millennium.steam_path(), "config", "loginusers.vdf")) or ""
    local recent
    for block_id, block in login:gmatch('"(%d+)"%s*(%b{})') do
        if block:match('"MostRecent"%s*"1"') then recent = block_id break end
        recent = recent or block_id
    end
    if recent then return recent end
    for _, entry in ipairs(fs.list(fs.join(millennium.steam_path(), "userdata")) or {}) do
        local account = tostring(entry.name or "")
        if entry.is_directory and account:match("^%d+$") and account ~= "0" then
            return decimal_add("76561197960265728", account)
        end
    end
    return nil
end

function get_tabmaster_tabs()
    return '{"tabs":[],"error":"not_available_on_millennium"}'
end

function list_available_launchers()
    local out = json.array()
    for _, id in ipairs({ "emudeck", "retrodeck", "heroic", "lutris", "moonlight", "chiaki" }) do
        local ok, games = pcall(LAUNCHERS[id])
        if ok and type(games) == "table" and #games > 0 then out[#out + 1] = id end
    end
    return encode_array(out)
end

function list_launcher_games(launcher_id)
    local fn = LAUNCHERS[tostring(launcher_id or "")]
    if not fn then return "[]" end
    local ok, games = pcall(fn)
    return encode_array(ok and games or {})
end

function get_wishlist(community_url)
    local steam_id64 = steam_id64_from_local(community_url)
    if not steam_id64 then return json.encode({ ok = false, error = "could not determine SteamID64" }) end
    local url = "https://api.steampowered.com/IWishlistService/GetWishlist/v1/?steamid=" .. steam_id64
    local response, err = http.get(url, {
        headers = { ["Accept"] = "application/json" }, timeout = 15,
        user_agent = "Deck-Shelves-Millennium/3.1.0", follow_redirects = true, verify_ssl = true,
    })
    if not response then return json.encode({ ok = false, error = tostring(err or "request failed") }) end
    local data = decode(response.body)
    local items = type(data) == "table" and ((data.response and data.response.items) or data.items) or nil
    if type(data) == "table" and type(data.response) == "table" and items == nil then
        return json.encode({ ok = false, error = "wishlist empty or private (no auth)" })
    end
    if type(items) ~= "table" then return json.encode({ ok = false, error = "invalid wishlist response" }) end
    local ids = json.array()
    for _, item in ipairs(items) do
        local appid = type(item) == "table" and tonumber(item.appid) or nil
        if appid then ids[#ids + 1] = math.floor(appid) end
    end
    return json.encode({ ok = true, ids = ids, count = #ids, authed = false })
end

local function on_load()
    fs.create_directories(PLUGIN_DIR)
    fs.create_directories(BACKUPS_DIR)
    local migrated = migrate_legacy_settings()
    if read_file(SETTINGS_FILE) == nil then save_state(DEFAULT_SETTINGS) end
    logger:info("Deck Shelves Millennium backend ready" .. (migrated and " (Decky settings migrated)" or ""))
    millennium.ready()
end

local function on_unload()
    logger:info("Deck Shelves Millennium backend unloaded")
end

return { on_load = on_load, on_unload = on_unload }
