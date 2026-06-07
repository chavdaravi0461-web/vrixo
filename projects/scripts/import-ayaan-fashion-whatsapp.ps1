param(
  [string]$ZipPath = "C:\Users\PC\NMM\WhatsApp Chat with AYAAN FASHION.zip",
  [string]$ApprovedGroupsPath = "",
  [string]$ReportPath = "docs\AYAAN_FASHION_IMPORT_REPORT.md",
  [string]$ProductDataPath = "src\data\product.ts",
  [string]$PublicImageDir = "public\products\ayaan-fashion",
  [string]$EnvPath = ".env.local",
  [int]$DefaultPrice = 0,
  [switch]$AdminImageOnly,
  [switch]$Apply
)

$ErrorActionPreference = "Stop"

function Read-ZipText {
  param([System.IO.Compression.ZipArchive]$Zip)

  $entry = $Zip.Entries | Where-Object { $_.FullName -like "*.txt" } | Select-Object -First 1
  if (-not $entry) {
    throw "No chat .txt file found in ZIP."
  }

  $reader = [System.IO.StreamReader]::new($entry.Open())
  try {
    return $reader.ReadToEnd()
  } finally {
    $reader.Dispose()
  }
}

function Get-ZipImages {
  param([System.IO.Compression.ZipArchive]$Zip)

  return @(
    $Zip.Entries |
      Where-Object { $_.FullName -match "\.(jpg|jpeg|png|webp)$" } |
      Sort-Object FullName |
      ForEach-Object {
        [pscustomobject]@{
          name = $_.FullName
          length = $_.Length
        }
      }
  )
}

function Remove-ChatPrefix {
  param([string]$Line)

  return ($Line -replace "^\d{2}/\d{2}/\d{2},\s+\d{2}:\d{2}\s+-\s+[^:]+:\s*", "").Trim()
}

