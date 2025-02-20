# Health Check API

## Project Details
This project implements a backend (API-only) web application with a health check API (`/healthz`). It ensures the service is running correctly by inserting a record into the database and returning appropriate HTTP status codes.

## Technology Stack
- **Programming Language**: JavaScript
- **Backend Framework**: Node JS with Express
- **Database**: MySQL
- **ORM Framework**: Sequelize

## API Details

### Health Check Endpoint (`/healthz`)
- **Method**: `GET`
- **Response Codes**:
  - `200 OK`: Record inserted successfully.
  - `503 Service Unavailable`: Database insert failed.
  - `405 Method Not Allowed`: Unsupported HTTP method.
  - `400 Bad Request`: Request contains a payload.

## Unit Tests
The project includes unit tests located in the `__tests__` directory. These tests ensure the functionality and reliability of critical API features, including the health check endpoint.

## Scripts
A `scripts` folder contains a shell script (`script.sh`). This script is designed to automate setup tasks on a Linux cloud machine. It can:
- Set up the SQL database.
- Unzip and prepare the application code.

## .env File Structure
Create a `.env` file in the root directory and add the following variables:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
PORT=8080
```

## Prerequisites

Before you build and deploy the application locally, ensure the following prerequisites are met:

### 1. Node.js and npm

   - Install Node.js (version 14 or higher).

   - Verify installation:
     ```bash
     node -v
     npm -v
     ```

### 2. MySQL

   - Install MySQL (version 5.7 or higher) on your local machine.

   - Ensure the MySQL server is running.

   - Create a MySQL user with appropriate permissions.

### 3. Environment Variables

   - Create a `.env` file in the root directory of the project.

   - Define the following environment variables:
     ```plaintext
     DB_HOST=localhost
     DB_USER=your_database_user
     DB_PASSWORD=your_database_password
     DB_NAME=health_check
     DB_PORT=3306
     PORT = 8080
     ```
### 3. Github Unit Tests

   - Unit tests are configured to check the functionalities, Unit tests are ran on every PR.

## Setup Instructions

### 1. Clone the Repository

   ```bash
   git clone https://github.com/CSYE6225-Network-Cloud/webapp.git
   cd webapp
   ```

### 2. Install Dependencies

   ```bash
   npm install
   ```

### 3. Configure Environment Variables

   Create a `.env` file in the root directory and provide the following:

   ```plaintext
   DB_HOST=localhost
   DB_USER=<your_database_user>
   DB_PASSWORD=<your_database_password>
   DB_NAME=health_check
   DB_PORT=3306
   PORT=8080
   ```

### 4. Run Server

   ```bash
   npm start
   ```
