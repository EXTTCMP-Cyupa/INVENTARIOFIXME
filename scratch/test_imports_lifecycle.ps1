$ErrorActionPreference = 'Stop'

Write-Host "=== TEST E2E: CICLO DE VIDA DE IMPORTACIONES Y CATALOGO ==="

# 1. Login
$loginBody = @{
    tenantId = "00000000-0000-0000-0000-000000000001"
    email    = "demo@fixme.local"
    password = "password"
} | ConvertTo-Json

Write-Host "1. Autenticando usuario admin..."
$authResp = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
$token = $authResp.accessToken
$headers = @{ Authorization = "Bearer $token" }
Write-Host "   OK Token obtenido."

# 2. Get categories
$categories = Invoke-RestMethod -Uri "http://localhost:8080/api/categories" -Method Get -Headers $headers
$targetCategory = if ($categories.Count -gt 0) { $categories[0].id } else { $null }
Write-Host "   Categoria destino ID: $targetCategory"

$uniqueSuffix = Get-Random -Minimum 1000 -Maximum 9999
$testSku = "MBP-M3M-$uniqueSuffix"
$testTracking = "1Z-TRK-$uniqueSuffix"

# 3. Create shipment with integrated product
$createShipmentBody = @{
    title = "Lote MacBook Pro M3 Max $uniqueSuffix"
    trackingNumber = $testTracking
    courierName = "Servientrega Box"
    originStore = "Apple Refurbished"
    stage = "PURCHASED"
    weightLbs = 5.2
    originCost = 1800.00
    freightCost = 60.00
    estimatedFreightCost = 60.00
    customsCost = 140.00
    estimatedCustomsCost = 140.00
    estimatedArrivalDate = "2026-10-30"
    notes = "Prueba de importacion automatizada"
    productName = "MacBook Pro M3 Max Silver $uniqueSuffix"
    sku = $testSku
    quantity = 1
    preorderPrice = 2200.00
    regularPrice = 2400.00
    targetCategoryId = $targetCategory
    isPublicCatalog = $true
} | ConvertTo-Json

Write-Host "2. Creando envio de importacion con producto integrado..."
$shipment = Invoke-RestMethod -Uri "http://localhost:8080/api/imports/shipments" -Method Post -ContentType "application/json" -Headers $headers -Body $createShipmentBody
Write-Host "   Envio creado ID: $($shipment.id), Titulo: $($shipment.title)"
Write-Host "   Items en el envio: $($shipment.items.Count)"
if ($shipment.items.Count -eq 0) {
    throw "ERROR: El envio no creo el producto automaticamente"
}
$createdItem = $shipment.items[0]
Write-Host "   Producto: $($createdItem.product_name), Costo Landed: $($createdItem.unit_landed_cost), Precio Preventa: $($createdItem.preorder_price)"

# 4. Check Public Catalog (should NOT be in arrivingProducts because stage is PURCHASED)
$catalog0 = Invoke-RestMethod -Uri "http://localhost:8080/api/public/catalog/00000000-0000-0000-0000-000000000001" -Method Get
$inArriving0 = $catalog0.arrivingProducts | Where-Object { $_.sku -eq $testSku }
Write-Host "   Visible en Proximos Arribos en PURCHASED: $(if ($inArriving0) { 'SI (Incorrecto)' } else { 'NO (Correcto)' })"
if ($inArriving0) {
    throw "ERROR: No deberia ser visible en el catalogo durante PURCHASED"
}

# 5. Advance to IN_TRANSIT with actual courier freight cost (65.00)
Write-Host "3. Avanzando a IN_TRANSIT con flete courier real confirmatorio de 65.00..."
$advanceTransitBody = @{
    stage = "IN_TRANSIT"
    actualFreightCost = 65.00
} | ConvertTo-Json

$shipmentTransit = Invoke-RestMethod -Uri "http://localhost:8080/api/imports/shipments/$($shipment.id)/stage" -Method Patch -ContentType "application/json" -Headers $headers -Body $advanceTransitBody
Write-Host "   Nueva etapa: $($shipmentTransit.stage), Flete real: $($shipmentTransit.actual_freight_cost), Costo Total: $($shipmentTransit.total_landed_cost)"

# 6. Check Public Catalog (MUST be in arrivingProducts now!)
$catalog1 = Invoke-RestMethod -Uri "http://localhost:8080/api/public/catalog/00000000-0000-0000-0000-000000000001" -Method Get
$inArriving1 = $catalog1.arrivingProducts | Where-Object { $_.sku -eq $testSku }
if (-not $inArriving1) {
    throw "ERROR: El producto no aparecio en 'Proximos Arribos' en IN_TRANSIT"
}
Write-Host "   OK: Visible en Proximos Arribos con precio de preventa: $($inArriving1.price)"

# 7. Advance to ARRIVED_LOCAL with actual customs fee (145.00) and inventory insertion
Write-Host "4. Avanzando a ARRIVED_LOCAL con aduana liquidada de 145.00 e ingreso a inventario..."
$advanceLocalBody = @{
    stage = "ARRIVED_LOCAL"
    actualCustomsCost = 145.00
    targetCategoryId = $targetCategory
    regularPrice = 2400.00
    importToInventory = "true"
} | ConvertTo-Json

$shipmentLocal = Invoke-RestMethod -Uri "http://localhost:8080/api/imports/shipments/$($shipment.id)/stage" -Method Patch -ContentType "application/json" -Headers $headers -Body $advanceLocalBody
Write-Host "   Etapa final: $($shipmentLocal.stage), Costo Landed Total: $($shipmentLocal.total_landed_cost)"

# 8. Check Public Catalog (should be removed from arriving and added to regular products with stock 1!)
$catalog2 = Invoke-RestMethod -Uri "http://localhost:8080/api/public/catalog/00000000-0000-0000-0000-000000000001" -Method Get
$inArriving2 = $catalog2.arrivingProducts | Where-Object { $_.sku -eq $testSku }
$inRegular2 = $catalog2.products | Where-Object { $_.sku -eq $testSku }

Write-Host "   Retirado de Proximos Arribos: $(if (-not $inArriving2) { 'SI (Correcto)' } else { 'NO (Incorrecto)' })"
if ($inArriving2) {
    throw "ERROR: Deberia haberse retirado de Proximos Arribos tras llegar a bodega local"
}

if (-not $inRegular2) {
    throw "ERROR: El producto no aparecio en los productos regulares con stock disponible"
}
Write-Host "   OK: Producto creado en Inventario con Stock: $($inRegular2.stock), Precio: $($inRegular2.price)"

Write-Host "`n=== RESULTADO: TODOS LOS TESTS PASARON CON EXITO ==="

