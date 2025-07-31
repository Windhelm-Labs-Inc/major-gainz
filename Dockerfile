# Use an official Python base image that also supports Node.js
FROM nikolaik/python-nodejs:python3.11-nodejs20-slim

# Install system dependencies including Node.js
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    make \
    git \ 
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*


RUN pip install poetry


WORKDIR /app


COPY . .

# Configure Poetry to not create virtual environments in container
#RUN poetry config virtualenvs.create false

# Install Python dependencies for backend
WORKDIR /app/services/backend
RUN poetry install 

# Install Node.js dependencies for frontend
WORKDIR /app/services/frontend
RUN npm install

# Create logs directory for backend
RUN mkdir -p /app/services/backend/logs

# Return to project root
WORKDIR /app

# Expose only the frontend port - backend is internal only
EXPOSE 3000

# Set environment variables for ports (matching Makefile defaults)
ENV BACKEND_PORT=8000
ENV FRONTEND_PORT=3000
# Set Docker environment flag for internal backend URL
ENV DOCKER_ENV=true
ENV VITE_BACKEND_URL=http://127.0.0.1:8000
# Force IPv4 to avoid networking issues
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Use the Docker-specific command that hides backend internally
CMD ["make", "docker-dev-internal"] 