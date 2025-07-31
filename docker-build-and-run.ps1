Write-Host "Building Docker image."
docker build -t quick-origins-poc .

Write-Host "Running Docker container with volume mounts."
docker run -it --rm -p 3000:3000 -p 8000:8000 `
  -v "${PWD}/services/backend/logs:/app/services/backend/logs" `
  -v "${PWD}/services/frontend/appSettings.json:/app/services/frontend/appSettings.json" `
  --name quick-origins-poc quick-origins-poc