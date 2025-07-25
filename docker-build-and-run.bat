@echo off
echo Building Docker image.
docker build -t quick-origins-poc . 
echo Launching Docker container.
docker run -it --rm --network host --name quick-origins-poc quick-origins-poc 