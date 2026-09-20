# Test SRI Electronic Invoicing & Offline Sales API
$ErrorActionPreference = 'Stop'

Write-Host "=== 1. Obteniendo Token de Autenticacion ===" -ForegroundColor Cyan
$loginPayload = @{
    tenantId = "00000000-0000-0000-0000-000000000001"
    email = "demo@fixme.local"
    password = "password"
} | ConvertTo-Json

$loginRes = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method POST -Body $loginPayload -ContentType "application/json"
$token = $loginRes.accessToken
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

Write-Host "Token obtenido correctamente." -ForegroundColor Green

Write-Host "`n=== 2. Consultar Configuracion SRI ===" -ForegroundColor Cyan
$sriConfig = Invoke-RestMethod -Uri "http://localhost:8080/api/sri/config" -Method GET -Headers $headers
Write-Host ("RUC: " + $sriConfig.ruc)
Write-Host ("Razon Social: " + $sriConfig.razonSocial)
Write-Host ("Establecimiento: " + $sriConfig.codigoEstablecimiento + " - Pto Emision: " + $sriConfig.codigoPuntoEmision)
Write-Host ("Secuencial Factura: " + $sriConfig.secuencialFactura)
Write-Host ("Ambiente SRI: " + $sriConfig.ambienteSri)

Write-Host "`n=== 3. Venta 1: Ticket Interno (Sin Declarar IVA / Sin Factura SRI) ===" -ForegroundColor Cyan
# Obtener un producto
$products = Invoke-RestMethod -Uri "http://localhost:8080/api/products?branchId=00000000-0000-0000-0000-000000000010" -Method GET -Headers $headers
if ($products.Count -eq 0) {
    Write-Host "No hay productos para probar venta." -ForegroundColor Yellow
} else {
    $prod = ($products | Where-Object { $_.stock -gt 5 } | Select-Object -First 1)
    if (-not $prod) { $prod = $products[0] }
    Write-Host ("Producto seleccionado: " + $prod.name + " (Stock: " + $prod.stock + ", Precio: " + $prod.price + ")")
    $saleTicketPayload = @{
        branchId = "00000000-0000-0000-0000-000000000010"
        customerId = $null
        warrantyDays = 0
        channel = "STORE"
        fulfillmentType = "PICKUP"
        items = @(
            @{ productId = $prod.id; quantity = 1 }
        )
        payments = @(
            @{ method = "CASH"; amount = $prod.price }
        )
        invoiceType = "INTERNAL_TICKET"
        offlineFolio = $null
    } | ConvertTo-Json

    try {
        $ticketSale = Invoke-RestMethod -Uri "http://localhost:8080/api/sales" -Method POST -Body $saleTicketPayload -Headers $headers
        Write-Host ("Venta Ticket Interno Creada: ID " + $ticketSale.id) -ForegroundColor Green
        Write-Host ("Tipo de Comprobante: " + $ticketSale.invoiceType)
        Write-Host ("Tiene Factura Electronica SRI?: " + ($ticketSale.electronicInvoice -ne $null))
    } catch {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host ("Error body: " + $reader.ReadToEnd()) -ForegroundColor Red
        throw $_
    }
}

Write-Host "`n=== 4. Venta 2: Factura Electronica Oficial SRI ===" -ForegroundColor Cyan
if ($prod) {
    $saleSriPayload = @{
        branchId = "00000000-0000-0000-0000-000000000010"
        customerId = $null
        warrantyDays = 30
        channel = "STORE"
        fulfillmentType = "PICKUP"
        items = @(
            @{ productId = $prod.id; quantity = 1 }
        )
        payments = @(
            @{ method = "CASH"; amount = $prod.price }
        )
        invoiceType = "SRI_INVOICE"
        offlineFolio = $null
    } | ConvertTo-Json

    $sriSale = Invoke-RestMethod -Uri "http://localhost:8080/api/sales" -Method POST -Body $saleSriPayload -Headers $headers
    Write-Host ("Venta con Factura SRI Creada: ID " + $sriSale.id) -ForegroundColor Green
    Write-Host ("Numero de Factura: " + $sriSale.invoiceNumber) -ForegroundColor Green
    Write-Host ("Clave de Acceso (49 digitos): " + $sriSale.accessKey) -ForegroundColor Green
    Write-Host ("Estado SRI: " + $sriSale.sriStatus) -ForegroundColor Green
    $sriInvId = $sriSale.electronicInvoice.id

    if ($sriInvId) {
        Write-Host "`n=== 5. Descargar XML Oficial Factura SRI ===" -ForegroundColor Cyan
        $xmlRes = Invoke-RestMethod -Uri "http://localhost:8080/api/sri/invoices/$sriInvId/xml" -Method GET -Headers $headers
        $xmlStr = if ($xmlRes -is [System.Xml.XmlDocument]) { $xmlRes.OuterXml } else { [string]$xmlRes }
        Write-Host "XML obtenido con exito (primeros 250 caracteres):" -ForegroundColor Green
        Write-Host ($xmlStr.Substring(0, [Math]::Min(250, $xmlStr.Length)))
    }
}

Write-Host "`n=== 6. Venta 3: Sincronizacion Offline (Batch Sync) ===" -ForegroundColor Cyan
if ($prod) {
    $offlineFolio = "OFF-" + (Get-Random -Minimum 100000 -Maximum 999999)
    $singleItem = @{
        branchId = "00000000-0000-0000-0000-000000000010"
        customerId = $null
        warrantyDays = 0
        channel = "STORE"
        fulfillmentType = "PICKUP"
        items = @(
            @{ productId = $prod.id; quantity = 1 }
        )
        payments = @(
            @{ method = "CASH"; amount = $prod.price }
        )
        invoiceType = "INTERNAL_TICKET"
        offlineFolio = $offlineFolio
    } | ConvertTo-Json
    $offlineBatchPayload = "[" + $singleItem + "]"

    $syncRes = Invoke-RestMethod -Uri "http://localhost:8080/api/sales/sync-offline" -Method POST -Body $offlineBatchPayload -Headers $headers
    Write-Host ("Sincronizacion completada: " + $syncRes.syncedCount + " sincronizadas, " + $syncRes.failedCount + " fallidas.") -ForegroundColor Green
    Write-Host ("Folio sincronizado: " + $syncRes.synced[0].offlineFolio + " -> Sale ID: " + $syncRes.synced[0].id)
}

Write-Host "`n=== 7. Venta 4: Facturacion Retroactiva SRI desde un Ticket Interno ===" -ForegroundColor Cyan
if ($ticketSale -and $ticketSale.id) {
    $retroRes = Invoke-RestMethod -Uri ("http://localhost:8080/api/sri/invoices/from-sale/" + $ticketSale.id) -Method POST -Headers $headers
    Write-Host ("Factura emitida retroactivamente desde Ticket " + $ticketSale.id) -ForegroundColor Green
    Write-Host ("Numero de Factura: " + $retroRes.numero_completo) -ForegroundColor Green
    Write-Host ("Clave de Acceso: " + $retroRes.clave_acceso) -ForegroundColor Green
    Write-Host ("Estado SRI: " + $retroRes.estado_sri) -ForegroundColor Green
}

Write-Host "`n=== TODOS LOS TESTS SRI & OFFLINE COMPLETADOS CON EXITO ===" -ForegroundColor Green
