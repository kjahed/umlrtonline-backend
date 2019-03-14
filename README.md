# UML-RT Execution Backend

This repository contains a Node.js application to support the remote execution of UML-RT models.

## Dependencies
- Java Development Kit 8
- NPM
- Docker
- GNU C++ Compiler
- Make

On Ubunutu, all the dependencies can be installed using the command:
```
sudo apt-get update && sudo apt-get install npm docker.io openjdk-8-jdk-headless build-essential
```

## Installation
1- Make sure your user belongs to the 'docker' group
```
sudo usermod -a -G docker <YOUR_USERNAME>
```
2- Grab the UML-RT execution sandbox docker image
```
cd ~ && wget https://github.com/kjahed/umlrtonline-backend/releases/download/0.1/umlrt_sandbox.tar
docker load -i umlrt_sandbox.tar
```
3- Clone and build the code
```
cd ~ && git clone https://github.com/kjahed/umlrtonline-backend
cd umlrtonline-backend && npm install
```
4- Build the RTS
```
cd ~/umlrtonline-backend/bin/plugins/org.eclipse.papyrusrt.rts_1.0.0.201707181457/umlrts
make clean && make
```
5- Run the backend. The backend will listen on port 3000 by default.
```
cd ~/umlrtonline-backend && node app.js
```

## Usage
Simply point the [Papyrus-RT Remote Executor plugin](https://github.com/kjahed/umlrtonline-papyrusrt) to your server's URL.
