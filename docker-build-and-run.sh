#!/bin/bash
echo "Building Docker image."
docker build -t quick-origins-poc .
docker run -it --rm --network host --name quick-origins-poc quick-origins-poc 
