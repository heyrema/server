# Rema
A powerful and scanable certificate generation and management system
for individuals, businesses, and organizations.

<br/>

<p align='center'>
	<a href='#'><img src='docs/logo.svg' alt='Rema Logo' width='80%' /></a>
</p>

## Instructions
See the [wiki](../../wiki) for instructions on setup and development.

For other discussions, see the [discussions](../../discussions) page.

## Execution
Install the dependencies for `node-canvas` in your operating system as
specified [here](https://www.npmjs.com/package/canvas).

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

# Made with ❤ by [Param](https://www.paramsid.com).