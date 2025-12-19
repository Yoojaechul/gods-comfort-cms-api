# CMS API 테스트 스크립트
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CMS API 테스트 시작" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Admin API Key (서버 콘솔에서 복사)
$adminKey = "ea5d1e67dd72ffa7180ea6d15fa839afed274a7453ce00e99694bd9d5c457462"
$baseUrl = "http://localhost:8787"

# 1. Health Check
Write-Host "1. Health Check 테스트..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health"
    Write-Host "   ✅ 성공: $($health | ConvertTo-Json -Compress)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ 실패: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 2. 사이트 생성
Write-Host "2. 사이트 생성 테스트..." -ForegroundColor Yellow
try {
    $siteBody = @{
        id = "gods"
        name = "Gods Site"
    } | ConvertTo-Json

    $site = Invoke-RestMethod -Uri "$baseUrl/admin/sites" `
        -Method POST `
        -Headers @{"x-api-key"=$adminKey; "Content-Type"="application/json"} `
        -Body $siteBody
    
    Write-Host "   ✅ 사이트 생성 성공: $($site.id) - $($site.name)" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "   ⚠️  사이트가 이미 존재합니다 (정상)" -ForegroundColor Yellow
    } else {
        Write-Host "   ❌ 실패: $_" -ForegroundColor Red
    }
}
Write-Host ""

# 3. 사이트 목록 조회
Write-Host "3. 사이트 목록 조회..." -ForegroundColor Yellow
try {
    $sites = Invoke-RestMethod -Uri "$baseUrl/admin/sites" `
        -Headers @{"x-api-key"=$adminKey}
    
    Write-Host "   ✅ 총 $($sites.sites.Count)개 사이트:" -ForegroundColor Green
    foreach ($s in $sites.sites) {
        Write-Host "      - $($s.id): $($s.name)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ 실패: $_" -ForegroundColor Red
}
Write-Host ""

# 4. Creator 생성
Write-Host "4. Creator 생성 테스트..." -ForegroundColor Yellow
try {
    $creatorBody = @{
        site_id = "gods"
        name = "Test Creator"
    } | ConvertTo-Json

    $creator = Invoke-RestMethod -Uri "$baseUrl/admin/creators" `
        -Method POST `
        -Headers @{"x-api-key"=$adminKey; "Content-Type"="application/json"} `
        -Body $creatorBody
    
    $creatorKey = $creator.api_key
    Write-Host "   ✅ Creator 생성 성공!" -ForegroundColor Green
    Write-Host "   Creator ID: $($creator.id)" -ForegroundColor Gray
    Write-Host "   Creator Name: $($creator.name)" -ForegroundColor Gray
    Write-Host "   Creator API Key: $creatorKey" -ForegroundColor Cyan
} catch {
    Write-Host "   ❌ 실패: $_" -ForegroundColor Red
    Write-Host "   기존 Creator를 사용합니다..." -ForegroundColor Yellow
    
    # 기존 Creator 조회
    $creators = Invoke-RestMethod -Uri "$baseUrl/admin/creators?site_id=gods" `
        -Headers @{"x-api-key"=$adminKey}
    
    if ($creators.creators.Count -gt 0) {
        Write-Host "   ⚠️  기존 Creator를 찾았습니다. 키 재발급이 필요합니다." -ForegroundColor Yellow
        $existingCreatorId = $creators.creators[0].id
        
        # 키 재발급
        $rotated = Invoke-RestMethod -Uri "$baseUrl/admin/creators/$existingCreatorId/rotate-key" `
            -Method POST `
            -Headers @{"x-api-key"=$adminKey}
        
        $creatorKey = $rotated.api_key
        Write-Host "   ✅ Creator 키 재발급 성공!" -ForegroundColor Green
        Write-Host "   Creator API Key: $creatorKey" -ForegroundColor Cyan
    }
}
Write-Host ""

# 5. Creator로 영상 등록
Write-Host "5. 영상 등록 테스트 (YouTube)..." -ForegroundColor Yellow
try {
    $videoBody = @{
        platform = "youtube"
        source_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        visibility = "public"
    } | ConvertTo-Json

    $video = Invoke-RestMethod -Uri "$baseUrl/videos" `
        -Method POST `
        -Headers @{"x-api-key"=$creatorKey; "Content-Type"="application/json"} `
        -Body $videoBody
    
    Write-Host "   ✅ 영상 등록 성공!" -ForegroundColor Green
    Write-Host "   Video ID: $($video.id)" -ForegroundColor Gray
    Write-Host "   Title: $($video.title)" -ForegroundColor Gray
    Write-Host "   Thumbnail: $($video.thumbnail_url)" -ForegroundColor Gray
    Write-Host "   Embed URL: $($video.embed_url)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ 실패: $_" -ForegroundColor Red
}
Write-Host ""

# 6. 공개 API로 영상 조회
Write-Host "6. 공개 API 테스트..." -ForegroundColor Yellow
try {
    $publicVideos = Invoke-RestMethod -Uri "$baseUrl/public/videos?site_id=gods&limit=5"
    
    Write-Host "   ✅ 총 $($publicVideos.videos.Count)개 영상 조회 성공!" -ForegroundColor Green
    foreach ($v in $publicVideos.videos) {
        Write-Host "      - [$($v.platform)] $($v.title)" -ForegroundColor Gray
        Write-Host "        Owner: $($v.owner_name)" -ForegroundColor DarkGray
    }
} catch {
    Write-Host "   ❌ 실패: $_" -ForegroundColor Red
}
Write-Host ""

# 7. Creator 플랫폼 키 저장 테스트
Write-Host "7. 플랫폼 키 저장 테스트..." -ForegroundColor Yellow
try {
    $keyBody = @{
        provider = "youtube"
        key_name = "api_key"
        key_value = "test_youtube_api_key_12345"
    } | ConvertTo-Json

    $savedKey = Invoke-RestMethod -Uri "$baseUrl/my/provider-keys" `
        -Method PUT `
        -Headers @{"x-api-key"=$creatorKey; "Content-Type"="application/json"} `
        -Body $keyBody
    
    Write-Host "   ✅ 플랫폼 키 저장 성공!" -ForegroundColor Green
    Write-Host "   Provider: $($savedKey.provider)" -ForegroundColor Gray
    Write-Host "   Key Name: $($savedKey.key_name)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ 실패: $_" -ForegroundColor Red
}
Write-Host ""

# 8. 플랫폼 키 조회
Write-Host "8. 플랫폼 키 조회 테스트..." -ForegroundColor Yellow
try {
    $keys = Invoke-RestMethod -Uri "$baseUrl/my/provider-keys" `
        -Headers @{"x-api-key"=$creatorKey}
    
    Write-Host "   ✅ 총 $($keys.keys.Count)개 키 조회 성공!" -ForegroundColor Green
    foreach ($k in $keys.keys) {
        Write-Host "      - [$($k.provider)] $($k.key_name)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ 실패: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "테스트 완료!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "다음 URL에서 UI를 테스트할 수 있습니다:" -ForegroundColor Yellow
Write-Host "  Admin UI:   http://localhost:8787/admin" -ForegroundColor Cyan
Write-Host "  Creator UI: http://localhost:8787/creator" -ForegroundColor Cyan
Write-Host ""
Write-Host "Admin API Key: $adminKey" -ForegroundColor Green
Write-Host "Creator API Key: $creatorKey" -ForegroundColor Green

































































