function Normalize-Text {
  param([string]$Value)

  $clean = $Value `
    -replace "[*_`~]", "" `
    -replace "<Media omitted>", "" `
    -replace "\(file attached\)", "" `
    -replace "[\u2714\ufe0f\ud83c-\udfff]", "" `
    -replace "\s+", " "

  return $clean.Trim()
}

function Find-Price {
  param([string]$Text)

  $patterns = @(
    "(?i)(?:rs|price|@)\s*[\.:/-]*\s*([0-9][0-9,]{1,7})\s*/?-?",
    "(?i)([0-9][0-9,]{2,7})\s*/-\s*(?:only|free|$)"
  )

  foreach ($pattern in $patterns) {
    $match = [regex]::Match($Text, $pattern)
    if ($match.Success) {
      return [int](($match.Groups[1].Value) -replace ",", "")
    }
  }

  return $null
}

function Get-Brand {
  param([string]$Title)

  $brands = @("Under Armour", "Asics", "Dior", "Nike", "Jordan", "ON", "Adidas")
  foreach ($brand in $brands) {
    if ($Title -match [regex]::Escape($brand)) {
      return $brand
    }
  }

  return "AYAAN FASHION"
}

function Get-Slug {
  param([string]$Value)

  $slug = $Value.ToLowerInvariant() -replace "[^a-z0-9]+", "-"
  return ($slug -replace "^-+|-+$", "")
}

function Read-DotEnv {
  param([string]$Path)

  if (-not (Test-Path -Path $Path)) {
    throw "Environment file not found: $Path"
  }

  $env = @{}
  foreach ($line in Get-Content -Path $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#") -or $trimmed -notmatch "=") {
      continue
    }

    $parts = $trimmed.Split("=", 2)
    $name = $parts[0].Trim()
    $value = $parts[1].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $env[$name] = $value
  }

  return $env
}

function Invoke-SupabaseRest {
  param(
    [hashtable]$Env,
    [string]$Method,
    [string]$Path,
    [object]$Body = $null,
    [hashtable]$ExtraHeaders = @{}
  )

  $baseUrl = $Env["NEXT_PUBLIC_SUPABASE_URL"].TrimEnd("/")
  $serviceKey = $Env["SUPABASE_SERVICE_ROLE_KEY"]
  if (-not $baseUrl -or -not $serviceKey) {
    throw "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
  }

  $headers = @{
    apikey = $serviceKey
    Authorization = "Bearer $serviceKey"
  }

  foreach ($key in $ExtraHeaders.Keys) {
    $headers[$key] = $ExtraHeaders[$key]
  }

  $uri = "$baseUrl$Path"
  try {
    if ($Body -ne $null) {
      $json = $Body | ConvertTo-Json -Depth 20
      return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -ContentType "application/json" -Body $json
    }

    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
  } catch {
    $response = $_.Exception.Response
    $bodyText = ""
    if ($response -and $response.GetResponseStream()) {
      $reader = [System.IO.StreamReader]::new($response.GetResponseStream())
      try {
        $bodyText = $reader.ReadToEnd()
      } finally {
        $reader.Dispose()
      }
    }
    throw "Supabase REST request failed for $Path. $bodyText"
  }
}

function Upload-StorageImage {
  param(
    [System.IO.Compression.ZipArchiveEntry]$Entry,
    [hashtable]$Env,
    [string]$Slug
  )

  $baseUrl = $Env["NEXT_PUBLIC_SUPABASE_URL"].TrimEnd("/")
  $serviceKey = $Env["SUPABASE_SERVICE_ROLE_KEY"]
  $bucket = "product-images"
  $extension = [System.IO.Path]::GetExtension($Entry.FullName).TrimStart(".").ToLowerInvariant()
  if ($extension -eq "jpeg") {
    $extension = "jpg"
  }
  $contentType = switch ($extension) {
    "png" { "image/png" }
    "webp" { "image/webp" }
    default { "image/jpeg" }
  }

  $objectPath = "products/$Slug/$Slug-$([guid]::NewGuid().ToString()).$extension"
  $tempPath = Join-Path ([System.IO.Path]::GetTempPath()) "$([guid]::NewGuid().ToString()).$extension"

  try {
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($Entry, $tempPath, $true)
    $headers = @{
      apikey = $serviceKey
      Authorization = "Bearer $serviceKey"
      "x-upsert" = "false"
    }
    $uri = "$baseUrl/storage/v1/object/$bucket/$objectPath"
    Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType $contentType -InFile $tempPath | Out-Null
    return "$baseUrl/storage/v1/object/public/$bucket/$objectPath"
  } finally {
    if (Test-Path -Path $tempPath) {
      Remove-Item -Path $tempPath -Force
    }
  }
}

function Get-ExistingAyaanCount {
  param([hashtable]$Env)

  $rows = Invoke-SupabaseRest -Env $Env -Method Get -Path "/rest/v1/products?select=sku&sku=like.AYF-%25"
  $max = 0
  foreach ($row in @($rows)) {
    if ($row.sku -match "^AYF-(\d+)$") {
      $max = [Math]::Max($max, [int]$Matches[1])
    }
  }
  return $max
}

function Import-AdminImageOnly {
  param(
    [System.IO.Compression.ZipArchive]$Zip,
    [object[]]$Images,
    [int]$Price
  )

  if ($Price -le 0) {
    throw "-DefaultPrice must be greater than 0 for -AdminImageOnly."
  }

  $env = Read-DotEnv -Path $EnvPath
  $start = (Get-ExistingAyaanCount -Env $env) + 1
  $imported = 0
  $skipped = 0

  for ($i = 0; $i -lt $Images.Count; $i += 1) {
    $index = $start + $i
    $sku = "AYF-{0:d3}" -f $index
    $title = "AYAAN Fashion Shoes {0:d3}" -f $index
    $slug = "$(Get-Slug $title)-$($sku.ToLowerInvariant())"
    $existing = Invoke-SupabaseRest -Env $env -Method Get -Path "/rest/v1/products?select=id&sku=eq.$sku"
    if (@($existing).Count -gt 0) {
      $skipped += 1
      continue
    }

    $entry = $Zip.Entries | Where-Object { $_.FullName -eq $Images[$i].name } | Select-Object -First 1
    if (-not $entry) {
      throw "Image '$($Images[$i].name)' not found in ZIP."
    }

    $imageUrl = Upload-StorageImage -Entry $entry -Env $env -Slug $slug
    $product = @{
      title = $title
      slug = $slug
      category = "shoes"
      subcategory = "Sports Shoes"
      brand = "AYAAN FASHION"
      short_description = "AYAAN FASHION product image imported from WhatsApp catalog."
      full_description = "AYAAN FASHION product image imported from WhatsApp catalog."
      price = $Price
      original_price = $Price
      discount_percent = 0
      currency = "INR"
      stock = 25
      sku = $sku
      sizes = @("41", "42", "43", "44", "45")
      colors = @()
      images = @($imageUrl)
      featured = $false
      bestseller = $false
      new_arrival = $true
      status = "active"
      specifications = @{
        Source = "WhatsApp AYAAN FASHION"
        Collection = "Sports Shoes"
        Import = "Admin image-only import"
      }
    }

    Invoke-SupabaseRest -Env $env -Method Post -Path "/rest/v1/products" -Body @($product) -ExtraHeaders @{ Prefer = "return=minimal" } | Out-Null
    $imported += 1
  }

  return [pscustomobject]@{
    imported = $imported
    skipped = $skipped
    price = $Price
  }
}

function Get-Candidates {
  param([string]$Text)

  $candidates = New-Object System.Collections.Generic.List[object]
  $currentImages = New-Object System.Collections.Generic.List[string]
  $currentText = New-Object System.Collections.Generic.List[string]
  $candidateNumber = 1

  foreach ($rawLine in ($Text -split "`r?`n")) {
    $line = Normalize-Text (Remove-ChatPrefix $rawLine)
    if (-not $line) {
      continue
    }

    $imageMatch = [regex]::Match($line, "(IMG-[0-9A-Z-]+\.(?:jpg|jpeg|png|webp))", "IgnoreCase")
    if ($imageMatch.Success) {
      $currentImages.Add($imageMatch.Groups[1].Value)
      continue
    }

    if ($line -match "This chat has added privacy|created community|All New Collection|Super Quality|For Best Price Ping Me") {
      continue
    }

    $currentText.Add($line)

    $joinedText = (($currentText.ToArray()) -join " ").Trim()
    if ($joinedText.Length -gt 0) {
      $price = Find-Price $joinedText
      $title = ($joinedText -replace "(?i)\b(1st Time In India|With OG Box Packing|With OG Box|Trending Model|Live Picture|Restock On Demand)\b", "" -replace "\s+", " ").Trim(" -()")
      if ($title.Length -gt 120) {
        $title = $title.Substring(0, 120).Trim()
      }

      $candidates.Add([pscustomobject]@{
        id = "candidate-{0:d3}" -f $candidateNumber
        title = $title
        price = $price
        images = @($currentImages.ToArray())
        sourceText = $joinedText
        skipReason = $(if ($price -eq $null) { "missing_price" } elseif ($currentImages.Count -eq 0) { "missing_image" } else { "" })
      })

      $candidateNumber += 1
      $currentImages.Clear()
      $currentText.Clear()
    }
  }

  if ($currentImages.Count -gt 0 -or $currentText.Count -gt 0) {
    $joinedText = (($currentText.ToArray()) -join " ").Trim()
    $candidates.Add([pscustomobject]@{
      id = "candidate-{0:d3}" -f $candidateNumber
      title = $(if ($joinedText) { $joinedText } else { "Ungrouped media" })
      price = Find-Price $joinedText
      images = @($currentImages.ToArray())
      sourceText = $joinedText
      skipReason = "manual_grouping_required"
    })
  }

  return @($candidates.ToArray())
}

function Write-Report {
  param(
    [object[]]$Candidates,
    [object[]]$Images,
    [int]$ImportedCount,
    [string]$Mode,
    [int]$DefaultPrice,
    [string]$Path
  )

  $priced = @($Candidates | Where-Object { $_.price -ne $null -and $_.images.Count -gt 0 })
  $skipped = @($Candidates | Where-Object { $_.price -eq $null -or $_.images.Count -eq 0 -or $_.skipReason })
  $lines = New-Object System.Collections.Generic.List[string]

  $lines.Add("# AYAAN FASHION Import Report")
  $lines.Add("")
  $lines.Add("- Source ZIP: ``$ZipPath``")
  $lines.Add("- Images in ZIP: $($Images.Count)")
  $lines.Add("- Product candidates found: $($Candidates.Count)")
  $lines.Add("- Priced candidates eligible for import: $($priced.Count)")
  $lines.Add("- Products imported this run: $ImportedCount")
  $lines.Add("- Mode: $Mode")
  $lines.Add("- Default price: $DefaultPrice")
  $lines.Add("- Rule: skip candidates without a numeric price unless admin image-only mode is used")
  $lines.Add("")
  $lines.Add("## Skipped / Review Candidates")
  $lines.Add("")

  foreach ($candidate in $skipped) {
    $priceText = if ($candidate.price -eq $null) { "missing" } else { $candidate.price }
    $reason = if ($candidate.skipReason) { $candidate.skipReason } else { "needs_manual_review" }
    $imageText = if ($candidate.images.Count -gt 0) { ($candidate.images -join ", ") } else { "none" }
    $lines.Add("### $($candidate.id)")
    $lines.Add("- Title: $($candidate.title)")
    $lines.Add("- Price: $priceText")
    $lines.Add("- Images: $imageText")
    $lines.Add("- Reason: $reason")
    $lines.Add("")
  }

  $lines.Add("## Approved Groups JSON Shape")
  $lines.Add("")
  $lines.Add("Use this shape with ``-ApprovedGroupsPath`` and ``-Apply`` after prices/grouping are confirmed, or use ``-AdminImageOnly -DefaultPrice 1999`` to create one product per image through Supabase admin catalog storage.")
  $lines.Add("")
  $lines.Add('```json')
  $lines.Add("[")
  $lines.Add("  {")
  $lines.Add("    ""title"": ""Product title"",")
  $lines.Add("    ""price"": 1499,")
  $lines.Add("    ""images"": [""IMG-20260528-WA0001.jpg""],")
  $lines.Add("    ""sizes"": [""41"", ""42"", ""43"", ""44"", ""45""],")
  $lines.Add("    ""subcategory"": ""Sports Shoes""")
  $lines.Add("  }")
  $lines.Add("]")
  $lines.Add('```')
  $lines.Add("")

  $directory = Split-Path -Parent $Path
  if ($directory) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }
  Set-Content -Path $Path -Value $lines -Encoding UTF8
}

