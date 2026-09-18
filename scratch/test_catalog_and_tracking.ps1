# Verification script for Digital Catalog and Live Delivery Tracking
$ErrorActionPreference = "Continue"

Write-Host "=== 1. Testing GET /api/public/catalog/{tenantId} ===" -ForegroundColor Cyan
$tenantId = "00000000-0000-0000-0000-000000000001"

try {
    $catResp = Invoke-RestMethod -Uri "http://localhost:8080/api/public/catalog/$tenantId" -Method GET
    Write-Host "Catalog Store Name: " $catResp.storeName -ForegroundColor Green
    Write-Host "Catalog WhatsApp:   " $catResp.catalogWhatsapp -ForegroundColor Green
    Write-Host "Total Products:     " $catResp.products.Count -ForegroundColor Green
    if ($catResp.products.Count -gt 0) {
        $p = $catResp.products[0]
        Write-Host "Sample Product:     $($p.name) - `$$($p.price) (Stock: $($p.stock))" -ForegroundColor Gray
    }
} catch {
    Write-Host "Error fetching catalog: $_" -ForegroundColor Red
}

Write-Host "`n=== 2. Testing POST /api/public/catalog/{tenantId}/order (Delivery Order) ===" -ForegroundColor Cyan
try {
    # Pick first product from catalog
    if ($catResp.products.Count -gt 0) {
        $prodId = $catResp.products[0].id
        $orderPayload = @{
            customerName = "Juan Perez Cliente Online"
            customerPhone = "0987654321"
            customerEmail = "juan.perez@example.com"
            deliveryAddress = "Av. 10 de Agosto y Naciones Unidas, Edificio Centrum"
            fulfillmentType = "DELIVERY"
            shippingCost = 2.50
            paymentMethod = "CASH"
            recipientName = "Juan Perez"
            recipientPhone = "0987654321"
            deliveryNotes = "Timbre 4B, junto a la farmacia"
            items = @(
                @{
                    productId = $prodId
                    quantity = 1
                }
            )
        } | ConvertTo-Json -Depth 5

        $orderResp = Invoke-RestMethod -Uri "http://localhost:8080/api/public/catalog/$tenantId/order" -Method POST -Body $orderPayload -ContentType "application/json"
        Write-Host "Order Placed Successfully!" -ForegroundColor Green
        Write-Host "Order Number:    " $orderResp.orderNumber -ForegroundColor Green
        Write-Host "Total:           `$" $orderResp.total -ForegroundColor Green
        Write-Host "Tracking Number: " $orderResp.trackingNumber -ForegroundColor Green
        Write-Host "Tracking URL:    " $orderResp.trackingUrl -ForegroundColor Green
        Write-Host "WhatsApp URL:    " $orderResp.whatsappUrl -ForegroundColor Green

        $trackingCode = $orderResp.trackingNumber

        Write-Host "`n=== 3. Testing GET /api/public/deliveries/tracking/{code} ===" -ForegroundColor Cyan
        $trackResp = Invoke-RestMethod -Uri "http://localhost:8080/api/public/deliveries/tracking/$trackingCode" -Method GET
        Write-Host "Tracking Delivery ID: " $trackResp.deliveryId -ForegroundColor Green
        Write-Host "Tracking Code:        " $trackResp.trackingNumber -ForegroundColor Green
        Write-Host "Status:               " $trackResp.status -ForegroundColor Green
        Write-Host "Status Label:         " $trackResp.statusLabel -ForegroundColor Green
        Write-Host "Step Index (1-4):     " $trackResp.stepIndex -ForegroundColor Green
        Write-Host "Recipient:            " $trackResp.recipientName -ForegroundColor Green
        Write-Host "Address:              " $trackResp.address -ForegroundColor Green
        Write-Host "Store Name:           " $trackResp.storeName -ForegroundColor Green
        Write-Host "Items in Order:       " $trackResp.items.Count -ForegroundColor Green
    }
} catch {
    Write-Host "Error testing order and tracking: $_" -ForegroundColor Red
}

Write-Host "`n=== 4. Testing POS / Authenticated Sale with Delivery Tracking ===" -ForegroundColor Cyan
try {
    $loginBody = @{
        tenantId = $tenantId
        email = "demo@fixme.local"
        password = "password"
    } | ConvertTo-Json
    $authResp = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $token = $authResp.accessToken

    $posBody = @{
        branchId = "00000000-0000-0000-0000-000000000010"
        channel = "STORE"
        fulfillmentType = "DELIVERY"
        shippingCost = 3.00
        warrantyDays = 30
        delivery = @{
            recipientName = "Maria Gomez"
            recipientPhone = "0991122334"
            address = "Calle Sucre y Bolívar, casa esquinera"
            courier = "Motorizado Local"
            notes = "Dejar en portería"
        }
        items = @(
            @{
                productId = $prodId
                quantity = 1
            }
        )
        payments = @(
            @{
                method = "CASH"
                amount = 100.00
            }
        )
    } | ConvertTo-Json -Depth 5

    $saleResp = Invoke-RestMethod -Uri "http://localhost:8080/api/sales" -Method POST -Body $posBody -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" }
    Write-Host "POS Sale Created!" -ForegroundColor Green
    Write-Host "Sale ID:         " $saleResp.id -ForegroundColor Green
    Write-Host "Tracking Number: " $saleResp.trackingNumber -ForegroundColor Green
    Write-Host "Delivery Status: " $saleResp.deliveryStatus -ForegroundColor Green

    # Verify tracking for POS sale
    if ($saleResp.trackingNumber) {
        $posTrackResp = Invoke-RestMethod -Uri "http://localhost:8080/api/public/deliveries/tracking/$($saleResp.trackingNumber)" -Method GET
        Write-Host "POS Tracking Status: $($posTrackResp.statusLabel) ($($posTrackResp.recipientName))" -ForegroundColor Green
    }
} catch {
    Write-Host "Error testing POS sale: $_" -ForegroundColor Red
}

Write-Host "`nAll verification checks executed!" -ForegroundColor Cyan

