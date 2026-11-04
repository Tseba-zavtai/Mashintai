$ErrorActionPreference = 'Stop'
$projectRef = 'wrekrjaitokrqydkwgtg'
# Refuse a repeat bootstrap BEFORE changing the Edge secret. Otherwise Edge/Vault could diverge.
$existing = & npx --yes supabase@2.122.0 db query --linked "select exists(select 1 from vault.secrets where name='store_refunds_cron_secret') as secret_exists"
if ($LASTEXITCODE -ne 0) { throw 'Cannot check existing configuration; nothing changed.' }
$configuration = ($existing -join "`n") | ConvertFrom-Json
if ($configuration.rows.Count -ne 1 -or $configuration.rows[0].secret_exists -ne $false) {
  throw 'Store configuration already exists or is unknown; nothing changed. Do not rotate the operator secret with this bootstrap.'
}
# Private operator secret stays in memory and Supabase Secret/Vault; never printed or written locally.
$operatorSecret = [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
& npx --yes supabase secrets set --project-ref $projectRef "STORE_REFUNDS_CRON_SECRET=$operatorSecret" 'STORE_PURCHASES_ENABLED=false' 'STORE_TEST_MODE_ENABLED=false' 'STORE_REFUNDS_ENABLED=false' 'IAP_ALLOW_TEST_PURCHASES=false'
if ($LASTEXITCODE -ne 0) { throw 'Secret configuration failed; no test mode enabled.' }
$secretSql = "do `$store`$ begin if exists(select 1 from vault.secrets where name='store_refunds_cron_secret') then raise exception 'Store cron secret already exists; operator reconciliation required'; end if; perform vault.create_secret('$operatorSecret','store_refunds_cron_secret','Private store refund polling header'); end `$store`$;"
& npx --yes supabase db query --linked $secretSql
if ($LASTEXITCODE -ne 0) { throw 'Vault configuration failed; no test mode enabled.' }
$headers = @{ 'x-refunds-secret' = $operatorSecret }
$readiness = Invoke-RestMethod -Method Post -Uri "https://$projectRef.supabase.co/functions/v1/store-refunds?source=readiness" -Headers $headers -ContentType 'application/json' -Body '{}'
$readiness | ConvertTo-Json -Compress
$operatorSecret = $null
