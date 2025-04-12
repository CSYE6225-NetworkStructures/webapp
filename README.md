# Health Check API

## Project Details
This project implements a backend (API-only) web application with a health check API (`/healthz`). It ensures the service is running correctly by inserting a record into the database and returning appropriate HTTP status codes.

## Technology Stack
- **Programming Language**: JavaScript
- **Backend Framework**: Node JS with Express
- **Database**: MySQL
- **ORM Framework**: Sequelize
- **Monitoring**: AWS CloudWatch for logs and metrics

## API Details

### Health Check Endpoint (`/healthz`)
- **Method**: `GET`
- **Response Codes**:
  - `200 OK`: Record inserted successfully.
  - `503 Service Unavailable`: Database insert failed.
  - `405 Method Not Allowed`: Unsupported HTTP method.
  - `400 Bad Request`: Request contains a payload.

### File Upload Endpoint (`/v1/file`)
- **Method**: `POST`
- **Response Codes**:
  - `201 Created`: Record Created successfully.
  - `503 Service Unavailable`: Database insert failed.
  - `405 Method Not Allowed`: Unsupported HTTP method.
  - `400 Bad Request`: Request contains a header.

### File Upload Endpoint (`/v1/file/:id`)
- **Method**: `GET`
- **Response Codes**:
  - `200 OK`: Displays the file details.
  - `503 Service Unavailable`: Database insert failed.
  - `405 Method Not Allowed`: Unsupported HTTP method.
  - `400 Bad Request`: Request contains a payload or header.

### File Upload Endpoint (`/v1/file/:id`)
- **Method**: `DELETE`
- **Response Codes**:
  - `204 No Content`: Deletes the file.
  - `503 Service Unavailable`: Database insert failed.
  - `405 Method Not Allowed`: Unsupported HTTP method.
  - `400 Bad Request`: Request contains a payload or header.

## Unit Tests
The project includes unit tests located in the `__tests__` directory. These tests ensure the functionality and reliability of critical API features, including the health check endpoint.

## Scripts
A `scripts` folder contains a shell script (`script.sh`). This script is designed to automate setup tasks on a Linux cloud machine. It can:
- Set up the SQL database.
- Unzip and prepare the application code.

## Logging and Metrics
The application includes comprehensive logging and metrics capabilities using AWS CloudWatch:

### Logging
- All API requests and responses are logged with detailed information
- Error logs include stack traces for easier debugging
- Log files are stored in both local files and CloudWatch Logs
- Log groups in CloudWatch are organized by instance ID and log type (application, error)
- Log messages include contextual information such as request IDs, durations, and status codes

### Metrics
- API usage metrics are collected using the StatsD protocol
- The following custom metrics are tracked in CloudWatch:
  - **Count**: Number of times each API endpoint is called
  - **Timer**: Duration of API calls in milliseconds
  - **Timer**: Duration of database queries in milliseconds
  - **Timer**: Duration of S3 operations in milliseconds
- Metrics include dimensions for better filtering and analysis

## .env File Structure
Create a `.env` file in the root directory and add the following variables:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
PORT=8080
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-s3-bucket-name
LOG_DIRECTORY=/opt/myapp/logs
ENABLE_FILE_LOGGING=true
```env

test