function ConvertTo-ProductEntry {
  param(
    [pscustomobject]$Group,
    [int]$Index
  )

  $sku = "AYF-{0:d3}" -f $Index
  $id = "ayaan-{0:d3}" -f $Index
  $slug = "$(Get-Slug $Group.title)-$($sku.ToLowerInvariant())"
  $price = [int]$Group.price
  $imagePaths = @($Group.images | ForEach-Object { "/products/ayaan-fashion/$_" })
  $sizes = @($Group.sizes | ForEach-Object { """$_""" }) -join ", "
  $images = @($imagePaths | ForEach-Object { "      ""$_""" }) -join ",`r`n"
  $brand = Get-Brand $Group.title
  $subcategory = if ($Group.subcategory) { $Group.subcategory } else { "Sports Shoes" }
  $now = "2026-05-28T00:00:00.000Z"
  $safeTitle = ($Group.title -replace '"', '\"')

  return @"
  {
    id: "$id",
    slug: "$slug",
    title: "$safeTitle",
    category: "shoes",
    subcategory: "$subcategory",
    brand: "$brand",
    shortDescription: "$safeTitle",
    fullDescription: "$safeTitle",
    price: $price,
    originalPrice: $price,
    discountPercent: 0,
    currency: "INR",
    stock: 25,
    sku: "$sku",
    sizes: [$sizes],
    colors: [],
    images: [
$images
    ],
    featured: false,
    bestseller: false,
    newArrival: true,
    highlighted: false,
    rating: 4.4,
    reviewCount: 0,
    specifications: {
      Source: "WhatsApp AYAAN FASHION",
      Collection: "$subcategory",
      Shipping: "Contact seller"
    },
    createdAt: "$now",
    updatedAt: "$now"
  }
"@
}

