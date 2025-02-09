# Rema
A powerful and scalable certificate generation and management system
for individuals, businesses, and organizations.

<br/>

<p align='center'>
	<a href='#'><img src='docs/logo.svg' alt='Rema Logo' width='80%' /></a>
</p>

## Instructions
See the [wiki](../../wiki) for instructions on setup and development.

For other discussions, see the [discussions](../../discussions) page.

## Development (Docker)
Build the Docker image using Docker Compose.
```bash
docker compose build rema-dev
```

Start the container in the working directory.
```bash
docker compose up -d rema-dev
```

Attach to the container.
```bash
# The container might have a name
# different from what's mentioned below.
docker attach server-rema-dev-1
```

Install the dependencies.
```bash
cd /home/ubuntu/app/src
npm ci
```

Use `npm run dev` to run the development server.

## Execution (Docker)
Use Docker Compose to spin up the containers.
Make the necessary changes to `docker-compose.yml`, if any.
```bash
docker compose up -d
```

The application will run on port 8080 of the host machine.

## Execution
Install the dependencies for `node-canvas` in your operating system as
specified [here](../../wiki/Development-Setup).

```bash
# Ubuntu
sudo apt install build-essential libcairo2-dev \
	libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

Install the dependencies for Rema locally.

```bash
cd src
npm ci
```

Set the desired environment variables.
```bash
# MongoDB URI (default: 'mongodb://localhost/rema')
export DB=mongodb://uri.to.mongodb/dbname

# Port (default: 8080)
export PORT=80

npm start
```

For more information, see the [wiki](../../wiki).

## Contributing
See the [contribution guide](CONTRIBUTING.md).

# Made with ❤ by [Param](https://www.paramsid.com).