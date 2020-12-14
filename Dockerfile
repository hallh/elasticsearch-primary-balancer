FROM node:15.4.0-buster
RUN mkdir -p /opt/elasticsearch-primary-balancer/src
COPY balance.js /opt/elasticsearch-primary-balancer/
COPY src /opt/elasticsearch-primary-balancer/src/
WORKDIR /opt/elasticsearch-primary-balancer/
ENTRYPOINT ["node", "/opt/elasticsearch-primary-balancer/balance.js"]
