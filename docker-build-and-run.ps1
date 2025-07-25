Write-Host "Building Docker image."
docker build -t quick-origins-poc .
Write-Host "Running quick-origins-poc Container." 
docker run -it --rm --network host --name quick-origins-poc quick-origins-poc 