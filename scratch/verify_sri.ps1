function New-JwtToken {
    param(
        [string]$secret = "change-me-in-production-use-32-bytes-minimum",
        [string]$tenantId = "1ddc54a4-a805-49b1-bf24-ad9a864e5499",
        [string]$userId = "eb353305-2b5b-4234-9e86-1b2c38594d61",
        [string]$email = "eli@eli.com"
    )

    $header = @{
        alg = "HS256"
        typ = "JWT"
    } | ConvertTo-Json -Compress
    
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $exp = $now + 28800
    
    $payload = @{
        iss = "fixmetiendas"
        sub = $email
        iat = $now
        exp = $exp
        tenant_id = $tenantId
        user_id = $userId
        scope = "MANAGER SELLER TECHNICIAN DELIVERY ACCOUNTANT"
        roles = @("MANAGER", "SELLER")
        primary_role = "MANAGER"
    } | ConvertTo-Json -Compress

    function Base64UrlEncode([byte[]]$bytes) {
        return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    }

    $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($header)
    $payloadBytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
    
    $part1 = Base64UrlEncode $headerBytes
    $part2 = Base64UrlEncode $payloadBytes
    $stringToSign = "$part1.$part2"

    $keyBytes = [System.Text.Encoding]::UTF8.GetBytes($secret)
    $hmac = New-Object System.Security.Cryptography.HMACSHA256
    $hmac.Key = $keyBytes
    $signatureBytes = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($stringToSign))
    $part3 = Base64UrlEncode $signatureBytes

    return "$stringToSign.$part3"
}

$token = New-JwtToken
Write-Output "Generated JWT token for tenant Eli: $($token.Substring(0, 30))..."

$headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
}

# 1. Test GET /api/sri/config
Write-Output "`nTesting GET /api/sri/config..."
$cfg = Invoke-RestMethod -Uri "http://localhost:8080/api/sri/config" -Method Get -Headers $headers
Write-Output "Config RUC: $($cfg.ruc), RazonSocial: $($cfg.razonSocial), Secuencial: $($cfg.secuencialFactura)"

# 2. Test POST /api/sri/invoices/from-sale/109d4114-b210-476d-b839-4cfb66ec7e05
Write-Output "`nTesting issueInvoiceFromSale for sale 109d4114-b210-476d-b839-4cfb66ec7e05..."
try {
    $inv = Invoke-RestMethod -Uri "http://localhost:8080/api/sri/invoices/from-sale/109d4114-b210-476d-b839-4cfb66ec7e05" -Method Post -Headers $headers
    Write-Output "SUCCESS!! Factura SRI emitida:"
    Write-Output "  ID: $($inv.id)"
    Write-Output "  Nro Completo: $($inv.numero_completo)"
    Write-Output "  Clave Acceso: $($inv.clave_acceso)"
    Write-Output "  Estado SRI: $($inv.estado_sri)"
    Write-Output "  Emisor: $($inv.emisor_razon_social)"
} catch {
    Write-Output "ERROR: $_"
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Output "Response body: $($reader.ReadToEnd())"
    }
}

# 3. Test GET /api/sales to verify electronic_invoice_id is populated
Write-Output "`nTesting GET /api/sales..."
$sales = Invoke-RestMethod -Uri "http://localhost:8080/api/sales" -Method Get -Headers $headers
$targetSale = $sales | Where-Object { $_.id -eq "109d4114-b210-476d-b839-4cfb66ec7e05" }
Write-Output "Sale 109d4114 electronic_invoice_id: $($targetSale.electronic_invoice_id)"
Write-Output "Sale 109d4114 invoice_number: $($targetSale.invoice_number)"
Write-Output "Sale 109d4114 invoice_sri_status: $($targetSale.invoice_sri_status)"

# 4. Test GET /api/sri/invoices/{id}
Write-Output "`nTesting GET /api/sri/invoices/$($inv.id)..."
$rideData = Invoke-RestMethod -Uri "http://localhost:8080/api/sri/invoices/$($inv.id)" -Method Get -Headers $headers
Write-Output "RIDE detail OK: Emisor=$($rideData.emisor_razon_social), Cliente=$($rideData.cliente_razon_social), Items count=$($rideData.items.Count)"

# 5. Test GET /api/sri/invoices (list)
Write-Output "`nTesting GET /api/sri/invoices..."
$invList = Invoke-RestMethod -Uri "http://localhost:8080/api/sri/invoices" -Method Get -Headers $headers
Write-Output "Total SRI invoices in list: $($invList.Count)"

