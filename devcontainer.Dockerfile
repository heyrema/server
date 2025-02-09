FROM ubuntu:24.04

USER root
ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
	apt-get upgrade -y && \
	apt-get install -y \
		wget python3-setuptools \
		build-essential libcairo2-dev \
		libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
	
USER ubuntu
WORKDIR /home/ubuntu/app
		
RUN	wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash \
	&& export NVM_DIR=~/.nvm \
	&& . $NVM_DIR/nvm.sh \
	&& nvm install 20 \
	&& nvm alias default 20 \
	&& nvm use default

CMD ["bash", "--login"]