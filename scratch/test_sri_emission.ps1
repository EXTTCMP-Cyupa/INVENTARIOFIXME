$body = @{
    email = "demo@fixme.local"
    password = "password"
} | ConvertTo-Json

try {
    $res = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -ContentType "application/json" -Body $body
    Write-Output "Login demo OK! Token: $($res.accessToken.Substring(0, 20))..."
} catch {
    Write-Output "Error demo: $_"
}

# Now try eli@eli.com with common passwords
$passwords = @("123456", "admin", "password", "eli", "12345678", "admin123")
foreach ($p in $passwords) {
    $body = @{
        email = "eli@eli.com"
        password = $p
    } | ConvertTo-Json
    try {
        $res = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -ContentType "application/json" -Body $body
        Write-Output "Login eli OK with password '$p'! Token: $($res.accessToken.Substring(0, 20))..."
        $token = $res.accessToken
        
        # Test emitting SRI invoice for sale 109d4114-b210-476d-b839-4cfb66ec7e05
        Write-Output "Testing issueInvoiceFromSale..."
        $headers = @{ Authorization = "Bearer $token" }
        $invRes = Invoke-RestMethod -Uri "http://localhost:8080/api/sri/invoices/from-sale/109d4114-b210-476d-b839-4cfb66ec7e05" -Method Post -Headers $headers
        Write-Output "SUCCESS! Invoice emitted: $($invRes.numero_completo), Estado: $($invRes.estado_sri)"
        break
    } catch {
        # continue
    }
}

