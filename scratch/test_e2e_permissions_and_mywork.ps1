$ErrorActionPreference = 'Stop'

$loginAdminBody = @{
    tenantId = "00000000-0000-0000-0000-000000000001"
    email    = "demo@fixme.local"
    password = "password"
} | ConvertTo-Json

Write-Host "1. Iniciar sesion como MANAGER/Admin..."
$adminResp = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -ContentType "application/json" -Body $loginAdminBody
$adminToken = $adminResp.accessToken
$adminHeaders = @{ Authorization = "Bearer $adminToken" }
Write-Host "   Admin autenticado OK."

Write-Host "2. Obtener matriz de permisos por rol actual..."
$rolePerms = Invoke-RestMethod -Uri "http://localhost:8080/api/administration/role-permissions" -Method Get -Headers $adminHeaders
Write-Host "   Permisos de TECHNICIAN actuales: $($rolePerms.TECHNICIAN -join ', ')"

Write-Host "3. Actualizar permisos de TECHNICIAN para incluir pos, cash, sales, my-work..."
$updateRoleBody = @{
    role = "TECHNICIAN"
    permissions = @("home", "my-work", "work-orders", "warranties", "customers", "pos", "cash", "sales")
} | ConvertTo-Json

$updatedPerms = Invoke-RestMethod -Uri "http://localhost:8080/api/administration/role-permissions" -Method Put -ContentType "application/json" -Headers $adminHeaders -Body $updateRoleBody
Write-Host "   Permisos guardados para TECHNICIAN: $($updatedPerms.TECHNICIAN -join ', ')"

Write-Host "4. Obtener usuario tecnico..."
$users = Invoke-RestMethod -Uri "http://localhost:8080/api/administration/users" -Method Get -Headers $adminHeaders
$techUser = $users | Where-Object { $_.email -eq "tecnico@fixme.local" }
if (-not $techUser) {
    Write-Host "   Creando usuario tecnico..."
    $createUserBody = @{
        email = "tecnico@fixme.local"
        password = "password123"
        role = "TECHNICIAN"
        fullName = "Carlos Tecnico"
        identification = "1799999999"
        phone = "0991234567"
        address = "Taller Central"
    } | ConvertTo-Json
    $null = Invoke-RestMethod -Uri "http://localhost:8080/api/administration/users" -Method Post -ContentType "application/json" -Headers $adminHeaders -Body $createUserBody
    $users = Invoke-RestMethod -Uri "http://localhost:8080/api/administration/users" -Method Get -Headers $adminHeaders
    $techUser = $users | Where-Object { $_.email -eq "tecnico@fixme.local" }
}
Write-Host "   Tecnico ID: $($techUser.id), Nombre: $($techUser.full_name)"

Write-Host "5. Crear orden de servicio asignada al tecnico..."
$customers = Invoke-RestMethod -Uri "http://localhost:8080/api/customers" -Method Get -Headers $adminHeaders
$firstCustomer = $customers[0]
$orderBody = @{
    customerId = $firstCustomer.id
    branchId = "00000000-0000-0000-0000-000000000010"
    deviceBrand = "Apple"
    deviceModel = "iPhone 13 Pro"
    serialNumber = "SN-IPH13-TEST"
    reportedFault = "Pantalla rota y no carga"
    accessories = "Cargador y funda"
    assignedTechnicianId = $techUser.id
    slaHours = 24
} | ConvertTo-Json

$createdOrder = Invoke-RestMethod -Uri "http://localhost:8080/api/work-orders" -Method Post -ContentType "application/json" -Headers $adminHeaders -Body $orderBody
Write-Host "   Orden creada: ID=$($createdOrder.id), Numero=$($createdOrder.orderNumber)"

Write-Host "6. Iniciar sesion como TECNICO (tecnico@fixme.local)..."
$techLoginBody = @{
    tenantId = "00000000-0000-0000-0000-000000000001"
    email    = "tecnico@fixme.local"
    password = "password123"
} | ConvertTo-Json
$techResp = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -ContentType "application/json" -Body $techLoginBody
$techToken = $techResp.accessToken
$techHeaders = @{ Authorization = "Bearer $techToken" }

