# metasphere - COVID-19 Research

## Getting Started

## Development

### Prerequisites

You need the following software installed,
- [Node.js](https://nodejs.org/en/), v12.x or higher

### Installing dependencies

Please take the following steps to install dependencies,

1. Suppose you are in the root directory of this repository.

2. Install Node modules.

    ```
    npm ci
    ```

### Building a front-end application

This project uses [Webpack](https://webpack.js.org) to build a front-end application.
Please take the following steps to build a front-end application,

1. Suppose you are in the root directory of this repository.

2. Run build.

    ```
    npm run build
    ```

3. You will find a `dist` directory that contains an `index.html` file and other scripts.

### Starting a local server

You can locally test the front-end application with a server running on `localhost`.
Please take the following steps to start a local server,

1. Suppose you are in the root directory of this repository.

2. Start a server.

    ```
    npm start
    ```

3. The server will start listening at [`localhost:9090`](http://localhost:9090).

When you no longer need the server, hit `Ctrl+C` on the console.

### Starting a development server

It is tiresome to rebuild the application and restart the server every time you change the code.
If you run a [`webpack-dev-server`](https://webpack.js.org/configuration/dev-server/) in the background, it takes care of building and reloading.
Please take the following steps to start a development server,

1. Suppose you are in the root directory of this repository.

2. Start a development server.

    ```
    npm run dev
    ```

3. The development server will start listening at [`localhost:9000`](http://localhost:9000).

4. Edit the code.

5. The development server automatically build and reload a new application.

6. Repeat the steps 4 and 5.

When you no longer need the server, hit `Ctrl+C` on the console.