function Apply-Groups {
  param(
    [System.IO.Compression.ZipArchive]$Zip,
    [object[]]$Groups
  )

  if (-not $Groups -or $Groups.Count -eq 0) {
    return 0
  }

  $validGroups = @($Groups | Where-Object {
    $_.title -and $_.price -and ([int]$_.price) -gt 0 -and $_.images -and $_.images.Count -gt 0
  })

  if ($validGroups.Count -eq 0) {
    return 0
  }

  New-Item -ItemType Directory -Force -Path $PublicImageDir | Out-Null

  foreach ($group in $validGroups) {
    foreach ($image in $group.images) {
      $entry = $Zip.Entries | Where-Object { $_.FullName -eq $image } | Select-Object -First 1
      if (-not $entry) {
        throw "Approved image '$image' not found in ZIP."
      }
      $target = Join-Path $PublicImageDir $image
      [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
    }
  }

  $existing = Get-Content -Path $ProductDataPath -Raw
  $start = 1
  $existingMatches = [regex]::Matches($existing, 'id:\s*"ayaan-(\d+)"')
  if ($existingMatches.Count -gt 0) {
    $start = (($existingMatches | ForEach-Object { [int]$_.Groups[1].Value } | Measure-Object -Maximum).Maximum) + 1
  }

  $entries = New-Object System.Collections.Generic.List[string]
  for ($i = 0; $i -lt $validGroups.Count; $i += 1) {
    $entries.Add((ConvertTo-ProductEntry -Group $validGroups[$i] -Index ($start + $i)))
  }

  $insert = ",`r`n" + (($entries.ToArray()) -join ",`r`n") + "`r`n];"
  $updated = [regex]::Replace($existing, "\r?\n\];\s*$", $insert)
  Set-Content -Path $ProductDataPath -Value $updated -Encoding UTF8

  return $validGroups.Count
}

if (-not (Test-Path -LiteralPath $ZipPath)) {
  throw "ZIP file not found: $ZipPath"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
try {
  $text = Read-ZipText $zip
  $images = Get-ZipImages $zip
  $candidates = Get-Candidates $text
  $importedCount = 0

  if ($Apply) {
    if (-not $ApprovedGroupsPath) {
      throw "-Apply requires -ApprovedGroupsPath."
    }
    $groups = Get-Content -Path $ApprovedGroupsPath -Raw | ConvertFrom-Json
    $importedCount = Apply-Groups -Zip $zip -Groups @($groups)
  }

  if ($AdminImageOnly) {
    $adminResult = Import-AdminImageOnly -Zip $zip -Images $images -Price $DefaultPrice
    $importedCount = $adminResult.imported
  }

  $mode = if ($AdminImageOnly) { "admin-image-only" } elseif ($Apply) { "approved-static-catalog" } else { "report-only" }
  Write-Report -Candidates $candidates -Images $images -ImportedCount $importedCount -Mode $mode -DefaultPrice $DefaultPrice -Path $ReportPath

  Write-Output "AYAAN FASHION import workflow completed."
  Write-Output "Candidates: $($candidates.Count)"
  Write-Output "Images in ZIP: $($images.Count)"
  Write-Output "Imported: $importedCount"
  Write-Output "Report: $ReportPath"
} finally {
  $zip.Dispose()
}
