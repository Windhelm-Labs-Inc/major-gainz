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

# Expose the ports for both frontend and backend
EXPOSE 3000 8000

# Set environment variables for ports (matching Makefile defaults)
ENV BACKEND_PORT=8000
ENV FRONTEND_PORT=3000

# Use the Makefile dev command to start both services
CMD ["make", "dev"] 