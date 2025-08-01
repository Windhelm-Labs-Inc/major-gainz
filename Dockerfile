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
# Install Python deps without relying on existing poetry.lock (may be excluded by .dockerignore)
RUN rm -f poetry.lock \
    && poetry lock --no-interaction \
    && poetry install --no-interaction --no-root 

# Install Node.js dependencies for frontend
WORKDIR /app/services/frontend
RUN npm install

# Create logs directory for backend
RUN mkdir -p /app/services/backend/logs

# Return to project root
WORKDIR /app

# Azure provides the port to listen on via WEBSITES_PORT

ENV PORT=${WEBSITES_PORT:-8080}

# Build frontend for production
WORKDIR /app/services/frontend
RUN npm run build

# Expose only the frontend port (public access)
EXPOSE $PORT

# Create startup script
RUN echo '#!/bin/sh\n\
set -e\n\
echo "Starting backend server..."\n\
cd /app/services/backend\n\
poetry run uvicorn app.main:app --host 127.0.0.1 --port 8000 &\n\
BACKEND_PID=$!\n\
echo "Backend started with PID: $BACKEND_PID"\n\
\n\
echo "Starting frontend server..."\n\
cd /app/services/frontend\n\
npm run preview -- --host 0.0.0.0 --port $PORT &\n\
FRONTEND_PID=$!\n\
echo "Frontend started with PID: $FRONTEND_PID"\n\
\n\
# Function to handle shutdown\n\
cleanup() {\n\
    echo "Shutting down services..."\n\
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true\n\
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null || true\n\
    echo "Services stopped."\n\
}\n\
\n\
# Set trap for cleanup on exit\n\
trap cleanup TERM INT\n\
\n\
# Wait for both processes\n\
wait $FRONTEND_PID $BACKEND_PID\n\
' > /start.sh && chmod +x /start.sh

# Start both backend and frontend servers
CMD ["/start.sh"]