# Decode JWT payload
$jwtParts = $techToken.Split('.')
$padLen = 4 - ($jwtParts[1].Length % 4)
if ($padLen -lt 4) { $jwtParts[1] += ("=" * $padLen) }
$payloadBytes = [System.Convert]::FromBase64String($jwtParts[1])
$payloadJson = [System.Text.Encoding]::UTF8.GetString($payloadBytes)
$payload = $payloadJson | ConvertFrom-Json
Write-Host "   Token JWT de Tecnico decodificado:"
Write-Host "     primary_role: $($payload.primary_role)"
Write-Host "     scope: $($payload.scope)"
Write-Host "     permissions: $($payload.permissions -join ', ')"

Write-Host "7. Consultar 'Mi Trabajo' (/api/work-orders/my-work)..."
$myWork = Invoke-RestMethod -Uri "http://localhost:8080/api/work-orders/my-work" -Method Get -Headers $techHeaders
Write-Host "   Total ordenes asignadas a este tecnico: $($myWork.Count)"
$myOrder = $myWork | Where-Object { $_.id -eq $createdOrder.id }
if ($myOrder) {
    Write-Host "   [OK] Orden encontrada en Mi Trabajo: $($myOrder.order_number) - $($myOrder.device_brand) $($myOrder.device_model) (Estado: $($myOrder.status))"
} else {
    throw "Orden creada no encontrada en Mi Trabajo"
}

Write-Host "8. Consultar estadisticas de 'Mi Trabajo' (/api/work-orders/my-work/stats)..."
$stats = Invoke-RestMethod -Uri "http://localhost:8080/api/work-orders/my-work/stats" -Method Get -Headers $techHeaders
Write-Host "   Stats: Total=$($stats.total), Activas=$($stats.active), En Reparacion=$($stats.in_repair), Listas=$($stats.ready)"

Write-Host "9. Tecnico actualiza estado a EN_REPARACION..."
$statusUpdateBody = @{
    status = "EN_REPARACION"
    technicianNotes = "Iniciando revision de circuito de carga"
} | ConvertTo-Json
$updatedOrder = Invoke-RestMethod -Uri "http://localhost:8080/api/work-orders/$($createdOrder.id)/status" -Method Patch -ContentType "application/json" -Headers $techHeaders -Body $statusUpdateBody
Write-Host "   [OK] Estado actualizado a: $($updatedOrder.status)"

Write-Host "10. Verificar que el tecnico puede usar POS y Caja sin error 403..."
$posSales = Invoke-RestMethod -Uri "http://localhost:8080/api/sales" -Method Get -Headers $techHeaders
Write-Host "   [OK] Tecnico consulto ventas exitosamente (HTTP 200, $($posSales.Count) ventas encontradas)"

$cashCurrent = Invoke-RestMethod -Uri "http://localhost:8080/api/cash/current?branchId=00000000-0000-0000-0000-000000000010" -Method Get -Headers $techHeaders
Write-Host "   [OK] Tecnico consulto caja exitosamente (HTTP 200, Caja Estado=$($cashCurrent.status))"

Write-Host "11. Test individual user permission override..."
$overrideBody = @{
    permissions = @("home", "my-work", "work-orders")
} | ConvertTo-Json
$overrideResp = Invoke-RestMethod -Uri "http://localhost:8080/api/administration/users/$($techUser.id)/permissions" -Method Put -ContentType "application/json" -Headers $adminHeaders -Body $overrideBody
Write-Host "   Permisos individuales asignados a $($techUser.email): $($overrideResp.customPermissions -join ', ')"

$techResp2 = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -ContentType "application/json" -Body $techLoginBody
$p2Parts = $techResp2.accessToken.Split('.')
$p2Pad = 4 - ($p2Parts[1].Length % 4)
if ($p2Pad -lt 4) { $p2Parts[1] += ("=" * $p2Pad) }
$payload2 = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($p2Parts[1])) | ConvertFrom-Json
Write-Host "   Nuevo token con override individual: $($payload2.permissions -join ', ')"

# Clear individual override to restore role permissions
$clearOverrideBody = @{ permissions = $null } | ConvertTo-Json
$null = Invoke-RestMethod -Uri "http://localhost:8080/api/administration/users/$($techUser.id)/permissions" -Method Put -ContentType "application/json" -Headers $adminHeaders -Body $clearOverrideBody
Write-Host "   Override individual limpiado (restaurado a rol)."

Write-Host ""
Write-Host "=== TODO EL FLUJO DE PERMISOS DINAMICOS Y MI TRABAJO PASO EXITOSAMENTE ==="

